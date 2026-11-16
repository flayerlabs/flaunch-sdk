import {
  encodeAbiParameters,
  erc20Abi,
  getContractAddress,
  keccak256,
  parseEther,
  parseEventLogs,
  zeroAddress,
  type Address,
  type Hex,
  type Client,
  type TransactionReceipt,
} from "viem";
import { simulateCalls } from "viem/actions";
import { AtomicLaunchZapAbi, FlaunchAbi, LaunchZapAbi } from "./abi/index.js";
import { deployment } from "./addresses.js";
import { recipientConfig, type RecipientSpec } from "./recipients.js";

/** Every launch mints this many whole tokens (`Flaunch.MINTED_AMOUNT`). */
const SUPPLY = 1_000_000_000n;
const ONE_HUNDRED_PERCENT = 10_000;
/** `Flaunch.MIN_RECIPIENT_PERCENTAGE` and `Flaunch.MAX_ROYALTY_RECIPIENTS`. */
const MIN_RECIPIENT_BPS = 100;
const MAX_RECIPIENTS = 10;
const MIN_SQRT_PRICE = 4295128739n;
const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;

export type LaunchPair = {
  /** The pair currency, `zeroAddress` for native ETH. */
  token: Address;
  /** Share of the launched supply placed in this pool, in basis points. */
  allocationBps: number;
  /** Required for ERC20 pairs. */
  decimals?: number;
  /** ETH value of one whole pair token, as a decimal string. Required for ERC20 pairs. */
  ethPerToken?: string;
};

type LaunchBase = {
  chainId: number;
  name: string;
  symbol: string;
  /** ERC-7572 metadata URI, usually `ipfs://<cid>`. */
  contractURI: string;
  /** Base swap fee in basis points, 100 to 1,000. */
  baseFeeBps: number;
  /** Market cap of the whole supply at launch, in ETH as a decimal string. Every pool starts at this price. */
  startingMarketCapEth: string;
  pairs: LaunchPair[];
  /** Receives the launch NFT, which controls the fee route. */
  owner: Address;
  /** Unix seconds after which the launch reverts. */
  deadline: bigint;
};

export type GaslessLaunchInput = LaunchBase & {
  recipients: RecipientSpec[];
  /** `Flaunch.tokenNonce()` read just before signing. The launch reverts if another launch lands first. */
  nonce: bigint;
};

export type DevBuyLaunchInput = LaunchBase & {
  /** Fee recipient clones that already exist, from `findRecipient` or the recipients API. */
  recipients: { recipient: Address; percentage: number }[];
  devBuy: { amount: bigint; minOutput: bigint };
};

/** `AtomicLaunchZap.launch`: creates the fee recipients inside the launch, so a service wallet can sign it for the creator. */
export function buildGaslessLaunch(input: GaslessLaunchInput) {
  validate(input, input.recipients);
  const { flaunch, baseTokenImplementation, atomicLaunchZap } = deployment(input.chainId);
  const token = getContractAddress({
    opcode: "CREATE2",
    from: flaunch,
    salt: keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [BigInt(input.chainId), input.nonce])),
    bytecode: `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${baseTokenImplementation.slice(2)}5af43d82803e903d91602b57fd5bf3`,
  });
  return {
    address: atomicLaunchZap,
    abi: AtomicLaunchZapAbi,
    functionName: "launch",
    args: [{ ...launchParams(input, token), recipients: input.recipients.map(recipientConfig) }, input.nonce, input.deadline],
  } as const;
}

/** `LaunchZap.launch` with an ETH dev buy, signed and paid by the creator. */
export function buildDevBuyLaunch(input: DevBuyLaunchInput) {
  validate(input, input.recipients);
  // LaunchZap has no nonce guard, so an ERC20 pool's price orientation could flip if another launch lands first.
  // Native ETH always sorts first, so ETH-only pairs price correctly whatever the token address turns out to be.
  if (input.pairs.some((pair) => pair.token !== zeroAddress)) throw new Error("dev buy requires ETH-only pairs");
  return {
    address: deployment(input.chainId).launchZap,
    abi: LaunchZapAbi,
    functionName: "launch",
    args: [
      { ...launchParams(input), recipients: input.recipients },
      [{ pairedTokenIndex: 0n, budget: input.devBuy.amount, minOutput: input.devBuy.minOutput, sqrtPriceLimitX96: 0n }],
      input.deadline,
    ],
    value: input.devBuy.amount,
  } as const;
}

/**
 * Simulates the dev-buy launch and returns the tokens `account` would receive, to set `devBuy.minOutput` from.
 * The simulation gives `account` the dev-buy ETH, so a wallet can preview before it is funded.
 */
export async function quoteDevBuy(client: Client, input: DevBuyLaunchInput, account: Address): Promise<bigint> {
  const call = buildDevBuyLaunch({ ...input, devBuy: { ...input.devBuy, minOutput: 0n } });
  const {
    results: [launch],
  } = await simulateCalls(client, {
    account,
    calls: [{ ...call, to: call.address }],
    // Simulation charges no gas, so the dev buy is all the account needs
    stateOverrides: [{ address: account, balance: input.devBuy.amount }],
  });
  if (launch.status !== "success") throw launch.error;
  // Only the dev buy pays tokens out of the PoolManager; the launch mints other allocations, which could reach the same account
  const from = deployment(input.chainId).poolManager;
  return parseEventLogs({ abi: erc20Abi, logs: launch.logs ?? [], eventName: "Transfer", args: { from, to: account } }).reduce(
    (sum, log) => sum + log.args.value,
    0n,
  );
}

/** The launched token and launch NFT id from a successful launch receipt. */
export function parseLaunch(receipt: TransactionReceipt, chainId: number): { token: Address; tokenId: bigint } {
  const { flaunch } = deployment(chainId);
  const [launch] = parseEventLogs({ abi: FlaunchAbi, logs: receipt.logs, eventName: "Launch" }).filter(
    (log) => log.address.toLowerCase() === flaunch.toLowerCase(),
  );
  if (receipt.status !== "success" || !launch) throw new Error(`No launch in transaction ${receipt.transactionHash}`);
  return { token: launch.args.token, tokenId: launch.args.tokenId };
}

/**
 * The starting `sqrtPriceX96` of one pool, so that the whole supply is worth `startingMarketCapEth`.
 * ERC20 pairs need the launched token's address because it decides which side of the pool is currency0.
 */
function startingSqrtPriceX96(startingMarketCapEth: string, pair: LaunchPair, token?: Address): bigint {
  const native = pair.token === zeroAddress;
  if (!native && (pair.decimals === undefined || !pair.ethPerToken || !token))
    throw new Error(`ERC20 pair ${pair.token} needs decimals, ethPerToken and the launched token address`);
  const cap = parseEther(startingMarketCapEth);
  const rate = native ? parseEther("1") : parseEther(pair.ethPerToken!);
  if (cap <= 0n || rate <= 0n) throw new Error("startingMarketCapEth and ethPerToken must be positive");
  // Raw pair units and raw token units worth the same, so their ratio is the pool price
  const paired = cap * 10n ** BigInt(native ? 18 : pair.decimals!);
  const base = rate * SUPPLY * 10n ** 18n;
  const tokenIs0 = !native && BigInt(token!) < BigInt(pair.token);
  const result = sqrt(((tokenIs0 ? paired : base) << 192n) / (tokenIs0 ? base : paired));
  if (result <= MIN_SQRT_PRICE || result >= MAX_SQRT_PRICE)
    throw new Error(`The starting price for pair ${pair.token} is outside the Uniswap range`);
  return result;
}

function sqrt(value: bigint): bigint {
  if (value < 2n) return value;
  let x = value;
  let next = (x + 1n) / 2n;
  while (next < x) {
    x = next;
    next = (x + value / x) / 2n;
  }
  return x;
}

function launchParams(input: LaunchBase, token?: Address) {
  return {
    name: input.name,
    symbol: input.symbol,
    baseFee: BigInt(input.baseFeeBps),
    contractURI: input.contractURI,
    pairedTokens: input.pairs.map((pair) => ({
      token: pair.token,
      sqrtPriceX96: startingSqrtPriceX96(input.startingMarketCapEth, pair, token),
      amount: pair.allocationBps,
    })),
    nftLink: {
      collection: zeroAddress,
      tokenId: 0n,
      signer: zeroAddress,
      owner: zeroAddress,
      signature: "0x" as Hex,
      timestamp: 0n,
    },
    recipient: input.owner,
  };
}

function validate(input: LaunchBase, recipients: { percentage: number }[]) {
  if (!Number.isInteger(input.baseFeeBps) || input.baseFeeBps < 100 || input.baseFeeBps > 1000)
    throw new Error("baseFeeBps must be between 100 and 1,000");
  if (sum(input.pairs.map((pair) => pair.allocationBps)) !== ONE_HUNDRED_PERCENT)
    throw new Error("pair allocations must total 10,000 bp");
  if (sum(recipients.map((recipient) => recipient.percentage)) !== ONE_HUNDRED_PERCENT)
    throw new Error("recipients must total 10,000 bp");
  if (recipients.length > MAX_RECIPIENTS) throw new Error("a launch takes at most 10 recipients");
  if (recipients.some((recipient) => recipient.percentage < MIN_RECIPIENT_BPS))
    throw new Error("each recipient needs at least 100 bp");
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
