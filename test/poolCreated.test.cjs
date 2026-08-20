const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPublicClient,
  custom,
  encodeAbiParameters,
  encodeEventTopics,
} = require("viem");
const { mainnet } = require("viem/chains");
const {
  FeeEscrowAddress,
  FlaunchPositionManagerAbi,
  FlaunchPositionManagerMultichainAddress,
  ReadFlaunchSDK,
  ReadWriteFlaunchSDK,
  createFlaunch,
} = require("../dist/index.cjs.js");

const TX_HASH = `0x${"01".repeat(32)}`;
const POOL_ID = `0x${"ab".repeat(32)}`;
const MEMECOIN = "0x1111111111111111111111111111111111111111";
const TREASURY = "0x2222222222222222222222222222222222222222";
const CREATOR = "0x3333333333333333333333333333333333333333";
const RECIPIENT = "0x4444444444444444444444444444444444444444";
const WRONG_EMITTER = "0x9999999999999999999999999999999999999999";

const eventParams = {
  name: "Multichain Coin",
  symbol: "MULTI",
  tokenUri: "ipfs://multichain-coin",
  premineAmount: 42n,
  creator: CREATOR,
  creatorFeeAllocation: 1500,
  flaunchAt: 123n,
  initialPriceParams: "0x1234",
  feeCalculatorParams: "0x",
};

function poolCreatedLog(address, memecoin) {
  const event = FlaunchPositionManagerAbi.find(
    ({ type, name }) => type === "event" && name === "PoolCreated"
  );

  return {
    address,
    topics: encodeEventTopics({
      abi: FlaunchPositionManagerAbi,
      eventName: "PoolCreated",
      args: { _poolId: POOL_ID },
    }),
    data: encodeAbiParameters(
      event.inputs.filter(({ indexed }) => !indexed),
      [memecoin, TREASURY, 7n, false, 99n, eventParams]
    ),
  };
}

test("multichain PoolCreated decoding ignores other emitters and preserves SDK shape", async () => {
  let transportCalls = 0;
  const baseClient = createPublicClient({
    chain: mainnet,
    transport: custom({
      async request({ method }) {
        transportCalls += 1;
        throw new Error(`Unexpected RPC request: ${method}`);
      },
    }),
  });
  const publicClient = {
    ...baseClient,
    async getTransactionReceipt() {
      return {
        logs: [
          poolCreatedLog(WRONG_EMITTER, WRONG_EMITTER),
          poolCreatedLog(
            FlaunchPositionManagerMultichainAddress[mainnet.id],
            MEMECOIN
          ),
        ],
      };
    },
  };
  const sdk = createFlaunch({ publicClient });

  assert.deepEqual(await sdk.getPoolCreatedFromTx(TX_HASH), {
    poolId: POOL_ID,
    memecoin: MEMECOIN,
    memecoinTreasury: TREASURY,
    tokenId: 7n,
    currencyFlipped: false,
    flaunchFee: 99n,
    params: {
      name: "Multichain Coin",
      symbol: "MULTI",
      tokenUri: "ipfs://multichain-coin",
      initialTokenFairLaunch: 0n,
      premineAmount: 42n,
      creator: CREATOR,
      creatorFeeAllocation: 1500,
      flaunchAt: 123n,
      initialPriceParams: "0x1234",
      feeCalculatorParams: "0x",
    },
  });
  assert.equal(transportCalls, 0);
});

test("multichain creator fee reads and withdrawals use FeeEscrow", async () => {
  const interactions = [];
  const drift = {
    contract({ address }) {
      return {
        address,
        cache: { clear: async () => {} },
        read(fn, args) {
          interactions.push({ kind: "read", address, fn, args });
          return 321n;
        },
        write(fn, args) {
          interactions.push({ kind: "write", address, fn, args });
          return TX_HASH;
        },
      };
    },
    async getSignerAddress() {
      return CREATOR;
    },
  };

  const readSdk = new ReadFlaunchSDK(mainnet.id, drift);
  assert.equal(await readSdk.creatorRevenue(CREATOR), 321n);

  const readWriteSdk = new ReadWriteFlaunchSDK(mainnet.id, drift);
  assert.equal(
    await readWriteSdk.withdrawCreatorRevenue({ recipient: RECIPIENT }),
    TX_HASH
  );

  assert.deepEqual(interactions, [
    {
      kind: "read",
      address: FeeEscrowAddress[mainnet.id],
      fn: "balances",
      args: { _recipient: CREATOR },
    },
    {
      kind: "write",
      address: FeeEscrowAddress[mainnet.id],
      fn: "withdrawFees",
      args: { _recipient: RECIPIENT, _unwrap: true },
    },
  ]);
});
