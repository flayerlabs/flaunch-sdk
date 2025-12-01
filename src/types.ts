import { Address, Call, Hex } from "viem";
import { PinataConfig } from "helpers/ipfs";

// Utility type to flatten complex intersections for better IntelliSense
type Flatten<T> = {
  [K in keyof T]: T[K];
} & {};

export interface Addresses {
  [chainId: number]: Address;
}

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface PoolWithHookData extends PoolKey {
  hookData: Hex;
}

export interface CoinMetadata {
  name: string;
  description: string;
  image: string;
  external_link: string;
  collaborators: string[];
  discordUrl: string;
  twitterUrl: string;
  telegramUrl: string;
}

export interface IPFSParams {
  metadata: {
    base64Image: string;
    description: string;
    websiteUrl?: string;
    discordUrl?: string;
    twitterUrl?: string;
    telegramUrl?: string;
  };
  pinataConfig?: PinataConfig;
}

/**
 * Enumeration of Flaunch contract versions
 */
export enum FlaunchVersion {
  V1 = "V1",
  V1_1 = "V1_1",
  V1_2 = "V1_2",
  ANY = "ANY",
}

/**
 * Enumeration of Verifiers for TokenImporter
 */
export enum Verifier {
  CLANKER = "clanker",
  DOPPLER = "doppler",
  VIRTUALS = "virtuals",
  WHITELIST = "whitelist",
  ZORA = "zora",
}

export enum LiquidityMode {
  FULL_RANGE = "full-range",
  CONCENTRATED = "concentrated",
}

export type CallWithDescription = Call & {
  description?: string;
};
/**
 * Enumeration of Permissions for TreasuryManagers. Defaults to OPEN.
 */
export enum Permissions {
  OPEN = "open",
  CLOSED = "closed",
  WHITELISTED = "whitelisted",
}

// either initialMarketCapUSD or initialPriceUSD must be provided
export type ImportMemecoinParams =
  | {
      coinAddress: Address;
      verifier?: Verifier;
      creatorFeeAllocationPercent: number;
      initialMarketCapUSD: number;
    }
  | {
      coinAddress: Address;
      verifier?: Verifier;
      creatorFeeAllocationPercent: number;
      initialPriceUSD: number;
    };

export type CalculateAddLiquidityAmountsParams =
  | {
      coinAddress: Address;
      liquidityMode: LiquidityMode;
      coinOrEthInputAmount: bigint;
      inputToken: "coin" | "eth";
      minMarketCap: string;
      maxMarketCap: string;
      currentMarketCap?: string;
      version?: FlaunchVersion;
    }
  | {
      coinAddress: Address;
      liquidityMode: LiquidityMode;
      coinOrEthInputAmount: bigint;
      inputToken: "coin" | "eth";
      minPriceUSD: string;
      maxPriceUSD: string;
      currentPriceUSD?: number;
      version?: FlaunchVersion;
    };

export type GetAddLiquidityCallsParams =
  | {
      coinAddress: Address;
      liquidityMode: LiquidityMode;
      coinOrEthInputAmount: bigint;
      inputToken: "coin" | "eth";
      minMarketCap: string;
      maxMarketCap: string;
      initialMarketCapUSD?: number;
      version?: FlaunchVersion;
    }
  | {
      coinAddress: Address;
      liquidityMode: LiquidityMode;
      coinOrEthInputAmount: bigint;
      inputToken: "coin" | "eth";
      minPriceUSD: string;
      maxPriceUSD: string;
      initialPriceUSD?: number;
      version?: FlaunchVersion;
    }
  | {
      coinAddress: Address;
      coinAmount: bigint;
      flethAmount: bigint;
      tickLower: number;
      tickUpper: number;
      currentTick?: number;
      version?: FlaunchVersion;
    };

export type GetSingleSidedCoinAddLiquidityCallsParams =
  | {
      coinAddress: Address;
      coinAmount: bigint;
      initialMarketCapUSD?: number;
      version?: FlaunchVersion;
    }
  | {
      coinAddress: Address;
      coinAmount: bigint;
      initialPriceUSD?: number;
      version?: FlaunchVersion;
    };

export type CheckSingleSidedAddLiquidityParams =
  | {
      coinAddress: Address;
      liquidityMode: LiquidityMode;
      minMarketCap: string;
      maxMarketCap: string;
      currentMarketCap?: string;
      version?: FlaunchVersion;
    }
  | {
      coinAddress: Address;
      liquidityMode: LiquidityMode;
      minPriceUSD: string;
      maxPriceUSD: string;
      currentPriceUSD?: number;
      version?: FlaunchVersion;
    };

export interface SingleSidedLiquidityInfo {
  isSingleSided: boolean;
  shouldHideCoinInput: boolean;
  shouldHideETHInput: boolean;
}

// Flattened parameter types for better SDK integrator experience
export type ImportAndAddLiquidityWithMarketCap = Flatten<{
  coinAddress: Address;
  verifier?: Verifier;
  creatorFeeAllocationPercent: number;
  liquidityMode: LiquidityMode;
  coinOrEthInputAmount: bigint;
  inputToken: "coin" | "eth";
  minMarketCap: string;
  maxMarketCap: string;
  initialMarketCapUSD: number;
  version?: FlaunchVersion;
}>;

export type ImportAndAddLiquidityWithPrice = Flatten<{
  coinAddress: Address;
  verifier?: Verifier;
  creatorFeeAllocationPercent: number;
  liquidityMode: LiquidityMode;
  coinOrEthInputAmount: bigint;
  inputToken: "coin" | "eth";
  minPriceUSD: string;
  maxPriceUSD: string;
  initialPriceUSD: number;
  version?: FlaunchVersion;
}>;

export type ImportAndAddLiquidityWithExactAmounts = Flatten<{
  coinAddress: Address;
  verifier?: Verifier;
  creatorFeeAllocationPercent: number;
  coinAmount: bigint;
  flethAmount: bigint;
  tickLower: number;
  tickUpper: number;
  currentTick?: number;
  version?: FlaunchVersion;
}>;

// Union type for backward compatibility (still used internally)
export type ImportAndAddLiquidityParams =
  | ImportAndAddLiquidityWithMarketCap
  | ImportAndAddLiquidityWithPrice
  | ImportAndAddLiquidityWithExactAmounts;

// Union type for getImportAndSingleSidedCoinAddLiquidityCalls to ensure consistent price/market cap params

// Resolved, flattened parameter types for better SDK integrator experience
export type ImportAndSingleSidedCoinAddLiquidityWithMarketCap = Flatten<{
  coinAddress: Address;
  verifier?: Verifier;
  creatorFeeAllocationPercent: number;
  coinAmount: bigint;
  initialMarketCapUSD: number;
  version?: FlaunchVersion;
}>;

export type ImportAndSingleSidedCoinAddLiquidityWithPrice = Flatten<{
  coinAddress: Address;
  verifier?: Verifier;
  creatorFeeAllocationPercent: number;
  coinAmount: bigint;
  initialPriceUSD: number;
  version?: FlaunchVersion;
}>;

// Union type for backward compatibility (still used internally)
export type ImportAndSingleSidedCoinAddLiquidityParams =
  | ImportAndSingleSidedCoinAddLiquidityWithMarketCap
  | ImportAndSingleSidedCoinAddLiquidityWithPrice;

/**
 * Parsed data from a PoolCreated event
 */
export type PoolCreatedEventData = {
  poolId: Hex;
  memecoin: Address;
  memecoinTreasury: Address;
  tokenId: bigint;
  currencyFlipped: boolean;
  flaunchFee: bigint;
  params: {
    name: string;
    symbol: string;
    tokenUri: string;
    initialTokenFairLaunch: bigint;
    fairLaunchDuration?: bigint; // Optional as V1/V1_1 don't have this field
    premineAmount: bigint;
    creator: Address;
    creatorFeeAllocation: number;
    flaunchAt: bigint;
    initialPriceParams: Hex;
    feeCalculatorParams: Hex;
  };
};
