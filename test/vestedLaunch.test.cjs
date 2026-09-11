// Vested launches through the AnyFlaunchZap against a recording drift: address coverage, the
// developer-params → zap-struct conversion, overload selection, the exact `flaunch` write and
// value, claims through MemecoinVesting, and decoding a vested launch receipt.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  decodeFunctionData,
  decodeFunctionReturn,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionResult,
  zeroAddress,
} = require("viem");
const { base, baseSepolia, mainnet, robinhood } = require("viem/chains");
const {
  AnyFlaunchZapAbi,
  AnyFlaunchZapAddress,
  AnyFlaunchZapFlaunchAddress,
  AnyFlaunchZapPositionManagerAddress,
  AnyPositionManagerV1_3Abi,
  AnyPositionManagerV1_3Address,
  FLAUNCH_TOTAL_SUPPLY,
  FLETHAddress,
  MemecoinVestingAbi,
  MemecoinVestingAddress,
  PairedTokenRegistryV1_3Address,
  ReadFlaunchSDK,
  ReadWriteFlaunchSDK,
  ReadWriteAnyFlaunchZap,
  ReadWriteMemecoinVesting,
  TreasuryManagerFactoryV1_3Address,
  buildAnyFlaunchZapFlaunchArgs,
  decodeLaunchPreBuyCalldata,
  doesChainSupportVestedLaunch,
  encodeAnyFlaunchZapFlaunch,
  hashVestingSchedules,
  maxVestedSupply,
  toAnyFlaunchZapFlaunchParams,
  toAnyFlaunchZapTreasuryManagerArgs,
  toFlaunchVestedParamsWithRevenueManager,
  toVestingScheduleArgs,
  vestedSupplyOf,
  Permissions,
  WhitelistedPermissionsV1_3Address,
} = require("../dist/index.cjs.js");

const SIGNER = "0x1111111111111111111111111111111111111111";
const TEAM = "0x2222222222222222222222222222222222222222";
const ADVISOR = "0x3333333333333333333333333333333333333333";
const MANAGER = "0x4444444444444444444444444444444444444444";
const PAIRED = "0x5555555555555555555555555555555555555555";
const MEMECOIN = "0x6666666666666666666666666666666666666666";
const TREASURY = "0x7777777777777777777777777777777777777777";
const TX_HASH = `0x${"01".repeat(32)}`;
const POOL_ID = `0x${"ab".repeat(32)}`;
const CHAIN = baseSepolia.id;
const ZAP = AnyFlaunchZapAddress[CHAIN];
const VESTING = MemecoinVestingAddress[CHAIN];
const HOOK = AnyFlaunchZapPositionManagerAddress[CHAIN];
const lower = (a) => a.toLowerCase();

const vestedParams = {
  name: "Vested Coin",
  symbol: "VEST",
  tokenUri: "ipfs://vested-coin",
  initialMarketCapUSD: 4000,
  creator: SIGNER,
  creatorFeeAllocationPercent: 80,
  vestingSchedules: [
    { beneficiary: TEAM, percent: "12.5", cliffDuration: 86_400, vestDuration: 31_536_000 },
    { beneficiary: ADVISOR, amount: 5n * 10n ** 27n, cliffDuration: 0, vestDuration: 7_776_000, start: 1_800_000_000 },
  ],
};

/** A drift recording reads, `call`s (the fee quoted as the caller), simulations and writes. */
function recordingDrift({
  signer = SIGNER,
  fee = { ethRequired: 12n, pairedPremineCost: 34n },
  tokenType = 4,
  schedules = [],
  claimable = [],
  vested = [],
} = {}) {
  const interactions = [];
  const drift = {
    interactions,
    contract({ address }) {
      return {
        address,
        cache: { clear: async () => interactions.push({ kind: "cacheClear", address }) },
        async read(fn, args, options) {
          interactions.push({ kind: "read", address, fn, args, options });
          if (fn === "calculateFee") return { ethRequired_: fee.ethRequired, pairedPremineCost_: fee.pairedPremineCost };
          if (fn === "maxVestedBps") return 5000n;
          if (fn === "tokenConfig") {
            return { approved: true, tokenType, decimals: 6, underlying: zeroAddress, feeEscrow: zeroAddress, priceCalculator: zeroAddress, minDistribute: 0n, bidWallThreshold: 0n };
          }
          if (fn === "schedules") return schedules;
          if (fn === "claimable") return claimable[Number(args._scheduleId)] ?? 0n;
          if (fn === "vestedAmount") return vested[Number(args._scheduleId)] ?? 0n;
          throw new Error(`Unexpected read: ${fn}`);
        },
        async simulateWrite(fn, args, options) {
          interactions.push({ kind: "simulate", address, fn, args, options });
          return { memecoin_: MEMECOIN, ethSpent_: 1n, deployedManager_: MANAGER };
        },
        async write(fn, args, options) {
          interactions.push({ kind: "write", address, fn, args, options });
          return TX_HASH;
        },
      };
    },
    async call(params) {
      interactions.push({ kind: "call", ...params });
      return encodeFunctionResult({
        abi: AnyFlaunchZapAbi,
        functionName: "calculateFee",
        result: [fee.ethRequired, fee.pairedPremineCost],
      });
    },
    async getSignerAddress() {
      return signer;
    },
  };
  return drift;
}

const writes = (drift) => drift.interactions.filter((i) => i.kind === "write");
const reads = (drift, fn) => drift.interactions.filter((i) => i.kind === "read" && i.fn === fn);

test("vested launch addresses and capability cover Base Sepolia only, and stay distinct from the import-generation hook", () => {
  for (const map of [AnyFlaunchZapAddress, MemecoinVestingAddress, AnyFlaunchZapPositionManagerAddress, AnyFlaunchZapFlaunchAddress]) {
    assert.ok(map[CHAIN]);
    assert.equal(Object.keys(map).length, 1);
  }
  assert.equal(lower(ZAP), "0xaa0872bca9c6ecb0cda78528cd89149822bc124d");
  assert.equal(lower(VESTING), "0x3f8004335c113fac0873c061a28670f0aad6a87b");
  assert.equal(lower(HOOK), "0xe753a351fb498051a09dc130fcc29aebc76525dc");
  assert.equal(lower(AnyFlaunchZapFlaunchAddress[CHAIN]), "0xe9ec22d7c245743dc5dc958e5ccd664732ae04b9");
  assert.notEqual(lower(HOOK), lower(AnyPositionManagerV1_3Address[CHAIN]), "the v1.3.3 import hook is a different contract");
  assert.ok(TreasuryManagerFactoryV1_3Address[CHAIN] && PairedTokenRegistryV1_3Address[CHAIN]);
  assert.equal(doesChainSupportVestedLaunch(CHAIN), true);
  for (const chainId of [base.id, robinhood.id, mainnet.id, 999_999]) {
    assert.equal(doesChainSupportVestedLaunch(chainId), false);
  }
  const drift = recordingDrift();
  assert.throws(() => new ReadFlaunchSDK(base.id, drift).readAnyFlaunchZap, /Vested launches are not supported on chain 8453/);
  assert.throws(() => new ReadWriteFlaunchSDK(robinhood.id, drift).readWriteMemecoinVesting, /Vested launches are not supported on chain 4663/);
});

test("developer params convert to the zap struct: exact percent → wei, USDC market cap, 2 dp fee, flETH default", () => {
  const struct = toAnyFlaunchZapFlaunchParams(CHAIN, vestedParams);
  assert.equal(struct.initialMarketCap, 4_000_000_000n);
  assert.equal(struct.creatorFeeAllocation, 8000);
  assert.equal(lower(struct.pairedToken), lower(FLETHAddress[CHAIN]));
  assert.equal(struct.feeCalculatorParams, "0x");
  assert.equal(struct.premineAmount, 0n);
  assert.equal(struct.flaunchAt, 0n);
  assert.deepEqual(struct.vestingSchedules, [
    { beneficiary: TEAM, amount: 125n * 10n ** 26n, start: 0, cliffDuration: 86_400, vestDuration: 31_536_000 },
    { beneficiary: ADVISOR, amount: 5n * 10n ** 27n, start: 1_800_000_000, cliffDuration: 0, vestDuration: 7_776_000 },
  ]);
  assert.equal(struct.vestingSchedules[0].amount, (FLAUNCH_TOTAL_SUPPLY * 1250n) / 10_000n, "12.5% is exact");
  assert.equal(vestedSupplyOf(vestedParams.vestingSchedules), 175n * 10n ** 26n);
  assert.equal(vestedSupplyOf(struct.vestingSchedules), 175n * 10n ** 26n);
  assert.equal(maxVestedSupply(5000n), FLAUNCH_TOTAL_SUPPLY / 2n);

  // explicit knobs pass through
  const explicit = toAnyFlaunchZapFlaunchParams(CHAIN, {
    ...vestedParams,
    pairedToken: zeroAddress,
    feeCalculatorParams: "0x1234",
    premineAmount: 42n,
    flaunchAt: 123n,
    initialMarketCapUSD: 1234.5,
  });
  assert.equal(explicit.pairedToken, zeroAddress);
  assert.equal(explicit.feeCalculatorParams, "0x1234");
  assert.equal(explicit.premineAmount, 42n);
  assert.equal(explicit.flaunchAt, 123n);
  assert.equal(explicit.initialMarketCap, 1_234_500_000n);

  // manager tuple: undefined without a manager, permissions resolved with one
  assert.equal(toAnyFlaunchZapTreasuryManagerArgs(CHAIN, vestedParams), undefined);
  const withManager = toAnyFlaunchZapTreasuryManagerArgs(CHAIN, { treasuryManagerParams: { manager: MANAGER, initializeData: "0xab" } });
  assert.equal(withManager.manager, MANAGER);
  assert.equal(withManager.initializeData, "0xab");
  assert.equal(withManager.depositData, "0x");
  // OPEN permissions are the zero address by convention; WHITELISTED resolves through the v1.3
  // map because the zap is bound to the v1.3.1 factory
  assert.equal(withManager.permissions, zeroAddress);
  const whitelisted = toAnyFlaunchZapTreasuryManagerArgs(CHAIN, {
    treasuryManagerParams: { manager: MANAGER, permissions: Permissions.WHITELISTED },
  });
  assert.equal(lower(whitelisted.permissions), lower(WhitelistedPermissionsV1_3Address[CHAIN]));
  // the revenue-manager adapter keeps the vesting fields
  const adapted = toFlaunchVestedParamsWithRevenueManager({ ...vestedParams, revenueManagerInstanceAddress: MANAGER });
  assert.equal(adapted.treasuryManagerParams.manager, MANAGER);
  assert.equal(adapted.vestingSchedules, vestedParams.vestingSchedules);
});

test("schedule validation rejects what the contracts would revert, before any RPC", () => {
  const schedule = (overrides) => [{ beneficiary: TEAM, percent: 5, cliffDuration: 0, vestDuration: 100, ...overrides }];
  const rejects = (schedules, pattern) => assert.throws(() => toVestingScheduleArgs(schedules), pattern);
  rejects(schedule({ amount: 1n }), /exactly one of amount or percent/);
  rejects(schedule({ percent: undefined }), /exactly one of amount or percent/);
  rejects(schedule({ beneficiary: zeroAddress }), /beneficiary cannot be the zero address/);
  rejects(schedule({ percent: 0 }), /amount must be greater than zero/);
  rejects(schedule({ percent: "0.001" }), /at most two decimal places/);
  rejects(schedule({ percent: undefined, amount: FLAUNCH_TOTAL_SUPPLY + 1n }), /exceeds the total supply/);
  rejects(schedule({ vestDuration: 0 }), /vestDuration must be a positive integer/);
  rejects(schedule({ vestDuration: 1.5 }), /vestDuration must be a positive integer/);
  rejects(schedule({ cliffDuration: 101 }), /cliffDuration cannot exceed vestDuration/);
  rejects(schedule({ cliffDuration: -1 }), /cliffDuration must be a non-negative integer/);
  rejects(schedule({ start: -5 }), /start must be a unix timestamp/);
  rejects(schedule({ start: 2 ** 40 }), /start must be a unix timestamp/);
  assert.deepEqual(toVestingScheduleArgs(schedule({})), [
    { beneficiary: TEAM, amount: 5n * 10n ** 27n, start: 0, cliffDuration: 0, vestDuration: 100 },
  ]);

  assert.throws(() => toAnyFlaunchZapFlaunchParams(CHAIN, { ...vestedParams, vestingSchedules: [] }), /at least one vesting schedule/);
  assert.throws(
    () => toAnyFlaunchZapFlaunchParams(CHAIN, { ...vestedParams, trustedSignerSettings: { enabled: true } }),
    /Trusted-signer settings are not supported on vested launches/
  );
  assert.throws(
    () => toAnyFlaunchZapFlaunchParams(CHAIN, { ...vestedParams, premineAmount: FLAUNCH_TOTAL_SUPPLY - 175n * 10n ** 26n }),
    /must be below the non-vested seed/
  );
  assert.throws(() => toAnyFlaunchZapFlaunchParams(CHAIN, vestedParams, { maxVestedBps: 1000n }), /above the zap's cap/);
  assert.doesNotThrow(() => toAnyFlaunchZapFlaunchParams(CHAIN, vestedParams, { maxVestedBps: 1750 }));
  assert.throws(() => toAnyFlaunchZapFlaunchParams(999_999, vestedParams), /No default paired token/);
});

test("overload selection: manager iff a non-zero manager, _maxPremineCost iff a cap; calldata round-trips", () => {
  const flaunchParams = toAnyFlaunchZapFlaunchParams(CHAIN, vestedParams);
  const manager = { manager: MANAGER, permissions: TEAM, initializeData: "0x", depositData: "0x" };
  const zeroManager = { ...manager, manager: zeroAddress };
  const cases = [
    [{ flaunchParams }, "plain", 2],
    [{ flaunchParams, treasuryManagerParams: zeroManager }, "plain", 2],
    [{ flaunchParams, maxPremineCost: 0n }, "maxPremineCost", 3],
    [{ flaunchParams, treasuryManagerParams: manager }, "manager", 3],
    [{ flaunchParams, treasuryManagerParams: manager, maxPremineCost: 77n }, "managerMaxPremineCost", 4],
  ];
  for (const [input, overload, argc] of cases) {
    const prepared = buildAnyFlaunchZapFlaunchArgs(input);
    assert.equal(prepared.overload, overload);
    assert.equal(prepared.args._trustedFeeSigner, zeroAddress);
    const data = encodeAnyFlaunchZapFlaunch(prepared);
    const decoded = decodeFunctionData({ abi: AnyFlaunchZapAbi, data });
    assert.equal(decoded.functionName, "flaunch");
    assert.equal(decoded.args.length, argc, overload);
    assert.deepEqual(decoded.args[0], flaunchParams);
    const roundTrip = decodeLaunchPreBuyCalldata("anyVested", data);
    assert.equal(roundTrip.zapFamily, "anyVested");
    assert.deepEqual(roundTrip.prepared, prepared);
  }
  const selectors = new Set(cases.map(([input]) => encodeAnyFlaunchZapFlaunch(buildAnyFlaunchZapFlaunchArgs(input)).slice(0, 10)));
  assert.equal(selectors.size, 4, "four distinct overloads");
  assert.equal(hashVestingSchedules(flaunchParams.vestingSchedules).length, 66);
  assert.notEqual(hashVestingSchedules(flaunchParams.vestingSchedules), hashVestingSchedules([]));
});

test("flaunchVested quotes the fee as the signer and writes the plain overload with that value", async () => {
  const drift = recordingDrift({ fee: { ethRequired: 1_000n, pairedPremineCost: 0n } });
  const sdk = new ReadWriteFlaunchSDK(CHAIN, drift);
  assert.equal(await sdk.flaunchVested({ ...vestedParams, slippageBps: 50 }), TX_HASH);
  const flaunchParams = toAnyFlaunchZapFlaunchParams(CHAIN, vestedParams);

  const [quote] = drift.interactions.filter((i) => i.kind === "call");
  assert.equal(lower(quote.to), lower(ZAP));
  assert.equal(quote.from, SIGNER, "the fee exemption is checked against the caller");
  const decodedQuote = decodeFunctionData({ abi: AnyFlaunchZapAbi, data: quote.data });
  assert.equal(decodedQuote.functionName, "calculateFee");
  assert.deepEqual(decodedQuote.args, [flaunchParams, 50n]);
  assert.equal(reads(drift, "tokenConfig").length, 0, "flETH needs no registry read");

  assert.deepEqual(writes(drift), [
    {
      kind: "write",
      address: ZAP,
      fn: "flaunch",
      args: { _flaunchParams: flaunchParams, _trustedFeeSigner: zeroAddress },
      options: { value: 1_000n },
    },
  ]);

  // the read SDK quotes without a signer unless told otherwise
  const readDrift = recordingDrift({ fee: { ethRequired: 7n, pairedPremineCost: 11n } });
  const read = new ReadFlaunchSDK(CHAIN, readDrift);
  assert.deepEqual(await read.calculateVestedFlaunchFee(vestedParams), { ethRequired: 7n, pairedPremineCost: 11n });
  const [feeRead] = reads(readDrift, "calculateFee");
  assert.deepEqual(feeRead.args, { _flaunchParams: flaunchParams, _slippage: 0n });
  assert.deepEqual(await read.calculateVestedFlaunchFee(vestedParams, 25, { from: TEAM }), { ethRequired: 7n, pairedPremineCost: 11n });
  const [asTeam] = readDrift.interactions.filter((i) => i.kind === "call");
  assert.equal(asTeam.from, TEAM);
  assert.equal(await read.getMaxVestedBps(), 5000n);
});

test("manager variants select the manager overload and keep the vesting schedules", async () => {
  const drift = recordingDrift({ fee: { ethRequired: 5n, pairedPremineCost: 0n } });
  const sdk = new ReadWriteFlaunchSDK(CHAIN, drift);
  await sdk.flaunchVestedWithRevenueManager({ ...vestedParams, revenueManagerInstanceAddress: MANAGER });
  await sdk.flaunchVestedWithSplitManager({
    ...vestedParams,
    creatorSplitPercent: 60,
    managerOwnerSplitPercent: 10,
    splitReceivers: [{ address: TEAM, percent: 100 }],
  });
  await sdk.flaunchVestedWithDynamicSplitManager({
    ...vestedParams,
    creatorShare: 60_00000n,
    managerOwnerShare: 10_00000n,
    moderator: SIGNER,
    splitReceivers: [{ address: TEAM, share: 30_00000n }],
  });
  const all = writes(drift);
  assert.equal(all.length, 3);
  for (const write of all) {
    assert.deepEqual(Object.keys(write.args), ["_flaunchParams", "_treasuryManagerParams", "_trustedFeeSigner"]);
    assert.equal(write.args._flaunchParams.vestingSchedules.length, 2);
    assert.deepEqual(write.options, { value: 5n });
  }
  assert.equal(all[0].args._treasuryManagerParams.manager, MANAGER);
  assert.equal(all[0].args._treasuryManagerParams.initializeData, "0x");
  assert.notEqual(all[1].args._treasuryManagerParams.initializeData, "0x");
  assert.notEqual(all[2].args._treasuryManagerParams.initializeData, "0x");
  assert.notEqual(all[1].args._treasuryManagerParams.manager, all[2].args._treasuryManagerParams.manager);
});

test("an ERC20 pairing with a premine needs maxPremineCost; with one, the cap overload is used", async () => {
  const drift = recordingDrift({ tokenType: 4 });
  const sdk = new ReadWriteFlaunchSDK(CHAIN, drift);
  await assert.rejects(
    sdk.flaunchVested({ ...vestedParams, pairedToken: PAIRED, premineAmount: 42n }),
    /needs maxPremineCost.*Erc20PremineRequiresMaxCost/
  );
  assert.equal(writes(drift).length, 0);
  const [config] = reads(drift, "tokenConfig");
  assert.equal(lower(config.address), lower(PairedTokenRegistryV1_3Address[CHAIN]));
  assert.deepEqual(config.args, { _token: PAIRED });

  drift.interactions.length = 0;
  await sdk.flaunchVested({ ...vestedParams, pairedToken: PAIRED, premineAmount: 42n, maxPremineCost: 77n });
  const [write] = writes(drift);
  assert.deepEqual(Object.keys(write.args), ["_flaunchParams", "_trustedFeeSigner", "_maxPremineCost"]);
  assert.equal(write.args._maxPremineCost, 77n);
  assert.equal(write.args._flaunchParams.pairedToken, PAIRED);
  assert.deepEqual(write.options, { value: 12n }, "the fee only; the premine is pulled in the ERC20");
  assert.equal(reads(drift, "tokenConfig").length, 0, "no registry read once a cap is given");

  // a native wrapper pairing with a premine is ETH-funded: no cap needed
  const wrapper = recordingDrift({ tokenType: 1 });
  await new ReadWriteFlaunchSDK(CHAIN, wrapper).flaunchVested({ ...vestedParams, pairedToken: PAIRED, premineAmount: 42n });
  assert.equal(writes(wrapper)[0].overload, undefined);
  assert.deepEqual(Object.keys(writes(wrapper)[0].args), ["_flaunchParams", "_trustedFeeSigner"]);
  // the zap client itself: prepared args go out as given, deployAndInitializeManager is a plain write
  const zap = new ReadWriteAnyFlaunchZap(ZAP, wrapper);
  const simulated = await zap.simulateFlaunch(
    buildAnyFlaunchZapFlaunchArgs({ flaunchParams: toAnyFlaunchZapFlaunchParams(CHAIN, vestedParams), treasuryManagerParams: { manager: MANAGER, permissions: TEAM, initializeData: "0x", depositData: "0x" } }),
    { from: SIGNER, value: 9n }
  );
  assert.deepEqual(simulated, { memecoin: MEMECOIN, ethSpent: 1n, deployedManager: MANAGER });
  await zap.deployAndInitializeManager({ managerImplementation: MANAGER, owner: SIGNER, data: "0x", permissions: TEAM });
  const last = writes(wrapper).at(-1);
  assert.equal(last.fn, "deployAndInitializeManager");
  assert.deepEqual(last.args, { _managerImplementation: MANAGER, _owner: SIGNER, _data: "0x", _permissions: TEAM });
});

test("vesting reads and claims: position totals, claimAll picks claimable ids, nothing to claim throws", async () => {
  const schedules = [
    { total: 100n, claimed: 10n, start: 1_700_000_000, cliffDuration: 100, vestDuration: 1_000, kind: 0 },
    { total: 50n, claimed: 50n, start: 1_700_000_000, cliffDuration: 0, vestDuration: 10, kind: 0 },
    { total: 80n, claimed: 0n, start: 1_700_000_500, cliffDuration: 5, vestDuration: 50, kind: 0 },
  ];
  const drift = recordingDrift({ schedules, claimable: [30n, 0n, 8n], vested: [40n, 50n, 8n] });
  const read = new ReadFlaunchSDK(CHAIN, drift);
  assert.deepEqual(await read.getVestingSchedules(MEMECOIN, TEAM), schedules);
  const position = await read.getVestingPosition(MEMECOIN, TEAM);
  assert.equal(position.token, MEMECOIN);
  assert.equal(position.beneficiary, TEAM);
  assert.deepEqual(position.schedules.map((s) => [s.scheduleId, s.cliffAt, s.endsAt, s.vested, s.claimable]), [
    [0n, 1_700_000_100, 1_700_001_000, 40n, 30n],
    [1n, 1_700_000_000, 1_700_000_010, 50n, 0n],
    [2n, 1_700_000_505, 1_700_000_550, 8n, 8n],
  ]);
  assert.deepEqual([position.total, position.claimed, position.vested, position.claimable], [230n, 60n, 98n, 38n]);
  for (const r of [...reads(drift, "schedules"), ...reads(drift, "claimable"), ...reads(drift, "vestedAmount")]) {
    assert.equal(lower(r.address), lower(VESTING));
  }

  const write = new ReadWriteFlaunchSDK(CHAIN, recordingDrift({ schedules, claimable: [30n, 0n, 8n], vested: [40n, 50n, 8n] }));
  assert.equal(await write.claimVesting(MEMECOIN), TX_HASH);
  const [claim] = writes(write.drift);
  assert.equal(lower(claim.address), lower(VESTING));
  assert.deepEqual(claim.args, { _token: MEMECOIN, _scheduleIds: [0n, 2n] });
  const [schedulesRead] = reads(write.drift, "schedules");
  assert.deepEqual(schedulesRead.args, { _token: MEMECOIN, _beneficiary: SIGNER }, "claimAll uses the signer as beneficiary");

  assert.equal(await write.claimVesting(MEMECOIN, [1n]), TX_HASH);
  assert.deepEqual(writes(write.drift).at(-1).args, { _token: MEMECOIN, _scheduleIds: [1n] });
  assert.throws(() => write.claimVesting(MEMECOIN, []), /At least one vesting schedule id/);

  const empty = new ReadWriteMemecoinVesting(VESTING, recordingDrift({ schedules: [] }));
  await assert.rejects(empty.claimAll(MEMECOIN), /has no vesting schedules/);
  const nothingYet = new ReadWriteMemecoinVesting(VESTING, recordingDrift({ schedules: [schedules[0]], claimable: [0n], vested: [0n] }));
  await assert.rejects(nothingYet.claimAll(MEMECOIN), /nothing claimable/);
});

function eventLog(abi, address, eventName, indexed, values) {
  const event = abi.find((e) => e.type === "event" && e.name === eventName);
  return {
    address,
    topics: encodeEventTopics({ abi, eventName, args: indexed }),
    data: encodeAbiParameters(event.inputs.filter((i) => !i.indexed), values),
  };
}

test("getVestedLaunchFromLogs decodes PoolCreated + MemecoinFlaunched + ScheduleCreated (+ PoolScheduled) from one receipt", () => {
  const hookParams = {
    memecoin: MEMECOIN,
    creator: ZAP, // the hook names the zap when a manager is wired
    creatorFeeAllocation: 8000,
    initialPriceParams: "0x1234",
    feeCalculatorParams: "0x",
    pairedToken: FLETHAddress[CHAIN],
  };
  const poolCreated = eventLog(AnyPositionManagerV1_3Abi, HOOK, "PoolCreated", { _poolId: POOL_ID }, [MEMECOIN, TREASURY, 9n, true, hookParams]);
  const scheduled = eventLog(AnyPositionManagerV1_3Abi, HOOK, "PoolScheduled", { _poolId: POOL_ID }, [1_900_000_000n]);
  const flaunched = eventLog(AnyFlaunchZapAbi, ZAP, "MemecoinFlaunched", { _memecoin: MEMECOIN, _creator: SIGNER }, [825n * 10n ** 26n, 175n * 10n ** 26n, 2n, MANAGER]);
  const schedule0 = eventLog(MemecoinVestingAbi, VESTING, "ScheduleCreated", { _token: MEMECOIN, _beneficiary: TEAM }, [0n, 125n * 10n ** 26n, 1_900_000_000, 86_400, 31_536_000]);
  const schedule1 = eventLog(MemecoinVestingAbi, VESTING, "ScheduleCreated", { _token: MEMECOIN, _beneficiary: ADVISOR }, [0n, 5n * 10n ** 27n, 1_800_000_000, 0, 7_776_000]);
  const otherCoin = eventLog(MemecoinVestingAbi, VESTING, "ScheduleCreated", { _token: TEAM, _beneficiary: ADVISOR }, [3n, 1n, 0, 0, 1]);
  const wrongEmitter = { ...poolCreated, address: AnyPositionManagerV1_3Address[CHAIN] };
  const logs = [wrongEmitter, { ...poolCreated, topics: [], data: "0x" }, flaunched, schedule0, poolCreated, otherCoin, scheduled, schedule1];

  const sdk = new ReadFlaunchSDK(CHAIN, recordingDrift());
  const created = sdk.getPoolCreatedFromLogs(logs);
  assert.deepEqual(created, {
    poolId: POOL_ID,
    memecoin: MEMECOIN,
    memecoinTreasury: TREASURY,
    tokenId: 9n,
    currencyFlipped: true,
    flaunchFee: 0n,
    params: {
      name: "",
      symbol: "",
      tokenUri: "",
      initialTokenFairLaunch: 0n,
      premineAmount: 0n,
      creator: SIGNER, // the end creator from MemecoinFlaunched, not the zap
      creatorFeeAllocation: 8000,
      flaunchAt: 0n,
      initialPriceParams: "0x1234",
      feeCalculatorParams: "0x",
      pairedToken: FLETHAddress[CHAIN],
    },
  });

  const launch = sdk.getVestedLaunchFromLogs(logs);
  assert.deepEqual(launch, {
    ...created,
    params: { ...created.params, flaunchAt: 1_900_000_000n },
    flaunchesAt: 1_900_000_000n,
    vesting: {
      seedAmount: 825n * 10n ** 26n,
      totalVested: 175n * 10n ** 26n,
      scheduleCount: 2n,
      treasuryManager: MANAGER,
      creator: SIGNER,
      schedules: [
        { beneficiary: TEAM, scheduleId: 0n, amount: 125n * 10n ** 26n, start: 1_900_000_000, cliffDuration: 86_400, vestDuration: 31_536_000 },
        { beneficiary: ADVISOR, scheduleId: 0n, amount: 5n * 10n ** 27n, start: 1_800_000_000, cliffDuration: 0, vestDuration: 7_776_000 },
      ],
    },
  });

  // without the hook's PoolCreated or the zap's MemecoinFlaunched there is no vested launch
  assert.equal(sdk.getVestedLaunchFromLogs([wrongEmitter, flaunched, schedule0]), null);
  assert.equal(sdk.getVestedLaunchFromLogs([poolCreated, schedule0]), null);
  assert.equal(sdk.getPoolCreatedFromLogs([wrongEmitter]), null);
  // the hook's raw creator is kept when the receipt holds no MemecoinFlaunched
  assert.equal(sdk.getPoolCreatedFromLogs([poolCreated]).params.creator, ZAP);
  // other chains never treat these logs as a launch
  assert.equal(new ReadFlaunchSDK(base.id, recordingDrift()).getVestedLaunchFromLogs(logs), null);
});
