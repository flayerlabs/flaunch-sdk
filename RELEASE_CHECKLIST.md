# SDK release checks

Use the Node version in `.nvmrc` and the pinned `packageManager`. CI builds and tests the package but never publishes it.

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck && pnpm test`
3. `pnpm test:package` (isolated CJS/ESM consumers and NodeNext/Bundler declarations)
4. `pnpm audit --audit-level=moderate`
5. Rehearse supported launch/swap paths on an isolated fork; record source commit and artifact integrity.
6. Confirm the version is unused. After changing it, repeat the package checks. Publishing is a separate operator-approved action.

The package-consumer check performs no network or contract writes beyond downloading npm dependencies. It does not run installation lifecycle scripts or publish. Its localhost URL is a type fixture and receives no calls.

For direct viem consumers, configure `createPublicClient({ chain: base as Chain, transport })`, importing `type Chain` from viem. The SDK currently accepts generic PublicClient; a narrowly inferred Base client includes chain-specific deposit transaction types and may be incompatible. No assertion on the client itself or `any` is necessary. The clean consumer check covers this supported setup; it does not claim all custom chain formatter types work.

The site remains on published 0.12.0 until a separately reviewed consumer update. Candidate 0.12.1 is not a protected-router rollout. Protected swaps require compatible deployed and approved routers and explicit integration into the site's direct V2 swap path; an npm update alone is insufficient.
