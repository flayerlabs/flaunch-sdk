import {
  type ReadContract,
  type Address,
  type Drift,
  type ReadWriteContract,
  type ReadWriteAdapter,
  createDrift,
} from "@delvtech/drift";
import { FeeEscrowAbi } from "../abi/FeeEscrow";

export type FeeEscrowABI = typeof FeeEscrowAbi;

/**
 * Client for interacting with the FeeEscrow contract in read-only mode
 * Provides methods to query fee balances and withdraw fees
 */
export class ReadFeeEscrow {
  public readonly contract: ReadContract<FeeEscrowABI>;

  /**
   * Creates a new ReadFeeEscrow instance
   * @param address - The address of the FeeEscrow contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: FeeEscrowAbi,
      address,
    });
  }

  /**
   * Gets the claimable balance of fees for a creator
   * @param creator - The address of the creator to check
   * @returns Promise<bigint> - The claimable balance of fees
   */
  balances(creator: Address) {
    return this.contract.read("balances", {
      _recipient: creator,
    });
  }
}

/**
 * Extended client for interacting with the FeeEscrow contract with write capabilities
 * Provides methods to withdraw fees
 */
export class ReadWriteFeeEscrow extends ReadFeeEscrow {
  declare contract: ReadWriteContract<FeeEscrowABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Withdraws fees as ETH to a recipient
   * @param recipient - The address to receive the fees
   * @param unwrap - Whether to unwrap the native token before sending
   * @returns Promise<void>
   */
  withdrawFees(recipient: Address) {
    return this.contract.write("withdrawFees", {
      _recipient: recipient,
      _unwrap: true,
    });
  }
}
