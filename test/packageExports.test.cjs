const test = require("node:test");
const assert = require("node:assert/strict");

const packageExports = [
  ["@flaunch/sdk", "FlaunchSDK"],
  ["@flaunch/sdk/abi", "FlaunchZapV1_3Abi"],
  ["@flaunch/sdk/abi", "PoolSwapV1_3Abi"],
  ["@flaunch/sdk/addresses", "PoolSwapV1_3Address"],
  ["@flaunch/sdk/helpers", "doesChainSupportPairedTokenSwap"],
  ["@flaunch/sdk/utils", "sqrtPriceLimitFromSlippage"],
  [
    "@flaunch/sdk/addresses",
    "PairedTokenPositionManagerV1_3Address",
  ],
  [
    "@flaunch/sdk/helpers",
    "doesChainSupportPairedTokenLaunch",
  ],
  ["@flaunch/sdk/hooks", "usePoolCreatedEvents"],
  ["@flaunch/sdk/utils", "getPoolId"],
];

test("published package exports resolve through CommonJS and ESM", async () => {
  for (const [specifier, exportName] of packageExports) {
    const commonJsModule = require(specifier);
    const esmModule = await import(specifier);

    assert.ok(exportName in commonJsModule, `${specifier} CJS export`);
    assert.ok(exportName in esmModule, `${specifier} ESM export`);
  }
});
