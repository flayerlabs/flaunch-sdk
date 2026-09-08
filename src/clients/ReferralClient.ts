import {
  BaseError,
  ContractFunctionRevertedError,
  isAddress,
  zeroAddress,
  type Address,
  type PublicClient,
} from "viem";
import { ReferralEscrowUnwrapAbi, ReferralFeeAbi } from "../abi/Referral";
import type { PoolKey } from "../types";
import { getPoolId } from "../utils/univ4";

export type ReferralEscrowCapabilities = {
  escrow: Address;
  /** Whether the deployed escrow accepts claimTokens(tokens, recipient, unwrap). */
  supportsUnwrap: boolean;
};

export type ReferralConfig = {
  chainId: number;
  poolKey: PoolKey;
  poolId: `0x${string}`;
  blockNumber: bigint;
  swapFee: number;
  referralShare: number;
  protocolShare: number;
  denominator: 10000;
  payoutMode: "direct" | "escrow";
  escrow: Address;
  claimCapabilities: ReferralEscrowCapabilities | null;
};

export type ReferralEscrowOptions = { escrow?: Address };
export type ReferralClaimOptions = ReferralEscrowOptions & { unwrap?: boolean };
export type ReferralBalanceKey = { escrow: Address; token: Address };
export type ReferralTokenBalance = ReferralBalanceKey & {
  chainId: number;
  amount: bigint;
};

export function assertReferralEscrow(escrow: Address): void {
  if (
    typeof escrow !== "string" ||
    !isAddress(escrow) ||
    escrow.toLowerCase() === zeroAddress
  ) {
    throw new Error("A nonzero referral escrow address is required");
  }
}

/** Empty-token eth_call tests the overload without moving funds or submitting a transaction. */
export async function getReferralEscrowCapabilities(
  publicClient: PublicClient,
  escrow: Address,
  blockNumber?: bigint,
): Promise<ReferralEscrowCapabilities> {
  assertReferralEscrow(escrow);
  const code = await publicClient.getCode({ address: escrow, blockNumber });
  if (!code || code === "0x")
    throw new Error("Referral escrow has no deployed code");
  try {
    await publicClient.simulateContract({
      address: escrow,
      abi: ReferralEscrowUnwrapAbi,
      functionName: "claimTokens",
      args: [[], "0x0000000000000000000000000000000000000001", false],
      blockNumber,
    });
    return { escrow, supportsUnwrap: true };
  } catch (error) {
    if (
      error instanceof BaseError &&
      error.walk(
        (cause) => cause instanceof ContractFunctionRevertedError,
      ) instanceof ContractFunctionRevertedError
    ) {
      return { escrow, supportsUnwrap: false };
    }
    // An RPC outage is not evidence that an older ABI is required.
    throw error;
  }
}

/** Resolve the pool's own hook, never a chain's latest PositionManager constant. */
export async function getReferralConfig(
  publicClient: PublicClient,
  chainId: number,
  poolKey: PoolKey,
): Promise<ReferralConfig> {
  const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 });
  const poolId = getPoolId(poolKey);
  const [fees, escrow] = await Promise.all([
    publicClient.readContract({
      address: poolKey.hooks,
      abi: ReferralFeeAbi,
      functionName: "getPoolFeeDistribution",
      args: [poolId],
      blockNumber,
    }),
    publicClient.readContract({
      address: poolKey.hooks,
      abi: ReferralFeeAbi,
      functionName: "referralEscrow",
      blockNumber,
    }),
  ]);
  const direct = escrow.toLowerCase() === zeroAddress;
  return {
    chainId,
    poolKey,
    poolId,
    blockNumber,
    swapFee: fees.swapFee,
    referralShare: fees.referrer,
    protocolShare: fees.protocol,
    denominator: 10000,
    escrow,
    payoutMode: direct ? "direct" : "escrow",
    claimCapabilities: direct
      ? null
      : await getReferralEscrowCapabilities(publicClient, escrow, blockNumber),
  };
}
