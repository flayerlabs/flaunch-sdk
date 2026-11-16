import type { Address, Hash } from "viem";
import { readContract, simulateContract, waitForTransactionReceipt, writeContract } from "viem/actions";
import { StakingRecipientAbi } from "./abi/index.js";
import type { Clients } from "./claims.js";

/** `StakingRecipient.MAX_INTERVALS_PER_CLAIM`, the most reward intervals one claim may process. */
const MAX_INTERVALS = 32n;

/** Stakes the coin into its staking recipient. The staker first approves `staking` to spend `amount` of the coin. */
export function buildStake(staking: Address, amount: bigint) {
  return { address: staking, abi: StakingRecipientAbi, functionName: "stake", args: [amount] } as const;
}

export function buildWithdraw(staking: Address, amount: bigint) {
  return { address: staking, abi: StakingRecipientAbi, functionName: "withdraw", args: [amount] } as const;
}

/**
 * Moves the beneficiary's staking rewards into the fee escrow, then claim them there with `claimFees`.
 * One claim processes a bounded number of reward intervals, so this repeats `claimBatch` until none have more left.
 */
export async function claimStakingRewards(
  { publicClient, walletClient }: Clients,
  staking: Address,
  beneficiary: Address,
  currencies: Address[],
): Promise<Hash[]> {
  const hashes: Hash[] = [];
  for (;;) {
    const previews = await Promise.all(
      currencies.map((currency) =>
        readContract(publicClient, {
          address: staking,
          abi: StakingRecipientAbi,
          functionName: "previewClaim",
          args: [beneficiary, currency, MAX_INTERVALS],
        }),
      ),
    );
    const claims = currencies
      .filter((_, i) => previews[i][0] > 0n || previews[i][1])
      .map((currency) => ({ beneficiary, currency, maxIntervals: MAX_INTERVALS }));
    if (!claims.length) return hashes;

    const { request } = await simulateContract(publicClient, {
      address: staking,
      abi: StakingRecipientAbi,
      functionName: "claimBatch",
      args: [claims],
      account: walletClient.account,
    });
    const hash = await writeContract(walletClient, { ...request, chain: walletClient.chain });
    // The next preview must see this claim's progress, and a reverted claim made none, so sending it again would loop
    const { status } = await waitForTransactionReceipt(publicClient, { hash });
    if (status !== "success") throw new Error(`Staking claim ${hash} reverted`);
    hashes.push(hash);
    if (!previews.some(([, hasMore]) => hasMore)) return hashes;
  }
}
