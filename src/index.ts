import { ReadFlaunchSDK, ReadWriteFlaunchSDK } from "./sdk/FlaunchSDK";

export * from "./abi";
export * from "./addresses";
export * from "./helpers";
export * from "./utils/univ4";
export * from "./utils/parseSwap";
export * from "./utils/universalRouter";
export * from "./types";

export type {
  BuySwapLog,
  SellSwapLog,
  BaseSwapLog,
  PoolCreatedLogs,
  PoolSwapLog,
} from "./clients/FlaunchPositionManagerClient";
export {
  ReadDynamicAddressFeeSplitManager,
  ReadWriteDynamicAddressFeeSplitManager,
} from "./clients/DynamicAddressFeeSplitManagerClient";
export type {
  DynamicRecipientInfo,
  RecipientShare,
} from "./clients/DynamicAddressFeeSplitManagerClient";
export type {
  FlaunchWithDynamicSplitManagerParams,
  FlaunchWithDynamicSplitManagerIPFSParams,
} from "./clients/FlaunchZapClient";
export {
  ReadFeeEscrowV1_3,
  ReadWriteFeeEscrowV1_3,
} from "./clients/FeeEscrowV1_3Client";
export type { EscrowTokenBalance } from "./clients/FeeEscrowV1_3Client";
export {
  ReadFlaunchZapV1_3,
  ReadWriteFlaunchZapV1_3,
} from "./clients/FlaunchZapV1_3Client";
export type {
  CalculatePairedTokenFlaunchFeeParams,
  FlaunchPairedTokenParams,
  PairedTokenFlaunchFee,
  PairedTokenFlaunchParams,
} from "./clients/FlaunchZapV1_3Client";
export { ReadPairedTokenRegistryV1_3 } from "./clients/PairedTokenRegistryV1_3Client";
export type { PairedTokenConfig } from "./clients/PairedTokenRegistryV1_3Client";
// v1.3.1 paired-token swaps through PoolSwap (mUSD-, native-ETH-, flETH- or B20-paired pools)
export {
  ReadPoolSwapV1_3,
  ReadWritePoolSwapV1_3,
} from "./clients/PoolSwapV1_3Client";
export type {
  PoolSwapParams,
  PoolSwapV1_3SwapParams,
} from "./clients/PoolSwapV1_3Client";
export { ReadPairedTokenPositionManagerV1_3 } from "./clients/PairedTokenPositionManagerV1_3Client";
export type {
  PairedSwapDirection,
  PairedTokenSwapParams,
  PairedPoolQuoteParams,
  PairedSwapCall,
  PairedSwapApproveCall,
  PairedSwapPlan,
  ResolvedPairedPool,
} from "./sdk/FlaunchSDK";

// v1.3.1 multi-asset managers (Base mainnet only) — a separate generation from the clients above
export {
  ReadTreasuryManagerV1_3,
  ReadWriteTreasuryManagerV1_3,
} from "./clients/TreasuryManagerV1_3Client";
export type { AssetBalance } from "./clients/TreasuryManagerV1_3Client";
export {
  ReadRevenueManagerV1_3,
  ReadWriteRevenueManagerV1_3,
  encodeRevenueManagerClaimData,
} from "./clients/RevenueManagerV1_3Client";
export {
  ReadDynamicAddressFeeSplitManagerV1_3,
  ReadWriteDynamicAddressFeeSplitManagerV1_3,
} from "./clients/DynamicAddressFeeSplitManagerV1_3Client";
export type { DynamicRecipientInfoV1_3 } from "./clients/DynamicAddressFeeSplitManagerV1_3Client";
export {
  ReadStakingManagerV1_3,
  ReadWriteStakingManagerV1_3,
} from "./clients/StakingManagerV1_3Client";
export type {
  StakePositionV1_3,
  StakeRewardsV1_3,
} from "./clients/StakingManagerV1_3Client";
export {
  ReadFlaunchManagerZapV1_3,
  ReadWriteFlaunchManagerZapV1_3,
} from "./clients/FlaunchManagerZapV1_3Client";
export type { DeployManagerV1_3Params } from "./clients/FlaunchManagerZapV1_3Client";

export { ReadFlaunchSDK, ReadWriteFlaunchSDK };
export { createFlaunch } from "./sdk/factory";
export type { CreateFlaunchParams } from "./sdk/factory";
export { createDrift } from "./sdk/drift";

// Calldata generation exports
export {
  createFlaunchCalldata,
  decodeCallData,
  parseCall,
  createCallDataWalletClient,
  encodedCallAbi,
} from "./sdk/calldata";
export type {
  CreateFlaunchCalldataParams,
  CallData,
  CallDataMethod,
  CallDataResult,
} from "./sdk/calldata";

export { FlaunchBackend } from "./sdk/FlaunchBackend";

export const FlaunchSDK = {
  ReadFlaunchSDK,
  ReadWriteFlaunchSDK,
};
