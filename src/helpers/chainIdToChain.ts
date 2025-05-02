import { Chain } from "viem";
import { base, baseSepolia } from "viem/chains";

export const chainIdToChain: {
  [key: number]: Chain;
} = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
};
