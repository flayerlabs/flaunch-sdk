# Vested launches

A coin can launch with part of its supply locked into linear vesting schedules. The
`AnyFlaunchZap` deploys the coin, escrows the vested share in the `MemecoinVesting` singleton
and seeds everything else into the pool's hook-owned launch position — the same lock guarantee
a standard launch has. Beneficiaries claim as their schedules vest; nobody can revoke, pause or
rescue a schedule.

The SDK surface mirrors the standard launch family one-to-one: every `flaunch*` method has a
`flaunchVested*` twin that takes the same parameters plus `vestingSchedules`, and the pre-buy
planner has a `vested` route. This guide is the rule book; usage is in the README under
"Launching with vesting".

## Where it runs

| Chain | Zap | Escrow | Hook the coins launch on |
| --- | --- | --- | --- |
| Base Sepolia (84532) | `AnyFlaunchZapAddress` `0xaA0872Bc…` | `MemecoinVestingAddress` `0x3F800433…` | `AnyFlaunchZapPositionManagerAddress` `0xE753a351…` (ERC721 `AnyFlaunchZapFlaunchAddress` `0xE9ec22D7…`) |

`doesChainSupportVestedLaunch(chainId)` is the gate. The hook is a separate generation from the
v1.3.3 import hook (`AnyPositionManagerV1_3Address`), which `anyFlaunch()` keeps using.

## Parameters

`FlaunchVestedParams` is `FlaunchParams` without the deprecated fair-launch fields, plus:

| Field | Meaning | Default |
| --- | --- | --- |
| `vestingSchedules` | One or more `VestingScheduleParams` (below). At least one — use `flaunch()` for a launch with none. | required |
| `pairedToken` | A registry-approved pairing: the chain's flETH, `zeroAddress` for raw ETH, or an approved ERC20 (B20 equities, mUSD…). | `FLETHAddress[chainId]` |
| `feeCalculatorParams` | Passed to the pool's fee calculator. | `0x` |
| `slippageBps` | Headroom (integer bps) on the ETH quote the launch sends as `value`; unspent ETH is refunded by the zap. | `0` |
| `maxPremineCost` | ERC20 pairings with a premine: the paired-token spend cap the caller has approved the zap for. Required there (`Erc20PremineRequiresMaxCost`). | — |

`VestingScheduleParams`:

| Field | Meaning |
| --- | --- |
| `beneficiary` | Who can claim. Non-zero. |
| `amount` **or** `percent` | Coins in wei, or a percent of total supply with at most two decimals (`12.5`, `"0.25"`). Exactly one. Total supply is `100n * 10n ** 27n`; `percent` converts exactly (`FLAUNCH_TOTAL_SUPPLY * bps / 10_000`). |
| `cliffDuration` | Seconds after `start` before anything is claimable; `<= vestDuration`. When the cliff lifts, everything accrued through it releases at once. |
| `vestDuration` | Seconds, from `start`, over which the amount vests linearly; `> 0`. Fully claimable from `start + vestDuration`. |
| `start` | Unix seconds. Omit (or `0`) for the launch block's timestamp. **An explicit start in the past reverts** (`ScheduleStartInvalid`) — a back-dated schedule would be born already vested. |

The SDK validates all of this before any RPC (`toVestingScheduleArgs`) and throws with the field
that failed.

## Rules the zap enforces

| Rule | Revert | SDK behaviour |
| --- | --- | --- |
| Total vested `<= maxVestedBps` of supply (default 50%, owner-settable, always `< 100%`). | `VestedSupplyExceedsCap` | `flaunchVested*` read `maxVestedBps()` and throw before signing; `getMaxVestedBps()` exposes it. |
| Premine `< seed` where `seed = supply − total vested`. The premine is swapped out of the seeded position, so it can never take the whole float. | `PremineExceedsSeedAmount` | Checked in `toAnyFlaunchZapFlaunchParams`; `calculateFee` reverts the same way. |
| ERC20-paired premine needs a `maxPremineCost`. | `Erc20PremineRequiresMaxCost` | Pass `maxPremineCost` (and approve the zap for it) or use the pre-buy planner, which quotes it. |
| Flaunching fee (native ETH, same rule as the standard zap; zero below the protocol's market-cap threshold). The exemption is checked against the **caller**. | `InsufficientFlaunchFee` | `calculateVestedFlaunchFee` and the launch methods quote as the signer (`eth_call` `from`). |
| Trusted-signer / gated launches. | — | Not available on this zap; `trustedSignerSettings` is rejected. |

`initialMarketCapUSD` is the fully diluted valuation — the price per coin is the same whether
50% or 0% of supply is vested. Vesting changes the float, not the price.

## Quote model

`calculateFee(params, slippageBps)` returns `{ ethRequired, pairedPremineCost }` exactly like the
standard zap's. Unlike the standard zap's linear estimate, this quote models the seeded depth:
the premine fills from the non-vested position, and a single-sided position from the launch
tick to the tick limit sells `x` of its `seed` coins for `price · x · seed / (seed − x)`. The
quote adds the same 1% buffer for the launch tick's spacing offset and the caller's `slippageBps`
on top, so it is a tight upper bound (within a few percent at zero slippage). The pre-buy
planner still prices the `vested` route by simulation, as it does every other route.

## Treasury managers

All four zap overloads are wired, so a vested launch can deposit into a manager exactly as a
standard one can: `flaunchVestedWithRevenueManager`, `flaunchVestedWithSplitManager`,
`flaunchVestedWithDynamicSplitManager`, or `treasuryManagerParams` on `flaunchVested`. The zap is
bound to the chain's v1.3.1 multi-asset `TreasuryManagerFactory`, so `Permissions.WHITELISTED`
resolves to the v1.3 `WhitelistedPermissions` instance. The launch NFT lands in the manager; the
premine and the vesting schedules are unaffected.

## Events and results

A vested launch emits, in order: `AnyFlaunch.MemecoinDeployed`, one
`MemecoinVesting.ScheduleCreated` per schedule (`token, beneficiary, scheduleId, amount, start,
cliffDuration, vestDuration`), `MemecoinVesting.SchedulesCreated`, the hook's `PoolCreated`
(`PoolScheduled` too when `flaunchAt` is in the future), and finally
`AnyFlaunchZap.MemecoinFlaunched(memecoin, creator, seedAmount, totalVested, scheduleCount,
treasuryManager)`.

- `getPoolCreatedFromLogs` / `getPoolCreatedFromTx` resolve the coin from the vested hook like
  any other. The AnyPositionManager event carries only the six-field params, so name / symbol /
  premine / flaunchAt are not in it and `creator` is corrected to the end creator from
  `MemecoinFlaunched`.
- `getVestedLaunchFromLogs` / `getVestedLaunchFromTx` add `vesting: { seedAmount, totalVested,
  scheduleCount, treasuryManager, creator, schedules[] }` and `flaunchesAt`.

## Claiming

`getVestingPosition(coin, beneficiary)` returns every schedule with its id, `cliffAt`, `endsAt`
and the contract's live `vested` / `claimable`, plus totals. `claimVesting(coin)` claims every
schedule with something claimable for the connected wallet (`claimVesting(coin, [ids])` for a
subset). The beneficiary is `msg.sender`; there is no claim-on-behalf. Claiming nothing reverts
`NothingToClaim`, which the SDK turns into a readable error before sending.

## Pre-buy

`planLaunchPreBuy({ route: "vested", params, preBuyBps, … })` plans a premine on a vested launch
with the same guarantees as the other routes: the schedules are validated and checked against
`maxVestedBps` at the quote block, the premine is checked against the seed, pricing runs the
launch in an `eth_call` probe (or scales the paired quote by the simulated impact for ERC20
pairings), and the plan's binding includes `vestingSchedulesHash` — the keccak256 of the
ABI-encoded schedules — so executing a plan with different schedules is a `BINDING_MISMATCH` /
`CALLDATA_MISMATCH`. Manager launches are allowed on this route. Reason codes specific to it:
`INVALID_VESTING_SCHEDULE`, `VESTED_SUPPLY_EXCEEDS_CAP`.
