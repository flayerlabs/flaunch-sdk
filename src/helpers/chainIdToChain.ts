import { Chain } from "viem";
import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  robinhood,
  unichain,
} from "viem/chains";

export const chainIdToChain: {
  [key: number]: Chain;
} = {
  [arbitrum.id]: arbitrum,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [mainnet.id]: mainnet,
  [unichain.id]: unichain,
  [robinhood.id]: robinhood,
};
