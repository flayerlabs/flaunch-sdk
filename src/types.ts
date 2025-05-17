import { Address } from "viem";
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
