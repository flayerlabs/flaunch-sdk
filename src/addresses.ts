import { base, baseSepolia } from "viem/chains";
import { Addresses, PoolKey } from "./types";
import { zeroAddress } from "viem";

export const FlaunchZapAddress: Addresses = {
  [base.id]: "0xe52dE1801C10cF709cc8e62d43D783AFe984b510",
  [baseSepolia.id]: "0xf0Fd8Bb98c050607d999D6fFF9C617edD6673b75",
};

// only old V1.0: doesn't use FeeEscrow
export const FlaunchPositionManagerAddress: Addresses = {
  [base.id]: "0x51Bba15255406Cfe7099a42183302640ba7dAFDC",
  [baseSepolia.id]: "0x9A7059cA00dA92843906Cb4bCa1D005cE848AFdC",
};

export const FlaunchPositionManagerV1_1Address: Addresses = {
  [base.id]: "0xf785bb58059fab6fb19bdda2cb9078d9e546efdc",
  [baseSepolia.id]: "0x24347e0dd16357059abfc1b321df354873552fdc",
};

export const FlaunchPositionManagerV1_2Address: Addresses = {
  [base.id]: "0x23321f11a6d44fd1ab790044fdfde5758c902fdc", // "1.3" from github releases
  [baseSepolia.id]: "0x4e7cb1e6800a7b297b38bddcecaf9ca5b6616fdc",
};

export const AnyPositionManagerAddress: Addresses = {
  [base.id]: "0x8DC3b85e1dc1C846ebf3971179a751896842e5dC",
  [baseSepolia.id]: "0xB4A535B9D35851972736495CC52FBfDaCF32e5dc",
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

export const FlaunchV1_2Address: Addresses = {
  [base.id]: "0x516af52d0c629b5e378da4dc64ecb0744ce10109", // "1.3" from github releases
  [baseSepolia.id]: "0xe2ef58a54ee79dac0D4A130ea58b340124DF9438",
};

export const AnyFlaunchAddress: Addresses = {
  [base.id]: "0xc5B2E8F197407263F4B62a35C71bFc394ecF95D5",
  [baseSepolia.id]: "0x67Ee6C83956a75f67bD3Fc8Ca4080D95a145c7C9",
};

export const FairLaunchAddress: Addresses = {
  [base.id]: "0xCc7A4A00072ccbeEEbd999edc812C0ce498Fb63B",
  [baseSepolia.id]: "0x227Fc288aC56E169f2BfEA82e07F8635054d4136",
};

// also supports AnyPositionManager & PositionManagerV1_2 (sepolia)
export const FairLaunchV1_1Address: Addresses = {
  [base.id]: "0x4dc442403e8c758425b93C59Dc737da522f32640",
  [baseSepolia.id]: "0x7922c1ead7c5825fb52ed6b14f397d064508acbe",
};

export const BidWallAddress: Addresses = {
  [base.id]: "0x66681f10BA90496241A25e33380004f30Dfd8aa8",
  [baseSepolia.id]: "0xa2107050ACEf4809c88Ab744F8e667605db5ACDB",
};

// also supports AnyPositionManager & PositionManagerV1_2 (sepolia)
export const BidWallV1_1Address: Addresses = {
  [base.id]: "0x7f22353d1634223a802D1c1Ea5308Ddf5DD0ef9c",
  [baseSepolia.id]: "0x6f2fa01a05ff8b6efbfefd91a3b85aaf19265a00",
};

export const AnyBidWallAddress: Addresses = {
  [base.id]: "0x2154c604df568A5285284D1c4918DC98C39240df",
  [baseSepolia.id]: "0xcfF222eA42E43F46A98755db237E4c9C2CA9B772",
};

export const TreasuryManagerFactoryAddress: Addresses = {
  [base.id]: "0x48af8b28DDC5e5A86c4906212fc35Fa808CA8763",
  [baseSepolia.id]: "0xD2F3C6185e06925dCBE794C6574315b2202E9CcD",
};

export const RevenueManagerAddress: Addresses = {
  [base.id]: "0xc8d4B2Ca8eD6868eE768beAb1f932d7eecCc1b50",
  [baseSepolia.id]: "0xA8153b14c8CfdDfb02627807D84AB02D12A85477",
};

export const AddressFeeSplitManagerAddress: Addresses = {
  [base.id]: "0xfAB4BA48a322Efc8b25815448BE6018D211e89f3",
  [baseSepolia.id]: "0x0A3AF63cd86E68a852A1D4923FEfC4e855D8499d",
};

export const StakingManagerAddress: Addresses = {
  [base.id]: "0xec0069F8DBbbC94058dc895000dd38ef40b3125d",
  [baseSepolia.id]: "0xB8f1cb6B4Ff8f07149276bbfA617aed7bd32d20D",
};

export const BuyBackManagerAddress: Addresses = {
  [base.id]: "0x3AAF3b1D8cD5b61C77f99bA7cdf41E9eC0Ba8a3f",
  [baseSepolia.id]: "0xc3947EC9d687053bBA72b36Fd6b2567e775E82C7",
};

/** Verifiers */
export const TokenImporterAddress: Addresses = {
  [base.id]: "0xb47af90ae61bc916ea4b4bacffae4570e7435842",
  [baseSepolia.id]: "0x7981369D21975F39773f289F759F7d7CE1097139",
};

export const ClankerWorldVerifierAddress: Addresses = {
  [base.id]: "0xf6ddfcb093be0cd0c015590cb6c5127d9ff2a20b",
  [baseSepolia.id]: "0x2874f9a30348acaaad55d74b0bec9c18f04b471a",
};

export const DopplerVerifierAddress: Addresses = {
  [base.id]: "0xedd66b080b8e9425c39d349a3fb69f480580f993",
  [baseSepolia.id]: "0x6428b5C4da36ecB070aBdcB5E1939244A3cC7fb5",
};

export const VirtualsVerifierAddress: Addresses = {
  [base.id]: "0x06a089fa231aca48d2aa77365123ad9aca43d3a4",
  [baseSepolia.id]: "0x6582d2bc6a7eba3b40bdf46b3868fc7ec2ff96ec",
};

export const WhitelistVerifierAddress: Addresses = {
  [base.id]: "0x7a04367563a65db574d6b7d084fdbcf4a570c5a6",
  [baseSepolia.id]: "0xfde5b79e3e2814edd5f91e8694ae400954d9cfaa",
};

export const ZoraVerifierAddress: Addresses = {
  [base.id]: "0x656047fd43d2c3a121f2ef859d7171d7dd59f8b9",
  [baseSepolia.id]: "0x05a5763e9199b88bb591c6b112d0424b2cd7a99e",
};

/** ======== */

/** Permissions */
export const ClosedPermissionsAddress: Addresses = {
  [base.id]: "0x4dfc76A31A2a0110739611683a8b6C5201480fa1",
  [baseSepolia.id]: "0x551aeD820CAfaca2f9cD1C637AAc076D05a03AC2",
};

export const WhitelistedPermissionsAddress: Addresses = {
  [base.id]: "0x828B58B2B2df8ff3221Fbe2b07e75a56a84493Cc",
  [baseSepolia.id]: "0xe8691E8f576A98c41EBB5E984207d4F51386621f",
};
/** =========== */

export const FeeEscrowAddress: Addresses = {
  [base.id]: "0x72e6f7948b1B1A343B477F39aAbd2E35E6D27dde",
  [baseSepolia.id]: "0x73E27908b7d35A9251a54799A8ef4C17e4ED9FF9",
};

export const ReferralEscrowAddress: Addresses = {
  [base.id]: "0xBD39c7Be6D98BD1a3e4Ad482baF99d738947fE55",
  [baseSepolia.id]: "0xd3d9047CaBE3346C70b510435866565176e8CE12",
};

export const FLETHAddress: Addresses = {
  [base.id]: "0x000000000D564D5be76f7f0d28fE52605afC7Cf8",
  [baseSepolia.id]: "0x79FC52701cD4BE6f9Ba9aDC94c207DE37e3314eb",
};

export const FLETHHooksAddress: Addresses = {
  [base.id]: "0x9E433F32bb5481a9CA7DFF5b3af74A7ed041a888",
  [baseSepolia.id]: "0x4bd2ca15286c96e4e731337de8b375da6841e888",
};

// @deprecated: FlaunchZap used instead
export const FastFlaunchZapAddress: Addresses = {
  [base.id]: "0x68d967d25806fef4aa134db031cdcc55d3e20f92",
  [baseSepolia.id]: "0x821d9f6075e7971cc71c379081de9d532f5f9957",
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

export const UniV4PositionManagerAddress: Addresses = {
  [base.id]: "0x7C5f5A4bBd8fD63184577525326123B519429bDc",
  [baseSepolia.id]: "0x4B2C77d209D3405F41a037Ec6c77F7F5b8e2ca80",
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
