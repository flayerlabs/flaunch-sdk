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
import { RevenueManagerAddress, StakingManagerAddress } from "addresses";
import { Permissions } from "types";
import { getPermissionsAddress } from "helpers/permissions";
import { chainIdToChain } from "helpers/chainIdToChain";

export type TreasuryManagerFactoryABI = typeof TreasuryManagerFactoryAbi;

export interface DeployRevenueManagerParams {
  protocolRecipient: Address;
  protocolFeePercent: number;
  permissions?: Permissions;
}

export interface DeployStakingManagerParams {
  managerOwner: Address;
  stakingToken: Address;
  minEscrowDuration: bigint;
  minStakeDuration: bigint;
  creatorSharePercent: number;
  ownerSharePercent: number;
  permissions?: Permissions;
}

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

  /**
   * Deploys a new revenue manager
   * @param params - Parameters for deploying the revenue manager
   * @param params.protocolRecipient - The address of the protocol recipient
   * @param params.protocolFeePercent - The percentage of the protocol fee
   * @param params.permissions - The permissions for the revenue manager
   * @returns Transaction response
   */
  deployRevenueManager(params: DeployRevenueManagerParams) {
    const permissionsAddress = getPermissionsAddress(
      params.permissions ?? Permissions.OPEN,
      this.chainId
    );

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
      _permissions: permissionsAddress,
    });
  }

  /**
   * Deploys a new staking manager
   * @param params - Parameters for deploying the staking manager
   * @param params.managerOwner - The address of the manager owner
   * @param params.stakingToken - The address of the token to be staked
   * @param params.minEscrowDuration - The minimum duration (in seconds) that the creator's NFT is locked for
   * @param params.minStakeDuration - The minimum duration (in seconds) that the user's tokens are locked for
   * @param params.creatorSharePercent - The % share that a creator will earn from their token
   * @param params.ownerSharePercent - The % share that the manager owner will earn from their token
   * @param params.permissions - The permissions for the staking manager
   * @returns Transaction response
   */
  deployStakingManager(params: DeployStakingManagerParams) {
    const permissionsAddress = getPermissionsAddress(
      params.permissions ?? Permissions.OPEN,
      this.chainId
    );

    const VALID_SHARE_TOTAL = 100_00000n; // 5 decimals as BigInt

    return this.contract.write("deployAndInitializeManager", {
      _managerImplementation: StakingManagerAddress[this.chainId],
      _owner: params.managerOwner,
      _data: encodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              { type: "address", name: "stakingToken" },
              { type: "uint256", name: "minEscrowDuration" },
              { type: "uint256", name: "minStakeDuration" },
              { type: "uint256", name: "creatorShare" },
              { type: "uint256", name: "ownerShare" },
            ],
          },
        ],
        [
          {
            stakingToken: params.stakingToken,
            minEscrowDuration: params.minEscrowDuration,
            minStakeDuration: params.minStakeDuration,
            creatorShare:
              (BigInt(params.creatorSharePercent) * VALID_SHARE_TOTAL) / 100n,
            ownerShare:
              (BigInt(params.ownerSharePercent) * VALID_SHARE_TOTAL) / 100n,
          },
        ]
      ),
      _permissions: permissionsAddress,
    });
  }
}
