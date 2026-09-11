# Vested launch — fork validation (Base Sepolia, 2026-09-11)

`pnpm test:vested:fork` (`scripts/test-vested-launch-fork.cjs`) against an Anvil fork of Base
Sepolia at the live vested stack (`AnyFlaunchZap 0xaA0872Bc…`, `MemecoinVesting 0x3F800433…`,
hook `0xE753a351…`). Raw output: `release-evidence/vested-launch-fork-84532-2026-09-11.json`.

| Scenario | Result |
| --- | --- |
| Pre-flight rejections — 60% vested (cap), premine = total supply (≥ seed), back-dated start | Rejected before any signature (`VestedSupplyExceedsCap` surfaced from the zap's simulation; the other two by the SDK's own validation) |
| `flaunchVested` — 10% team (30-day cliff / 1 y) + 5% creator (30 d), 1% premine, `slippageBps: 100` | Receipt success; `getVestedLaunchFromTx` decodes seed `85e27`, total vested `15e27`, 2 schedules, end creator = sender, no manager; escrow holds `15e27`; premine `1e27` delivered; zap balance 0; spent 33.52 mETH against a 34.12 mETH quote (quote is an upper bound within 2%) |
| `getVestingPosition` + `claimVesting` after `evm_increaseTime(15 d)` | Creator's cliff-less schedule ~50% claimable (team still under cliff, 0); claim paid `2.5e27` and the position's `claimed` matches |
| `planLaunchPreBuy({ route: "vested", preBuyBps: 200 })` → `executeLaunchPreBuy` | `pricing.method: "simulation"`; delivered exactly the planned `2e27` premine; spent exactly `payment.expected` (67.84 mETH), under `payment.max` |
| `flaunchVestedWithRevenueManager` into the Sepolia Flaunchy RevenueManager `0x8529…` | Receipt success; `vesting.treasuryManager` = the manager, `vesting.creator` = sender (the zap-as-creator dance is corrected from `MemecoinFlaunched`) |

Every existing launch entry point's calldata is unchanged (`test/launchByteIdentity.test.cjs`).
