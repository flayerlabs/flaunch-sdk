# Launch pre-buy

A creator can buy an exact share of a coin's supply as part of the launch transaction. The
protocol fills it as a premine: the launch seeds the pool, swaps the requested coins out of the
just-seeded position, delivers them to `creator`, and refunds unspent payment. The SDK plans
that purchase from protocol quotes and executes it through the launch route the coin would
have used anyway — no separate buy, no simulated pricing.

This guide is the capability matrix and the rules behind `planLaunchPreBuy` /
`executeLaunchPreBuy`. Usage examples are in the README under "Launching with a pre-buy".

## Capability matrix

| Route (`LaunchPreBuyInput.route`) | Base (8453) | Base Sepolia (84532) | Robinhood (4663) | Ethereum (1) | Unichain (130) | Payment asset | Approval | Limit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `standard` | legacy zap | legacy zap | multichain zap | multichain zap | multichain zap | native ETH via `msg.value` | never | 1000 bps |
| `revenueManager` | legacy zap | legacy zap | multichain zap | multichain zap | multichain zap | native ETH | never | 1000 bps |
| `splitManager` (static) | legacy zap | legacy zap | multichain zap | multichain zap | multichain zap | native ETH | never | 1000 bps |
| `dynamicSplitManager` | legacy zap | legacy zap | multichain zap | multichain zap | multichain zap | native ETH | never | 1000 bps |
| `pairedToken` | v1.3 zap | v1.3 zap | v1.3 zap | — | — | follows the pairing (below) | ERC20 pairings only | 1000 bps |

`getLaunchPreBuyCapabilities(chainId)` returns this table for one chain from the SDK's address
maps (no RPC), including the reason code for each unsupported cell.
`doesChainSupportLaunchPreBuy(chainId)` is the one-bit version.

### Paired-token payment asset

The registry row (`PairedTokenRegistryV1_3.tokenConfig`) decides how the premine is paid:

| `tokenType` | Examples | Payment asset in the plan | Approval |
| --- | --- | --- | --- |
| `nativeEth` (`zeroAddress` pairing) | raw ETH pools | ETH, 18 dp, inside `msg.value`; unspent refunded | none |
| `nativeWrapper` | flETH | ETH, 18 dp, inside `msg.value`; the zap wraps and refunds | none |
| `erc20` / `erc20Wrapper` | B20 equities (8 dp), mUSD / USDC (6 dp) | the paired token itself, its own decimals | `approve(FlaunchZapV1_3, maxPremineCost)` |

The flaunching fee is always native ETH and is reported separately (`plan.fee`). For an ERC20
pairing `plan.value` is exactly that fee; the purchase never travels as ETH.

### Not supported in this version

| Launch kind | Reason code | Why |
| --- | --- | --- |
| Gasless / relayed launches (`gasless: true`) | `GASLESS_UNSUPPORTED` | The relayer pays and signs; the SDK cannot bind a spend cap to it. |
| Protected launches — trusted signer (`trustedSignerSettings`) or a spend gate (`feeCalculatorParams != 0x`, non-zero `trustedFeeSigner`) | `PROTECTED_LAUNCH_UNSUPPORTED` | Game Mode launches are excluded for now. |
| Paired-token launch into a treasury manager | `PAIRED_MANAGER_LAUNCH_UNSUPPORTED` | The SDK does not carry the zap's manager + `maxPremineCost` overload yet. |
| `anyFlaunch` (imported coins) | `ANY_FLAUNCH_UNSUPPORTED` | No premine exists on that path. |
| Fair-launch fields (`fairLaunchPercent != 0`; `fairLaunchDuration != 0` on multichain) | `FAIR_LAUNCH_UNSUPPORTED` | Mirrors the launch methods, which reject them too. |

## Amounts

- Total supply is `100n * 10n ** 27n` (100 billion coins, 18 decimals) on every route.
- `preBuyBps` is an integer, `100 = 1%`. `premineAmount = TOTAL_SUPPLY * preBuyBps / 10_000` —
  exact, no rounding. `percentToBps("2.5")` converts a UI string; more than two decimals is
  rejected (`INVALID_PERCENTAGE`), never rounded.
- The default limit is `DEFAULT_MAX_PRE_BUY_BPS = 1000` (10%). The protocol has **no on-chain
  cap**: the premine is an exact-output swap against the whole seeded position, so cost rises
  super-linearly with size and a very large premine simply cannot be filled. Pass
  `maxPreBuyBps` (integer 1..9999) to change the limit deliberately; above it the planner
  returns `EXCEEDS_ROUTE_LIMIT`.
- Slippage is an integer 0..9999 bps (`INVALID_SLIPPAGE` otherwise). It is applied by the zap's
  `calculateFee`, on top of the zap's own 1% price-impact buffer.

## Quote model

Every plan comes from three reads of the route's zap `calculateFee`, all pinned to
`plan.quoteBlockNumber`:

| Field | Read | Meaning |
| --- | --- | --- |
| `fee.amount` | premine 0, slippage 0 | The flaunching fee (native ETH). |
| `payment.expected` | premine, slippage 0 | The protocol's own cost estimate for the purchase, including its 1% buffer. Actual spend is at or below this and the difference is refunded. |
| `payment.max` | premine, `slippageBps` | The cap the chain enforces. On ETH routes it is `value - fee`; on ERC20 pairings it is `maxPremineCost`. |

On-chain enforcement: ETH-funded routes revert with `InsufficientPreminePayment` when the
premine would cost more than `msg.value - fee`; ERC20 pairings revert with
`PremineCostExceedsMaximum` when it would cost more than `_maxPremineCost`. Both are the
quoted `payment.max`; the SDK never represents an estimate as the limit.

`plan.funding` reports the sender's ETH (and paired-token) balance against `value` (and
`maxPremineCost`) at the quote block. A shortfall does not make the plan unsupported — the UI
can show it — but `executeLaunchPreBuy` refuses to send (`LaunchPreBuyInsufficientBalanceError`,
`code: "INSUFFICIENT_BALANCE"`). Gas is not included.

## Binding and revalidation

`plan.binding` is `keccak256` over the canonical JSON of the bound fields (`chainId`, `sender`,
`creator`, route and zap family, `premineAmount`, `preBuyBps`, `slippageBps`, `value`,
`maxPremineCost`, `pairedToken`, payment asset and maximum, fee, `launch.to/data/value`,
`quoteBlockNumber`, `expiresAtMs`). `computeLaunchPreBuyBinding` is exported so a host can
recompute it.

Before requesting the first signature, `executeLaunchPreBuy` checks, in order:

| Check | `LaunchPreBuyRequoteRequiredError.reason` |
| --- | --- |
| Plan chain equals the SDK chain | `CHAIN_MISMATCH` |
| Drift signer equals `plan.sender` | `SENDER_MISMATCH` |
| `Date.now() < expiresAtMs` (default lifetime 30 s, `quoteTtlMs`) | `EXPIRED` |
| Recomputed binding equals `plan.binding` | `BINDING_MISMATCH` |
| `launch.data` decodes to the plan's premine, creator, `maxPremineCost`, pairing, zero trusted signer and empty fee-calculator params, and targets this chain's zap with `launch.value === value` | `CALLDATA_MISMATCH` |
| Fresh balances cover `value` / `maxPremineCost` | `LaunchPreBuyInsufficientBalanceError` |
| Fresh `calculateFee` at 0 bps still fits under `value` / `maxPremineCost` | `PRICE_MOVED` or `FEE_CHANGED` |
| (default `revalidate: "simulate"`) `eth_call` of the launch as the sender succeeds | `PRICE_MOVED` with the revert as `cause` |

All of these throw with `code: "REQUOTE_REQUIRED"` and nothing is sent. Approvals are sent
first and awaited; the simulation runs after them (it needs the allowance), and the expiry is
checked again right before the launch signature. There is no retry and no internal re-quote: a
thrown error means at most the approval was sent and the launch was not. Re-plan and show the
new numbers.

`verifyLaunchPreBuyPlan(plan, "quote" | "simulate")` runs the same checks read-only.

## Result

`executeLaunchPreBuy` returns `{ hash, plan }`. `getLaunchPreBuyResultFromTx(hash, plan)`
decodes the `PoolCreated` event (the SDK's existing launch result) and throws if its
`premineAmount` is not the plan's. The premined coins land on `plan.creator`; the manager
routes sweep them back to the original creator after the manager takes the launch NFT.

## Reason codes

`LAUNCH_PRE_BUY_REASON_CODES`: `CHAIN_UNSUPPORTED`, `ROUTE_UNSUPPORTED`, `GASLESS_UNSUPPORTED`,
`PROTECTED_LAUNCH_UNSUPPORTED`, `PAIRED_MANAGER_LAUNCH_UNSUPPORTED`, `ANY_FLAUNCH_UNSUPPORTED`,
`PAIRED_TOKEN_NOT_APPROVED`, `INVALID_PERCENTAGE`, `EXCEEDS_ROUTE_LIMIT`, `INVALID_LIMIT`,
`INVALID_SLIPPAGE`, `INVALID_CREATOR`, `PREMINE_ALREADY_SET`, `FAIR_LAUNCH_UNSUPPORTED`,
`SENDER_REQUIRED`, `QUOTE_INCONSISTENT`.

`classifyLaunchPreBuyInput(chainId, input)` returns every static reason without RPC;
`planLaunchPreBuy` returns them all in `reasons` and stops before quoting. `PREMINE_ALREADY_SET`
means the caller passed a non-zero `premineAmount` — the planner owns that field. Zero pre-buy
launches keep using the existing `flaunch*` methods; their calldata is unchanged (see
`test/launchByteIdentity.test.cjs`).

## Verifying on a fork

`scripts/test-launch-prebuy-fork.cjs` launches with a pre-buy on a local Anvil fork of Base,
Robinhood or Base Sepolia and asserts the creator's coin balance rises by exactly
`plan.premineAmount`, `PoolCreated` is emitted, the sender spends at most `payment.max` plus
the fee (refund observed), and an underfunded launch reverts without a `PoolCreated`. See the
script header for the opt-in environment variables. Results are recorded in
`guides/launch-pre-buy-validation.md`.
