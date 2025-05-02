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
import { TreasuryManagerFactoryAbi } from "../abi/TreasuryManagerFactory";
import { RevenueManagerAddress } from "addresses";
import { encodeAbiParameters } from "viem";

export type TreasuryManagerFactoryABI = typeof TreasuryManagerFactoryAbi;

export class ReadTreasuryManagerFactory {
  public readonly contract: ReadContract<TreasuryManagerFactoryABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }
    this.contract = drift.contract({
      abi: TreasuryManagerFactoryAbi,
      address,
    });
  }
}

export class ReadWriteTreasuryManagerFactory extends ReadTreasuryManagerFactory {
  chainId: number;
  declare contract: ReadWriteContract<TreasuryManagerFactoryABI>;

  constructor(chainId: number, address: Address, drift: Drift = createDrift()) {
    super(address, drift);
    this.chainId = chainId;
  }

  /**
   * Deploys a new revenue manager
   * @param params - Parameters for deploying the revenue manager
   * @param params.protocolRecipient - The address of the protocol recipient
   * @param params.protocolFeePercent - The percentage of the protocol fee
   * @returns Transaction response
   */
  deployRevenueManager(params: {
    protocolRecipient: Address;
    protocolFeePercent: number;
  }) {
    return this.contract.write("deployAndInitializeManager", {
      _managerImplementation: RevenueManagerAddress[this.chainId],
      _owner: params.protocolRecipient,
      _data: encodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              { type: "address", name: "protocolRecipient" },
              { type: "uint256", name: "protocolFee" },
            ],
          },
        ],
        [
          {
            protocolRecipient: params.protocolRecipient,
            protocolFee: BigInt(params.protocolFeePercent * 100), // Convert percentage to basis points
          },
        ]
      ),
    });
  }
}
