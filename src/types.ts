import { Address, Call } from "viem";
import { PinataConfig } from "helpers/ipfs";

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
  pinataConfig: PinataConfig;
}

/**
 * Enumeration of Flaunch contract versions
 */
export enum FlaunchVersion {
  V1 = "V1",
  V1_1 = "V1_1",
  V1_1_1 = "V1_1_1",
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

export interface ImportMemecoinParams {
  memecoin: Address;
  creatorFeeAllocationPercent: number;
  initialMarketCapUSD: number;
  verifier?: Verifier;
}

export type GetAddLiquidityCallsParams =
  | {
      coinAddress: Address;
      liquidityMode: LiquidityMode;
      coinOrEthInputAmount: bigint;
      inputToken: "coin" | "eth";
      minMarketCap: string;
      maxMarketCap: string;
      currentMarketCap?: string;
    }
  | {
      coinAddress: Address;
      coinAmount: bigint;
      flethAmount: bigint;
      tickLower: number;
      tickUpper: number;
      currentTick?: number;
    };
