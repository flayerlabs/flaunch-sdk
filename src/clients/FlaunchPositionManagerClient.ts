import {
  type ReadContract,
  type Address,
  type Drift,
  type EventLog,
  type ReadWriteContract,
  type ReadWriteAdapter,
  createDrift,
} from "@delvtech/drift";
import { FlaunchPositionManagerAbi } from "../abi/FlaunchPositionManager";
import { encodeAbiParameters, parseUnits } from "viem";
import { IPFSParams } from "../types";
import { generateTokenUri } from "helpers/ipfs";

export type FlaunchPositionManagerABI = typeof FlaunchPositionManagerAbi;
export type PoolCreatedLog = EventLog<
  FlaunchPositionManagerABI,
  "PoolCreated"
> & {
  timestamp: number;
};
export type PoolCreatedLogs = PoolCreatedLog[];

export interface WatchPoolCreatedParams {
  onPoolCreated: (logs: PoolCreatedLogs) => void;
  startBlockNumber?: bigint;
}

export interface FlaunchParams {
  flaunchingETHFees: bigint;
  name: string;
  symbol: string;
  tokenUri: string;
  fairLaunchPercent: number;
  initialMarketCapUSD: number;
  creator: Address;
  creatorFeeAllocationPercent: number;
  flaunchAt?: bigint;
  premineAmount?: bigint;
}

export interface FlaunchIPFSParams
  extends Omit<FlaunchParams, "tokenUri">,
    IPFSParams {}

export class ReadFlaunchPositionManager {
  contract: ReadContract<FlaunchPositionManagerABI>;
  drift: Drift;
  pollNow?: () => Promise<void>;
  TOTAL_SUPPLY = 100n * 10n ** 27n; // 100 Billion tokens in wei

  constructor(address: Address, drift: Drift = createDrift()) {
    this.drift = drift;
    if (!address) {
      throw new Error("Address is required");
    }
    this.contract = drift.contract({
      abi: FlaunchPositionManagerAbi,
      address,
    });
  }

  async isValidCoin(coinAddress: Address) {
    const poolKey = await this.contract.read("poolKey", {
      _token: coinAddress,
    });

    return poolKey.tickSpacing !== 0;
  }

  async watchPoolCreated({
    onPoolCreated,
    startBlockNumber,
  }: WatchPoolCreatedParams) {
    let intervalId: ReturnType<typeof setInterval>;
    let lastBlockNumber =
      startBlockNumber ?? (await this.drift.getBlockNumber());

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
              const block = await this.drift.getBlock({
                blockNumber: log.blockNumber,
              });
              return {
                ...log,
                timestamp: Number(block?.timestamp) * 1_000, // convert to ms for js
              };
            })
          );

          if (logsWithTimestamps.length > 0) {
            onPoolCreated(logsWithTimestamps);
          }

          lastBlockNumber = currentBlockNumber;
        }
      } catch (error) {
        console.error("Error polling events:", error);
      }
    };

    intervalId = setInterval(pollEvents, 5_000);

    this.pollNow = pollEvents;

    // Return both cleanup function and immediate poll function
    return {
      cleanup: () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
        // Clear the pollNow function when cleaning up
        this.pollNow = undefined;
      },
      pollNow: pollEvents,
    };
  }
}

export class ReadWriteFlaunchPositionManager extends ReadFlaunchPositionManager {
  declare contract: ReadWriteContract<FlaunchPositionManagerABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  // TODO: auto calculate flaunchingETHFees with buffer
  flaunch({
    flaunchingETHFees,
    name,
    symbol,
    tokenUri,
    fairLaunchPercent,
    initialMarketCapUSD,
    creator,
    creatorFeeAllocationPercent,
    flaunchAt,
    premineAmount,
  }: FlaunchParams) {
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

    return this.contract.write(
      "flaunch",
      {
        _params: {
          name,
          symbol,
          tokenUri,
          initialTokenFairLaunch:
            (this.TOTAL_SUPPLY * fairLaunchInBps) / 10_000n,
          premineAmount: premineAmount ?? 0n,
          creator,
          creatorFeeAllocation: creatorFeeAllocationInBps,
          flaunchAt: flaunchAt ?? 0n,
          initialPriceParams,
          feeCalculatorParams: "0x",
        },
      },
      {
        value: flaunchingETHFees,
        onMined: async () => {
          if (this.pollNow) {
            await this.pollNow();
          }
        },
      }
    );
  }

  async flaunchIPFS({
    flaunchingETHFees,
    name,
    symbol,
    fairLaunchPercent,
    initialMarketCapUSD,
    creator,
    creatorFeeAllocationPercent,
    flaunchAt,
    premineAmount,
    metadata,
    pinataConfig,
  }: FlaunchIPFSParams) {
    const tokenUri = await generateTokenUri(name, {
      metadata,
      pinataConfig,
    });

    return this.flaunch({
      flaunchingETHFees,
      name,
      symbol,
      tokenUri,
      fairLaunchPercent,
      initialMarketCapUSD,
      creator,
      creatorFeeAllocationPercent,
      flaunchAt,
      premineAmount,
    });
  }
}
