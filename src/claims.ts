import { BaseError, ContractFunctionRevertedError, type Account, type Address, type Chain, type Client, type Hash, type Transport } from "viem";
import { readContract, simulateContract, writeContract } from "viem/actions";
import { FeeEscrowAbi, FlaunchAbi } from "./abi/index.js";
import { deployment } from "./addresses.js";

export type Clients = {
  publicClient: Client;
  walletClient: Client<Transport, Chain, Account>;
};

/** `Flaunch.distribute`: pushes a coin's accrued fees to its recipients, which credit the fee escrow. Anyone may call it. */
export function buildDistribute(chainId: number, tokenId: bigint) {
  return { address: deployment(chainId).flaunch, abi: FlaunchAbi, functionName: "distribute", args: [tokenId] } as const;
}

/** `Flaunch.burnRoyaltyPermission`: the launch NFT owner locks the fee route for good. */
export function buildBurnRoyaltyPermission(chainId: number, tokenId: bigint) {
  return {
    address: deployment(chainId).flaunch,
    abi: FlaunchAbi,
    functionName: "burnRoyaltyPermission",
    args: [tokenId],
  } as const;
}

/**
 * Claims the beneficiary's fee escrow credit in every currency with one `claimBatch`.
 * A batch is all or nothing, so when it would revert each currency with credit is claimed on its own and the ones that revert are reported.
 * Wallet rejections and RPC errors throw.
 */
export async function claimFees(
  { publicClient, walletClient }: Clients,
  chainId: number,
  beneficiary: Address,
  currencies: Address[],
): Promise<{ hashes: Hash[]; failed: Address[] }> {
  if (!currencies.length) return { hashes: [], failed: [] };
  const address = deployment(chainId).feeEscrow;
  const { account, chain } = walletClient;
  const batch = await unlessReverted(
    simulateContract(publicClient, {
      address,
      abi: FeeEscrowAbi,
      functionName: "claimBatch",
      args: [currencies.map((currency) => ({ beneficiary, currency }))],
      account,
    }),
  );
  if (batch) return { hashes: [await writeContract(walletClient, { ...batch.request, chain })], failed: [] };

  const hashes: Hash[] = [];
  const failed: Address[] = [];
  for (const currency of currencies) {
    // A zero claim succeeds without moving anything, so it would only cost the beneficiary gas
    const credit = await readContract(publicClient, { address, abi: FeeEscrowAbi, functionName: "claimable", args: [beneficiary, currency] });
    if (credit === 0n) continue;
    const claim = await unlessReverted(
      simulateContract(publicClient, { address, abi: FeeEscrowAbi, functionName: "claim", args: [{ beneficiary, currency }], account }),
    );
    if (claim) hashes.push(await writeContract(walletClient, { ...claim.request, chain }));
    else failed.push(currency);
  }
  return { hashes, failed };
}

/** `null` when the simulated contract call reverts. */
async function unlessReverted<T>(simulation: Promise<T>): Promise<T | null> {
  try {
    return await simulation;
  } catch (error) {
    if (error instanceof BaseError && error.walk((cause) => cause instanceof ContractFunctionRevertedError)) return null;
    throw error;
  }
}
