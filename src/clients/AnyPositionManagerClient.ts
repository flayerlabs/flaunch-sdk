import {
  type ReadContract,
  type Address,
  type Drift,
  type EventLog,
  type ReadWriteContract,
  type ReadWriteAdapter,
  createDrift,
  HexString,
} from "@delvtech/drift";
import { AnyPositionManagerAbi } from "../abi/AnyPositionManager";
import { encodeAbiParameters, parseUnits, zeroAddress } from "viem";
import { IPFSParams } from "../types";
import { generateTokenUri } from "helpers/ipfs";
import { getAmountWithSlippage } from "utils/universalRouter";
import { ReadInitialPrice } from "./InitialPriceClient";

export type AnyPositionManagerABI = typeof AnyPositionManagerAbi;
export type PoolCreatedLog = EventLog<AnyPositionManagerABI, "PoolCreated"> & {
  timestamp: number;
};
export type PoolCreatedLogs = PoolCreatedLog[];

export interface WatchPoolCreatedParams {
  onPoolCreated: ({
    logs,
    isFetchingFromStart,
  }: {
    logs: PoolCreatedLogs;
    isFetchingFromStart: boolean;
  }) => void;
  startBlockNumber?: bigint;
}

export type BaseSwapLog = EventLog<AnyPositionManagerABI, "PoolSwap"> & {
  timestamp: number;
};

export type BuySwapLog = BaseSwapLog & {
  type: "BUY";
  delta: {
    coinsBought: bigint;
    flETHSold: bigint;
    fees: {
      isInFLETH: boolean;
      amount: bigint;
    };
  };
};

export type SellSwapLog = BaseSwapLog & {
  type: "SELL";
  delta: {
    coinsSold: bigint;
    flETHBought: bigint;
    fees: {
      isInFLETH: boolean;
      amount: bigint;
    };
  };
};

export type PoolSwapLog = BuySwapLog | SellSwapLog | BaseSwapLog;
export type PoolSwapLogs = PoolSwapLog[];

export interface WatchPoolSwapParams<
  TFLETHIsCurrencyZero extends boolean | undefined = undefined
> {
  onPoolSwap: ({
    logs,
    isFetchingFromStart,
  }: {
    logs: TFLETHIsCurrencyZero extends boolean
      ? (BuySwapLog | SellSwapLog)[]
      : BaseSwapLog[];
    isFetchingFromStart: boolean;
  }) => void;
  flETHIsCurrencyZero?: TFLETHIsCurrencyZero;
  startBlockNumber?: bigint;
  filterByPoolId?: HexString;
}

export interface AnyFlaunchParams {
  memecoin: Address;
  initialMarketCapUSD: number;
  creator: Address;
  creatorFeeAllocationPercent: number;
}

export interface FlaunchIPFSParams
  extends Omit<AnyFlaunchParams, "tokenUri">,
    IPFSParams {}

export class ReadAnyPositionManager {
  public readonly contract: ReadContract<AnyPositionManagerABI>;
  drift: Drift;
  public pollPoolCreatedNow?: () => Promise<void>;
  public pollPoolSwapNow?: () => Promise<void>;
  public readonly TOTAL_SUPPLY = 100n * 10n ** 27n; // 100 Billion tokens in wei

  constructor(address: Address, drift: Drift = createDrift()) {
    this.drift = drift;
    if (!address) {
      throw new Error("Address is required");
    }
    this.contract = drift.contract({
      abi: AnyPositionManagerAbi,
      address,
    });
  }

  async isValidCoin(coinAddress: Address) {
    const poolKey = await this.contract.read("poolKey", {
      _token: coinAddress,
    });

    return poolKey.tickSpacing !== 0;
  }

  async getFlaunchingFee(params: {
    sender: Address;
    initialPriceParams: HexString;
    slippagePercent?: number;
  }) {
    return 0n;
  }

  async watchPoolCreated({
    onPoolCreated,
    startBlockNumber,
  }: WatchPoolCreatedParams) {
    let intervalId: ReturnType<typeof setInterval>;

    if (startBlockNumber !== undefined) {
      onPoolCreated({
        logs: [],
        isFetchingFromStart: true,
      });
    }

    let lastBlockNumber = startBlockNumber
      ? startBlockNumber - 1n
      : await this.drift.getBlockNumber();

    const pollEvents = async () => {
      try {
        const currentBlockNumber = await this.drift.getBlockNumber();

        if (currentBlockNumber > lastBlockNumber) {
          const _logs = await this.contract.getEvents("PoolCreated", {
            fromBlock: lastBlockNumber + 1n,
            toBlock: currentBlockNumber,
          });

          // Get timestamps for each log
          const logsWithTimestamps = await Promise.all(
            [..._logs].reverse().map(async (log) => {
              const block = await this.drift.getBlock(log.blockNumber);
              return {
                ...log,
                timestamp: Number(block?.timestamp) * 1_000, // convert to ms for js
              };
            })
          );

          if (logsWithTimestamps.length > 0) {
            onPoolCreated({
              logs: logsWithTimestamps,
              isFetchingFromStart: false,
            });
          } else {
            onPoolCreated({
              logs: [],
              isFetchingFromStart: false,
            });
          }

          lastBlockNumber = currentBlockNumber;
        }
      } catch (error) {
        console.error("Error polling events:", error);
      }
    };

    intervalId = setInterval(pollEvents, 5_000);

    this.pollPoolCreatedNow = pollEvents;

    // Return both cleanup function and immediate poll function
    return {
      cleanup: () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
        // Clear the pollNow function when cleaning up
        this.pollPoolCreatedNow = undefined;
      },
      pollPoolCreatedNow: pollEvents,
    };
  }

  async watchPoolSwap<T extends boolean | undefined = undefined>({
    onPoolSwap,
    flETHIsCurrencyZero,
    startBlockNumber,
    filterByPoolId,
  }: WatchPoolSwapParams<T>) {
    let intervalId: ReturnType<typeof setInterval>;

    if (startBlockNumber !== undefined) {
      onPoolSwap({
        logs: [],
        isFetchingFromStart: true,
      });
    }

    let lastBlockNumber = startBlockNumber
      ? startBlockNumber - 1n
      : await this.drift.getBlockNumber();

    const pollEvents = async () => {
      try {
        const currentBlockNumber = await this.drift.getBlockNumber();

        if (currentBlockNumber > lastBlockNumber) {
          const _logs = await this.contract.getEvents("PoolSwap", {
            fromBlock: lastBlockNumber + 1n,
            toBlock: currentBlockNumber,
            filter: {
              poolId: filterByPoolId,
            },
          });

          // Get timestamps for each log
          const logsWithTimestamps = await Promise.all(
            [..._logs].reverse().map(async (log): Promise<PoolSwapLog> => {
              const block = await this.drift.getBlock(log.blockNumber);
              const timestamp = Number(block?.timestamp) * 1_000; // convert to ms for js

              if (flETHIsCurrencyZero === undefined) {
                return {
                  ...log,
                  timestamp,
                };
              }

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
              } = log.args;

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
              const absCurrency0Fees =
                currency0Fees < 0 ? -currency0Fees : currency0Fees;
              const absCurrency1Fees =
                currency1Fees < 0 ? -currency1Fees : currency1Fees;

              const fees = {
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
                  ...log,
                  timestamp,
                  type: swapType,
                  delta: {
                    coinsBought: flETHIsCurrencyZero
                      ? absCurrency1Delta - (!fees.isInFLETH ? fees.amount : 0n)
                      : absCurrency0Delta -
                        (!fees.isInFLETH ? fees.amount : 0n),
                    flETHSold: flETHIsCurrencyZero
                      ? absCurrency0Delta - (fees.isInFLETH ? fees.amount : 0n)
                      : absCurrency1Delta - (fees.isInFLETH ? fees.amount : 0n),
                    fees,
                  },
                };
              } else {
                return {
                  ...log,
                  timestamp,
                  type: swapType,
                  delta: {
                    coinsSold: flETHIsCurrencyZero
                      ? absCurrency1Delta - (!fees.isInFLETH ? fees.amount : 0n)
                      : absCurrency0Delta -
                        (!fees.isInFLETH ? fees.amount : 0n),
                    flETHBought: flETHIsCurrencyZero
                      ? absCurrency0Delta - (fees.isInFLETH ? fees.amount : 0n)
                      : absCurrency1Delta - (fees.isInFLETH ? fees.amount : 0n),
                    fees,
                  },
                };
              }
            })
          );

          if (logsWithTimestamps.length > 0) {
            onPoolSwap({
              logs: logsWithTimestamps as T extends boolean
                ? (BuySwapLog | SellSwapLog)[]
                : BaseSwapLog[],
              isFetchingFromStart: false,
            });
          } else {
            onPoolSwap({
              logs: [],
              isFetchingFromStart: false,
            });
          }

          lastBlockNumber = currentBlockNumber;
        }
      } catch (error) {
        console.error("Error polling events:", error);
      }
    };

    intervalId = setInterval(pollEvents, 5_000);

    this.pollPoolSwapNow = pollEvents;

    // Return both cleanup function and immediate poll function
    return {
      cleanup: () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
        // Clear the pollNow function when cleaning up
        this.pollPoolSwapNow = undefined;
      },
      pollPoolSwapNow: pollEvents,
    };
  }
}

export class ReadWriteAnyPositionManager extends ReadAnyPositionManager {
  declare contract: ReadWriteContract<AnyPositionManagerABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  async flaunch({
    memecoin,
    initialMarketCapUSD,
    creator,
    creatorFeeAllocationPercent,
  }: AnyFlaunchParams) {
    const initialMCapInUSDCWei = parseUnits(initialMarketCapUSD.toString(), 6);
    const initialPriceParams = encodeAbiParameters(
      [
        {
          type: "uint256",
        },
      ],
      [initialMCapInUSDCWei]
    );

    const creatorFeeAllocationInBps = creatorFeeAllocationPercent * 100;

    return this.contract.write(
      "flaunch",
      {
        _params: {
          memecoin,
          creator,
          creatorFeeAllocation: creatorFeeAllocationInBps,
          initialPriceParams,
          feeCalculatorParams: "0x",
        },
      },
      {
        onMined: async () => {
          if (this.pollPoolCreatedNow) {
            await this.pollPoolCreatedNow();
          }
        },
      }
    );
  }
}
