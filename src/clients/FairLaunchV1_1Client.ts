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
import { FairLaunchV1_1Abi } from "../abi/FairLaunchV1_1";

export type FairLaunchV1_1ABI = typeof FairLaunchV1_1Abi;

/**
 * Client for interacting with the FairLaunch V1.1 contract in read-only mode
 * Provides methods to query fair launch information and status
 * Enhanced version of the V1 contract with additional features like variable duration
 */
export class ReadFairLaunchV1_1 {
  public readonly contract: ReadContract<FairLaunchV1_1ABI>;

  /**
   * Creates a new ReadFairLaunchV1_1 instance
   * @param address - The address of the FairLaunch V1.1 contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: FairLaunchV1_1Abi,
      address,
    });
  }

  /**
   * Gets information about a fair launch for a specific pool
   * @param poolId - The ID of the pool
   * @returns Promise<{initialTick: number, closed: boolean, startsAt: number, endsAt: number}> - Fair launch details
   */
  fairLaunchInfo({ poolId }: { poolId: HexString }) {
    return this.contract.read("fairLaunchInfo", {
      _poolId: poolId,
    });
  }

  /**
   * Calculates the duration of a fair launch
   * @param poolId - The ID of the pool
   * @returns Promise<number> - The duration in seconds between start and end time
   */
  async fairLaunchDuration({ poolId }: { poolId: HexString }) {
    const { startsAt, endsAt } = await this.fairLaunchInfo({ poolId });
    return endsAt - startsAt;
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
