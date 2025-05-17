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
import { MemecoinAbi } from "../abi/Memecoin";

export type MemecoinABI = typeof MemecoinAbi;

/**
 * Client for interacting with Memecoin (ERC20) contracts in read-only mode
 * Provides methods to query basic token information and balances
 */
export class ReadMemecoin {
  public readonly contract: ReadContract<MemecoinABI>;

  /**
   * Creates a new ReadMemecoin instance
   * @param address - The address of the Memecoin contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: MemecoinAbi,
      address,
    });
  }

  /**
   * Gets the name of the token
   * @returns Promise<string> - The name of the token
   */
  name() {
    return this.contract.read("name", {});
  }

  /**
   * Gets the symbol of the token
   * @returns Promise<string> - The symbol of the token
   */
  symbol() {
    return this.contract.read("symbol");
  }

  /**
   * Gets the token URI containing metadata
   * @returns Promise<string> - The token URI
   */
  tokenURI() {
    return this.contract.read("tokenURI");
  }

  /**
   * Gets the total supply of the token
   * @returns Promise<bigint> - The total supply
   */
  totalSupply() {
    return this.contract.read("totalSupply");
  }

  /**
   * Gets the token balance of a specific user
   * @param user - The address of the user to check
   * @returns Promise<bigint> - The token balance
   */
  balanceOf(user: Address) {
    return this.contract.read("balanceOf", {
      account: user,
    });
  }
}
