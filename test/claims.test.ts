import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeFunctionData,
  encodeFunctionResult,
  numberToHex,
  zeroAddress,
} from "viem";
import { baseSepolia } from "viem/chains";
import { claimFees, claimStakingRewards, FeeEscrowAbi, StakingRecipientAbi } from "../dist/index.mjs";

const BENEFICIARY = "0x1111111111111111111111111111111111111111";
const STAKING = "0x2222222222222222222222222222222222222222";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const NVDA = "0x3333333333333333333333333333333333333333";
const abi = [...FeeEscrowAbi, ...StakingRecipientAbi];

// A JSON-RPC node stand-in: previewClaim answers from `previews`, claimable from `claimable`, any call `reverts` matches reverts,
// and each sent transaction is decoded into `sent` and mined with `receiptStatus`, unless the wallet `rejects` it.
function fakeChain({ previews = [], claimable = () => 1n, reverts = () => false, rejects = false, receiptStatus = "0x1" } = {}) {
  const sent = [];
  const requests = [];
  const transport = custom({
    async request({ method, params }) {
      requests.push(method);
      switch (method) {
        case "eth_chainId":
          return numberToHex(baseSepolia.id);
        case "eth_blockNumber":
          return "0x1";
        case "eth_call": {
          const call = decodeFunctionData({ abi, data: params[0].data });
          if (reverts(call)) throw Object.assign(new Error("execution reverted"), { code: 3, data: "0x" });
          if (call.functionName === "previewClaim")
            return encodeFunctionResult({ abi, functionName: "previewClaim", result: previews.shift() });
          if (call.functionName === "claimable")
            return encodeFunctionResult({ abi, functionName: "claimable", result: claimable(call.args[1]) });
          return "0x";
        }
        case "eth_sendTransaction":
          sent.push({ to: params[0].to, ...decodeFunctionData({ abi, data: params[0].data }) });
          if (rejects) throw Object.assign(new Error("User rejected the request."), { code: 4001 });
          return `0x${String(sent.length).padStart(64, "0")}`;
        case "eth_getTransactionReceipt":
          return {
            transactionHash: params[0],
            blockHash: `0x${"0".repeat(64)}`,
            blockNumber: "0x1",
            status: receiptStatus,
            logs: [],
          };
        default:
          throw new Error(`unexpected ${method}`);
      }
    },
  }, { retryCount: 0 });
  const publicClient = createPublicClient({ chain: baseSepolia, transport, pollingInterval: 1 });
  const walletClient = createWalletClient({ chain: baseSepolia, transport, account: BENEFICIARY });
  return { clients: { publicClient, walletClient }, sent, requests };
}

test("staking claims repeat claimBatch while a preview has more intervals", async () => {
  const { clients, sent } = fakeChain({ previews: [[5n, true], [5n, true], [5n, false]] });

  const hashes = await claimStakingRewards(clients, STAKING, BENEFICIARY, [zeroAddress]);

  assert.equal(hashes.length, 3);
  assert.deepEqual(
    sent.map((tx) => [tx.to, tx.functionName]),
    Array(3).fill([STAKING, "claimBatch"]),
  );
  assert.deepEqual(sent[0].args, [[{ beneficiary: BENEFICIARY, currency: zeroAddress, maxIntervals: 32n }]]);
});

test("a reverted staking claim throws instead of sending the claim again", async () => {
  const { clients, sent } = fakeChain({ previews: [[5n, true], [5n, true]], receiptStatus: "0x0" });

  await assert.rejects(claimStakingRewards(clients, STAKING, BENEFICIARY, [zeroAddress]), /reverted/);
  assert.equal(sent.length, 1);
});

test("when one escrow currency reverts, each currency with credit is claimed alone and the failure is reported", async () => {
  const { clients, sent } = fakeChain({
    claimable: (currency) => (currency === NVDA ? 0n : 1n),
    reverts: ({ functionName, args }) => functionName === "claimBatch" || args[0].currency === USDC,
  });

  const result = await claimFees(clients, 84532, BENEFICIARY, [zeroAddress, USDC, NVDA]);

  assert.deepEqual(result.failed, [USDC]);
  assert.equal(result.hashes.length, 1);
  assert.deepEqual(
    sent.map((tx) => [tx.functionName, tx.args]),
    [["claim", [{ beneficiary: BENEFICIARY, currency: zeroAddress }]]],
  );
});

test("a rejected wallet prompt rejects the claim after one prompt", async () => {
  for (const batchReverts of [false, true]) {
    const { clients, sent } = fakeChain({ rejects: true, reverts: ({ functionName }) => batchReverts && functionName === "claimBatch" });

    await assert.rejects(claimFees(clients, 84532, BENEFICIARY, [zeroAddress, USDC, NVDA]), (error) => error.walk((e) => e.code === 4001) !== null);
    assert.equal(sent.length, 1);
  }
});

test("claiming no currencies sends nothing", async () => {
  const { clients, requests } = fakeChain();

  assert.deepEqual(await claimFees(clients, 84532, BENEFICIARY, []), { hashes: [], failed: [] });
  assert.deepEqual(requests, []);
});
