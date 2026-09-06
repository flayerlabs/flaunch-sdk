const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeFunctionData, encodePacked, zeroAddress } = require("viem");
const { base, baseSepolia, mainnet, robinhood } = require("viem/chains");
const {
  PairedTokenAcquisitionDexAddress,
  ReadFlaunchSDK,
  ReadPairedTokenAcquisition,
  SlipstreamSwapRouterAbi,
  UniswapV3SwapRouter02Abi,
  clSpotAmountOut,
  doesChainSupportPairedTokenAcquisition,
  encodeAcquisitionEthBuy,
  encodeAcquisitionEthExactOutputPath,
  encodeAcquisitionHubBuy,
} = require("../dist/index.cjs.js");

const SENDER = "0x1111111111111111111111111111111111111111";
// Sorts ABOVE the hub and WETH on both chains, so the paying side is always token0 in a venue pool
const PAIRED = "0xf200000000000000000000c2e324d24d7eecd1fb";
const Q96 = 2n ** 96n;
const DEADLINE = 1_800_000_000n;

const baseDex = PairedTokenAcquisitionDexAddress[base.id];
const rhDex = PairedTokenAcquisitionDexAddress[robinhood.id];

const leg = (route, overrides = {}) => ({
  pairedToken: PAIRED,
  route,
  recipient: SENDER,
  deadline: DEADLINE,
  amountOut: 995_000n,
  amountInMaximum: 1_000_000n,
  ...overrides,
});

// ── Config ──────────────────────────────────────────────────────────────────

test("acquisition config covers the routed chains, with each chain's DEX flavour", () => {
  assert.equal(baseDex.flavor, "slipstream");
  assert.equal(rhDex.flavor, "uniswapV3");
  assert.equal(rhDex.hubSymbol, "USDG");
  assert.equal(doesChainSupportPairedTokenAcquisition(base.id), true);
  assert.equal(doesChainSupportPairedTokenAcquisition(robinhood.id), true);
  // mUSD on Base Sepolia has no venue (the test token mints permissionlessly)
  assert.equal(doesChainSupportPairedTokenAcquisition(baseSepolia.id), false);
  assert.equal(doesChainSupportPairedTokenAcquisition(mainnet.id), false);
});

test("Robinhood ships the canonical Uniswap QuoterV2 for depth-aware venue quotes", () => {
  // Byte-identical to the value reflaunch's b20Dex has been trading with (casing differs: the SDK
  // checksums its addresses, reflaunch stores lowercase)
  assert.equal(rhDex.venues.quoterV2.toLowerCase(), "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7");
});

// ── clSpotAmountOut ─────────────────────────────────────────────────────────

test("clSpotAmountOut is identity at a 1:1 price with no fee", () => {
  assert.equal(clSpotAmountOut(1_000_000n, Q96, 0n, true), 1_000_000n);
  assert.equal(clSpotAmountOut(1_000_000n, Q96, 0n, false), 1_000_000n);
});

test("clSpotAmountOut takes the fee off the input before pricing", () => {
  // 500 pips = 0.05%
  assert.equal(clSpotAmountOut(1_000_000n, Q96, 500n, true), 999_500n);
});

test("clSpotAmountOut applies the price ratio in the right direction", () => {
  // sqrtP = 2^97 → price token1/token0 = 4
  const sqrtP = Q96 * 2n;
  assert.equal(clSpotAmountOut(1_000_000n, sqrtP, 0n, true), 4_000_000n);
  assert.equal(clSpotAmountOut(1_000_000n, sqrtP, 0n, false), 250_000n);
});

// ── Path encoding ───────────────────────────────────────────────────────────

test("the exact-output path packs output-first with each hop key in the 3-byte fee slot", () => {
  const route = { pool: "0x4444444444444444444444444444444444444444", poolKey: 10, payingIsToken0: true };
  const path = encodeAcquisitionEthExactOutputPath(baseDex, PAIRED, route);
  assert.equal(
    path,
    encodePacked(
      ["address", "uint24", "address", "uint24", "address"],
      [PAIRED, 10, baseDex.hubToken, baseDex.wethHubPoolKey, baseDex.weth]
    )
  );
  // 3 addresses + 2 packed keys = 20*3 + 3*2 bytes
  assert.equal((path.length - 2) / 2, 66);
});

test("V3 fee tiers pack the same way on Robinhood", () => {
  const route = { pool: "0x4444444444444444444444444444444444444444", poolKey: 10_000, payingIsToken0: false };
  assert.equal(
    encodeAcquisitionEthExactOutputPath(rhDex, PAIRED, route),
    encodePacked(
      ["address", "uint24", "address", "uint24", "address"],
      [PAIRED, 10_000, rhDex.hubToken, 500, rhDex.weth]
    )
  );
});

test("a direct route's path skips the hub hop entirely", () => {
  const route = { pool: "0x4444444444444444444444444444444444444444", poolKey: 3000, payingIsToken0: true, direct: true };
  assert.equal(
    encodeAcquisitionEthExactOutputPath(rhDex, PAIRED, route),
    encodePacked(["address", "uint24", "address"], [PAIRED, 3000, rhDex.weth])
  );
});

// ── Router calldata per flavour ─────────────────────────────────────────────

test("Base: hub buy is a Slipstream exactOutputSingle carrying tickSpacing and deadline", () => {
  const data = encodeAcquisitionHubBuy(baseDex, leg({ pool: "0x44", poolKey: 10, payingIsToken0: true }));
  const decoded = decodeFunctionData({ abi: SlipstreamSwapRouterAbi, data });
  assert.equal(decoded.functionName, "exactOutputSingle");
  const p = decoded.args[0];
  assert.equal(p.tickSpacing, 10);
  assert.equal(p.deadline, DEADLINE);
  assert.equal(p.amountOut, 995_000n);
  assert.equal(p.tokenIn.toLowerCase(), baseDex.hubToken.toLowerCase());
  assert.equal(p.tokenOut.toLowerCase(), PAIRED.toLowerCase());
  // amountInMaximum is the sole price protection
  assert.equal(p.sqrtPriceLimitX96, 0n);
});

test("Robinhood: hub buy is a SwapRouter02 exactOutputSingle by fee, inside multicall(deadline)", () => {
  const data = encodeAcquisitionHubBuy(rhDex, leg({ pool: "0x44", poolKey: 10_000, payingIsToken0: false }));
  const outer = decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data });
  assert.equal(outer.functionName, "multicall");
  const [deadline, inner] = outer.args;
  assert.equal(deadline, DEADLINE);
  assert.equal(inner.length, 1);
  const single = decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data: inner[0] });
  assert.equal(single.functionName, "exactOutputSingle");
  const p = single.args[0];
  assert.equal(p.fee, 10_000);
  assert.equal(p.tokenIn.toLowerCase(), rhDex.hubToken.toLowerCase());
  assert.equal(p.tokenOut.toLowerCase(), PAIRED.toLowerCase());
  // No deadline field on SwapRouter02 params — it lives on the multicall
  assert.equal("deadline" in p, false);
});

test("Robinhood: ETH buy multicalls exactOutput (WETH → USDG → token) plus refundETH", () => {
  const route = { pool: "0x44", poolKey: 10_000, payingIsToken0: false };
  const data = encodeAcquisitionEthBuy(rhDex, leg(route));
  const outer = decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data });
  assert.equal(outer.functionName, "multicall");
  const [deadline, inner] = outer.args;
  assert.equal(deadline, DEADLINE);
  const exactOutput = decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data: inner[0] });
  assert.equal(exactOutput.functionName, "exactOutput");
  assert.equal(exactOutput.args[0].path, encodeAcquisitionEthExactOutputPath(rhDex, PAIRED, route));
  assert.equal(exactOutput.args[0].amountOut, 995_000n);
  assert.equal(exactOutput.args[0].amountInMaximum, 1_000_000n);
  assert.equal(decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data: inner[1] }).functionName, "refundETH");
});

test("Base: ETH buy is the deadline-in-params flavour — multicall(bytes[]) with refundETH", () => {
  const route = { pool: "0x44", poolKey: 10, payingIsToken0: true };
  const data = encodeAcquisitionEthBuy(baseDex, leg(route));
  const outer = decodeFunctionData({ abi: SlipstreamSwapRouterAbi, data });
  assert.equal(outer.functionName, "multicall");
  // Single argument: the calls. The deadline rides inside exactOutput's params on Slipstream.
  assert.equal(outer.args.length, 1);
  const exactOutput = decodeFunctionData({ abi: SlipstreamSwapRouterAbi, data: outer.args[0][0] });
  assert.equal(exactOutput.functionName, "exactOutput");
  assert.equal(exactOutput.args[0].deadline, DEADLINE);
  assert.equal(decodeFunctionData({ abi: SlipstreamSwapRouterAbi, data: outer.args[0][1] }).functionName, "refundETH");
});

// ── Venue discovery and the route/quote agreement regression ────────────────

const CALC = "0x5555555555555555555555555555555555555555";
const POOL_1PCT = "0xaaaa000000000000000000000000000000000001"; // the calculator's pool
const POOL_30BP = "0xaaaa000000000000000000000000000000000002"; // a deeper venue the quoter finds
const POOL_DIRECT = "0xbbbb000000000000000000000000000000000003"; // WETH:token, ETH input only

/**
 * A drift double for the acquisition reads on Robinhood: registry → calculator → hub pool for the
 * fallback route, factory + QuoterV2 for venue discovery, and pool price reads for spot. Answers
 * are keyed by contract address + fn, the way the chain would key them; every interaction is
 * recorded so tests can assert which contracts were NEVER consulted.
 */
function acquisitionDrift({ quotes = {}, quoterFails = false, allowance = 10_000_000n } = {}) {
  const interactions = [];
  const hub = rhDex.hubToken.toLowerCase();
  const weth = rhDex.weth.toLowerCase();
  const drift = {
    async getSignerAddress() {
      return SENDER;
    },
    contract({ abi, address }) {
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
              decimals: 8,
              underlying: zeroAddress,
              feeEscrow: zeroAddress,
              priceCalculator: CALC,
              minDistribute: 0n,
              bidWallThreshold: 0n,
            };
          }
          if (fn === "hubPairedPool") return POOL_1PCT;
          if (fn === "hubToken") return rhDex.hubToken;
          if (fn === "fee") return 10_000;
          if (fn === "token0") {
            // The hub sorts below the paired token in every pool here
            return address.toLowerCase() === rhDex.wethHubPool.toLowerCase() ? rhDex.weth : rhDex.hubToken;
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
        async write(fn, args, options) {
          interactions.push({ kind: "write", address, fn, args, options, abi });
          return `0x${"01".repeat(32)}`;
        },
      };
    },
  };
  return { drift, interactions };
}

test("the budget plan executes on the venue that priced it, not the calculator's pool", async () => {
  // The 1% tier is the calculator's pool, but the 0.3% tier quotes deeper: fee 3000 = 0x000bb8
  const { drift, interactions } = acquisitionDrift({
    quotes: { "000bb8": 950_000n, "002710": 900_000n },
  });
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);

  const plan = await sdk.planPairedTokenAcquisitionForBudget({
    pairedToken: PAIRED,
    input: "hub",
    amountIn: 1_000_000n,
    slippageBps: 100,
    recipient: SENDER,
    deadline: DEADLINE,
    sender: SENDER,
  });

  // Quote and execution name the same venue — the divergence this test exists to prevent
  assert.deepEqual(plan.route, plan.quote.route);
  assert.equal(plan.route.pool, POOL_30BP);
  assert.equal(plan.route.poolKey, 3000);
  assert.equal(plan.quote.source, "quoter");
  // 1% haircut off the quoted 950,000
  assert.equal(plan.target, 940_500n);

  // The encoded leg trades the QUOTED fee tier, not the calculator's 1% pool
  const outer = decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data: plan.swap.data });
  const single = decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data: outer.args[1][0] });
  assert.equal(single.args[0].fee, 3000);
  assert.equal(single.args[0].amountOut, 940_500n);

  // The calculator route was never resolved — no registry or calculator reads at all
  const fns = interactions.filter((i) => i.kind === "read").map((i) => i.fn);
  assert.equal(fns.includes("tokenConfig"), false);
  assert.equal(fns.includes("hubPairedPool"), false);
});

test("an ETH budget can land on a direct WETH:token venue, and the leg's path matches it", async () => {
  // Hub paths carry the USDG address; the direct path does not — quote the direct pool better
  const { drift } = acquisitionDrift({
    quotes: { [rhDex.hubToken.slice(2)]: 900_000n, [rhDex.weth.slice(2)]: 990_000n },
  });
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);

  const plan = await sdk.planPairedTokenAcquisitionForBudget({
    pairedToken: PAIRED,
    input: "eth",
    amountIn: 1_000_000n,
    slippageBps: 100,
    recipient: SENDER,
    deadline: DEADLINE,
    sender: SENDER,
  });

  assert.equal(plan.route.direct, true);
  assert.equal(plan.route.pool, POOL_DIRECT);
  assert.deepEqual(plan.route, plan.quote.route);
  // ETH rides as value, and the exact-output path is the short WETH:token one
  assert.equal(plan.swap.value, 1_000_000n);
  const outer = decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data: plan.swap.data });
  const exactOutput = decodeFunctionData({ abi: UniswapV3SwapRouter02Abi, data: outer.args[1][0] });
  assert.equal(
    exactOutput.args[0].path,
    encodePacked(["address", "uint24", "address"], [PAIRED, 3000, rhDex.weth])
  );
});

test("a plan with no explicit route still resolves the calculator's pool", async () => {
  const { drift, interactions } = acquisitionDrift({ allowance: 0n });
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);

  const plan = await sdk.planPairedTokenAcquisition({
    pairedToken: PAIRED,
    input: "hub",
    target: 500_000n,
    maxIn: 1_000_000n,
    recipient: SENDER,
    deadline: DEADLINE,
    sender: SENDER,
  });

  assert.equal(plan.route.pool, POOL_1PCT);
  assert.equal(plan.route.poolKey, 10_000);
  const fns = interactions.filter((i) => i.kind === "read").map((i) => i.fn);
  assert.equal(fns.includes("tokenConfig"), true);
  // Short allowance plans the hub-token approve to the venue router
  assert.equal(plan.approve.token.toLowerCase(), rhDex.hubToken.toLowerCase());
  assert.equal(plan.approve.spender.toLowerCase(), rhDex.swapRouter.toLowerCase());
  assert.equal(plan.approve.amount, 1_000_000n);
});

test("the quoter falling over degrades to the calculator pool at spot", async () => {
  const { drift } = acquisitionDrift({ quoterFails: true });
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);

  const quote = await sdk.quotePairedTokenAcquisition({ pairedToken: PAIRED, input: "hub", amountIn: 1_000_000n });
  assert.equal(quote.source, "spot");
  assert.equal(quote.route.pool, POOL_1PCT);
  // 1:1 pool with a 1% fee: 1,000,000 → 990,000
  assert.equal(quote.expectedOut, 990_000n);
});

test("quoteSpot refuses a direct route rather than mis-price it through the hub", async () => {
  const { drift } = acquisitionDrift({});
  const acquisition = new ReadPairedTokenAcquisition(robinhood.id, drift);
  await assert.rejects(
    () =>
      acquisition.quoteSpot(
        PAIRED,
        { pool: POOL_DIRECT, poolKey: 3000, payingIsToken0: true, direct: true },
        "eth",
        1_000_000n
      ),
    /hub routes only/
  );
});
