import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicClient, custom, numberToHex, stringToHex, zeroAddress } from "viem";
import { baseSepolia } from "viem/chains";
import { buildDevBuyLaunch, buildGaslessLaunch, quoteDevBuy } from "../dist/index.mjs";

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const CREATOR = "0x1111111111111111111111111111111111111111";

const gasless = {
  chainId: 84532,
  name: "Test Coin",
  symbol: "TEST",
  contractURI: "ipfs://bafytest",
  baseFeeBps: 100,
  startingMarketCapEth: "4",
  pairs: [
    { token: zeroAddress, allocationBps: 5_000 },
    { token: USDC, allocationBps: 5_000, decimals: 6, ethPerToken: "0.0004" },
  ],
  owner: CREATOR,
  deadline: 1_900_000_000n,
  recipients: [
    { kind: "ADDRESS", address: CREATOR, percentage: 5_000 },
    { kind: "BUY_AND_BURN", percentage: 2_500 },
    { kind: "STAKING", percentage: 2_500 },
  ],
  // Nonce 0 launched 0x103C75830bf8c64A24C99D44c425347F1996Feb0 on Base Sepolia, which sorts after USDC
  nonce: 0n,
} as const;

test("a 50/50 ETH+USDC gasless launch at 1% encodes full allocations and binds only staking to the launch", () => {
  const call = buildGaslessLaunch(gasless);
  const [params, nonce, deadline] = call.args;

  assert.equal(call.address, "0xee9400B8B119D741B7892566c7D1d4F229b702BF");
  assert.equal(call.functionName, "launch");
  assert.equal(params.baseFee, 100n);
  assert.equal(nonce, 0n);
  assert.equal(deadline, 1_900_000_000n);
  assert.equal(params.recipient, CREATOR);

  assert.deepEqual(
    params.pairedTokens.map((pair) => [pair.token, pair.amount]),
    [
      [zeroAddress, 5_000],
      [USDC, 5_000],
    ],
  );
  // 4 ETH for 1B tokens: 250M tokens per ETH, and 10 raw USDC units per whole token with USDC as currency0
  assert.equal(params.pairedTokens[0].sqrtPriceX96, 1252707241875239655932069007848031n);
  assert.equal(params.pairedTokens[1].sqrtPriceX96, 25054144837504793118641380156960632308n);

  assert.equal(params.recipients.reduce((sum, r) => sum + r.percentage, 0), 10_000);
  assert.deepEqual(
    params.recipients.map((r) => [r.typeId, r.useLaunchId]),
    [
      [stringToHex("ADDRESS", { size: 32 }), false],
      [stringToHex("BUY_AND_BURN", { size: 32 }), false],
      [stringToHex("STAKING", { size: 32 }), true],
    ],
  );
  assert.equal(params.recipients[0].configuration, `0x${"0".repeat(24)}${CREATOR.slice(2)}`);
});

test("a launch whose predicted token sorts below USDC prices the USDC pool with the token as currency0", () => {
  // Nonce 134 predicts 0x02F57Bc03289E0CCa4615e9f2970A3c64d74fBD7. 10^10 raw tokens per 10^27 raw USDC units:
  // floor(sqrt(10^10 / 10^27) * 2^96)
  const [params] = buildGaslessLaunch({ ...gasless, nonce: 134n }).args;
  assert.equal(params.pairedTokens[1].sqrtPriceX96, 250541448375047931186n);
});

test("invalid launch input throws before encoding", () => {
  const recipients = [
    { kind: "ADDRESS", address: CREATOR, percentage: 7_499 },
    { kind: "BUY_AND_BURN", percentage: 2_500 },
  ] as const;
  assert.throws(() => buildGaslessLaunch({ ...gasless, recipients }), /recipients must total 10,000 bp/);
  assert.throws(() => buildGaslessLaunch({ ...gasless, baseFeeBps: 99 }), /baseFeeBps must be between 100 and 1,000/);
  assert.throws(() => buildGaslessLaunch({ ...gasless, baseFeeBps: 1_001 }), /baseFeeBps must be between 100 and 1,000/);

  const tooSmall = [
    { kind: "ADDRESS", address: CREATOR, percentage: 9_950 },
    { kind: "BUY_AND_BURN", percentage: 50 },
  ] as const;
  assert.throws(() => buildGaslessLaunch({ ...gasless, recipients: tooSmall }), /at least 100 bp/);
  const eleven = [...Array(10).fill({ kind: "BUY_AND_BURN", percentage: 900 }), { kind: "BUY_AND_BURN", percentage: 1_000 }];
  assert.throws(() => buildGaslessLaunch({ ...gasless, recipients: eleven }), /at most 10 recipients/);
});

test("a dev buy pays its ETH budget and rejects any non-ETH pair", () => {
  const devBuy = {
    ...gasless,
    pairs: [{ token: zeroAddress, allocationBps: 10_000 }],
    recipients: [{ recipient: CREATOR, percentage: 10_000 }],
    devBuy: { amount: 10n ** 17n, minOutput: 123n },
  };

  const call = buildDevBuyLaunch(devBuy);
  assert.equal(call.address, "0xa472AebA50d758c97975d20a819B5171f86A0540");
  assert.equal(call.value, 10n ** 17n);
  assert.deepEqual(call.args[1], [{ pairedTokenIndex: 0n, budget: 10n ** 17n, minOutput: 123n, sqrtPriceLimitX96: 0n }]);

  assert.throws(() => buildDevBuyLaunch({ ...devBuy, pairs: gasless.pairs }), /dev buy requires ETH-only pairs/);
});

test("a dev-buy quote funds the account with the dev buy, so an unfunded wallet can preview it", async () => {
  const simulations = [];
  const client = createPublicClient({
    chain: baseSepolia,
    transport: custom({
      async request({ method, params }) {
        if (method === "eth_chainId") return numberToHex(baseSepolia.id);
        simulations.push(params[0]);
        const success = { status: "0x1", returnData: "0x", gasUsed: "0x1", logs: [] };
        // viem appends a call of its own after the launch
        return [{ number: "0x1", calls: [success, success] }];
      },
    }),
  });
  const input = {
    ...gasless,
    pairs: [{ token: zeroAddress, allocationBps: 10_000 }],
    recipients: [{ recipient: CREATOR, percentage: 10_000 }],
    devBuy: { amount: 10n ** 17n, minOutput: 0n },
  };

  await quoteDevBuy(client, input, CREATOR);

  assert.deepEqual(simulations[0].blockStateCalls[0].stateOverrides, { [CREATOR]: { balance: numberToHex(10n ** 17n) } });
});
