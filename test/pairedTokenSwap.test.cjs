const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeFunctionData, encodeAbiParameters, zeroAddress } = require("viem");
const { base, baseSepolia, mainnet, robinhood } = require("viem/chains");
const {
  MAX_SQRT_PRICE_LIMIT,
  MIN_SQRT_PRICE_LIMIT,
  PairedTokenPositionManagerV1_3Address,
  PoolSwapV1_3Abi,
  PoolSwapV1_3Address,
  ReadFlaunchSDK,
  ReadWriteFlaunchSDK,
  ReadPoolSwapV1_3,
  ReadWritePoolSwapV1_3,
  ReadPairedTokenPositionManagerV1_3,
  decodeBalanceDelta,
  doesChainSupportPairedTokenSwap,
  getPoolId,
  isZeroForOne,
  pairedPoolKey,
  sqrtPriceLimitFromSlippage,
  PAIRED_TOKEN_TYPE,
  poolSwapForHook,
} = require("../dist/index.cjs.js");

const SENDER = "0x1111111111111111111111111111111111111111";
// mUSD on Base Sepolia: 6 decimals, registry type erc20. Sorts BELOW the coin, so it is currency0.
const MUSD = "0xd0B4398976572515a269C6331A143e08a70E9ccC";
const COIN = "0xF000000000000000000000000000000000000001";
const SPENDER_TX = `0x${"01".repeat(32)}`;
const HOOK_DATA = encodeAbiParameters(
  [{ type: "address" }, { type: "uint256" }],
  [SENDER, 42n]
);
// A spot price of 1:1 (sqrt(1) << 96)
const SQRT_PRICE_1 = 2n ** 96n;

const hooks = PairedTokenPositionManagerV1_3Address[baseSepolia.id];
const musdPoolKey = pairedPoolKey(COIN, MUSD, hooks);
const ethPoolKey = pairedPoolKey(COIN, zeroAddress, hooks);

/**
 * A drift double that answers the reads a plan needs and records every write. `poolKey` answers
 * for the coin only; anything else reads back as the zeroed key the contract returns for an
 * unknown coin.
 */
function recordingDrift({
  allowance = 0n,
  poolKey = musdPoolKey,
  signer = SENDER,
  // When set, only this hook answers `poolKey` — every other manager reads back the zeroed key,
  // the way a hook that never launched the coin does on chain.
  answeringHook = null,
} = {}) {
  const interactions = [];
  const drift = {
    async getSignerAddress() {
      return signer;
    },
    contract({ abi, address }) {
      return {
        address,
        cache: { clear: async () => {} },
        async read(fn, args) {
          interactions.push({ kind: "read", address, fn, args });
          if (fn === "poolKey") {
            const answers =
              answeringHook === null ||
              address.toLowerCase() === answeringHook.toLowerCase();
            return answers && args._token.toLowerCase() === COIN.toLowerCase()
              ? poolKey
              : { ...poolKey, hooks: zeroAddress };
          }
          if (fn === "getSlot0") {
            return { sqrtPriceX96: SQRT_PRICE_1, tick: 0, protocolFee: 0, lpFee: 0 };
          }
          if (fn === "allowance") return allowance;
          if (fn === "msgSender") return zeroAddress;
          if (fn === "tokenConfig") {
            return {
              approved: true,
              tokenType: 4,
              decimals: 6,
              underlying: zeroAddress,
              feeEscrow: zeroAddress,
              priceCalculator: zeroAddress,
              minDistribute: 0n,
              bidWallThreshold: 0n,
            };
          }
          throw new Error(`Unexpected read: ${fn}`);
        },
        async simulateWrite(fn, args, options) {
          interactions.push({ kind: "simulate", address, fn, args, options });
          if (fn === "quoteExactInputSingle") return { amountOut: 999n, gasEstimate: 1n };
          throw new Error(`Unexpected simulate: ${fn}`);
        },
        async write(fn, args, options) {
          interactions.push({ kind: "write", address, fn, args, options, abi });
          return SPENDER_TX;
        },
      };
    },
  };
  return { drift, interactions };
}

test("paired-token swap addresses and capability cover the deployed V1.3 chains", () => {
  for (const chainId of [base.id, baseSepolia.id, robinhood.id]) {
    assert.ok(PoolSwapV1_3Address[chainId], `PoolSwap on ${chainId}`);
    assert.equal(doesChainSupportPairedTokenSwap(chainId), true);
  }
  assert.equal(doesChainSupportPairedTokenSwap(mainnet.id), false);
  // The CURRENT router per chain — Base Sepolia's hooks were regenerated as v1.3.3 on 2026-09-03
  assert.equal(
    PoolSwapV1_3Address[baseSepolia.id].toLowerCase(),
    "0xf0f388a31a1745a5e2378b812ed51525f70595be"
  );
  // …and the superseded `.vpt2` hook still routes to the router ITS gate approved
  assert.equal(
    poolSwapForHook(baseSepolia.id, "0x5558e7271ec2e8b2faaf05f0eedab1cd986be5dc").toLowerCase(),
    "0x62eb5b7b066ff80ce5e32ff1ed42b31c485f716b"
  );
});

test("pairedPoolKey sorts currencies and keys the paired PositionManager", () => {
  assert.equal(musdPoolKey.currency0.toLowerCase(), MUSD.toLowerCase());
  assert.equal(musdPoolKey.currency1, COIN);
  assert.equal(musdPoolKey.fee, 0);
  assert.equal(musdPoolKey.tickSpacing, 60);
  assert.equal(musdPoolKey.hooks, hooks);
  // native ETH is a real pairing and always lands in currency0
  assert.equal(ethPoolKey.currency0, zeroAddress);
  assert.equal(isZeroForOne(musdPoolKey, MUSD), true);
  assert.equal(isZeroForOne(musdPoolKey, COIN), false);
  assert.match(getPoolId(musdPoolKey), /^0x[0-9a-f]{64}$/);
});

test("sqrtPriceLimitFromSlippage bounds price in the swap's direction", () => {
  const down = sqrtPriceLimitFromSlippage(SQRT_PRICE_1, 50, true);
  const up = sqrtPriceLimitFromSlippage(SQRT_PRICE_1, 50, false);
  assert.ok(down < SQRT_PRICE_1 && down > MIN_SQRT_PRICE_LIMIT);
  assert.ok(up > SQRT_PRICE_1 && up < MAX_SQRT_PRICE_LIMIT);
  // 0.5% of price ≈ 0.25% of sqrt price
  const downBps = ((SQRT_PRICE_1 - down) * 10_000n) / SQRT_PRICE_1;
  assert.ok(downBps >= 24n && downBps <= 26n, `down ${downBps}bps`);
  assert.throws(() => sqrtPriceLimitFromSlippage(SQRT_PRICE_1, 0, true));
  assert.throws(() => sqrtPriceLimitFromSlippage(SQRT_PRICE_1, 10_000, true));
  // a price so low the bound cannot move off spot
  assert.throws(
    () => sqrtPriceLimitFromSlippage(MIN_SQRT_PRICE_LIMIT, 1, true),
    /too low/
  );
});

test("decodeBalanceDelta splits the packed int128 pair", () => {
  const delta = (BigInt.asUintN(128, -5n) << 128n) | 7n;
  assert.deepEqual(decodeBalanceDelta(BigInt.asIntN(256, delta)), {
    amount0: -5n,
    amount1: 7n,
  });
});

test("a gated mUSD buy plans approve + PoolSwap.swap(bytes hookData) with negative exact input", async () => {
  const { drift, interactions } = recordingDrift({ allowance: 0n });
  const sdk = new ReadFlaunchSDK(baseSepolia.id, drift);

  const plan = await sdk.planPairedTokenSwap(
    {
      coinAddress: COIN,
      amountIn: 5_000_000n, // 5 mUSD
      slippageBps: 500,
      hookData: HOOK_DATA,
      sender: SENDER,
    },
    "buy"
  );

  assert.equal(plan.pairedToken.toLowerCase(), MUSD.toLowerCase());
  assert.equal(plan.tokenIn.toLowerCase(), MUSD.toLowerCase());
  assert.equal(plan.isNativeInput, false);
  assert.equal(plan.zeroForOne, true);
  assert.equal(plan.poolId, getPoolId(musdPoolKey));

  // approve step: exactly the signed amount, to PoolSwap
  assert.ok(plan.approve);
  assert.equal(plan.approve.to.toLowerCase(), MUSD.toLowerCase());
  assert.equal(
    plan.approve.spender.toLowerCase(),
    PoolSwapV1_3Address[baseSepolia.id].toLowerCase()
  );
  const approve = decodeFunctionData({
    abi: [
      {
        type: "function",
        name: "approve",
        inputs: [{ type: "address" }, { type: "uint256" }],
        outputs: [{ type: "bool" }],
        stateMutability: "nonpayable",
      },
    ],
    data: plan.approve.data,
  });
  assert.equal(approve.args[1], 5_000_000n);

  // swap step: the bytes overload, carrying the gate's hookData verbatim
  assert.equal(plan.swap.to.toLowerCase(), PoolSwapV1_3Address[baseSepolia.id].toLowerCase());
  assert.equal(plan.swap.value, 0n);
  const swap = decodeFunctionData({ abi: PoolSwapV1_3Abi, data: plan.swap.data });
  assert.equal(swap.functionName, "swap");
  assert.equal(swap.args.length, 3);
  assert.equal(swap.args[2], HOOK_DATA);
  assert.equal(swap.args[0].currency0.toLowerCase(), MUSD.toLowerCase());
  assert.equal(swap.args[1].zeroForOne, true);
  assert.equal(swap.args[1].amountSpecified, -5_000_000n);
  assert.equal(swap.args[1].sqrtPriceLimitX96, plan.sqrtPriceLimitX96);
  assert.ok(plan.sqrtPriceLimitX96 < SQRT_PRICE_1);

  // the allowance was checked for the sender against PoolSwap
  const allowanceRead = interactions.find((i) => i.fn === "allowance");
  assert.deepEqual(allowanceRead.args, {
    owner: SENDER,
    spender: PoolSwapV1_3Address[baseSepolia.id],
  });
});

test("a sufficient allowance drops the approve step; referrer-only uses the address overload", async () => {
  const { drift } = recordingDrift({ allowance: 10_000_000n });
  const sdk = new ReadFlaunchSDK(baseSepolia.id, drift);
  const referrer = "0x2222222222222222222222222222222222222222";

  const plan = await sdk.planPairedTokenSwap(
    { coinAddress: COIN, pairedToken: MUSD, amountIn: 5_000_000n, slippageBps: 50, referrer, sender: SENDER },
    "buy"
  );

  assert.equal(plan.approve, undefined);
  const swap = decodeFunctionData({ abi: PoolSwapV1_3Abi, data: plan.swap.data });
  assert.equal(swap.args[2], referrer);
});

test("a native-ETH pairing funds the buy with msg.value and needs no approve", async () => {
  const { drift, interactions } = recordingDrift({ poolKey: ethPoolKey });
  const sdk = new ReadFlaunchSDK(baseSepolia.id, drift);

  const plan = await sdk.planPairedTokenSwap(
    { coinAddress: COIN, amountIn: 10n ** 16n, slippageBps: 100, sender: SENDER },
    "buy"
  );

  assert.equal(plan.pairedToken, zeroAddress);
  assert.equal(plan.isNativeInput, true);
  assert.equal(plan.approve, undefined);
  assert.equal(plan.swap.value, 10n ** 16n);
  assert.equal(interactions.some((i) => i.fn === "allowance"), false);
});

test("a sell spends the coin, flips direction and approves the coin to PoolSwap", async () => {
  const { drift } = recordingDrift({ allowance: 0n });
  const sdk = new ReadFlaunchSDK(baseSepolia.id, drift);

  const plan = await sdk.planPairedTokenSwap(
    { coinAddress: COIN, pairedToken: MUSD, amountIn: 1_000n, slippageBps: 100, sender: SENDER },
    "sell"
  );

  assert.equal(plan.tokenIn, COIN);
  assert.equal(plan.tokenOut.toLowerCase(), MUSD.toLowerCase());
  assert.equal(plan.zeroForOne, false);
  assert.equal(plan.approve.token, COIN);
  assert.equal(plan.swap.value, 0n);
  assert.ok(plan.sqrtPriceLimitX96 > SQRT_PRICE_1);
});

test("resolvePairedPool reads the manager's key and refuses an unknown coin", async () => {
  const { drift } = recordingDrift();
  const sdk = new ReadFlaunchSDK(baseSepolia.id, drift);

  const pool = await sdk.resolvePairedPool(COIN);
  assert.deepEqual(pool.poolKey, musdPoolKey);
  assert.equal(pool.pairedToken.toLowerCase(), MUSD.toLowerCase());

  await assert.rejects(
    () => sdk.resolvePairedPool("0xF000000000000000000000000000000000000002"),
    /not launched on a paired-token PositionManager/
  );
});

test("a coin on a superseded Robinhood hook resolves to that hook and still swaps through PoolSwap", async () => {
  // Robinhood regenerated its v1.3.1 hooks as v1.3.3; pools launched on the old hook keep trading
  // there. The pool key must name the hook the coin was launched on, never the chain's current one.
  const superseded = "0x588c683ecc450f8b2aadb13d7f63792b840425dc";
  const supersededKey = pairedPoolKey(COIN, MUSD, superseded);
  const { drift, interactions } = recordingDrift({
    poolKey: supersededKey,
    answeringHook: superseded,
    allowance: 10_000_000n,
  });
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);

  const pool = await sdk.resolvePairedPool(COIN);
  assert.equal(pool.poolKey.hooks.toLowerCase(), superseded);
  assert.notEqual(
    pool.poolKey.hooks.toLowerCase(),
    PairedTokenPositionManagerV1_3Address[robinhood.id].toLowerCase()
  );
  // The current hook was asked first and said no; the superseded one answered
  const probes = interactions.filter((i) => i.kind === "read" && i.fn === "poolKey").map((i) => i.address.toLowerCase());
  assert.equal(probes[0], PairedTokenPositionManagerV1_3Address[robinhood.id].toLowerCase());
  assert.ok(probes.includes(superseded));

  const plan = await sdk.planPairedTokenSwap(
    { coinAddress: COIN, amountIn: 1_000_000n, slippageBps: 100, sender: SENDER },
    "buy"
  );
  assert.deepEqual(plan.poolKey, supersededKey);
  // Routed to the PoolSwap the SUPERSEDED generation's spend gate approves, not the current one:
  // router approval is per gate, and a gated buy through an unapproved router reverts.
  assert.equal(
    plan.swap.to.toLowerCase(),
    "0x8476ed156f731335eca8cc8a8ee759330ee4a91f"
  );
  assert.notEqual(
    plan.swap.to.toLowerCase(),
    PoolSwapV1_3Address[robinhood.id].toLowerCase()
  );
  // The fixture's allowance already covers this buy, so there is no approve step to check the
  // spender on — the routing assertion above is the point.
  assert.equal(plan.approve, undefined);

  // Memoised: a second resolve reads nothing
  const before = interactions.length;
  await sdk.resolvePairedPool(COIN);
  assert.equal(interactions.filter((i) => i.fn === "poolKey").length, probes.length);
  assert.ok(interactions.length >= before);
});

test("getPairedPoolQuoteExactInput quotes the single hop with hookData as the buyer", async () => {
  const { drift, interactions } = recordingDrift();
  const sdk = new ReadFlaunchSDK(baseSepolia.id, drift);

  const out = await sdk.getPairedPoolQuoteExactInput({
    coinAddress: COIN,
    pairedToken: MUSD,
    amountIn: 5_000_000n,
    hookData: HOOK_DATA,
    userWallet: SENDER,
  });

  assert.equal(out, 999n);
  const quote = interactions.find((i) => i.fn === "quoteExactInputSingle");
  assert.deepEqual(quote.args.params, {
    poolKey: musdPoolKey,
    zeroForOne: true,
    exactAmount: 5_000_000n,
    hookData: HOOK_DATA,
  });
  assert.deepEqual(quote.options, { from: SENDER });
});

test("buyCoinPairedToken sends approve then swap through the write clients", async () => {
  const { drift, interactions } = recordingDrift({ allowance: 0n });
  const sdk = new ReadWriteFlaunchSDK(baseSepolia.id, drift);

  const hash = await sdk.buyCoinPairedToken({
    coinAddress: COIN,
    amountIn: 5_000_000n,
    slippageBps: 500,
    hookData: HOOK_DATA,
  });

  assert.equal(hash, SPENDER_TX);
  const writes = interactions.filter((i) => i.kind === "write");
  assert.equal(writes.length, 2);
  assert.equal(writes[0].fn, "approve");
  assert.equal(writes[0].address.toLowerCase(), MUSD.toLowerCase());
  assert.equal(writes[1].fn, "swap");
  assert.equal(writes[1].address.toLowerCase(), PoolSwapV1_3Address[baseSepolia.id].toLowerCase());
  assert.equal(writes[1].args._hookData, HOOK_DATA);
  assert.equal(writes[1].args._params.amountSpecified, -5_000_000n);
  assert.deepEqual(writes[1].options, { value: 0n });
  // the hookData overload is the only function on the ABI drift was handed
  assert.equal(writes[1].abi.length, 1);
  assert.equal(writes[1].abi[0].inputs[2].type, "bytes");
});

test("paired-token swaps refuse chains without the deployment", async () => {
  const { drift } = recordingDrift();
  const sdk = new ReadFlaunchSDK(mainnet.id, drift);
  await assert.rejects(
    () => sdk.planPairedTokenSwap({ coinAddress: COIN, amountIn: 1n, slippageBps: 50 }, "buy"),
    /not supported on chain 1/
  );
  assert.throws(() => sdk.readPoolSwapV1_3, /not supported/);
});

test("registry tokenConfig exposes decimals and type; clients construct", async () => {
  const { drift } = recordingDrift();
  const sdk = new ReadFlaunchSDK(baseSepolia.id, drift);
  const config = await sdk.readPairedTokenRegistryV1_3.tokenConfig(MUSD);
  assert.equal(config.decimals, 6);
  assert.equal(config.tokenType, PAIRED_TOKEN_TYPE.erc20);
  assert.ok(new ReadPoolSwapV1_3(PoolSwapV1_3Address[base.id], drift));
  assert.ok(new ReadWritePoolSwapV1_3(PoolSwapV1_3Address[base.id], drift));
  assert.ok(new ReadPairedTokenPositionManagerV1_3(hooks, drift));
});
