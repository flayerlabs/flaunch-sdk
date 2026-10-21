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

test("v1.6.0 is additive: defaults stay on the v1.3 / v1.4 generation", () => {
  for (const chainId of Object.keys(PER_CHAIN)) {
    for (const map of [sdk.FlaunchPositionManagerV1_3Address, sdk.PairedTokenPositionManagerV1_3Address, sdk.AnyPositionManagerV1_3Address]) {
      assert.notEqual(getAddress(map[chainId]), PM);
      assert.notEqual(getAddress(map[chainId]), ANY_PM);
    }
    assert.notEqual(getAddress(sdk.FlaunchZapV1_3Address[chainId]), getAddress(PER_CHAIN[chainId][2]));
    // listed last, after every older hook, and never superseded
    const hooks = sdk.getV1_3PositionManagers(Number(chainId)).map((a) => getAddress(a));
    assert.deepEqual(hooks.slice(-2), [PM, ANY_PM]);
    assert.ok(!(sdk.SupersededPositionManagerV1_3Address[chainId] ?? []).map((a) => getAddress(a)).includes(PM));
  }
});

test("v1.6.0 hooks swap through the chain's current protected PoolSwap", () => {
  for (const chainId of Object.keys(PER_CHAIN)) {
    for (const hook of [PM, ANY_PM]) {
      assert.equal(sdk.poolSwapForHook(Number(chainId), hook), sdk.PoolSwapV1_3Address[chainId]);
    }
  }
});
