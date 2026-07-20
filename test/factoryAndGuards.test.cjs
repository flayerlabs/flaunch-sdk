const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
} = require("viem");
const {
  base,
  baseSepolia,
  mainnet,
  robinhood,
  unichain,
} = require("viem/chains");
const {
  ReadFlaunchSDK,
  ReadWriteFlaunchSDK,
  chainIdToChain,
  createFlaunch,
  createFlaunchCalldata,
  isChainSupported,
} = require("../dist/index.cjs.js");

const WALLET = "0x1111111111111111111111111111111111111111";
const supportedChains = [base, baseSepolia, mainnet, unichain, robinhood];

function noNetworkTransport(requests) {
  return custom({
    async request(request) {
      requests.push(request);
      throw new Error(`Unexpected RPC request: ${request.method}`);
    },
  });
}

test("all supported-chain factories construct without network access", () => {
  for (const chain of supportedChains) {
    const requests = [];
    const publicClient = createPublicClient({
      chain,
      transport: noNetworkTransport(requests),
    });
    const walletClient = createWalletClient({
      account: WALLET,
      chain,
      transport: noNetworkTransport(requests),
    });

    assert.ok(createFlaunch({ publicClient }) instanceof ReadFlaunchSDK);
    assert.ok(
      createFlaunch({ publicClient, walletClient }) instanceof
        ReadWriteFlaunchSDK
    );
    assert.ok(
      createFlaunchCalldata({ publicClient, walletAddress: WALLET }) instanceof
        ReadWriteFlaunchSDK
    );
    assert.equal(requests.length, 0, `constructor made an RPC call on ${chain.id}`);
  }
});

test("isChainSupported accepts exactly the five configured chain IDs", () => {
  assert.deepEqual(
    Object.keys(chainIdToChain).map(Number).sort((a, b) => a - b),
    supportedChains.map(({ id }) => id).sort((a, b) => a - b)
  );

  assert.deepEqual(
    supportedChains.map(({ id }) => [id, isChainSupported(id)]),
    supportedChains.map(({ id }) => [id, true])
  );

  for (const chainId of [0, 10, 999_999]) {
    assert.equal(isChainSupported(chainId), false);
  }
});

test("unsupported factories reject before using their transports", () => {
  const unsupported = defineChain({
    id: 999_999,
    name: "Unsupported",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["https://unsupported.invalid"] } },
  });
  const requests = [];
  const publicClient = createPublicClient({
    chain: unsupported,
    transport: noNetworkTransport(requests),
  });
  const walletClient = createWalletClient({
    account: WALLET,
    chain: unsupported,
    transport: noNetworkTransport(requests),
  });

  assert.throws(
    () => createFlaunch({ publicClient }),
    /Chain 999999 is not supported/
  );
  assert.throws(
    () => createFlaunch({ publicClient, walletClient }),
    /Chain 999999 is not supported/
  );
  assert.throws(
    () => createFlaunchCalldata({ publicClient, walletAddress: WALLET }),
    /Chain 999999 is not supported/
  );
  assert.equal(requests.length, 0);
});

test("multichain write factories reject a wallet configured for another chain", () => {
  const requests = [];
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: noNetworkTransport(requests),
  });
  const walletClient = createWalletClient({
    account: WALLET,
    chain: base,
    transport: noNetworkTransport(requests),
  });

  assert.throws(
    () => createFlaunch({ publicClient, walletClient }),
    /walletClient chain 8453 does not match publicClient chain 1/
  );
  assert.equal(requests.length, 0);
});

test("multichain dynamic split guards run before RPC or IPFS work", () => {
  const requests = [];
  const publicClient = createPublicClient({
    chain: robinhood,
    transport: noNetworkTransport(requests),
  });
  const sdk = createFlaunchCalldata({
    publicClient,
    walletAddress: WALLET,
  });

  assert.throws(
    () => sdk.readPositionManager,
    /readPositionManager is not supported on chain 4663/
  );
  assert.throws(
    () => sdk.readWriteFlaunchZap,
    /readWriteFlaunchZap is not supported on chain 4663/
  );

  assert.throws(
    () => sdk.flaunchWithDynamicSplitManager({}),
    /flaunchWithDynamicSplitManager is not supported on chain 4663/
  );
  assert.throws(
    () => sdk.flaunchIPFSWithDynamicSplitManager({}),
    /flaunchIPFSWithDynamicSplitManager is not supported on chain 4663/
  );
  assert.throws(
    () =>
      sdk.revenueManagerCreatorClaim({
        revenueManagerAddress: WALLET,
      }),
    /revenueManagerCreatorClaim is not supported on chain 4663/
  );
  assert.equal(requests.length, 0);
});
