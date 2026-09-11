import type { Address, HexString } from "@delvtech/drift";
import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseUnits,
  zeroAddress,
} from "viem";
import { FLETHAddress } from "../addresses";
import { percentToBps } from "../helpers/bps";
import { getPermissionsAddressV1_3 } from "../helpers/permissions";
import { IPFSParams, Permissions } from "../types";
import type {
  AnyFlaunchZapFlaunchParams,
  AnyFlaunchZapTreasuryManagerArgs,
  VestingScheduleArgs,
} from "./AnyFlaunchZapClient";
import {
  FLAUNCH_TOTAL_SUPPLY,
  toFlaunchParamsWithDynamicSplitManager,
  toFlaunchParamsWithRevenueManager,
  toFlaunchParamsWithSplitManager,
  type FlaunchParams,
  type FlaunchWithDynamicSplitManagerParams,
  type FlaunchWithRevenueManagerParams,
  type FlaunchWithSplitManagerParams,
} from "./FlaunchZapClient";

/*
 * Developer-facing parameters for vested launches (AnyFlaunchZap). The shapes mirror the
 * standard `flaunch*` family — `FlaunchParams` minus the deprecated fair-launch fields — plus
 * `vestingSchedules` and the paired-token knobs the zap exposes. Everything here is pure.
 */

/** One vesting schedule as a developer describes it; exactly one of `amount` | `percent`. */
export interface VestingScheduleParams {
  beneficiary: Address;
  /** Coins in wei. */
  amount?: bigint;
  /** Percent of total supply, up to two decimals ("12.5", 12.5). Exact: 1e29 divides by 1e4. */
  percent?: number | string;
  /** Seconds until any coin unlocks; must be <= `vestDuration`. */
  cliffDuration: number;
  /** Seconds over which the schedule vests linearly; must be > 0. */
  vestDuration: number;
  /** Unix seconds; omit (or 0) for the launch block's timestamp. A past start reverts on chain. */
  start?: number;
}

export interface FlaunchVestedParams
  extends Omit<FlaunchParams, "fairLaunchPercent" | "fairLaunchDuration"> {
  vestingSchedules: VestingScheduleParams[];
  /** Registry-approved pairing; defaults to the chain's flETH. `zeroAddress` = native ETH. */
  pairedToken?: Address;
  /** Defaults to `0x` (no fee calculator params). */
  feeCalculatorParams?: HexString;
  /** Headroom (integer bps) applied to the fee quote the launch sends as `value`. Default 0. */
  slippageBps?: number;
  /** ERC20 pairings with a premine: the paired-token spend cap the caller has approved the zap for. */
  maxPremineCost?: bigint;
}

export interface FlaunchVestedIPFSParams
  extends Omit<FlaunchVestedParams, "tokenUri">,
    IPFSParams {}

export interface FlaunchVestedWithRevenueManagerParams
  extends Omit<FlaunchVestedParams, "treasuryManagerParams"> {
  revenueManagerInstanceAddress: Address;
  treasuryManagerParams?: {
    permissions?: Permissions;
  };
}

export interface FlaunchVestedWithRevenueManagerIPFSParams
  extends Omit<FlaunchVestedWithRevenueManagerParams, "tokenUri">,
    IPFSParams {}

export interface FlaunchVestedWithSplitManagerParams
  extends Omit<FlaunchVestedParams, "treasuryManagerParams">,
    Pick<
      FlaunchWithSplitManagerParams,
      "creatorSplitPercent" | "managerOwnerSplitPercent" | "splitReceivers"
    > {
  treasuryManagerParams?: {
    permissions?: Permissions;
  };
}

export interface FlaunchVestedWithSplitManagerIPFSParams
  extends Omit<FlaunchVestedWithSplitManagerParams, "tokenUri">,
    IPFSParams {}

export interface FlaunchVestedWithDynamicSplitManagerParams
  extends Omit<FlaunchVestedParams, "treasuryManagerParams">,
    Pick<
      FlaunchWithDynamicSplitManagerParams,
      "creatorShare" | "managerOwnerShare" | "moderator" | "splitReceivers"
    > {
  treasuryManagerParams?: {
    permissions?: Permissions;
  };
}

export interface FlaunchVestedWithDynamicSplitManagerIPFSParams
  extends Omit<FlaunchVestedWithDynamicSplitManagerParams, "tokenUri">,
    IPFSParams {}

/** Revenue-manager vested launch → `FlaunchVestedParams` depositing into the existing instance. */
export function toFlaunchVestedParamsWithRevenueManager(
  params: FlaunchVestedWithRevenueManagerParams
): FlaunchVestedParams {
  return toFlaunchParamsWithRevenueManager(params);
}

/** Static split vested launch → `FlaunchVestedParams` deploying an AddressFeeSplitManager. */
export function toFlaunchVestedParamsWithSplitManager(
  params: FlaunchVestedWithSplitManagerParams,
  chainId: number
): FlaunchVestedParams {
  return toFlaunchParamsWithSplitManager(params, chainId);
}

/** Dynamic split vested launch → `FlaunchVestedParams` deploying a DynamicAddressFeeSplitManager. */
export function toFlaunchVestedParamsWithDynamicSplitManager(
  params: FlaunchVestedWithDynamicSplitManagerParams,
  chainId: number
): FlaunchVestedParams {
  return toFlaunchParamsWithDynamicSplitManager(params, chainId);
}

const UINT32_MAX = 2 ** 32 - 1;
const UINT40_MAX = 2 ** 40 - 1;
const BPS = 10_000n;

function isUint(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

/** Coins for a share of supply in integer bps. Exact: 1e29 is divisible by 1e4. */
export function vestedAmountFromBps(bps: number): bigint {
  return (FLAUNCH_TOTAL_SUPPLY * BigInt(bps)) / BPS;
}

/** The most that may vest under a `maxVestedBps` cap. */
export function maxVestedSupply(maxVestedBps: bigint | number): bigint {
  return (FLAUNCH_TOTAL_SUPPLY * BigInt(maxVestedBps)) / BPS;
}

/** Total coins across schedules (developer shapes or contract shapes). */
export function vestedSupplyOf(
  schedules: readonly (VestingScheduleParams | VestingScheduleArgs)[]
): bigint {
  return schedules.reduce((total, schedule) => {
    const { amount, percent } = schedule as { amount?: bigint; percent?: number | string };
    if (amount !== undefined) {
      if (percent !== undefined) {
        throw new Error("A vesting schedule takes either amount or percent, not both");
      }
      return total + amount;
    }
    if (percent !== undefined) {
      return total + vestedAmountFromBps(percentToBps(percent));
    }
    throw new Error("A vesting schedule needs an amount or a percent of supply");
  }, 0n);
}

/**
 * Developer schedules → the contract's `VestingSchedule[]`, validated: exactly one of
 * `amount` | `percent`, a non-zero beneficiary, positive amount, `vestDuration > 0`,
 * `cliffDuration <= vestDuration`, integer seconds within the struct's widths.
 */
export function toVestingScheduleArgs(
  schedules: readonly VestingScheduleParams[]
): VestingScheduleArgs[] {
  return schedules.map((schedule, index) => {
    const label = `vestingSchedules[${index}]`;
    if (!schedule.beneficiary || schedule.beneficiary === zeroAddress) {
      throw new Error(`${label}: beneficiary cannot be the zero address`);
    }
    const beneficiary = getAddress(schedule.beneficiary);
    const hasAmount = schedule.amount !== undefined;
    const hasPercent = schedule.percent !== undefined;
    if (hasAmount === hasPercent) {
      throw new Error(`${label}: provide exactly one of amount or percent`);
    }
    const amount = hasAmount
      ? schedule.amount!
      : vestedAmountFromBps(percentToBps(schedule.percent!));
    if (amount <= 0n) {
      throw new Error(`${label}: amount must be greater than zero`);
    }
    if (amount > FLAUNCH_TOTAL_SUPPLY) {
      throw new Error(`${label}: amount exceeds the total supply`);
    }
    if (!isUint(schedule.vestDuration, UINT32_MAX) || schedule.vestDuration === 0) {
      throw new Error(`${label}: vestDuration must be a positive integer number of seconds`);
    }
    if (!isUint(schedule.cliffDuration, UINT32_MAX)) {
      throw new Error(`${label}: cliffDuration must be a non-negative integer number of seconds`);
    }
    if (schedule.cliffDuration > schedule.vestDuration) {
      throw new Error(`${label}: cliffDuration cannot exceed vestDuration`);
    }
    const start = schedule.start ?? 0;
    if (!isUint(start, UINT40_MAX)) {
      throw new Error(`${label}: start must be a unix timestamp in seconds (0 = launch time)`);
    }
    // The escrow rejects a back-dated start (`ScheduleStartInvalid`, which surfaces from inside
    // the zap as an undecoded selector). Catch it here, with a minute of clock tolerance.
    if (start !== 0 && start < Math.floor(Date.now() / 1000) - 60) {
      throw new Error(`${label}: start is in the past; omit it (launch time) or use a future timestamp`);
    }
    return {
      beneficiary,
      amount,
      start,
      cliffDuration: schedule.cliffDuration,
      vestDuration: schedule.vestDuration,
    };
  });
}

/** Throws when the schedules vest more than `maxVestedBps` of supply (the zap's `VestedSupplyExceedsCap`). */
export function assertVestedSupplyWithinCap(
  schedules: readonly VestingScheduleArgs[],
  maxVestedBps: bigint | number
): void {
  const total = vestedSupplyOf(schedules);
  const cap = maxVestedSupply(maxVestedBps);
  if (total > cap) {
    throw new Error(
      `Vesting schedules total ${total} wei, above the zap's cap of ${cap} wei (${maxVestedBps} bps of supply)`
    );
  }
}

/** keccak256 of the ABI-encoded schedules; part of a pre-buy plan's binding. */
export function hashVestingSchedules(schedules: readonly VestingScheduleArgs[]): HexString {
  return keccak256(
    encodeAbiParameters(
      [
        {
          type: "tuple[]",
          components: [
            { type: "address", name: "beneficiary" },
            { type: "uint256", name: "amount" },
            { type: "uint40", name: "start" },
            { type: "uint32", name: "cliffDuration" },
            { type: "uint32", name: "vestDuration" },
          ],
        },
      ],
      [schedules.map((s) => ({ ...s }))]
    )
  );
}

/**
 * `FlaunchVestedParams` → the zap's `FlaunchParams` struct: market cap to USDC (6 dp) exactly
 * as the other launch routes, creator fee percent to 2 dp, schedules validated and converted,
 * `pairedToken` defaulting to the chain's flETH. Trusted-signer settings are rejected — the
 * zap has no signer-gated premine path.
 * @param options.maxVestedBps - When known (read from the zap), the schedules are checked against it here
 */
export function toAnyFlaunchZapFlaunchParams(
  chainId: number,
  params: FlaunchVestedParams,
  options: { maxVestedBps?: bigint | number } = {}
): AnyFlaunchZapFlaunchParams {
  if (params.trustedSignerSettings) {
    throw new Error(
      "Trusted-signer settings are not supported on vested launches; omit trustedSignerSettings"
    );
  }
  const pairedToken = params.pairedToken ?? FLETHAddress[chainId];
  if (!pairedToken) {
    throw new Error(`No default paired token (flETH) is known on chain ${chainId}; pass pairedToken`);
  }
  if (!params.creator || params.creator === zeroAddress) {
    throw new Error("creator cannot be the zero address");
  }
  if (params.vestingSchedules.length === 0) {
    throw new Error("A vested launch needs at least one vesting schedule; use flaunch() otherwise");
  }
  const vestingSchedules = toVestingScheduleArgs(params.vestingSchedules);
  if (options.maxVestedBps !== undefined) {
    assertVestedSupplyWithinCap(vestingSchedules, options.maxVestedBps);
  }
  const premineAmount = params.premineAmount ?? 0n;
  const seed = FLAUNCH_TOTAL_SUPPLY - vestedSupplyOf(vestingSchedules);
  if (premineAmount >= seed) {
    throw new Error(
      `premineAmount ${premineAmount} must be below the non-vested seed of ${seed} wei`
    );
  }

  return {
    name: params.name,
    symbol: params.symbol,
    tokenUri: params.tokenUri,
    creator: params.creator,
    creatorFeeAllocation: Math.round(params.creatorFeeAllocationPercent * 100),
    initialMarketCap: parseUnits(params.initialMarketCapUSD.toString(), 6),
    feeCalculatorParams: params.feeCalculatorParams ?? "0x",
    pairedToken,
    premineAmount,
    flaunchAt: params.flaunchAt ?? 0n,
    vestingSchedules,
  };
}

/**
 * The zap's `_treasuryManagerParams` for a vested launch, or undefined when no manager is
 * configured (the zap's plain overloads are then selected). Permissions resolve through the
 * v1.3 map: the zap is bound to the v1.3.1 multi-asset TreasuryManagerFactory, whose
 * WhitelistedPermissions instance validates groups against that factory.
 */
export function toAnyFlaunchZapTreasuryManagerArgs(
  chainId: number,
  params: Pick<FlaunchVestedParams, "treasuryManagerParams">
): AnyFlaunchZapTreasuryManagerArgs | undefined {
  const manager = params.treasuryManagerParams?.manager;
  if (!manager || manager === zeroAddress) return undefined;
  return {
    manager,
    permissions: getPermissionsAddressV1_3(
      params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
      chainId
    ),
    initializeData: params.treasuryManagerParams?.initializeData ?? "0x",
    depositData: params.treasuryManagerParams?.depositData ?? "0x",
  };
}
