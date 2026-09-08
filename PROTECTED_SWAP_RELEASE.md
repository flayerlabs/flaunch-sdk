# Protected-swap release gate

## Verified status — 7 September 2026

- Integrated SDK #23's merged master baseline without changing production router mappings.
- Companion contract commits `fee736b` and `c8bfd26` are pushed for review in draft [contracts #301](https://github.com/flayerlabs/flaunch-contracts/pull/301). The deployment script is Base-Sepolia-only; production routers remain a separate release gate.
- Dedicated router tests: 15 passed, including 256 fuzz cases, real pool settlement, hook-adjusted output, spend-cap rollback, native refunds and atomic acquisition rollback. Another 75 spend-gate tests passed. The historical Robinhood fork test is unverified because the public RPC returned missing historical state at block 27563803.
- The deployment script restricts the initial rollout to Base Sepolia and its pinned PoolManager. Its Sepolia simulation passed (2,111,872 estimated gas). No broadcast or gate approval occurred; the simulator's predicted address is not a real deployment.
- `scripts/rehearse-protected-sepolia.mjs` passed on a disposable Anvil fork at `127.0.0.1:18547`: deployed the actual router artifact, patched its sole PoolManager immutable to independently verify the entire runtime, impersonated the recorded owner locally, approved both gates and passed the three-hook readiness checker. Runtime hash: `0xc301509b6265a17928e37b58f0ed24b42496a71a41ee909cf11c4be17f52ffb3`. The script rejects non-Anvil endpoints and has a fixed loopback RPC. All transactions stayed on the local fork; no testnet or production state changed.
- At Sepolia block 46503112, both mapped routers lacked `exactInputVersion`. Both spend gates are owned by `0xB8A70b4d1547bf6193bd67A73F4F98ea9FD0A973`. Gate addresses are `0x2c9127654ded3b6b2ba017e84f44b02cafdf9f55` (older hooks) and `0x54cdcf0bcbc3a33f470e07134c10582f93058a32` (current hook). Read evidence is in `release-evidence/sepolia-router-readiness-2026-09-07.json`.

Run `node scripts/check-protected-sepolia.mjs` after building. It checks chain ID, bytecode hash, router API, PoolManager, dispatcher registration and gate approvals at one block; it exits nonzero when readiness is unproven. To validate a newly deployed candidate before editing SDK maps, set `PROTECTED_ROUTER` and `PROTECTED_ROUTER_CODEHASH` to the address and runtime hash independently verified against the reviewed build. It emits approval calldata but never signs or sends transactions.

## Authorized Sepolia-only deployment — 2026-09-07

Router `0xb32a99502f433f78454a4d20304e654cdda75c5c` was deployed by
`0xB8A70b4d1547bf6193bd67A73F4F98ea9FD0A973` on chain 84532, block 46504001.
Deployment transaction: `0x134ce59a452da68a434244b55d7dd13414538bd5b40cfcb42942d53d764e1e15`.
The entire runtime matches the reviewed compiled artifact after resolving its sole
PoolManager immutable. Runtime hash:
`0xc301509b6265a17928e37b58f0ed24b42496a71a41ee909cf11c4be17f52ffb3`.
`manager()` and `exactInputVersion() == 1` were read back successfully.

Both existing Sepolia gates approved this router, preserving previous approvals:

- `0x2c9127654ded3b6b2ba017e84f44b02cafdf9f55`: transaction
  `0xf212b8673e7f2c2923d2da59a485f204caba90527e6807b827c321eae33b4ddd`, block 46504020.
- `0x54cdcf0bcbc3a33f470e07134c10582f93058a32`: transaction
  `0x6d4db09350a4265940e59cd4265a68fb49a8237c28faa7c01fc57a1ffe01b8cd`, block 46504023.

At the time of the Sepolia rollout only Sepolia router mappings had changed; the production
routers below were deployed on 2026-09-08. No npm publication has occurred.
The rebuilt SDK's default mappings passed the on-chain readiness checker for all
three hooks at block 46504128. Frontend native-ETH and flETH integration runs both
passed against this router: launch, signed Game Mode flow, two buys, ERC20 approvals
where required, and matching database/on-chain spend. These runs use the preview's
existing pinned SDK artifact with an explicit router override, not a new npm release.
Updated SDK artifacts pass all 115 tests. The local Node 24 Rollup process again
emitted every bundle but did not exit; it was interrupted after final bundle output.
The initial test attempt while the final bundle was still building failed its
package export check; rerunning after all bundles existed passed all 115 tests.
The frontend's earlier preview override `0x6aF705b1b82f0A74C19D1c468794287AdceA94Ee`
was an earlier deployment of identical runtime; the earlier legacy-mapping checker
did not inspect it. Today's deployment is an additional instance, not a core upgrade.

Remaining external steps: approve the companion contracts review, validate the
combined wallet/browser feature journey, and complete the
production-chain matrix before any 0.13.0 npm release. Production deployments
are not authorized by this Sepolia-only rollout.

## Production routers (2026-09-08, flaunch-contracts v1.3.4, PR #302)

| Chain | Router | Deployment | Verification |
| --- | --- | --- | --- |
| Base (8453) | `0x1B8065a099AdcD7aa7c5e241e3596B56ec98bA5a` | tx `0xf00c94da334553b4c14a7788e74f94140c51f232141ac6a66343f88fa930ba83`, block 51035669 | Basescan-verified; `exactInputVersion() == 1`; `manager()` = `0x498581fF…2b2b` |
| Robinhood (4663) | `0xD33dD3B3Aea607F2cC38cdd154eF5d48847Aa764` | tx `0xb1974d698d9b9bf1a3b3fda66b39732dacc6ed77245da6417b115f20ff542fad`, block 57595126 | Sourcify exact match; `exactInputVersion() == 1`; `manager()` = `0x8366a39C…0951` |

Both runtimes are byte-identical to each other and to the Base Sepolia router outside the CBOR
metadata trailer (the metadata hash differs because comment-only lines were added to the source
before the production compile). The address maps in this candidate now point every hook
generation on Base and Robinhood at these routers; the legacy routers `0xafD627…`, `0x92D2dF…`
and `0x8476ED…` are no longer mapped.

**Publish gate (met 2026-09-08).** Each spend gate approves its chain's new router (read back as
`approvedRouters(router) == true`) and a buy and sell have settled through it on a fork of each chain:

| Gate | Chain | Owner | Approval |
| --- | --- | --- | --- |
| `0xBdbF379f9EdFB5993FC00b41AAEfeE8475eAC0Ac` (v1.3.1 PM `0x588c…`) | Base | `0xB8A70b4d…A973` | tx `0x0dff82d2…e7aa`, block 51037249 |
| `0x120a2e0f8f431136897dc78c24b069146a65d79a` (v1.3.3 PM `0x8d34…`) | Robinhood | `0xB8A70b4d…A973` | tx `0x018de7d4…4b43`, block 57624911 |
| `0xB246b270bB05d9Fa76c4456408ce3e8600d916bf` (v1.3.1 PM `0x588c…` / AnyPM `0x6ea0…`) | Robinhood | `0xB8A70b4d…A973` | tx `0xb7aabb94…c88d`, block 57627582 |

Legacy approvals stay in place during migration.

**Canary evidence (2026-09-08, Anvil forks of the live chains, deployer impersonated, no broadcast).**
Against the deployed routers and real v1.3 pools, the full round trip settled on both chains:

| Chain (fork block) | Pool | Buy | Protection checks | Sell |
| --- | --- | --- | --- | --- |
| Robinhood 4663 (57638009) | V133C `0x411bE1f7…` on v1.3.3 PM, flETH-paired | 0.001 flETH consumed exactly; `ExactInputSwap(sender=deployer, amountIn=1e15)` emitted | tight price limit → `PartialFill` (`0x20aae256`); minimum above delivered → `InsufficientOutput` (`0x2c19b8b8`); past deadline → `Expired` (`0x203d82d8`) | all coins sold back; router holds 0 flETH / 0 coins |
| Base 8453 (51037962) | VBVF `0xe0fe1FAA…` on v1.3.1 PM, flETH-paired | 0.0005 flETH consumed exactly; `ExactInputSwap` emitted | `InsufficientOutput`, `Expired` as above | all coins sold back; router holds 0 / 0 |

Both pools were ungated (no trusted signer) so `hookData` was empty; the gated path through these
routers is covered by the Robinhood fork suite in flaunch-contracts (`SpendGatedRobinhoodFork.t.sol`,
`test_ForkProtectedRouter*`). Live-chain canary transactions were deliberately not sent.

Release in this order:

1. Review the companion contract changes and link their PR. Verify full input consumption, quote-derived minimum net output, expiry, buyer binding and refunds on fork/testnet.
2. Deploy approved routers and verify bytecode and hook-to-router mappings on each supported chain, including superseded hooks. Update gate approvals before enabling consumers.
3. Update this SDK's address maps; run the packaged-artifact suite and supported-chain fork matrix. CI typecheck is necessary but not execution evidence.
4. Upgrade the ordinary frontend swap implementation and Game Mode host together. Main's raw V2 implementation does not become protected merely by installing a newer SDK.
5. Execute the same quote-backed plan presented to the user. Acquire-and-swap compositions must be atomic wherever the product promises one purchase. Report actual fills; unobserved receipts must not invite duplicate spending or be represented as confirmed fills.

Do not publish a package claiming compatibility with legacy routers, do not change only the frontend version, and do not roll back to an unprotected route. Disable affected routes when protection cannot be established.

SDK #23 is independent legacy launch maintenance and does not provide v1.3 manager-launch parity. Merge/release it separately before rebasing this release candidate.
