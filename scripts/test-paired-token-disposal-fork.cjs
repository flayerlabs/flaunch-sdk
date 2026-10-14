/**
 * Opt-in round trip for paired-token disposal on Base and Robinhood: buy a registry-approved
 * equity with `planPairedTokenAcquisitionForBudget`, then sell the whole balance back to ETH with
 * `quotePairedTokenDisposal` + `planPairedTokenDisposal`. Nothing is ever broadcast to a real chain.
 *
 *   PAIRED_DISPOSAL_FORK=1 pnpm test:disposal:fork
 *
 * Two modes, per chain (DISPOSAL_MODE_<chainId>):
 * - `anvil` (Robinhood default): spawns a localhost Anvil fork per token and sends real
 *   transactions to it. The script refuses any non-Anvil, non-localhost endpoint. Robinhood's
 *   public RPC is not an archive node and prunes the forked block within minutes; a slow token
 *   (RBLX) can outlive it, so point FORK_RPC_ROBINHOOD at an archive endpoint for a reliable run.
 * - `simulate` (Base default): one `eth_simulateV1` block against live state, where the
 *   acquisition, the approve and the sell run in sequence. Base's B20 equities are node-native
 *   tokens (their account code is the single byte `0xef`), which Anvil cannot execute: on an Anvil
 *   fork every transfer reverts in the pool (`TF`) and `balanceOf` hits `OpcodeNotFound`. A
 *   simulation is executed by the real node, so it is the faithful local test there.
 *
 * Env: PAIRED_DISPOSAL_FORK=1 (required, otherwise the script skips), FORK_RPC_BASE and
 * FORK_RPC_ROBINHOOD (upstream RPCs; public defaults), DISPOSAL_CHAINS (comma list of 8453,4663;
 * default both), DISPOSAL_MODE_8453 / DISPOSAL_MODE_4663, DISPOSAL_TOKENS_8453 /
 * DISPOSAL_TOKENS_4663 (comma lists overriding the default equities), DISPOSAL_RESULTS (output
 * JSON path).
 *
 * Per token it asserts: the acquisition lands paired token on the sender; the disposal leaves the
 * sender with zero paired token; the recipient's ETH rises by at least `amountOutMinimum` (gas is
 * paid by a different account, so the delta is exact); the router's ETH, WETH, hub and paired-token
 * balances are unchanged (no dust kept); and a minimum above the quote reverts.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const sdk = require("../dist/index.cjs.js");
const { createPublicClient, createWalletClient, http, parseEther, toHex, erc20Abi } = require("viem");
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");
const { base, robinhood } = require("viem/chains");

if (process.env.PAIRED_DISPOSAL_FORK !== "1") {
  console.log("SKIP: set PAIRED_DISPOSAL_FORK=1 to run the paired-token disposal fork test");
  process.exit(0);
}

const CHAINS = {
  [base.id]: {
    chain: base,
    upstream: process.env.FORK_RPC_BASE || "https://mainnet.base.org",
    port: 18601,
    mode: process.env.DISPOSAL_MODE_8453 || "simulate",
    // SPCXc, AMZNc: registry-approved B20 equities quoting through USDC
    tokens: ["0xb2000000000000000000007b9fcbd005511acbd5", "0xb200000000000000000000d9192b6b456483c2e8"],
  },
  [robinhood.id]: {
    chain: robinhood,
    upstream: process.env.FORK_RPC_ROBINHOOD || "https://rpc.mainnet.chain.robinhood.com",
    port: 18602,
    mode: process.env.DISPOSAL_MODE_4663 || "anvil",
    // RDDT, RBLX: registry-approved Robinhood equities quoting through USDG
    tokens: ["0x05b37fb53a299a1b874a619e1c4c404d52c36f4c", "0xf0c4bf4c582cb3836e98394b1d4e7b7281101be8"],
  },
};

const results = [];
const json = (value) => JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
const record = (entry) => {
  results.push(entry);
  console.log(json(entry));
};

async function rpc(url, method, params = []) {
  const body = await (
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(60_000),
    })
  ).json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}

async function startAnvil(config) {
  const local = `http://127.0.0.1:${config.port}`;
  const child = spawn("anvil", ["--fork-url", config.upstream, "--port", String(config.port), "--no-rate-limit", "--silent"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (let i = 0; i < 120; i += 1) {
    try {
      await rpc(local, "eth_chainId");
      return { child, local };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  child.kill();
  throw new Error(`anvil did not start for chain ${config.chain.id}`);
}

const Multicall3EthBalanceAbi = [
  {
    type: "function",
    name: "getEthBalance",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
];

/**
 * The same round trip as one `eth_simulateV1` block on live state: the acquisition, greedy-sell
 * probe, approve and sell run in order with state carried between them, and balances are read by
 * calls inside the block (Multicall3 `getEthBalance`, ERC20 `balanceOf`) before and after the sell.
 */
async function runSimulated(chainId, config, tokens) {
  const publicClient = createPublicClient({ chain: config.chain, transport: http(config.upstream, { timeout: 120_000 }) });
  const flaunch = sdk.createFlaunch({ publicClient });
  const dex = sdk.PairedTokenAcquisitionDexAddress[chainId];
  const multicall3 = config.chain.contracts.multicall3.address;
  for (const token of tokens) {
    const scenario = `${config.chain.name} ${token} (eth_simulateV1)`;
    try {
      const sender = privateKeyToAccount(generatePrivateKey()).address;
      const recipient = privateKeyToAccount(generatePrivateKey()).address;
      const budget = parseEther("0.02");
      const acquisition = await flaunch.planPairedTokenAcquisitionForBudget({
        pairedToken: token,
        input: "eth",
        amountIn: budget,
        slippageBps: 300,
        recipient: sender,
        sender,
      });
      // Exact-output: the buy delivers exactly `target`, which is what the sell then spends in full
      const held = acquisition.target;
      const quote = await flaunch.quotePairedTokenDisposal({ pairedToken: token, output: "eth", amountIn: held });
      const amountOutMinimum = (quote.expectedOut * 9_800n) / 10_000n;
      const params = { pairedToken: token, output: "eth", amountIn: held, recipient, sender, route: quote.route };
      const plan = await flaunch.planPairedTokenDisposal({ ...params, amountOutMinimum });
      const greedy = await flaunch.planPairedTokenDisposal({ ...params, amountOutMinimum: quote.expectedOut * 2n });
      assert(plan.approve, "a fresh wallet has no allowance, so the plan must approve");

      const tx = (call) => ({ account: sender, to: call.to, data: call.data, value: call.value });
      const ethOf = (address) => ({ account: sender, to: multicall3, abi: Multicall3EthBalanceAbi, functionName: "getEthBalance", args: [address] });
      const balOf = (asset, owner) => ({ account: sender, to: asset, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
      const snapshot = [ethOf(recipient), ethOf(dex.swapRouter), balOf(dex.weth, dex.swapRouter), balOf(dex.hubToken, dex.swapRouter), balOf(token, dex.swapRouter), balOf(token, sender)];
      const calls = [
        ...[acquisition.approve, acquisition.swap].filter(Boolean).map(tx),
        tx(plan.approve),
        tx(greedy.swap),
        ...snapshot,
        tx(plan.swap),
        ...snapshot,
      ];
      const [block] = await publicClient.simulateBlocks({
        blocks: [{ stateOverrides: [{ address: sender, balance: parseEther("10") }], calls }],
        validation: false,
      });
      const results = block.calls;
      const acqCount = [acquisition.approve, acquisition.swap].filter(Boolean).length;
      results.slice(0, acqCount).forEach((r) => assert.equal(r.status, "success", "acquisition reverted"));
      assert.equal(results[acqCount].status, "success", "disposal approve reverted");
      const greedyReverted = results[acqCount + 1].status !== "success";
      assert(greedyReverted, "a minimum of 2x the quote did not revert");
      const before = results.slice(acqCount + 2, acqCount + 2 + snapshot.length).map((r) => r.result);
      const sell = results[acqCount + 2 + snapshot.length];
      assert.equal(sell.status, "success", `disposal swap reverted: ${sell.error?.message ?? ""}`);
      const after = results.slice(acqCount + 3 + snapshot.length).map((r) => r.result);
      assert.equal(before[5], held, "sender did not hold exactly the acquired target before the sell");
      const received = after[0] - before[0];
      assert.equal(after[5], 0n, "sender still holds paired token");
      assert(received >= amountOutMinimum, `received ${received} < minimum ${amountOutMinimum}`);
      assert.deepEqual(after.slice(1, 5), before.slice(1, 5), "router balances changed (dust kept)");
      record({
        scenario,
        result: "PASS",
        chainId,
        mode: "simulate",
        spentEth: budget,
        acquired: held,
        quoteSource: quote.source,
        route: quote.route,
        expectedOut: quote.expectedOut,
        amountOutMinimum,
        received,
        receivedVsQuoteBps: Number((received * 10_000n) / quote.expectedOut),
        routerDust: { before: before.slice(1, 5), after: after.slice(1, 5) },
        sellGasUsed: sell.gasUsed,
        greedyMinimumReverted: greedyReverted,
      });
    } catch (error) {
      record({ scenario, result: "FAIL", chainId, mode: "simulate", error: error.shortMessage || error.message });
    }
  }
}

async function runChain(chainId) {
  const config = CHAINS[chainId];
  const override = process.env[`DISPOSAL_TOKENS_${chainId}`];
  const tokens = override ? override.split(",").map((t) => t.trim()) : config.tokens;
  assert(["anvil", "simulate"].includes(config.mode), `DISPOSAL_MODE_${chainId} must be anvil or simulate`);
  if (config.mode === "simulate") return runSimulated(chainId, config, tokens);
  // A fresh fork per token: public non-archive RPCs (Robinhood's) prune the forked block's state
  // within minutes, after which a long-lived fork fails with "historical state is not available".
  for (const token of tokens) {
    const { child, local } = await startAnvil(config);
    try {
      assert(["127.0.0.1", "localhost"].includes(new URL(local).hostname), "Only localhost may receive writes");
      assert.match(String(await rpc(local, "web3_clientVersion")), /anvil/i, "Only an Anvil fork may receive writes");
      assert.equal(Number(await rpc(local, "eth_chainId")), chainId, "fork must keep the chain id");

      const transport = http(local, { timeout: 60_000, retryCount: 0 });
      const publicClient = createPublicClient({ chain: config.chain, transport });
      const dex = sdk.PairedTokenAcquisitionDexAddress[chainId];
      const balanceOf = (token, owner) =>
        publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
      const routerState = async (token) => ({
        eth: await publicClient.getBalance({ address: dex.swapRouter }),
        weth: await balanceOf(dex.weth, dex.swapRouter),
        hub: await balanceOf(dex.hubToken, dex.swapRouter),
        paired: await balanceOf(token, dex.swapRouter),
      });

      const scenario = `${config.chain.name} ${token} (anvil)`;
      try {
        // A fresh key per token: never anvil's default accounts (account #0 is 7702-delegated on
        // some mainnets). The sender pays gas; a separate fresh recipient receives the ETH so its
        // balance delta is exactly the sale proceeds.
        const account = privateKeyToAccount(generatePrivateKey());
        const recipient = privateKeyToAccount(generatePrivateKey()).address;
        await rpc(local, "anvil_setBalance", [account.address, toHex(parseEther("10"))]);
        const walletClient = createWalletClient({ chain: config.chain, transport, account });
        const flaunch = sdk.createFlaunch({ publicClient, walletClient });
        const send = async (call, label) => {
          const hash = await walletClient.sendTransaction({ to: call.to, data: call.data, value: call.value });
          const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 600_000 });
          assert.equal(receipt.status, "success", `${label} reverted`);
          return receipt;
        };

        const acquisition = await flaunch.planPairedTokenAcquisitionForBudget({
          pairedToken: token,
          input: "eth",
          amountIn: parseEther("0.02"),
          slippageBps: 300,
          recipient: account.address,
          sender: account.address,
        });
        for (const call of [acquisition.approve, acquisition.swap].filter(Boolean)) await send(call, "acquisition");
        const held = await balanceOf(token, account.address);
        assert(held >= acquisition.target, "acquisition delivered less than its target");

        const quote = await flaunch.quotePairedTokenDisposal({ pairedToken: token, output: "eth", amountIn: held });
        const amountOutMinimum = (quote.expectedOut * 9_800n) / 10_000n;
        const plan = await flaunch.planPairedTokenDisposal({
          pairedToken: token,
          output: "eth",
          amountIn: held,
          amountOutMinimum,
          recipient,
          sender: account.address,
          route: quote.route,
        });
        assert(plan.approve, "a fresh wallet has no allowance, so the plan must approve");

        // A minimum above anything the pool can pay must revert (price protection is live)
        const greedy = await flaunch.planPairedTokenDisposal({
          pairedToken: token,
          output: "eth",
          amountIn: held,
          amountOutMinimum: quote.expectedOut * 2n,
          recipient,
          sender: account.address,
          route: quote.route,
        });

        const routerBefore = await routerState(token);
        const recipientBefore = await publicClient.getBalance({ address: recipient });
        await send(plan.approve, "disposal approve");
        let greedyReverted = false;
        try {
          await publicClient.call({ account: account.address, to: greedy.swap.to, data: greedy.swap.data, value: 0n });
        } catch {
          greedyReverted = true;
        }
        assert(greedyReverted, "a minimum of 2x the quote did not revert");
        await send(plan.swap, "disposal swap");

        const received = (await publicClient.getBalance({ address: recipient })) - recipientBefore;
        const routerAfter = await routerState(token);
        const left = await balanceOf(token, account.address);
        assert.equal(left, 0n, "sender still holds paired token");
        assert(received >= amountOutMinimum, `received ${received} < minimum ${amountOutMinimum}`);
        assert.deepEqual(routerAfter, routerBefore, "router balances changed (dust kept)");

        record({
          scenario,
          result: "PASS",
          chainId,
          mode: "anvil",
          spentEth: parseEther("0.02"),
          acquired: held,
          quoteSource: quote.source,
          route: quote.route,
          expectedOut: quote.expectedOut,
          amountOutMinimum,
          received,
          receivedVsQuoteBps: Number((received * 10_000n) / quote.expectedOut),
          routerDust: { before: routerBefore, after: routerAfter },
          greedyMinimumReverted: greedyReverted,
        });
      } catch (error) {
        const message = error.shortMessage || error.message;
        record({
          scenario,
          result: "FAIL",
          chainId,
          mode: "anvil",
          error: message,
          ...(/internal error/i.test(message)
            ? { note: `likely the upstream pruned the forked block ("historical state is not available" in anvil's log); use an archive RPC in FORK_RPC_* or DISPOSAL_MODE_${chainId}=simulate` }
            : {}),
        });
      }
        } finally {
      child.kill();
    }
  }
}

async function main() {
  const chainIds = (process.env.DISPOSAL_CHAINS || `${base.id},${robinhood.id}`)
    .split(",")
    .map((id) => Number(id.trim()));
  for (const chainId of chainIds) {
    assert(CHAINS[chainId], `unsupported chain ${chainId}`);
    await runChain(chainId);
  }
  if (process.env.DISPOSAL_RESULTS) fs.writeFileSync(process.env.DISPOSAL_RESULTS, json(results));
  const failed = results.filter((r) => r.result === "FAIL");
  console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
