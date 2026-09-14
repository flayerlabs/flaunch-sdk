# Build your own referral system

Your app owns links, codes, storage, attribution windows and wallet binding. The SDK needs the referring user's wallet. There is no Reflaunch login/API dependency and no platform deduction from the protocol referral share.

## Attribute swaps

```ts
const referrer = referringUserWallet;
const plan = await sdk.planPairedTokenSwap({
  coinAddress,
  pairedToken,
  direction: "buy",
  amountIn,
  slippageBps: 100,
  sender: trader,
  referrer,
});
const config = await sdk.getReferralConfig({ poolKey: plan.poolKey });
// Execute plan.approve if present, then plan.swap using the existing protected flow.
```

Ordinary `buyCoin`, `sellCoin`, `getBuyQuoteExactInput`, `getBuyQuoteExactOutput` and `getSellQuoteExactInput` also accept `referrer`. Supported intermediate routes carry attribution on the Flaunch pool hop. External aggregator routes do not automatically earn Flaunch referrals. Protected paired swaps remain exact-input only.

Quotes and execution use identical referral hook data. `resolveReferralHookData({ referrer, hookData })` rejects conflicting addresses and malformed leading words, preserving supplied payload bytes. Omitting `referrer` preserves an embedded referrer. A nonzero referrer with empty hook data is a conflict.

`encodeTrustedReferralHookData(message, referrer)` packages legacy trusted-signer authorizations; `encodeSpendReferralHookData(message, referrer)` packages spend-gated/Game Mode authorizations. Matching decode helpers expose their fields. These helpers package **existing** signatures; your authorized signer must produce the authorization for the actual chain, pool and gate. Never replace signed hook data with an address-only encoding.

The existing spend-gate signature binds buyer, pool, deadline, spend cap and nonce, but not the leading referrer. Neither links nor SDK checks enforce immutable attribution onchain. Self-referral and first-/last-click policies are app choices.

## Fee configuration and balances

`getReferralConfig({ poolKey })` reads the actual hook's `getPoolFeeDistribution` and `referralEscrow` at one block. `referralShare / denominator` is a fraction of the **swap fee**, taken before protocol, creator and bid-wall allocations. The denominator is 10,000. Do not hardcode 10%: pools can override the rate. Dynamic fees/exemptions affect actual fees, so the configured `swapFee` is not a guaranteed realized fee. Zero rates/referrers earn nothing. Configuration can change after reading it.

```ts
const { escrow, payoutMode } = await sdk.getReferralConfig({ poolKey });
if (payoutMode === "escrow") {
  const amount = await sdk.referralBalance(referrer, feeToken, { escrow });
  // Connect the referrer's wallet; payoutRecipient may be a different wallet.
  const txHash = await writeSdk.claimReferralBalance(
    [feeToken],
    payoutRecipient,
    { escrow },
  );
}
```

Always pass the actual escrow in new integrations. Existing two-argument balance and claim APIs retain their legacy escrow default. Explicit escrows work on Robinhood independently of Base-only clients. `getReferralEscrowCapabilities(escrow)` probes the unwrap overload using an empty-token eth_call, without sending a transaction. RPC failures propagate instead of being treated as evidence of legacy support.

Rewards use the swap's fee currency: memecoins, native currency (`zeroAddress`) or paired tokens. Raw balances use each token's decimals. The default contract claim preserves that deployment's unwrap behavior. Current escrows unwrap supported wrappers to their underlying asset and transfer plain tokens as-is. `{ unwrap: false }` claims the original token, including when a wrapper is paused; older escrows reject this option before submission. Unwrapping does not sell memecoins for ETH.

Claims spend `allocations[msg.sender][token]`; a payout recipient does not authorize claiming that recipient's allocation. Smart-account claims must execute as the account that earned the rewards. A separate batcher that becomes `msg.sender` cannot claim a wallet's allocation.

## Discovery and confirmation

`referralBalances({ recipient, balances: [{ escrow, token }] })` returns bigint amounts identified by chain, escrow and token. Contracts cannot enumerate allocation keys. Discover them from assignment logs or an indexer, retaining historical escrows after rotation. A current hook pointer does not include old unclaimed balances.

[The framework-neutral example](../examples/referrals.mjs) includes address links, protected swap plans, bounded log scanning and claim calldata grouped by escrow. Start at deployment, persist finalized progress and reconcile reorganizations. Choose an RPC-supported chunk size. Current balance reads are authoritative; historical totals are not claimable balances. Hosted analytics and price conversion are outside these primitives.

`decodeReferralEvents(logs, { chainId, hooks, escrows })` decodes assignment, direct-payment and claim logs only from verified emitters supplied by the caller. It preserves token units, escrow identity and receipt coordinates and excludes removed logs. `TokensAssigned` means accrual; `ReferrerFeePaid` means direct payment; `TokensClaimed` means withdrawal. Do not add claims to earnings or infer payment solely from a referral-bearing swap. These events do not reliably identify traders in bundled/smart-account transactions.

## Compatibility and validation

Targets: existing supported hooks on Base, Robinhood and Base Sepolia, including superseded pool generations. Pool selection uses `poolKey.hooks`; no new contract or fee-setting change is required. The completed protected-router migration is not reopened by this feature.

Both factory modes retain their public client for configuration/capability reads. Constructor users must provide the optional public client for these new RPC helpers. Existing Drift-only balance reads and default claims still work.

Unit tests cover routing, claims, signed data, event decoding and compatibility. The opt-in fork script uses synthetic accounts and refuses non-local writes. See [validation](referrals-validation.md) for exactly what was executed; unexecuted scenarios are not certified by unit tests.

For relayed smart-account submissions, verify the actual pool gate approves the selected router. The validation report records a Base gate approval discrepancy; direct EOA gated referrals passed.
