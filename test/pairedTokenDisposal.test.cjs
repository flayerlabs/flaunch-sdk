const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeFunctionData, encodePacked, zeroAddress } = require("viem");
const { base, baseSepolia, robinhood } = require("viem/chains");
const {
  PairedTokenAcquisitionDexAddress,
  ReadFlaunchSDK,
  ROUTER_CUSTODY_RECIPIENT,
  SlipstreamSwapRouterAbi,
  UniswapV3SwapRouter02Abi,
  encodeDisposalEthSell,
  encodeDisposalExactInputPath,
} = require("../dist/index.cjs.js");

const SENDER = "0x1111111111111111111111111111111111111111";
const RECIPIENT = "0x2222222222222222222222222222222222222222";
// Sorts above the hub and WETH on both chains, so the hub (or WETH) is token0 in a venue pool
const PAIRED = "0xf200000000000000000000c2e324d24d7eecd1fb";
const Q96 = 2n ** 96n;
const DEADLINE = 1_800_000_000n;

const baseDex = PairedTokenAcquisitionDexAddress[base.id];
const rhDex = PairedTokenAcquisitionDexAddress[robinhood.id];
const HUB_ROUTE = { pool: "0x4444444444444444444444444444444444444444", poolKey: 10, payingIsToken0: true };

const leg = (route, overrides = {}) => ({
  pairedToken: PAIRED,
  route,
  recipient: RECIPIENT,
  deadline: DEADLINE,
  amountIn: 1_000_000n,
  amountOutMinimum: 123_456n,
  ...overrides,
});

// ── Config ──────────────────────────────────────────────────────────────────

test("router custody recipients follow each deployed router's convention", () => {
  // Slipstream SwapRouter (v3-periphery): address(0) -> address(this)
  assert.equal(ROUTER_CUSTODY_RECIPIENT.slipstream, zeroAddress);
  // SwapRouter02: Constants.ADDRESS_THIS = address(2)
  assert.equal(ROUTER_CUSTODY_RECIPIENT.uniswapV3, "0x0000000000000000000000000000000000000002");
});

test("Base ships the B20 DEX's own QuoterV2 for depth-aware disposal quotes", () => {
  assert.equal(baseDex.quoterV2.toLowerCase(), "0x514c8b5f54112481e28028f1166bd78501089259");
  // No venue discovery on Slipstream: the quoter prices the calculator's pool only
  assert.equal(baseDex.venues, undefined);
});

// ── Path encoding ───────────────────────────────────────────────────────────

test("the sell path is input-first: token -> hub -> WETH with each hop key in the 3-byte slot", () => {
  assert.equal(
    encodeDisposalExactInputPath(baseDex, PAIRED, HUB_ROUTE),
    encodePacked(
      ["address", "uint24", "address", "uint24", "address"],
      [PAIRED, 10, baseDex.hubToken, 50, baseDex.weth]
    )
  );
  assert.equal(
    encodeDisposalExactInputPath(rhDex, PAIRED, { ...HUB_ROUTE, poolKey: 3000 }),
    encodePacked(
      ["address", "uint24", "address", "uint24", "address"],
      [PAIRED, 3000, rhDex.hubToken, 500, rhDex.weth]
    )
  );
});

test("a direct route's sell path is a single token -> WETH hop", () => {
  const route = { pool: "0x5555555555555555555555555555555555555555", poolKey: 3000, payingIsToken0: true, direct: true };
  assert.equal(
    encodeDisposalExactInputPath(rhDex, PAIRED, route),
    encodePacked(["address", "uint24", "address"], [PAIRED, 3000, rhDex.weth])
  );
});

// ── Calldata ────────────────────────────────────────────────────────────────

test("Base: sell is multicall(bytes[]) of exactInput into router custody, then unwrapWETH9 to the recipient", () => {
  const data = encodeDisposalEthSell(baseDex, leg(HUB_ROUTE));
  const outer = decodeFunctionData({ abi: SlipstreamSwapRouterAbi, data });
  assert.equal(outer.functionName, "multicall");
  assert.equal(outer.args.length, 1);
  assert.equal(outer.args[0].length, 2);

  const exactInput = decodeFunctionData({ abi: SlipstreamSwapRouterAbi, data: outer.args[0][0] });
  assert.equal(exactInput.functionName, "exactInput");
  const p = exactInput.args[0];
  assert.equal(p.path, encodeDisposalExactInputPath(baseDex, PAIRED, HUB_ROUTE));
  assert.equal(p.recipient, zeroAddress);
  assert.equal(p.deadline, DEADLINE);
  assert.equal(p.amountIn, 1_000_000n);
  assert.equal(p.amountOutMinimum, 123_456n);

  const unwrap = decodeFunctionData({ abi: SlipstreamSwapRouterAbi, data: outer.args[0][1] });
  assert.equal(unwrap.functionName, "unwrapWETH9");
  assert.deepEqual(unwrap.args, [123_456n, RECIPIENT]);
});

test("Robinhood: sell is multicall(deadline, bytes[]) of exactInput to ADDRESS_THIS, then unwrapWETH9", () => {
  const route = { ...HUB_ROUTE, poolKey: 3000 };
  const data = encodeDisposalEthSell(rhDex, leg(route));
  const outer = decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data });
  assert.equal(outer.functionName, "multicall");
  assert.equal(outer.args[0], DEADLINE);
  assert.equal(outer.args[1].length, 2);

  const exactInput = decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data: outer.args[1][0] });
  assert.equal(exactInput.functionName, "exactInput");
  const p = exactInput.args[0];
  // SwapRouter02 params carry no deadline
  assert.equal("deadline" in p, false);
  assert.equal(p.path, encodeDisposalExactInputPath(rhDex, PAIRED, route));
  assert.equal(p.recipient, "0x0000000000000000000000000000000000000002");
  assert.equal(p.amountIn, 1_000_000n);
  assert.equal(p.amountOutMinimum, 123_456n);

  const unwrap = decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data: outer.args[1][1] });
  assert.equal(unwrap.functionName, "unwrapWETH9");
  assert.deepEqual(unwrap.args, [123_456n, RECIPIENT]);
  // The explicit-recipient overload: unwrapWETH9(uint256,address) = 0x49404b7c
  assert.equal(outer.args[1][1].slice(0, 10), "0x49404b7c");
});

// ── Quote and plan through a drift double ───────────────────────────────────

const CALC = "0x6666666666666666666666666666666666666666";
const POOL_1PCT = "0xaaaa000000000000000000000000000000000001"; // the calculator's pool
const POOL_30BP = "0xaaaa000000000000000000000000000000000002";
const POOL_DIRECT = "0xbbbb000000000000000000000000000000000003";

function disposalDrift(dex, { quotes = {}, quoterFails = false, allowance = 0n } = {}) {
  const interactions = [];
  const hub = dex.hubToken.toLowerCase();
  const weth = dex.weth.toLowerCase();
  const drift = {
    async getSignerAddress() {
      return SENDER;
    },
    contract({ address }) {
      return {
        address,
        cache: { clear: async () => {} },
        async read(fn, args) {
          interactions.push({ kind: "read", address, fn, args });
          if (fn === "getPool") {
            const other = args.tokenA.toLowerCase();
            if (other === hub) return args.fee === 10_000 ? POOL_1PCT : args.fee === 3000 ? POOL_30BP : zeroAddress;
            if (other === weth) return args.fee === 3000 ? POOL_DIRECT : zeroAddress;
            return zeroAddress;
          }
          if (fn === "tokenConfig") {
            return {
              approved: true,
              tokenType: 4,
              decimals: 18,
              underlying: zeroAddress,
              feeEscrow: zeroAddress,
              priceCalculator: CALC,
              minDistribute: 0n,
              bidWallThreshold: 0n,
            };
          }
          if (fn === "hubPairedPool") return POOL_1PCT;
          if (fn === "hubToken") return dex.hubToken;
          if (fn === "fee") return 10_000;
          if (fn === "tickSpacing") return 100;
          if (fn === "token0") {
            return address.toLowerCase() === dex.wethHubPool.toLowerCase() ? dex.weth : dex.hubToken;
          }
          if (fn === "slot0") {
            return {
              sqrtPriceX96: Q96,
              tick: 0,
              observationIndex: 0,
              observationCardinality: 0,
              observationCardinalityNext: 0,
              feeProtocol: 0,
              unlocked: true,
            };
          }
          if (fn === "allowance") return allowance;
          throw new Error(`Unexpected read: ${fn} on ${address}`);
        },
        async simulateWrite(fn, args) {
          interactions.push({ kind: "simulate", address, fn, args });
          if (fn === "quoteExactInput") {
            if (quoterFails) throw new Error("quoter down");
            for (const [needle, amountOut] of Object.entries(quotes)) {
              if (args.path.toLowerCase().includes(needle.toLowerCase())) {
                return { amountOut, sqrtPriceX96AfterList: [], initializedTicksCrossedList: [], gasEstimate: 0n };
              }
            }
            throw new Error("no liquidity");
          }
          throw new Error(`Unexpected simulate: ${fn}`);
        },
      };
    },
  };
  return { drift, interactions };
}

test("Robinhood: the disposal quote compares hub and direct venues over token-first sell paths", async () => {
  // A path containing USDG is a hub route; the direct path has no hub
  const { drift, interactions } = disposalDrift(rhDex, {
    quotes: { [rhDex.hubToken.slice(2)]: 900n, [rhDex.weth.slice(2)]: 990n },
  });
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);
  const quote = await sdk.quotePairedTokenDisposal({ pairedToken: PAIRED, output: "eth", amountIn: 1_000_000n });
  assert.equal(quote.source, "quoter");
  assert.equal(quote.route.direct, true);
  assert.equal(quote.route.pool, POOL_DIRECT);
  assert.equal(quote.expectedOut, 990n);
  // Every quoted path starts with the paired token (input first) and ends at WETH
  const paths = interactions.filter((i) => i.fn === "quoteExactInput").map((i) => i.args.path.toLowerCase());
  assert.ok(paths.length >= 3);
  for (const path of paths) {
    assert.ok(path.startsWith(PAIRED.toLowerCase()));
    assert.ok(path.endsWith(rhDex.weth.slice(2).toLowerCase()));
  }
});

test("Base: the disposal quote runs the B20 QuoterV2 over the calculator's pool", async () => {
  const { drift, interactions } = disposalDrift(baseDex, { quotes: { [baseDex.hubToken.slice(2)]: 777n } });
  const sdk = new ReadFlaunchSDK(base.id, drift);
  const quote = await sdk.quotePairedTokenDisposal({ pairedToken: PAIRED, output: "eth", amountIn: 1_000_000n });
  assert.equal(quote.source, "quoter");
  assert.equal(quote.route.pool, POOL_1PCT);
  assert.equal(quote.route.poolKey, 100);
  assert.equal(quote.expectedOut, 777n);
  const call = interactions.find((i) => i.fn === "quoteExactInput");
  assert.equal(call.address.toLowerCase(), baseDex.quoterV2.toLowerCase());
  assert.equal(
    call.args.path,
    encodePacked(["address", "uint24", "address", "uint24", "address"], [PAIRED, 100, baseDex.hubToken, 50, baseDex.weth])
  );
});

test("the quoter falling over degrades to a token -> hub -> WETH spot sell on the calculator's pool", async () => {
  const { drift } = disposalDrift(rhDex, { quoterFails: true });
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);
  const quote = await sdk.quotePairedTokenDisposal({ pairedToken: PAIRED, output: "eth", amountIn: 1_000_000n });
  assert.equal(quote.source, "spot");
  assert.equal(quote.route.pool, POOL_1PCT);
  // Two 1% hops at 1:1: 1,000,000 -> 990,000 -> 980,100
  assert.equal(quote.expectedOut, 980_100n);
});

test("plan: a short allowance plans the paired-token approve to the router, and the swap carries no value", async () => {
  const { drift } = disposalDrift(rhDex, { allowance: 10n });
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);
  const route = { pool: POOL_30BP, poolKey: 3000, payingIsToken0: true, direct: false };
  const plan = await sdk.planPairedTokenDisposal({
    pairedToken: PAIRED,
    output: "eth",
    amountIn: 1_000_000n,
    amountOutMinimum: 5_000n,
    recipient: RECIPIENT,
    sender: SENDER,
    route,
    deadline: DEADLINE,
  });
  assert.deepEqual(plan.route, route);
  assert.equal(plan.approve.token.toLowerCase(), PAIRED.toLowerCase());
  assert.equal(plan.approve.spender.toLowerCase(), rhDex.swapRouter.toLowerCase());
  assert.equal(plan.approve.amount, 1_000_000n);
  assert.equal(plan.swap.to, rhDex.swapRouter);
  assert.equal(plan.swap.value, 0n);
  assert.equal(plan.swap.data, encodeDisposalEthSell(rhDex, leg(route, { amountOutMinimum: 5_000n })));
});

test("plan: enough allowance skips the approve; no route resolves the calculator's pool", async () => {
  const { drift } = disposalDrift(baseDex, { allowance: 10n ** 30n });
  const sdk = new ReadFlaunchSDK(base.id, drift);
  const plan = await sdk.planPairedTokenDisposal({
    pairedToken: PAIRED,
    output: "eth",
    amountIn: 1_000_000n,
    amountOutMinimum: 1n,
    recipient: RECIPIENT,
    sender: SENDER,
  });
  assert.equal(plan.approve, undefined);
  assert.equal(plan.route.pool, POOL_1PCT);
  assert.equal(plan.route.poolKey, 100);
});

test("plan refuses a zero minimum, a zero amount, and chains without a venue", async () => {
  const { drift } = disposalDrift(rhDex);
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);
  const params = { pairedToken: PAIRED, output: "eth", amountIn: 1n, amountOutMinimum: 1n, recipient: RECIPIENT };
  await assert.rejects(() => sdk.planPairedTokenDisposal({ ...params, amountOutMinimum: 0n }), /amountOutMinimum/);
  await assert.rejects(() => sdk.planPairedTokenDisposal({ ...params, amountIn: 0n }), /amountIn/);
  await assert.rejects(() => sdk.planPairedTokenDisposal({ ...params, output: "usdc" }), /Unsupported disposal output/);
  const sepolia = new ReadFlaunchSDK(baseSepolia.id, drift);
  await assert.rejects(() => sepolia.planPairedTokenDisposal(params), /not supported on chain 84532/);
  await assert.rejects(
    () => sepolia.quotePairedTokenDisposal({ pairedToken: PAIRED, output: "eth", amountIn: 1n }),
    /not supported on chain 84532/
  );
});
