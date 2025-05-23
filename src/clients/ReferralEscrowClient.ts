import {
  type ReadContract,
  type Address,
  type Drift,
  type ReadWriteContract,
  type ReadWriteAdapter,
  createDrift,
} from "@delvtech/drift";
import { ReferralEscrowAbi } from "../abi/ReferralEscrow";

export type ReferralEscrowABI = typeof ReferralEscrowAbi;

/**
 * Client for interacting with the ReferralEscrow contract in read-only mode
 * Provides methods to query token allocations
 */
export class ReadReferralEscrow {
  public readonly contract: ReadContract<ReferralEscrowABI>;

  /**
   * Creates a new ReadReferralEscrow instance
   * @param address - The address of the ReferralEscrow contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: ReferralEscrowAbi,
      address,
    });
  }

  /**
   * Gets the token allocation for a specific user and token
   * @param user - The address of the user to check
   * @param token - The address of the token
   * @returns Promise<bigint> - The allocated token amount
   */
  allocations(user: Address, token: Address) {
    return this.contract.read("allocations", {
      _user: user,
      _token: token,
    });
  }
}

/**
 * Extended client for interacting with the ReferralEscrow contract with write capabilities
 * Provides methods to claim tokens
 */
export class ReadWriteReferralEscrow extends ReadReferralEscrow {
  declare contract: ReadWriteContract<ReferralEscrowABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Claims tokens for a recipient
   * @param tokens - Array of token addresses to claim
   * @param recipient - The address to receive the claimed tokens
   * @returns Promise<void>
   */
  claimTokens(tokens: Address[], recipient: Address) {
    return this.contract.write("claimTokens", {
      _tokens: tokens,
      _recipient: recipient,
    });
  }
}
