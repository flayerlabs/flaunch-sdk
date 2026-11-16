import {
  concatHex,
  encodeAbiParameters,
  zeroAddress,
  type Address,
  type Hex,
  type Client,
} from "viem";
import { readContract, simulateContract } from "viem/actions";
import { Permit2Abi, UniversalRouterAbi, V4QuoterAbi } from "./abi/index.js";
import { deployment } from "./addresses.js";

export type SwapInput = {
  chainId: number;
  /** One side is the Flaunch coin and the other the pay or receive currency, `zeroAddress` for native ETH. */
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  /** Passed to the Flaunch hook untouched. */
  hookData?: Hex;
};

export type PermitSingle = {
  details: { token: Address; amount: bigint; expiration: number; nonce: number };
  spender: Address;
  sigDeadline: bigint;
};

// Universal Router command and V4 router action bytes
const PERMIT2_PERMIT = "0x0a";
const V4_SWAP = "0x10";
const SWEEP = "0x04";
const SWAP_EXACT_IN_SINGLE = "0x06";
const SETTLE_ALL = "0x0c";
const TAKE_ALL = "0x0f";

const poolKeyType = {
  type: "tuple",
  components: [
    { name: "currency0", type: "address" },
    { name: "currency1", type: "address" },
    { name: "fee", type: "uint24" },
    { name: "tickSpacing", type: "int24" },
    { name: "hooks", type: "address" },
  ],
} as const;

/** The Flaunch pool between two currencies. Every Flaunch pool has a zero LP fee and a tick spacing of 60. */
function poolKey(chainId: number, tokenA: Address, tokenB: Address) {
  const [currency0, currency1] = BigInt(tokenA) < BigInt(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
  return { currency0, currency1, fee: 0, tickSpacing: 60, hooks: deployment(chainId).flaunchPoolHook };
}

/**
 * The output of an exact-input swap, from the V4 quoter.
 * Pass the swapper as `account` when `hookData` names a buyer, because the fee calculator checks it against the sender.
 */
export async function quoteSwap(client: Client, input: SwapInput & { account?: Address }): Promise<bigint> {
  const key = poolKey(input.chainId, input.tokenIn, input.tokenOut);
  const {
    result: [amountOut],
  } = await simulateContract(client, {
    address: deployment(input.chainId).v4Quoter,
    abi: V4QuoterAbi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        poolKey: key,
        zeroForOne: key.currency0 === input.tokenIn,
        exactAmount: input.amountIn,
        hookData: input.hookData ?? "0x",
      },
    ],
    account: input.account,
  });
  return amountOut;
}

/**
 * Universal Router `execute` for an exact-input swap through the Flaunch pool.
 * ERC20 input is pulled through Permit2: pass `permit` with its signature unless the router already has a Permit2 allowance.
 */
export function buildSwap(
  input: SwapInput & {
    amountOutMinimum: bigint;
    /** The swapper, who receives any unspent ETH. */
    account: Address;
    /** Unix seconds after which the swap reverts. */
    deadline: bigint;
    permit?: { permit: PermitSingle; signature: Hex };
  },
) {
  const key = poolKey(input.chainId, input.tokenIn, input.tokenOut);
  const native = input.tokenIn === zeroAddress;
  const swap = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "poolKey", ...poolKeyType },
          { name: "zeroForOne", type: "bool" },
          { name: "amountIn", type: "uint128" },
          { name: "amountOutMinimum", type: "uint128" },
          { name: "minHopPriceX36", type: "uint256" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    [
      {
        poolKey: key,
        zeroForOne: key.currency0 === input.tokenIn,
        amountIn: input.amountIn,
        amountOutMinimum: input.amountOutMinimum,
        // Router 2.1.2 checks the hop's average price as well; this is the same bound as the minimum output
        minHopPriceX36: (input.amountOutMinimum * 10n ** 36n) / input.amountIn,
        hookData: input.hookData ?? "0x",
      },
    ],
  );
  const actions = encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [
      concatHex([SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]),
      [
        swap,
        encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [input.tokenIn, input.amountIn]),
        encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [input.tokenOut, input.amountOutMinimum]),
      ],
    ],
  );

  const commands: Hex[] = [];
  const inputs: Hex[] = [];
  if (input.permit) {
    commands.push(PERMIT2_PERMIT);
    inputs.push(
      encodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              {
                name: "details",
                type: "tuple",
                components: [
                  { name: "token", type: "address" },
                  { name: "amount", type: "uint160" },
                  { name: "expiration", type: "uint48" },
                  { name: "nonce", type: "uint48" },
                ],
              },
              { name: "spender", type: "address" },
              { name: "sigDeadline", type: "uint256" },
            ],
          },
          { type: "bytes" },
        ],
        [input.permit.permit, input.permit.signature],
      ),
    );
  }
  commands.push(V4_SWAP);
  inputs.push(actions);
  if (native) {
    // Return any ETH a partial fill at the edge of the price range did not spend
    commands.push(SWEEP);
    inputs.push(encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "uint256" }], [zeroAddress, input.account, 0n]));
  }

  return {
    address: deployment(input.chainId).universalRouter,
    abi: UniversalRouterAbi,
    functionName: "execute",
    args: [concatHex(commands), inputs, input.deadline],
    value: native ? input.amountIn : 0n,
  } as const;
}

/** The router's current Permit2 allowance over `token`, whose nonce a new permit must use. */
export async function readPermit2Allowance(client: Client, chainId: number, owner: Address, token: Address) {
  const { permit2, universalRouter } = deployment(chainId);
  const [amount, expiration, nonce] = await readContract(client, {
    address: permit2,
    abi: Permit2Abi,
    functionName: "allowance",
    args: [owner, token, universalRouter],
  });
  return { amount, expiration, nonce };
}

/** Typed data for the swapper to sign with `signTypedData`, granting the router `amount` of `token` through Permit2. */
export function permitTypedData(
  chainId: number,
  details: PermitSingle["details"],
  sigDeadline: bigint,
) {
  const { permit2, universalRouter } = deployment(chainId);
  const permit: PermitSingle = { details, spender: universalRouter, sigDeadline };
  return {
    domain: { name: "Permit2", chainId, verifyingContract: permit2 },
    types: {
      PermitSingle: [
        { name: "details", type: "PermitDetails" },
        { name: "spender", type: "address" },
        { name: "sigDeadline", type: "uint256" },
      ],
      PermitDetails: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint160" },
        { name: "expiration", type: "uint48" },
        { name: "nonce", type: "uint48" },
      ],
    },
    primaryType: "PermitSingle",
    message: permit,
  } as const;
}
