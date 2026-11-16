import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicClient, custom, decodeAbiParameters, encodeFunctionResult, numberToHex, zeroAddress } from "viem";
import { baseSepolia } from "viem/chains";
import { buildSwap, quoteSwap, V4QuoterAbi } from "../dist/index.mjs";

const COIN = "0x103C75830bf8c64A24C99D44c425347F1996Feb0";
const ACCOUNT = "0x1111111111111111111111111111111111111111";
const ROUTER = "0x8702463e73f74d0b6765aBceb314Ef07aCb92650";
const HOOK = "0x2dc217AF94875078979E9B7875f4d22b0fBEa5d4";

const exactInSingle = {
  type: "tuple",
  components: [
    {
      name: "poolKey",
      type: "tuple",
      components: [
        { name: "currency0", type: "address" },
        { name: "currency1", type: "address" },
        { name: "fee", type: "uint24" },
        { name: "tickSpacing", type: "int24" },
        { name: "hooks", type: "address" },
      ],
    },
    { name: "zeroForOne", type: "bool" },
    { name: "amountIn", type: "uint128" },
    { name: "amountOutMinimum", type: "uint128" },
    { name: "minHopPriceX36", type: "uint256" },
    { name: "hookData", type: "bytes" },
  ],
};
const currencyAmount = [{ type: "address" }, { type: "uint256" }];

// The swap, SETTLE_ALL and TAKE_ALL params inside a V4_SWAP input
function decodeV4Swap(input) {
  const [actions, [swap, settle, take]] = decodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], input);
  return {
    actions,
    swap: decodeAbiParameters([exactInSingle], swap)[0],
    settle: decodeAbiParameters(currencyAmount, settle),
    take: decodeAbiParameters(currencyAmount, take),
  };
}

test("an ETH buy sends V4_SWAP with the input as value and sweeps unspent ETH back", () => {
  const call = buildSwap({
    chainId: 84532,
    tokenIn: zeroAddress,
    tokenOut: COIN,
    amountIn: 10n ** 16n,
    amountOutMinimum: 1_000n,
    account: ACCOUNT,
    deadline: 1_900_000_000n,
  });
  const [commands, inputs] = call.args;

  assert.equal(call.address, ROUTER);
  assert.equal(call.value, 10n ** 16n);
  // V4_SWAP, then SWEEP
  assert.equal(commands, "0x1004");
  const { actions, swap, settle, take } = decodeV4Swap(inputs[0]);
  // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL
  assert.equal(actions, "0x060c0f");
  assert.deepEqual(swap, {
    poolKey: { currency0: zeroAddress, currency1: COIN, fee: 0, tickSpacing: 60, hooks: HOOK },
    zeroForOne: true,
    amountIn: 10n ** 16n,
    amountOutMinimum: 1_000n,
    // 1,000 out per 10^16 in, scaled by 10^36
    minHopPriceX36: 10n ** 23n,
    hookData: "0x",
  });
  assert.deepEqual(settle, [zeroAddress, 10n ** 16n]);
  assert.deepEqual(take, [COIN, 1_000n]);
  assert.deepEqual(decodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "uint256" }], inputs[1]), [
    zeroAddress,
    ACCOUNT,
    0n,
  ]);
});

test("an ERC20 sell pulls the coin through PERMIT2_PERMIT and sends no ETH", () => {
  const permit = {
    details: { token: COIN, amount: 5n * 10n ** 18n, expiration: 1_900_000_900, nonce: 0 },
    spender: ROUTER,
    sigDeadline: 1_900_000_300n,
  };
  const call = buildSwap({
    chainId: 84532,
    tokenIn: COIN,
    tokenOut: zeroAddress,
    amountIn: 5n * 10n ** 18n,
    amountOutMinimum: 1n,
    account: ACCOUNT,
    deadline: 1_900_000_000n,
    permit: { permit, signature: `0x${"ab".repeat(65)}` },
  });
  const [commands, inputs] = call.args;

  assert.equal(call.value, 0n);
  // PERMIT2_PERMIT, then V4_SWAP
  assert.equal(commands, "0x0a10");
  const [, signature] = decodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { type: "tuple", components: [{ type: "address" }, { type: "uint160" }, { type: "uint48" }, { type: "uint48" }] },
          { type: "address" },
          { type: "uint256" },
        ],
      },
      { type: "bytes" },
    ],
    inputs[0],
  );
  assert.equal(signature, `0x${"ab".repeat(65)}`);

  const { swap, settle, take } = decodeV4Swap(inputs[1]);
  assert.deepEqual(swap, {
    poolKey: { currency0: zeroAddress, currency1: COIN, fee: 0, tickSpacing: 60, hooks: HOOK },
    zeroForOne: false,
    amountIn: 5n * 10n ** 18n,
    amountOutMinimum: 1n,
    // 1 out per 5 * 10^18 in, scaled by 10^36
    minHopPriceX36: 2n * 10n ** 17n,
    hookData: "0x",
  });
  assert.deepEqual(settle, [COIN, 5n * 10n ** 18n]);
  assert.deepEqual(take, [zeroAddress, 1n]);
});

test("a quote runs as the swapper, so the hook sees the same sender as the swap", async () => {
  const calls = [];
  const client = createPublicClient({
    chain: baseSepolia,
    transport: custom({
      async request({ method, params }) {
        if (method === "eth_chainId") return numberToHex(baseSepolia.id);
        calls.push(params[0]);
        return encodeFunctionResult({ abi: V4QuoterAbi, functionName: "quoteExactInputSingle", result: [123n, 1n] });
      },
    }),
  });

  const amountOut = await quoteSwap(client, { chainId: 84532, tokenIn: zeroAddress, tokenOut: COIN, amountIn: 1n, account: ACCOUNT });

  assert.equal(amountOut, 123n);
  assert.equal(calls[0].from, ACCOUNT);
});
