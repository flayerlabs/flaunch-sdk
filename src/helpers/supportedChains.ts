import type { Address } from "viem";
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
  FlaunchZapV1_3Address,
  PairedTokenPositionManagerV1_3Address,
  PairedTokenRegistryV1_3Address,
  SupersededPositionManagerV1_3Address,
  PoolSwapV1_3Address,
  PoolSwapForHookV1_3Address,
  PairedTokenAcquisitionDexAddress,
  QuoterAddress,
  StateViewAddress,
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
 * mainnet and Robinhood Chain today. Managers from this generation pay out per payout asset (ETH or the
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

/** Whether all contracts required for paired-token launches are deployed. */
export function doesChainSupportPairedTokenLaunch(chainId: number): boolean {
  return (
    FlaunchZapV1_3Address[chainId] !== undefined &&
    PairedTokenPositionManagerV1_3Address[chainId] !== undefined &&
    PairedTokenRegistryV1_3Address[chainId] !== undefined
  );
}

/**
 * Every v1.3 hook that has ever been the paired-token PositionManager on a chain: the current
 * one plus any superseded generations that still serve their pools. Use this when deciding
 * whether an arbitrary hook address (e.g. from an indexer `Pool.positionManager`) is a v1.3 hook.
 */
export function getV1_3PositionManagers(chainId: number): Address[] {
  const current = PairedTokenPositionManagerV1_3Address[chainId];
  return [
    ...(current ? [current] : []),
    ...(SupersededPositionManagerV1_3Address[chainId] ?? []),
  ];
}

/**
 * Whether a coin on the paired-token PositionManager can be swapped through the SDK: the v1.3.1
 * PoolSwap router plus the v4 Quoter and StateView the plan needs for its quote and sqrt-price
 * slippage bound. `buyCoinPairedToken` / `sellCoinPairedToken` / `planPairedTokenSwap` throw on
 * chains without all four rather than sending a call that reverts.
 */
export function doesChainSupportPairedTokenSwap(chainId: number): boolean {
  return (
    PairedTokenPositionManagerV1_3Address[chainId] !== undefined &&
    PoolSwapV1_3Address[chainId] !== undefined &&
    QuoterAddress[chainId] !== undefined &&
    StateViewAddress[chainId] !== undefined
  );
}

/**
 * The PoolSwap a swap against a pool on `hook` must go through. Ungated swaps could use any
 * PoolSwap (it is hook-agnostic), but a spend-gated buy is only accepted from a router that pool's
 * own spend gate has approved, and each hook generation ships its own gate — so the router follows
 * the hook. Falls back to the chain's current router for a hook the table does not name.
 */
export function poolSwapForHook(chainId: number, hook: Address): Address | undefined {
  return (
    PoolSwapForHookV1_3Address[chainId]?.[hook.toLowerCase()] ??
    PoolSwapV1_3Address[chainId]
  );
}

/**
 * Whether a non-ETH paired token (a B20 equity) can be bought from ETH or the chain's USD hub
 * through the SDK's acquisition route. Base Sepolia's mUSD has no venue — it is minted.
 */
export function doesChainSupportPairedTokenAcquisition(chainId: number): boolean {
  return (
    PairedTokenAcquisitionDexAddress[chainId] !== undefined &&
    PairedTokenRegistryV1_3Address[chainId] !== undefined
  );
}
