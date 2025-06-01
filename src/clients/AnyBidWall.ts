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
import { AnyBidWallAbi } from "../abi/AnyBidWall";

export type AnyBidWallABI = typeof AnyBidWallAbi;

/**
 * Client for interacting with the AnyBidWall contract in read-only mode
 * Provides methods to query bid wall positions and pool information
 * Enhanced version of the V1 contract with additional features
 */
export class AnyBidWall {
  public readonly contract: ReadContract<AnyBidWallABI>;

  /**
   * Creates a new ReadBidWallV1_1 instance
   * @param address - The address of the BidWall V1.1 contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: AnyBidWallAbi,
      address,
    });
  }

  /**
   * Gets information about a bid wall position for a specific pool
   * @param poolId - The ID of the pool
   * @returns Promise<{amount0_: bigint, amount1_: bigint, pendingEth_: bigint}> - Position details including token amounts and pending ETH
   */
  position({ poolId }: { poolId: HexString }) {
    return this.contract.read("position", {
      _poolId: poolId,
    });
  }

  /**
   * Gets configuration information about a pool's bid wall
   * @param poolId - The ID of the pool
   * @returns Promise<{tickLower: number, tickUpper: number}> - Pool configuration including tick range
   */
  poolInfo({ poolId }: { poolId: HexString }) {
    return this.contract.read("poolInfo", {
      _poolId: poolId,
    });
  }
}
