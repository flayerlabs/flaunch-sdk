import {
  mainnet,
  robinhood,
  unichain,
} from "viem/chains";
import { chainIdToChain } from "./chainIdToChain";
import {
  DynamicAddressFeeSplitManagerAddress,
  FeeEscrowV1_3Address,
  FlaunchManagerZapV1_3Address,
  TreasuryManagerFactoryV1_3Address,
} from "../addresses";

const multichainDeploymentChainIds = new Set<number>([
  mainnet.id,
  unichain.id,
  robinhood.id,
]);

export function isMultichainDeployment(chainId: number): boolean {
  return multichainDeploymentChainIds.has(chainId);
}

export function isChainSupported(chainId: number): boolean {
  return chainIdToChain[chainId] !== undefined;
}

/**
 * Whether the DynamicAddressFeeSplitManager is deployed
 * on the given chain. Split-manager flaunches revert on chains without a
 * deployment, so callers should gate on this before using them.
 */
export function doesChainSupportSplitManager(chainId: number): boolean {
  return DynamicAddressFeeSplitManagerAddress[chainId] !== undefined;
}

/**
 * Whether the v1.3.1 multi-token FeeEscrow is deployed on the given chain.
 * Coins launched against a non-flETH pairing (native ETH, the B20 equities)
 * escrow their creator fees there, keyed (recipient, token) and denominated in
 * that token; `creatorRevenue()` / `withdrawCreatorRevenue()` only see the
 * legacy single-token escrow, so gate on this before reading or claiming.
 */
export function doesChainSupportMultiTokenFeeEscrow(chainId: number): boolean {
  return FeeEscrowV1_3Address[chainId] !== undefined;
}

/**
 * Whether the v1.3.1 multi-asset manager generation (its own TreasuryManagerFactory,
 * manager implementations and FlaunchManagerZap) is deployed on the given chain — Base
 * mainnet only today. Managers from this generation pay out per payout asset (ETH or the
 * coin's paired token) and are driven through the `*V1_3` manager APIs; the unsuffixed
 * manager APIs keep talking to the previous generation. Gate on this before deploying,
 * reading or claiming from a v1.3.1 manager.
 */
export function doesChainSupportMultiAssetManagers(chainId: number): boolean {
  return (
    TreasuryManagerFactoryV1_3Address[chainId] !== undefined &&
    FlaunchManagerZapV1_3Address[chainId] !== undefined
  );
}
