import {
  mainnet,
  robinhood,
  unichain,
} from "viem/chains";
import { chainIdToChain } from "./chainIdToChain";
import {
  DynamicAddressFeeSplitManagerAddress,
  FeeEscrowV1_3Address,
  FlaunchZapV1_3Address,
  PairedTokenPositionManagerV1_3Address,
  PairedTokenRegistryV1_3Address,
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

/** Whether all contracts required for paired-token launches are deployed. */
export function doesChainSupportPairedTokenLaunch(chainId: number): boolean {
  return (
    FlaunchZapV1_3Address[chainId] !== undefined &&
    PairedTokenPositionManagerV1_3Address[chainId] !== undefined &&
    PairedTokenRegistryV1_3Address[chainId] !== undefined
  );
}
