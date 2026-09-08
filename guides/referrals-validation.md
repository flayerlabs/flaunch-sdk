# Referral SDK 0.14.0 validation — 8 September 2026

Based on SDK master `4b31a2c8b406ef294b05d5f260ed981b0511aab2`. The existing frontend referral PR remains separate; no Reflaunch backend is required for these primitives.

## Package and unit checks

- Fresh `pnpm install --frozen-lockfile --ignore-scripts`, using pnpm 10.34.3 and Node 22.23.2 as pinned by the repository.
- TypeScript check passes.
- Clean tarball consumer passes all six ESM/CJS entrypoints and NodeNext/Bundler TypeScript checks, including the new referral APIs.
- All declared bundle/declaration artifacts were emitted. The local Rollup CLI remained alive after its final output; package validation used the completed artifacts. This is not a claim that the local build command exited cleanly.
- 130 package-output tests pass, zero failures/skips. Includes escrow selection, legacy defaults, native-token balance keys, post-claim cache invalidation, capability failures, ordinary/protected swap attribution, conflicting signed payloads, event emitters, and the framework-neutral link/claim example.
- `pnpm audit --audit-level=moderate`: no known vulnerabilities.
- Generated TypeDoc and `llms-full.txt`: successful, with existing documentation warnings (94 warnings, zero errors).

## Deployed-contract lifecycle checks

All transaction writes used isolated localhost Anvil forks, chain ID 31337, synthetic accounts and synthetic funds. Public RPC access was read-only. Standard Anvil accounts had their code cleared locally to avoid executing unrelated real-chain EIP-7702 delegations. No public chain was changed.

| Chain        | Final local run starts at block | Ordinary native/flETH buys and sells | Signed-gate native buys and sells |
| ------------ | ------------------------------- | ------------------------------------ | --------------------------------- |
| Base         | 51,040,239                      | 4 passed                             | 2 passed                          |
| Robinhood    | 57,685,918                      | 4 passed                             | 2 passed                          |
| Base Sepolia | 46,550,955                      | 4 passed                             | 2 passed                          |

The start blocks include earlier local rehearsal transactions on each fork. They identify the final local test run, not independent public-chain receipt locations.

Each lifecycle asserts actual `TokensAssigned`, matching onchain allocation, inability of another caller to consume it, default payout asset/balance, raw-token claim balance, `TokensClaimed`, and zero remaining allocation. Both sending-wallet and calldata-only claims are exercised. Unsigned gated swaps revert. A deliberately impossible output minimum reverts without referral credit; the original signed authorization remains usable after rollback.

Direct-payout branches are also tested for ordinary buy/sell scenarios: a local owner impersonation sets the referral escrow to zero inside a snapshot, verifies the resolved direct configuration, `ReferrerFeePaid` and the recipient's balance increase, then reverts the snapshot. This is a contract-path test, not a change to live fee routing.

| Chain        | Tested hook                                  | Tested escrow                                | Tested spend gate                            |
| ------------ | -------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| Base         | `0x588c683ecc450f8b2aadb13d7f63792b840425dc` | `0xE86BFeBC4F094D36074833618779D279a9Af01Aa` | `0xd8e46a2ca31915d9b76cc8e6b365b7ed46b77b01` |
| Robinhood    | `0x8d346f24278c5cd786309161aac0fc2bbe4c25dc` | `0xB9827C0c7Cb61be4D58700B114E34D8448889eD8` | `0x120a2e0f8f431136897dc78c24b069146a65d79a` |
| Base Sepolia | `0x8d346f24278c5cd786309161aac0fc2bbe4c25dc` | `0x7c6088c1185fbb770deb1ca7ddeed4ba57659663` | `0x54cdcf0bcbc3a33f470e07134c10582f93058a32` |

## Limits and deployment finding

EOA execution is verified. Full 4337/7702 relay execution, arbitrary ERC20-backed wrappers, deliberately paused wrappers and every historical hook/escrow deployment were not independently fork-tested. Legacy address/ABI compatibility and wrapper overload selection are covered by package tests; native and flETH wrapper rewards are covered by deployed-contract tests. No hosted indexing or USD analytics are certified.

At live Base block **51,040,456**, the current hook's spend gate `0xd8e46a2ca31915d9b76cc8e6b365b7ed46b77b01` returned **false** for `approvedRouters(0x1B8065a099AdcD7aa7c5e241e3596B56ec98bA5a)`. Direct EOA submissions still pass because buyer binding accepts `tx.origin`. A relayed buyer using this gate needs its owner to approve that router. This is a separate configuration finding, not a reversal of the completed protected-router migration; older rollout notes named a different gate. The SDK does not change that approval or claim relayed support for it.

## Reproduce

Start Anvil with a supported chain's RPC as the upstream and `--chain-id 31337 --port 18565 --silent`. Then, from the built SDK checkout:

```sh
REFERRAL_LOCAL_FORK=1 \
REFERRAL_CHAIN_ID=8453 \
REFERRAL_FORK_RPC=http://127.0.0.1:18565 \
REFERRAL_GATE=0xd8e46a2ca31915d9b76cc8e6b365b7ed46b77b01 \
REFERRAL_TEST_DIRECT=1 \
node scripts/test-referrals-fork.cjs
```

The script refuses non-local RPC URLs and verifies chain ID 31337 before sends. Set `REFERRAL_FORK_RESULTS` to save JSON evidence. Substitute the chain and gate from the table for the other networks. Omit `REFERRAL_GATE` to test ordinary pools only; omit `REFERRAL_TEST_DIRECT` to avoid the temporary local owner configuration tests.
