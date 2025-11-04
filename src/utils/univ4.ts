import { concat, keccak256, pad, toHex } from "viem";
import { TickMath } from "@uniswap/v3-sdk";
import { PoolKey } from "../types";

// our min/max tick range that is valid for the tick spacing (60)
export const TickFinder = {
  MIN_TICK: -887220,
  MAX_TICK: 887220,
};

export const Q96 = 2n ** 96n;
export const Q192 = 2n ** 192n;

export const TICK_SPACING = 60;

export const getPoolId = (poolKey: PoolKey) => {
  // Pack the data in the same order as Solidity struct
  const packed = concat([
    pad(poolKey.currency0, { size: 32 }), // address padded to 32 bytes
    pad(poolKey.currency1, { size: 32 }), // address padded to 32 bytes
    pad(toHex(poolKey.fee), { size: 32 }), // uint24 padded to 32 bytes
    pad(toHex(poolKey.tickSpacing), { size: 32 }), // int24 padded to 32 bytes
    pad(poolKey.hooks, { size: 32 }), // address padded to 32 bytes
  ]);

  return keccak256(packed);
};

export const orderPoolKey = (poolKey: PoolKey) => {
  const [currency0, currency1] =
    poolKey.currency0 < poolKey.currency1
      ? [poolKey.currency0, poolKey.currency1]
      : [poolKey.currency1, poolKey.currency0];

  return {
    ...poolKey,
    currency0,
    currency1,
  };
};

export const getValidTick = ({
  tick,
  tickSpacing,
  roundDown = true,
}: {
  tick: number;
  tickSpacing: number;
  roundDown?: boolean;
}) => {
  // If the tick is already valid, exit early
  if (tick % tickSpacing === 0) {
    return tick;
  }

  // Division that rounds towards zero (like Solidity)
  let validTick = Math.trunc(tick / tickSpacing) * tickSpacing;

  // Handle negative ticks (Solidity behavior)
  if (tick < 0 && tick % tickSpacing !== 0) {
    validTick -= tickSpacing;
  }

  // If not rounding down, add TICK_SPACING to get the upper tick
  if (!roundDown) {
    validTick += tickSpacing;
  }

  return validTick;
};

// Rounds up or down to the nearest tick
export const getNearestUsableTick = ({
  tick,
  tickSpacing,
}: {
  tick: number;
  tickSpacing: number;
}): number => {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  return Math.max(TickFinder.MIN_TICK, Math.min(TickFinder.MAX_TICK, rounded));
};

const getAmount0ForLiquidity = (
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint
) => {
  let [sqrtRatioA, sqrtRatioB] = [sqrtRatioAX96, sqrtRatioBX96];

  if (sqrtRatioA > sqrtRatioB) {
    [sqrtRatioA, sqrtRatioB] = [sqrtRatioB, sqrtRatioA];
  }

  const leftShiftedLiquidity = liquidity << 96n;
  const sqrtDiff = sqrtRatioB - sqrtRatioA;
  const multipliedRes = leftShiftedLiquidity * sqrtDiff;
  const numerator = multipliedRes / sqrtRatioB;
  const amount0 = numerator / sqrtRatioA;

  return amount0;
};

const getAmount1ForLiquidity = (
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint
) => {
  let [sqrtRatioA, sqrtRatioB] = [sqrtRatioAX96, sqrtRatioBX96];

  if (sqrtRatioA > sqrtRatioB) {
    [sqrtRatioA, sqrtRatioB] = [sqrtRatioB, sqrtRatioA];
  }

  const sqrtDiff = sqrtRatioB - sqrtRatioA;
  const multipliedRes = liquidity * sqrtDiff;

  const amount1 = multipliedRes / 2n ** 96n;

  return amount1;
};

export const getSqrtPriceX96FromTick = (tick: number): bigint => {
  const absTick = tick < 0 ? BigInt(-tick) : BigInt(tick);
  if (absTick > TickFinder.MAX_TICK) {
    throw new Error("Tick out of range");
  }

  let ratio =
    (absTick & 1n) !== 0n
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;

  if ((absTick & 2n) !== 0n)
    ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 4n) !== 0n)
    ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 8n) !== 0n)
    ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 16n) !== 0n)
    ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 32n) !== 0n)
    ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 64n) !== 0n)
    ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 128n) !== 0n)
    ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 256n) !== 0n)
    ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 512n) !== 0n)
    ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 1024n) !== 0n)
    ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 2048n) !== 0n)
    ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 4096n) !== 0n)
    ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 8192n) !== 0n)
    ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 16384n) !== 0n)
    ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 32768n) !== 0n)
    ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 65536n) !== 0n)
    ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((absTick & 131072n) !== 0n)
    ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 262144n) !== 0n)
    ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 524288n) !== 0n)
    ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  if (tick > 0) {
    ratio = (2n ** 256n - 1n) / ratio;
  }

  // Convert from Q128.128 to Q128.96
  const resultShifted = ratio >> 32n;
  if (ratio % (1n << 32n) === 0n) {
    return resultShifted;
  }
  return resultShifted + 1n;
};

export const calculateUnderlyingTokenBalances = (
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  tickCurrent: number
): { amount0: bigint; amount1: bigint } => {
  const sqrtPriceCurrentX96 = getSqrtPriceX96FromTick(tickCurrent);
  const sqrtPriceLowerX96 = getSqrtPriceX96FromTick(tickLower);
  const sqrtPriceUpperX96 = getSqrtPriceX96FromTick(tickUpper);

  let amount0 = 0n;
  let amount1 = 0n;

  if (sqrtPriceCurrentX96 <= sqrtPriceLowerX96) {
    // Current price is below the position range
    amount0 = getAmount0ForLiquidity(
      sqrtPriceLowerX96,
      sqrtPriceUpperX96,
      liquidity
    );
  } else if (sqrtPriceCurrentX96 < sqrtPriceUpperX96) {
    // Current price is within the position range
    amount0 = getAmount0ForLiquidity(
      sqrtPriceCurrentX96,
      sqrtPriceUpperX96,
      liquidity
    );
    amount1 = getAmount1ForLiquidity(
      sqrtPriceLowerX96,
      sqrtPriceCurrentX96,
      liquidity
    );
  } else {
    // Current price is above the position range
    amount1 = getAmount1ForLiquidity(
      sqrtPriceLowerX96,
      sqrtPriceUpperX96,
      liquidity
    );
  }

  return { amount0, amount1 };
};

// Helper function to convert price ratio to tick with decimal handling
export const priceRatioToTick = ({
  priceInput,
  isDirection1Per0,
  decimals0,
  decimals1,
  spacing,
  shouldGetNearestUsableTick = true,
}: {
  priceInput: string;
  isDirection1Per0: boolean;
  decimals0: number;
  decimals1: number;
  spacing: number;
  shouldGetNearestUsableTick?: boolean;
}): number => {
  if (!priceInput || isNaN(Number(priceInput))) return 0;

  const inputPrice = Number(priceInput);

  try {
    // For Uniswap v3/v4, the tick represents price as: price = 1.0001^tick
    // where price = amount1/amount0 in their raw decimal format

    let priceRatio: number;

    if (isDirection1Per0) {
      // Input is token1 per token0 (e.g., memecoin per flETH)
      // Convert from human-readable to raw: divide by (10^decimals0 / 10^decimals1)
      priceRatio = inputPrice / Math.pow(10, decimals0 - decimals1);
    } else {
      // Input is token0 per token1 (e.g., flETH per memecoin)
      // Invert to get token1 per token0, then convert to raw
      priceRatio = 1 / inputPrice / Math.pow(10, decimals0 - decimals1);
    }

    // Calculate tick: tick = log(price) / log(1.0001)
    const tick = Math.log(priceRatio) / Math.log(1.0001);

    if (shouldGetNearestUsableTick) {
      return getValidTick({
        tick: Math.round(tick),
        tickSpacing: spacing,
      });
    } else {
      return Math.round(tick);
    }
  } catch (error) {
    console.error("Error converting price to tick:", error);
    // Fallback to basic calculation
    const rawTick = Math.floor(Math.log(inputPrice) / Math.log(1.0001));
    if (shouldGetNearestUsableTick) {
      return getValidTick({
        tick: rawTick,
        tickSpacing: spacing,
      });
    } else {
      return rawTick;
    }
  }
};

/**
 * Accurate liquidity calculation using proper Uniswap v3/v4 math
 */
export const getLiquidityFromAmounts = (params: {
  currentTick: number;
  tickLower: number;
  tickUpper: number;
  amount0: bigint;
  amount1: bigint;
}) => {
  const sqrtRatioCurrentX96 = getSqrtPriceX96FromTick(params.currentTick);
  let sqrtRatioAX96 = getSqrtPriceX96FromTick(params.tickLower);
  let sqrtRatioBX96 = getSqrtPriceX96FromTick(params.tickUpper);

  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }

  if (sqrtRatioCurrentX96 <= sqrtRatioAX96) {
    return maxLiquidityForAmount0Precise(
      sqrtRatioAX96,
      sqrtRatioBX96,
      params.amount0
    );
  } else if (sqrtRatioCurrentX96 < sqrtRatioBX96) {
    const liquidity0 = maxLiquidityForAmount0Precise(
      sqrtRatioCurrentX96,
      sqrtRatioBX96,
      params.amount0
    );
    const liquidity1 = maxLiquidityForAmount1(
      sqrtRatioAX96,
      sqrtRatioCurrentX96,
      params.amount1
    );
    return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
  } else {
    return maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, params.amount1);
  }
};

/**
 * Returns a precise maximum amount of liquidity received for a given amount of token 0 by dividing by Q64 instead of Q96 in the intermediate step,
 * and shifting the subtracted ratio left by 32 bits.
 * @param sqrtRatioAX96 The price at the lower boundary
 * @param sqrtRatioBX96 The price at the upper boundary
 * @param amount0 The token0 amount
 * @returns liquidity for amount0, precise
 */
export function maxLiquidityForAmount0Precise(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  amount0: bigint
): bigint {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }

  // Handle edge case where sqrt ratios are equal (division by zero)
  if (sqrtRatioAX96 === sqrtRatioBX96) {
    return 0n;
  }

  const Q96 = 2n ** 96n;
  const numerator = amount0 * sqrtRatioAX96 * sqrtRatioBX96;
  const denominator = Q96 * (sqrtRatioBX96 - sqrtRatioAX96);

  return numerator / denominator;
}

/**
 * Computes the maximum amount of liquidity received for a given amount of token1
 * @param sqrtRatioAX96 The price at the lower tick boundary
 * @param sqrtRatioBX96 The price at the upper tick boundary
 * @param amount1 The token1 amount
 * @returns liquidity for amount1
 */
export function maxLiquidityForAmount1(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  amount1: bigint
): bigint {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }

  // Handle edge case where sqrt ratios are equal (division by zero)
  if (sqrtRatioAX96 === sqrtRatioBX96) {
    return 0n;
  }

  const Q96 = 2n ** 96n;
  return (amount1 * Q96) / (sqrtRatioBX96 - sqrtRatioAX96);
}

/**
 * Calculate the actual amounts needed for a given liquidity
 * This prevents MaximumAmountExceeded errors by ensuring we provide sufficient maximums
 */
export const getAmountsForLiquidity = (params: {
  currentTick: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
}): { amount0: bigint; amount1: bigint } => {
  // Handle zero liquidity case
  if (params.liquidity === 0n) {
    return { amount0: 0n, amount1: 0n };
  }

  const sqrtRatioCurrentX96 = getSqrtPriceX96FromTick(params.currentTick);
  let sqrtRatioAX96 = getSqrtPriceX96FromTick(params.tickLower);
  let sqrtRatioBX96 = getSqrtPriceX96FromTick(params.tickUpper);

  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }

  let amount0 = 0n;
  let amount1 = 0n;

  if (sqrtRatioCurrentX96 <= sqrtRatioAX96) {
    // Current price is below the range, only token0 needed
    amount0 = getAmount0ForLiquidity(
      sqrtRatioAX96,
      sqrtRatioBX96,
      params.liquidity
    );
  } else if (sqrtRatioCurrentX96 < sqrtRatioBX96) {
    // Current price is within the range, need both tokens
    amount0 = getAmount0ForLiquidity(
      sqrtRatioCurrentX96,
      sqrtRatioBX96,
      params.liquidity
    );
    amount1 = getAmount1ForLiquidity(
      sqrtRatioAX96,
      sqrtRatioCurrentX96,
      params.liquidity
    );
  } else {
    // Current price is above the range, only token1 needed
    amount1 = getAmount1ForLiquidity(
      sqrtRatioAX96,
      sqrtRatioBX96,
      params.liquidity
    );
  }

  return { amount0, amount1 };
};
