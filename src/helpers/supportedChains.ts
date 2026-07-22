import {
  mainnet,
  robinhood,
  unichain,
} from "viem/chains";
import { chainIdToChain } from "./chainIdToChain";
import { DynamicAddressFeeSplitManagerAddress } from "../addresses";

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
