# SDK release checks

Use the Node version in `.nvmrc` and the pinned `packageManager`. CI builds and tests the package but never publishes it.

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck && pnpm test`
3. `pnpm test:package` (isolated CJS/ESM consumers and NodeNext/Bundler declarations)
4. `pnpm audit --audit-level=moderate`
5. Rehearse supported launch/swap paths on an isolated fork; record source commit and artifact integrity.
6. Confirm the version is unused. After changing it, repeat the package checks. Publishing is a separate operator-approved action.

The package-consumer check performs no network or contract writes beyond downloading npm dependencies. It does not run installation lifecycle scripts or publish. Its localhost URL is a type fixture and receives no calls.

For the legacy 0.12.1 fork rehearsal, start Anvil bound to `127.0.0.1:18545`, with chain ID 31337 and a read-only Base RPC fork at block 50955156. Run `RELEASE_LOCAL_FORK=1 node scripts/rehearse-local-fork.cjs` and `RELEASE_LOCAL_FORK=1 node scripts/rehearse-local-splits.cjs`. These scripts refuse writes unless the RPC chain ID is 31337 and use only synthetic local accounts. Reports are generated as `.release-*.json` (or `RELEASE_FORK_RESULTS`). Native/flETH launch, buy/sell, supply/event decoding and static 60/40 and 0/100 splits are covered; browser wallet integration and new-launch indexing are not. Do not use this legacy-router happy-path harness as a protected 0.13.0 router certification.

For direct viem consumers, configure `createPublicClient({ chain: base as Chain, transport })`, importing `type Chain` from viem. The SDK currently accepts generic PublicClient; a narrowly inferred Base client includes chain-specific deposit transaction types and may be incompatible. No assertion on the client itself or `any` is necessary. The clean consumer check covers this supported setup; it does not claim all custom chain formatter types work.

The site remains on published 0.12.0 until a separately reviewed consumer update. Candidate 0.12.1 is not a protected-router rollout. Protected swaps require compatible deployed and approved routers and explicit integration into the site's direct V2 swap path; an npm update alone is insufficient.
