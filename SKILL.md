---
name: flaunch-sdk
description: Integrate @flaunch/sdk in TypeScript apps to read protocol data, launch coins, trade, manage Permit2 approvals, add liquidity, import tokens, and monitor events on Base and Base Sepolia.
---

# Flaunch SDK Skill

Use this skill when the user needs to build, debug, or review app code using `@flaunch/sdk`.

## Staying Current

- Treat [llms-full.txt](https://raw.githubusercontent.com/flayerlabs/flaunch-sdk/refs/heads/master/llms-full.txt) as the canonical extended SDK reference when available.
- Use the [README](https://raw.githubusercontent.com/flayerlabs/flaunch-sdk/refs/heads/master/README.md) for integration examples and common recipes.
- If method names or signatures are unclear, check [src](https://github.com/flayerlabs/flaunch-sdk/tree/master/src).

## Embedded SDK Essentials (Standalone Use)

This section captures the minimum `llms-full.txt` context needed for most builder integrations, so this skill remains useful even when the large reference file is not available.

### What the SDK is for

`@flaunch/sdk` is the TypeScript integration layer for Flaunch + Uniswap V4 interactions. It helps builders:

- Launch memecoins
- Buy/sell memecoins
- Read coin/pool/fair launch data
- Use Permit2 for sell flows
- Build liquidity/import calls
- Watch and parse protocol events
- Build calldata for external executors / smart accounts

### Supported chains

- Base Mainnet (`base`) `8453`
- Base Sepolia (`baseSepolia`) `84532`

Always confirm chain before reads/writes. Many integration failures are chain mismatches.

### Core SDK model (read vs write)

- Read-only SDK requires `publicClient`
- Write-capable SDK requires both `publicClient` and `walletClient`
- `createFlaunch({ publicClient })` -> read workflows
- `createFlaunch({ publicClient, walletClient })` -> read + write workflows

### Common imports (baseline)

```ts
import { createFlaunch } from '@flaunch/sdk'
import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'
```

Use `ReadWriteFlaunchSDK` typing only when you specifically need write methods.

### Launch essentials (high-signal details)

- Common launch path: `flaunchIPFS(...)`
- Launch metadata image should be a valid base64 data URL (`data:image/...;base64,...`)
- Typical post-launch parse step: `getPoolCreatedFromTx(hash)`
- If parsing is delayed, use `pollPoolCreatedNow(...)`
- Return `memecoin` and `tokenId` after launch, not only tx hash

### Trade essentials (high-signal details)

- Quote first, then trade:
  - buy: `getBuyQuoteExactInput` / `getBuyQuoteExactOutput`
  - sell: `getSellQuoteExactInput`
- Execute:
  - `buyCoin(...)`
  - `sellCoin(...)`
- Parse result with `parseSwapTx({ txHash, version, flETHIsCurrencyZero })`
- `buyCoin` / `sellCoin` use `slippagePercent` (not `slippageBps`)

### Permit2 essentials (high-signal details)

- `getPermit2TypedData(coinAddress)` returns `{ typedData, permitSingle }`
- `sellCoin(...)` Permit2 flow expects `permitSingle` and `signature`
- `setERC20AllowanceToPermit2(coinAddress, amount)` is for external tokens when Permit2 allowance is insufficient

### Liquidity/import essentials (high-signal details)

- `getAddLiquidityCalls(...)` returns executable call objects (with descriptions)
- `importMemecoin(...)` takes `coinAddress` (not `memecoin`) in params
- `tokenImporterVerifyMemecoin(...)` and `isMemecoinImported(...)` should be checked before import writes
- `getImportAndAddLiquidityCalls(...)` builds a batch import + liquidity call sequence

### Event/watcher essentials (high-signal details)

- Realtime UX: `watchPoolCreated`, `watchPoolSwap`
- Backend resilience: `pollPoolCreatedNow`, `pollPoolSwapNow`
- Always include cleanup/unsubscribe in frontend examples

## Scope

This skill is for SDK integration work, not product-specific ops runbooks.

- In scope: app integration patterns, SDK method selection, quote/tx/event flows, Permit2 and liquidity workflows.
- Out of scope by default: org-specific API backends, Discord/Twitter automations, private infra, and hardcoded manager addresses unless user explicitly asks.

## Task Router (Intent -> Workflow -> Inputs -> Methods)

Use this before reading the full workflow sections.

| User intent | Workflow | Minimum inputs | Primary methods |
|---|---|---|---|
| Read coin metadata / info | `setup-read` | `chain`, `publicClient`, `coinAddress` | `createFlaunch`, `getCoinMetadata`, `getCoinInfo` |
| Launch a creator coin | `setup-write` + `launch` | `chain`, `publicClient`, `walletClient`, launch params, metadata | `flaunchIPFS`, `getPoolCreatedFromTx` |
| Buy a coin | `setup-write` + `trade-buy-sell` | `chain`, clients, `coinAddress`, amount, slippage | `getBuyQuoteExactInput/Output`, `buyCoin`, `parseSwapTx` |
| Sell a coin | `setup-write` + `trade-buy-sell` | `chain`, clients, `coinAddress`, `amountIn`, slippage | `getSellQuoteExactInput`, `sellCoin`, `parseSwapTx` |
| Sell with Permit2 | `setup-write` + `permit2-sell` | above + permit signature data | `getPermit2TypedData`, `getPermit2AllowanceAndNonce`, `sellCoin` |
| Add liquidity | `setup-write` + `liquidity` | `chain`, clients, `coinAddress`, liquidity params | `calculateAddLiquidity*`, `getAddLiquidityCalls` |
| Import token to flaunch | `setup-write` + `import` | `chain`, clients, `coinAddress`, import params | `tokenImporterVerifyMemecoin`, `isMemecoinImported`, `importMemecoin` |
| Import + add liquidity batch | `setup-write` + `import` + `liquidity` | above + liquidity params | `getImportAndAddLiquidityCalls` |
| Watch launch/swap events | `events` | `chain`, active SDK instance, callback | `watchPoolCreated`, `watchPoolSwap`, `pollPool*Now` |
| Build calldata only | `calldata-mode` | `chain`, call params | `createFlaunchCalldata`, call-build helpers |
| Debug failing integration | `troubleshoot` | failing call, chain, params, tx hash if any | `isValidCoin`, `getCoinVersion`, parsing + quote helpers |

## Do / Don't (LLM Safety)

Do:

- Use exact current field names from SDK types (`coinAddress`, `slippagePercent`, `swapType`)
- Quote before write for trade/liquidity flows
- Confirm chain and client setup before write examples
- Return parsed outcomes (`memecoin`, `tokenId`, parsed swap logs) not just `txHash`
- Mark assumptions when placeholders are used

Don't:

- Use shorthand placeholders that look like real params (`coin` instead of `coinAddress`)
- Call `parseSwapTx(txHash)` directly (use object form)
- Treat `pollPool*Now` as data-returning methods
- Omit slippage/deadline/approval discussion in write flows
- Assume Base when the user has not specified chain

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
- When giving examples, prefer exact current SDK field names (for example `coinAddress`, `slippagePercent`, `swapType`) over shorthand placeholders.

## Minimum Required Inputs Matrix

| Workflow | `chain` | `publicClient` | `walletClient` | `coinAddress` | Slippage | Version | Approval / Permit |
|---|---:|---:|---:|---:|---:|---:|---:|
| `setup-read` | Yes | Yes | No | Optional | No | Optional | No |
| `setup-write` | Yes | Yes | Yes | No | No | No | No |
| `launch` | Yes | Yes | Yes | No | Optional | Optional | No |
| `trade-buy-sell` (buy) | Yes | Yes | Yes | Yes | Yes | Optional | Sometimes |
| `trade-buy-sell` (sell) | Yes | Yes | Yes | Yes | Yes | Optional | Yes (Permit2 path) |
| `permit2-sell` | Yes | Yes | Yes | Yes | Yes | Optional | Yes |
| `liquidity` | Yes | Yes | Yes | Yes | Recommended | Optional | Usually |
| `import` | Yes | Yes | Yes | Yes | No | Optional | No |
| `events` | Yes | Usually | No | Optional | No | Often | No |
| `calldata-mode` | Yes | Optional | No | Depends | Depends | Optional | Depends |

## Quick Start Paths (Builder-Focused)

Use these when a builder asks to "get something working" quickly.

### A) Read-Only Integration (fastest path)

Required inputs:

- Chain (`base` or `baseSepolia`)
- `coinAddress` (if reading coin-specific data)
- Optional RPC URL

Minimum outcome:

- `createFlaunch({ publicClient })` works
- At least one read returns expected data

Starter snippet:

```ts
import { createFlaunch } from '@flaunch/sdk'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.RPC_URL),
})

const flaunch = createFlaunch({ publicClient })
const metadata = await flaunch.getCoinMetadata('0x...')
console.log(metadata)
```

Common mistakes:

- Wrong chain for the token address (Base vs Base Sepolia)
- Passing a write-only expectation into a read-only setup (no `walletClient`)

### B) Write-Enabled Integration (launch/trade/liquidity)

Required inputs:

- Chain (`base` or `baseSepolia`)
- `publicClient`
- `walletClient` on the same chain
- User wallet connected and funded for gas

Minimum outcome:

- Read-write SDK instance initializes
- Signer address and chain are confirmed before calling a write method

Starter snippet:

```ts
import { createFlaunch, type ReadWriteFlaunchSDK } from '@flaunch/sdk'

const flaunch = createFlaunch({
  publicClient,
  walletClient,
}) as ReadWriteFlaunchSDK

const [walletChainId, [account]] = await Promise.all([
  walletClient.getChainId(),
  walletClient.getAddresses(),
])

if (walletChainId !== publicClient.chain.id) {
  throw new Error('wallet/public client chain mismatch')
}

console.log('Signer:', account)
```

Common mistakes:

- `walletClient` connected to a different chain than `publicClient`
- Calling `buyCoin`/`flaunchIPFS` on an SDK instance created without `walletClient`

### C) Launch a Coin (happy path)

Required inputs:

- Read-write SDK instance
- `name`, `symbol`, `creator`
- Launch settings (`fairLaunchPercent`, duration, market cap)
- Metadata (`base64Image`, description)

Minimum outcome:

- Tx hash returned from `flaunchIPFS`
- Pool creation parsed via `getPoolCreatedFromTx`

Common mistakes:

- Invalid `base64Image` format (must be a valid data URL when using upload path)
- Omitting post-tx parse step and failing to return `memecoin` / `tokenId`

### D) Buy / Sell (quote-first)

Required inputs:

- Read-write SDK instance
- Coin address
- Trade amount and side
- Slippage/deadline policy

Minimum outcome:

- Quote computed first
- Write executed
- Swap parsed from tx/logs

Common mistakes:

- Executing trade without quote/preflight
- Slippage too tight for current pool state

## Response Pattern (What to Return to Builders)

For builder-facing answers, default to this shape:

1. Prerequisites (chain, clients, env vars, addresses).
2. Minimal working code snippet.
3. Verification step (read result or parsed event/receipt).
4. Common failure mode and fix.
5. Optional next step (e.g., Permit2, liquidity, watchers).

## Method Lookup Map (Intent -> SDK Methods)

Use this as a fast routing table before searching docs.

- Read coin metadata: `getCoinMetadata`, `getCoinInfo`, `getCoinVersion`
- Read market/price context: `getMarketContext`, `coinPriceInETH`, `coinPriceInUSD`, `coinMarketCapInUSD`
- Read fair launch state: `getFairLaunch`, `fairLaunchInfo`, `isFairLaunchActive`
- Launch coin: `flaunchIPFS`, `flaunch`, `flaunchIPFSWithRevenueManager`, `flaunchIPFSWithSplitManager`
- Parse launch result: `getPoolCreatedFromTx`, `pollPoolCreatedNow`, `watchPoolCreated`
- Buy quote: `getBuyQuoteExactInput`, `getBuyQuoteExactOutput`
- Sell quote: `getSellQuoteExactInput`
- Execute trade: `buyCoin`, `sellCoin`
- Parse trade result: `parseSwapTx`, `pollPoolSwapNow`, `watchPoolSwap`
- Permit2 prep: `getERC20AllowanceToPermit2`, `getPermit2AllowanceAndNonce`, `getPermit2TypedData`, `setERC20AllowanceToPermit2`
- Liquidity planning: `calculateAddLiquidityTicks`, `calculateAddLiquidityAmounts`, `checkSingleSidedAddLiquidity`
- Liquidity call builders: `getAddLiquidityCalls`, `getSingleSidedCoinAddLiquidityCalls`
- Import token: `tokenImporterVerifyMemecoin`, `isMemecoinImported`, `importMemecoin`
- Import + liquidity batches: `getImportAndAddLiquidityCalls`, `getImportAndSingleSidedCoinAddLiquidityCalls`
- Calldata-only flow: `createFlaunchCalldata` (+ call-building helpers)

## Verified Copy/Paste Recipes (From Current SDK Signatures)

Use these when the user asks for a concrete starting point. These examples are aligned to current public method names/argument shapes in `src/sdk/FlaunchSDK.ts`.

Confidence labels:

- `Verified Recipe`: argument names and method shapes checked against current SDK source
- `Outline`: flow is correct, but params may need adaptation to the user’s exact version/setup

## Signature Index (Most Used)

Use this compact index before diving into examples.

- `buyCoin(params: BuyCoinParams, version?: FlaunchVersion)`
- `sellCoin(params: SellCoinParams, version?: FlaunchVersion)`
- `getBuyQuoteExactInput({ coinAddress, amountIn, version?, intermediatePoolKey?, hookData?, userWallet? })`
- `getBuyQuoteExactOutput({ coinAddress, amountOut, version?, intermediatePoolKey?, hookData?, userWallet? })`
- `getSellQuoteExactInput({ coinAddress, amountIn, version?, intermediatePoolKey? })`
- `parseSwapTx({ txHash, version, flETHIsCurrencyZero? })`
- `getPermit2TypedData(coinAddress, deadline?) -> { typedData, permitSingle }`
- `getPermit2AllowanceAndNonce(coinAddress) -> { allowance, nonce }`
- `setERC20AllowanceToPermit2(coinAddress, amount)`
- `importMemecoin({ coinAddress, creatorFeeAllocationPercent, initialMarketCapUSD | initialPriceUSD, verifier? })`
- `getAddLiquidityCalls(params: GetAddLiquidityCallsParams) -> CallWithDescription[]`
- `getImportAndAddLiquidityCalls(params: ImportAndAddLiquidity*) -> CallWithDescription[]`
- `watchPoolSwap(params, version?) -> { cleanup, pollPoolSwapNow }`
- `pollPoolSwapNow(version?) -> Promise<void> | undefined` (triggers callbacks)

### 1) `buyCoin` (EXACT_IN) + quote + parse

Label: `Verified Recipe`

```ts
import { createFlaunch } from '@flaunch/sdk'
import type { Address } from 'viem'

const coinAddress = '0x...' as Address

const quoteOut = await flaunch.getBuyQuoteExactInput({
  coinAddress,
  amountIn: 1000000000000000n, // 0.001 ETH (or input token via intermediatePoolKey)
})

const txHash = await flaunch.buyCoin({
  coinAddress,
  swapType: 'EXACT_IN',
  amountIn: 1000000000000000n,
  slippagePercent: 5, // 5%
})

const version = await flaunch.getCoinVersion(coinAddress)
const parsed = await flaunch.parseSwapTx({
  txHash,
  version,
  flETHIsCurrencyZero: flaunch.flETHIsCurrencyZero(coinAddress),
})

console.log({ quoteOut, txHash, parsed })
```

### 2) `sellCoin` with Permit2 (`getPermit2TypedData` + `permitSingle`)

Label: `Verified Recipe`

```ts
import { maxUint256 } from 'viem'
import type { Address } from 'viem'

const coinAddress = '0x...' as Address
const amountIn = 1_000_000n

// For external tokens (non-flaunch memecoins), approve Permit2 first if needed
const allowance = await flaunch.getERC20AllowanceToPermit2(coinAddress)
if (allowance < amountIn) {
  await flaunch.setERC20AllowanceToPermit2(coinAddress, maxUint256)
}

const { typedData, permitSingle } = await flaunch.getPermit2TypedData(coinAddress)
const signature = await walletClient.signTypedData(typedData)

const quoteOut = await flaunch.getSellQuoteExactInput({
  coinAddress,
  amountIn,
})

const txHash = await flaunch.sellCoin({
  coinAddress,
  amountIn,
  slippagePercent: 5,
  permitSingle,
  signature,
})

const version = await flaunch.getCoinVersion(coinAddress)
const parsed = await flaunch.parseSwapTx({
  txHash,
  version,
  flETHIsCurrencyZero: flaunch.flETHIsCurrencyZero(coinAddress),
})

console.log({ quoteOut, txHash, parsed })
```

### 3) `getAddLiquidityCalls` (market cap constrained)

Label: `Verified Recipe`

```ts
import { LiquidityMode } from '@flaunch/sdk'
import { parseEther } from 'viem'
import type { Address } from 'viem'

const coinAddress = '0x...' as Address

const calls = await flaunch.getAddLiquidityCalls({
  coinAddress,
  liquidityMode: LiquidityMode.CONCENTRATED,
  coinOrEthInputAmount: parseEther('1'),
  inputToken: 'eth',
  minMarketCap: '10000',
  maxMarketCap: '100000',
  initialMarketCapUSD: 50000,
  slippagePercent: 5,
})

console.log(calls) // array of { to, data, value?, description? }
```

### 4) `importMemecoin` (direct write)

Label: `Verified Recipe`

```ts
import { Verifier } from '@flaunch/sdk'
import type { Address } from 'viem'

const coinAddress = '0x...' as Address

const isImported = await flaunch.isMemecoinImported(coinAddress)
if (!isImported) {
  const verify = await flaunch.tokenImporterVerifyMemecoin(coinAddress)
  if (!verify.isValid) throw new Error('Coin is not importable')

  const txHash = await flaunch.importMemecoin({
    coinAddress,
    verifier: Verifier.CLANKER,
    creatorFeeAllocationPercent: 5,
    initialMarketCapUSD: 50000,
  })

  console.log({ txHash })
}
```

### 5) `getImportAndAddLiquidityCalls` (batch call builder)

Label: `Verified Recipe`

```ts
import { LiquidityMode, Verifier } from '@flaunch/sdk'
import { parseEther } from 'viem'
import type { Address } from 'viem'

const coinAddress = '0x...' as Address

const calls = await flaunch.getImportAndAddLiquidityCalls({
  coinAddress,
  verifier: Verifier.CLANKER,
  creatorFeeAllocationPercent: 5,
  liquidityMode: LiquidityMode.CONCENTRATED,
  coinOrEthInputAmount: parseEther('1'),
  inputToken: 'eth',
  minMarketCap: '10000',
  maxMarketCap: '100000',
  initialMarketCapUSD: 50000,
  slippagePercent: 5,
})

console.log(calls)
```

## Base vs Base Sepolia Debug Checklist

Run this checklist whenever a read/write behaves unexpectedly.

1. Confirm intended chain from the user (`base` vs `baseSepolia`) in plain text.
2. Check `publicClient.chain.id`.
3. Check `walletClient.getChainId()` (for write flows).
4. Verify the target coin/tx hash actually exists on that chain.
5. Confirm address constants resolve for that chain (zap, hooks, managers).
6. Retry the same verification read on the other chain only if the user is unsure.
7. Re-run parsing (`getPoolCreatedFromTx`, `parseSwapTx`) with the same tx hash on the correct chain client.

## Core Workflows

### 1) setup-read

Goal: initialize a read-only SDK safely.

1. Create a Viem `publicClient` on user-selected chain.
2. Call `createFlaunch({ publicClient })`.
3. Verify connectivity with one low-risk read such as `getCoinMetadata`, `getFlaunchAddress`, or `getMarketContext`.

Detailed steps:

1. Choose chain explicitly (`base` or `baseSepolia`) from user request.
2. Build `publicClient` with `http(<RPC_URL>)`; if no RPC is provided, mention public RPC fallback may be rate-limited.
3. Instantiate `createFlaunch({ publicClient })`.
4. Run a low-risk verification read:
   - `getCoinMetadata(coinAddress)` when a coin address is known
   - `getMarketContext(...)` for price/context workflows
   - `getFlaunchAddress()` / `getPositionManagerAddress()` for chain sanity checks
5. Return the snippet plus the expected return shape (not just "it works").

Common mistakes and fixes:

- `InvalidAddressError` or empty metadata: verify the coin exists on the selected chain.
- User asks for writes but only `publicClient` is available: switch to `setup-write`.

Deliverables:

- Minimal client setup snippet.
- One verification read and expected return shape.
- Explicit chain confirmation.

### 2) setup-write

Goal: enable state-changing SDK actions.

1. Reuse the read setup.
2. Add `walletClient` and instantiate read-write SDK.
3. Confirm signer address and chain before presenting any write call.

Detailed steps:

1. Complete `setup-read`.
2. Confirm `walletClient` exists and is connected.
3. Instantiate read-write SDK (`createFlaunch({ publicClient, walletClient })`).
4. Preflight before any write:
   - `walletClient.getChainId()` matches `publicClient.chain.id`
   - signer address exists (`walletClient.getAddresses()`)
   - user understands transaction side effects (launch, swap, approvals, etc.)
5. If building UI code, memoize the SDK instance and guard null states.

Common mistakes and fixes:

- Runtime method missing / write fails immediately: SDK instance was created without `walletClient`.
- Chain mismatch: prompt chain switch before constructing write flow.

Deliverables:

- Typed setup pattern for read/write SDK instance.
- Preflight checklist before writes.
- Minimal chain/signer verification code.

### 3) launch

Goal: launch a new token correctly and extract resulting identifiers.

1. Prepare launch params (`name`, `symbol`, metadata, market cap, launch settings).
2. Validate image as base64 data URL when using metadata image upload path.
3. Execute `flaunchIPFS` (or relevant `flaunch*` variant).
4. Parse result with `getPoolCreatedFromTx` and return memecoin + tokenId.

Detailed steps:

1. Gather required params:
   - `name`, `symbol`, `creator`
   - `initialMarketCapUSD`
   - fair launch config (`fairLaunchPercent`, `fairLaunchDuration`)
   - fee allocation (`creatorFeeAllocationPercent` or split manager path)
   - metadata payload (image + description; socials optional)
2. Validate metadata image:
   - use a base64 data URL (e.g. `data:image/png;base64,...`)
   - reject empty/partial strings before write
3. Execute one of:
   - `flaunchIPFS` (common path)
   - `flaunchIPFSWithRevenueManager` / `flaunchIPFSWithSplitManager` when needed
4. Parse tx result:
   - `getPoolCreatedFromTx(hash)`
   - return `memecoin`, `tokenId`, and key launch metadata
5. If parse is not immediately available, use `pollPoolCreatedNow` as fallback.

Minimal pattern:

```ts
const hash = await flaunch.flaunchIPFS({
  name,
  symbol,
  creator,
  fairLaunchPercent: 0,
  fairLaunchDuration: 30 * 60,
  initialMarketCapUSD: 10_000,
  creatorFeeAllocationPercent: 80,
  metadata: { base64Image, description },
})

const created = await flaunch.getPoolCreatedFromTx(hash)
if (!created) throw new Error('PoolCreated not found for launch tx')
console.log(created.memecoin, created.tokenId)
```

Common mistakes and fixes:

- `PoolCreated` parse returns `null`: wrong chain client, tx not final yet, or wrong hash.
- Launch reverts from bad params: tighten validation for market cap/duration/split values before send.

Deliverables:

- Launch call snippet with sane defaults.
- Post-launch parsing snippet.
- Required input checklist.

### 4) trade-buy-sell

Goal: buy/sell with predictable slippage and result parsing.

1. Compute quote first (`getBuyQuote...` or `getSellQuote...`).
2. Execute `buyCoin` or `sellCoin` with explicit slippage controls.
3. Parse swap outcomes with parse helpers (`parseSwapTx`, related log parsing).

Detailed steps:

1. Identify user intent: exact input vs exact output, buy vs sell.
2. Quote first:
   - `getBuyQuoteExactInput` / `getBuyQuoteExactOutput`
   - `getSellQuoteExactInput`
3. Apply explicit slippage/deadline policy (never omit this in examples).
4. Execute `buyCoin` / `sellCoin`.
5. Parse the transaction via `parseSwapTx` (or related parsing helpers) and return normalized results.

Minimal pattern:

```ts
const quote = await flaunch.getBuyQuoteExactInput({
  coinAddress,
  amountIn,
})

const txHash = await flaunch.buyCoin({
  coinAddress,
  swapType: 'EXACT_IN',
  amountIn,
  slippagePercent: 5,
})

const version = await flaunch.getCoinVersion(coinAddress)
const parsed = await flaunch.parseSwapTx({
  txHash,
  version,
  flETHIsCurrencyZero: flaunch.flETHIsCurrencyZero(coinAddress),
})

console.log({ quote, txHash, parsed })
```

Common mistakes and fixes:

- User asks "buy X USD" but code uses exact-input ETH path without conversion context.
- Quote and write separated by long delay in volatile pools; re-quote before send.

Deliverables:

- Quote-first transaction flow.
- Parsed swap output shape and interpretation.
- Slippage/deadline guidance.

### 5) permit2-sell

Goal: sell using Permit2 rather than standalone token approval flow.

1. Check existing Permit2 allowance (`getERC20AllowanceToPermit2` and nonce helpers as needed).
2. Build typed data (`getPermit2TypedData`) and sign it.
3. Execute permit-aware sell path and parse logs.

Detailed steps:

1. Check token balance and whether Permit2 allowance already exists.
2. Fetch Permit2 allowance/nonce info (`getPermit2AllowanceAndNonce`, related helpers).
3. Build typed data with `getPermit2TypedData`.
4. Sign typed data with wallet.
5. Execute sell path using permit signature.
6. Parse tx and confirm amount sold / proceeds.

Common mistakes and fixes:

- Wrong typed-data domain chainId: ensure wallet chain and SDK chain match.
- Nonce/deadline expired: fetch fresh Permit2 state and regenerate signature immediately before send.
- Using Permit2 path when token approval to Permit2 is still required: check and set allowance (`setERC20AllowanceToPermit2`) first when needed.

Minimal pattern (outline; exact params vary by sell method signature):

```ts
const permitState = await flaunch.getPermit2AllowanceAndNonce(coinAddress)

if (permitState.allowance < amountIn) {
  await flaunch.setERC20AllowanceToPermit2(coinAddress, maxUint256)
}

const { typedData, permitSingle } = await flaunch.getPermit2TypedData(coinAddress)
const signature = await walletClient.signTypedData(typedData)
// Pass `permitSingle` + `signature` into `sellCoin(...)`
```

Deliverables:

- End-to-end Permit2 signing + sell snippet.
- Common error checks (deadline, nonce, chain/domain mismatch).
- Allowance decision tree (already approved vs approve-first).

### 6) liquidity

Goal: add liquidity safely for flaunch/imported tokens.

1. Compute ticks/amounts (`calculateAddLiquidityTicks`, `calculateAddLiquidityAmounts`).
2. Validate sidedness constraints (`checkSingleSidedAddLiquidity`) if applicable.
3. Build calls (`getAddLiquidityCalls`, single-sided or batch variants) and execute or return calldata.

Detailed steps:

1. Decide liquidity mode:
   - exact token/ETH amounts
   - target price / market cap
   - single-sided coin path
2. Compute ticks/amounts:
   - `calculateAddLiquidityTicks`
   - `calculateAddLiquidityAmounts`
3. Validate constraints:
   - `checkSingleSidedAddLiquidity` for one-sided deposits
   - verify coin import/flaunch state as needed
4. Build calls:
   - `getAddLiquidityCalls`
   - `getSingleSidedCoinAddLiquidityCalls`
   - import+add-liquidity batch helpers if applicable
5. Return either calldata or an execution example depending on user request.

Common mistakes and fixes:

- Using exact-amount path with stale price assumptions; recompute near execution time.
- Single-sided request failing because pool state does not support it; run constraint check first.

Minimal pattern:

```ts
const ticks = await flaunch.calculateAddLiquidityTicks({
  coinAddress,
  // price/market cap or explicit tick inputs depending on path
})

const amounts = await flaunch.calculateAddLiquidityAmounts({
  coinAddress,
  ...ticks,
  // desired deposit inputs
})

const calls = await flaunch.getAddLiquidityCalls({
  coinAddress,
  ...amounts,
  ...ticks,
})

console.log(calls) // execute or pass to external executor
```

Deliverables:

- Calculation step + call-building step.
- Guidance on choosing exact-amount vs market-cap/price-driven paths.
- Constraint/preflight checks.

### 7) import

Goal: import external token into flaunch ecosystem and optionally add liquidity.

1. Pre-verify token/import status (`tokenImporterVerifyMemecoin`, `isMemecoinImported`).
2. Execute `importMemecoin`.
3. Optionally compose immediate liquidity via `getImportAndAddLiquidityCalls` or single-sided variant.

Detailed steps:

1. Verify token eligibility and current import state:
   - `tokenImporterVerifyMemecoin`
   - `isMemecoinImported`
2. If already imported, skip import and proceed to liquidity or reads.
3. Execute `importMemecoin`.
4. If user wants a single transaction/batch path, use:
   - `getImportAndAddLiquidityCalls`
   - `getImportAndSingleSidedCoinAddLiquidityCalls`
5. Return explicit notes on what was imported vs what was only prepared as calldata.

Common mistakes and fixes:

- Re-import attempts on already imported memecoins.
- Skipping verification and hitting avoidable revert conditions.

Minimal pattern:

```ts
const isImported = await flaunch.isMemecoinImported(coinAddress)
if (!isImported) {
  const verify = await flaunch.tokenImporterVerifyMemecoin(coinAddress)
  if (!verify.isValid) throw new Error('Coin is not importable')

  const hash = await flaunch.importMemecoin({
    coinAddress,
    creatorFeeAllocationPercent: 5,
    initialMarketCapUSD: 50000,
  })
  console.log('import tx', hash)
}

const batchCalls = await flaunch.getImportAndAddLiquidityCalls({
  coinAddress,
  // import + liquidity params
})
```

Deliverables:

- Safe import sequence.
- Optional one-shot import+liquidity batch flow.
- Import status branching logic.

### 8) events

Goal: support realtime UX/bots/indexers around pool lifecycle and swaps.

1. For near-realtime app UX, use `watchPoolCreated`/`watchPoolSwap`.
2. For resilient backend loops, use watcher callbacks plus trigger-style polling (`pollPoolCreatedNow`/`pollPoolSwapNow`) to force an immediate check.
3. Normalize parsed output for app consumption.

Detailed steps:

1. Use `watchPoolCreated` / `watchPoolSwap` for frontend/live UX.
2. Always return an unsubscribe cleanup pattern in examples.
3. For backend reliability, add trigger-style polling fallback:
   - `pollPoolCreatedNow`
   - `pollPoolSwapNow`
   - These methods trigger the active watcher poll cycle and deliver logs via callbacks
   - They do not return event arrays/logs
4. Normalize output into app-level types (timestamp, tx hash, amounts, coin address) before storing or rendering.

Common mistakes and fixes:

- Forgetting unsubscribe in React components causes duplicate listeners.
- Relying only on watchers in environments that can disconnect/restart.

Minimal pattern (frontend watcher + immediate poll trigger):

```ts
const sub = await flaunch.watchPoolSwap({
  // filterByCoin is supported by the SDK wrapper
  filterByCoin: coinAddress,
  onPoolSwap: ({ logs, isFetchingFromStart }) => {
    console.log('swap logs', { logs, isFetchingFromStart })
  },
})

// Optional: trigger an immediate poll cycle after subscribing
await sub.pollPoolSwapNow()
// or via SDK wrapper (works only when an active watcher has registered the poller)
await flaunch.pollPoolSwapNow()

// later (React cleanup / teardown)
sub.cleanup()
```

Minimal pattern (backend service pattern):

```ts
const sub = await flaunch.watchPoolSwap({
  filterByCoin: coinAddress,
  onPoolSwap: ({ logs }) => {
    if (logs.length) console.log('new swaps', logs)
  },
})

// trigger checks on your own schedule (callback receives results)
await flaunch.pollPoolSwapNow()

// shutdown
sub.cleanup()
```

Deliverables:

- Watcher setup with unsubscribe handling.
- Polling fallback strategy.
- Clear note that `pollPool*Now` triggers callbacks and returns `Promise<void>`.
- Event normalization guidance.

### 9) calldata-mode

Goal: support smart accounts, relayers, or external executors.

1. Prefer `createFlaunchCalldata` and related call-build helpers.
2. Return `{ to, data, value }` plus user-safe notes on signer, chain, and expected effects.
3. Avoid submitting tx directly unless user asks.

Detailed steps:

1. Confirm the user wants transaction construction only (not direct wallet broadcast).
2. Build calldata using:
   - `createFlaunchCalldata`
   - other call-build helpers for liquidity/import paths
3. Return `{ to, data, value }` and document:
   - intended chain
   - expected signer/executor
   - side effects
4. Recommend a verification read or simulation before execution when possible.

Common mistakes and fixes:

- Returning calldata without stating chain or required `value`.
- Mixing calldata built for one chain with an executor on another chain.

Deliverables:

- Calldata generation snippet.
- Validation checklist before external execution.
- Clear side-effect summary.

### 10) troubleshoot

Goal: quickly isolate failing integration paths.

Check in this order:

1. Chain mismatch and wrong address set.
2. Read-only vs read-write instance confusion.
3. Invalid token/pool state (`isValidCoin`, version detection helpers).
4. Missing allowance/approval (including Permit2).
5. Parameter bounds and deadline/slippage issues.
6. Event parsing against wrong tx hash or stale block range.

Add workflow-specific checks:

- Launch issues: verify metadata image encoding, creator address, fee/split params, and parse timing.
- Trade issues: re-quote, inspect slippage/deadline, confirm approval/Permit2 state.
- Liquidity issues: recompute ticks/amounts and run sidedness checks.
- Import issues: verify import status and token eligibility before calling writes.
- Event issues: confirm tx hash, chain, and listener lifecycle.

Deliverables:

- Concise diagnosis summary.
- Minimal patch or corrected call sequence.
- Ordered debug checklist.

## Output Expectations

When using this skill, prefer responses that include:

1. A minimal working snippet for the chosen workflow.
2. Required inputs and preconditions.
3. One verification step (read or parsed receipt/event).
4. One common failure mode and mitigation.

## Return Values To Report (By Workflow)

When returning results to builders, include these fields when available.

- `setup-read`: `chain`, method called, returned shape/sample fields
- `setup-write`: `chain`, signer address, confirmation that read-write SDK instance was created
- `launch`: `txHash`, `memecoin`, `tokenId`, `poolId` (if parsed), `chain`
- `trade-buy-sell`: `txHash`, quote result, parsed swap summary (`type`, amounts/fees), `chain`
- `permit2-sell`: `allowance/nonce` check summary, permit generated (`yes/no`), `txHash`, parsed swap summary
- `liquidity`: computed ticks/amounts summary, number of calls generated, any approvals required
- `import`: import status (`already imported` vs `imported now`), `txHash` if write executed, batch call count if built
- `events`: subscription status, callback shape, whether immediate poll trigger is available
- `calldata-mode`: `to`, `data`, `value`, intended chain, expected executor/signer
- `troubleshoot`: root cause hypothesis, failing precondition, minimal fix

If the user is building from scratch, prefer this order:

1. `setup-read`
2. `setup-write`
3. One core transaction flow (`launch` or `trade-buy-sell`)
4. `events` for observability
5. `troubleshoot` only if needed

## Common Mistakes (Cross-Workflow)

- Chain mismatch between `publicClient`, `walletClient`, and target contract address.
- Using read-only SDK instance for write methods.
- Skipping quote/preflight methods before swaps or liquidity writes.
- Not parsing receipts/logs after a transaction hash is returned.
- Treating `llms-full.txt` as runtime logic instead of reference material.
- Returning code without required inputs (chain, addresses, slippage, deadlines, approvals).

## When To Ask The User (Instead Of Assuming)

Ask before proceeding when any of these are missing or ambiguous in a write or money-sensitive flow:

- Chain (`base` vs `baseSepolia`)
- `coinAddress` or target token identity
- Whether they want read-only code, write code, or calldata only
- Trade side and amount semantics (exact input vs exact output)
- Slippage tolerance (or permission to use a default)
- Whether Permit2 should be used
- Whether examples should target frontend (React/Wagmi) or backend scripts
- Whether they want direct tx broadcast or batched call objects

Reasonable defaults are acceptable for low-risk read examples, but state them explicitly.

## Versioning Note

This skill includes a mix of:

- `Verified Recipe` sections checked against current SDK source on this branch
- `Outline` sections that describe correct flow but may need parameter adaptation

Revalidate against `src/sdk/FlaunchSDK.ts` and `src/types.ts` if the SDK version changes.

## Reference Map

Use these files as needed; do not duplicate large sections into responses.

- SDK repository: [flaunch-sdk](https://github.com/flayerlabs/flaunch-sdk)
- Full SDK reference: [llms-full.txt](https://raw.githubusercontent.com/flayerlabs/flaunch-sdk/refs/heads/master/llms-full.txt)
- Integration guide: [README.md](https://raw.githubusercontent.com/flayerlabs/flaunch-sdk/refs/heads/master/README.md)
- Package metadata/scripts: [package.json](https://raw.githubusercontent.com/flayerlabs/flaunch-sdk/refs/heads/master/package.json)
- Source of truth for SDK method implementations: [src](https://github.com/flayerlabs/flaunch-sdk/tree/master/src)
- Raw `FlaunchSDK.ts` (method signatures / docs): [src/sdk/FlaunchSDK.ts](https://raw.githubusercontent.com/flayerlabs/flaunch-sdk/refs/heads/master/src/sdk/FlaunchSDK.ts)
- Raw `types.ts` (exported SDK types): [src/types.ts](https://raw.githubusercontent.com/flayerlabs/flaunch-sdk/refs/heads/master/src/types.ts)
- Protocol contracts repository: [flaunchgg-contracts](https://github.com/flayerlabs/flaunchgg-contracts)
