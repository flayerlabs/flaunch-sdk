import { encodeFunctionData, encodePacked, type Address, type Hex } from "viem";
import type { PairedTokenAcquisitionDex } from "../addresses";

/**
 * Buying a paired token that is not ETH-equivalent (a B20 equity) from ETH or the chain's USD hub,
 * so it can then be spent on a coin's own pool. Pure encoders and maths; reads live in
 * `ReadPairedTokenAcquisition`.
 *
 * Every routed buy is EXACT-OUTPUT: the router must deliver exactly `amountOut` of the paired token
 * and may spend up to `amountInMaximum`. That makes the later PoolSwap leg's calldata deterministic
 * at build time (a batched wallet resolves every call before the first executes) and refunds any
 * residual in the INPUT currency rather than stranding paired-token dust.
 */

/** The Slipstream SwapRouter write surface — `tickSpacing`-keyed, `deadline` inside the params. */
export const SlipstreamSwapRouterAbi = [
  {
    type: "function",
    name: "exactOutputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "tickSpacing", type: "int24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountOut", type: "uint256" },
          { name: "amountInMaximum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
  },
  {
    type: "function",
    name: "exactOutput",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountOut", type: "uint256" },
          { name: "amountInMaximum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
  },
  {
    type: "function",
    name: "exactInput",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  { type: "function", name: "refundETH", stateMutability: "payable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "unwrapWETH9",
    stateMutability: "payable",
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
] as const;

/**
 * The Uniswap `SwapRouter02` write surface — `fee`-keyed, no `deadline` in the params. The deadline
 * is enforced by the `multicall(uint256 deadline, bytes[])` overload every routed call is wrapped in.
 */
export const UniswapV3SwapRouter02Abi = [
  {
    type: "function",
    name: "exactOutputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountOut", type: "uint256" },
          { name: "amountInMaximum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
  },
  {
    type: "function",
    name: "exactOutput",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "amountOut", type: "uint256" },
          { name: "amountInMaximum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
  },
  {
    type: "function",
    name: "exactInput",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [
      { name: "deadline", type: "uint256" },
      { name: "data", type: "bytes[]" },
    ],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  { type: "function", name: "refundETH", stateMutability: "payable", inputs: [], outputs: [] },
  {
    // SwapRouter02 also has a one-argument `unwrapWETH9(uint256)` that pays msg.sender; only the
    // explicit-recipient overload is listed so encoding is unambiguous.
    type: "function",
    name: "unwrapWETH9",
    stateMutability: "payable",
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
] as const;

/** Slipstream-shaped CL pool reads. `slot0` is six fields — V3's `feeProtocol` is dropped. */
export const SlipstreamPoolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "unlocked", type: "bool" },
    ],
  },
  { type: "function", name: "fee", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint24" }] },
  { type: "function", name: "tickSpacing", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "int24" }] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;

/** Canonical Uniswap V3 pool reads. `slot0` carries the seventh `feeProtocol` field. */
export const UniswapV3PoolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
  { type: "function", name: "fee", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint24" }] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;

/** The two getters read off a paired token's registered two-hop price calculator. */
export const TwoHopPriceCalculatorAbi = [
  { type: "function", name: "hubPairedPool", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "hubToken", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;

/** `getPool` on a canonical Uniswap V3 factory. */
export const UniswapV3FactoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

/** Uniswap `QuoterV2`'s depth-aware exact-input quote. */
export const UniswapV3QuoterV2Abi = [
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "nonpayable",
    inputs: [
      { name: "path", type: "bytes" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96AfterList", type: "uint160[]" },
      { name: "initializedTicksCrossedList", type: "uint32[]" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

/** The pool ABI a flavour's pools speak. Both expose `slot0`/`fee`/`token0`; only `slot0` differs. */
export function acquisitionPoolAbi(dex: PairedTokenAcquisitionDex) {
  return dex.flavor === "slipstream" ? SlipstreamPoolAbi : UniswapV3PoolAbi;
}

/** What a routed buy pays with: native ETH, or the chain's USD hub token (USDC / USDG). */
export type PairedTokenAcquisitionInput = "eth" | "hub";

export interface PairedTokenAcquisitionRoute {
  /** The pool the paired-token leg trades in: hub:token, or WETH:token when `direct`. */
  pool: Address;
  /** The pool's key for the path / router params: `tickSpacing` (slipstream) or `fee` (uniswapV3). */
  poolKey: number;
  /** Whether the paying side (hub, or WETH when `direct`) is the pool's token0. */
  payingIsToken0: boolean;
  /** A WETH:token pool reached in one hop from ETH, skipping the hub. Only chosen for an ETH input. */
  direct?: boolean;
}

const FEE_PIPS_DENOMINATOR = 1_000_000n;
const Q192 = 1n << 192n;

/**
 * Spot output for an exact input against a CL pool at its current price: the fee comes off the
 * input, then the price ratio (`sqrtPriceX96²/2¹⁹²`, token1 per token0) converts it. Single-tick —
 * it ignores liquidity depth, so it slightly overstates output on sizes that cross ticks; the
 * caller's slippage haircut absorbs that and the router's `amountInMaximum` enforces it.
 */
export function clSpotAmountOut(
  amountIn: bigint,
  sqrtPriceX96: bigint,
  feePips: bigint,
  zeroForOne: boolean
): bigint {
  const afterFee = (amountIn * (FEE_PIPS_DENOMINATOR - feePips)) / FEE_PIPS_DENOMINATOR;
  const priceX192 = sqrtPriceX96 * sqrtPriceX96;
  return zeroForOne ? (afterFee * priceX192) / Q192 : (afterFee * Q192) / priceX192;
}

/**
 * The exact-OUTPUT path for an ETH buy: output token first (`token → hub → WETH`), each hop's pool
 * key packed into the 3 bytes a V3 path spends on the fee. A Slipstream tickSpacing is a small
 * positive int24, so the uint24 packing is the value that router decodes too.
 */
export function encodeAcquisitionEthExactOutputPath(
  dex: PairedTokenAcquisitionDex,
  pairedToken: Address,
  route: PairedTokenAcquisitionRoute
): Hex {
  if (route.direct) {
    return encodePacked(["address", "uint24", "address"], [pairedToken, route.poolKey, dex.weth]);
  }
  return encodePacked(
    ["address", "uint24", "address", "uint24", "address"],
    [pairedToken, route.poolKey, dex.hubToken, dex.wethHubPoolKey, dex.weth]
  );
}

/** The exact-INPUT path for a venue (input first), the mirror of the exact-output path. */
export function encodeAcquisitionExactInputPath(
  dex: PairedTokenAcquisitionDex,
  pairedToken: Address,
  route: PairedTokenAcquisitionRoute,
  input: PairedTokenAcquisitionInput
): Hex {
  if (input === "hub") {
    return encodePacked(["address", "uint24", "address"], [dex.hubToken, route.poolKey, pairedToken]);
  }
  if (route.direct) {
    return encodePacked(["address", "uint24", "address"], [dex.weth, route.poolKey, pairedToken]);
  }
  return encodePacked(
    ["address", "uint24", "address", "uint24", "address"],
    [dex.weth, dex.wethHubPoolKey, dex.hubToken, route.poolKey, pairedToken]
  );
}

export interface PairedTokenAcquisitionLeg {
  pairedToken: Address;
  route: PairedTokenAcquisitionRoute;
  recipient: Address;
  /** Unix seconds after which the router refuses to execute. */
  deadline: bigint;
  /** The exact paired-token amount the leg must deliver. */
  amountOut: bigint;
  /** The whole input — the price protection; the leg reverts rather than spend more. */
  amountInMaximum: bigint;
}

/**
 * Router calldata for a hub-token (USDC/USDG) buy of `amountOut` paired token: a single-pool
 * exact-output swap, paid by allowance pull. Flavour differences are confined here.
 */
export function encodeAcquisitionHubBuy(dex: PairedTokenAcquisitionDex, leg: PairedTokenAcquisitionLeg): Hex {
  if (dex.flavor === "slipstream") {
    return encodeFunctionData({
      abi: SlipstreamSwapRouterAbi,
      functionName: "exactOutputSingle",
      args: [
        {
          tokenIn: dex.hubToken,
          tokenOut: leg.pairedToken,
          tickSpacing: leg.route.poolKey,
          recipient: leg.recipient,
          deadline: leg.deadline,
          amountOut: leg.amountOut,
          amountInMaximum: leg.amountInMaximum,
          // amountInMaximum is the price protection; a limit would double-bound it
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
  }
  return encodeFunctionData({
    abi: UniswapV3SwapRouter02Abi,
    functionName: "multicall",
    args: [
      leg.deadline,
      [
        encodeFunctionData({
          abi: UniswapV3SwapRouter02Abi,
          functionName: "exactOutputSingle",
          args: [
            {
              tokenIn: dex.hubToken,
              tokenOut: leg.pairedToken,
              fee: leg.route.poolKey,
              recipient: leg.recipient,
              amountOut: leg.amountOut,
              amountInMaximum: leg.amountInMaximum,
              sqrtPriceLimitX96: 0n,
            },
          ],
        }),
      ],
    ],
  });
}

/**
 * Router calldata for an ETH buy of `amountOut` paired token: ETH wraps inside the router (path
 * input is WETH9 + msg.value), multihops WETH → hub → token exact-output, and `refundETH` returns
 * whatever the leg did not need. Send with `value = amountInMaximum`.
 */
export function encodeAcquisitionEthBuy(dex: PairedTokenAcquisitionDex, leg: PairedTokenAcquisitionLeg): Hex {
  const path = encodeAcquisitionEthExactOutputPath(dex, leg.pairedToken, leg.route);
  if (dex.flavor === "slipstream") {
    return encodeFunctionData({
      abi: SlipstreamSwapRouterAbi,
      functionName: "multicall",
      args: [
        [
          encodeFunctionData({
            abi: SlipstreamSwapRouterAbi,
            functionName: "exactOutput",
            args: [
              {
                path,
                recipient: leg.recipient,
                deadline: leg.deadline,
                amountOut: leg.amountOut,
                amountInMaximum: leg.amountInMaximum,
              },
            ],
          }),
          encodeFunctionData({ abi: SlipstreamSwapRouterAbi, functionName: "refundETH", args: [] }),
        ],
      ],
    });
  }
  return encodeFunctionData({
    abi: UniswapV3SwapRouter02Abi,
    functionName: "multicall",
    args: [
      leg.deadline,
      [
        encodeFunctionData({
          abi: UniswapV3SwapRouter02Abi,
          functionName: "exactOutput",
          args: [{ path, recipient: leg.recipient, amountOut: leg.amountOut, amountInMaximum: leg.amountInMaximum }],
        }),
        encodeFunctionData({ abi: UniswapV3SwapRouter02Abi, functionName: "refundETH", args: [] }),
      ],
    ],
  });
}


/**
 * Selling leftover paired token back to ETH (disposal): the exact-INPUT mirror of the ETH buy.
 * The whole balance goes in, the path walks `token → hub → WETH` (or `token → WETH` for a direct
 * pool), the router keeps the WETH in its own custody, and `unwrapWETH9` pays native ETH to the
 * recipient. Nothing is left on the router: an exact-input leg spends `amountIn` in full and the
 * unwrap sweeps the router's whole WETH balance.
 */
export type PairedTokenDisposalOutput = "eth";

/**
 * The recipient that makes each flavour's router keep a swap's output in its own custody, so a
 * following `unwrapWETH9` in the same multicall can pay it out as ETH. Both are read from the
 * deployed routers' verified source:
 *
 * - Slipstream `SwapRouter` (Base, 0x698Cb2b6…): `exactInputInternal` maps `address(0)` to
 *   `address(this)` (the v3-periphery convention).
 * - Uniswap `SwapRouter02` (Robinhood, 0xCaf681a6…): `Constants.ADDRESS_THIS = address(2)` maps to
 *   `address(this)`; `address(0)` there would burn-send to the zero address.
 */
export const ROUTER_CUSTODY_RECIPIENT: Record<PairedTokenAcquisitionDex["flavor"], Address> = {
  slipstream: "0x0000000000000000000000000000000000000000",
  uniswapV3: "0x0000000000000000000000000000000000000002",
};

/**
 * The exact-INPUT path for a sell to ETH: input (the paired token) first, `token → hub → WETH`, or
 * `token → WETH` for a direct pool. Byte-identical to the ETH buy's exact-output path, which is also
 * written paired-token first; a separate name keeps each call site honest about which leg it encodes.
 */
export function encodeDisposalExactInputPath(
  dex: PairedTokenAcquisitionDex,
  pairedToken: Address,
  route: PairedTokenAcquisitionRoute
): Hex {
  return encodeAcquisitionEthExactOutputPath(dex, pairedToken, route);
}

export interface PairedTokenDisposalLeg {
  pairedToken: Address;
  route: PairedTokenAcquisitionRoute;
  /** Receives the native ETH. */
  recipient: Address;
  /** Unix seconds after which the router refuses to execute. */
  deadline: bigint;
  /** The exact paired-token amount sold; pulled from the sender by allowance. */
  amountIn: bigint;
  /** The least WETH the swap may produce, and the least ETH the unwrap may pay: the price protection. */
  amountOutMinimum: bigint;
}

/**
 * Router calldata selling exactly `amountIn` paired token for ETH: `exactInput` into the router's
 * own custody, then `unwrapWETH9(amountOutMinimum, recipient)`, inside one multicall. Send with
 * `value = 0`; the paired token must be approved to the router first.
 */
export function encodeDisposalEthSell(dex: PairedTokenAcquisitionDex, leg: PairedTokenDisposalLeg): Hex {
  const path = encodeDisposalExactInputPath(dex, leg.pairedToken, leg.route);
  const custody = ROUTER_CUSTODY_RECIPIENT[dex.flavor];
  if (dex.flavor === "slipstream") {
    return encodeFunctionData({
      abi: SlipstreamSwapRouterAbi,
      functionName: "multicall",
      args: [
        [
          encodeFunctionData({
            abi: SlipstreamSwapRouterAbi,
            functionName: "exactInput",
            args: [
              {
                path,
                recipient: custody,
                deadline: leg.deadline,
                amountIn: leg.amountIn,
                amountOutMinimum: leg.amountOutMinimum,
              },
            ],
          }),
          encodeFunctionData({
            abi: SlipstreamSwapRouterAbi,
            functionName: "unwrapWETH9",
            args: [leg.amountOutMinimum, leg.recipient],
          }),
        ],
      ],
    });
  }
  return encodeFunctionData({
    abi: UniswapV3SwapRouter02Abi,
    functionName: "multicall",
    args: [
      leg.deadline,
      [
        encodeFunctionData({
          abi: UniswapV3SwapRouter02Abi,
          functionName: "exactInput",
          args: [
            { path, recipient: custody, amountIn: leg.amountIn, amountOutMinimum: leg.amountOutMinimum },
          ],
        }),
        encodeFunctionData({
          abi: UniswapV3SwapRouter02Abi,
          functionName: "unwrapWETH9",
          args: [leg.amountOutMinimum, leg.recipient],
        }),
      ],
    ],
  });
}
