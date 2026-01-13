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
import { FlaunchPositionManagerV1_1Abi } from "../abi/FlaunchPositionManagerV1_1";
import { encodeAbiParameters, parseUnits, zeroAddress, type Hex } from "viem";
import { IPFSParams } from "../types";
import { generateTokenUri } from "helpers/ipfs";
import { ReadInitialPrice } from "./InitialPriceClient";
import { getAmountWithSlippage } from "utils/universalRouter";
import { parseSwapData, type SwapLogArgs } from "utils/parseSwap";

export type FlaunchPositionManagerV1_1ABI =
  typeof FlaunchPositionManagerV1_1Abi;
export type PoolCreatedLog = EventLog<
  FlaunchPositionManagerV1_1ABI,
  "PoolCreated"
> & {
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

export type BaseSwapLog = EventLog<
  FlaunchPositionManagerV1_1ABI,
  "PoolSwap"
> & {
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

export interface FlaunchParams {
  name: string;
  symbol: string;
  tokenUri: string;
  /** @deprecated FairLaunch has been deprecated. Please set fairLaunchPercent to 0. */
  fairLaunchPercent: number;
  fairLaunchDuration: bigint;
  initialMarketCapUSD: number;
  creator: Address;
  creatorFeeAllocationPercent: number;
  flaunchAt?: bigint;
}

export interface FlaunchIPFSParams
  extends Omit<FlaunchParams, "tokenUri">,
    IPFSParams {}

export class ReadFlaunchPositionManagerV1_1 {
  public readonly contract: ReadContract<FlaunchPositionManagerV1_1ABI>;
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
      abi: FlaunchPositionManagerV1_1Abi,
      address,
    });
  }

  getFeeCalculator({ forFairLaunch }: { forFairLaunch: boolean }) {
    return this.contract.read("getFeeCalculator", {
      _isFairLaunch: forFairLaunch,
    });
  }

  async isValidCoin(coinAddress: Address) {
    const poolKey = await this.contract.read("poolKey", {
      _token: coinAddress,
    });

    return poolKey.tickSpacing !== 0;
  }

  getFlaunchingMarketCap(initialPriceParams: HexString) {
    return this.contract.read("getFlaunchingMarketCap", {
      _initialPriceParams: initialPriceParams,
    });
  }

  async getFlaunchingFee(params: {
    sender: Address;
    initialPriceParams: HexString;
    slippagePercent?: number;
  }) {
    const readInitialPrice = new ReadInitialPrice(
      await this.contract.read("initialPrice"),
      this.drift
    );
    const flaunchingFee = await readInitialPrice.getFlaunchingFee(params);

    // increase the flaunching fee by the slippage percent
    const flaunchingFeeWithSlippage = getAmountWithSlippage({
      amount: flaunchingFee,
      slippage: (params.slippagePercent ?? 0 / 100).toFixed(18).toString(),
      swapType: "EXACT_OUT",
    });
    return flaunchingFeeWithSlippage;
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

  /**
   * Parses a transaction hash to extract PoolSwap events and return parsed swap data
   * @param txHash - The transaction hash to parse
   * @param flETHIsCurrencyZero - Whether flETH is currency 0 in the pool (optional)
   * @returns Parsed swap log or undefined if no PoolSwap event found
   */
  async parseSwapTx(
    txHash: Hex,
    flETHIsCurrencyZero?: boolean
  ): Promise<PoolSwapLog | undefined> {
    try {
      // Get transaction to get block number
      const tx = await this.drift.getTransaction({ hash: txHash });
      if (!tx) {
        return undefined;
      }

      // Get block to get timestamp
      const block = await this.drift.getBlock(tx.blockNumber);
      const timestamp = Number(block?.timestamp) * 1_000; // convert to ms for js

      // Get PoolSwap events from the specific transaction
      const swapLogs = await this.contract.getEvents("PoolSwap", {
        fromBlock: tx.blockNumber,
        toBlock: tx.blockNumber,
      });

      // Find the first swap log that matches our transaction hash
      const targetLog = swapLogs.find((log) => log.transactionHash === txHash);
      if (!targetLog) {
        return undefined;
      }

      // If flETHIsCurrencyZero is not provided, return basic log
      if (flETHIsCurrencyZero === undefined) {
        return {
          ...targetLog,
          timestamp,
        };
      }

      // Parse the swap data using the utility function
      const swapData = parseSwapData(
        targetLog.args as SwapLogArgs,
        flETHIsCurrencyZero
      );

      return {
        ...targetLog,
        timestamp,
        type: swapData.type,
        delta: swapData.delta,
      };
    } catch (error) {
      console.error("Error parsing swap transaction:", error);
      return undefined;
    }
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

              // parse swap data
              const swapData = parseSwapData(
                log.args as SwapLogArgs,
                flETHIsCurrencyZero
              );

              return {
                ...log,
                timestamp,
                type: swapData.type,
                delta: swapData.delta,
              };
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

  initialPrice() {
    return this.contract.read("initialPrice");
  }
}

export class ReadWriteFlaunchPositionManagerV1_1 extends ReadFlaunchPositionManagerV1_1 {
  declare contract: ReadWriteContract<FlaunchPositionManagerV1_1ABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Flaunches a new token directly from the position manager.
   * For premine support, flaunch via the FlaunchZapClient.
   * @param params - Parameters for the flaunch
   * @param params.fairLaunchPercent - @deprecated FairLaunch has been deprecated. Please set to 0.
   */
  async flaunch({
    name,
    symbol,
    tokenUri,
    fairLaunchPercent,
    fairLaunchDuration,
    initialMarketCapUSD,
    creator,
    creatorFeeAllocationPercent,
    flaunchAt,
  }: FlaunchParams) {
    if (fairLaunchPercent !== 0) {
      throw new Error(
        "FairLaunch has been deprecated. Please set fairLaunchPercent to 0."
      );
    }

    const initialMCapInUSDCWei = parseUnits(initialMarketCapUSD.toString(), 6);
    const initialPriceParams = encodeAbiParameters(
      [
        {
          type: "uint256",
        },
      ],
      [initialMCapInUSDCWei]
    );

    const fairLaunchInBps = BigInt(fairLaunchPercent * 100);
    const creatorFeeAllocationInBps = creatorFeeAllocationPercent * 100;

    let sender: Address = zeroAddress;
    if (this.drift.adapter.getSignerAddress) {
      sender = await this.drift.adapter.getSignerAddress();
    }

    const flaunchingFee = await this.getFlaunchingFee({
      sender,
      initialPriceParams,
      slippagePercent: 5,
    });

    return this.contract.write(
      "flaunch",
      {
        _params: {
          name,
          symbol,
          tokenUri,
          initialTokenFairLaunch:
            (this.TOTAL_SUPPLY * fairLaunchInBps) / 10_000n,
          fairLaunchDuration,
          premineAmount: 0n,
          creator,
          creatorFeeAllocation: creatorFeeAllocationInBps,
          flaunchAt: flaunchAt ?? 0n,
          initialPriceParams,
          feeCalculatorParams: "0x",
        },
      },
      {
        value: flaunchingFee,
        onMined: async () => {
          if (this.pollPoolCreatedNow) {
            await this.pollPoolCreatedNow();
          }
        },
      }
    );
  }

  /**
   * Flaunches a new token directly from the position manager by uploading the token metadata to IPFS.
   * For premine support, flaunch via the FlaunchZapClient.
   * @param params - Parameters for the flaunch including IPFS metadata
   * @param params.fairLaunchPercent - @deprecated FairLaunch has been deprecated. Please set to 0.
   */
  async flaunchIPFS({
    name,
    symbol,
    fairLaunchPercent,
    fairLaunchDuration,
    initialMarketCapUSD,
    creator,
    creatorFeeAllocationPercent,
    flaunchAt,
    metadata,
    pinataConfig,
  }: FlaunchIPFSParams) {
    const tokenUri = await generateTokenUri(name, symbol, {
      metadata,
      pinataConfig,
    });

    return this.flaunch({
      name,
      symbol,
      tokenUri,
      fairLaunchPercent,
      fairLaunchDuration,
      initialMarketCapUSD,
      creator,
      creatorFeeAllocationPercent,
      flaunchAt,
    });
  }
}
