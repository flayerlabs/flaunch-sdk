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
import { FlaunchV1_1_1Abi } from "../abi/FlaunchV1_1_1";

export type FlaunchV1_1_1ABI = typeof FlaunchV1_1_1Abi;

/**
 * Client for interacting with the Flaunch V1.1 contract in read-only mode
 * Provides methods to query token IDs and metadata URIs
 * Enhanced version of the V1 contract with additional features
 */
export class ReadFlaunchV1_1_1 {
  public readonly contract: ReadContract<FlaunchV1_1_1ABI>;

  /**
   * Creates a new ReadFlaunchV1_1 instance
   * @param address - The address of the Flaunch V1.1 contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: FlaunchV1_1_1Abi,
      address,
    });
  }

  /**
   * Gets the token ID associated with a memecoin
   * @param coinAddress - The address of the memecoin
   * @returns Promise<bigint> - The token ID
   */
  tokenId(coinAddress: Address) {
    return this.contract.read("tokenId", {
      _memecoin: coinAddress,
    });
  }

  /**
   * Gets the metadata URI for a token
   * @param tokenId - The ID of the token
   * @returns Promise<string> - The token's metadata URI
   */
  tokenURI(tokenId: bigint) {
    return this.contract.read("tokenURI", {
      _tokenId: tokenId,
    });
  }
}
