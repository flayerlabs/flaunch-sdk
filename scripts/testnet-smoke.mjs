// Quotes, buys and Permit2-sells the Base Sepolia coin launched at nonce 0, through the built package.
// With PRIVATE_KEY it sends each transaction from that wallet and checks the receipt. Without it, a throwaway
// wallet simulates the same transactions in one eth_simulateV1 call, so the run spends nothing.
import { createPublicClient, createWalletClient, erc20Abi, http, parseEther, zeroAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import {
  buildSwap,
  deployment,
  findRecipient,
  permitTypedData,
  quoteDevBuy,
  quoteSwap,
  readPermit2Allowance,
} from "../dist/index.mjs";

const COIN = "0x103C75830bf8c64A24C99D44c425347F1996Feb0";
const BUY = parseEther("0.0001");
const chainId = baseSepolia.id;

const { RPC_URL, PRIVATE_KEY } = process.env;
if (!RPC_URL) throw new Error("Set RPC_URL");
const live = Boolean(PRIVATE_KEY);
const account = privateKeyToAccount(PRIVATE_KEY ?? generatePrivateKey());
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
const walletClient = createWalletClient({ chain: baseSepolia, transport: http(RPC_URL), account });
const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
const withSlippage = (amount) => (amount * 99n) / 100n;
const swapper = { chainId, account: account.address };

const tokensOut = await quoteSwap(publicClient, { ...swapper, tokenIn: zeroAddress, tokenOut: COIN, amountIn: BUY });
const buy = buildSwap({ ...swapper, tokenIn: zeroAddress, tokenOut: COIN, amountIn: BUY, amountOutMinimum: withSlippage(tokensOut), deadline });

// Sell what the buy is guaranteed to deliver. The quote is taken before the buy raises the price, so it is a floor.
const sellAmount = withSlippage(tokensOut);
const ethOut = await quoteSwap(publicClient, { ...swapper, tokenIn: COIN, tokenOut: zeroAddress, amountIn: sellAmount });
const approve = { address: COIN, abi: erc20Abi, functionName: "approve", args: [deployment(chainId).permit2, sellAmount] };
const { nonce } = await readPermit2Allowance(publicClient, chainId, account.address, COIN);
const typedData = permitTypedData(chainId, { token: COIN, amount: sellAmount, expiration: Number(deadline), nonce }, deadline);
const permit = { permit: typedData.message, signature: await account.signTypedData(typedData) };
const sell = buildSwap({ ...swapper, tokenIn: COIN, tokenOut: zeroAddress, amountIn: sellAmount, amountOutMinimum: withSlippage(ethOut), deadline, permit });

// A dev-buy preview must work for a wallet that holds no ETH yet
const burn = await findRecipient(publicClient, chainId, { kind: "BUY_AND_BURN" });
if (!burn) throw new Error("No buy-and-burn recipient clone on Base Sepolia");
const devBuyTokens = await quoteDevBuy(
  publicClient,
  {
    chainId,
    name: "Smoke",
    symbol: "SMOKE",
    contractURI: "ipfs://smoke",
    baseFeeBps: 100,
    startingMarketCapEth: "4",
    pairs: [{ token: zeroAddress, allocationBps: 10_000 }],
    recipients: [{ recipient: burn, percentage: 10_000 }],
    owner: account.address,
    devBuy: { amount: BUY, minOutput: 0n },
    deadline,
  },
  account.address,
);
if (devBuyTokens === 0n) throw new Error("The dev-buy quote returned no tokens");

const steps = { buy, approve, sell };
const outcome = {};
if (live) {
  for (const [name, call] of Object.entries(steps)) {
    const hash = await walletClient.writeContract(call);
    const { status } = await publicClient.waitForTransactionReceipt({ hash });
    if (status !== "success") throw new Error(`${name} ${hash} reverted`);
    outcome[name] = hash;
  }
} else {
  const { results } = await publicClient.simulateCalls({
    account: account.address,
    calls: Object.values(steps).map((call) => ({ ...call, to: call.address })),
    stateOverrides: [{ address: account.address, balance: BUY }],
  });
  Object.keys(steps).forEach((name, i) => {
    if (results[i].status !== "success") throw new Error(`${name} would revert: ${results[i].error?.shortMessage}`);
    outcome[name] = `simulated, ${results[i].gasUsed} gas`;
  });
}

console.log(
  JSON.stringify(
    { mode: live ? "live" : "read-only", account: account.address, tokensOut, ethOut, devBuyTokens, ...outcome },
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);
