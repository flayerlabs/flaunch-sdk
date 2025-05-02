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
import { RevenueManagerAbi } from "../abi/RevenueManager";

export type RevenueManagerABI = typeof RevenueManagerAbi;

export class ReadRevenueManager {
  public readonly contract: ReadContract<RevenueManagerABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    this.contract = drift.contract({
      abi: RevenueManagerAbi,
      address,
    });
  }

  /**
   * Gets the claimable balance of ETH for the recipient
   * @param recipient - The address of the recipient to check
   * @returns Promise<bigint> - The claimable balance of ETH
   */
  balances(address: Address) {
    return this.contract.read("balances", {
      _recipient: address,
    });
  }

  /**
   * Gets the protocol recipient address
   * @returns Promise<Address> - The protocol recipient address
   */
  protocolRecipient() {
    return this.contract.read("protocolRecipient");
  }
}

export class ReadWriteRevenueManager extends ReadRevenueManager {
  declare contract: ReadWriteContract<RevenueManagerABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Allows the protocol recipient to claim the protocol's share of the revenue
   * @returns Promise<TransactionResponse> - The transaction response
   */
  protocolClaim() {
    return this.contract.write("claim", {});
  }

  /**
   * Allows the creator to claim their total share of the revenue from a revenue manager
   * @returns Promise<TransactionResponse> - The transaction response
   */
  creatorClaim() {
    return this.contract.write("claim", {});
  }

  /**
   * Allows the creator to claim their share of the revenue from specific flaunch tokens
   * @param flaunchTokens - The flaunch token ids to claim the revenue for
   * @returns Promise<TransactionResponse> - The transaction response
   */
  creatorClaimForTokens(
    flaunchTokens: { flaunch: Address; tokenId: bigint }[]
  ) {
    return this.contract.write("claim", {
      _flaunchToken: flaunchTokens,
    });
  }
}
