const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPublicClient,
  custom,
  encodeAbiParameters,
  toHex,
} = require("viem");
const { base } = require("viem/chains");
const {
  createFlaunchCalldata,
  decodeCallData,
} = require("../dist/index.cjs.js");

const BASE_ZAP = "0x39112541720078c70164EA4Deb61F0A4811910F9";
const BASE_FLAUNCH_SELECTOR = "0x9e5ffc24";
const CREATOR = "0x1111111111111111111111111111111111111111";

test("Base standard launch keeps its existing Zap target and selector", async () => {
  const ethCalls = [];
  const publicClient = createPublicClient({
    chain: base,
    transport: custom({
      async request({ method, params }) {
        if (method === "eth_chainId") return toHex(base.id);
        if (method === "eth_call") {
          ethCalls.push(params[0]);
          return encodeAbiParameters([{ type: "uint256" }], [123n]);
        }
        throw new Error(`Unexpected RPC request: ${method}`);
      },
    }),
  });
  const sdk = createFlaunchCalldata({
    publicClient,
    walletAddress: CREATOR,
  });

  const encodedCall = await sdk.flaunch({
    name: "Base Fixture",
    symbol: "BASE",
    tokenUri: "ipfs://base-fixture",
    fairLaunchPercent: 0,
    fairLaunchDuration: 0,
    initialMarketCapUSD: 1000,
    creator: CREATOR,
    creatorFeeAllocationPercent: 10,
    premineAmount: 0n,
    flaunchAt: 0n,
  });
  const transaction = decodeCallData(encodedCall);

  assert.equal(ethCalls.length, 1);
  assert.equal(ethCalls[0].to.toLowerCase(), BASE_ZAP.toLowerCase());
  assert.equal(transaction.to.toLowerCase(), BASE_ZAP.toLowerCase());
  assert.equal(transaction.value, 123n);
  assert.equal(transaction.data.slice(0, 10), BASE_FLAUNCH_SELECTOR);
});
