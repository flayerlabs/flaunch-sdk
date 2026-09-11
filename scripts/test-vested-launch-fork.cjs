/**
 * Opt-in vested-launch integration test against an isolated Anvil fork of Base Sepolia. Every
 * write goes to localhost; the script refuses anything else.
 *
 *   anvil --fork-url $BASE_SEPOLIA_RPC_URL --port 18576        # keep chain id 84532
 *   VESTED_LOCAL_FORK=1 node scripts/test-vested-launch-fork.cjs
 *
 * Env: VESTED_LOCAL_FORK=1 (required), VESTED_FORK_RPC (default http://127.0.0.1:18576),
 * VESTED_RESULTS (output JSON path), VESTED_REVENUE_MANAGER (optional: an existing v1.3.1
 * RevenueManager instance to exercise the manager overload).
 *
 * Scenarios: a plain `flaunchVested` with two schedules and a premine (receipt decoded with
 * `getVestedLaunchFromTx`, escrow funded, premine delivered, no ETH stranded); a `vested`
 * pre-buy plan executed through `executeLaunchPreBuy`; time travel past the cliff and a
 * `claimVesting` as a beneficiary; the revenue-manager twin when a manager is given; and the
 * SDK's pre-flight rejections (cap, premine >= seed, past start) without a signature.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const sdk = require("../dist/index.cjs.js");
const { createPublicClient, createWalletClient, http, parseEther, toHex, erc20Abi, zeroAddress } = require("viem");
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const LOCAL = process.env.VESTED_FORK_RPC || "http://127.0.0.1:18576";
assert.equal(process.env.VESTED_LOCAL_FORK, "1", "Set VESTED_LOCAL_FORK=1 for isolated fork testing");
assert(["127.0.0.1", "localhost"].includes(new URL(LOCAL).hostname), "Only localhost may receive writes");

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
      signal: AbortSignal.timeout(120_000),
    })
  ).json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}

const DAY = 86_400;

async function main() {
  assert.match(String(await rpc("web3_clientVersion")), /anvil/i, "Only an Anvil fork may receive writes");
  assert.equal(Number(await rpc("eth_chainId")), baseSepolia.id, "Fork must keep chain id 84532");
  assert(sdk.doesChainSupportVestedLaunch(baseSepolia.id), "vested launches must be wired for 84532");

  const account = privateKeyToAccount(generatePrivateKey());
  const sender = account.address;
  const team = privateKeyToAccount(generatePrivateKey()).address;
  await rpc("anvil_setBalance", [sender, toHex(parseEther("100"))]);

  const transport = http(LOCAL, { timeout: 120_000, retryCount: 0 });
  const publicClient = createPublicClient({ chain: baseSepolia, transport });
  const walletClient = createWalletClient({ chain: baseSepolia, transport, account });
  const flaunch = sdk.createFlaunch({ publicClient, walletClient });
  const read = sdk.createFlaunch({ publicClient });
  const balanceOf = (token, owner) =>
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] });

  const maxVestedBps = await read.getMaxVestedBps();
  record({ scenario: "maxVestedBps", maxVestedBps });

  const schedules = [
    { beneficiary: team, percent: 10, cliffDuration: 30 * DAY, vestDuration: 365 * DAY },
    { beneficiary: sender, percent: "5", cliffDuration: 0, vestDuration: 30 * DAY },
  ];
  const baseParams = (creator) => ({
    name: "Vested rehearsal",
    symbol: "VREH",
    tokenUri: "ipfs://vested-rehearsal-no-upload",
    initialMarketCapUSD: 4000,
    creator,
    creatorFeeAllocationPercent: 80,
    vestingSchedules: schedules,
  });

  // 1. Pre-flight rejections happen before any signature
  for (const [label, params, pattern] of [
    ["cap", { ...baseParams(sender), vestingSchedules: [{ beneficiary: team, percent: 60, cliffDuration: 0, vestDuration: DAY }] }, /above the zap's cap|VestedSupplyExceedsCap/],
    ["premine >= seed", { ...baseParams(sender), premineAmount: sdk.FLAUNCH_TOTAL_SUPPLY }, /below the non-vested seed/],
    ["past start", { ...baseParams(sender), vestingSchedules: [{ beneficiary: team, percent: 1, cliffDuration: 0, vestDuration: DAY, start: 1_000_000 }] }, /start is in the past/],
  ]) {
    try {
      await flaunch.flaunchVested(params);
      record({ scenario: `reject:${label}`, result: "FAILED — launch went through" });
      process.exitCode = 1;
    } catch (error) {
      assert.match(String(error.message ?? error), pattern);
      record({ scenario: `reject:${label}`, result: "rejected", message: String(error.message).slice(0, 120) });
    }
  }

  // 2. Plain vested launch with a premine
  const premineAmount = 10n ** 27n; // 1% of supply
  const fee = await read.calculateVestedFlaunchFee({ ...baseParams(sender), premineAmount }, 100, { from: sender });
  const ethBefore = await publicClient.getBalance({ address: sender });
  const hash = await flaunch.flaunchVested({ ...baseParams(sender), premineAmount, slippageBps: 100 });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
  const launch = await read.getVestedLaunchFromTx(hash);
  assert(launch, "getVestedLaunchFromTx returned null");
  const created = await read.getPoolCreatedFromTx(hash);
  assert.equal(created.memecoin.toLowerCase(), launch.memecoin.toLowerCase(), "getPoolCreatedFromTx resolves the same coin");
  const totalVested = (sdk.FLAUNCH_TOTAL_SUPPLY * 1500n) / 10_000n;
  assert.equal(launch.vesting.totalVested, totalVested);
  assert.equal(launch.vesting.seedAmount, sdk.FLAUNCH_TOTAL_SUPPLY - totalVested);
  assert.equal(launch.vesting.scheduleCount, 2n);
  assert.equal(launch.vesting.schedules.length, 2);
  assert.equal(launch.vesting.creator.toLowerCase(), sender.toLowerCase());
  assert.equal(launch.vesting.treasuryManager, zeroAddress);
  assert.equal(await balanceOf(launch.memecoin, sdk.MemecoinVestingAddress[baseSepolia.id]), totalVested, "escrow funded");
  assert.equal(await balanceOf(launch.memecoin, sender), premineAmount, "premine delivered to the creator");
  assert.equal(await publicClient.getBalance({ address: sdk.AnyFlaunchZapAddress[baseSepolia.id] }), 0n, "zap stranded ETH");
  const spent = ethBefore - (await publicClient.getBalance({ address: sender })) - receipt.gasUsed * receipt.effectiveGasPrice;
  assert(spent <= fee.ethRequired, "spent more than the quote");
  record({ scenario: "flaunchVested", memecoin: launch.memecoin, tokenId: launch.tokenId, quotedEth: fee.ethRequired, spentEth: spent, seed: launch.vesting.seedAmount, totalVested });

  // 3. Vesting position + claim after time travel (sender's cliff-less 30-day schedule)
  const before = await read.getVestingPosition(launch.memecoin, sender);
  assert.equal(before.schedules.length, 1);
  assert.equal(before.claimable, 0n, "nothing vests in the launch block");
  await rpc("evm_increaseTime", [15 * DAY]);
  await rpc("evm_mine", []);
  const mid = await read.getVestingPosition(launch.memecoin, sender);
  const half = before.total / 2n;
  assert(mid.claimable > (half * 99n) / 100n && mid.claimable <= (half * 101n) / 100n, `~half should be claimable, got ${mid.claimable}`);
  const teamPosition = await read.getVestingPosition(launch.memecoin, team);
  assert.equal(teamPosition.claimable, 0n, "team is still under its 30-day cliff");
  const coinBefore = await balanceOf(launch.memecoin, sender);
  const claimHash = await flaunch.claimVesting(launch.memecoin);
  const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });
  assert.equal(claimReceipt.status, "success");
  const claimed = (await balanceOf(launch.memecoin, sender)) - coinBefore;
  assert(claimed >= mid.claimable, "claim paid at least what was claimable");
  const after = await read.getVestingPosition(launch.memecoin, sender);
  assert.equal(after.claimed, claimed);
  record({ scenario: "claimVesting", claimed, remaining: after.total - after.claimed });

  // 4. Pre-buy planner on the vested route
  const plan = await flaunch.planLaunchPreBuy({ route: "vested", params: baseParams(sender), preBuyBps: 200, slippageBps: 50 });
  if (!plan.supported) {
    record({ scenario: "prebuy:vested", result: "UNSUPPORTED", reasons: plan.reasons });
    process.exitCode = 1;
  } else {
    const balBefore = await publicClient.getBalance({ address: sender });
    const { hash: pbHash } = await flaunch.executeLaunchPreBuy(plan.plan);
    const pbReceipt = await publicClient.waitForTransactionReceipt({ hash: pbHash });
    assert.equal(pbReceipt.status, "success");
    const pbLaunch = await read.getVestedLaunchFromTx(pbHash);
    assert(pbLaunch);
    assert.equal(await balanceOf(pbLaunch.memecoin, sender), plan.plan.premineAmount, "pre-buy delivered exactly the planned premine");
    const pbSpent = balBefore - (await publicClient.getBalance({ address: sender })) - pbReceipt.gasUsed * pbReceipt.effectiveGasPrice;
    assert(pbSpent <= plan.plan.value, "spent more than the plan's cap");
    record({ scenario: "prebuy:vested", memecoin: pbLaunch.memecoin, premine: plan.plan.premineAmount, method: plan.plan.pricing.method, expected: plan.plan.payment.expected, max: plan.plan.payment.max, spentEth: pbSpent });
  }

  // 5. Manager twin (optional)
  const manager = process.env.VESTED_REVENUE_MANAGER;
  if (manager) {
    const mHash = await flaunch.flaunchVestedWithRevenueManager({ ...baseParams(sender), revenueManagerInstanceAddress: manager });
    const mReceipt = await publicClient.waitForTransactionReceipt({ hash: mHash });
    assert.equal(mReceipt.status, "success");
    const mLaunch = await read.getVestedLaunchFromTx(mHash);
    assert.equal(mLaunch.vesting.treasuryManager.toLowerCase(), manager.toLowerCase());
    assert.equal(mLaunch.vesting.creator.toLowerCase(), sender.toLowerCase(), "end creator survives the zap-as-creator dance");
    record({ scenario: "flaunchVestedWithRevenueManager", memecoin: mLaunch.memecoin, manager });
  }

  if (process.env.VESTED_RESULTS) {
    fs.writeFileSync(process.env.VESTED_RESULTS, JSON.stringify(results, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  }
  console.log(process.exitCode ? "VESTED FORK: FAILED" : "VESTED FORK: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
