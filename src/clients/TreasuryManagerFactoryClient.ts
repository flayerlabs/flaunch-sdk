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
import {
  createPublicClient,
  type PublicClient,
  encodeAbiParameters,
  http,
  parseEventLogs,
} from "viem";
import { TreasuryManagerFactoryAbi } from "../abi/TreasuryManagerFactory";
import { chainIdToChain } from "helpers/chainIdToChain";

export type TreasuryManagerFactoryABI = typeof TreasuryManagerFactoryAbi;

export class ReadTreasuryManagerFactory {
  chainId: number;
  public readonly contract: ReadContract<TreasuryManagerFactoryABI>;
  public readonly publicClient: PublicClient | undefined;

  constructor(
    chainId: number,
    address: Address,
    drift: Drift = createDrift(),
    publicClient?: PublicClient
  ) {
    if (!address) {
      throw new Error("Address is required");
    }
    this.contract = drift.contract({
      abi: TreasuryManagerFactoryAbi,
      address,
    });
    this.chainId = chainId;
    this.publicClient = publicClient;
  }

  async getManagerDeployedAddressFromTx(hash: HexString) {
    // Wait for transaction receipt
    if (!this.publicClient) {
      throw new Error("Public client is required");
    }

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Parse the ManagerDeployed event from receipt logs
    const parsedLogs = parseEventLogs({
      abi: TreasuryManagerFactoryAbi,
      eventName: "ManagerDeployed",
      logs: receipt.logs,
    });

    // Find the event from our transaction
    const event = parsedLogs.find(
      (log) => log.address.toLowerCase() === this.contract.address.toLowerCase()
    );
    if (!event) {
      throw new Error("ManagerDeployed event not found in transaction logs");
    }

    return event.args._manager as Address;
  }
}

export class ReadWriteTreasuryManagerFactory extends ReadTreasuryManagerFactory {
  declare contract: ReadWriteContract<TreasuryManagerFactoryABI>;

  constructor(
    chainId: number,
    address: Address,
    drift: Drift = createDrift(),
    publicClient?: PublicClient
  ) {
    super(chainId, address, drift, publicClient);
  }
}
