const test = require("node:test");
const assert = require("node:assert/strict");
const { getAddress } = require("viem");
const { arbitrum, base, baseSepolia, mainnet, robinhood } = require("viem/chains");
const sdk = require("../dist/index.cjs.js");

// flaunch-contracts deployments/v1.6.0.md (LIVE 2026-10-21, PRs #323 / #326)
const PM = "0x54bEDD41AfDf57722518cF6Dd826a70d81e9a5DC";
const ANY_PM = "0x0a68F68D0C5C4c7c32BCDF0a64670D8cEe5565DC";
const PER_CHAIN = {
  [mainnet.id]: ["0x1B8065a099AdcD7aa7c5e241e3596B56ec98bA5a", "0x5cf92e050347d9E6C8EdB36A1ccd49555696b9a8", "0x37C71d412eeB80dce4eB098F2F93F8270911C2D8", "0x8D4C4c90679Cb7025d1bD54599121a37Daf62586"],
  [base.id]: ["0x19Ce29668201Ef002b59BC3f623352512dCab8E0", "0x6E62D5F4d107D463889448F64407b421149F4255", "0x07d077b37223882472AC6C88D187b860250dDB8d", "0xf6b82110063fE258b615B2C347744070ade7119e"],
  [arbitrum.id]: ["0x093238E0DdECAdFf1F30Cb98362d94fc1A44C33F", "0x5c51953b01958586e7c61F28102B7faD95604d60", "0x0E3ACf44D030Cc632Fa006b56778E009bC9564d8", "0x2154c604df568A5285284D1c4918DC98C39240df"],
  [robinhood.id]: ["0x4743F5E148B9d4BF2968218abc09E94Ff53e8425", "0x01E10423e3d3790aa83F1604B8d6082063a5351A", "0xB03Be6c735ef90189D6a22bBC8F6A45a33348fDe", "0xa6184C5Cc5D0c3e1C10B9D5361f3Df5D2aCaEF59"],
  [baseSepolia.id]: ["0x29b37dfe763a3Bb4CaCf0f98F537844Be72A6BB8", "0x41Bc355AE6D9A5AC57B088356f4206be408E48E1", "0x479B750A524D3cA9Fdd6974EE54222235fCFbFf8", "0x8B492E78017E601A21d60265488D9b70F9502F9A"],
};

test("v1.6.0 maps match the deployment record on all five chains", () => {
  for (const [chainId, [flaunch, anyFlaunch, zap, dispatcher]] of Object.entries(PER_CHAIN)) {
    assert.equal(getAddress(sdk.FlaunchPositionManagerV1_6Address[chainId]), PM);
    assert.equal(getAddress(sdk.AnyPositionManagerV1_6Address[chainId]), ANY_PM);
    assert.equal(getAddress(sdk.FlaunchV1_6Address[chainId]), getAddress(flaunch));
    assert.equal(getAddress(sdk.AnyFlaunchV1_6Address[chainId]), getAddress(anyFlaunch));
    assert.equal(getAddress(sdk.FlaunchZapV1_6Address[chainId]), getAddress(zap));
    assert.equal(getAddress(sdk.FeeCalculatorDispatcherV1_6Address[chainId]), getAddress(dispatcher));
  }
});

test("v1.6.0 is the paired-token launch default; the v1.3 / v1.4 hooks stay the version anchors", () => {
  for (const chainId of Object.keys(PER_CHAIN)) {
    // launch maps: the v1.6.0 zap and PositionManager
    assert.equal(getAddress(sdk.FlaunchZapV1_3Address[chainId]), getAddress(PER_CHAIN[chainId][2]));
    assert.equal(getAddress(sdk.PairedTokenPositionManagerV1_3Address[chainId]), PM);
    assert.equal(sdk.zapAddressForRoute(Number(chainId), "pairedToken"), sdk.FlaunchZapV1_3Address[chainId]);
    assert.notEqual(getAddress(sdk.FlaunchZapSupersededV1_3Address[chainId]), getAddress(PER_CHAIN[chainId][2]));
    // version-routing anchors stay on the previous generation (their pools never migrate)
    const previous = sdk.FlaunchPositionManagerV1_3Address[chainId];
    assert.notEqual(getAddress(previous), PM);
    assert.notEqual(getAddress(sdk.AnyPositionManagerV1_3Address[chainId]), ANY_PM);
    // the previous launch hook is superseded for launches, the v1.6.0 hooks never are
    const superseded = (sdk.SupersededPositionManagerV1_3Address[chainId] ?? []).map((a) => getAddress(a));
    assert.ok(superseded.includes(getAddress(previous)), `${chainId} superseded ${superseded}`);
    assert.ok(!superseded.includes(PM) && !superseded.includes(ANY_PM));
    // probe order: the launch hook first, every generation present once
    const hooks = sdk.getV1_3PositionManagers(Number(chainId)).map((a) => getAddress(a));
    assert.equal(hooks[0], PM);
    for (const hook of [ANY_PM, getAddress(previous), getAddress(sdk.AnyPositionManagerV1_3Address[chainId])]) {
      assert.ok(hooks.includes(hook), `${chainId} missing ${hook}`);
    }
    assert.equal(new Set(hooks).size, hooks.length, `${chainId} duplicates in ${hooks}`);
  }
});

test("Base resolves a coin on the v1.6.0 hook as V1_3 without changing the v1.3.1 read sequence", async () => {
  const V13_COIN = "0x1111111111111111111111111111111111111111";
  const V16_COIN = "0x2222222222222222222222222222222222222222";
  const V131_PM = getAddress(sdk.FlaunchPositionManagerV1_3Address[base.id]);
  const lower = (a) => a.toLowerCase();
  const reads = [];
  const drift = {
    contract({ address }) {
      return {
        address,
        cache: { clear: async () => {} },
        async read(fn, args) {
          reads.push({ address: lower(address), fn });
          // every version client's isValidCoin is a poolKey read (tickSpacing != 0)
          if (fn === "poolKey") {
            const known =
              (lower(address) === lower(V131_PM) && lower(args._token) === V13_COIN) ||
              (lower(address) === lower(PM) && lower(args._token) === V16_COIN);
            return { currency0: "0x0000000000000000000000000000000000000000", currency1: args._token, fee: 0, tickSpacing: known ? 60 : 0, hooks: address };
          }
          throw new Error(`unexpected read ${fn} on ${address}`);
        },
      };
    },
  };
  const client = new sdk.ReadFlaunchSDK(base.id, drift);
  // a v1.3.1 coin: answered by the V1_3 client's first probe; the v1.6.0 hook is never asked
  assert.equal(await client.getCoinVersion(V13_COIN), sdk.FlaunchVersion.V1_3);
  assert.equal(getAddress(await client.getPositionManagerAddressForCoin(V13_COIN)), V131_PM);
  assert.ok(reads.length > 0);
  assert.ok(reads.every((r) => r.fn === "poolKey" && r.address === lower(V131_PM)), JSON.stringify(reads));
  reads.length = 0;
  // a v1.6.0 coin: every version client says no, then the paired-pool locator finds the hook
  assert.equal(await client.getCoinVersion(V16_COIN), sdk.FlaunchVersion.V1_3);
  assert.equal(getAddress(await client.getPositionManagerAddressForCoin(V16_COIN)), PM);
  assert.ok(reads.some((r) => r.fn === "poolKey" && r.address === lower(PM)));
  assert.equal(await client.isValidCoin(V16_COIN), true);
  // version-based reads build the key on the located hook, not the V1_3 default client
  assert.equal(
    await client.poolId(V16_COIN),
    sdk.getPoolId({ currency0: "0x0000000000000000000000000000000000000000", currency1: V16_COIN, fee: 0, tickSpacing: 60, hooks: PM })
  );
});

test("v1.6.0 hooks swap through the chain's current protected PoolSwap", () => {
  for (const chainId of Object.keys(PER_CHAIN)) {
    for (const hook of [PM, ANY_PM]) {
      assert.equal(sdk.poolSwapForHook(Number(chainId), hook), sdk.PoolSwapV1_3Address[chainId]);
    }
  }
});
