---
name: flaunch-sdk
description: Integrate @flaunch/sdk in TypeScript apps to read protocol data, launch coins, trade, manage Permit2 approvals, add liquidity, import tokens, and monitor events on Base and Base Sepolia.
---

# Flaunch SDK Skill

Use this skill when the user needs to build, debug, or review app code using `@flaunch/sdk`.

## Staying Current

- Treat [llms-full.txt](https://github.com/flayerlabs/flaunch-sdk/blob/master/llms-full.txt) as the canonical SDK reference for methods and examples.
- Use the [README](https://github.com/flayerlabs/flaunch-sdk/blob/master/README.md) for integration examples and common recipes.
- If method names or signatures are unclear, check [src](https://github.com/flayerlabs/flaunch-sdk/tree/master/src).

## Scope

This skill is for SDK integration work, not product-specific ops runbooks.

- In scope: app integration patterns, SDK method selection, quote/tx/event flows, Permit2 and liquidity workflows.
- Out of scope by default: org-specific API backends, Discord/Twitter automations, private infra, and hardcoded manager addresses unless user explicitly asks.

## Workflow Selection

Pick the smallest workflow that satisfies the user request:

1. `setup-read` for read-only analytics or metadata.
2. `setup-write` for transactions.
3. `launch` for creating a memecoin pool.
4. `trade-buy-sell` for swaps and quote flows.
5. `permit2-sell` for approval-light selling.
6. `liquidity` for add-liquidity planning and calldata.
7. `import` for external token import and post-import liquidity.
8. `events` for watchers and polling loops.
9. `calldata-mode` for AA, relayers, or batched execution.
10. `troubleshoot` for reverts, mismatched chain/state, and version issues.

## Guardrails

- Never execute write actions without a `walletClient` bound to the intended chain.
- Always verify network first: Base vs Base Sepolia mismatch is a common root cause.
- Run quote/preflight methods before swap or liquidity writes.
- For launches, validate required metadata fields and image encoding before calling `flaunchIPFS`.
- For Permit2 flows, check allowance/nonce and typed-data domain prior to signing.
- Parse receipts/logs after writes to confirm outcomes; do not assume success from tx submission alone.
- Prefer calldata-returning methods when users need transaction building without immediate broadcast.

## Core Workflows

### 1) setup-read

Goal: initialize a read-only SDK safely.

1. Create a Viem `publicClient` on user-selected chain.
2. Call `createFlaunch({ publicClient })`.
3. Verify connectivity with one low-risk read such as `getCoinMetadata`, `getFlaunchAddress`, or `getMarketContext`.

Deliverables:

- Minimal client setup snippet.
- One verification read and expected return shape.

### 2) setup-write

Goal: enable state-changing SDK actions.

1. Reuse the read setup.
2. Add `walletClient` and instantiate read-write SDK.
3. Confirm signer address and chain before presenting any write call.

Deliverables:

- Typed setup pattern for read/write SDK instance.
- Preflight checklist before writes.

### 3) launch

Goal: launch a new token correctly and extract resulting identifiers.

1. Prepare launch params (`name`, `symbol`, metadata, market cap, launch settings).
2. Validate image as base64 data URL when using metadata image upload path.
3. Execute `flaunchIPFS` (or relevant `flaunch*` variant).
4. Parse result with `getPoolCreatedFromTx` and return memecoin + tokenId.

Deliverables:

- Launch call snippet with sane defaults.
- Post-launch parsing snippet.

### 4) trade-buy-sell

Goal: buy/sell with predictable slippage and result parsing.

1. Compute quote first (`getBuyQuote...` or `getSellQuote...`).
2. Execute `buyCoin` or `sellCoin` with explicit slippage controls.
3. Parse swap outcomes with parse helpers (`parseSwapTx`, related log parsing).

Deliverables:

- Quote-first transaction flow.
- Parsed swap output shape and interpretation.

### 5) permit2-sell

Goal: sell using Permit2 rather than standalone token approval flow.

1. Check existing Permit2 allowance (`getERC20AllowanceToPermit2` and nonce helpers as needed).
2. Build typed data (`getPermit2TypedData`) and sign it.
3. Execute permit-aware sell path and parse logs.

Deliverables:

- End-to-end Permit2 signing + sell snippet.
- Common error checks (deadline, nonce, chain/domain mismatch).

### 6) liquidity

Goal: add liquidity safely for flaunch/imported tokens.

1. Compute ticks/amounts (`calculateAddLiquidityTicks`, `calculateAddLiquidityAmounts`).
2. Validate sidedness constraints (`checkSingleSidedAddLiquidity`) if applicable.
3. Build calls (`getAddLiquidityCalls`, single-sided or batch variants) and execute or return calldata.

Deliverables:

- Calculation step + call-building step.
- Guidance on choosing exact-amount vs market-cap/price-driven paths.

### 7) import

Goal: import external token into flaunch ecosystem and optionally add liquidity.

1. Pre-verify token/import status (`tokenImporterVerifyMemecoin`, `isMemecoinImported`).
2. Execute `importMemecoin`.
3. Optionally compose immediate liquidity via `getImportAndAddLiquidityCalls` or single-sided variant.

Deliverables:

- Safe import sequence.
- Optional one-shot import+liquidity batch flow.

### 8) events

Goal: support realtime UX/bots/indexers around pool lifecycle and swaps.

1. For near-realtime app UX, use `watchPoolCreated`/`watchPoolSwap`.
2. For resilient backend loops, pair with `pollPoolCreatedNow`/`pollPoolSwapNow`.
3. Normalize parsed output for app consumption.

Deliverables:

- Watcher setup with unsubscribe handling.
- Polling fallback strategy.

### 9) calldata-mode

Goal: support smart accounts, relayers, or external executors.

1. Prefer `createFlaunchCalldata` and related call-build helpers.
2. Return `{ to, data, value }` plus user-safe notes on signer, chain, and expected effects.
3. Avoid submitting tx directly unless user asks.

Deliverables:

- Calldata generation snippet.
- Validation checklist before external execution.

### 10) troubleshoot

Goal: quickly isolate failing integration paths.

Check in this order:

1. Chain mismatch and wrong address set.
2. Read-only vs read-write instance confusion.
3. Invalid token/pool state (`isValidCoin`, version detection helpers).
4. Missing allowance/approval (including Permit2).
5. Parameter bounds and deadline/slippage issues.
6. Event parsing against wrong tx hash or stale block range.

Deliverables:

- Concise diagnosis summary.
- Minimal patch or corrected call sequence.

## Output Expectations

When using this skill, prefer responses that include:

1. A minimal working snippet for the chosen workflow.
2. Required inputs and preconditions.
3. One verification step (read or parsed receipt/event).
4. One common failure mode and mitigation.

## Reference Map

Use these files as needed; do not duplicate large sections into responses.

- SDK repository: [flaunch-sdk](https://github.com/flayerlabs/flaunch-sdk)
- Full SDK reference: [llms-full.txt](https://github.com/flayerlabs/flaunch-sdk/blob/master/llms-full.txt)
- Integration guide: [README.md](https://github.com/flayerlabs/flaunch-sdk/blob/master/README.md)
- Package metadata/scripts: [package.json](https://github.com/flayerlabs/flaunch-sdk/blob/master/package.json)
- Source of truth for SDK method implementations: [src](https://github.com/flayerlabs/flaunch-sdk/tree/master/src)
- Protocol contracts repository: [flaunchgg-contracts](https://github.com/flayerlabs/flaunchgg-contracts)
