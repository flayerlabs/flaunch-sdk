import { base, baseSepolia } from "viem/chains";
import { Addresses, PoolKey } from "./types";
import { zeroAddress } from "viem";

export const FlaunchPositionManagerAddress: Addresses = {
  [base.id]: "0x51Bba15255406Cfe7099a42183302640ba7dAFDC",
  [baseSepolia.id]: "0x9A7059cA00dA92843906Cb4bCa1D005cE848AFdC",
};

export const FlaunchPositionManagerV1_1Address: Addresses = {
  // FIXME: update mainnet address
  [base.id]: zeroAddress,
  [baseSepolia.id]: "0x24347e0dd16357059abfc1b321df354873552fdc",
};

export const FLETHAddress: Addresses = {
  [base.id]: "0x000000000D564D5be76f7f0d28fE52605afC7Cf8",
  [baseSepolia.id]: "0x79FC52701cD4BE6f9Ba9aDC94c207DE37e3314eb",
};

export const FLETHHooksAddress: Addresses = {
  [base.id]: "0x9E433F32bb5481a9CA7DFF5b3af74A7ed041a888",
  [baseSepolia.id]: "0x4bd2ca15286c96e4e731337de8b375da6841e888",
};

export const FairLaunchAddress: Addresses = {
  [base.id]: "0xCc7A4A00072ccbeEEbd999edc812C0ce498Fb63B",
  [baseSepolia.id]: "0x227Fc288aC56E169f2BfEA82e07F8635054d4136",
};

// also supports AnyPositionManager
export const FairLaunchV1_1Address: Addresses = {
  [base.id]: zeroAddress,
  [baseSepolia.id]: "0x7922c1ead7c5825fb52ed6b14f397d064508acbe",
};

export const FlaunchAddress: Addresses = {
  [base.id]: "0xCc7A4A00072ccbeEEbd999edc812C0ce498Fb63B",
  [baseSepolia.id]: "0x7D375C9133721083DF7b7e5Cb0Ed8Fc78862dfe3",
};

// also supports AnyPositionManager
export const FlaunchV1_1Address: Addresses = {
  [base.id]: zeroAddress,
  [baseSepolia.id]: "0x96be8ff5e244294a34bfa507a39190dc7a839baa",
};

export const BidWallAddress: Addresses = {
  [base.id]: "0x66681f10BA90496241A25e33380004f30Dfd8aa8",
  [baseSepolia.id]: "0xa2107050ACEf4809c88Ab744F8e667605db5ACDB",
};

// also supports AnyPositionManager
export const BidWallV1_1Address: Addresses = {
  [base.id]: zeroAddress,
  [baseSepolia.id]: "0x6f2fa01a05ff8b6efbfefd91a3b85aaf19265a00",
};

export const FastFlaunchZapAddress: Addresses = {
  // FIXME: fix with the new mainnet zap
  [base.id]: "0xd79e27f51ddf9df5ee76106ee192530f474b02f6",
  [baseSepolia.id]: "0x821d9f6075e7971cc71c379081de9d532f5f9957",
};

export const FlaunchZapAddress: Addresses = {
  // FIXME: fix with the new mainnet zap
  [base.id]: "0x0000000000000000000000000000000000000000",
  [baseSepolia.id]: "0xb2f5d987de90e026b61805e60b6002d367461474",
};

export const RevenueManagerAddress: Addresses = {
  // FIXME: fix with the mainnet address
  [base.id]: "0x0000000000000000000000000000000000000000",
  [baseSepolia.id]: "0x1216c723853dac0449c01d01d6e529d751d9c0c8",
};

export const PoolManagerAddress: Addresses = {
  [base.id]: "0x498581fF718922c3f8e6A244956aF099B2652b2b",
  [baseSepolia.id]: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
};

export const UniversalRouterAddress: Addresses = {
  [base.id]: "0x6fF5693b99212Da76ad316178A184AB56D299b43",
  [baseSepolia.id]: "0x492E6456D9528771018DeB9E87ef7750EF184104",
};

export const QuoterAddress: Addresses = {
  [base.id]: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
  [baseSepolia.id]: "0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba",
};

export const StateViewAddress: Addresses = {
  [base.id]: "0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71",
  [baseSepolia.id]: "0x571291b572ed32ce6751a2Cb2486EbEe8DEfB9B4",
};

export const Permit2Address: Addresses = {
  [base.id]: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  [baseSepolia.id]: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
};

export const USDCETHPoolKeys: {
  [chainId: number]: PoolKey;
} = {
  [base.id]: {
    currency0: zeroAddress,
    currency1: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    fee: 500,
    tickSpacing: 10,
    hooks: zeroAddress,
  },
  [baseSepolia.id]: {
    currency0: zeroAddress,
    currency1: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    fee: 0,
    tickSpacing: 30,
    hooks: zeroAddress,
  },
};
