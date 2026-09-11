// Launch pre-buy planner and executor against a recording drift: pinned quotes, payment asset,
// approvals, funding, binding/revalidation, and the exact write that reaches the zap.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPublicClient,
  custom,
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionResult,
  multicall3Abi,
  toHex,
  zeroAddress,
} = require("viem");
const { base, robinhood, baseSepolia } = require("viem/chains");
const {
  ReadFlaunchSDK,
  ReadWriteFlaunchSDK,
  FlaunchZapAbi,
  FlaunchZapV1_1_6Abi,
  FlaunchZapV1_3Abi,
  FlaunchPositionManagerV1_3Abi,
  FlaunchZapAddress,
  FlaunchZapMultichainAddress,
  FlaunchZapV1_3Address,
  PairedTokenRegistryV1_3Address,
  PairedTokenPositionManagerV1_3Address,
  DynamicAddressFeeSplitManagerAddress,
  createFlaunchCalldata,
  decodeCallData,
  preBuyAmountFromBps,
  computeLaunchPreBuyBinding,
  LaunchPreBuyRequoteRequiredError,
  LaunchPreBuyInsufficientBalanceError,
  LaunchPreBuyUnsupportedError,
} = require("../dist/index.cjs.js");

const SENDER = "0x1111111111111111111111111111111111111111";
const OTHER = "0x9999999999999999999999999999999999999999";
const PAIRED = "0x2222222222222222222222222222222222222222";
const MEMECOIN = "0x3333333333333333333333333333333333333333";
const TREASURY = "0x4444444444444444444444444444444444444444";
const TX_HASH = `0x${"01".repeat(32)}`;
const POOL_ID = `0x${"ab".repeat(32)}`;
const FEE = 100n;
const BLOCK = 123n;

const standardParams = {
  name: "Coin",
  symbol: "COIN",
  tokenUri: "ipfs://coin",
  fairLaunchPercent: 0,
  fairLaunchDuration: 0,
  initialMarketCapUSD: 4000,
  creator: SENDER,
  creatorFeeAllocationPercent: 100,
};
const pairedParams = {
  name: "Coin",
  symbol: "COIN",
  tokenUri: "ipfs://coin",
  premineAmount: 0n,
  creator: SENDER,
  creatorFeeAllocation: 10_000,
  flaunchAt: 0n,
  initialPriceParams: "0x1234",
  feeCalculatorParams: "0x",
  pairedToken: PAIRED,
};

/** Linear cost model (the zap's `calculateFee`): 1e27 coins (1%) quote at 1000 units; slippage adds bps. */
function premineCost(premine, slippage) {
  if (premine === 0n) return 0n;
  const base = premine / 10n ** 24n;
  return (base * (10_000n + slippage)) / 10_000n;
}
/** What the launch really consumes for the premine: the linear quote plus 2% price impact. */
const IMPACT_BPS = 200n;
const withImpact = (linear) => (linear * (10_000n + IMPACT_BPS)) / 10_000n;
const ceilSlippage = (amount, bps) => (amount * (10_000n + bps) + 9_999n) / 10_000n;
const ZAP_ABIS = [FlaunchZapAbi, FlaunchZapV1_3Abi, FlaunchZapV1_1_6Abi];
const premineFromCalldata = (data) => {
  for (const abi of ZAP_ABIS) {
    try {
      return decodeFunctionData({ abi, data }).args[0].premineAmount;
    } catch {}
  }
  throw new Error("not a flaunch call");
};

/**
 * A publicClient whose `call` behaves like the launch-cost probe under state override: it
 * reports fee + real premine cost as spent, or reverts when asked to.
 */
function fakePublicClient(drift, { probeReverts = false } = {}) {
  return {
    calls: [],
    async call({ to, data, value, stateOverride, blockNumber, account }) {
      const [target, cap, launchData] = decodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "bytes" }],
        data
      );
      this.calls.push({ to, account, value, cap, target, launchData, stateOverride, blockNumber });
      if (probeReverts) throw new Error("InsufficientPreminePayment");
      const spent = drift.state.fee + withImpact(drift.state.feeModel(premineFromCalldata(launchData), 0n));
      if (spent > cap) throw new Error("InsufficientPreminePayment");
      return { data: encodeAbiParameters([{ type: "uint256" }, { type: "bytes" }], [spent, "0x"]) };
    },
  };
}

function fakeDrift({
  signer = SENDER,
  block = BLOCK,
  nativeBalance = 10n ** 18n,
  erc20Balance = 10n ** 12n,
  allowance = 0n,
  tokenConfig = { approved: true, tokenType: 4, decimals: 6 },
  feeModel = premineCost,
  fee = FEE,
  simulate,
  waitStatus = "success",
} = {}) {
  const interactions = [];
  const state = { feeModel, fee, block, nativeBalance, erc20Balance, allowance };
  const drift = {
    interactions,
    state,
    contract({ address }) {
      return {
        address,
        cache: {
          async clear() {
            interactions.push({ kind: "cacheClear", address });
          },
        },
        async read(fn, args, options) {
          interactions.push({ kind: "read", address, fn, args, options });
          if (fn === "calculateFee") {
            if (args._premineAmount !== undefined) {
              return state.fee + state.feeModel(args._premineAmount, args._slippage);
            }
            const struct = args._flaunchParams;
            const cost = state.feeModel(struct.premineAmount, args._slippage);
            if (struct.pairedToken === undefined) return state.fee + cost;
            const native =
              struct.pairedToken === zeroAddress ||
              tokenConfig.tokenType === 1 ||
              tokenConfig.tokenType === 3;
            return native
              ? { ethRequired_: state.fee + cost, pairedPremineCost_: cost }
              : { ethRequired_: state.fee, pairedPremineCost_: cost };
          }
          if (fn === "tokenConfig") {
            return {
              approved: tokenConfig.approved,
              tokenType: tokenConfig.tokenType,
              decimals: tokenConfig.decimals,
              underlying: zeroAddress,
              feeEscrow: zeroAddress,
              priceCalculator: zeroAddress,
              minDistribute: 0n,
              bidWallThreshold: 0n,
            };
          }
          if (fn === "isApproved") return tokenConfig.approved;
          if (fn === "allowance") return state.allowance;
          if (fn === "balanceOf") return state.erc20Balance;
          throw new Error(`Unexpected read: ${fn}`);
        },
        async simulateWrite(fn, args, options) {
          interactions.push({ kind: "simulate", address, fn, args, options });
          if (simulate instanceof Error) throw simulate;
          return {
            memecoin_: MEMECOIN,
            ethSpent_: simulate?.ethSpent ?? 1n,
            deployedManager_: zeroAddress,
          };
        },
        async write(fn, args, options) {
          interactions.push({ kind: "write", address, fn, args, options });
          if (fn === "approve") state.allowance = args.amount;
          return TX_HASH;
        },
      };
    },
    async getBlockNumber() {
      interactions.push({ kind: "getBlockNumber" });
      return state.block;
    },
    async getBalance(params) {
      interactions.push({ kind: "getBalance", ...params });
      return state.nativeBalance;
    },
    async getSignerAddress() {
      return signer;
    },
    async waitForTransaction({ hash }) {
      interactions.push({ kind: "wait", hash });
      return { status: waitStatus };
    },
  };
  return drift;
}

const reads = (drift, fn) => drift.interactions.filter((i) => i.kind === "read" && i.fn === fn);
const writes = (drift) => drift.interactions.filter((i) => i.kind === "write");
const lower = (a) => a.toLowerCase();

test("ETH route (Robinhood standard): three pinned fee reads, probe-priced expected/max, bound calldata", async () => {
  const drift = fakeDrift();
  const publicClient = fakePublicClient(drift);
  const sdk = new ReadFlaunchSDK(robinhood.id, drift, publicClient);
  const result = await sdk.planLaunchPreBuy({
    route: "standard",
    params: standardParams,
    preBuyBps: 100,
    slippageBps: 50,
  });
  assert.equal(result.supported, true, JSON.stringify(result.reasons));
  const { plan } = result;
  const premine = preBuyAmountFromBps(100);
  assert.equal(plan.premineAmount, premine);
  assert.equal(plan.zapFamily, "multichain");
  assert.equal(lower(plan.launch.to), lower(FlaunchZapMultichainAddress[robinhood.id]));

  const feeReads = reads(drift, "calculateFee");
  assert.equal(feeReads.length, 3);
  for (const read of feeReads) {
    assert.equal(lower(read.address), lower(FlaunchZapMultichainAddress[robinhood.id]));
    assert.deepEqual(read.options, { block: BLOCK });
  }
  assert.deepEqual(
    feeReads.map(({ args }) => [args._flaunchParams.premineAmount, args._slippage]),
    [[0n, 0n], [premine, 0n], [premine, 50n]]
  );
  assert.equal(plan.fee.amount, FEE);
  assert.deepEqual(plan.fee.asset, { chainId: robinhood.id, address: zeroAddress, decimals: 18 });
  // the zap's linear quote is reported for comparison; the plan itself is probe-priced
  assert.deepEqual(plan.pricing, { method: "simulation", protocolQuote: { expected: 1000n, max: 1005n } });
  assert.equal(plan.payment.expected, 1020n, "real fill cost from the probe");
  assert.equal(plan.payment.max, ceilSlippage(1020n, 50n));
  assert.equal(plan.payment.max, 1026n);
  assert.equal(plan.value, FEE + 1026n);
  assert.equal(plan.launch.value, plan.value);
  assert.equal(plan.maxPremineCost, undefined);
  assert.deepEqual(plan.approvals, []);
  assert.equal(plan.quoteBlockNumber, BLOCK);
  assert.equal(plan.expiresAtMs - plan.createdAtMs, 30_000);
  assert.deepEqual(plan.funding, {
    native: { required: plan.value, available: 10n ** 18n },
    sufficient: true,
  });
  // balances are read at latest (viem caches eth_blockNumber; a pinned read could miss a top-up)
  const balanceRead = drift.interactions.find((i) => i.kind === "getBalance");
  assert.deepEqual(balanceRead, { kind: "getBalance", address: SENDER });

  // the probe ran as the sender, at the quote block, with an ample cap and the plan's calldata
  assert.equal(publicClient.calls.length, 1);
  const [probe] = publicClient.calls;
  assert.equal(probe.to, SENDER);
  assert.equal(probe.account, SENDER);
  assert.equal(probe.blockNumber, BLOCK);
  assert.equal(lower(probe.target), lower(plan.launch.to));
  assert.ok(probe.cap >= FEE + 3n * 1000n);
  assert.equal(probe.stateOverride[0].address, SENDER);
  assert.equal(probe.stateOverride[0].balance, probe.cap);
  assert.match(probe.stateOverride[0].code, /^0x6080/);

  const decoded = decodeFunctionData({ abi: FlaunchZapAbi, data: plan.launch.data });
  assert.equal(decoded.functionName, "flaunch");
  assert.equal(decoded.args.length, 2);
  assert.equal(decoded.args[0].premineAmount, premine);
  assert.equal(decoded.args[0].creator, SENDER);
  assert.equal(decoded.args[0].feeCalculatorParams, "0x");
  assert.equal(decoded.args[1], zeroAddress);
  assert.equal(computeLaunchPreBuyBinding(plan), plan.binding);
  assert.equal(writes(drift).length, 0);
});

test("without state-override support the plan falls back to the zap's linear quote and says so", async () => {
  const drift = fakeDrift();
  const sdk = new ReadFlaunchSDK(robinhood.id, drift); // no publicClient → no probe
  const { plan } = await sdk.planLaunchPreBuy({ route: "standard", params: standardParams, preBuyBps: 100, slippageBps: 50 });
  assert.equal(plan.pricing.method, "protocolQuote");
  assert.equal(plan.payment.expected, 1000n);
  assert.equal(plan.payment.max, ceilSlippage(1000n, 50n));
  assert.equal(plan.value, FEE + plan.payment.max);
});

test("a premine the probe cannot fill is reported, not planned", async () => {
  const drift = fakeDrift();
  const sdk = new ReadFlaunchSDK(robinhood.id, drift, fakePublicClient(drift, { probeReverts: true }));
  const result = await sdk.planLaunchPreBuy({ route: "standard", params: standardParams, preBuyBps: 1000, slippageBps: 50 });
  assert.deepEqual(result, { supported: false, chainId: robinhood.id, route: "standard", reasons: ["PREMINE_NOT_FILLABLE"] });
});

test("legacy Base zap routes are unsupported before any RPC", async () => {
  const drift = fakeDrift();
  const sdk = new ReadFlaunchSDK(base.id, drift, fakePublicClient(drift));
  const result = await sdk.planLaunchPreBuy({ route: "standard", params: standardParams, preBuyBps: 100, slippageBps: 50 });
  assert.deepEqual(result, { supported: false, chainId: base.id, route: "standard", reasons: ["ROUTE_PREMINE_UNAVAILABLE"] });
  assert.deepEqual(drift.interactions, []);
});

test("zero-slippage and ttl options are honoured; sender defaults to the signer", async () => {
  const drift = fakeDrift();
  const sdk = new ReadFlaunchSDK(robinhood.id, drift, fakePublicClient(drift));
  const { plan } = await sdk.planLaunchPreBuy({
    route: "standard",
    params: standardParams,
    preBuyBps: 250,
    slippageBps: 0,
    quoteTtlMs: 5_000,
  });
  assert.equal(plan.sender, SENDER);
  assert.equal(plan.payment.expected, plan.payment.max);
  assert.equal(plan.expiresAtMs - plan.createdAtMs, 5_000);
});

test("route B (Robinhood dynamic split): manager overload, fee read with premine zeroed", async () => {
  const drift = fakeDrift();
  const sdk = new ReadFlaunchSDK(robinhood.id, drift, fakePublicClient(drift));
  const result = await sdk.planLaunchPreBuy({
    route: "dynamicSplitManager",
    params: {
      ...standardParams,
      creatorShare: 0n,
      managerOwnerShare: 0n,
      moderator: SENDER,
      splitReceivers: [{ address: OTHER, share: 100_00000n }],
    },
    preBuyBps: 1000,
    slippageBps: 100,
  });
  assert.equal(result.supported, true);
  const { plan } = result;
  assert.equal(plan.zapFamily, "multichain");
  assert.equal(lower(plan.launch.to), lower(FlaunchZapMultichainAddress[robinhood.id]));
  const feeReads = reads(drift, "calculateFee");
  assert.deepEqual(
    feeReads.map(({ args }) => [args._flaunchParams.premineAmount, args._slippage]),
    [[0n, 0n], [preBuyAmountFromBps(1000), 0n], [preBuyAmountFromBps(1000), 100n]]
  );
  assert.deepEqual(plan.pricing.protocolQuote, { expected: 10_000n, max: 10_100n });
  assert.equal(plan.payment.expected, 10_200n);
  assert.equal(plan.payment.max, ceilSlippage(10_200n, 100n));
  const decoded = decodeFunctionData({ abi: FlaunchZapAbi, data: plan.launch.data });
  assert.equal(decoded.args.length, 3, "manager overload");
  assert.equal(lower(decoded.args[1].manager), lower(DynamicAddressFeeSplitManagerAddress[robinhood.id]));
  assert.equal(decoded.args[0].premineAmount, preBuyAmountFromBps(1000));

  const plain = await sdk.planLaunchPreBuy({
    route: "standard",
    params: standardParams,
    preBuyBps: 1,
    slippageBps: 0,
  });
  assert.equal(decodeFunctionData({ abi: FlaunchZapAbi, data: plain.plan.launch.data }).args.length, 2);
});

test("route C ERC20 pairing (6 dp): payment asset, zap approval, value is the fee only", async () => {
  const drift = fakeDrift({ tokenConfig: { approved: true, tokenType: 4, decimals: 6 } });
  const publicClient = fakePublicClient(drift);
  const sdk = new ReadFlaunchSDK(base.id, drift, publicClient);
  const result = await sdk.planLaunchPreBuy({
    route: "pairedToken",
    params: pairedParams,
    preBuyBps: 100,
    slippageBps: 50,
  });
  assert.equal(result.supported, true, JSON.stringify(result.reasons));
  const { plan } = result;
  const zap = FlaunchZapV1_3Address[base.id];
  assert.equal(lower(plan.launch.to), lower(zap));
  assert.deepEqual(plan.payment.asset, { chainId: base.id, address: PAIRED, decimals: 6 });
  // linear paired-token quote scaled by the impact measured on the native-equivalent launch
  assert.deepEqual(plan.pricing, {
    method: "protocolQuoteWithSimulatedImpact",
    protocolQuote: { expected: 1000n, max: 1005n },
  });
  assert.equal(plan.payment.expected, 1020n);
  assert.equal(plan.payment.max, 1026n);
  assert.equal(plan.maxPremineCost, 1026n);
  assert.equal(plan.value, FEE, "ERC20 premine never leaks into msg.value");
  // the probe priced the native-equivalent launch (pairedToken = zeroAddress), not the ERC20 one
  assert.equal(publicClient.calls.length, 1);
  const probed = decodeFunctionData({ abi: FlaunchZapV1_3Abi, data: publicClient.calls[0].launchData }).args;
  assert.equal(probed[0].pairedToken, zeroAddress);
  assert.equal(probed[0].premineAmount, preBuyAmountFromBps(100));
  assert.equal(plan.fee.amount, FEE);
  assert.equal(plan.pairedToken, PAIRED);

  const [config] = reads(drift, "tokenConfig");
  assert.equal(lower(config.address), lower(PairedTokenRegistryV1_3Address[base.id]));
  assert.deepEqual(config.options, { block: BLOCK });
  const [allowance] = reads(drift, "allowance");
  assert.deepEqual(allowance.args, { owner: SENDER, spender: zap });
  assert.equal(allowance.options, undefined, "allowance is read at latest, not the pinned block");

  assert.equal(plan.approvals.length, 1);
  const [approve] = plan.approvals;
  assert.equal(approve.token, PAIRED);
  assert.equal(approve.spender, zap);
  assert.equal(approve.amount, 1026n);
  assert.equal(approve.to, PAIRED);
  assert.equal(approve.value, 0n);
  assert.deepEqual(plan.funding, {
    native: { required: FEE, available: 10n ** 18n },
    paired: { required: 1026n, available: 10n ** 12n },
    sufficient: true,
  });
  const decoded = decodeFunctionData({ abi: FlaunchZapV1_3Abi, data: plan.launch.data });
  assert.deepEqual(decoded.args[0].pairedToken, PAIRED);
  assert.equal(decoded.args[0].premineAmount, preBuyAmountFromBps(100));
  assert.equal(decoded.args[1], zeroAddress);
  assert.equal(decoded.args[2], 1026n);
});

test("route C ERC20: standing allowance drops the approval; approvalAllowance sizes it", async () => {
  const coveredDrift = fakeDrift({ allowance: 1026n });
  const covered = new ReadFlaunchSDK(base.id, coveredDrift, fakePublicClient(coveredDrift));
  const { plan } = await covered.planLaunchPreBuy({
    route: "pairedToken",
    params: pairedParams,
    preBuyBps: 100,
    slippageBps: 50,
  });
  assert.deepEqual(plan.approvals, []);

  const sizedDrift = fakeDrift();
  const sized = new ReadFlaunchSDK(base.id, sizedDrift, fakePublicClient(sizedDrift));
  const bigger = await sized.planLaunchPreBuy({
    route: "pairedToken",
    params: pairedParams,
    preBuyBps: 100,
    slippageBps: 50,
    approvalAllowance: 50_000n,
  });
  assert.equal(bigger.plan.approvals[0].amount, 50_000n);
  await assert.rejects(
    sized.planLaunchPreBuy({
      route: "pairedToken",
      params: pairedParams,
      preBuyBps: 100,
      slippageBps: 50,
      approvalAllowance: 1n,
    }),
    /approvalAllowance/
  );
});

test("route C native pairings: raw ETH skips the registry, flETH resolves to native, unapproved is rejected", async () => {
  const raw = fakeDrift();
  const { plan: rawPlan } = await new ReadFlaunchSDK(base.id, raw, fakePublicClient(raw)).planLaunchPreBuy({
    route: "pairedToken",
    params: { ...pairedParams, pairedToken: zeroAddress },
    preBuyBps: 100,
    slippageBps: 50,
  });
  assert.equal(reads(raw, "tokenConfig").length, 0);
  assert.deepEqual(rawPlan.payment.asset, { chainId: base.id, address: zeroAddress, decimals: 18 });
  assert.equal(rawPlan.pricing.method, "simulation");
  assert.equal(rawPlan.payment.expected, 1020n);
  assert.equal(rawPlan.payment.max, 1026n);
  assert.equal(rawPlan.value, FEE + 1026n);
  assert.equal(rawPlan.maxPremineCost, 1026n, "cap mirrors payment.max (ignored on chain for native)");
  assert.deepEqual(rawPlan.approvals, []);
  assert.equal(rawPlan.funding.paired, undefined);

  const fleth = fakeDrift({ tokenConfig: { approved: true, tokenType: 1, decimals: 18 } });
  const { plan: flethPlan } = await new ReadFlaunchSDK(base.id, fleth, fakePublicClient(fleth)).planLaunchPreBuy({
    route: "pairedToken",
    params: pairedParams,
    preBuyBps: 100,
    slippageBps: 50,
  });
  assert.equal(reads(fleth, "tokenConfig").length, 1);
  assert.equal(flethPlan.payment.asset.address, zeroAddress);
  assert.equal(flethPlan.value, FEE + 1026n);
  assert.deepEqual(flethPlan.approvals, []);

  const unapproved = await new ReadFlaunchSDK(
    baseSepolia.id,
    fakeDrift({ tokenConfig: { approved: false, tokenType: 0, decimals: 0 } })
  ).planLaunchPreBuy({ route: "pairedToken", params: pairedParams, preBuyBps: 100, slippageBps: 50 });
  assert.deepEqual(unapproved, {
    supported: false,
    chainId: baseSepolia.id,
    route: "pairedToken",
    reasons: ["PAIRED_TOKEN_NOT_APPROVED"],
  });
});

test("static rejections return before any RPC; no signer yields SENDER_REQUIRED", async () => {
  const drift = fakeDrift();
  const sdk = new ReadFlaunchSDK(robinhood.id, drift, fakePublicClient(drift));
  const result = await sdk.planLaunchPreBuy({
    route: "standard",
    params: standardParams,
    preBuyBps: 5000,
    slippageBps: 50,
    gasless: true,
  });
  assert.deepEqual(result, {
    supported: false,
    chainId: robinhood.id,
    route: "standard",
    reasons: ["GASLESS_UNSUPPORTED", "EXCEEDS_ROUTE_LIMIT"],
  });
  assert.deepEqual(drift.interactions, []);

  const readOnly = fakeDrift();
  delete readOnly.getSignerAddress;
  const noSender = await new ReadFlaunchSDK(robinhood.id, readOnly, fakePublicClient(readOnly)).planLaunchPreBuy({
    route: "standard",
    params: standardParams,
    preBuyBps: 100,
    slippageBps: 50,
  });
  assert.deepEqual(noSender.reasons, ["SENDER_REQUIRED"]);
  const explicit = await new ReadFlaunchSDK(robinhood.id, readOnly, fakePublicClient(readOnly)).planLaunchPreBuy({
    route: "standard",
    params: standardParams,
    preBuyBps: 100,
    slippageBps: 50,
    sender: OTHER,
  });
  assert.equal(explicit.plan.sender, OTHER);
});

test("funding shortfall is reported at plan time and blocks execution before any write", async () => {
  const drift = fakeDrift({ nativeBalance: 5n });
  const sdk = new ReadWriteFlaunchSDK(robinhood.id, drift, fakePublicClient(drift));
  const { plan } = await sdk.planLaunchPreBuy({
    route: "standard",
    params: standardParams,
    preBuyBps: 100,
    slippageBps: 50,
  });
  assert.equal(plan.funding.sufficient, false);
  await assert.rejects(sdk.executeLaunchPreBuy(plan), (error) => {
    assert.ok(error instanceof LaunchPreBuyInsufficientBalanceError);
    assert.equal(error.code, "INSUFFICIENT_BALANCE");
    assert.equal(error.required, plan.value);
    assert.equal(error.available, 5n);
    return true;
  });
  assert.equal(writes(drift).length, 0);

  const erc20 = fakeDrift({ erc20Balance: 1n });
  const pairedSdk = new ReadWriteFlaunchSDK(base.id, erc20, fakePublicClient(erc20));
  const paired = await pairedSdk.planLaunchPreBuy({
    route: "pairedToken",
    params: pairedParams,
    preBuyBps: 100,
    slippageBps: 50,
  });
  assert.equal(paired.plan.funding.sufficient, false);
  await assert.rejects(pairedSdk.executeLaunchPreBuy(paired.plan), (error) => {
    assert.equal(error.code, "INSUFFICIENT_BALANCE");
    assert.equal(error.asset.address, PAIRED);
    return true;
  });
  assert.equal(writes(erc20).length, 0);
});

async function plannedOnRobinhood(overrides = {}) {
  const drift = fakeDrift(overrides);
  const publicClient = fakePublicClient(drift);
  const sdk = new ReadWriteFlaunchSDK(robinhood.id, drift, publicClient);
  const { plan } = await sdk.planLaunchPreBuy({
    route: "standard",
    params: standardParams,
    preBuyBps: 100,
    slippageBps: 50,
  });
  drift.interactions.length = 0;
  publicClient.calls.length = 0;
  return { drift, sdk, plan, publicClient };
}

test("any edit, expiry, signer or chain change requires a fresh quote and sends nothing", async () => {
  const { drift, sdk, plan } = await plannedOnRobinhood();
  const expectRequote = async (mutated, reason, executor = sdk) => {
    await assert.rejects(executor.executeLaunchPreBuy(mutated), (error) => {
      assert.ok(error instanceof LaunchPreBuyRequoteRequiredError, `${reason}: ${error.message}`);
      assert.equal(error.code, "REQUOTE_REQUIRED");
      assert.equal(error.reason, reason);
      return true;
    });
    assert.equal(writes(drift).length, 0, `${reason} must not write`);
  };
  const rebind = (mutated) => ({ ...mutated, binding: computeLaunchPreBuyBinding(mutated) });

  await expectRequote({ ...plan, premineAmount: plan.premineAmount + 1n }, "BINDING_MISMATCH");
  await expectRequote({ ...plan, value: plan.value - 1n }, "BINDING_MISMATCH");
  await expectRequote({ ...plan, creator: OTHER }, "BINDING_MISMATCH");
  const flipped = plan.launch.data.slice(0, -1) + (plan.launch.data.endsWith("0") ? "1" : "0");
  await expectRequote({ ...plan, launch: { ...plan.launch, data: flipped } }, "BINDING_MISMATCH");
  await expectRequote(rebind({ ...plan, launch: { ...plan.launch, data: flipped } }), "CALLDATA_MISMATCH");
  // re-bound edits are caught by the calldata check instead
  await expectRequote(rebind({ ...plan, premineAmount: plan.premineAmount + 1n }), "CALLDATA_MISMATCH");
  await expectRequote(rebind({ ...plan, creator: OTHER }), "CALLDATA_MISMATCH");
  await expectRequote(rebind({ ...plan, value: plan.value + 1n }), "CALLDATA_MISMATCH");
  await expectRequote(rebind({ ...plan, launch: { ...plan.launch, to: OTHER } }), "CALLDATA_MISMATCH");
  await expectRequote(rebind({ ...plan, expiresAtMs: Date.now() - 1 }), "EXPIRED");
  await expectRequote(rebind({ ...plan, sender: OTHER }), "SENDER_MISMATCH");
  await expectRequote(plan, "CHAIN_MISMATCH", new ReadWriteFlaunchSDK(base.id, fakeDrift()));

  const realNow = Date.now;
  Date.now = () => plan.expiresAtMs;
  try {
    await expectRequote(plan, "EXPIRED");
  } finally {
    Date.now = realNow;
  }
});

test("a fresh quote above the plan's value is PRICE_MOVED; a higher fee is FEE_CHANGED", async () => {
  const moved = await plannedOnRobinhood();
  moved.drift.state.feeModel = (premine, slippage) => premineCost(premine, slippage) * 2n;
  await assert.rejects(moved.sdk.executeLaunchPreBuy(moved.plan), (error) => {
    assert.equal(error.code, "REQUOTE_REQUIRED");
    assert.equal(error.reason, "PRICE_MOVED");
    return true;
  });
  assert.equal(writes(moved.drift).length, 0);
  await assert.rejects(moved.sdk.verifyLaunchPreBuyPlan(moved.plan), /REQUOTE|fresh quote|more ETH/);

  const fee = await plannedOnRobinhood();
  fee.drift.state.fee = FEE + 10n;
  await assert.rejects(fee.sdk.executeLaunchPreBuy(fee.plan), (error) => {
    assert.equal(error.reason, "FEE_CHANGED");
    return true;
  });
  assert.equal(writes(fee.drift).length, 0);

  // price within the slippage headroom still executes (1020 → 1023 real, cap 1026)
  const within = await plannedOnRobinhood();
  within.drift.state.feeModel = (premine, slippage) => premineCost(premine, slippage) + 3n;
  const { hash } = await within.sdk.executeLaunchPreBuy(within.plan);
  assert.equal(hash, TX_HASH);
});

test("simulation revert requires a fresh quote; verify(simulate) reports ethSpent", async () => {
  const reverted = await plannedOnRobinhood({ simulate: new Error("InsufficientPreminePayment") });
  await assert.rejects(reverted.sdk.executeLaunchPreBuy(reverted.plan), (error) => {
    assert.equal(error.reason, "PRICE_MOVED");
    assert.match(String(error.cause), /InsufficientPreminePayment/);
    return true;
  });
  assert.equal(writes(reverted.drift).length, 0);

  const ok = await plannedOnRobinhood({ simulate: { ethSpent: 900n } });
  const verification = await ok.sdk.verifyLaunchPreBuyPlan(ok.plan, "simulate");
  assert.deepEqual(verification, {
    mode: "simulate",
    fee: FEE,
    expectedTotal: FEE + 1020n,
    ethSpent: 900n,
    memecoin: MEMECOIN,
  });
  const [simulate] = ok.drift.interactions.filter((i) => i.kind === "simulate");
  assert.deepEqual(simulate.options, { from: SENDER, value: ok.plan.value });
  assert.deepEqual(await ok.sdk.verifyLaunchPreBuyPlan(ok.plan, "quote"), {
    mode: "quote",
    fee: FEE,
    expectedTotal: FEE + 1020n,
  });
});

test("ETH route execute writes the plan's exact arguments and value, once", async () => {
  const { drift, sdk, plan } = await plannedOnRobinhood();
  const { hash, plan: executed } = await sdk.executeLaunchPreBuy(plan);
  assert.equal(hash, TX_HASH);
  assert.equal(executed, plan);
  const all = writes(drift);
  assert.equal(all.length, 1);
  const [write] = all;
  assert.equal(lower(write.address), lower(FlaunchZapMultichainAddress[robinhood.id]));
  assert.equal(write.fn, "flaunch");
  assert.deepEqual(write.options, { value: plan.value });
  const decoded = decodeFunctionData({ abi: FlaunchZapAbi, data: plan.launch.data });
  assert.deepEqual(write.args._flaunchParams, decoded.args[0]);
  assert.equal(write.args._treasuryManagerParams, undefined, "plain overload keeps its key set");
  assert.equal(write.args._trustedFeeSigner, zeroAddress);
  // the simulation precedes the signature, and no re-quote happened after the write
  const kinds = drift.interactions.map((i) => i.kind);
  assert.ok(kinds.indexOf("simulate") < kinds.indexOf("write"));
  assert.equal(kinds.lastIndexOf("write"), kinds.length - 1);

  const none = await plannedOnRobinhood();
  await none.sdk.executeLaunchPreBuy(none.plan, { revalidate: "none" });
  assert.equal(none.drift.interactions.filter((i) => i.kind === "simulate").length, 0);
  assert.equal(reads(none.drift, "calculateFee").length, 0);
  assert.equal(writes(none.drift).length, 1);
});

test("route C ERC20 execute: approval first and awaited, then flaunch with maxPremineCost and fee-only value", async () => {
  const drift = fakeDrift();
  const sdk = new ReadWriteFlaunchSDK(base.id, drift, fakePublicClient(drift));
  const { plan } = await sdk.planLaunchPreBuy({
    route: "pairedToken",
    params: pairedParams,
    preBuyBps: 100,
    slippageBps: 50,
  });
  drift.interactions.length = 0;
  const { hash } = await sdk.executeLaunchPreBuy(plan);
  assert.equal(hash, TX_HASH);
  const all = writes(drift);
  assert.equal(all.length, 2);
  assert.equal(all[0].fn, "approve");
  assert.equal(lower(all[0].address), lower(PAIRED));
  assert.deepEqual(all[0].args, { spender: FlaunchZapV1_3Address[base.id], amount: 1026n });
  assert.equal(all[1].fn, "flaunch");
  assert.equal(lower(all[1].address), lower(FlaunchZapV1_3Address[base.id]));
  assert.equal(all[1].args._maxPremineCost, 1026n);
  assert.equal(all[1].args._trustedFeeSigner, zeroAddress);
  assert.equal(all[1].args._flaunchParams.premineAmount, plan.premineAmount);
  assert.deepEqual(all[1].options, { value: FEE });
  const kinds = drift.interactions.map((i) => i.kind);
  const approveIdx = drift.interactions.findIndex((i) => i.kind === "write" && i.fn === "approve");
  assert.equal(kinds[approveIdx + 1], "wait", "approval receipt awaited");
  assert.ok(kinds.indexOf("simulate") > approveIdx, "simulation after the allowance exists");

  const failed = fakeDrift({ waitStatus: "reverted" });
  const failedSdk = new ReadWriteFlaunchSDK(base.id, failed, fakePublicClient(failed));
  const planned = await failedSdk.planLaunchPreBuy({
    route: "pairedToken",
    params: pairedParams,
    preBuyBps: 100,
    slippageBps: 50,
  });
  await assert.rejects(failedSdk.executeLaunchPreBuy(planned.plan), /approval is not confirmed/);
  assert.equal(writes(failed).filter((w) => w.fn === "flaunch").length, 0);
});

test("flaunchWithPreBuy throws a typed error for unsupported launches", async () => {
  const drift = fakeDrift();
  const sdk = new ReadWriteFlaunchSDK(robinhood.id, drift, fakePublicClient(drift));
  await assert.rejects(
    sdk.flaunchWithPreBuy({ route: "standard", params: standardParams, preBuyBps: 100, slippageBps: 50, gasless: true }),
    (error) => {
      assert.ok(error instanceof LaunchPreBuyUnsupportedError);
      assert.equal(error.code, "UNSUPPORTED");
      assert.deepEqual(error.reasons, ["GASLESS_UNSUPPORTED"]);
      return true;
    }
  );
  const { hash } = await sdk.flaunchWithPreBuy({ route: "standard", params: standardParams, preBuyBps: 100, slippageBps: 50 });
  assert.equal(hash, TX_HASH);
});

test("calldata SDK: the executed launch call equals plan.launch and approvals are batchable", async () => {
  const requests = [];
  const publicClient = createPublicClient({
    chain: robinhood,
    transport: custom({
      async request({ method, params }) {
        requests.push(method);
        if (method === "eth_chainId") return toHex(robinhood.id);
        if (method === "eth_blockNumber") return toHex(BLOCK);
        if (method === "eth_getBalance") return toHex(10n ** 18n);
        const answer = (data) => {
          const decoded = decodeFunctionData({ abi: FlaunchZapAbi, data });
          if (decoded.functionName === "calculateFee") {
            return encodeAbiParameters(
              [{ type: "uint256" }],
              [FEE + premineCost(decoded.args[0].premineAmount, decoded.args[1])]
            );
          }
          if (decoded.functionName === "flaunch") {
            return encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [MEMECOIN, 1n]);
          }
          throw new Error(`Unexpected call ${decoded.functionName}`);
        };
        if (method === "eth_call") {
          const { data } = params[0];
          // the launch-cost probe: a state-override call to the sender; answer with fee + impacted cost
          if (params[2] !== undefined && Array.isArray(params[2]) === false && typeof params[2] === "object") {
            const [, , launchData] = decodeAbiParameters(
              [{ type: "address" }, { type: "uint256" }, { type: "bytes" }],
              data
            );
            const spent = FEE + withImpact(premineCost(premineFromCalldata(launchData), 0n));
            return encodeAbiParameters([{ type: "uint256" }, { type: "bytes" }], [spent, "0x"]);
          }
          // viem batches concurrent reads through Multicall3; unwrap and answer each call
          if (data.startsWith("0x82ad56cb")) {
            const { args } = decodeFunctionData({ abi: multicall3Abi, data });
            return encodeFunctionResult({
              abi: multicall3Abi,
              functionName: "aggregate3",
              result: args[0].map((call) => ({ success: true, returnData: answer(call.callData) })),
            });
          }
          return answer(data);
        }
        throw new Error(`Unexpected RPC request: ${method}`);
      },
    }),
  });
  const sdk = createFlaunchCalldata({ publicClient, walletAddress: SENDER });
  const { plan } = await sdk.planLaunchPreBuy({
    route: "standard",
    params: standardParams,
    preBuyBps: 100,
    slippageBps: 50,
  });
  const { hash: encoded } = await sdk.executeLaunchPreBuy(plan);
  const call = decodeCallData(encoded);
  assert.equal(lower(call.to), lower(plan.launch.to));
  assert.equal(call.value, plan.launch.value);
  assert.equal(call.data, plan.launch.data);
  assert.deepEqual([...plan.approvals, plan.launch].map((c) => typeof c.data), ["string"]);
  assert.ok(!requests.includes("eth_sendTransaction"));
});

test("launch result decoding checks the premine against the plan", async () => {
  const drift = fakeDrift();
  const sdk = new ReadFlaunchSDK(base.id, drift, fakePublicClient(drift));
  const { plan } = await sdk.planLaunchPreBuy({
    route: "pairedToken",
    params: { ...pairedParams, pairedToken: zeroAddress },
    preBuyBps: 100,
    slippageBps: 50,
  });
  const event = FlaunchPositionManagerV1_3Abi.find(({ type, name }) => type === "event" && name === "PoolCreated");
  const log = (premineAmount) => ({
    address: PairedTokenPositionManagerV1_3Address[base.id],
    topics: encodeEventTopics({ abi: FlaunchPositionManagerV1_3Abi, eventName: "PoolCreated", args: { _poolId: POOL_ID } }),
    data: encodeAbiParameters(
      event.inputs.filter(({ indexed }) => !indexed),
      [MEMECOIN, TREASURY, 7n, false, FEE, { ...pairedParams, pairedToken: zeroAddress, premineAmount }]
    ),
  });
  const created = sdk.getLaunchPreBuyResultFromLogs([log(plan.premineAmount)], plan);
  assert.equal(created.memecoin, MEMECOIN);
  assert.equal(created.params.premineAmount, plan.premineAmount);
  assert.equal(sdk.getLaunchPreBuyResultFromLogs([], plan), null);
  assert.throws(() => sdk.getLaunchPreBuyResultFromLogs([log(1n)], plan), /does not match/);
});
