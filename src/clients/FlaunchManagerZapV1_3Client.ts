import {
  type ReadContract,
  type Address,
  type Drift,
  type HexString,
  type ReadWriteContract,
  type ReadWriteAdapter,
  createDrift,
} from "@delvtech/drift";
import { encodeAbiParameters, zeroAddress } from "viem";
import { FlaunchManagerZapV1_3Abi } from "../abi/FlaunchManagerZapV1_3";
import { getPermissionsAddressV1_3 } from "../helpers/permissions";
import { Permissions } from "../types";
import {
  RevenueManagerV1_3Address,
  StakingManagerV1_3Address,
} from "../addresses";
import type {
  DeployRevenueManagerParams,
  DeployStakingManagerParams,
} from "./FlaunchZapClient";

export type FlaunchManagerZapV1_3ABI = typeof FlaunchManagerZapV1_3Abi;

export interface DeployManagerV1_3Params {
  /** A manager implementation approved on the v1.3.1 TreasuryManagerFactory (e.g. `RevenueManagerV1_3Address`) */
  managerImplementation: Address;
  /** The address that will own the deployed manager */
  owner: Address;
  /** The ABI-encoded initialization params of the implementation */
  data: HexString;
  /** The permissions to set on the manager. Defaults to OPEN */
  permissions?: Permissions;
}

/**
 * Client for the v1.3.1 FlaunchManagerZap in read-only mode.
 *
 * The zap deploys and initializes a manager through the v1.3.1 TreasuryManagerFactory in one
 * call, sets its permissions and hands ownership to the chosen owner. Flaunching a coin straight
 * into a manager stays with the core FlaunchZap.
 */
export class ReadFlaunchManagerZapV1_3 {
  chainId: number;
  public readonly contract: ReadContract<FlaunchManagerZapV1_3ABI>;

  /**
   * Creates a new ReadFlaunchManagerZapV1_3 instance
   * @param chainId - The chain ID of the contract
   * @param address - The address of the FlaunchManagerZap contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(chainId: number, address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }
    this.chainId = chainId;
    this.contract = drift.contract({
      abi: FlaunchManagerZapV1_3Abi,
      address,
    });
  }

  /**
   * Gets the v1.3.1 TreasuryManagerFactory the zap deploys through
   * @returns Promise<Address> - The factory address
   */
  treasuryManagerFactory() {
    return this.contract.read("treasuryManagerFactory");
  }
}

/**
 * Extended client for the v1.3.1 FlaunchManagerZap with write capabilities
 */
export class ReadWriteFlaunchManagerZapV1_3 extends ReadFlaunchManagerZapV1_3 {
  declare contract: ReadWriteContract<FlaunchManagerZapV1_3ABI>;

  constructor(
    chainId: number,
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(chainId, address, drift);
  }

  /**
   * Deploys a manager from an approved v1.3.1 implementation, initializes it, sets its
   * permissions and transfers ownership to `owner`. The deployed address is the contract's
   * return value and the `ManagerDeployed` event on the v1.3.1 factory.
   * @param params.managerImplementation - The approved manager implementation to clone
   * @param params.owner - The address that will own the deployed manager
   * @param params.data - The ABI-encoded initialization params of the implementation
   * @param params.permissions - The permissions to set on the manager. Defaults to OPEN
   * @returns Promise<Hex> - The transaction hash
   */
  deployAndInitializeManager(params: DeployManagerV1_3Params) {
    if (!params.managerImplementation || params.managerImplementation === zeroAddress) {
      throw new Error("managerImplementation is required");
    }
    if (!params.owner || params.owner === zeroAddress) {
      throw new Error("owner is required");
    }

    return this.contract.write("deployAndInitializeManager", {
      _managerImplementation: params.managerImplementation,
      _owner: params.owner,
      _data: params.data,
      _permissions: getPermissionsAddressV1_3(
        params.permissions ?? Permissions.OPEN,
        this.chainId
      ),
    });
  }

  /**
   * Deploys a new v1.3.1 multi-asset RevenueManager, owned by the protocol recipient
   * @param params.protocolRecipient - The address of the protocol recipient (and manager owner)
   * @param params.protocolFeePercent - The percentage of fees taken by the protocol (0-100)
   * @param params.permissions - The permissions for the revenue manager. Defaults to OPEN
   * @returns Promise<Hex> - The transaction hash
   */
  deployRevenueManager(params: DeployRevenueManagerParams) {
    if (
      !Number.isFinite(params.protocolFeePercent) ||
      params.protocolFeePercent < 0 ||
      params.protocolFeePercent > 100
    ) {
      throw new Error("protocolFeePercent must be between 0 and 100");
    }

    return this.deployAndInitializeManager({
      managerImplementation: RevenueManagerV1_3Address[this.chainId],
      owner: params.protocolRecipient,
      data: encodeAbiParameters(
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
            // Convert percentage to basis points
            protocolFee: BigInt(Math.round(params.protocolFeePercent * 100)),
          },
        ]
      ),
      permissions: params.permissions,
    });
  }

  /**
   * Deploys a new v1.3.1 multi-asset StakingManager (a Group whose rewards accrue per payout
   * asset), owned by `managerOwner`
   * @param params.managerOwner - The address of the manager owner
   * @param params.stakingToken - The address of the token to be staked
   * @param params.minEscrowDuration - The minimum duration (in seconds) that the creator's NFT is locked for
   * @param params.minStakeDuration - The minimum duration (in seconds) that the user's tokens are locked for
   * @param params.creatorSharePercent - The % share that a creator will earn from their token (0-100)
   * @param params.ownerSharePercent - The % share that the manager owner will earn from their token (0-100)
   * @param params.permissions - The permissions for the staking manager. Defaults to OPEN
   * @returns Promise<Hex> - The transaction hash
   */
  deployStakingManager(params: DeployStakingManagerParams) {
    for (const [name, percent] of [
      ["creatorSharePercent", params.creatorSharePercent],
      ["ownerSharePercent", params.ownerSharePercent],
    ] as const) {
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new Error(`${name} must be between 0 and 100`);
      }
    }
    if (params.creatorSharePercent + params.ownerSharePercent > 100) {
      throw new Error("creatorSharePercent + ownerSharePercent must not exceed 100");
    }
    if (!params.stakingToken || params.stakingToken === zeroAddress) {
      throw new Error("stakingToken is required");
    }

    // Shares are expressed against VALID_SHARE_TOTAL = 100_00000 (5 decimals)
    const VALID_SHARE_TOTAL = 100_00000n;
    const toShare = (percent: number) =>
      (BigInt(Math.round(percent * 100_000)) * VALID_SHARE_TOTAL) /
      (100n * 100_000n);

    return this.deployAndInitializeManager({
      managerImplementation: StakingManagerV1_3Address[this.chainId],
      owner: params.managerOwner,
      data: encodeAbiParameters(
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
            creatorShare: toShare(params.creatorSharePercent),
            ownerShare: toShare(params.ownerSharePercent),
          },
        ]
      ),
      permissions: params.permissions,
    });
  }
}
