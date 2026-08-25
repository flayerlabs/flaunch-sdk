const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeAbiParameters,
  parseAbi,
  toHex,
  zeroAddress,
} = require("viem");
const { base, mainnet } = require("viem/chains");
const {
  createFlaunchCalldata,
  decodeCallData,
  doesChainSupportMultiTokenFeeEscrow,
  FeeEscrowV1_3Abi,
  FeeEscrowV1_3Address,
} = require("../dist/index.cjs.js");

const CREATOR = "0xD2FfD38191e6B4DF807DF3F13536D1cdBE8d059e";
const AAPLC = "0xb200000000000000000000C2e324d24d7eEcd1fb";
const ESCROW = FeeEscrowV1_3Address[base.id];
/** balances(address,address) */
const BALANCES_SELECTOR = "0xc23f001f";
/** withdrawFees(address[],address,bool) */
const BATCH_WITHDRAW_SELECTOR = "0x82525ad1";

/** Drift batches concurrent reads through Multicall3; answer each inner call the same way. */
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const aggregate3Abi = parseAbi([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[] returnData)",
]);

function answerReads(call, calls, encodedResult) {
  if (call.to.toLowerCase() === MULTICALL3.toLowerCase()) {
    const [inner] = decodeFunctionData({ abi: aggregate3Abi, data: call.data }).args;
    for (const { target, callData } of inner) calls.push({ to: target, data: callData });
    return encodeAbiParameters(aggregate3Abi[0].outputs, [
      inner.map(() => ({ success: true, returnData: encodedResult })),
    ]);
  }
  calls.push(call);
  return encodedResult;
}

function publicClientFor(chain, onCall) {
  return createPublicClient({
    chain,
    transport: custom({
      async request({ method, params }) {
        if (method === "eth_chainId") return toHex(chain.id);
        if (method === "eth_call") return onCall(params[0]);
        throw new Error(`Unexpected RPC request: ${method}`);
      },
    }),
  });
}

test("withdrawCreatorRevenueByToken encodes the batch withdrawFees on the v1.3.1 escrow", async () => {
  const sdk = createFlaunchCalldata({
    publicClient: publicClientFor(base, () => "0x"),
    walletAddress: CREATOR,
  });

  const encoded = await sdk.withdrawCreatorRevenueByToken({
    tokens: [AAPLC, zeroAddress],
  });
  const transaction = decodeCallData(encoded);

  assert.equal(transaction.to.toLowerCase(), ESCROW.toLowerCase());
  assert.equal(transaction.value, 0n);
  assert.equal(transaction.data.slice(0, 10), BATCH_WITHDRAW_SELECTOR);
  const decoded = decodeFunctionData({
    abi: FeeEscrowV1_3Abi,
    data: transaction.data,
  });
  assert.equal(decoded.functionName, "withdrawFees");
  // recipient defaults to the connected wallet; unwrap defaults on
  assert.deepEqual(decoded.args, [[AAPLC, zeroAddress], CREATOR, true]);
});

test("withdrawCreatorRevenueByToken honours an explicit recipient and unwrap=false", async () => {
  const RECIPIENT = "0x1111111111111111111111111111111111111111";
  const sdk = createFlaunchCalldata({
    publicClient: publicClientFor(base, () => "0x"),
    walletAddress: CREATOR,
  });

  const encoded = await sdk.withdrawCreatorRevenueByToken({
    tokens: [AAPLC],
    recipient: RECIPIENT,
    unwrap: false,
  });
  const decoded = decodeFunctionData({
    abi: FeeEscrowV1_3Abi,
    data: decodeCallData(encoded).data,
  });

  assert.deepEqual(decoded.args, [[AAPLC], RECIPIENT, false]);
});

test("creatorRevenueByToken reads balances(recipient, token) per escrow token", async () => {
  const calls = [];
  const publicClient = publicClientFor(base, (call) =>
    answerReads(call, calls, encodeAbiParameters([{ type: "uint256" }], [110000678n]))
  );
  const sdk = createFlaunchCalldata({ publicClient, walletAddress: CREATOR });

  const balances = await sdk.creatorRevenueByToken({
    creator: CREATOR,
    tokens: [AAPLC, zeroAddress],
  });

  assert.deepEqual(balances, [
    { token: AAPLC, amount: 110000678n },
    { token: zeroAddress, amount: 110000678n },
  ]);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.to.toLowerCase() === ESCROW.toLowerCase()));
  assert.ok(calls.every((call) => call.data.slice(0, 10) === BALANCES_SELECTOR));
});

test("chains without the multi-token escrow say so before anything is sent", async () => {
  assert.equal(doesChainSupportMultiTokenFeeEscrow(base.id), true);
  assert.equal(doesChainSupportMultiTokenFeeEscrow(mainnet.id), false);

  const sdk = createFlaunchCalldata({
    publicClient: publicClientFor(mainnet, () => "0x"),
    walletAddress: CREATOR,
  });
  await assert.rejects(
    () => sdk.withdrawCreatorRevenueByToken({ tokens: [zeroAddress] }),
    /Multi-token FeeEscrow is not supported on chain 1/
  );
});
