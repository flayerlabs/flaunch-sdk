const test = require("node:test");
const assert = require("node:assert/strict");

const packageExports = [
  ["@flaunch/sdk", "PairedSwapUnsupportedRouterError"],
  ["@flaunch/sdk", "PairedSwapSlippageExceededError"],
  ["@flaunch/sdk", "PairedSwapPartialFillError"],
  ["@flaunch/sdk/abi", "PoolSwapExactInputAbi"],
  ["@flaunch/sdk/abi", "PoolSwapExactInputEventAbi"],
  ["@flaunch/sdk", "FlaunchSDK"],
  ["@flaunch/sdk/abi", "FlaunchZapV1_3Abi"],
  ["@flaunch/sdk/abi", "PoolSwapV1_3Abi"],
  ["@flaunch/sdk/addresses", "PoolSwapV1_3Address"],
  ["@flaunch/sdk/helpers", "doesChainSupportPairedTokenSwap"],
  ["@flaunch/sdk/utils", "sqrtPriceLimitFromSlippage"],
  ["@flaunch/sdk/addresses", "PairedTokenPositionManagerV1_3Address"],
  ["@flaunch/sdk/helpers", "doesChainSupportPairedTokenLaunch"],
  ["@flaunch/sdk/hooks", "usePoolCreatedEvents"],
  ["@flaunch/sdk/utils", "getPoolId"],
  ["@flaunch/sdk", "getLaunchPreBuyCapabilities"],
  ["@flaunch/sdk", "preBuyAmountFromBps"],
  ["@flaunch/sdk", "percentToBps"],
  ["@flaunch/sdk", "classifyLaunchPreBuyInput"],
  ["@flaunch/sdk", "computeLaunchPreBuyBinding"],
  ["@flaunch/sdk", "decodeLaunchPreBuyCalldata"],
  ["@flaunch/sdk", "DEFAULT_MAX_PRE_BUY_BPS"],
  ["@flaunch/sdk", "LAUNCH_PRE_BUY_REASON_CODES"],
  ["@flaunch/sdk", "LaunchPreBuyRequoteRequiredError"],
  ["@flaunch/sdk", "LaunchPreBuyUnsupportedError"],
  ["@flaunch/sdk", "LaunchPreBuyInsufficientBalanceError"],
  ["@flaunch/sdk", "buildBaseFlaunchArgs"],
  ["@flaunch/sdk", "buildMultichainFlaunchArgs"],
  ["@flaunch/sdk", "ReadFlaunchZapMultichain"],
  ["@flaunch/sdk/helpers", "doesChainSupportLaunchPreBuy"],
];

test("published package exports resolve through CommonJS and ESM", async () => {
  for (const [specifier, exportName] of packageExports) {
    const commonJsModule = require(specifier);
    const esmModule = await import(specifier);

    assert.ok(exportName in commonJsModule, `${specifier} CJS export`);
    assert.ok(exportName in esmModule, `${specifier} ESM export`);
  }
});
