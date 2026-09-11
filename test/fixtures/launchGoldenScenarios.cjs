// Every existing launch entry point, on every chain family, driven through the calldata SDK so
// the result is a plain { to, value, data } plus the fee eth_call(s) that preceded it.
const {
  createPublicClient,
  custom,
  encodeAbiParameters,
  toHex,
  zeroAddress,
} = require("viem");
const { base, baseSepolia, mainnet, robinhood, unichain } = require("viem/chains");
const sdkModule = require("../../dist/index.cjs.js");

const CREATOR = "0x1111111111111111111111111111111111111111";
const RECEIVER_A = "0x2222222222222222222222222222222222222222";
const RECEIVER_B = "0x3333333333333333333333333333333333333333";
const REVENUE_MANAGER = "0x4444444444444444444444444444444444444444";
const PAIRED_TOKEN = "0x5555555555555555555555555555555555555555";
const FEE = 987_654_321n;

const baseParams = {
  name: "Golden Coin",
  symbol: "GOLD",
  tokenUri: "ipfs://golden-coin",
  fairLaunchPercent: 0,
  fairLaunchDuration: 0,
  initialMarketCapUSD: 1234.5,
  creator: CREATOR,
  creatorFeeAllocationPercent: 10,
  flaunchAt: 123n,
};

const chainsByFamily = {
  legacy: [base, baseSepolia],
  multichain: [mainnet, unichain, robinhood],
  paired: [base, baseSepolia, robinhood],
};

const entryPoints = {
  standard: (sdk, premineAmount) => sdk.flaunch({ ...baseParams, premineAmount }),
  revenueManager: (sdk, premineAmount) =>
    sdk.flaunchWithRevenueManager({
      ...baseParams,
      premineAmount,
      revenueManagerInstanceAddress: REVENUE_MANAGER,
    }),
  splitManager: (sdk, premineAmount) =>
    sdk.flaunchWithSplitManager({
      ...baseParams,
      premineAmount,
      creatorSplitPercent: 60,
      managerOwnerSplitPercent: 10,
      splitReceivers: [
        { address: RECEIVER_A, percent: 75 },
        { address: RECEIVER_B, percent: 25 },
      ],
    }),
  dynamicSplitManager: (sdk, premineAmount) =>
    sdk.flaunchWithDynamicSplitManager({
      ...baseParams,
      premineAmount,
      creatorShare: 60_00000n,
      managerOwnerShare: 10_00000n,
      moderator: CREATOR,
      splitReceivers: [
        { address: RECEIVER_A, share: 20_00000n },
        { address: RECEIVER_B, share: 10_00000n },
      ],
    }),
  pairedToken: (sdk, premineAmount) =>
    sdk.flaunchPairedToken({
      flaunchParams: {
        name: baseParams.name,
        symbol: baseParams.symbol,
        tokenUri: baseParams.tokenUri,
        premineAmount,
        creator: CREATOR,
        creatorFeeAllocation: 1000,
        flaunchAt: 123n,
        initialPriceParams: "0x1234",
        feeCalculatorParams: "0x",
        pairedToken: PAIRED_TOKEN,
      },
      trustedFeeSigner: zeroAddress,
      maxPremineCost: 77n,
      value: FEE,
    }),
};

const launchGoldenScenarios = [];
for (const [family, chains] of Object.entries(chainsByFamily)) {
  const methods =
    family === "paired"
      ? ["pairedToken"]
      : ["standard", "revenueManager", "splitManager", "dynamicSplitManager"];
  for (const chain of chains) {
    for (const method of methods) {
      for (const premineAmount of [0n, 42n]) {
        launchGoldenScenarios.push({
          id: `${family}:${chain.id}:${method}:premine=${premineAmount}`,
          chain,
          method,
          premineAmount,
        });
      }
    }
  }
}

function harness(chain) {
  const ethCalls = [];
  let requestCount = 0;
  const publicClient = createPublicClient({
    chain,
    transport: custom({
      async request({ method, params }) {
        requestCount += 1;
        if (method === "eth_chainId") return toHex(chain.id);
        if (method === "eth_call") {
          const tx = params[0];
          ethCalls.push({ to: tx.to.toLowerCase(), data: tx.data });
          return encodeAbiParameters([{ type: "uint256" }], [FEE]);
        }
        throw new Error(`Unexpected RPC request: ${method}`);
      },
    }),
  });
  return {
    ethCalls,
    get requestCount() {
      return requestCount;
    },
    sdk: sdkModule.createFlaunchCalldata({ publicClient, walletAddress: CREATOR }),
  };
}

async function runScenario({ chain, method, premineAmount }) {
  const h = harness(chain);
  const encoded = await entryPoints[method](h.sdk, premineAmount);
  const call = sdkModule.decodeCallData(encoded);
  return {
    ethCalls: h.ethCalls,
    to: call.to.toLowerCase(),
    value: call.value.toString(),
    data: call.data,
  };
}

module.exports = { launchGoldenScenarios, runScenario, CREATOR, FEE };
