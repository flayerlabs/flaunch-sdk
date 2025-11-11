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
import { FlaunchZapAbi } from "../abi/FlaunchZap";
import { parseUnits, zeroAddress, zeroHash } from "viem";
import { encodeAbiParameters } from "viem";
import { generateTokenUri } from "../helpers/ipfs";
import { getPermissionsAddress } from "../helpers/permissions";
import { IPFSParams, Permissions } from "../types";
import {
  BuyBackManagerAddress,
  RevenueManagerAddress,
  StakingManagerAddress,
} from "addresses";
import { ReadFlaunchPositionManagerV1_1 } from "./FlaunchPositionManagerV1_1Client";
import {
  AddressFeeSplitManagerAddress,
  FlaunchPositionManagerV1_1Address,
} from "addresses";
import { getAmountWithSlippage } from "utils/universalRouter";
import { ReadInitialPrice } from "./InitialPriceClient";
import { orderPoolKey } from "utils";

export type FlaunchZapABI = typeof FlaunchZapAbi;

export interface FlaunchParams {
  name: string;
  symbol: string;
  tokenUri: string;
  fairLaunchPercent: number;
  fairLaunchDuration: number;
  initialMarketCapUSD: number;
  creator: Address;
  creatorFeeAllocationPercent: number;
  flaunchAt?: bigint;
  premineAmount?: bigint;
  treasuryManagerParams?: {
    manager?: Address;
    // @note the permissions are only set when a new treasury manager is deployed. Defaults to OPEN.
    permissions?: Permissions;
    initializeData?: HexString;
    depositData?: HexString;
  };
  // for bot protection during fair launch
  trustedSignerSettings?: {
    enabled: boolean;
    walletCap?: bigint;
    txCap?: bigint;
    // optional custom fee signer address
    trustedFeeSigner?: Address;
    // need to pass signed message if trusted signer is enabled and premine requested.
    premineSignedMessage?: {
      deadline: number;
      signature: HexString;
    };
  };
}

export interface FlaunchIPFSParams
  extends Omit<FlaunchParams, "tokenUri">,
    IPFSParams {}

export interface FlaunchWithRevenueManagerParams
  extends Omit<FlaunchParams, "treasuryManagerParams"> {
  revenueManagerInstanceAddress: Address;
  treasuryManagerParams?: {
    permissions?: Permissions;
  };
}

export interface FlaunchWithRevenueManagerIPFSParams
  extends Omit<FlaunchWithRevenueManagerParams, "tokenUri">,
    IPFSParams {}

export interface FlaunchWithSplitManagerParams
  extends Omit<FlaunchParams, "treasuryManagerParams"> {
  creatorSplitPercent: number;
  managerOwnerSplitPercent: number;
  splitReceivers: {
    address: Address;
    percent: number;
  }[];
  treasuryManagerParams?: {
    permissions?: Permissions;
  };
}

export interface FlaunchWithSplitManagerIPFSParams
  extends Omit<FlaunchWithSplitManagerParams, "tokenUri">,
    IPFSParams {}

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

export interface DeployBuyBackManagerParams {
  managerOwner: Address;
  creatorSharePercent: number;
  ownerSharePercent: number;
  buyBackPoolKey: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
  permissions?: Permissions;
}

/**
 * Base client for interacting with the FlaunchZap contract in read-only mode
 * Provides basic contract initialization
 */
export class ReadFlaunchZap {
  drift: Drift;
  chainId: number;
  public readonly contract: ReadContract<FlaunchZapABI>;
  public readonly TOTAL_SUPPLY = 100n * 10n ** 27n; // 100 Billion tokens in wei
  public readonly readPositionManagerV1_1: ReadFlaunchPositionManagerV1_1;

  /**
   * Creates a new ReadFlaunchZap instance
   * @param chainId - The chain ID of the contract
   * @param address - The address of the FlaunchZap contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(chainId: number, address: Address, drift: Drift = createDrift()) {
    this.chainId = chainId;
    this.drift = drift;
    if (!address) {
      throw new Error("Address is required");
    }
    this.contract = drift.contract({
      abi: FlaunchZapAbi,
      address,
    });
    this.readPositionManagerV1_1 = new ReadFlaunchPositionManagerV1_1(
      FlaunchPositionManagerV1_1Address[this.chainId],
      drift
    );
  }

  async getPremineCostInWei(params: {
    initialPriceParams: HexString;
    premineAmount: bigint;
    slippagePercent?: number;
  }) {
    const mcapInWei = await this.readPositionManagerV1_1.getFlaunchingMarketCap(
      params.initialPriceParams
    );
    const premineCostInWei =
      (mcapInWei * params.premineAmount) / this.TOTAL_SUPPLY;

    // increase the premine cost by the slippage percent
    const premineCostInWeiWithSlippage = getAmountWithSlippage({
      amount: premineCostInWei,
      slippage: (params.slippagePercent ?? 0 / 100).toFixed(18).toString(),
      swapType: "EXACT_OUT", // as we know the output premine amount
    });
    return premineCostInWeiWithSlippage;
  }

  async getFlaunchingFee(params: {
    sender: Address;
    initialPriceParams: HexString;
    slippagePercent?: number;
  }) {
    const readInitialPrice = new ReadInitialPrice(
      await this.readPositionManagerV1_1.initialPrice(),
      this.drift
    );
    const flaunchingFee = await readInitialPrice.getFlaunchingFee(params);

    // increase the flaunching fee by the slippage percent
    const flaunchingFeeWithSlippage = getAmountWithSlippage({
      amount: flaunchingFee,
      slippage: (params.slippagePercent ?? 0 / 100).toFixed(18).toString(),
      swapType: "EXACT_OUT",
    });
    return flaunchingFeeWithSlippage;
  }

  /**
   * Calculates the ETH required to flaunch a token, takes into account the ETH for premine and the flaunching fee
   */
  ethRequiredToFlaunch(params: {
    premineAmount: bigint;
    initialPriceParams: HexString;
    slippagePercent?: number;
  }) {
    return this.contract.read("calculateFee", {
      _premineAmount: params.premineAmount ?? 0n,
      _slippage: params.slippagePercent
        ? BigInt(params.slippagePercent * 100)
        : 0n,
      _initialPriceParams: params.initialPriceParams,
    });
  }
}

/**
 * Extended client for interacting with the FlaunchZap contract with write capabilities
 */
export class ReadWriteFlaunchZap extends ReadFlaunchZap {
  declare contract: ReadWriteContract<FlaunchZapABI>;

  constructor(
    chainId: number,
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(chainId, address, drift);
  }

  /**
   * Flaunches a new token, supports premine
   * @param params - Parameters for the flaunch
   * @returns Transaction response for the flaunch creation
   */
  async flaunch(params: FlaunchParams) {
    const initialMCapInUSDCWei = parseUnits(
      params.initialMarketCapUSD.toString(),
      6
    );
    const initialPriceParams = encodeAbiParameters(
      [
        {
          type: "uint256",
        },
      ],
      [initialMCapInUSDCWei]
    );

    const fairLaunchInBps = BigInt(params.fairLaunchPercent * 100);
    const creatorFeeAllocationInBps = params.creatorFeeAllocationPercent * 100;

    const ethRequired = await this.ethRequiredToFlaunch({
      premineAmount: params.premineAmount ?? 0n,
      initialPriceParams,
      slippagePercent: 5,
    });

    const _treasuryManagerParams: {
      manager: Address;
      permissions: Permissions;
      initializeData: HexString;
      depositData: HexString;
    } = params.treasuryManagerParams
      ? {
          manager: params.treasuryManagerParams.manager ?? zeroAddress,
          permissions:
            params.treasuryManagerParams.permissions ?? Permissions.OPEN,
          initializeData: params.treasuryManagerParams.initializeData ?? "0x",
          depositData: params.treasuryManagerParams.depositData ?? "0x",
        }
      : {
          manager: zeroAddress,
          permissions: Permissions.OPEN,
          initializeData: "0x",
          depositData: "0x",
        };

    const feeCalculatorParams = params.trustedSignerSettings
      ? encodeAbiParameters(
          [
            { type: "bool", name: "enabled" },
            { type: "uint256", name: "walletCap" },
            { type: "uint256", name: "txCap" },
          ],
          [
            params.trustedSignerSettings.enabled,
            params.trustedSignerSettings.walletCap ?? 0n,
            params.trustedSignerSettings.txCap ?? 0n,
          ]
        )
      : "0x";

    const _premineSwapHookData = params.trustedSignerSettings?.enabled
      ? encodeAbiParameters(
          [
            { type: "address", name: "referrer" },
            {
              type: "tuple",
              components: [
                { type: "uint256", name: "deadline" },
                { type: "bytes", name: "signature" },
              ],
            },
          ],
          [
            zeroAddress,
            {
              deadline: BigInt(
                params.trustedSignerSettings.premineSignedMessage?.deadline ?? 0
              ),
              signature:
                params.trustedSignerSettings.premineSignedMessage?.signature ??
                "0x",
            },
          ]
        )
      : "0x";

    return this.contract.write(
      "flaunch",
      {
        _flaunchParams: {
          name: params.name,
          symbol: params.symbol,
          tokenUri: params.tokenUri,
          initialTokenFairLaunch:
            (this.TOTAL_SUPPLY * fairLaunchInBps) / 10_000n,
          fairLaunchDuration: BigInt(params.fairLaunchDuration),
          premineAmount: params.premineAmount ?? 0n,
          creator: params.creator,
          creatorFeeAllocation: creatorFeeAllocationInBps,
          flaunchAt: params.flaunchAt ?? 0n,
          initialPriceParams,
          feeCalculatorParams,
        },
        _trustedFeeSigner:
          params.trustedSignerSettings?.trustedFeeSigner ?? zeroAddress,
        _premineSwapHookData,
        _treasuryManagerParams: {
          ..._treasuryManagerParams,
          permissions: getPermissionsAddress(
            _treasuryManagerParams.permissions,
            this.chainId
          ),
        },
        _whitelistParams: {
          merkleRoot: zeroHash,
          merkleIPFSHash: "",
          maxTokens: 0n,
        },
        _airdropParams: {
          airdropIndex: 0n,
          airdropAmount: 0n,
          airdropEndTime: 0n,
          merkleRoot: zeroHash,
          merkleIPFSHash: "",
        },
      },
      {
        value: ethRequired,
      }
    );
  }

  async flaunchIPFS(params: FlaunchIPFSParams) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunch({
      ...params,
      tokenUri,
    });
  }

  /**
   * Flaunches a new token for a revenue manager
   * @param params - Parameters for the flaunch with revenue manager
   * @param params.name - The name of the token
   * @param params.symbol - The symbol of the token
   * @param params.tokenUri - The URI containing the token metadata
   * @param params.fairLaunchPercent - Percentage of total supply to be used in fair launch (0-100)
   * @param params.fairLaunchDuration - Duration of fair launch in seconds
   * @param params.initialMarketCapUSD - Initial market cap in USD
   * @param params.creator - Address of the token creator
   * @param params.creatorFeeAllocationPercent - Percentage of fees allocated to creator (0-100)
   * @param params.protocolRecipient - Address to receive protocol fees
   * @param params.protocolFeePercent - Percentage of fees allocated to protocol (0-100)
   * @param params.flaunchAt - Optional timestamp when the flaunch should start
   * @param params.premineAmount - Optional amount of tokens to premine
   * @returns Transaction response for the flaunch creation
   */
  async flaunchWithRevenueManager(params: FlaunchWithRevenueManagerParams) {
    return this.flaunch({
      ...params,
      treasuryManagerParams: {
        manager: params.revenueManagerInstanceAddress,
        permissions:
          params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
        initializeData: "0x",
        depositData: "0x",
      },
    });
  }

  /**
   * Flaunches a new token for a revenue manager, storing the token metadata on IPFS
   * @param params - Parameters for the flaunch including all revenue manager params and IPFS metadata
   * @returns Promise resolving to the transaction response for the flaunch creation
   */
  async flaunchIPFSWithRevenueManager(
    params: FlaunchWithRevenueManagerIPFSParams
  ) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunchWithRevenueManager({
      ...params,
      tokenUri,
    });
  }

  /**
   * Flaunches a new token that splits the creator fees to the creator and a list of recipients
   * @param params - Parameters for the flaunch with split manager
   * @param params.name - The name of the token
   * @param params.symbol - The symbol of the token
   * @param params.tokenUri - The URI containing the token metadata
   * @param params.fairLaunchPercent - Percentage of total supply to be used in fair launch (0-100)
   * @param params.fairLaunchDuration - Duration of fair launch in seconds
   * @param params.initialMarketCapUSD - Initial market cap in USD
   * @param params.creator - Address of the token creator
   * @param params.creatorFeeAllocationPercent - Percentage of fees allocated to creator (0-100)
   * @param params.creatorSplitPercent - Split percentage of the fees for the creator (0-100)
   * @param params.managerOwnerSplitPercent - Split percentage of the fees for the manager owner (0-100)
   * @param params.splitReceivers - List of recipients and their percentage of the fees
   * @param params.flaunchAt - Optional timestamp when the flaunch should start
   * @param params.premineAmount - Optional amount of tokens to premine
   * @param params.treasuryManagerParams - Optional treasury manager configuration
   * @returns Transaction response for the flaunch creation
   */
  async flaunchWithSplitManager(params: FlaunchWithSplitManagerParams) {
    const VALID_SHARE_TOTAL = 100_00000n; // 5 decimals as BigInt
    let creatorShare =
      (BigInt(params.creatorSplitPercent) * VALID_SHARE_TOTAL) / 100n;
    const managerOwnerShare =
      (BigInt(params.managerOwnerSplitPercent) * VALID_SHARE_TOTAL) / 100n;

    const recipientShares = params.splitReceivers.map((receiver) => {
      return {
        recipient: receiver.address,
        share: (BigInt(receiver.percent) * VALID_SHARE_TOTAL) / 100n,
      };
    });

    const totalRecipientShares = recipientShares.reduce(
      (acc, curr) => acc + curr.share,
      0n
    );

    // if there's a remainder (due to rounding errors), add it to the creator share
    const remainderShares =
      VALID_SHARE_TOTAL - totalRecipientShares - managerOwnerShare;
    creatorShare += remainderShares;

    const initializeData = encodeAbiParameters(
      [
        {
          type: "tuple",
          name: "params",
          components: [
            { type: "uint256", name: "creatorShare" },
            { type: "uint256", name: "ownerShare" },
            {
              type: "tuple[]",
              name: "recipientShares",
              components: [
                { type: "address", name: "recipient" },
                { type: "uint256", name: "share" },
              ],
            },
          ],
        },
      ],
      [
        {
          creatorShare,
          ownerShare: managerOwnerShare,
          recipientShares,
        },
      ]
    );

    return this.flaunch({
      ...params,
      treasuryManagerParams: {
        manager: AddressFeeSplitManagerAddress[this.chainId],
        permissions:
          params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
        initializeData,
        depositData: "0x",
      },
    });
  }

  /**
   * Flaunches a new token that splits the creator fees to the creator and a list of recipients, storing the token metadata on IPFS
   * @param params - Parameters for the flaunch with split manager including all IPFS metadata
   * @returns Promise resolving to the transaction response for the flaunch creation
   */
  async flaunchIPFSWithSplitManager(params: FlaunchWithSplitManagerIPFSParams) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunchWithSplitManager({
      ...params,
      tokenUri,
    });
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

    const stakingManagerAddress = StakingManagerAddress[this.chainId];
    if (stakingManagerAddress === zeroAddress) {
      throw new Error(
        `StakingManager not deployed on chainId: ${this.chainId}`
      );
    }

    return this.contract.write("deployAndInitializeManager", {
      _managerImplementation: stakingManagerAddress,
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

  /**
   * Deploys a new BuyBack manager
   * @param params - Parameters for deploying the BuyBack manager
   * @param params.managerOwner - The address of the manager owner
   * @param params.creatorSharePercent - The % share that a creator will earn from their token (0-100)
   * @param params.ownerSharePercent - The % share that the manager owner will earn from their token (0-100)
   * @param params.buyBackPoolKey - The Uniswap V4 pool key configuration for the buyback pool
   * @param params.buyBackPoolKey.currency0 - The lower currency of the pool (sorted numerically)
   * @param params.buyBackPoolKey.currency1 - The higher currency of the pool (sorted numerically)
   * @param params.buyBackPoolKey.fee - The pool LP fee, capped at 1_000_000
   * @param params.buyBackPoolKey.tickSpacing - Tick spacing for the pool
   * @param params.buyBackPoolKey.hooks - The hooks address of the pool
   * @param params.permissions - The permissions for the BuyBack manager
   * @returns Transaction response
   */
  deployBuyBackManager(params: DeployBuyBackManagerParams) {
    const permissionsAddress = getPermissionsAddress(
      params.permissions ?? Permissions.OPEN,
      this.chainId
    );

    const VALID_SHARE_TOTAL = 100_00000n; // 5 decimals as BigInt

    const buyBackManagerAddress = BuyBackManagerAddress[this.chainId];
    if (buyBackManagerAddress === zeroAddress) {
      throw new Error(
        `BuyBackManager not deployed on chainId: ${this.chainId}`
      );
    }

    return this.contract.write("deployAndInitializeManager", {
      _managerImplementation: buyBackManagerAddress,
      _owner: params.managerOwner,
      _data: encodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              { type: "uint256", name: "creatorShare" },
              { type: "uint256", name: "ownerShare" },
              {
                type: "tuple",
                name: "buyBackPoolKey",
                components: [
                  { type: "address", name: "currency0" },
                  { type: "address", name: "currency1" },
                  { type: "uint24", name: "fee" },
                  { type: "int24", name: "tickSpacing" },
                  { type: "address", name: "hooks" },
                ],
              },
            ],
          },
        ],
        [
          {
            creatorShare:
              (BigInt(params.creatorSharePercent) * VALID_SHARE_TOTAL) / 100n,
            ownerShare:
              (BigInt(params.ownerSharePercent) * VALID_SHARE_TOTAL) / 100n,
            buyBackPoolKey: orderPoolKey({
              currency0: params.buyBackPoolKey.currency0,
              currency1: params.buyBackPoolKey.currency1,
              fee: params.buyBackPoolKey.fee,
              tickSpacing: params.buyBackPoolKey.tickSpacing,
              hooks: params.buyBackPoolKey.hooks,
            }),
          },
        ]
      ),
      _permissions: permissionsAddress,
    });
  }
}
