import { encodeStaticSplit } from "../helpers/staticSplit";
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
import { FlaunchZapV1_1_6Abi } from "../abi/FlaunchZapV1_1_6";
import { parseUnits, zeroAddress, zeroHash, getAddress } from "viem";
import { encodeAbiParameters } from "viem";
import { generateTokenUri } from "../helpers/ipfs";
import { getPermissionsAddress } from "../helpers/permissions";
import { IPFSParams, Permissions } from "../types";
import {
  BuyBackManagerAddress,
  RevenueManagerAddress,
  StakingManagerAddress,
  AddressFeeSplitManagerAddress,
  DynamicAddressFeeSplitManagerAddress,
  FlaunchPositionManagerV1_1Address,
} from "addresses";
import { ReadFlaunchPositionManagerV1_1 } from "./FlaunchPositionManagerV1_1Client";
import { getAmountWithSlippage } from "utils/universalRouter";
import { ReadInitialPrice } from "./InitialPriceClient";
import { orderPoolKey } from "utils";

export type FlaunchZapABI = typeof FlaunchZapV1_1_6Abi;

export interface FlaunchParams {
  name: string;
  symbol: string;
  tokenUri: string;
  /** @deprecated FairLaunch has been deprecated. Please set fairLaunchPercent to 0. */
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
  /** Percentages of the remaining recipient pool; must sum to 100. */
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

export interface FlaunchWithDynamicSplitManagerParams
  extends Omit<FlaunchParams, "treasuryManagerParams"> {
  creatorShare: bigint;
  managerOwnerShare: bigint;
  moderator: Address;
  splitReceivers: {
    address: Address;
    share: bigint;
  }[];
  treasuryManagerParams?: {
    permissions?: Permissions;
  };
}

export interface FlaunchWithDynamicSplitManagerIPFSParams
  extends Omit<FlaunchWithDynamicSplitManagerParams, "tokenUri">,
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

/** `TokenSupply.INITIAL_SUPPLY`: 100 billion coins at 18 decimals, minted for every launch. */
export const FLAUNCH_TOTAL_SUPPLY = 100n * 10n ** 27n;

/** `abi.encode(uint256 usdcMarketCap)` — the `initialPriceParams` every launch route encodes from a USD market cap. */
export function encodeInitialPriceParams(initialMarketCapUSD: number): HexString {
  const initialMCapInUSDCWei = parseUnits(initialMarketCapUSD.toString(), 6);
  return encodeAbiParameters([{ type: "uint256" }], [initialMCapInUSDCWei]);
}

/** The `_treasuryManagerParams` tuple of the legacy Base zap, permissions resolved to their contract address. */
export function resolveFlaunchTreasuryManagerParams(
  params: FlaunchParams,
  chainId: number
): {
  manager: Address;
  permissions: Address;
  initializeData: HexString;
  depositData: HexString;
} {
  const treasuryManagerParams: {
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

  return {
    ...treasuryManagerParams,
    permissions: getPermissionsAddress(
      treasuryManagerParams.permissions,
      chainId
    ),
  };
}

/** `feeCalculatorParams` for the TrustedSignerFeeCalculator; `0x` when no trusted signer is configured. */
export function encodeTrustedSignerFeeCalculatorParams(
  settings: FlaunchParams["trustedSignerSettings"]
): HexString {
  return settings
    ? encodeAbiParameters(
        [
          { type: "bool", name: "enabled" },
          { type: "uint256", name: "walletCap" },
          { type: "uint256", name: "txCap" },
        ],
        [settings.enabled, settings.walletCap ?? 0n, settings.txCap ?? 0n]
      )
    : "0x";
}

/** The signed premine authorisation the legacy zap forwards to a trusted-signer premine swap. */
export function encodePremineSwapHookData(
  settings: FlaunchParams["trustedSignerSettings"]
): HexString {
  return settings?.enabled
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
            deadline: BigInt(settings.premineSignedMessage?.deadline ?? 0),
            signature: settings.premineSignedMessage?.signature ?? "0x",
          },
        ]
      )
    : "0x";
}

/** The exact argument object `ReadWriteFlaunchZap.flaunch` hands to the legacy zap's `flaunch`. */
export type BaseFlaunchArgs = {
  _flaunchParams: {
    name: string;
    symbol: string;
    tokenUri: string;
    initialTokenFairLaunch: bigint;
    fairLaunchDuration: bigint;
    premineAmount: bigint;
    creator: Address;
    creatorFeeAllocation: number;
    flaunchAt: bigint;
    initialPriceParams: HexString;
    feeCalculatorParams: HexString;
  };
  _trustedFeeSigner: Address;
  _premineSwapHookData: HexString;
  _treasuryManagerParams: ReturnType<typeof resolveFlaunchTreasuryManagerParams>;
  _whitelistParams: {
    merkleRoot: HexString;
    merkleIPFSHash: string;
    maxTokens: bigint;
  };
  _airdropParams: {
    airdropIndex: bigint;
    airdropAmount: bigint;
    airdropEndTime: bigint;
    merkleRoot: HexString;
    merkleIPFSHash: string;
  };
};

/**
 * Builds the legacy Base zap `flaunch` arguments without touching the network. `flaunch()` and
 * the pre-buy planner share this so a planned launch encodes exactly what a plain launch would.
 * @throws when `fairLaunchPercent` is not 0 (FairLaunch is deprecated)
 */
export function buildBaseFlaunchArgs(
  chainId: number,
  params: FlaunchParams
): { args: BaseFlaunchArgs; initialPriceParams: HexString } {
  if (params.fairLaunchPercent !== 0) {
    throw new Error(
      "FairLaunch has been deprecated. Please set fairLaunchPercent to 0."
    );
  }

  const initialPriceParams = encodeInitialPriceParams(params.initialMarketCapUSD);
  const fairLaunchInBps = BigInt(params.fairLaunchPercent * 100);
  const creatorFeeAllocationInBps = params.creatorFeeAllocationPercent * 100;

  return {
    initialPriceParams,
    args: {
      _flaunchParams: {
        name: params.name,
        symbol: params.symbol,
        tokenUri: params.tokenUri,
        initialTokenFairLaunch:
          (FLAUNCH_TOTAL_SUPPLY * fairLaunchInBps) / 10_000n,
        fairLaunchDuration: BigInt(params.fairLaunchDuration),
        premineAmount: params.premineAmount ?? 0n,
        creator: params.creator,
        creatorFeeAllocation: creatorFeeAllocationInBps,
        flaunchAt: params.flaunchAt ?? 0n,
        initialPriceParams,
        feeCalculatorParams: encodeTrustedSignerFeeCalculatorParams(
          params.trustedSignerSettings
        ),
      },
      _trustedFeeSigner:
        params.trustedSignerSettings?.trustedFeeSigner ?? zeroAddress,
      _premineSwapHookData: encodePremineSwapHookData(
        params.trustedSignerSettings
      ),
      _treasuryManagerParams: resolveFlaunchTreasuryManagerParams(
        params,
        chainId
      ),
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
  };
}

/** Revenue-manager launch → plain `FlaunchParams` depositing into the existing manager instance. */
export function toFlaunchParamsWithRevenueManager(
  params: FlaunchWithRevenueManagerParams
): FlaunchParams {
  return {
    ...params,
    treasuryManagerParams: {
      manager: params.revenueManagerInstanceAddress,
      permissions: params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
      initializeData: "0x",
      depositData: "0x",
    },
  };
}

/** Static split launch → plain `FlaunchParams` deploying an AddressFeeSplitManager. */
export function toFlaunchParamsWithSplitManager(
  params: FlaunchWithSplitManagerParams,
  chainId: number
): FlaunchParams {
  return {
    ...params,
    treasuryManagerParams: {
      manager: AddressFeeSplitManagerAddress[chainId],
      permissions: params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
      initializeData: encodeStaticSplit(params),
      depositData: "0x",
    },
  };
}

/** The `initializeData` of a DynamicAddressFeeSplitManager; validates shares and recipients. */
export function encodeDynamicSplitInitializeData(
  params: FlaunchWithDynamicSplitManagerParams
): HexString {
  const VALID_SHARE_TOTAL = 100_00000n;

  if (params.moderator === zeroAddress) {
    throw new Error("Dynamic split moderator cannot be zero address");
  }

  if (params.creatorShare < 0n || params.managerOwnerShare < 0n) {
    throw new Error("Creator and manager owner shares cannot be negative");
  }

  if (params.creatorShare + params.managerOwnerShare > VALID_SHARE_TOTAL) {
    throw new Error(
      "Creator and manager owner shares must be less than or equal to 100_00000"
    );
  }

  const duplicateRecipients = new Set<string>();
  const recipientShares = params.splitReceivers.map((receiver) => {
    if (receiver.address === zeroAddress) {
      throw new Error("Recipient address cannot be zero address");
    }

    if (receiver.share <= 0n) {
      throw new Error("Recipient share must be greater than zero");
    }

    const normalizedAddress = getAddress(receiver.address);

    if (duplicateRecipients.has(normalizedAddress)) {
      throw new Error("Duplicate recipient found in split receivers");
    }

    duplicateRecipients.add(normalizedAddress);
    return {
      recipient: normalizedAddress,
      share: receiver.share,
    };
  });

  return encodeAbiParameters(
    [
      {
        type: "tuple",
        name: "params",
        components: [
          { type: "uint256", name: "creatorShare" },
          { type: "uint256", name: "ownerShare" },
          { type: "address", name: "moderator" },
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
        creatorShare: params.creatorShare,
        ownerShare: params.managerOwnerShare,
        moderator: params.moderator,
        recipientShares,
      },
    ]
  );
}

/** Dynamic split launch → plain `FlaunchParams` deploying a DynamicAddressFeeSplitManager. */
export function toFlaunchParamsWithDynamicSplitManager(
  params: FlaunchWithDynamicSplitManagerParams,
  chainId: number
): FlaunchParams {
  return {
    ...params,
    treasuryManagerParams: {
      manager: DynamicAddressFeeSplitManagerAddress[chainId],
      permissions: params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
      initializeData: encodeDynamicSplitInitializeData(params),
      depositData: "0x",
    },
  };
}

/**
 * Base client for interacting with the FlaunchZap contract in read-only mode
 * Provides basic contract initialization
 */
export class ReadFlaunchZap {
  drift: Drift;
  chainId: number;
  public readonly contract: ReadContract<FlaunchZapABI>;
  public readonly TOTAL_SUPPLY = FLAUNCH_TOTAL_SUPPLY; // 100 Billion tokens in wei
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
      abi: FlaunchZapV1_1_6Abi,
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

  /**
   * The zap's `calculateFee` with slippage in integer basis points and an optional pinned block:
   * the ETH a launch must send (flaunch fee plus the buffered premine cost, both native ETH on
   * this route). Used by the pre-buy planner; `ethRequiredToFlaunch` keeps its percent input.
   */
  calculateFeeBps(
    params: {
      premineAmount: bigint;
      slippageBps: bigint;
      initialPriceParams: HexString;
    },
    options?: { block?: bigint }
  ) {
    return this.contract.read(
      "calculateFee",
      {
        _premineAmount: params.premineAmount,
        _slippage: params.slippageBps,
        _initialPriceParams: params.initialPriceParams,
      },
      options
    );
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
   * @param params.fairLaunchPercent - @deprecated FairLaunch has been deprecated. Please set to 0.
   * @returns Transaction response for the flaunch creation
   */
  async flaunch(params: FlaunchParams) {
    const { args, initialPriceParams } = buildBaseFlaunchArgs(
      this.chainId,
      params
    );

    const ethRequired = await this.ethRequiredToFlaunch({
      premineAmount: params.premineAmount ?? 0n,
      initialPriceParams,
      slippagePercent: 5,
    });

    return this.flaunchPrepared(args, ethRequired);
  }

  /**
   * Sends prepared `flaunch` arguments (see `buildBaseFlaunchArgs`) with an explicit `value`.
   * The pre-buy executor uses this so the ETH sent is the quoted maximum it displayed, not a
   * fresh estimate; `value` is the on-chain spending cap for an ETH-funded premine.
   */
  flaunchPrepared(args: BaseFlaunchArgs, value: bigint) {
    return this.contract.write("flaunch", args, { value });
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
   * @param params.fairLaunchPercent - @deprecated FairLaunch has been deprecated. Please set to 0.
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
    return this.flaunch(toFlaunchParamsWithRevenueManager(params));
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
   * @param params.fairLaunchPercent - @deprecated FairLaunch has been deprecated. Please set to 0.
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
    return this.flaunch(toFlaunchParamsWithSplitManager(params, this.chainId));
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
   * Flaunches a new token with the Dynamic Address Fee Split manager.
   * Unlike static splits, recipient shares are mutable post-deployment.
   * @param params - Parameters for the flaunch with dynamic split manager
   * @returns Transaction response for the flaunch creation
   */
  async flaunchWithDynamicSplitManager(
    params: FlaunchWithDynamicSplitManagerParams
  ) {
    return this.flaunch(
      toFlaunchParamsWithDynamicSplitManager(params, this.chainId)
    );
  }

  /**
   * Flaunches a new token with dynamic split manager and stores metadata on IPFS.
   * @param params - Parameters for dynamic split manager flow including IPFS metadata
   * @returns Transaction response for the flaunch creation
   */
  async flaunchIPFSWithDynamicSplitManager(
    params: FlaunchWithDynamicSplitManagerIPFSParams
  ) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunchWithDynamicSplitManager({
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
