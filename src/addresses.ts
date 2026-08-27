import {
  base,
  baseSepolia,
  mainnet,
  robinhood,
  unichain,
} from "viem/chains";
import { Addresses, PoolKey } from "./types";
import { type Address, zeroAddress } from "viem";

export const FlaunchZapAddress: Addresses = {
  [base.id]: "0x39112541720078c70164EA4Deb61F0A4811910F9",
  [baseSepolia.id]: "0x25b747aeca2612b9804b5c3bb272a3daefdc6eaa",
};

// v1.3.1 (GitHub release v1.3.1) paired-token FlaunchZap deployments.
// Base: redeployed 2026-08-27 bound to the v1.3.1 TreasuryManagerFactory (replaces
// 0x29b37dfe…, which had no factory and could strand a launch NFT inside a manager
// implementation). Robinhood's v1.3.1 zap is still factory-less — the same hazard applies there,
// so do not route manager launches through it until it is rebound (FLA2-388).
export const FlaunchZapV1_3Address: Addresses = {
  [base.id]: "0xf787d757674b21efd713fb636b16ed994bfa82a8",
  [baseSepolia.id]: "0xe8476aa6508f0c31e3126f2340d18e9c6fbf8dd3",
  [robinhood.id]: "0x2e744436e35bc346777288b8dae2da23fd67e542",
};

export const FlaunchZapMultichainAddress: Addresses = {
  [mainnet.id]: "0x65D673F25b5878df2a2e8a5203Fe2b2846c5CBba",
  [unichain.id]: "0x65D673F25b5878df2a2e8a5203Fe2b2846c5CBba",
  [robinhood.id]: "0x65D673F25b5878df2a2e8a5203Fe2b2846c5CBba",
};

export const FlaunchPositionManagerMultichainAddress: Addresses = {
  [mainnet.id]: "0x5Cf8e499C7c466C7E2cf127BDF129F57151E65Dc",
  [unichain.id]: "0x5Cf8e499C7c466C7E2cf127BDF129F57151E65Dc",
  [robinhood.id]: "0x5Cf8e499C7c466C7E2cf127BDF129F57151E65Dc",
};

export const FlaunchMultichainAddress: Addresses = {
  [mainnet.id]: "0x0cf6BdF0a85A9d6763361037985B76C8893553Af",
  [unichain.id]: "0x0cf6BdF0a85A9d6763361037985B76C8893553Af",
  [robinhood.id]: "0x0cf6BdF0a85A9d6763361037985B76C8893553Af",
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

// v1.3.1 (GitHub release v1.3.1) - Base mainnet + Robinhood (4663); no baseSepolia deployment
export const FlaunchPositionManagerV1_3Address: Addresses = {
  [base.id]: "0x588c683ecc450f8b2aadb13d7f63792b840425dc",
  [robinhood.id]: "0x588c683ecc450f8b2aadb13d7f63792b840425dc", // CREATE3 — same address as Base
};

// PositionManagers used by the paired-token launch path. This is separate from
// FlaunchPositionManagerV1_3Address because that map also drives version routing.
export const PairedTokenPositionManagerV1_3Address: Addresses = {
  [base.id]: "0x588c683ecc450f8b2aadb13d7f63792b840425dc",
  [baseSepolia.id]: "0x5558e7271ec2e8b2faaf05f0eedab1cd986be5dc",
  [robinhood.id]: "0x588c683ecc450f8b2aadb13d7f63792b840425dc", // CREATE3 — same address as Base
};

export const PairedTokenRegistryV1_3Address: Addresses = {
  [base.id]: "0x26958422636655b5a4eCE23a062e2EB61332c6da",
  [baseSepolia.id]: "0x23cb441d18ca75c6a14964b06806df668d45a1c6",
  [robinhood.id]: "0xC3F4E72DE4D37988F12C101b0766Fd8462F6Faf9",
};

export const AnyPositionManagerAddress: Addresses = {
  [base.id]: "0x8DC3b85e1dc1C846ebf3971179a751896842e5dC",
  [baseSepolia.id]: "0xB4A535B9D35851972736495CC52FBfDaCF32e5dc",
};

// v1.3.1 (GitHub release v1.3.1) - Base mainnet + Robinhood (4663); no baseSepolia deployment
export const AnyPositionManagerV1_3Address: Addresses = {
  [base.id]: "0x6ea0edee449a287504990df8d87951b9436825dc",
  [robinhood.id]: "0x6ea0edee449a287504990df8d87951b9436825dc", // CREATE3 — same address as Base
};

export const FlaunchAddress: Addresses = {
  [base.id]: "0xCc7A4A00072ccbeEEbd999edc812C0ce498Fb63B",
  [baseSepolia.id]: "0x7D375C9133721083DF7b7e5Cb0Ed8Fc78862dfe3",
};

export const FlaunchV1_1Address: Addresses = {
  [base.id]: "0xb4512bf57d50fbcb64a3adf8b17a79b2a204c18c",
  [baseSepolia.id]: "0x96be8ff5e244294a34bfa507a39190dc7a839baa",
};

export const FlaunchV1_2Address: Addresses = {
  [base.id]: "0x516af52d0c629b5e378da4dc64ecb0744ce10109", // "1.3" from github releases
  [baseSepolia.id]: "0xe2ef58a54ee79dac0D4A130ea58b340124DF9438",
};

// v1.3.1 (GitHub release v1.3.1) - Base mainnet + Robinhood (4663); no baseSepolia deployment
export const FlaunchV1_3Address: Addresses = {
  [base.id]: "0x475a09618bfd00fa4cb03b8504e95b62075e6f7d",
  [robinhood.id]: "0x929d4815fe415b85e53975aec58a8980bda3d90c",
};

export const AnyFlaunchAddress: Addresses = {
  [base.id]: "0xc5B2E8F197407263F4B62a35C71bFc394ecF95D5",
  [baseSepolia.id]: "0x67Ee6C83956a75f67bD3Fc8Ca4080D95a145c7C9",
};

// v1.3.1 (GitHub release v1.3.1) - Base mainnet + Robinhood (4663); no baseSepolia deployment
export const AnyFlaunchV1_3Address: Addresses = {
  [base.id]: "0x299c7e6992a4630d77a8cbd60aa78e17189e53f7",
  [robinhood.id]: "0x33f04d3a76cffa25e5da285d97336e67611b2282",
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

// v1.3.1 (GitHub release v1.3.1) - Base mainnet + Robinhood (4663); no baseSepolia deployment
export const BidWallV1_3Address: Addresses = {
  [base.id]: "0x0dae90b70f62ce3b1d5278f4763bd1f595d6a687",
  [robinhood.id]: "0x641d5cf4290c7c6e45cb672c4467a9e4fc89d72d",
};

export const AnyBidWallAddress: Addresses = {
  [base.id]: "0x2154c604df568A5285284D1c4918DC98C39240df",
  [baseSepolia.id]: "0xcfF222eA42E43F46A98755db237E4c9C2CA9B772",
};

// v1.3.1 (GitHub release v1.3.1) - Base mainnet + Robinhood (4663); no baseSepolia deployment
export const AnyBidWallV1_3Address: Addresses = {
  [base.id]: "0x9d58ca8011096ad711babf0d990c45b9d5bb047d",
  [robinhood.id]: "0x361a874945c07069beed611f950506a8e324b630",
};

export const TreasuryManagerFactoryAddress: Addresses = {
  [mainnet.id]: "0x656047FD43D2c3a121F2Ef859d7171D7Dd59F8b9",
  [unichain.id]: "0x7A04367563A65DB574d6B7d084fDbCF4A570c5A6",
  [robinhood.id]: "0x25f39fe1769D1A1FD622a41030D47314B338B2BF",
  [base.id]: "0x48af8b28DDC5e5A86c4906212fc35Fa808CA8763",
  [baseSepolia.id]: "0xD2F3C6185e06925dCBE794C6574315b2202E9CcD",
};

export const RevenueManagerAddress: Addresses = {
  [mainnet.id]: "0x0A0f4073a4c663d4b5b3f9fAedC1b650f94f5259",
  [unichain.id]: "0xeC82CC5A62d25E4b64344cBDb8452f2f1f0c7a6e",
  [robinhood.id]: "0xb25d5415A87d531F374d43D5174B50B1fEa944c3",
  [base.id]: "0xc8d4B2Ca8eD6868eE768beAb1f932d7eecCc1b50",
  [baseSepolia.id]: "0xA8153b14c8CfdDfb02627807D84AB02D12A85477",
};

export const AddressFeeSplitManagerAddress: Addresses = {
  [mainnet.id]: "0xeC82CC5A62d25E4b64344cBDb8452f2f1f0c7a6e",
  [unichain.id]: "0x656047FD43D2c3a121F2Ef859d7171D7Dd59F8b9",
  [robinhood.id]: "0x2900cC6bbD79C9518fe25D38F8262a1c523536Fb",
  [base.id]: "0xfAB4BA48a322Efc8b25815448BE6018D211e89f3",
  [baseSepolia.id]: "0x0A3AF63cd86E68a852A1D4923FEfC4e855D8499d",
};

export const DynamicAddressFeeSplitManagerAddress: Addresses = {
  [mainnet.id]: "0xd1533e01e2B7C48D132A696DAC9fc9C7676bc86D",
  [unichain.id]: "0x0A0f4073a4c663d4b5b3f9fAedC1b650f94f5259",
  [robinhood.id]: "0x84B959Ee120d572EEEe3229d7a0EA1ee8236620f",
  [base.id]: "0x18713855492A778363e23e2CdE325344b8fd6F8d",
  [baseSepolia.id]: "0xA4A1a2Ca68151565d5200243a52EEBbCb2C878E0",
};

export const StakingManagerAddress: Addresses = {
  [base.id]: "0xec0069F8DBbbC94058dc895000dd38ef40b3125d",
  [baseSepolia.id]: "0xB8f1cb6B4Ff8f07149276bbfA617aed7bd32d20D",
};

export const BuyBackManagerAddress: Addresses = {
  [base.id]: "0x3AAF3b1D8cD5b61C77f99bA7cdf41E9eC0Ba8a3f",
  [baseSepolia.id]: "0xc3947EC9d687053bBA72b36Fd6b2567e775E82C7",
};

// v1.3.1 multi-asset managers (flaunch-managers release v1.3.1-base) - Base mainnet only
// A separate generation from the *ManagerAddress maps above: its own factory, implementations
// and zap, paying out per payout asset (ETH = address(0), or the coin's paired token). Managers
// deployed from the old factory keep working through the unsuffixed APIs.
export const TreasuryManagerFactoryV1_3Address: Addresses = {
  [base.id]: "0xB03Be6c735ef90189D6a22bBC8F6A45a33348fDe",
};

export const RevenueManagerV1_3Address: Addresses = {
  [base.id]: "0x908D692E628073A5B644Bc32B8dF57A5d1842288",
};

export const AddressFeeSplitManagerV1_3Address: Addresses = {
  [base.id]: "0x7dC776cf57DacA91b315fe4F8803577dAb560ba5",
};

export const DynamicAddressFeeSplitManagerV1_3Address: Addresses = {
  [base.id]: "0xC4a0B79A0dB1F7F67da97E7F9A8867B6CaF017b2",
};

export const ERC721OwnerFeeSplitManagerV1_3Address: Addresses = {
  [base.id]: "0xDbFA9d3cab72EAE6Ba44ebC27175706aA451d9c0",
};

export const StakingManagerV1_3Address: Addresses = {
  [base.id]: "0x72b9192017361eA00cDc1Cf1AC0F178cf89920cA",
};

export const GroupMapperV1_3Address: Addresses = {
  [base.id]: "0x4a68638179De37163d86B10e6B4b927CA1a0dE87",
};

// Deploys + initializes a v1.3.1 manager through the v1.3.1 factory in one call. Launching a coin
// straight into a manager stays with the core FlaunchZap.
export const FlaunchManagerZapV1_3Address: Addresses = {
  [base.id]: "0xD7E0c1D2B2a588cEC3b2Bdc9428FfE59b739749B",
};

/** Verifiers */
export const TokenImporterAddress: Addresses = {
  [base.id]: "0x6fb66f4fc262dc86e12136c481ba7c411e668197",
  [baseSepolia.id]: "0x7981369D21975F39773f289F759F7d7CE1097139",
};

export const ClankerWorldVerifierAddress: Addresses = {
  [base.id]: "0xFe55dFf581b665479ABe9Fc0A0578FB222cB4Dda",
  [baseSepolia.id]: "0x2874F9A30348aCAaaD55D74B0BEc9C18f04b471a",
};

export const DopplerVerifierAddress: Addresses = {
  [base.id]: "0xedd66b080b8e9425c39d349a3fb69f480580f993",
  [baseSepolia.id]: "0x6428b5C4da36ecB070aBdcB5E1939244A3cC7fb5",
};

export const SolanaVerifierAddress: Addresses = {
  [base.id]: "0xba28ac1540893a34476c24b2c4fa32e0506c9055",
  [baseSepolia.id]: "0x47226918e518f205584bd75bf81e0b532b0b3ea7",
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
  [mainnet.id]: "0xA5357e7bd0a03e8Ea65bE800a29C8fa6ff6b7720",
  [unichain.id]: "0xd1533e01e2B7C48D132A696DAC9fc9C7676bc86D",
  [robinhood.id]: "0xF0469beF728c498f3621008C65B95EDa56C82Ae3",
  [base.id]: "0x4dfc76A31A2a0110739611683a8b6C5201480fa1",
  [baseSepolia.id]: "0x551aeD820CAfaca2f9cD1C637AAc076D05a03AC2",
};

export const WhitelistedPermissionsAddress: Addresses = {
  [mainnet.id]: "0xC1d6EDb8656Fd304e22fe42625Db850F96D990D2",
  [unichain.id]: "0xA5357e7bd0a03e8Ea65bE800a29C8fa6ff6b7720",
  [robinhood.id]: "0x0E3ACf44D030Cc632Fa006b56778E009bC9564d8",
  [base.id]: "0x828B58B2B2df8ff3221Fbe2b07e75a56a84493Cc",
  [baseSepolia.id]: "0xe8691E8f576A98c41EBB5E984207d4F51386621f",
};

// v1.3.1 multi-asset managers (flaunch-managers release v1.3.1-base) - Base mainnet only
// WhitelistedPermissions validates a group against the factory it was built with, so managers
// from the v1.3.1 factory need this instance. ClosedPermissions is factory-agnostic and reused.
export const WhitelistedPermissionsV1_3Address: Addresses = {
  [base.id]: "0xaCE028CB08A19C4d2a6e442516EbA7d114C09Af9",
};
/** =========== */

export const FeeEscrowAddress: Addresses = {
  [base.id]: "0x72e6f7948b1B1A343B477F39aAbd2E35E6D27dde",
  [baseSepolia.id]: "0x73E27908b7d35A9251a54799A8ef4C17e4ED9FF9",
  [mainnet.id]: "0x77A4513CDbE72bBfa8CEE7890D244B66b47f9573",
  [unichain.id]: "0x77A4513CDbE72bBfa8CEE7890D244B66b47f9573",
  [robinhood.id]: "0x77A4513CDbE72bBfa8CEE7890D244B66b47f9573",
};

// v1.3.1 (GitHub release v1.3.1) multi-token FeeEscrow: ONE singleton per chain serving every
// paired token, balances keyed (recipient, token). Base Sepolia runs the same contract from the
// `.vpt2` deployment (flaunch-contracts deployments/base-sepolia.md); Robinhood from
// deployments/robinhood-mainnet.md.
export const FeeEscrowV1_3Address: Addresses = {
  [base.id]: "0x17fbf54d6d15ebff82eee77e616f701952d08bb4",
  [baseSepolia.id]: "0xf4af7b459e971d9757c2100c626199c6c6334fca",
  [robinhood.id]: "0x4fb9de6bbe970a49c19fb967f937351728c01b8f",
};

export const ReferralEscrowAddress: Addresses = {
  [base.id]: "0xd381f8ea57df43c57cfe6e5b19a0a4700396f28c",
  [baseSepolia.id]: "0xd3d9047CaBE3346C70b510435866565176e8CE12",
};

// v1.3.1 (GitHub release v1.3.1) - Base mainnet + Robinhood (4663); no baseSepolia deployment
export const ReferralEscrowV1_3Address: Addresses = {
  [base.id]: "0xe86bfebc4f094d36074833618779d279a9af01aa",
  [robinhood.id]: "0xb6c0cca8b3a354fa0f348c121657f4a952e92b3d",
};

export const FLETHAddress: Addresses = {
  [base.id]: "0x000000000D564D5be76f7f0d28fE52605afC7Cf8",
  [baseSepolia.id]: "0x79FC52701cD4BE6f9Ba9aDC94c207DE37e3314eb",
  [mainnet.id]: "0x000000000bB1f9944965c64066D10038a84F9af2",
  [unichain.id]: "0x000000000DD39073Cfc60e7102288ccBd7Bf23fE",
  [robinhood.id]: "0x00000000043C1117DAFA3A3D0C7148Eb48B30130",
};

type FreshChainNativeETHSwapConfig = {
  flETHHooks: Address;
  quoter: Address;
  universalRouter: Address;
  permit2: Address;
  usesV4HopPriceLimits: boolean;
};

type FreshChainNativeETHSwapAddressKey = Exclude<
  keyof FreshChainNativeETHSwapConfig,
  "usesV4HopPriceLimits"
>;

/**
 * Complete native-ETH swap deployments for fresh-chain protocol instances.
 * Add a chain only after its ETH/flETH hook pool has been verified live.
 */
const freshChainNativeETHSwapConfigByChain: Partial<
  Record<number, FreshChainNativeETHSwapConfig>
> = {
  [robinhood.id]: {
    flETHHooks: "0xEA22Ae03085CAf74Ac3393f9902539fbE9786888",
    quoter: "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94",
    universalRouter: "0x8876789976dEcBfCbBbe364623C63652db8C0904",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    usesV4HopPriceLimits: true,
  },
};

function freshChainNativeETHSwapAddresses(
  key: FreshChainNativeETHSwapAddressKey
): Addresses {
  const addresses: Addresses = {};
  for (const [chainId, config] of Object.entries(
    freshChainNativeETHSwapConfigByChain
  )) {
    if (config) {
      addresses[Number(chainId)] = config[key];
    }
  }
  return addresses;
}

export function doesChainSupportMultichainNativeETHSwap(
  chainId: number
): boolean {
  return (
    freshChainNativeETHSwapConfigByChain[chainId] !== undefined &&
    FLETHAddress[chainId] !== undefined &&
    FlaunchPositionManagerMultichainAddress[chainId] !== undefined
  );
}

export function doesUniversalRouterUseV4HopPriceLimits(
  chainId: number
): boolean {
  return (
    freshChainNativeETHSwapConfigByChain[chainId]?.usesV4HopPriceLimits === true
  );
}

export const FLETHHooksAddress: Addresses = {
  [base.id]: "0x9E433F32bb5481a9CA7DFF5b3af74A7ed041a888",
  [baseSepolia.id]: "0x4bd2ca15286c96e4e731337de8b375da6841e888",
  ...freshChainNativeETHSwapAddresses("flETHHooks"),
};

// @deprecated: FlaunchZap used instead
export const FastFlaunchZapAddress: Addresses = {
  [base.id]: "0x68d967d25806fef4aa134db031cdcc55d3e20f92",
  [baseSepolia.id]: "0x821d9f6075e7971cc71c379081de9d532f5f9957",
};

export const PoolManagerAddress: Addresses = {
  [base.id]: "0x498581fF718922c3f8e6A244956aF099B2652b2b",
  [baseSepolia.id]: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
  [mainnet.id]: "0x000000000004444c5dc75cB358380D2e3dE08A90",
  [unichain.id]: "0x1F98400000000000000000000000000000000004",
  [robinhood.id]: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
};

export const UniversalRouterAddress: Addresses = {
  [base.id]: "0x6fF5693b99212Da76ad316178A184AB56D299b43",
  [baseSepolia.id]: "0x492E6456D9528771018DeB9E87ef7750EF184104",
  ...freshChainNativeETHSwapAddresses("universalRouter"),
};

export const QuoterAddress: Addresses = {
  [base.id]: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
  [baseSepolia.id]: "0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba",
  ...freshChainNativeETHSwapAddresses("quoter"),
};

export const StateViewAddress: Addresses = {
  [base.id]: "0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71",
  [baseSepolia.id]: "0x571291b572ed32ce6751a2Cb2486EbEe8DEfB9B4",
  [mainnet.id]: "0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227",
  [unichain.id]: "0x86e8631A016F9068C3f085fAF484Ee3F5fDee8f2",
  [robinhood.id]: "0xF3334192D15450CdD385c8B70e03f9A6bD9E673b",
};

export const Permit2Address: Addresses = {
  [base.id]: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  [baseSepolia.id]: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  ...freshChainNativeETHSwapAddresses("permit2"),
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
