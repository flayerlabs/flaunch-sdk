import { base, baseSepolia } from "viem/chains";
import { Addresses, PoolKey } from "./types";
import { zeroAddress } from "viem";

export const FlaunchPositionManagerAddress: Addresses = {
  [base.id]: "0x51Bba15255406Cfe7099a42183302640ba7dAFDC",
  [baseSepolia.id]: "0x9A7059cA00dA92843906Cb4bCa1D005cE848AFdC",
};

export const FlaunchPositionManagerV1_1Address: Addresses = {
  [base.id]: "0xf785bb58059fab6fb19bdda2cb9078d9e546efdc",
  [baseSepolia.id]: "0x24347e0dd16357059abfc1b321df354873552fdc",
};

export const AnyPositionManagerAddress: Addresses = {
  [base.id]: "0x69a96de474521f7c6c0be3ea0498e5cf2f0565dc",
  [baseSepolia.id]: "0xe999c5676b0e0f83292074441292f4b3b11d65dc",
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
  [base.id]: "0x4dc442403e8c758425b93c59dc737da522f32640",
  [baseSepolia.id]: "0x7922c1ead7c5825fb52ed6b14f397d064508acbe",
};

export const FlaunchAddress: Addresses = {
  [base.id]: "0xCc7A4A00072ccbeEEbd999edc812C0ce498Fb63B",
  [baseSepolia.id]: "0x7D375C9133721083DF7b7e5Cb0Ed8Fc78862dfe3",
};

// also supports AnyPositionManager
export const FlaunchV1_1Address: Addresses = {
  [base.id]: "0xb4512bf57d50fbcb64a3adf8b17a79b2a204c18c",
  [baseSepolia.id]: "0x96be8ff5e244294a34bfa507a39190dc7a839baa",
};

export const BidWallAddress: Addresses = {
  [base.id]: "0x66681f10BA90496241A25e33380004f30Dfd8aa8",
  [baseSepolia.id]: "0xa2107050ACEf4809c88Ab744F8e667605db5ACDB",
};

// also supports AnyPositionManager
export const BidWallV1_1Address: Addresses = {
  [base.id]: "0x7f22353d1634223a802D1c1Ea5308Ddf5DD0ef9c",
  [baseSepolia.id]: "0x6f2fa01a05ff8b6efbfefd91a3b85aaf19265a00",
};

export const FastFlaunchZapAddress: Addresses = {
  [base.id]: "0x68d967d25806fef4aa134db031cdcc55d3e20f92",
  [baseSepolia.id]: "0x821d9f6075e7971cc71c379081de9d532f5f9957",
};

export const FlaunchZapAddress: Addresses = {
  [base.id]: "0xfa9e8528ee95eb109bffd1a2d59cb95b300a672a",
  [baseSepolia.id]: "0xb2f5d987de90e026b61805e60b6002d367461474",
};

export const RevenueManagerAddress: Addresses = {
  [base.id]: "0x712fa8ddc7347b4b6b029aa21710f365cd02d898",
  [baseSepolia.id]: "0x17E02501dE3e420347e7C5fCAe3AD787C5aea690",
};

export const TreasuryManagerFactoryAddress: Addresses = {
  [base.id]: "0x48af8b28DDC5e5A86c4906212fc35Fa808CA8763",
  [baseSepolia.id]: "0xd2f3c6185e06925dcbe794c6574315b2202e9ccd",
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
