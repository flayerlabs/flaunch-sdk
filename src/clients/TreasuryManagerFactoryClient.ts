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

  constructor(chainId: number, address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }
    this.contract = drift.contract({
      abi: TreasuryManagerFactoryAbi,
      address,
    });
    this.chainId = chainId;
  }

  async getManagerDeployedAddressFromTx(hash: HexString) {
    // Create a public client to get the transaction receipt with logs
    const publicClient = createPublicClient({
      chain: chainIdToChain[this.chainId],
      transport: http(),
    });

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

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

  constructor(chainId: number, address: Address, drift: Drift = createDrift()) {
    super(chainId, address, drift);
  }
}
