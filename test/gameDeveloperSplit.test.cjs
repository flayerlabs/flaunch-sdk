const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeAbiParameters, getAddress, zeroAddress } = require("viem");
const { base, baseSepolia, robinhood, mainnet, unichain } = require("viem/chains");
const {
  GAME_DEVELOPER_SHARE,
  GAME_DEVELOPER_SPLIT_SHARE_TOTAL,
  GameDeveloperFeeSplitManagerAbi,
  GameDeveloperFeeSplitManagerAddress,
  ReadGameDeveloperFeeSplitManager,
  ReadWriteGameDeveloperFeeSplitManager,
  doesChainSupportGameDeveloperSplit,
  doesChainSupportPairedTokenLaunch,
  encodeGameDeveloperSplitInitializeData,
  percentToGameDeveloperShare,
} = require("../dist/index.cjs.js");

const INITIALIZE_PARAMS = [
  {
    type: "tuple",
    components: [
      { type: "uint256", name: "creatorShare" },
      { type: "uint256", name: "ownerShare" },
      { type: "address", name: "moderator" },
      {
        type: "tuple[]",
        name: "recipientShares",
        components: [
          { type: "address", name: "recipient" },
          { type: "uint256", name: "share" },
        ],
      },
    ],
  },
  { type: "address" },
];

const dev = "0x000000000000000000000000000000000000dEaD";
const launcher = "0x1111111111111111111111111111111111111111";
const friend = "0x2222222222222222222222222222222222222222";

test("constants match the contract: 5% of a 100_00000 total", () => {
  assert.equal(GAME_DEVELOPER_SHARE, 5_00000n);
  assert.equal(GAME_DEVELOPER_SPLIT_SHARE_TOTAL, 100_00000n);
  assert.equal(percentToGameDeveloperShare(95), 95_00000n);
  assert.throws(() => percentToGameDeveloperShare(12.5));
});

test("initializeData is the parent tuple plus the developer, with the 5% row prepended", () => {
  const data = encodeGameDeveloperSplitInitializeData({
    gameDeveloper: dev,
    moderator: launcher,
    splitReceivers: [
      { address: launcher, share: 60_00000n },
      { address: friend, share: 35_00000n },
    ],
  });
  const [params, gameDeveloper] = decodeAbiParameters(INITIALIZE_PARAMS, data);
  assert.equal(gameDeveloper, getAddress(dev));
  assert.equal(params.creatorShare, 0n);
  assert.equal(params.ownerShare, 0n);
  assert.equal(params.moderator, launcher);
  assert.deepEqual(params.recipientShares, [
    { recipient: getAddress(dev), share: 5_00000n },
    { recipient: launcher, share: 60_00000n },
    { recipient: friend, share: 35_00000n },
  ]);
});

test("moderator defaults to zero, and the encoding rejects what the contract would", () => {
  const data = encodeGameDeveloperSplitInitializeData({
    gameDeveloper: dev,
    splitReceivers: [{ address: launcher, share: 95_00000n }],
  });
  const [params] = decodeAbiParameters(INITIALIZE_PARAMS, data);
  assert.equal(params.moderator, zeroAddress);

  assert.throws(
    () => encodeGameDeveloperSplitInitializeData({ gameDeveloper: zeroAddress, splitReceivers: [] }),
    /zero address/
  );
  assert.throws(
    () =>
      encodeGameDeveloperSplitInitializeData({
        gameDeveloper: dev,
        splitReceivers: [{ address: launcher, share: 90_00000n }],
      }),
    /must total 10000000/
  );
  assert.throws(
    () =>
      encodeGameDeveloperSplitInitializeData({
        gameDeveloper: dev,
        splitReceivers: [
          { address: launcher, share: 90_00000n },
          { address: dev.toLowerCase(), share: 5_00000n },
        ],
      }),
    /already holds the fixed 5%/
  );
  assert.throws(
    () =>
      encodeGameDeveloperSplitInitializeData({
        gameDeveloper: dev,
        splitReceivers: [
          { address: launcher, share: 50_00000n },
          { address: launcher, share: 45_00000n },
        ],
      }),
    /Duplicate/
  );
});

test("chain support follows the address map and the paired-token zap", () => {
  for (const chain of [mainnet, base, baseSepolia, robinhood]) {
    const supported = doesChainSupportGameDeveloperSplit(chain.id);
    assert.equal(
      supported,
      GameDeveloperFeeSplitManagerAddress[chain.id] !== undefined &&
        doesChainSupportPairedTokenLaunch(chain.id)
    );
  }
});

test("clients expose the developer surface on top of the v1.3.1 dynamic split client", () => {
  const abiNames = new Set(GameDeveloperFeeSplitManagerAbi.map((e) => e.name));
  for (const fn of [
    "gameDeveloper",
    "gameDeveloperPayout",
    "originalCreator",
    "setGameDeveloperPayout",
    "transferGameDeveloper",
    "withdrawToCreator",
    "updateRecipients",
    "claim",
  ]) {
    assert.ok(abiNames.has(fn), `${fn} in ABI`);
  }
  for (const m of ["gameDeveloper", "gameDeveloperPayout", "originalCreator", "totalActiveShares", "balances"]) {
    assert.equal(typeof ReadGameDeveloperFeeSplitManager.prototype[m], "function", m);
  }
  for (const m of ["setGameDeveloperPayout", "transferGameDeveloper", "withdrawToCreator", "updateRecipients", "claim"]) {
    assert.equal(typeof ReadWriteGameDeveloperFeeSplitManager.prototype[m], "function", m);
  }
});

// ---------------------------------------------------------------------------------------------
// The Any game route: AnyFlaunchZap -> vested AnyPositionManager -> GameDeveloperFeeSplitManager
// ---------------------------------------------------------------------------------------------

const {
  encodeAbiParameters,
  encodeFunctionData,
  encodeFunctionResult,
  decodeFunctionData,
  keccak256,
  stringToBytes,
} = require("viem");
const {
  AnyFlaunchZapAbi,
  AnyFlaunchZapAddress,
  FLETHAddress,
  FLAUNCH_TOTAL_SUPPLY,
  ReadFlaunchSDK,
  ReadWriteFlaunchSDK,
  TreasuryManagerFactoryV1_3Address,
  doesChainSupportAnyGameDeveloperSplit,
  doesChainSupportVestedLaunch,
  isGameDeveloperFeeSplitManagerImplementation,
  toAnyFlaunchZapFlaunchParams,
  DynamicAddressFeeSplitManagerV1_3Address,
  FlaunchZapV1_3Address,
  encodeDynamicSplitInitializeData,
  Permissions,
  ClosedPermissionsV1_3Address,
} = require("../dist/index.cjs.js");

const CHAIN = baseSepolia.id;
const SIGNER = "0x1111111111111111111111111111111111111111";
const MODERATOR = "0x3333333333333333333333333333333333333333";
/** Test-injected manager implementation, used to prove the map (not a constant) drives routing. */
const TEST_MANAGER_IMPL = "0x9999999999999999999999999999999999999999";
/** The real Base Sepolia deployment: block 46817954, approved on the v1.3.1 TreasuryManagerFactory. */
const DEPLOYED_MANAGER_IMPL = "0x905a278CaEA18768180e4Bb4A6BBA1FE1ddcEA6e";
const CLONE = "0x4444444444444444444444444444444444444444";
const PAYOUT = "0x5555555555555555555555555555555555555555";
const SPEND_GATE = "0x54cdcf0b0000000000000000000000000000cafe";
const GATE_SIGNER = "0x6666666666666666666666666666666666666666";
const SETTLER = "0x7777777777777777777777777777777777777777";
const TX_HASH = `0x${"01".repeat(32)}`;

/** The gate's dispatcher-prefixed spend-gate params, exactly as a gamemode-gate client encodes them. */
function gateParams({ enabled = true, walletCapWei = 10n ** 17n, signer = GATE_SIGNER, settler = SETTLER, endsAt = 1_900_000_000n } = {}) {
  const inner = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "bool" }, { type: "uint256" }, { type: "address" }, { type: "address" }, { type: "uint256" }],
    [keccak256(stringToBytes("flaunch.spendGate.params")), enabled, walletCapWei, signer, settler, endsAt]
  );
  return encodeAbiParameters(
    [{ type: "bytes32" }, { type: "address" }, { type: "bytes" }],
    [keccak256(stringToBytes("flaunch.dispatcher.route.v1")), SPEND_GATE, inner]
  );
}

const gameLaunch = {
  name: "Arena Coin",
  symbol: "ARENA",
  tokenUri: "ipfs://arena",
  creator: SIGNER,
  creatorFeeAllocationPercent: 80,
  initialMarketCapUSD: 4000,
  pairedToken: FLETHAddress[CHAIN],
  flaunchAt: 1_890_000_000n,
  feeCalculatorParams: gateParams(),
  vestingSchedules: [],
  gameDeveloper: dev,
  moderator: MODERATOR,
  splitReceivers: [
    { address: launcher, share: 60_00000n },
    { address: friend, share: 35_00000n },
  ],
};

function recordingDrift({ fee = { ethRequired: 12n, pairedPremineCost: 34n }, implementation = TEST_MANAGER_IMPL } = {}) {
  const interactions = [];
  return {
    interactions,
    contract({ address }) {
      return {
        address,
        async read(fn, args, options) {
          interactions.push({ kind: "read", address, fn, args, options });
          if (fn === "managerImplementation") return implementation;
          if (fn === "gameDeveloperPayout") return PAYOUT;
          if (fn === "calculateFee") return { ethRequired_: fee.ethRequired, pairedPremineCost_: fee.pairedPremineCost };
          throw new Error(`Unexpected read: ${fn}`);
        },
        async write(fn, args, options) {
          interactions.push({ kind: "write", address, fn, args, options });
          return TX_HASH;
        },
      };
    },
    async call(params) {
      interactions.push({ kind: "call", ...params });
      return encodeFunctionResult({ abi: AnyFlaunchZapAbi, functionName: "calculateFee", result: [fee.ethRequired, fee.pairedPremineCost] });
    },
    async getSignerAddress() {
      return SIGNER;
    },
  };
}

/** Runs `fn` with a test manager implementation injected over whatever the address map holds. */
async function withManagerDeployed(fn) {
  const before = GameDeveloperFeeSplitManagerAddress[CHAIN];
  GameDeveloperFeeSplitManagerAddress[CHAIN] = TEST_MANAGER_IMPL;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete GameDeveloperFeeSplitManagerAddress[CHAIN];
    else GameDeveloperFeeSplitManagerAddress[CHAIN] = before;
  }
}

test("Any game route: the Base Sepolia manager is deployed, so both game routes build calldata", async () => {
  assert.equal(GameDeveloperFeeSplitManagerAddress[CHAIN], DEPLOYED_MANAGER_IMPL);
  assert.equal(doesChainSupportVestedLaunch(CHAIN), true);
  assert.equal(doesChainSupportAnyGameDeveloperSplit(CHAIN), true);
  assert.equal(doesChainSupportGameDeveloperSplit(CHAIN), true);
  assert.equal(isGameDeveloperFeeSplitManagerImplementation(CHAIN, DEPLOYED_MANAGER_IMPL), true);
  assert.equal(isGameDeveloperFeeSplitManagerImplementation(CHAIN, DEPLOYED_MANAGER_IMPL.toLowerCase()), true);
  assert.equal(isGameDeveloperFeeSplitManagerImplementation(CHAIN, TEST_MANAGER_IMPL), false);

  // both routes now install the deployed implementation instead of rejecting the chain
  const anyDrift = recordingDrift({ implementation: DEPLOYED_MANAGER_IMPL });
  const prepared = await new ReadWriteFlaunchSDK(CHAIN, anyDrift).prepareAnyGameLaunch(gameLaunch);
  assert.equal(prepared.to.toLowerCase(), AnyFlaunchZapAddress[CHAIN].toLowerCase());
  const pairedDrift = recordingDrift({ implementation: DEPLOYED_MANAGER_IMPL });
  assert.equal(
    await new ReadWriteFlaunchSDK(CHAIN, pairedDrift).flaunchPairedTokenWithGameDeveloperSplit({
      flaunchParams: {
        name: "Arena Coin",
        symbol: "ARENA",
        tokenUri: "ipfs://arena",
        premineAmount: 0n,
        creator: SIGNER,
        creatorFeeAllocation: 8_000,
        flaunchAt: 0n,
        initialPriceParams: "0x1234",
        feeCalculatorParams: gateParams(),
        pairedToken: FLETHAddress[CHAIN],
      },
      trustedFeeSigner: zeroAddress,
      maxPremineCost: 0n,
      value: 12n,
      gameDeveloper: dev,
      moderator: MODERATOR,
      splitReceivers: gameLaunch.splitReceivers,
    }),
    TX_HASH
  );
  assert.equal(
    pairedDrift.interactions.filter((i) => i.kind === "write")[0].args._treasuryManagerParams.manager,
    DEPLOYED_MANAGER_IMPL
  );

  // a chain without the manager still names itself, and reads nothing before the chain check
  const unsupported = new ReadWriteFlaunchSDK(base.id, recordingDrift());
  await assert.rejects(unsupported.prepareAnyGameLaunch(gameLaunch), /not deployed on chain 8453/);
  await assert.rejects(unsupported.flaunchAnyWithGameDeveloperSplit(gameLaunch), /not deployed on chain 8453/);
  assert.equal(doesChainSupportAnyGameDeveloperSplit(base.id), false);
  assert.equal(doesChainSupportGameDeveloperSplit(base.id), false);
  assert.equal(isGameDeveloperFeeSplitManagerImplementation(base.id, DEPLOYED_MANAGER_IMPL), false);
  assert.equal(await unsupported.getGameDeveloperPayout(CLONE), null);
  assert.deepEqual(unsupported.drift.interactions, [], "nothing is read before the chain check");

  // an injected implementation still overrides the map, so routing follows the map not a constant
  await withManagerDeployed(async () => {
    assert.equal(doesChainSupportAnyGameDeveloperSplit(CHAIN), true);
    assert.equal(doesChainSupportGameDeveloperSplit(CHAIN), true);
    assert.equal(isGameDeveloperFeeSplitManagerImplementation(CHAIN, TEST_MANAGER_IMPL.toLowerCase()), true);
    assert.equal(isGameDeveloperFeeSplitManagerImplementation(CHAIN, CLONE), false);
    assert.equal(isGameDeveloperFeeSplitManagerImplementation(CHAIN, zeroAddress), false);
    // the vested stack is Base Sepolia only, so the Any route stays off elsewhere even with a manager
    assert.equal(doesChainSupportAnyGameDeveloperSplit(base.id), false);
  });
});

test("Any game route: calldata golden — manager + maxPremineCost overload, zero trusted signer, gate params verbatim, no vesting", async () => {
  await withManagerDeployed(async () => {
    const drift = recordingDrift();
    const sdk = new ReadWriteFlaunchSDK(CHAIN, drift);
    const prepared = await sdk.prepareAnyGameLaunch(gameLaunch);

    // the fee is quoted as the signer, with the zap's own slippage argument
    const [quote] = drift.interactions.filter((i) => i.kind === "call");
    assert.equal(quote.from, SIGNER);
    assert.equal(quote.to.toLowerCase(), AnyFlaunchZapAddress[CHAIN].toLowerCase());
    const quoteCall = decodeFunctionData({ abi: AnyFlaunchZapAbi, data: quote.data });
    assert.equal(quoteCall.functionName, "calculateFee");
    assert.equal(quoteCall.args[1], 0n);

    // the overload and its arguments
    assert.equal(prepared.overload, undefined);
    assert.equal(prepared.args.overload, "managerMaxPremineCost");
    const { _flaunchParams, _treasuryManagerParams, _trustedFeeSigner, _maxPremineCost } = prepared.args.args;
    assert.equal(_trustedFeeSigner, zeroAddress, "the gate signer travels inside feeCalculatorParams; a non-zero signer reverts NotSettler");
    assert.equal(_maxPremineCost, 34n, "defaults to the zap's quoted paired premine cost");
    assert.equal(_flaunchParams.feeCalculatorParams, gateParams(), "dispatcher-prefixed gate params forwarded verbatim");
    assert.equal(_flaunchParams.flaunchAt, 1_890_000_000n);
    assert.deepEqual(_flaunchParams.vestingSchedules, []);
    assert.equal(_flaunchParams.pairedToken, FLETHAddress[CHAIN]);
    assert.equal(_flaunchParams.creator, SIGNER);
    assert.equal(_flaunchParams.creatorFeeAllocation, 8000);
    assert.equal(_flaunchParams.initialMarketCap, 4000n * 10n ** 6n);
    assert.equal(_flaunchParams.premineAmount, 0n);
    assert.equal(_treasuryManagerParams.manager, TEST_MANAGER_IMPL);
    assert.equal(_treasuryManagerParams.permissions, zeroAddress);
    assert.equal(_treasuryManagerParams.depositData, "0x");
    const [initParams, gameDeveloper] = decodeAbiParameters(INITIALIZE_PARAMS, _treasuryManagerParams.initializeData);
    assert.equal(gameDeveloper, getAddress(dev));
    assert.equal(initParams.moderator, MODERATOR);
    assert.deepEqual(initParams.recipientShares, [
      { recipient: getAddress(dev), share: 5_00000n },
      { recipient: launcher, share: 60_00000n },
      { recipient: friend, share: 35_00000n },
    ]);

    // the encoded call is the four-argument `flaunch`, built independently here
    const expectedData = encodeFunctionData({
      abi: AnyFlaunchZapAbi,
      functionName: "flaunch",
      args: [
        {
          ...toAnyFlaunchZapFlaunchParams(CHAIN, { ...gameLaunch, vestingSchedules: [] }),
        },
        {
          manager: TEST_MANAGER_IMPL,
          permissions: zeroAddress,
          initializeData: encodeGameDeveloperSplitInitializeData({
            gameDeveloper: dev,
            moderator: MODERATOR,
            splitReceivers: gameLaunch.splitReceivers,
          }),
          depositData: "0x",
        },
        zeroAddress,
        34n,
      ],
    });
    assert.equal(prepared.data, expectedData);
    assert.equal(prepared.data.slice(0, 10), GOLDEN_ANY_GAME_LAUNCH.selector);
    assert.equal(prepared.data, GOLDEN_ANY_GAME_LAUNCH.data);
    assert.equal(prepared.value, 12n);
    assert.equal(prepared.to.toLowerCase(), AnyFlaunchZapAddress[CHAIN].toLowerCase());

    // execute() sends exactly the prepared arguments and value, and returns the hash
    assert.equal(await prepared.execute(), TX_HASH);
    const [write] = drift.interactions.filter((i) => i.kind === "write");
    assert.equal(write.fn, "flaunch");
    assert.equal(write.address.toLowerCase(), AnyFlaunchZapAddress[CHAIN].toLowerCase());
    assert.deepEqual(write.args, prepared.args.args);
    assert.deepEqual(write.options, { value: 12n });

    // flaunchAnyWithGameDeveloperSplit is prepare + execute
    const drift2 = recordingDrift();
    assert.equal(await new ReadWriteFlaunchSDK(CHAIN, drift2).flaunchAnyWithGameDeveloperSplit(gameLaunch), TX_HASH);
    assert.deepEqual(drift2.interactions.filter((i) => i.kind === "write")[0].args, prepared.args.args);
  });
});

test("Any game route: vesting, an explicit spend cap, permissions and the encoder's own checks", async () => {
  await withManagerDeployed(async () => {
    const drift = recordingDrift({ fee: { ethRequired: 1_000n, pairedPremineCost: 500n } });
    const sdk = new ReadWriteFlaunchSDK(CHAIN, drift);
    const prepared = await sdk.prepareAnyGameLaunch({
      ...gameLaunch,
      vestingSchedules: [{ beneficiary: launcher, percent: "12.5", cliffDuration: 86_400, vestDuration: 31_536_000 }],
      premineAmount: 10n ** 27n,
      maxPremineCost: 777n,
      slippageBps: 50,
      permissions: MODERATOR,
    });
    const { _flaunchParams, _treasuryManagerParams, _maxPremineCost } = prepared.args.args;
    assert.equal(_maxPremineCost, 777n, "an explicit cap wins over the quote");
    assert.equal(_treasuryManagerParams.permissions, MODERATOR);
    assert.deepEqual(_flaunchParams.vestingSchedules, [
      { beneficiary: launcher, amount: 125n * 10n ** 26n, start: 0, cliffDuration: 86_400, vestDuration: 31_536_000 },
    ]);
    assert.equal(_flaunchParams.premineAmount, 10n ** 27n);
    assert.equal(prepared.value, 1_000n);
    const [quote] = drift.interactions.filter((i) => i.kind === "call");
    assert.equal(decodeFunctionData({ abi: AnyFlaunchZapAbi, data: quote.data }).args[1], 50n);

    // trusted-signer settings and a premine at or above the seed are refused before any RPC
    const fresh = recordingDrift();
    const sdk2 = new ReadWriteFlaunchSDK(CHAIN, fresh);
    await assert.rejects(
      sdk2.prepareAnyGameLaunch({ ...gameLaunch, trustedSignerSettings: { enabled: true } }),
      /Trusted-signer settings are not supported/
    );
    await assert.rejects(
      sdk2.prepareAnyGameLaunch({ ...gameLaunch, premineAmount: FLAUNCH_TOTAL_SUPPLY }),
      /must be below the non-vested seed/
    );
    await assert.rejects(
      sdk2.prepareAnyGameLaunch({ ...gameLaunch, splitReceivers: [{ address: launcher, share: 90_00000n }] }),
      /must total 10000000/
    );
    assert.deepEqual(fresh.interactions, []);
  });
});

test("getGameDeveloperPayout resolves the developer slot through the factory's implementation lookup", async () => {
  await withManagerDeployed(async () => {
    const drift = recordingDrift();
    const sdk = new ReadFlaunchSDK(CHAIN, drift);
    assert.equal(await sdk.getGameDeveloperPayout(CLONE), PAYOUT);
    const reads = drift.interactions.filter((i) => i.kind === "read");
    assert.deepEqual(
      reads.map((r) => [r.address.toLowerCase(), r.fn]),
      [
        [TreasuryManagerFactoryV1_3Address[CHAIN].toLowerCase(), "managerImplementation"],
        [CLONE.toLowerCase(), "gameDeveloperPayout"],
      ]
    );
    assert.deepEqual(reads[0].args, { _manager: CLONE });

    // another manager family (a plain DynamicAddressFeeSplitManager clone, say) → null, no second read
    const other = recordingDrift({ implementation: "0xd37aee3edebf59f149b5d3b29b6ad2239f8a6b00" });
    assert.equal(await new ReadFlaunchSDK(CHAIN, other).getGameDeveloperPayout(CLONE), null);
    assert.equal(other.interactions.filter((i) => i.kind === "read").length, 1);
    assert.equal(await new ReadFlaunchSDK(CHAIN, recordingDrift()).getGameDeveloperPayout(zeroAddress), null);
  });
});

/**
 * Pinned calldata for the golden scenario above (AnyFlaunchZap `flaunch(FlaunchParams,
 * TreasuryManagerParams, address, uint256)` on Base Sepolia). Regenerate deliberately only when
 * the zap ABI or the manager's initializeData layout changes.
 */
const GOLDEN_ANY_GAME_LAUNCH = {
  selector: "0x34813cc3",
  data: 
    "0x34813cc30000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000001f4000000000000000000000000000000000000000000000000000000000ee6b2800000000000000000000000000000000000000000000000000000000000000022000000000000000000000000079fc52701cd4be6f9ba9adc94c207de37e3314eb00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000070a71c800000000000000000000000000000000000000000000000000000000000000380000000000000000000000000000000000000000000000000000000000000000a4172656e6120436f696e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000054152454e41000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c697066733a2f2f6172656e61000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001401d4955e8009e4c0c2adaeae92b8663d3922e786f4be931aee43e5f25cdb9cf0900000000000000000000000054cdcf0b0000000000000000000000000000cafe000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000c025772d4a421392c00dc09aad6e68d98e05f4f9a9f55e436f58a0f9ee165340760000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000016345785d8a00000000000000000000000000006666666666666666666666666666666666666666000000000000000000000000777777777777777777777777777777777777777700000000000000000000000000000000000000000000000000000000713fb3000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000999999999999999999999999999999999999999900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000dead00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000333333333333333333333333333333333333333300000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000dead000000000000000000000000000000000000000000000000000000000007a120000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000005b8d80000000000000000000000000222222222222222222222222222222222222222200000000000000000000000000000000000000000000000000000000003567e00000000000000000000000000000000000000000000000000000000000000000",
};

const DYNAMIC_INITIALIZE_PARAMS = [INITIALIZE_PARAMS[0]];

test("paired route: flaunchPairedTokenWithDynamicSplitManager deploys the v1.3.1 dynamic split manager", async () => {
  const manager = DynamicAddressFeeSplitManagerV1_3Address[base.id];
  const zap = FlaunchZapV1_3Address[base.id];
  const splitReceivers = [
    { address: launcher, share: 60_00000n },
    { address: friend, share: 40_00000n },
  ];
  const launch = {
    flaunchParams: {
      name: "Split Coin",
      symbol: "SPLIT",
      tokenUri: "ipfs://split",
      premineAmount: 0n,
      creator: SIGNER,
      creatorFeeAllocation: 8_000,
      flaunchAt: 0n,
      initialPriceParams: "0x1234",
      feeCalculatorParams: "0x",
      pairedToken: zeroAddress,
    },
    trustedFeeSigner: zeroAddress,
    maxPremineCost: 0n,
    value: 12n,
    creatorShare: 10_00000n,
    managerOwnerShare: 5_00000n,
    moderator: MODERATOR,
    splitReceivers,
  };

  const drift = recordingDrift();
  const hash = await new ReadWriteFlaunchSDK(base.id, drift).flaunchPairedTokenWithDynamicSplitManager(launch);
  assert.equal(hash, TX_HASH);
  const [write] = drift.interactions.filter((i) => i.kind === "write");
  assert.equal(write.fn, "flaunch");
  assert.equal(write.address.toLowerCase(), zap.toLowerCase());
  assert.deepEqual(Object.keys(write.args), [
    "_flaunchParams",
    "_treasuryManagerParams",
    "_trustedFeeSigner",
    "_maxPremineCost",
  ]);
  assert.deepEqual(write.options, { value: 12n });
  assert.equal(write.args._trustedFeeSigner, zeroAddress);
  // the implementation is the v1.3.1 generation: FlaunchZapV1_3 is bound to
  // TreasuryManagerFactoryV1_3Address, which approves only that one
  assert.equal(write.args._treasuryManagerParams.manager, manager);
  assert.equal(write.args._treasuryManagerParams.permissions, zeroAddress, "open by default");
  assert.equal(write.args._treasuryManagerParams.depositData, "0x");
  // byte-identical to the shared encoder
  assert.equal(
    write.args._treasuryManagerParams.initializeData,
    encodeDynamicSplitInitializeData(launch)
  );
  const [params] = decodeAbiParameters(DYNAMIC_INITIALIZE_PARAMS, write.args._treasuryManagerParams.initializeData);
  assert.equal(params.creatorShare, 10_00000n);
  assert.equal(params.ownerShare, 5_00000n);
  assert.equal(params.moderator, getAddress(MODERATOR));
  assert.deepEqual(
    params.recipientShares.map((r) => [r.recipient, r.share]),
    splitReceivers.map((r) => [getAddress(r.address), r.share])
  );

  // permissions accept the enum or an explicit address
  const enumDrift = recordingDrift();
  await new ReadWriteFlaunchSDK(base.id, enumDrift).flaunchPairedTokenWithDynamicSplitManager({
    ...launch,
    permissions: Permissions.CLOSED,
  });
  assert.equal(
    enumDrift.interactions.filter((i) => i.kind === "write")[0].args._treasuryManagerParams.permissions,
    ClosedPermissionsV1_3Address[base.id]
  );
  const addressDrift = recordingDrift();
  await new ReadWriteFlaunchSDK(base.id, addressDrift).flaunchPairedTokenWithDynamicSplitManager({
    ...launch,
    permissions: CLONE,
  });
  assert.equal(
    addressDrift.interactions.filter((i) => i.kind === "write")[0].args._treasuryManagerParams.permissions,
    CLONE
  );

  // the encoder's own checks still apply, and a chain without the manager names itself
  assert.throws(
    () => new ReadWriteFlaunchSDK(base.id, recordingDrift()).flaunchPairedTokenWithDynamicSplitManager({ ...launch, moderator: zeroAddress }),
    /moderator cannot be zero/
  );
  assert.equal(DynamicAddressFeeSplitManagerV1_3Address[unichain.id], undefined);
  assert.throws(
    () => new ReadWriteFlaunchSDK(unichain.id, recordingDrift()).flaunchPairedTokenWithDynamicSplitManager(launch),
    new RegExp(`not available on chain ${unichain.id}`)
  );
});
