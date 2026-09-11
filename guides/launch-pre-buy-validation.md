# Launch pre-buy — fork validation (0.14.0)

Evidence for `guides/launch-pre-buy.md`, produced by `scripts/test-launch-prebuy-fork.cjs`
(`PREBUY_LOCAL_FORK=1`) on 2026-09-11 against local Anvil forks (`anvil --fork-url … --port
1857x`, forked chain id kept). Every write went to `127.0.0.1`; nothing touched a live chain.
Sender: a fresh throw-away key funded with `anvil_setBalance`. Slippage 50 bps in every plan.

Each PASS row means, on the fork: `planLaunchPreBuy` returned a supported plan with sufficient
funding, `verifyLaunchPreBuyPlan(plan, "simulate")` succeeded, `executeLaunchPreBuy` sent the
launch, the receipt succeeded, `getLaunchPreBuyResultFromTx` decoded `PoolCreated` with the
plan's premine, the creator's coin balance rose by **exactly** `plan.premineAmount`, and the
sender spent at most `fee + payment.max` (the difference to the cap was refunded). The
"underfunded" rows sent the launch with half the required ETH and required a revert with no
`PoolCreated`.

## What the runs established

- **Exact pricing.** `pricing.method = "simulation"` plans (ETH-funded) spent exactly
  `payment.expected` on every chain and size — e.g. Base, 10% of supply: expected
  0.181310066785353590 ETH, spent 0.181310066785353590 ETH — while the zaps' linear quote
  would have under-quoted the same launch by 10.2% (0.164590042653925102 ETH). At 1% the
  linear quote was 0.15% short.
- **ERC20 pairing (Base Sepolia mUSD, 6 dp).** `protocolQuoteWithSimulatedImpact` priced the
  1% pre-buy at 100.3727 mUSD against 100.33605 mUSD actually pulled (0.04% over, refunded),
  and the 10% pre-buy at 1104.0997 against 1103.6965 (0.04% over); the zap's linear quote was
  100.1497 / 1001.4971 — 0.19% and 9.3% short, which at 50 bps slippage would have reverted
  with `PremineCostExceedsMaximum`. The approval was sent once; the re-plan after it carried no
  approval.
- **Multichain zap (Robinhood).** `standard` and `dynamicSplitManager` pre-buys at 1% and 10%
  delivered the exact premine to the creator (the manager takes the launch NFT only). The
  multichain zap's `ethSpent_` return repeated the linear quote (0.016296… ETH) while the
  launch really consumed 0.016482… ETH — the reason the planner measures the sender's balance
  delta instead.
- **Legacy Base zap.** `standard` / `revenueManager` / `splitManager` / `dynamicSplitManager`
  on Base and Base Sepolia are `ROUTE_PREMINE_UNAVAILABLE`; a direct simulation of the legacy
  launch with any premine reverts `PremineExceedsInitialAmount(uint256,uint256)` (selector
  `0x9f68473d`) because the premine must come from the fair-launch allocation, which is 0.
- **Zero-premine fee.** `calculateFee(0, 0 bps) == calculateFee(0, 500 bps)` on the legacy zap
  (both 0 at a $4k market cap), so `fee` is slippage-independent as the planner assumes.
- **Cost curve** (v1.3 zap, native pairing, $4k market cap; actual ÷ linear-quote-with-1%-buffer):
  0.1% → 99.2%, 0.5% → 99.6%, 1% → 100.14–100.22%, 2% → 101.2%, 3% → 102.2%, 5% → 104.4%,
  10% → 110.2% on Robinhood and Base Sepolia alike.

## Not covered on a fork

- **Base ERC20 pairings (B20 equities).** Their bytecode on Base is `0xef` — a sequencer-level
  predeploy Anvil cannot execute (`OpcodeNotFound` on `balanceOf`; the SDK's acquisition swap
  reverts `TF` for the same reason). ERC20 pricing, approval and `maxPremineCost` enforcement
  were validated with mUSD on the Base Sepolia fork instead; the code path is identical.
- Live-chain launches. The frontend's staging rollout should re-run one paired-token pre-buy on
  Base Sepolia with a real wallet.

## Results

### Base (8453)

| Scenario | Result | Coin | Premine (coins) | Expected | Max cap | Actually spent | Pricing | Zap linear quote |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| legacy standard @ 100 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy standard @ 1000 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy static split @ 100 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy static split @ 1000 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy dynamic split @ 100 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy dynamic split @ 1000 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy fee is slippage-independent at zero premine | PASS |  |  |  |  |  |  |  |
| legacy standard underfunded launch reverts | SKIP (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| paired native ETH @ 100 bps | PASS | `0xC80f130a0a56CA50e242dabB401dc96c9ceaf604` | 1000000000 | 0.016384137955682101 ETH | 0.016466058645460512 ETH | 0.016384137955682101 ETH | simulation | 0.016345833684352356 / 0.016427562852774117 |
| paired native ETH @ 1000 bps | PASS | `0x4cF8fF1c9CcEC0DF9e94eC5799cB77bf30D66223` | 10000000000 | 0.180225517512503111 ETH | 0.181126645100065627 ETH | 0.180225517512503111 ETH | simulation | 0.163458336843523568 / 0.164275628527741185 |
| paired flETH @ 100 bps | PASS | `0x2674a6FB02D8513baC7B892C003FFE51428dbDC8` | 1000000000 | 0.016384137955682101 ETH | 0.016466058645460512 ETH | 0.016384137955682101 ETH | simulation | 0.016287097406989677 / 0.016368532894024625 |
| paired flETH @ 1000 bps | PASS | `0xaF2e370D1CED1C3FDB4c3AA8d0Ac0cc113980316` | 10000000000 | 0.180225517512503111 ETH | 0.181126645100065627 ETH | 0.180225517512503111 ETH | simulation | 0.162854688608192269 / 0.16366896205123323 |
| paired native ETH underfunded launch reverts | PASS |  |  |  |  |  |  |  |
| paired ERC20 | SKIP — set PREBUY_ERC20_PAIRED_TOKEN to exercise the approval path |  |  |  |  |  |  |  |

Capabilities reported: {"standard":false,"revenueManager":false,"splitManager":false,"dynamicSplitManager":false,"pairedToken":true}. Transaction hashes are in the results JSON (`scripts/test-launch-prebuy-fork.cjs` output).

### Base Sepolia (84532)

| Scenario | Result | Coin | Premine (coins) | Expected | Max cap | Actually spent | Pricing | Zap linear quote |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| legacy standard @ 100 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy standard @ 1000 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy static split @ 100 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy static split @ 1000 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy dynamic split @ 100 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy dynamic split @ 1000 bps | UNSUPPORTED (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| legacy fee is slippage-independent at zero premine | PASS |  |  |  |  |  |  |  |
| legacy standard underfunded launch reverts | SKIP (ROUTE_PREMINE_UNAVAILABLE) |  |  |  |  |  |  |  |
| paired native ETH @ 100 bps | PASS | `0x8787996e51d2471E203CF5185498Ef1F0710f1B5` | 1000000000 | 0.033457566736393127 ETH | 0.033624854570075093 ETH | 0.033457566736393127 ETH | simulation | 0.033383237439190524 / 0.033550153626386476 |
| paired native ETH @ 1000 bps | PASS | `0x72bC79D1738633C4FD378504aCcAC473e71B5B4C` | 10000000000 | 0.368033234100324389 ETH | 0.369873400270826011 ETH | 0.368033234100324389 ETH | simulation | 0.333832374391905241 / 0.335501536263864767 |
| paired flETH @ 100 bps | PASS | `0xef7C419Ba3374395b93ac62782C8B8c070ae5082` | 1000000000 | 0.033457566736393127 ETH | 0.033624854570075093 ETH | 0.033457566736393127 ETH | simulation | 0.033383237439190524 / 0.033550153626386476 |
| paired flETH @ 1000 bps | PASS | `0x5F20f3367846A379D82b47C52e261219e1F2bfC6` | 10000000000 | 0.368033234100324389 ETH | 0.369873400270826011 ETH | 0.368033234100324389 ETH | simulation | 0.333832374391905241 / 0.335501536263864767 |
| paired native ETH underfunded launch reverts | PASS |  |  |  |  |  |  |  |
| paired ERC20 funding via storage | PASS |  |  |  |  |  |  |  |
| paired ERC20 funding | PASS |  |  |  |  |  |  |  |
| paired ERC20 @ 100 bps | PASS | `0xC641f1d64CdAA120C89eE065a3b8F05F7eb09fAf` | 1000000000 | 100.3727 mUSD | 100.874564 mUSD | 100.33605 mUSD | protocolQuoteWithSimulatedImpact | 100.149712 / 100.65046 |
| paired ERC20 @ 1000 bps | PASS | `0x48396306E28f31C582a471ad9C2cc86c037257b1` | 10000000000 | 1104.099703 mUSD | 1109.620202 mUSD | 1103.69654 mUSD | protocolQuoteWithSimulatedImpact | 1001.497123 / 1006.504608 |

Capabilities reported: {"standard":false,"revenueManager":false,"splitManager":false,"dynamicSplitManager":false,"pairedToken":true}. Transaction hashes are in the results JSON (`scripts/test-launch-prebuy-fork.cjs` output).

### Robinhood (4663)

| Scenario | Result | Coin | Premine (coins) | Expected | Max cap | Actually spent | Pricing | Zap linear quote |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| multichain standard @ 100 bps | PASS | `0xf9FA92f97E82D91F7E924edb6D0ee6d8f1c21929` | 1000000000 | 0.016384137955682101 ETH | 0.016466058645460512 ETH | 0.016384137955682101 ETH | simulation | 0.01621801413868876 / 0.016299104209382203 |
| multichain standard @ 1000 bps | PASS | `0x84e8e24aB34a39b77FF234fc9bB6178411a813f8` | 10000000000 | 0.180225517512503111 ETH | 0.181126645100065627 ETH | 0.180225517512503111 ETH | simulation | 0.161548902117800898 / 0.162356646628389902 |
| multichain dynamic split @ 100 bps | PASS | `0x2dE22fe889e7FE4F0f68221Eb7dFa3734Ff0df34` | 1000000000 | 0.016384137955682101 ETH | 0.016466058645460512 ETH | 0.016384137955682101 ETH | simulation | 0.016154890211780089 / 0.016235664662838989 |
| multichain dynamic split @ 1000 bps | PASS | `0x949c1c591B652304eE06C7f489931b453E74b706` | 10000000000 | 0.180225517512503111 ETH | 0.181126645100065627 ETH | 0.180225517512503111 ETH | simulation | 0.161548902117800898 / 0.162356646628389902 |
| multichain standard underfunded launch reverts | PASS |  |  |  |  |  |  |  |
| paired native ETH @ 100 bps | PASS | `0xb15a519d9575E2A91e87B43A76D0624f1e7f27C7` | 1000000000 | 0.016384137955682101 ETH | 0.016466058645460512 ETH | 0.016384137955682101 ETH | simulation | 0.016314807633427762 / 0.0163963816715949 |
| paired native ETH @ 1000 bps | PASS | `0xc4eD7A77897d178C965F7Eb1149B7915A4a4d021` | 10000000000 | 0.180225517512503111 ETH | 0.181126645100065627 ETH | 0.180225517512503111 ETH | simulation | 0.163148076334277627 / 0.163963816715949015 |
| paired flETH @ 100 bps | PASS | `0xaF5F0d78408a2366488887F28d28abffAdf38FFE` | 1000000000 | 0.016384137955682101 ETH | 0.016466058645460512 ETH | 0.016384137955682101 ETH | simulation | 0.016314807633427762 / 0.0163963816715949 |
| paired flETH @ 1000 bps | PASS | `0xB42688f4A2EA13b7F6C87Ca2A7e72db9Dee3b825` | 10000000000 | 0.180225517512503111 ETH | 0.181126645100065627 ETH | 0.180225517512503111 ETH | simulation | 0.163131763145103769 / 0.163947421960829287 |
| paired native ETH underfunded launch reverts | PASS |  |  |  |  |  |  |  |
| paired ERC20 | SKIP — set PREBUY_ERC20_PAIRED_TOKEN to exercise the approval path |  |  |  |  |  |  |  |

Capabilities reported: {"standard":true,"revenueManager":true,"splitManager":true,"dynamicSplitManager":true,"pairedToken":true}. Transaction hashes are in the results JSON (`scripts/test-launch-prebuy-fork.cjs` output).
