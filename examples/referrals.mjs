/** Framework-neutral primitives for an app-owned referral system. */
import { isAddress, isAddressEqual, zeroAddress } from "viem";
import {
  createFlaunch,
  createFlaunchCalldata,
  decodeCallData,
  decodeReferralEvents,
  ReferralEventsAbi,
  ReferralFeeAbi,
} from "@flaunch/sdk";

// Example policy only: plain wallet-address links, no hosted code resolution or wallet binding.
export function referralLink(url, referringWallet) {
  if (
    !isAddress(referringWallet) ||
    isAddressEqual(referringWallet, zeroAddress)
  ) {
    throw new Error("A referring wallet is required");
  }
  const link = new URL(url);
  link.searchParams.set("ref", referringWallet);
  return link.toString();
}

export function referrerFromLink(url) {
  const value = new URL(url).searchParams.get("ref");
  return value && isAddress(value) && !isAddressEqual(value, zeroAddress)
    ? value
    : undefined;
}

/** Returns approve/swap calldata; the host app chooses its wallet execution flow. */
export async function planReferredSwap(publicClient, sender, url, swap) {
  const sdk = createFlaunch({ publicClient });
  const referrer = referrerFromLink(url);
  const plan = await sdk.planPairedTokenSwap({ ...swap, sender, referrer });
  const referralConfig = await sdk.getReferralConfig({ poolKey: plan.poolKey });
  return { plan, referralConfig };
}

/**
 * Bounded discovery: pass verified hooks, their deployment block and any escrows already known
 * at the start of the range. Start at deployment to discover every historical escrow.
 * Persist a finalized cursor in your application; reconcile/replay if the chain reorganizes.
 */
export async function discoverReferralBalances(
  publicClient,
  user,
  { hooks, initialEscrows = [], fromBlock, toBlock, chunkSize = 2000n },
) {
  if (fromBlock < 0n || toBlock < fromBlock || chunkSize <= 0n)
    throw new Error("Invalid block range");
  const sdk = createFlaunch({ publicClient });
  const escrows = new Set(initialEscrows.map((a) => a.toLowerCase()));
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end =
      start + chunkSize - 1n > toBlock ? toBlock : start + chunkSize - 1n;
    const updates = await Promise.all(
      hooks.map((address) =>
        publicClient.getLogs({
          address,
          event: ReferralFeeAbi.find((e) => e.name === "ReferralEscrowUpdated"),
          fromBlock: start,
          toBlock: end,
          strict: true,
        }),
      ),
    );
    for (const logs of updates)
      for (const log of logs) {
        if (
          !log.removed &&
          !isAddressEqual(log.args._referralEscrow, zeroAddress)
        ) {
          escrows.add(log.args._referralEscrow.toLowerCase());
        }
      }
  }
  const keys = new Map();
  for (const escrow of escrows) {
    for (let start = fromBlock; start <= toBlock; start += chunkSize) {
      const end =
        start + chunkSize - 1n > toBlock ? toBlock : start + chunkSize - 1n;
      const logs = await publicClient.getLogs({
        address: escrow,
        event: ReferralEventsAbi.find((e) => e.name === "TokensAssigned"),
        args: { _user: user },
        fromBlock: start,
        toBlock: end,
        strict: true,
      });
      for (const log of logs)
        if (!log.removed) {
          keys.set(`${escrow}:${log.args._token.toLowerCase()}`, {
            escrow,
            token: log.args._token,
          });
        }
    }
  }
  // Logs discover keys; current RPC balances decide what is still claimable.
  return sdk.referralBalances({
    recipient: user,
    balances: [...keys.values()],
  });
}

/** Each call spends the connected referrer's allocation, never the recipient's allocation. */
export async function buildReferralClaims(
  publicClient,
  referrer,
  recipient,
  balances,
  unwrap = true,
) {
  const sdk = createFlaunchCalldata({ publicClient, walletAddress: referrer });
  const groups = new Map();
  for (const balance of balances) {
    if (balance.chainId !== publicClient.chain.id)
      throw new Error("Switch to the balance chain first");
    if (balance.amount <= 0n) continue;
    const key = balance.escrow.toLowerCase();
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(balance.token);
  }
  return Promise.all(
    [...groups].map(async ([escrow, tokens]) =>
      decodeCallData(
        await sdk.claimReferralBalance([...tokens], recipient, {
          escrow,
          unwrap,
        }),
      ),
    ),
  );
}

/** Use only after a successful receipt; hookData itself is not proof of payment. */
export function confirmedReferralPayments(receipt, chainId, hooks, escrows) {
  if (receipt.status !== "success") return [];
  return decodeReferralEvents(receipt.logs, { chainId, hooks, escrows }).filter(
    (event) => event.kind !== "claimed" && event.amount > 0n,
  );
}
