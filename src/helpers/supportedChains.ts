import {
  mainnet,
  robinhood,
  unichain,
} from "viem/chains";
import { chainIdToChain } from "./chainIdToChain";

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
