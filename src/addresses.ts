import type { Address } from "viem";

export type Deployment = {
  flaunch: Address;
  flaunchPoolHook: Address;
  baseTokenImplementation: Address;
  pairTokenWhitelist: Address;
  internalSwapPool: Address;
  feeCalculator: Address;
  feeEscrow: Address;
  launchZap: Address;
  atomicLaunchZap: Address;
  recipientFactory: Address;
  addressRecipient: Address;
  nftOwnerRecipient: Address;
  flaunchOwnerRecipient: Address;
  buyAndBurnRecipient: Address;
  uniswapHookEvents: Address;
  poolManager: Address;
  universalRouter: Address;
  v4Quoter: Address;
  permit2: Address;
};

// Flaunch V3 from flaunch-v3-protocol/deployments/deployment-<chainId>.json, plus Uniswap V4 periphery.
const deployments: Record<number, Deployment> = {
  84532: {
    flaunch: "0x251156629AE9c766497E7cA83b89040Ba6D7999F",
    flaunchPoolHook: "0x2dc217AF94875078979E9B7875f4d22b0fBEa5d4",
    baseTokenImplementation: "0x5fDd35F39f71de3b28fe1DD67dE31AFB90A64823",
    pairTokenWhitelist: "0x5EA47d137A45bD8645a44Aa882E03C5113c65ED5",
    internalSwapPool: "0xd24e45c6e63E4Ad8450103a85Ce2BD97E760e62F",
    feeCalculator: "0x3fe6EeB5C6F76a75b81eD07465124af4e30Ab881",
    feeEscrow: "0x61680b27800b40CF29b330e10a4D13Aa86cBC5a3",
    launchZap: "0xa472AebA50d758c97975d20a819B5171f86A0540",
    atomicLaunchZap: "0xee9400B8B119D741B7892566c7D1d4F229b702BF",
    recipientFactory: "0x14896E9439FafDbC7BBAB24F0352157079cE701C",
    addressRecipient: "0xd0C80A0649F2a74b236f07bD101613fF6791742b",
    nftOwnerRecipient: "0x2f735919B0905fB00Ad7D272874c1EC43a13D213",
    flaunchOwnerRecipient: "0x28b9091163428241aF2A08f09B9Bcb8e16141F72",
    buyAndBurnRecipient: "0xBAC2db7BCB033e93a01B37Ad195FEa81Ae8ed4cC",
    uniswapHookEvents: "0x33fE32dCDA2Daf841EF42Ecf356CB5df672DfF9f",
    poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
    universalRouter: "0x8702463e73f74d0b6765aBceb314Ef07aCb92650",
    v4Quoter: "0x5e6B8B8AFA7e5CEF6C09dd2A67aBA9FB12C75623",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  },
};

export function deployment(chainId: number): Deployment {
  const found = deployments[chainId];
  if (!found) throw new Error(`Flaunch V3 is not deployed on chain ${chainId}`);
  return found;
}
