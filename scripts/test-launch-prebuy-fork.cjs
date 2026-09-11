/**
 * Opt-in launch pre-buy integration test against an isolated Anvil fork. Every write goes to
 * localhost; the script refuses anything else.
 *
 *   anvil --fork-url $BASE_RPC_URL --port 18575          # keep the forked chain id
 *   PREBUY_LOCAL_FORK=1 PREBUY_CHAIN_ID=8453 node scripts/test-launch-prebuy-fork.cjs
 *
 * Env: PREBUY_LOCAL_FORK=1 (required), PREBUY_CHAIN_ID (8453 | 84532 | 4663, default 8453),
 * PREBUY_FORK_RPC (default http://127.0.0.1:18575), PREBUY_ERC20_PAIRED_TOKEN (optional: an
 * approved ERC20 pairing to exercise the approval path; on Base/Robinhood the script buys it
 * from ETH through the SDK's acquisition route, elsewhere it is skipped unless the sender is
 * already funded), PREBUY_RESULTS (output JSON path).
 *
 * Per scenario and pre-buy size the script plans, executes through `executeLaunchPreBuy`, and
 * asserts: receipt success, `PoolCreated` decoded with the plan's premine, the creator's coin
 * balance rises by exactly `plan.premineAmount`, the sender spent at most `fee + payment.max`
 * (refund observed), and the simulation's `ethSpent` never exceeded `plan.value`. It also
 * sends one deliberately underfunded launch and requires it to revert with no `PoolCreated`.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const sdk = require("../dist/index.cjs.js");
const {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  toHex,
  erc20Abi,
  zeroAddress,
  encodeAbiParameters,
} = require("viem");
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");
const { base, baseSepolia, robinhood } = require("viem/chains");

const LOCAL = process.env.PREBUY_FORK_RPC || "http://127.0.0.1:18575";
const CHAIN = [base, baseSepolia, robinhood].find(
  (chain) => chain.id === Number(process.env.PREBUY_CHAIN_ID || "8453")
);
assert(CHAIN, "PREBUY_CHAIN_ID must be 8453, 84532 or 4663");
assert.equal(process.env.PREBUY_LOCAL_FORK, "1", "Set PREBUY_LOCAL_FORK=1 for isolated fork testing");
assert(
  ["127.0.0.1", "localhost"].includes(new URL(LOCAL).hostname),
  "Only localhost may receive writes"
);

const results = [];
const record = (entry) => {
  results.push(entry);
  console.log(JSON.stringify(entry, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
};

async function rpc(method, params = []) {
  const body = await (
    await fetch(LOCAL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(60_000),
    })
  ).json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}

const CREATOR_PARAMS = (creator) => ({
  name: "Pre-buy rehearsal",
  symbol: "PREBUY",
  tokenUri: "ipfs://prebuy-rehearsal-no-upload",
  fairLaunchPercent: 0,
  fairLaunchDuration: 0,
  initialMarketCapUSD: 4000,
  creator,
  creatorFeeAllocationPercent: 100,
});
const PAIRED_PARAMS = (creator, pairedToken) => ({
  name: "Pre-buy rehearsal",
  symbol: "PREBUY",
  tokenUri: "ipfs://prebuy-rehearsal-no-upload",
  premineAmount: 0n,
  creator,
  creatorFeeAllocation: 10_000,
  flaunchAt: 0n,
  initialPriceParams: encodeAbiParameters([{ type: "uint256" }], [4_000_000_000n]),
  feeCalculatorParams: "0x",
  pairedToken,
});

async function main() {
  const clientVersion = await rpc("web3_clientVersion");
  assert.match(String(clientVersion), /anvil/i, "Only an Anvil fork may receive writes");
  const forkChainId = Number(await rpc("eth_chainId"));
  assert.equal(forkChainId, CHAIN.id, `Fork must keep chain id ${CHAIN.id}; got ${forkChainId}`);

  const account = privateKeyToAccount(generatePrivateKey());
  const sender = account.address;
  await rpc("anvil_setBalance", [sender, toHex(parseEther("1000"))]);

  const transport = http(LOCAL, { timeout: 60_000, retryCount: 0 });
  const publicClient = createPublicClient({ chain: CHAIN, transport });
  const walletClient = createWalletClient({ chain: CHAIN, transport, account });
  const flaunch = sdk.createFlaunch({ publicClient, walletClient });
  const read = sdk.createFlaunch({ publicClient });

  const capabilities = read.getLaunchPreBuyCapabilities();
  record({ scenario: "capabilities", chainId: CHAIN.id, routes: Object.fromEntries(Object.entries(capabilities.routes).map(([k, v]) => [k, v.supported])) });

  const balanceOf = (token, owner) =>
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] });

  async function runScenario(label, input) {
    for (const preBuyBps of [100, 1000]) {
      const scenario = `${label} @ ${preBuyBps} bps`;
      try {
        const result = await flaunch.planLaunchPreBuy({ ...input, preBuyBps, slippageBps: 50 });
        if (!result.supported) {
          record({ scenario, result: "UNSUPPORTED", reasons: result.reasons });
          continue;
        }
        let { plan } = result;
        assert.equal(plan.funding.sufficient, true, `funding: ${JSON.stringify(plan.funding, (_, v) => typeof v === "bigint" ? v.toString() : v)}`);
        // Send any ERC20 approval ourselves so the launch's ETH accounting below is exact, then
        // re-plan: the standing allowance must make the new plan approval-free.
        const approvalsSent = plan.approvals.length;
        if (approvalsSent > 0) {
          for (const approval of plan.approvals) {
            const hash = await walletClient.sendTransaction({ to: approval.to, data: approval.data, value: approval.value });
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            assert.equal(receipt.status, "success", "approval reverted");
          }
          const replanned = await flaunch.planLaunchPreBuy({ ...input, preBuyBps, slippageBps: 50 });
          assert(replanned.supported, "re-plan after approval must be supported");
          plan = replanned.plan;
          assert.equal(plan.approvals.length, 0, "standing allowance must drop the approval");
        }
        const verification = await flaunch.verifyLaunchPreBuyPlan(plan, "simulate");
        assert(verification.ethSpent <= plan.value, "simulated ethSpent exceeds plan.value");

        const ethBefore = await publicClient.getBalance({ address: sender });
        const pairedBefore =
          plan.payment.asset.address !== zeroAddress ? await balanceOf(plan.payment.asset.address, sender) : null;

        const { hash } = await flaunch.executeLaunchPreBuy(plan);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        assert.equal(receipt.status, "success", `launch reverted: ${hash}`);
        const created = await flaunch.getLaunchPreBuyResultFromTx(hash, plan);
        assert(created, "PoolCreated must decode from the launch receipt");
        assert.equal(created.params.premineAmount, plan.premineAmount);

        const coinBalance = await balanceOf(created.memecoin, plan.creator);
        assert.equal(coinBalance, plan.premineAmount, "creator must hold exactly the premine");

        const ethAfter = await publicClient.getBalance({ address: sender });
        const gas = receipt.gasUsed * receipt.effectiveGasPrice;
        const ethSpent = ethBefore - ethAfter - gas;
        if (plan.payment.asset.address === zeroAddress) {
          assert(ethSpent <= plan.value, `spent ${ethSpent} > value ${plan.value}`);
          assert(ethSpent >= plan.fee.amount, `spent ${ethSpent} < fee ${plan.fee.amount}`);
        } else {
          const pairedAfter = await balanceOf(plan.payment.asset.address, sender);
          const pairedSpent = pairedBefore - pairedAfter;
          assert(pairedSpent <= plan.payment.max, `paired spent ${pairedSpent} > max ${plan.payment.max}`);
          assert(pairedSpent > 0n, "paired token must have been spent");
          assert.equal(ethSpent, plan.value, "an ERC20 pairing spends exactly the fee in ETH");
        }
        record({
          scenario,
          result: "PASS",
          hash,
          memecoin: created.memecoin,
          premineAmount: plan.premineAmount,
          fee: plan.fee.amount,
          expected: plan.payment.expected,
          max: plan.payment.max,
          value: plan.value,
          simulatedEthSpent: verification.ethSpent,
          ethSpent,
          refundObserved: plan.payment.asset.address === zeroAddress ? ethSpent < plan.value : undefined,
          paymentAsset: plan.payment.asset,
          approvalsSent,
        });
      } catch (error) {
        record({ scenario, result: "FAIL", error: error.shortMessage || error.message });
      }
    }
  }

  async function runUnderfunded(label, input) {
    const scenario = `${label} underfunded launch reverts`;
    try {
      const result = await flaunch.planLaunchPreBuy({ ...input, preBuyBps: 1000, slippageBps: 0 });
      assert(result.supported, JSON.stringify(result.reasons));
      const { plan } = result;
      const value = plan.fee.amount + plan.payment.expected / 2n;
      let reverted = false;
      let hash;
      try {
        hash = await walletClient.sendTransaction({ to: plan.launch.to, data: plan.launch.data, value, gas: 15_000_000n });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        reverted = receipt.status === "reverted";
        if (!reverted) {
          assert.equal(read.getPoolCreatedFromLogs(receipt.logs), null, "underfunded launch must not create a pool");
        }
      } catch (error) {
        reverted = true;
      }
      assert(reverted, "underfunded launch must revert");
      record({ scenario, result: "PASS", sentValue: value, requiredValue: plan.value, hash });
    } catch (error) {
      record({ scenario, result: "FAIL", error: error.shortMessage || error.message });
    }
  }

  const params = CREATOR_PARAMS(sender);
  if (CHAIN.id === robinhood.id) {
    await runScenario("multichain standard", { route: "standard", params });
    await runScenario("multichain dynamic split", {
      route: "dynamicSplitManager",
      params: { ...params, creatorShare: 0n, managerOwnerShare: 0n, moderator: sender, splitReceivers: [{ address: sender, share: 100_00000n }] },
    });
    await runUnderfunded("multichain standard", { route: "standard", params });
  } else {
    await runScenario("legacy standard", { route: "standard", params });
    await runScenario("legacy static split", {
      route: "splitManager",
      params: { ...params, creatorSplitPercent: 50, managerOwnerSplitPercent: 0, splitReceivers: [{ address: sender, percent: 100 }] },
    });
    await runScenario("legacy dynamic split", {
      route: "dynamicSplitManager",
      params: { ...params, creatorShare: 0n, managerOwnerShare: 0n, moderator: sender, splitReceivers: [{ address: sender, share: 100_00000n }] },
    });
    try {
      const zap = read.readFlaunchZap;
      const initialPriceParams = sdk.encodeInitialPriceParams(4000);
      const [a, b] = await Promise.all([
        zap.calculateFeeBps({ premineAmount: 0n, slippageBps: 0n, initialPriceParams }),
        zap.calculateFeeBps({ premineAmount: 0n, slippageBps: 500n, initialPriceParams }),
      ]);
      record({ scenario: "legacy fee is slippage-independent at zero premine", result: a === b ? "PASS" : "FAIL", fee0: a, fee500: b });
    } catch (error) {
      record({ scenario: "legacy fee is slippage-independent at zero premine", result: "FAIL", error: error.message });
    }
    await runUnderfunded("legacy standard", { route: "standard", params });
  }

  if (sdk.doesChainSupportPairedTokenLaunch(CHAIN.id)) {
    await runScenario("paired native ETH", { route: "pairedToken", params: PAIRED_PARAMS(sender, zeroAddress) });
    const fleth = sdk.FLETHAddress[CHAIN.id];
    if (fleth) await runScenario("paired flETH", { route: "pairedToken", params: PAIRED_PARAMS(sender, fleth) });
    await runUnderfunded("paired native ETH", { route: "pairedToken", params: PAIRED_PARAMS(sender, zeroAddress) });

    const erc20 = process.env.PREBUY_ERC20_PAIRED_TOKEN;
    if (erc20) {
      try {
        if (sdk.doesChainSupportPairedTokenAcquisition(CHAIN.id)) {
          const acquisition = await flaunch.planPairedTokenAcquisitionForBudget({
            pairedToken: erc20,
            input: "eth",
            amountIn: parseEther("2"),
            slippageBps: 300,
            recipient: sender,
            sender,
          });
          for (const call of [acquisition.approve, acquisition.swap].filter(Boolean)) {
            const hash = await walletClient.sendTransaction({ to: call.to, data: call.data, value: call.value });
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            assert.equal(receipt.status, "success", "paired-token acquisition reverted");
          }
        }
        const held = await balanceOf(erc20, sender);
        record({ scenario: "paired ERC20 funding", result: held > 0n ? "PASS" : "SKIP", token: erc20, balance: held });
        if (held > 0n) {
          await runScenario("paired ERC20", { route: "pairedToken", params: PAIRED_PARAMS(sender, erc20) });
        }
      } catch (error) {
        record({ scenario: "paired ERC20", result: "FAIL", error: error.shortMessage || error.message });
      }
    } else {
      record({ scenario: "paired ERC20", result: "SKIP", note: "set PREBUY_ERC20_PAIRED_TOKEN to exercise the approval path" });
    }
  }

  const out = process.env.PREBUY_RESULTS || `.prebuy-fork-results-${CHAIN.id}.json`;
  fs.writeFileSync(out, JSON.stringify({ chainId: CHAIN.id, sdkVersion: require("../package.json").version, results }, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  console.log(`wrote ${out}`);
  if (results.some((r) => r.result === "FAIL")) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
