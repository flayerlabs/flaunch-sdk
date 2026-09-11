// Pure launch pre-buy rules: percentages, limits, classification, capabilities, binding.
const test = require("node:test");
const assert = require("node:assert/strict");
const { zeroAddress, keccak256, stringToHex } = require("viem");
const { base, baseSepolia, mainnet, robinhood, unichain } = require("viem/chains");
const {
  TOTAL_SUPPLY,
  DEFAULT_MAX_PRE_BUY_BPS,
  DEFAULT_QUOTE_TTL_MS,
  LAUNCH_PRE_BUY_ROUTES,
  LAUNCH_PRE_BUY_REASON_CODES,
  preBuyAmountFromBps,
  preBuyBpsFromAmount,
  percentToBps,
  classifyLaunchPreBuyInput,
  getLaunchPreBuyCapabilities,
  computeLaunchPreBuyBinding,
  zapAddressForRoute,
  doesChainSupportLaunchPreBuy,
  FlaunchZapAddress,
  FlaunchZapMultichainAddress,
  FlaunchZapV1_3Address,
} = require("../dist/index.cjs.js");

const CREATOR = "0x1111111111111111111111111111111111111111";
const PAIRED = "0x2222222222222222222222222222222222222222";

const standardParams = {
  name: "Coin",
  symbol: "COIN",
  tokenUri: "ipfs://coin",
  fairLaunchPercent: 0,
  fairLaunchDuration: 0,
  initialMarketCapUSD: 4000,
  creator: CREATOR,
  creatorFeeAllocationPercent: 100,
};
const pairedParams = {
  name: "Coin",
  symbol: "COIN",
  tokenUri: "ipfs://coin",
  premineAmount: 0n,
  creator: CREATOR,
  creatorFeeAllocation: 10_000,
  flaunchAt: 0n,
  initialPriceParams: "0x1234",
  feeCalculatorParams: "0x",
  pairedToken: PAIRED,
};
const okInput = (overrides = {}) => ({
  route: "standard",
  params: standardParams,
  preBuyBps: 100,
  slippageBps: 50,
  ...overrides,
});
// the ETH-funded routes can only premine through the multichain zap; Base's legacy zap cannot
const ETH_CHAIN = robinhood.id;

test("supply constant and bps → amount conversion are exact", () => {
  assert.equal(TOTAL_SUPPLY, 100n * 10n ** 27n);
  assert.equal(preBuyAmountFromBps(1), 10n ** 25n);
  assert.equal(preBuyAmountFromBps(100), 10n ** 27n);
  assert.equal(preBuyAmountFromBps(1000), 10n ** 28n);
  for (let bps = 1; bps <= 1000; bps += 1) {
    const amount = preBuyAmountFromBps(bps);
    assert.equal(amount * 10_000n, TOTAL_SUPPLY * BigInt(bps), `bps ${bps} rounds`);
    assert.equal(preBuyBpsFromAmount(amount), bps);
  }
  for (const bad of [0, -1, 1.5, 10_000, Number.NaN, "100", 2n]) {
    assert.throws(() => preBuyAmountFromBps(bad), `rejects ${String(bad)}`);
  }
});

test("percent → bps accepts up to two decimals and rejects finer or malformed input", () => {
  assert.equal(percentToBps("1"), 100);
  assert.equal(percentToBps("2.5"), 250);
  assert.equal(percentToBps(0.01), 1);
  assert.equal(percentToBps("10.00"), 1000);
  assert.equal(percentToBps(" 0.5 "), 50);
  for (const bad of ["0.005", "1.234", "abc", "-1", "1e-7", 1e-7, Infinity, "", "1."]) {
    assert.throws(() => percentToBps(bad), `rejects ${String(bad)}`);
  }
});

test("route limit defaults to 10% and honours a valid override", () => {
  assert.equal(DEFAULT_MAX_PRE_BUY_BPS, 1000);
  assert.deepEqual(classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ preBuyBps: 1000 })), []);
  assert.deepEqual(classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ preBuyBps: 1001 })), [
    "EXCEEDS_ROUTE_LIMIT",
  ]);
  assert.deepEqual(
    classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ preBuyBps: 2500, maxPreBuyBps: 2500 })),
    []
  );
  assert.deepEqual(
    classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ preBuyBps: 2501, maxPreBuyBps: 2500 })),
    ["EXCEEDS_ROUTE_LIMIT"]
  );
  for (const limit of [0, 10_000, 1.5, -5]) {
    assert.ok(
      classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ maxPreBuyBps: limit })).includes("INVALID_LIMIT"),
      `limit ${limit}`
    );
  }
  assert.equal(getLaunchPreBuyCapabilities(ETH_CHAIN, { maxPreBuyBps: 500 }).routes.standard.maxPreBuyBps, 500);
  assert.throws(() => getLaunchPreBuyCapabilities(ETH_CHAIN, { maxPreBuyBps: 0 }));
});

test("percentage and slippage validation", () => {
  for (const bps of [0, -1, 0.5, 10_000, "100"]) {
    assert.ok(classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ preBuyBps: bps })).includes("INVALID_PERCENTAGE"));
  }
  assert.deepEqual(classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ slippageBps: 0 })), []);
  assert.deepEqual(classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ slippageBps: 9_999 })), []);
  for (const bps of [-1, 10_000, 1.5, "50"]) {
    assert.deepEqual(classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ slippageBps: bps })), ["INVALID_SLIPPAGE"]);
  }
});

test("static classification: premine ownership, creator, protected, fair launch, gasless", () => {
  assert.deepEqual(
    classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ params: { ...standardParams, premineAmount: 0n } })),
    []
  );
  assert.deepEqual(
    classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ params: { ...standardParams, premineAmount: 5n } })),
    ["PREMINE_ALREADY_SET"]
  );
  assert.deepEqual(
    classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ params: { ...standardParams, creator: zeroAddress } })),
    ["INVALID_CREATOR"]
  );
  assert.deepEqual(
    classifyLaunchPreBuyInput(
      ETH_CHAIN,
      okInput({ params: { ...standardParams, trustedSignerSettings: { enabled: false } } })
    ),
    ["PROTECTED_LAUNCH_UNSUPPORTED"]
  );
  assert.deepEqual(
    classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ params: { ...standardParams, fairLaunchPercent: 10 } })),
    ["FAIR_LAUNCH_UNSUPPORTED"]
  );
  // fairLaunchDuration is rejected where the zap has no fair-launch field (multichain)
  assert.deepEqual(
    classifyLaunchPreBuyInput(robinhood.id, okInput({ params: { ...standardParams, fairLaunchDuration: 60 } })),
    ["FAIR_LAUNCH_UNSUPPORTED"]
  );
  assert.deepEqual(classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ gasless: true })), ["GASLESS_UNSUPPORTED"]);
  // reasons accumulate rather than short-circuit
  assert.deepEqual(
    classifyLaunchPreBuyInput(ETH_CHAIN, okInput({ gasless: true, preBuyBps: 5000, slippageBps: -1 })).sort(),
    ["EXCEEDS_ROUTE_LIMIT", "GASLESS_UNSUPPORTED", "INVALID_SLIPPAGE"]
  );
});

test("paired-token classification: gate params, trusted signer, manager", () => {
  const paired = (params) => okInput({ route: "pairedToken", params: { ...pairedParams, ...params } });
  assert.deepEqual(classifyLaunchPreBuyInput(base.id, paired({})), []);
  assert.deepEqual(classifyLaunchPreBuyInput(base.id, paired({ premineAmount: undefined })), []);
  assert.deepEqual(classifyLaunchPreBuyInput(base.id, paired({ premineAmount: 1n })), ["PREMINE_ALREADY_SET"]);
  assert.deepEqual(classifyLaunchPreBuyInput(base.id, paired({ feeCalculatorParams: "0xabcd" })), [
    "PROTECTED_LAUNCH_UNSUPPORTED",
  ]);
  assert.deepEqual(classifyLaunchPreBuyInput(base.id, paired({ trustedFeeSigner: CREATOR })), [
    "PROTECTED_LAUNCH_UNSUPPORTED",
  ]);
  assert.deepEqual(classifyLaunchPreBuyInput(base.id, paired({ trustedFeeSigner: zeroAddress })), []);
  assert.deepEqual(
    classifyLaunchPreBuyInput(base.id, paired({ treasuryManagerParams: { manager: CREATOR } })),
    ["PAIRED_MANAGER_LAUNCH_UNSUPPORTED"]
  );
  assert.deepEqual(classifyLaunchPreBuyInput(mainnet.id, paired({})), ["ROUTE_UNSUPPORTED"]);
});

test("legacy Base zap routes cannot premine; the paired-token route is the way on Base", () => {
  for (const chainId of [base.id, baseSepolia.id]) {
    for (const route of ["standard", "revenueManager", "splitManager", "dynamicSplitManager"]) {
      const reasons = classifyLaunchPreBuyInput(chainId, okInput({ route }));
      assert.deepEqual(reasons, ["ROUTE_PREMINE_UNAVAILABLE"], `${chainId} ${route}`);
      assert.equal(getLaunchPreBuyCapabilities(chainId).routes[route].supported, false);
    }
    assert.deepEqual(
      classifyLaunchPreBuyInput(chainId, okInput({ route: "pairedToken", params: pairedParams })),
      []
    );
  }
});

test("route availability follows the deployed zaps and managers", () => {
  assert.deepEqual(classifyLaunchPreBuyInput(999_999, okInput()), ["CHAIN_UNSUPPORTED"]);
  assert.equal(zapAddressForRoute(base.id, "standard"), FlaunchZapAddress[base.id]);
  assert.equal(zapAddressForRoute(robinhood.id, "standard"), FlaunchZapMultichainAddress[robinhood.id]);
  assert.equal(zapAddressForRoute(base.id, "pairedToken"), FlaunchZapV1_3Address[base.id]);
  assert.equal(zapAddressForRoute(mainnet.id, "pairedToken"), undefined);
  for (const chain of [base, baseSepolia, robinhood, mainnet, unichain]) {
    assert.equal(doesChainSupportLaunchPreBuy(chain.id), true, chain.name);
  }
  assert.equal(doesChainSupportLaunchPreBuy(999_999), false);
});

test("capability matrix per chain", () => {
  const expect = (chainId, supportedRoutes) => {
    const caps = getLaunchPreBuyCapabilities(chainId);
    assert.deepEqual(Object.keys(caps.routes).sort(), [...LAUNCH_PRE_BUY_ROUTES].sort());
    for (const route of LAUNCH_PRE_BUY_ROUTES) {
      const cap = caps.routes[route];
      assert.equal(cap.supported, supportedRoutes.includes(route), `${chainId} ${route}`);
      assert.equal(cap.maxPreBuyBps, 1000);
      if (route === "pairedToken" || route === "vested") {
        assert.deepEqual(cap.paymentAssets, ["native", "pairedErc20"]);
        assert.equal(cap.requiresApproval, "erc20Only");
      } else {
        assert.deepEqual(cap.paymentAssets, ["native"]);
        assert.equal(cap.requiresApproval, "never");
      }
      if (!cap.supported) assert.ok(cap.reasons.length > 0);
    }
    assert.equal(caps.supported, supportedRoutes.length > 0);
    assert.equal(caps.defaultQuoteTtlMs, DEFAULT_QUOTE_TTL_MS);
    assert.deepEqual(caps.unsupported, {
      pairedTokenWithManager: "PAIRED_MANAGER_LAUNCH_UNSUPPORTED",
      anyFlaunch: "ANY_FLAUNCH_UNSUPPORTED",
      gasless: "GASLESS_UNSUPPORTED",
      protectedLaunch: "PROTECTED_LAUNCH_UNSUPPORTED",
    });
    return caps;
  };
  const ethRoutes = ["standard", "revenueManager", "splitManager", "dynamicSplitManager"];
  expect(base.id, ["pairedToken"]);
  // the AnyFlaunchZap (vested launches) is deployed on Base Sepolia only
  expect(baseSepolia.id, ["pairedToken", "vested"]);
  expect(robinhood.id, LAUNCH_PRE_BUY_ROUTES.filter((route) => route !== "vested"));
  expect(mainnet.id, ethRoutes);
  expect(unichain.id, ethRoutes);
  const unknown = expect(999_999, []);
  assert.deepEqual(unknown.routes.standard.reasons, ["CHAIN_UNSUPPORTED"]);
  for (const code of Object.values(unknown.unsupported)) {
    assert.ok(LAUNCH_PRE_BUY_REASON_CODES.includes(code));
  }
});

const asset = { chainId: base.id, address: zeroAddress, decimals: 18 };
const planFields = {
  version: 1,
  chainId: base.id,
  route: "standard",
  zapFamily: "legacy",
  sender: CREATOR,
  creator: CREATOR,
  preBuyBps: 100,
  premineAmount: 10n ** 27n,
  slippageBps: 50,
  value: 1_000n,
  maxPremineCost: undefined,
  pairedToken: undefined,
  quoteBlockNumber: 123n,
  expiresAtMs: 1_700_000_030_000,
  launch: { to: FlaunchZapAddress[base.id], data: "0xdeadbeef", value: 1_000n },
  payment: { asset, max: 900n },
  fee: { asset, amount: 100n },
};

test("binding is stable under key order and address case, and changes with every bound field", () => {
  const binding = computeLaunchPreBuyBinding(planFields);
  assert.match(binding, /^0x[0-9a-f]{64}$/);
  const reordered = Object.fromEntries(Object.entries(planFields).reverse());
  assert.equal(computeLaunchPreBuyBinding(reordered), binding);
  assert.equal(
    computeLaunchPreBuyBinding({ ...planFields, sender: CREATOR.toUpperCase().replace("0X", "0x") }),
    binding
  );
  // cosmetic fields are not bound
  assert.equal(computeLaunchPreBuyBinding({ ...planFields, createdAtMs: 1, funding: {} }), binding);
  const mutations = {
    chainId: robinhood.id,
    route: "splitManager",
    zapFamily: "multichain",
    sender: PAIRED,
    creator: PAIRED,
    preBuyBps: 101,
    premineAmount: 10n ** 27n + 1n,
    slippageBps: 51,
    value: 1_001n,
    maxPremineCost: 5n,
    pairedToken: PAIRED,
    quoteBlockNumber: 124n,
    expiresAtMs: planFields.expiresAtMs + 1,
    launch: { ...planFields.launch, data: "0xdeadbeee" },
    payment: { asset: { ...asset, decimals: 6 }, max: 900n },
    fee: { asset, amount: 101n },
  };
  for (const [key, value] of Object.entries(mutations)) {
    assert.notEqual(computeLaunchPreBuyBinding({ ...planFields, [key]: value }), binding, key);
  }
  // reproducible from first principles so a host can recompute it
  const canonical = {
    chainId: base.id,
    creator: CREATOR,
    expiresAtMs: planFields.expiresAtMs,
    feeAmount: "100",
    feeAsset: `${base.id}:${zeroAddress}:18`,
    launchData: "0xdeadbeef",
    launchTo: FlaunchZapAddress[base.id].toLowerCase(),
    launchValue: "1000",
    maxPremineCost: null,
    pairedToken: null,
    paymentAsset: `${base.id}:${zeroAddress}:18`,
    paymentMax: "900",
    preBuyBps: 100,
    premineAmount: (10n ** 27n).toString(),
    quoteBlockNumber: "123",
    route: "standard",
    sender: CREATOR,
    slippageBps: 50,
    value: "1000",
    version: 1,
    zapFamily: "legacy",
  };
  assert.equal(binding, keccak256(stringToHex(JSON.stringify(canonical))));
});
