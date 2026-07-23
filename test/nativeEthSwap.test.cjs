const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPublicClient,
  custom,
  decodeAbiParameters,
  decodeFunctionData,
  zeroAddress,
} = require("viem");
const { robinhood } = require("viem/chains");
const {
  FLETHAddress,
  FlaunchPositionManagerMultichainAddress,
  Permit2Address,
  QuoterAddress,
  ReadFlaunchSDK,
  UniversalRouterAbi,
  UniversalRouterAddress,
  createFlaunchCalldata,
  decodeCallData,
  doesChainSupportMultichainNativeETHSwap,
  doesUniversalRouterUseV4HopPriceLimits,
} = require("../dist/index.cjs.js");

const COIN = "0x7FB6e53a849FCC363dF7b7AF46111B42BD225F42";
const SENDER = "0x1111111111111111111111111111111111111111";
const FLETH_HOOK = "0xEA22Ae03085CAf74Ac3393f9902539fbE9786888";
const QUOTER = "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94";
const ROUTER = "0x8876789976dEcBfCbBbe364623C63652db8C0904";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

const v4ExactInputWithHopPriceLimits = [
  {
    type: "tuple",
    components: [
      { type: "address", name: "currencyIn" },
      {
        type: "tuple[]",
        name: "path",
        components: [
          { type: "address", name: "intermediateCurrency" },
          { type: "uint24", name: "fee" },
          { type: "int24", name: "tickSpacing" },
          { type: "address", name: "hooks" },
          { type: "bytes", name: "hookData" },
        ],
      },
      { type: "uint256[]", name: "minHopPriceX36" },
      { type: "uint128", name: "amountIn" },
      { type: "uint128", name: "amountOutMinimum" },
    ],
  },
];

function noNetworkTransport(requests) {
  return custom({
    async request(request) {
      requests.push(request);
      throw new Error(`Unexpected RPC request: ${request.method}`);
    },
  });
}

test("Robinhood native ETH quotes use the deployed two-hop Flaunch route", async () => {
  const simulations = [];
  const drift = {
    contract({ address }) {
      return {
        address,
        cache: { clear: async () => {} },
        async simulateWrite(fn, args, options) {
          simulations.push({ address, fn, args, options });
          return { amountOut: 123n };
        },
      };
    },
  };
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);

  assert.equal(
    sdk.readPermit2.contract.address.toLowerCase(),
    PERMIT2.toLowerCase()
  );

  const amountOut = await sdk.getBuyQuoteExactInput({
    coinAddress: COIN,
    amountIn: 1_000_000_000_000_000n,
    userWallet: SENDER,
  });

  assert.equal(amountOut, 123n);
  assert.equal(simulations.length, 1);
  assert.equal(simulations[0].address.toLowerCase(), QUOTER.toLowerCase());
  assert.equal(simulations[0].fn, "quoteExactInput");
  assert.deepEqual(simulations[0].args.params.path, [
    {
      fee: 0,
      tickSpacing: 60,
      hookData: "0x",
      hooks: FLETH_HOOK,
      intermediateCurrency: FLETHAddress[robinhood.id],
    },
    {
      fee: 0,
      tickSpacing: 60,
      hooks: FlaunchPositionManagerMultichainAddress[robinhood.id],
      hookData: "0x",
      intermediateCurrency: COIN,
    },
  ]);
  assert.equal(simulations[0].args.params.exactCurrency, zeroAddress);
  assert.deepEqual(simulations[0].options, { from: SENDER });
});

test("only fully configured fresh chains advertise native ETH swaps", () => {
  assert.equal(doesChainSupportMultichainNativeETHSwap(robinhood.id), true);
  assert.equal(doesUniversalRouterUseV4HopPriceLimits(robinhood.id), true);
  assert.equal(doesChainSupportMultichainNativeETHSwap(1), false);
  assert.equal(doesUniversalRouterUseV4HopPriceLimits(1), false);
  assert.equal(doesChainSupportMultichainNativeETHSwap(130), false);
  assert.equal(doesChainSupportMultichainNativeETHSwap(8453), false);
});

test("Robinhood native ETH buys target the deployed Universal Router", async () => {
  const requests = [];
  const publicClient = createPublicClient({
    chain: robinhood,
    transport: noNetworkTransport(requests),
  });
  const sdk = createFlaunchCalldata({
    publicClient,
    walletAddress: SENDER,
  });

  const encodedCall = await sdk.buyCoin({
    coinAddress: COIN,
    swapType: "EXACT_IN",
    amountIn: 1_000_000_000_000_000n,
    amountOutMin: 100n,
    slippagePercent: 0.5,
  });
  const transaction = decodeCallData(encodedCall);
  const routerCall = decodeFunctionData({
    abi: UniversalRouterAbi,
    data: transaction.data,
  });

  assert.equal(transaction.to.toLowerCase(), ROUTER.toLowerCase());
  assert.equal(transaction.value, 1_000_000_000_000_000n);
  assert.equal(routerCall.functionName, "execute");
  assert.equal(routerCall.args[0], "0x1004");

  const [v4Actions, v4Inputs] = decodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    routerCall.args[1][0]
  );
  const [swapParams] = decodeAbiParameters(
    v4ExactInputWithHopPriceLimits,
    v4Inputs[0]
  );
  assert.equal(v4Actions, "0x070c0f");
  assert.deepEqual(swapParams.minHopPriceX36, []);
  assert.equal(swapParams.amountIn, 1_000_000_000_000_000n);
  assert.equal(swapParams.amountOutMinimum, 100n);
  assert.equal(requests.length, 0);
  assert.equal(
    QuoterAddress[robinhood.id].toLowerCase(),
    QUOTER.toLowerCase()
  );
  assert.equal(
    UniversalRouterAddress[robinhood.id].toLowerCase(),
    ROUTER.toLowerCase()
  );
  assert.equal(
    Permit2Address[robinhood.id].toLowerCase(),
    PERMIT2.toLowerCase()
  );
});
