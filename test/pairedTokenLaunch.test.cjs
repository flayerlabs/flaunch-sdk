const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeFunctionReturn } = require("@delvtech/drift");
const {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  toFunctionSelector,
  zeroAddress,
} = require("viem");
const { base, baseSepolia, mainnet, robinhood } = require("viem/chains");
const {
  FlaunchPositionManagerV1_3Abi,
  FlaunchPositionManagerV1_3Address,
  FlaunchZapV1_3Abi,
  FlaunchZapV1_3Address,
  PairedTokenPositionManagerV1_3Address,
  PairedTokenRegistryV1_3Address,
  ReadFlaunchSDK,
  ReadWriteFlaunchSDK,
  ReadFlaunchZapV1_3,
  ReadPairedTokenRegistryV1_3,
  ReadWriteFlaunchZapV1_3,
  doesChainSupportPairedTokenLaunch,
} = require("../dist/index.cjs.js");

const CREATOR = "0x1111111111111111111111111111111111111111";
const PAIRED_TOKEN = "0x2222222222222222222222222222222222222222";
const MEMECOIN = "0x3333333333333333333333333333333333333333";
const TREASURY = "0x4444444444444444444444444444444444444444";
const TX_HASH = `0x${"01".repeat(32)}`;
const POOL_ID = `0x${"ab".repeat(32)}`;

const flaunchParams = {
  name: "Paired Coin",
  symbol: "PAIR",
  tokenUri: "ipfs://paired-coin",
  premineAmount: 0n,
  creator: CREATOR,
  creatorFeeAllocation: 10_000,
  flaunchAt: 0n,
  initialPriceParams: "0x1234",
  feeCalculatorParams: "0x",
  pairedToken: PAIRED_TOKEN,
};

function recordingDrift({ approved = true, quote } = {}) {
  const interactions = [];
  const drift = {
    contract({ address }) {
      return {
        address,
        read(fn, args) {
          interactions.push({ kind: "read", address, fn, args });
          if (fn === "isApproved") return approved;
          if (fn === "calculateFee") {
            return quote ?? {
              ethRequired_: 12n,
              pairedPremineCost_: 34n,
            };
          }
          throw new Error(`Unexpected read: ${fn}`);
        },
        write(fn, args, options) {
          interactions.push({ kind: "write", address, fn, args, options });
          return TX_HASH;
        },
      };
    },
  };

  return { drift, interactions };
}

test("paired-token launch addresses and capability cover deployed V1.3 chains", () => {
  const supportedChains = [base.id, baseSepolia.id, robinhood.id];

  for (const chainId of supportedChains) {
    assert.ok(FlaunchZapV1_3Address[chainId]);
    assert.ok(PairedTokenPositionManagerV1_3Address[chainId]);
    assert.ok(PairedTokenRegistryV1_3Address[chainId]);
    assert.equal(doesChainSupportPairedTokenLaunch(chainId), true);
  }

  assert.equal(doesChainSupportPairedTokenLaunch(mainnet.id), false);
  assert.equal(doesChainSupportPairedTokenLaunch(999_999), false);
  // Base Sepolia gained a full v1.3 generation on 2026-09-03 (v1.3.3 regeneration)
  assert.equal(FlaunchPositionManagerV1_3Address[baseSepolia.id].toLowerCase(), "0x8d346f24278c5cd786309161aac0fc2bbe4c25dc");
});

test("paired-token clients preserve named fee outputs and explicit spend limits", async () => {
  const { drift, interactions } = recordingDrift();
  const readZap = new ReadFlaunchZapV1_3(
    FlaunchZapV1_3Address[base.id],
    drift
  );
  const registry = new ReadPairedTokenRegistryV1_3(
    PairedTokenRegistryV1_3Address[base.id],
    drift
  );
  const writeZap = new ReadWriteFlaunchZapV1_3(
    FlaunchZapV1_3Address[base.id],
    drift
  );

  assert.equal(await registry.isApproved(PAIRED_TOKEN), true);
  assert.deepEqual(
    await readZap.calculateFee({ flaunchParams, slippageBps: 100n }),
    { ethRequired: 12n, pairedPremineCost: 34n }
  );
  assert.equal(
    await writeZap.flaunch({
      flaunchParams,
      trustedFeeSigner: zeroAddress,
      maxPremineCost: 56n,
      value: 78n,
    }),
    TX_HASH
  );

  assert.deepEqual(interactions, [
    {
      kind: "read",
      address: PairedTokenRegistryV1_3Address[base.id],
      fn: "isApproved",
      args: { _token: PAIRED_TOKEN },
    },
    {
      kind: "read",
      address: FlaunchZapV1_3Address[base.id],
      fn: "calculateFee",
      args: { _flaunchParams: flaunchParams, _slippage: 100n },
    },
    {
      kind: "write",
      address: FlaunchZapV1_3Address[base.id],
      fn: "flaunch",
      args: {
        _flaunchParams: flaunchParams,
        _trustedFeeSigner: zeroAddress,
        _maxPremineCost: 56n,
      },
      options: { value: 78n },
    },
  ]);
});

test("Drift decodes the two named calculateFee outputs", async () => {
  const calculateFee = FlaunchZapV1_3Abi.find(
    ({ type, name }) => type === "function" && name === "calculateFee"
  );
  const encodedQuote = encodeAbiParameters(calculateFee.outputs, [12n, 34n]);
  const quote = decodeFunctionReturn({
    abi: FlaunchZapV1_3Abi,
    fn: "calculateFee",
    data: encodedQuote,
  });
  const { drift } = recordingDrift({ quote });
  const readZap = new ReadFlaunchZapV1_3(
    FlaunchZapV1_3Address[base.id],
    drift
  );

  assert.deepEqual(
    await readZap.calculateFee({ flaunchParams, slippageBps: 100n }),
    { ethRequired: 12n, pairedPremineCost: 34n }
  );
});

test("paired-token launch ABI selects the max-premine-cost overload", () => {
  const callData = encodeFunctionData({
    abi: FlaunchZapV1_3Abi,
    functionName: "flaunch",
    args: [flaunchParams, zeroAddress, 0n],
  });

  assert.equal(
    callData.slice(0, 10),
    toFunctionSelector(
      "flaunch((string,string,string,uint256,address,uint24,uint256,bytes,bytes,address),address,uint256)"
    )
  );
});

test("SDK facades expose paired-token clients on Robinhood and guard unsupported chains", async () => {
  const { drift } = recordingDrift({
    quote: { ethRequired_: 7n, pairedPremineCost_: 11n },
  });
  const readSdk = new ReadFlaunchSDK(robinhood.id, drift);
  const writeSdk = new ReadWriteFlaunchSDK(robinhood.id, drift);

  assert.equal(await readSdk.isPairedTokenApproved(PAIRED_TOKEN), true);
  assert.deepEqual(
    await readSdk.calculatePairedTokenFlaunchFee({
      flaunchParams,
      slippageBps: 100n,
    }),
    { ethRequired: 7n, pairedPremineCost: 11n }
  );
  assert.equal(
    await writeSdk.flaunchPairedToken({
      flaunchParams,
      trustedFeeSigner: zeroAddress,
      maxPremineCost: 0n,
      value: 0n,
    }),
    TX_HASH
  );

  const unsupported = new ReadFlaunchSDK(mainnet.id, drift);
  assert.throws(
    () => unsupported.isPairedTokenApproved(PAIRED_TOKEN),
    /Paired-token launches are not supported on chain 1/
  );
});

test("V1.3 PoolCreated decoding filters the emitter and preserves pairedToken", () => {
  const event = FlaunchPositionManagerV1_3Abi.find(
    ({ type, name }) => type === "event" && name === "PoolCreated"
  );
  const validAddress =
    PairedTokenPositionManagerV1_3Address[robinhood.id];
  const log = {
    address: validAddress,
    topics: encodeEventTopics({
      abi: FlaunchPositionManagerV1_3Abi,
      eventName: "PoolCreated",
      args: { _poolId: POOL_ID },
    }),
    data: encodeAbiParameters(
      event.inputs.filter(({ indexed }) => !indexed),
      [MEMECOIN, TREASURY, 7n, false, 0n, flaunchParams]
    ),
  };
  const sdk = new ReadFlaunchSDK(robinhood.id, recordingDrift().drift);

  assert.deepEqual(
    sdk.getPoolCreatedFromLogs([
      { ...log, address: CREATOR },
      { ...log, topics: [], data: "0x" },
      log,
    ]),
    {
      poolId: POOL_ID,
      memecoin: MEMECOIN,
      memecoinTreasury: TREASURY,
      tokenId: 7n,
      currencyFlipped: false,
      flaunchFee: 0n,
      params: {
        ...flaunchParams,
        initialTokenFairLaunch: 0n,
      },
    }
  );
  assert.equal(
    sdk.getPoolCreatedFromLogs([{ ...log, topics: [], data: "0x" }]),
    null
  );
});
