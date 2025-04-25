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
import { BidWallV1_1Abi } from "../abi/BidWallV1_1";

export type BidwallV1_1ABI = typeof BidWallV1_1Abi;

/**
 * Client for interacting with the BidWall V1.1 contract in read-only mode
 * Provides methods to query bid wall positions and pool information
 * Enhanced version of the V1 contract with additional features
 */
export class ReadBidWallV1_1 {
  public readonly contract: ReadContract<BidwallV1_1ABI>;

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
      abi: BidWallV1_1Abi,
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
