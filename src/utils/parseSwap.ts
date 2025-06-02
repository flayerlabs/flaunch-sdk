export interface SwapLogArgs {
  flAmount0: bigint;
  flAmount1: bigint;
  flFee0: bigint;
  flFee1: bigint;
  ispAmount0: bigint;
  ispAmount1: bigint;
  ispFee0: bigint;
  ispFee1: bigint;
  uniAmount0: bigint;
  uniAmount1: bigint;
  uniFee0: bigint;
  uniFee1: bigint;
}

export interface SwapFees {
  isInFLETH: boolean;
  amount: bigint;
}

export interface BuySwapData {
  type: "BUY";
  delta: {
    coinsBought: bigint;
    flETHSold: bigint;
    fees: SwapFees;
  };
}

export interface SellSwapData {
  type: "SELL";
  delta: {
    coinsSold: bigint;
    flETHBought: bigint;
    fees: SwapFees;
  };
}

export type ParsedSwapData = BuySwapData | SellSwapData;

/**
 * Parses raw swap log arguments into structured swap data
 * @param args - The swap log arguments
 * @param flETHIsCurrencyZero - Whether flETH is currency 0 in the pool
 * @returns Parsed swap data with type and delta information
 */
export function parseSwapData(
  args: SwapLogArgs,
  flETHIsCurrencyZero: boolean
): ParsedSwapData {
  const {
    flAmount0,
    flAmount1,
    flFee0,
    flFee1,
    ispAmount0,
    ispAmount1,
    ispFee0,
    ispFee1,
    uniAmount0,
    uniAmount1,
    uniFee0,
    uniFee1,
  } = args;

  const currency0Delta = flAmount0 + ispAmount0 + uniAmount0;
  const currency1Delta = flAmount1 + ispAmount1 + uniAmount1;
  const currency0Fees = flFee0 + ispFee0 + uniFee0;
  const currency1Fees = flFee1 + ispFee1 + uniFee1;

  let feesIsInFLETH: boolean;
  let swapType: "BUY" | "SELL";

  if (flETHIsCurrencyZero) {
    swapType = currency0Delta < 0 ? "BUY" : "SELL";
    feesIsInFLETH = currency0Fees < 0;
  } else {
    swapType = currency1Delta < 0 ? "BUY" : "SELL";
    feesIsInFLETH = currency1Fees < 0;
  }

  const absCurrency0Delta =
    currency0Delta < 0 ? -currency0Delta : currency0Delta;
  const absCurrency1Delta =
    currency1Delta < 0 ? -currency1Delta : currency1Delta;
  const absCurrency0Fees = currency0Fees < 0 ? -currency0Fees : currency0Fees;
  const absCurrency1Fees = currency1Fees < 0 ? -currency1Fees : currency1Fees;

  const fees: SwapFees = {
    isInFLETH: feesIsInFLETH,
    amount: flETHIsCurrencyZero
      ? feesIsInFLETH
        ? absCurrency0Fees
        : absCurrency1Fees
      : feesIsInFLETH
      ? absCurrency1Fees
      : absCurrency0Fees,
  };

  if (swapType === "BUY") {
    return {
      type: swapType,
      delta: {
        coinsBought: flETHIsCurrencyZero
          ? absCurrency1Delta - (!fees.isInFLETH ? fees.amount : 0n)
          : absCurrency0Delta - (!fees.isInFLETH ? fees.amount : 0n),
        flETHSold: flETHIsCurrencyZero
          ? absCurrency0Delta - (fees.isInFLETH ? fees.amount : 0n)
          : absCurrency1Delta - (fees.isInFLETH ? fees.amount : 0n),
        fees,
      },
    };
  } else {
    return {
      type: swapType,
      delta: {
        coinsSold: flETHIsCurrencyZero
          ? absCurrency1Delta - (!fees.isInFLETH ? fees.amount : 0n)
          : absCurrency0Delta - (!fees.isInFLETH ? fees.amount : 0n),
        flETHBought: flETHIsCurrencyZero
          ? absCurrency0Delta - (fees.isInFLETH ? fees.amount : 0n)
          : absCurrency1Delta - (fees.isInFLETH ? fees.amount : 0n),
        fees,
      },
    };
  }
}
