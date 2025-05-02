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
import { StateViewAbi } from "../abi/StateView";
import { PositionInfoParams } from "./PoolManagerClient";
import { stringToHex } from "viem";
import { pad } from "viem";

export type StateViewABI = typeof StateViewAbi;

/**
 * Client for reading state information from Uniswap V4 pools
 * Provides methods to query pool states, positions, and tick liquidity
 */
export class ReadStateView {
  public readonly contract: ReadContract<StateViewABI>;

  /**
   * Creates a new ReadStateView instance
   * @param address - The address of the StateView contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: StateViewAbi,
      address,
    });
  }

  /**
   * Gets the Slot0 data for a pool
   * @param poolId - The ID of the pool to query
   * @returns Promise<{tick: number, sqrtPriceX96: bigint, protocolFees: bigint}> - Current pool state
   */
  poolSlot0({ poolId }: { poolId: HexString }) {
    return this.contract.read("getSlot0", {
      poolId,
    });
  }

  /**
   * Gets information about a liquidity position
   * @param poolId - The ID of the pool
   * @param owner - The address of the position owner
   * @param tickLower - The lower tick of the position
   * @param tickUpper - The upper tick of the position
   * @param salt - The salt used to identify the position
   * @returns Promise<{liquidity: bigint, feeGrowthInside0LastX128: bigint, feeGrowthInside1LastX128: bigint, tokensOwed0: bigint, tokensOwed1: bigint}> - Position details
   */
  positionInfo({
    poolId,
    owner,
    tickLower,
    tickUpper,
    salt,
  }: PositionInfoParams) {
    const saltBytes32 = pad(stringToHex(salt), { size: 32, dir: "right" });

    return this.contract.read("getPositionInfo", {
      poolId,
      owner,
      tickLower,
      tickUpper,
      salt: saltBytes32,
    });
  }

  /**
   * Gets the liquidity at a specific tick
   * @param poolId - The ID of the pool
   * @param tick - The tick to query
   * @returns Promise<{liquidityGross: bigint, liquidityNet: bigint, feeGrowthOutside0X128: bigint, feeGrowthOutside1X128: bigint}> - Tick liquidity information
   */
  getTickLiquidity({ poolId, tick }: { poolId: HexString; tick: number }) {
    return this.contract.read("getTickLiquidity", {
      poolId,
      tick,
    });
  }
}
