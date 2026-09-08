const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionResult,
  encodeEventTopics,
  parseAbi,
  zeroAddress,
  toHex,
} = require("viem");
const { base, robinhood } = require("viem/chains");
const sdk = require("../dist/index.cjs.js");
const USER = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const TOKEN = "0x3333333333333333333333333333333333333333";
const ESCROW = "0x4444444444444444444444444444444444444444";
const HOOK = "0x5555555555555555555555555555555555555555";
const POOL = {
  currency0: zeroAddress,
  currency1: TOKEN,
  fee: 0,
  tickSpacing: 60,
  hooks: HOOK,
};
const POOL_ID = sdk.getPoolId(POOL);
const HASH = `0x${"12".repeat(32)}`;
const allocationAbi = parseAbi([
  "function allocations(address _user,address _token) view returns (uint256)",
]);
const aggregateAbi = parseAbi([
  "function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[])",
]);

function makePublic({
  chain = base,
  escrow = ESCROW,
  unwrap = true,
  rpcError = false,
  code = "0x6000",
  allocation,
  clientFactory = createPublicClient,
} = {}) {
  const calls = [];
  function answer(call) {
    calls.push(call);
    if (
      call.to.toLowerCase() === "0xca11bde05977b3631167028862be2a173976ca11"
    ) {
      const [inner] = decodeFunctionData({
        abi: aggregateAbi,
        data: call.data,
      }).args;
      return encodeFunctionResult({
        abi: aggregateAbi,
        functionName: "aggregate3",
        result: inner.map((c) => ({
          success: true,
          returnData: answer({ to: c.target, data: c.callData }),
        })),
      });
    }
    if (call.to.toLowerCase() === HOOK.toLowerCase()) {
      const d = decodeFunctionData({
        abi: sdk.ReferralFeeAbi,
        data: call.data,
      });
      if (d.functionName === "referralEscrow")
        return encodeAbiParameters([{ type: "address" }], [escrow]);
      assert.equal(d.args[0], POOL_ID);
      return encodeFunctionResult({
        abi: sdk.ReferralFeeAbi,
        functionName: "getPoolFeeDistribution",
        result: { swapFee: 100, referrer: 750, protocol: 1000, active: true },
      });
    }
    if (
      call.data.startsWith(
        "0x" +
          require("viem")
            .toFunctionSelector("claimTokens(address[],address,bool)")
            .slice(2),
      )
    ) {
      if (rpcError)
        throw Object.assign(new Error("RPC unavailable"), { code: -32005 });
      if (!unwrap)
        throw Object.assign(new Error("execution reverted"), {
          code: 3,
          data: "0x",
        });
      const d = decodeFunctionData({
        abi: sdk.ReferralEscrowUnwrapAbi,
        data: call.data,
      });
      assert.deepEqual(d.args[0], []);
      return "0x";
    }
    const d = decodeFunctionData({ abi: allocationAbi, data: call.data });
    assert.equal(d.args[0], USER);
    return encodeAbiParameters(
      [{ type: "uint256" }],
      [
        allocation
          ? allocation()
          : call.to.toLowerCase() === ESCROW
            ? 42n
            : 17n,
      ],
    );
  }
  const client = clientFactory({
    chain,
    transport: custom(
      {
        async request({ method, params }) {
          if (method === "eth_chainId") return toHex(chain.id);
          if (method === "eth_blockNumber") return "0x64";
          if (method === "eth_getCode") return code;
          if (method === "eth_call") return answer(params[0]);
          throw new Error(`Unexpected RPC ${method}`);
        },
      },
      { retryCount: 0 },
    ),
  });
  return { client, calls };
}

test("ordinary attribution validates addresses and conflicting opaque payloads", () => {
  assert.equal(sdk.resolveReferralHookData({}), "0x");
  assert.equal(sdk.resolveReferralHookData({ referrer: zeroAddress }), "0x");
  const payload = sdk.resolveReferralHookData({ referrer: USER });
  assert.equal(sdk.decodeReferralHookData(payload), USER);
  assert.equal(
    sdk.resolveReferralHookData({ referrer: USER, hookData: payload }),
    payload,
  );
  assert.throws(
    () => sdk.resolveReferralHookData({ referrer: OTHER, hookData: payload }),
    /conflicts/,
  );
  assert.throws(
    () => sdk.resolveReferralHookData({ referrer: USER, hookData: "0x" }),
    /conflicts/,
  );
  for (const hookData of ["0x12", "0xgg", `0x${"ff".repeat(32)}`]) {
    assert.throws(() => sdk.resolveReferralHookData({ hookData }));
  }
  assert.throws(
    () => sdk.resolveReferralHookData({ referrer: "no" }),
    /Invalid referrer/,
  );
});

test("trusted and spend-gated payloads preserve every authorization field and signature", () => {
  const message = {
    poolId: POOL_ID,
    deadline: 999n,
    signature: `0x${"ab".repeat(65)}`,
  };
  const trusted = sdk.encodeTrustedReferralHookData(message, USER);
  assert.deepEqual(sdk.decodeTrustedReferralHookData(trusted), {
    referrer: USER,
    message,
  });
  const spend = { ...message, buyer: OTHER, maxSpendWei: 123n, nonce: 42n };
  const payload = sdk.encodeSpendReferralHookData(spend, USER);
  assert.deepEqual(sdk.decodeSpendReferralHookData(payload), {
    referrer: USER,
    message: spend,
  });
  assert.equal(
    sdk.resolveReferralHookData({ hookData: payload, referrer: USER }),
    payload,
  );
  assert.equal(sdk.resolveReferralHookData({ hookData: payload }), payload);
});

test("configuration reads the supplied hook and live pool-specific fee at one block", async () => {
  const { client, calls } = makePublic();
  const reader = sdk.createFlaunch({ publicClient: client });
  const config = await reader.getReferralConfig({ poolKey: POOL });
  assert.equal(config.referralShare, 750);
  assert.equal(config.denominator, 10000);
  assert.equal(config.blockNumber, 100n);
  assert.equal(config.payoutMode, "escrow");
  assert.deepEqual(config.claimCapabilities, {
    escrow: ESCROW,
    supportsUnwrap: true,
  });
  assert.equal(calls.filter((c) => c.to === HOOK).length, 2);
});

test("direct-payment configuration has no escrow or claim capability probe", async () => {
  const { client, calls } = makePublic({ escrow: zeroAddress });
  const config = await sdk
    .createFlaunch({ publicClient: client })
    .getReferralConfig({ poolKey: POOL });
  assert.equal(config.payoutMode, "direct");
  assert.equal(config.claimCapabilities, null);
  assert.equal(calls.length, 2);
});

test("balances retain chain, escrow and token including older escrows and native token", async () => {
  const { client } = makePublic({ chain: robinhood });
  const reader = sdk.createFlaunch({ publicClient: client });
  assert.deepEqual(
    await reader.referralBalances({
      recipient: USER,
      balances: [
        { escrow: ESCROW, token: TOKEN },
        { escrow: OTHER, token: zeroAddress },
      ],
    }),
    [
      { chainId: robinhood.id, escrow: ESCROW, token: TOKEN, amount: 42n },
      { chainId: robinhood.id, escrow: OTHER, token: zeroAddress, amount: 17n },
    ],
  );
});

test("legacy claim signature/address remain default; explicit escrow works on Robinhood", async () => {
  for (const chain of [base, robinhood]) {
    const { client } = makePublic({ chain });
    const writer = sdk.createFlaunchCalldata({
      publicClient: client,
      walletAddress: USER,
    });
    const tx = sdk.decodeCallData(
      await writer.claimReferralBalance([TOKEN], OTHER, { escrow: ESCROW }),
    );
    assert.equal(tx.to, ESCROW);
    assert.deepEqual(
      decodeFunctionData({ abi: sdk.ReferralEscrowAbi, data: tx.data }).args,
      [[TOKEN], OTHER],
    );
    if (chain.id === base.id) {
      const legacy = sdk.decodeCallData(
        await writer.claimReferralBalance([TOKEN], USER),
      );
      assert.equal(
        legacy.to.toLowerCase(),
        sdk.ReferralEscrowAddress[base.id].toLowerCase(),
      );
      assert.equal(await writer.referralBalance(USER, TOKEN), 17n);
    }
  }
});

test("unwrap=false encodes the current overload, rejects old escrows and propagates RPC errors", async () => {
  for (const unwrap of [true, false]) {
    const { client } = makePublic({ unwrap });
    const writer = sdk.createFlaunchCalldata({
      publicClient: client,
      walletAddress: USER,
    });
    const run = () =>
      writer.claimReferralBalance([TOKEN, zeroAddress], OTHER, {
        escrow: ESCROW,
        unwrap: false,
      });
    if (unwrap) {
      const tx = sdk.decodeCallData(await run());
      assert.equal(tx.to, ESCROW);
      assert.deepEqual(
        decodeFunctionData({ abi: sdk.ReferralEscrowUnwrapAbi, data: tx.data })
          .args,
        [[TOKEN, zeroAddress], OTHER, false],
      );
    } else await assert.rejects(run, /does not support unwrap=false/);
  }
  const { client } = makePublic({ rpcError: true });
  const writer = sdk.createFlaunchCalldata({
    publicClient: client,
    walletAddress: USER,
  });
  await assert.rejects(
    () => writer.getReferralEscrowCapabilities(ESCROW),
    /RPC unavailable/,
  );
  await assert.rejects(
    () => writer.claimReferralBalance([TOKEN], USER, { escrow: zeroAddress }),
    /nonzero/,
  );
  const missing = makePublic({ code: "0x" });
  await assert.rejects(
    () =>
      sdk
        .createFlaunch({ publicClient: missing.client })
        .getReferralEscrowCapabilities(ESCROW),
    /no deployed code/,
  );
});

function eventLog(eventName, args, address) {
  const event = sdk.ReferralEventsAbi.find((e) => e.name === eventName);
  return {
    address,
    topics: encodeEventTopics({ abi: sdk.ReferralEventsAbi, eventName, args }),
    data: encodeAbiParameters(
      event.inputs.filter((i) => !i.indexed),
      event.inputs.filter((i) => !i.indexed).map((i) => args[i.name]),
    ),
    transactionHash: HASH,
    logIndex: 1,
    blockNumber: 100n,
    blockHash: HASH,
    transactionIndex: 0,
    removed: false,
  };
}

test("earnings decode actual assignment/direct/claim logs with correct indexed fields and emitters", () => {
  const assigned = eventLog(
    "TokensAssigned",
    { _poolId: POOL_ID, _user: USER, _token: TOKEN, _amount: 42n },
    ESCROW,
  );
  const claimed = eventLog(
    "TokensClaimed",
    { _user: USER, _recipient: OTHER, _token: TOKEN, _amount: 20n },
    ESCROW,
  );
  const paid = eventLog(
    "ReferrerFeePaid",
    { _poolId: POOL_ID, _recipient: USER, _token: zeroAddress, _amount: 10n },
    HOOK,
  );
  const events = sdk.decodeReferralEvents(
    [
      assigned,
      claimed,
      paid,
      { ...assigned, address: OTHER },
      { ...paid, removed: true },
    ],
    { chainId: base.id, escrows: [ESCROW], hooks: [HOOK] },
  );
  assert.deepEqual(
    events.map((e) => [e.kind, e.token, e.amount, e.recipient]),
    [
      ["assigned", TOKEN, 42n, USER],
      ["claimed", TOKEN, 20n, OTHER],
      ["paid", zeroAddress, 10n, USER],
    ],
  );
  assert.equal(events[0].emitter, ESCROW);
  assert.equal(events[0].poolId, POOL_ID);
});

// Quote/execution regression tests exercise high-level methods without depending on RPC internals.
function recordingSdk() {
  const quotes = [],
    writes = [];
  const drift = {
    contract({ address }) {
      return {
        address,
        cache: { clear: async () => {} },
        read: async () => 0n,
      };
    },
    getSignerAddress: async () => OTHER,
    adapter: {
      write: async (call) => {
        writes.push(call);
        return HASH;
      },
    },
    write: async (call) => {
      writes.push(call);
      return HASH;
    },
  };
  const writer = new sdk.ReadWriteFlaunchSDK(base.id, drift);
  writer.getPositionManagerAddressForCoin = async () => HOOK;
  for (const name of [
    "getBuyQuoteExactInput",
    "getBuyQuoteExactOutput",
    "getSellQuoteExactInput",
  ]) {
    writer.readQuoter[name] = async (args) => {
      quotes.push(args);
      return 100n;
    };
  }
  return { writer, quotes, writes };
}

test("ordinary buy/sell quotes use the same referral payload as execution, including exact output", async () => {
  const { writer, quotes, writes } = recordingSdk();
  await writer.buyCoin({
    coinAddress: TOKEN,
    amountIn: 1000n,
    swapType: "EXACT_IN",
    slippagePercent: 1,
    referrer: USER,
  });
  await writer.buyCoin({
    coinAddress: TOKEN,
    amountOut: 10n,
    swapType: "EXACT_OUT",
    slippagePercent: 1,
    referrer: USER,
  });
  await writer.sellCoin({
    coinAddress: TOKEN,
    amountIn: 10n,
    slippagePercent: 1,
    referrer: USER,
  });
  const data = sdk.resolveReferralHookData({ referrer: USER });
  assert.equal(quotes.length, 3);
  assert.equal(writes.length, 3);
  assert.ok(quotes.every((q) => q.hookData === data));
  assert.ok(
    writes.every((w) =>
      w.args.inputs.some((input) =>
        input.toLowerCase().includes(USER.slice(2)),
      ),
    ),
  );
  const before = quotes.length;
  await assert.rejects(
    () =>
      writer.buyCoin({
        coinAddress: TOKEN,
        amountIn: 100n,
        swapType: "EXACT_IN",
        slippagePercent: 1,
        referrer: OTHER,
        hookData: data,
      }),
    /conflicts/,
  );
  assert.equal(quotes.length, before);
});

test("public quote helpers accept referrer and gated sell authorization", async () => {
  const { writer, quotes } = recordingSdk();
  const hookData = sdk.encodeSpendReferralHookData(
    {
      buyer: OTHER,
      poolId: POOL_ID,
      deadline: 999n,
      maxSpendWei: 1n,
      nonce: 0n,
      signature: "0x12",
    },
    USER,
  );
  await writer.getSellQuoteExactInput({
    coinAddress: TOKEN,
    amountIn: 10n,
    referrer: USER,
    hookData,
    userWallet: OTHER,
  });
  await writer.getBuyQuoteExactInput({
    coinAddress: TOKEN,
    amountIn: 10n,
    referrer: USER,
  });
  await writer.getBuyQuoteExactOutput({
    coinAddress: TOKEN,
    amountOut: 10n,
    referrer: USER,
  });
  assert.equal(quotes[0].hookData, hookData);
  assert.equal(quotes[0].userWallet, OTHER);
  assert.ok(
    quotes
      .slice(1)
      .every((q) => sdk.decodeReferralHookData(q.hookData) === USER),
  );
});

test("balance reads refresh after claims instead of reusing the pre-claim allocation", async () => {
  let amount = 42n;
  const { client } = makePublic({ allocation: () => amount });
  const reader = sdk.createFlaunch({ publicClient: client });
  assert.equal(
    await reader.referralBalance(USER, TOKEN, { escrow: ESCROW }),
    42n,
  );
  amount = 0n;
  assert.equal(
    await reader.referralBalance(USER, TOKEN, { escrow: ESCROW }),
    0n,
  );
});

test("standalone example uses app-owned address links and groups calldata by escrow", async () => {
  const example = await import("../examples/referrals.mjs");
  const url = example.referralLink(
    "https://third-party.example/coin?tab=trade",
    USER,
  );
  assert.equal(example.referrerFromLink(url), USER);
  assert.equal(new URL(url).searchParams.get("tab"), "trade");
  assert.equal(
    example.referrerFromLink("https://third-party.example/?ref=invalid"),
    undefined,
  );
  const { client } = makePublic();
  const calls = await example.buildReferralClaims(client, USER, OTHER, [
    { chainId: base.id, escrow: ESCROW, token: TOKEN, amount: 1n },
    { chainId: base.id, escrow: ESCROW, token: zeroAddress, amount: 2n },
    { chainId: base.id, escrow: OTHER, token: TOKEN, amount: 3n },
    { chainId: base.id, escrow: USER, token: TOKEN, amount: 0n },
  ]);
  assert.deepEqual(
    calls.map((c) => c.to),
    [ESCROW, OTHER],
  );
  assert.deepEqual(
    decodeFunctionData({ abi: sdk.ReferralEscrowAbi, data: calls[0].data })
      .args,
    [[TOKEN, zeroAddress], OTHER],
  );
});

// A common Node consumer mixes an ESM viem client with the SDK's CJS entrypoint.
test("legacy capability detection survives viem ESM/CJS error class boundaries", async () => {
  const { createPublicClient: esmFactory } = await import("viem");
  const { client } = makePublic({ unwrap: false, clientFactory: esmFactory });
  const reader = sdk.createFlaunch({ publicClient: client });
  assert.deepEqual(await reader.getReferralEscrowCapabilities(ESCROW), {
    escrow: ESCROW,
    supportsUnwrap: false,
  });
});
