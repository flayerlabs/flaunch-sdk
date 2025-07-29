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
import { createPublicClient, encodeAbiParameters, http } from "viem";
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

    // Get the logs from the receipt and find the ManagerDeployed event
    const events = await publicClient.getContractEvents({
      address: this.contract.address,
      abi: TreasuryManagerFactoryAbi,
      eventName: "ManagerDeployed",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    // Find the event from our transaction
    const event = events.find((e) => e.transactionHash === hash);
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
