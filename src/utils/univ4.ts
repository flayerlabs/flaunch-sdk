import { concat, keccak256, pad, toHex } from "viem";
import { TickMath } from "@uniswap/v3-sdk";
import { PoolKey } from "../types";

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
  roundDown,
}: {
  tick: number;
  tickSpacing: number;
  roundDown: boolean;
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
  return BigInt(TickMath.getSqrtRatioAtTick(tick).toString());
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
