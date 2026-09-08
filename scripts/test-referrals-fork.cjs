/** Opt-in integration test. All writes are restricted to an isolated Anvil fork. */
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
  encodeAbiParameters,
  encodeFunctionData,
  parseAbi,
  zeroAddress,
  isAddressEqual,
} = require("viem");
const { base, baseSepolia, robinhood } = require("viem/chains");
const LOCAL = process.env.REFERRAL_FORK_RPC || "http://127.0.0.1:18565";
const CHAIN = [base, baseSepolia, robinhood].find(
  (chain) => chain.id === Number(process.env.REFERRAL_CHAIN_ID || "8453"),
);
assert(CHAIN, "Supported chain is required");
assert.equal(
  process.env.REFERRAL_LOCAL_FORK,
  "1",
  "Set REFERRAL_LOCAL_FORK=1 for isolated fork testing",
);
assert(
  ["127.0.0.1", "localhost"].includes(new URL(LOCAL).hostname),
  "Only localhost may receive writes",
);
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");
const gateSigner = privateKeyToAccount(generatePrivateKey());
const results = [];
async function rpc(method, params = []) {
  const body = await (
    await fetch(LOCAL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(60000),
    })
  ).json();
  if (body.error) throw Error(JSON.stringify(body.error));
  return body.result;
}
async function main() {
  assert.equal(
    await rpc("eth_chainId"),
    "0x7a69",
    "Fork must have chain ID 31337",
  );
  const accounts = await rpc("eth_accounts");
  const [trader, referrer, recipient] = accounts;
  // Standard Anvil addresses can have real EIP-7702 delegations on a fork. These synthetic
  // test wallets must behave as plain EOAs, not execute unrelated mainnet forwarding code.
  for (const account of [trader, referrer, recipient])
    await rpc("anvil_setCode", [account, "0x"]);
  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(LOCAL, { timeout: 60000, retryCount: 0 }),
  });
  const read = sdk.createFlaunch({ publicClient });
  const calldata = sdk.createFlaunchCalldata({
    publicClient,
    walletAddress: trader,
  });
  const claimData = sdk.createFlaunchCalldata({
    publicClient,
    walletAddress: referrer,
  });
  const wallet = createWalletClient({
    account: referrer,
    chain: { ...CHAIN, id: 31337 },
    transport: http(LOCAL),
  });
  const claimWriter = new sdk.ReadWriteFlaunchSDK(
    CHAIN.id,
    sdk.createDrift({ publicClient, walletClient: wallet }),
    publicClient,
  );
  const initialBlock = await publicClient.getBlockNumber();
  async function send(call, from = trader, expected = "success") {
    assert.equal(await rpc("eth_chainId"), "0x7a69");
    const hash = await rpc("eth_sendTransaction", [
      {
        from,
        to: call.to,
        data: call.data,
        value: toHex(call.value || 0n),
        gas: toHex(15000000n),
      },
    ]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, expected, `Local transaction ${hash}`);
    return receipt;
  }
  async function balance(token, owner) {
    return isAddressEqual(token, zeroAddress)
      ? publicClient.getBalance({ address: owner })
      : publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner],
        });
  }
  const scenarios = [
    { pairing: zeroAddress },
    { pairing: sdk.FLETHAddress[CHAIN.id] },
  ];
  if (process.env.REFERRAL_GATE)
    scenarios.push({ pairing: zeroAddress, gate: process.env.REFERRAL_GATE });
  for (const { pairing, gate } of scenarios) {
    let feeCalculatorParams = "0x";
    if (gate) {
      const block = await publicClient.getBlock({ blockTag: "latest" });
      const tagged = encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "bool" },
          { type: "uint256" },
          { type: "address" },
          { type: "address" },
          { type: "uint256" },
        ],
        [
          require("viem").keccak256(toHex("flaunch.spendGate.params")),
          true,
          parseEther("1"),
          gateSigner.address,
          trader,
          block.timestamp + 1800n,
        ],
      );
      feeCalculatorParams = encodeAbiParameters(
        [{ type: "bytes32" }, { type: "address" }, { type: "bytes" }],
        [
          require("viem").keccak256(toHex("flaunch.dispatcher.route.v1")),
          gate,
          tagged,
        ],
      );
    }
    const flaunchParams = {
      name: "Referral local test",
      symbol: "REFTEST",
      tokenUri: "ipfs://local-only",
      premineAmount: 0n,
      creator: trader,
      creatorFeeAllocation: 5000,
      flaunchAt: 0n,
      initialPriceParams: encodeAbiParameters(
        [{ type: "uint256" }],
        [4000000000n],
      ),
      feeCalculatorParams,
      pairedToken: pairing,
    };
    const zap = new sdk.ReadFlaunchZapV1_3(
      sdk.FlaunchZapV1_3Address[CHAIN.id],
      sdk.createDrift({ publicClient }),
    );
    const fee = await zap.calculateFee({ flaunchParams, slippageBps: 50n });
    const launched = await send(
      sdk.decodeCallData(
        await calldata.flaunchPairedToken({
          flaunchParams,
          trustedFeeSigner: zeroAddress,
          maxPremineCost: 0n,
          value: fee.ethRequired,
        }),
      ),
    );
    const created = read.getPoolCreatedFromLogs(launched.logs);
    assert(created?.memecoin);
    const coinAddress = created.memecoin;
    for (const direction of ["buy", "sell"]) {
      const amountIn =
        direction === "buy"
          ? parseEther("0.0001")
          : await balance(coinAddress, trader);
      if (direction === "buy" && pairing !== zeroAddress) {
        await send({
          to: pairing,
          data: encodeFunctionData({
            abi: parseAbi(["function deposit(uint256 wethAmount) payable"]),
            functionName: "deposit",
            args: [0n],
          }),
          value: amountIn,
        });
      }
      let hookData;
      if (gate) {
        const pool = await read.resolvePairedPool(coinAddress, pairing);
        const block = await publicClient.getBlock({ blockTag: "latest" });
        const message = {
          buyer: trader,
          poolId: pool.poolId,
          deadline: block.timestamp + 600n,
          maxSpendWei: parseEther("1"),
          nonce: direction === "buy" ? 1n : 2n,
        };
        const hash = await publicClient.readContract({
          address: gate,
          abi: parseAbi([
            "function hashSpendAuthorization(address,bytes32,uint256,uint256,uint256) view returns (bytes32)",
          ]),
          functionName: "hashSpendAuthorization",
          args: [
            message.buyer,
            message.poolId,
            message.deadline,
            message.maxSpendWei,
            message.nonce,
          ],
        });
        hookData = sdk.encodeSpendReferralHookData(
          { ...message, signature: await gateSigner.sign({ hash }) },
          referrer,
        );
      }
      const plan = await read.planPairedTokenSwap({
        coinAddress,
        pairedToken: pairing,
        direction,
        amountIn,
        slippageBps: 100,
        sender: trader,
        referrer,
        hookData,
      });
      const config = await read.getReferralConfig({ poolKey: plan.poolKey });
      assert.equal(config.payoutMode, "escrow");
      assert(config.referralShare > 0);
      if (plan.approve) await send(plan.approve);
      // Failed swaps roll back referral allocations as well as the trade.
      const decoded = require("viem").decodeFunctionData({
        abi: sdk.PoolSwapExactInputAbi,
        data: plan.swap.data,
      });
      if (gate) {
        const invalidArgs = [...decoded.args];
        invalidArgs[2] = sdk.resolveReferralHookData({ referrer });
        const invalid = await send(
          {
            ...plan.swap,
            data: encodeFunctionData({
              abi: sdk.PoolSwapExactInputAbi,
              functionName: "swapExactInput",
              args: invalidArgs,
            }),
          },
          trader,
          "reverted",
        );
        assert.equal(
          invalid.logs.length,
          0,
          "Unsigned gated swaps cannot accrue referral fees",
        );
      }
      if (process.env.REFERRAL_TEST_DIRECT === "1" && !gate) {
        const snapshot = await rpc("evm_snapshot");
        const ownerAbi = parseAbi([
          "function owner() view returns (address)",
          "function setReferralEscrow(address)",
        ]);
        const owner = await publicClient.readContract({
          address: plan.poolKey.hooks,
          abi: ownerAbi,
          functionName: "owner",
        });
        await rpc("anvil_impersonateAccount", [owner]);
        await rpc("anvil_setBalance", [owner, toHex(parseEther("100"))]);
        await send(
          {
            to: plan.poolKey.hooks,
            data: encodeFunctionData({
              abi: ownerAbi,
              functionName: "setReferralEscrow",
              args: [zeroAddress],
            }),
          },
          owner,
        );
        assert.equal(
          (await read.getReferralConfig({ poolKey: plan.poolKey })).payoutMode,
          "direct",
        );
        const feeToken = direction === "buy" ? coinAddress : pairing;
        const beforeDirect = await balance(feeToken, referrer);
        const direct = await send(plan.swap);
        const payments = sdk.decodeReferralEvents(direct.logs, {
          chainId: CHAIN.id,
          hooks: [plan.poolKey.hooks],
          escrows: [],
        });
        assert.equal(payments.length, 1);
        assert.equal(payments[0].kind, "paid");
        assert.equal(
          (await balance(feeToken, referrer)) - beforeDirect,
          payments[0].amount,
        );
        await rpc("anvil_stopImpersonatingAccount", [owner]);
        assert.equal(await rpc("evm_revert", [snapshot]), true);
      }
      const badArgs = [...decoded.args];
      badArgs[3] = 2n ** 127n;
      const failed = await send(
        {
          ...plan.swap,
          data: encodeFunctionData({
            abi: sdk.PoolSwapExactInputAbi,
            functionName: "swapExactInput",
            args: badArgs,
          }),
        },
        trader,
        "reverted",
      );
      assert.equal(
        sdk.decodeReferralEvents(failed.logs, {
          chainId: CHAIN.id,
          hooks: [plan.poolKey.hooks],
          escrows: [config.escrow],
        }).length,
        0,
      );
      const receipt = await send(plan.swap);
      const assigned = sdk
        .decodeReferralEvents(receipt.logs, {
          chainId: CHAIN.id,
          hooks: [plan.poolKey.hooks],
          escrows: [config.escrow],
        })
        .filter((e) => e.kind === "assigned");
      assert.equal(assigned.length, 1, "Actual referral credit is required");
      const reward = assigned[0];
      assert(isAddressEqual(reward.user, referrer));
      assert(reward.amount > 0n);
      assert.equal(
        await read.referralBalance(referrer, reward.token, {
          escrow: config.escrow,
        }),
        reward.amount,
      );
      // Another caller cannot consume the referrer's allocation by naming its payout recipient.
      await send(
        sdk.decodeCallData(
          await calldata.claimReferralBalance([reward.token], referrer, {
            escrow: config.escrow,
          }),
        ),
      );
      assert.equal(
        await read.referralBalance(referrer, reward.token, {
          escrow: config.escrow,
        }),
        reward.amount,
      );
      const claimSnapshot = await rpc("evm_snapshot");
      const payoutToken = isAddressEqual(
        reward.token,
        sdk.FLETHAddress[CHAIN.id],
      )
        ? zeroAddress
        : reward.token;
      const beforeUnwrap = await balance(payoutToken, recipient);
      await send(
        sdk.decodeCallData(
          await claimData.claimReferralBalance([reward.token], recipient, {
            escrow: config.escrow,
          }),
        ),
        referrer,
      );
      assert.equal(
        (await balance(payoutToken, recipient)) - beforeUnwrap,
        reward.amount,
        "Default claim must deliver the expected asset",
      );
      assert.equal(await rpc("evm_revert", [claimSnapshot]), true);
      const before = await balance(reward.token, recipient);
      let claimed;
      if (direction === "buy") {
        claimed = await send(
          sdk.decodeCallData(
            await claimData.claimReferralBalance([reward.token], recipient, {
              escrow: config.escrow,
              unwrap: false,
            }),
          ),
          referrer,
        );
      } else {
        assert.equal(await rpc("eth_chainId"), "0x7a69");
        const hash = await claimWriter.claimReferralBalance(
          [reward.token],
          recipient,
          { escrow: config.escrow, unwrap: false },
        );
        claimed = await publicClient.waitForTransactionReceipt({ hash });
        assert.equal(claimed.status, "success");
      }
      assert.equal(
        (await balance(reward.token, recipient)) - before,
        reward.amount,
      );
      // A fresh read must observe the claim rather than a cached pre-claim allocation.
      assert.equal(
        await read.referralBalance(referrer, reward.token, {
          escrow: config.escrow,
        }),
        0n,
      );
      assert.equal(
        sdk.decodeReferralEvents(claimed.logs, {
          chainId: CHAIN.id,
          hooks: [],
          escrows: [config.escrow],
        })[0].kind,
        "claimed",
      );
      results.push({
        chainId: CHAIN.id,
        forkBlock: initialBlock.toString(),
        pairing,
        direction,
        coinAddress,
        hook: plan.poolKey.hooks,
        escrow: config.escrow,
        token: reward.token,
        amount: reward.amount.toString(),
        gated: Boolean(gate),
        defaultUnwrap: "PASS",
        rawClaim: "PASS",
        unauthorizedClaim: "PASS",
        rollback: "PASS",
        referralShare: config.referralShare,
        swapHash: receipt.transactionHash,
        claimHash: claimed.transactionHash,
        result: "PASS",
      });
      console.log(JSON.stringify(results.at(-1)));
    }
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (process.env.REFERRAL_FORK_RESULTS)
      fs.writeFileSync(
        process.env.REFERRAL_FORK_RESULTS,
        JSON.stringify(results, null, 2),
      );
  });
