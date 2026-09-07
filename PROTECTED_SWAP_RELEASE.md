# Protected-swap release gate

## Verified status — 7 September 2026

- Integrated SDK #23's merged master baseline without changing production router mappings.
- Companion contract commits `fee736b` and `c8bfd26` are prepared locally on `fix/protected-exact-input-release` in `/private/tmp/reflaunch-protected-contracts-review`. Remote push was denied by the execution approval policy; no companion PR or deployed router is claimed.
- Dedicated router tests: 15 passed, including 256 fuzz cases, real pool settlement, hook-adjusted output, spend-cap rollback, native refunds and atomic acquisition rollback. Another 75 spend-gate tests passed. The historical Robinhood fork test is unverified because the public RPC returned missing historical state at block 27563803.
- The deployment script restricts the initial rollout to Base Sepolia and its pinned PoolManager. Its Sepolia simulation passed (2,111,872 estimated gas). No broadcast or gate approval occurred; the simulator's predicted address is not a real deployment.
- `scripts/rehearse-protected-sepolia.mjs` passed on a disposable Anvil fork at `127.0.0.1:18547`: deployed the actual router artifact, patched its sole PoolManager immutable to independently verify the entire runtime, impersonated the recorded owner locally, approved both gates and passed the three-hook readiness checker. Runtime hash: `0xc301509b6265a17928e37b58f0ed24b42496a71a41ee909cf11c4be17f52ffb3`. The script rejects non-Anvil endpoints and has a fixed loopback RPC. All transactions stayed on the local fork; no testnet or production state changed.
- At Sepolia block 46503112, both mapped routers lacked `exactInputVersion`. Both spend gates are owned by `0xB8A70b4d1547bf6193bd67A73F4F98ea9FD0A973`. Gate addresses are `0x2c9127654ded3b6b2ba017e84f44b02cafdf9f55` (older hooks) and `0x54cdcf0bcbc3a33f470e07134c10582f93058a32` (current hook). Read evidence is in `release-evidence/sepolia-router-readiness-2026-09-07.json`.

Run `node scripts/check-protected-sepolia.mjs` after building. It checks chain ID, bytecode hash, router API, PoolManager, dispatcher registration and gate approvals at one block; it exits nonzero when readiness is unproven. To validate a newly deployed candidate before editing SDK maps, set `PROTECTED_ROUTER` and `PROTECTED_ROUTER_CODEHASH` to the address and runtime hash independently verified against the reviewed build. It emits approval calldata but never signs or sends transactions.

Remaining external steps: authorize the companion contracts push, select a funded Sepolia deployment signer, and have the owner above approve the new router on both gates. Then verify the deployed build and approvals, update SDK/gate mappings, exercise the feature branch on Sepolia, and complete the production-chain matrix before any 0.13.0 npm release.

This branch is not ready to publish. Existing address maps still include legacy routers; the protected planner intentionally rejects routers without `exactInputVersion` support.

Release in this order:

1. Review the companion contract changes and link their PR. Verify full input consumption, quote-derived minimum net output, expiry, buyer binding and refunds on fork/testnet.
2. Deploy approved routers and verify bytecode and hook-to-router mappings on each supported chain, including superseded hooks. Update gate approvals before enabling consumers.
3. Update this SDK's address maps; run the packaged-artifact suite and supported-chain fork matrix. CI typecheck is necessary but not execution evidence.
4. Upgrade the ordinary frontend swap implementation and Game Mode host together. Main's raw V2 implementation does not become protected merely by installing a newer SDK.
5. Execute the same quote-backed plan presented to the user. Acquire-and-swap compositions must be atomic wherever the product promises one purchase. Report actual fills; unobserved receipts must not invite duplicate spending or be represented as confirmed fills.

Do not publish a package claiming compatibility with legacy routers, do not change only the frontend version, and do not roll back to an unprotected route. Disable affected routes when protection cannot be established.

SDK #23 is independent legacy launch maintenance and does not provide v1.3 manager-launch parity. Merge/release it separately before rebasing this release candidate.
