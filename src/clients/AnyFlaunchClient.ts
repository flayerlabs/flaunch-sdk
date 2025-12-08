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
import { AnyFlaunchAbi } from "../abi/AnyFlaunch";

export type AnyFlaunchABI = typeof AnyFlaunchAbi;

/**
 * Client for interacting with the AnyFlaunch contract in read-only mode
 * Provides methods to query token IDs and metadata URIs
 */
export class ReadAnyFlaunch {
  public readonly contract: ReadContract<AnyFlaunchABI>;

  /**
   * Creates a new ReadAnyFlaunch instance
   * @param address - The address of the AnyFlaunch contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: AnyFlaunchAbi,
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

  /**
   * Gets the memecoin address for a given token ID
   * @param tokenId - The ID of the token
   * @returns Promise<Address> - The address of the memecoin
   */
  memecoin(tokenId: bigint) {
    return this.contract.read("memecoin", {
      _tokenId: tokenId,
    });
  }
}
