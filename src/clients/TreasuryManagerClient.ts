import {
  type ReadContract,
  type Address,
  type Drift,
  type ReadWriteContract,
  type ReadWriteAdapter,
  createDrift,
} from "@delvtech/drift";
import { TreasuryManagerAbi } from "../abi/TreasuryManager";

export type TreasuryManagerABI = typeof TreasuryManagerAbi;

export type FlaunchToken = {
  flaunch: Address;
  tokenId: bigint;
};

/**
 * Client for interacting with the TreasuryManager contract in read-only mode
 * Provides methods to query permissions and manager owner
 */
export class ReadTreasuryManager {
  public readonly contract: ReadContract<TreasuryManagerABI>;

  /**
   * Creates a new ReadTreasuryManager instance
   * @param address - The address of the TreasuryManager contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: TreasuryManagerAbi,
      address,
    });
  }

  /**
   * Gets the permissions contract address
   * @returns Promise<Address> - The address of the permissions contract
   */
  permissions() {
    return this.contract.read("permissions");
  }

  /**
   * Gets the manager owner address
   * @returns Promise<Address> - The address of the manager owner
   */
  managerOwner() {
    return this.contract.read("managerOwner");
  }
}

/**
 * Extended client for interacting with the TreasuryManager contract with write capabilities
 * Provides methods to deposit tokens, set permissions, and transfer ownership
 */
export class ReadWriteTreasuryManager extends ReadTreasuryManager {
  declare contract: ReadWriteContract<TreasuryManagerABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Deposits a flaunch token to the treasury
   * @param flaunchToken - The flaunch token to deposit
   * @param creator - The address of the creator
   * @param data - Additional data for the deposit
   * @returns Promise<void>
   */
  deposit(flaunchToken: FlaunchToken, creator: Address, data: `0x${string}`) {
    return this.contract.write("deposit", {
      _flaunchToken: flaunchToken,
      _creator: creator,
      _data: data,
    });
  }

  /**
   * Sets the permissions contract address
   * @param permissions - The address of the new permissions contract
   * @returns Promise<void>
   */
  setPermissions(permissions: Address) {
    return this.contract.write("setPermissions", {
      _permissions: permissions,
    });
  }

  /**
   * Transfers the manager ownership to a new address
   * @param newManagerOwner - The address of the new manager owner
   * @returns Promise<void>
   */
  transferManagerOwnership(newManagerOwner: Address) {
    return this.contract.write("transferManagerOwnership", {
      _newManagerOwner: newManagerOwner,
    });
  }
}
