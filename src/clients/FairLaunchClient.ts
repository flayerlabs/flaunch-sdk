import {
  type ReadContract,
  type Address,
  type Drift,
  type EventLog,
  type ReadWriteContract,
  type ReadWriteAdapter,
  type HexString,
  createDrift,
} from "@delvtech/drift";
import { FairLaunchAbi } from "../abi/FairLaunch";

export type FairLaunchABI = typeof FairLaunchAbi;

/**
 * Client for interacting with the FairLaunch V1 contract in read-only mode
 * Provides methods to query fair launch information and status
 */
export class ReadFairLaunch {
  public readonly contract: ReadContract<FairLaunchABI>;

  /**
   * Creates a new ReadFairLaunch instance
   * @param address - The address of the FairLaunch contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: FairLaunchAbi,
      address,
    });
  }

  fairLaunchDuration({ poolId }: { poolId: HexString }) {
    return 30 * 60; // 30 minutes
  }

  /**
   * Gets information about a fair launch for a specific pool
   * @param poolId - The ID of the pool
   * @returns Promise<{initialTick: number, closed: boolean, endsAt: number}> - Fair launch details
   */
  fairLaunchInfo({ poolId }: { poolId: HexString }) {
    return this.contract.read("fairLaunchInfo", {
      _poolId: poolId,
    });
  }

  /**
   * Checks if a fair launch is currently active
   * @param poolId - The ID of the pool
   * @returns Promise<boolean> - True if the fair launch is active (not closed and not expired), false otherwise
   */
  async isFairLaunchActive({ poolId }: { poolId: HexString }) {
    const { closed, endsAt } = await this.fairLaunchInfo({ poolId });
    if (closed) {
      return false;
    }

    if (new Date().getTime() / 1000 > endsAt) {
      return false;
    }

    return true;
  }
}
