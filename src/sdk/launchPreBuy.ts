import { type Address, type Hex, keccak256, stringToHex, zeroAddress } from "viem";
import {
  AddressFeeSplitManagerAddress,
  AnyFlaunchZapAddress,
  DynamicAddressFeeSplitManagerAddress,
  FlaunchZapAddress,
  FlaunchZapMultichainAddress,
  FlaunchZapV1_3Address,
} from "../addresses";
import {
  FLAUNCH_TOTAL_SUPPLY,
  type FlaunchParams,
  type FlaunchWithDynamicSplitManagerParams,
  type FlaunchWithRevenueManagerParams,
  type FlaunchWithSplitManagerParams,
} from "../clients/FlaunchZapClient";
import type { PairedTokenFlaunchParams } from "../clients/FlaunchZapV1_3Client";
import {
  toVestingScheduleArgs,
  type FlaunchVestedParams,
} from "../clients/VestedLaunchParams";
import { percentToBps } from "../helpers/bps";
import {
  doesChainSupportPairedTokenLaunch,
  doesChainSupportVestedLaunch,
  isChainSupported,
  isMultichainDeployment,
} from "../helpers/supportedChains";

/*
 * Launch pre-buy: a creator buys an exact share of the 100bn supply as part of the launch
 * transaction (the protocol's `premineAmount`). This module is pure — percentages, limits,
 * reason codes, the capability matrix and the plan binding hash. The RPC-backed planner and
 * executor live in ./launchPreBuyPlanner.ts.
 */

/** `TokenSupply.INITIAL_SUPPLY`: every coin mints 100 billion units at 18 decimals. */
export const TOTAL_SUPPLY = FLAUNCH_TOTAL_SUPPLY;
export const COIN_DECIMALS = 18;
export const BPS_DENOMINATOR = 10_000n;
/** Default route limit: 10% of supply. The protocol has no on-chain cap; see the capability matrix. */
export const DEFAULT_MAX_PRE_BUY_BPS = 1000;
/** How long a plan stays executable without a fresh quote. */
export const DEFAULT_QUOTE_TTL_MS = 30_000;
export const LAUNCH_PRE_BUY_PLAN_VERSION = 1 as const;

export const LAUNCH_PRE_BUY_ROUTES = [
  "standard",
  "revenueManager",
  "splitManager",
  "dynamicSplitManager",
  "pairedToken",
  "vested",
] as const;
export type LaunchPreBuyRoute = (typeof LAUNCH_PRE_BUY_ROUTES)[number];

/** Which zap ABI a route's launch calldata is encoded against on a given chain. `anyVested` = AnyFlaunchZap. */
export type LaunchPreBuyZapFamily = "legacy" | "multichain" | "pairedToken" | "anyVested";

/**
 * How `payment.expected` was priced. `simulation`: the launch was executed in an `eth_call`
 * with the sender's code/balance overridden and the real ETH delta measured (exact at the quote
 * block). `protocolQuoteWithSimulatedImpact`: an ERC20-paired premine — the zap's linear quote
 * in the paired token, scaled by the price impact measured on the native-equivalent launch.
 * `protocolQuote`: the zap's `calculateFee` alone (no state-override support); it under-quotes
 * larger premines, so choose slippage accordingly.
 */
export type LaunchPreBuyPricingMethod =
  | "simulation"
  | "protocolQuoteWithSimulatedImpact"
  | "protocolQuote";

export const LAUNCH_PRE_BUY_REASON_CODES = [
  "CHAIN_UNSUPPORTED",
  "ROUTE_UNSUPPORTED",
  "GASLESS_UNSUPPORTED",
  "PROTECTED_LAUNCH_UNSUPPORTED",
  "PAIRED_MANAGER_LAUNCH_UNSUPPORTED",
  "ANY_FLAUNCH_UNSUPPORTED",
  "PAIRED_TOKEN_NOT_APPROVED",
  "ROUTE_PREMINE_UNAVAILABLE",
  "PREMINE_NOT_FILLABLE",
  "INVALID_PERCENTAGE",
  "EXCEEDS_ROUTE_LIMIT",
  "INVALID_LIMIT",
  "INVALID_SLIPPAGE",
  "INVALID_CREATOR",
  "PREMINE_ALREADY_SET",
  "FAIR_LAUNCH_UNSUPPORTED",
  "SENDER_REQUIRED",
  "QUOTE_INCONSISTENT",
  "INVALID_VESTING_SCHEDULE",
  "VESTED_SUPPLY_EXCEEDS_CAP",
] as const;
export type LaunchPreBuyReasonCode = (typeof LAUNCH_PRE_BUY_REASON_CODES)[number];

/** Why an executable plan must be re-planned before it can be signed. */
export type LaunchPreBuyRequoteReason =
  | "EXPIRED"
  | "CHAIN_MISMATCH"
  | "SENDER_MISMATCH"
  | "BINDING_MISMATCH"
  | "CALLDATA_MISMATCH"
  | "PRICE_MOVED"
  | "FEE_CHANGED";

/** A paired-token launch as the planner takes it: the premine is the planner's to set. */
export type PairedTokenPreBuyLaunchParams = Omit<
  PairedTokenFlaunchParams,
  "premineAmount"
> & {
  /** Must be absent or 0 — the planner derives the premine from `preBuyBps`. */
  premineAmount?: bigint;
  /** Must be absent or the zero address; a gated launch is not supported for pre-buy. */
  trustedFeeSigner?: Address;
  /** Not supported for a paired-token pre-buy in this version; presence is rejected. */
  treasuryManagerParams?: unknown;
};

/**
 * A vested launch as the planner takes it: the same `FlaunchVestedParams` the `flaunchVested*`
 * methods take, minus the premine (the planner's to set) and its spend cap (the planner's to
 * quote). Manager launches are allowed — the AnyFlaunchZap has the manager + `maxPremineCost`
 * overload.
 */
export type VestedPreBuyLaunchParams = Omit<
  FlaunchVestedParams,
  "premineAmount" | "maxPremineCost" | "slippageBps"
> & {
  /** Must be absent or 0 — the planner derives the premine from `preBuyBps`. */
  premineAmount?: bigint;
};

type LaunchPreBuyCommon = {
  /** Share of total supply to buy, in integer basis points: 100 = 1%. */
  preBuyBps: number;
  /** Headroom over the protocol's quoted cost, integer basis points 0..9999; enforced on chain. */
  slippageBps: number;
  /** The wallet that will send the launch. Defaults to the drift signer. */
  sender?: Address;
  /** Route limit override (integer 1..9999 bps). Defaults to `DEFAULT_MAX_PRE_BUY_BPS`. */
  maxPreBuyBps?: number;
  /** Plan lifetime in ms. Defaults to `DEFAULT_QUOTE_TTL_MS`. */
  quoteTtlMs?: number;
  /** For an ERC20 payment asset: approve this much instead of the maximum cost (must be ≥ it). */
  approvalAllowance?: bigint;
  /** Set when the caller intends a relayed / gasless launch — always unsupported for pre-buy. */
  gasless?: boolean;
};

export type LaunchPreBuyInput = LaunchPreBuyCommon &
  (
    | { route: "standard"; params: FlaunchParams }
    | { route: "revenueManager"; params: FlaunchWithRevenueManagerParams }
    | { route: "splitManager"; params: FlaunchWithSplitManagerParams }
    | {
        route: "dynamicSplitManager";
        params: FlaunchWithDynamicSplitManagerParams;
      }
    | { route: "pairedToken"; params: PairedTokenPreBuyLaunchParams }
    | { route: "vested"; params: VestedPreBuyLaunchParams }
  );

/** An asset identified precisely enough to display and to check balances: chain, address, decimals. `zeroAddress` = native ETH. */
export type PreBuyAsset = { chainId: number; address: Address; decimals: number };
export type PreBuyAmount = { asset: PreBuyAsset; amount: bigint };

export type LaunchPreBuyCall = { to: Address; data: Hex; value: bigint };
export type LaunchPreBuyApproveCall = LaunchPreBuyCall & {
  token: Address;
  spender: Address;
  amount: bigint;
};

export type LaunchPreBuyFundingLeg = { required: bigint; available: bigint };
export type LaunchPreBuyFunding = {
  /** ETH the sender must hold for `value` (gas excluded). */
  native: LaunchPreBuyFundingLeg;
  /** Present for an ERC20 payment asset: the paired-token balance versus `maxPremineCost`. */
  paired?: LaunchPreBuyFundingLeg;
  sufficient: boolean;
};

export type LaunchPreBuyPlan = {
  version: typeof LAUNCH_PRE_BUY_PLAN_VERSION;
  chainId: number;
  route: LaunchPreBuyRoute;
  zapFamily: LaunchPreBuyZapFamily;
  /** The wallet the plan was quoted for; execution refuses any other signer. */
  sender: Address;
  /** Receives the premined coins (the manager routes sweep them back to this address). */
  creator: Address;
  preBuyBps: number;
  /** Exact coins bought: `TOTAL_SUPPLY * preBuyBps / 10_000`. */
  premineAmount: bigint;
  slippageBps: number;
  /** The flaunching fee — always native ETH, separate from the purchase. */
  fee: PreBuyAmount;
  /**
   * The purchase. `expected` is the protocol's own quote at zero slippage (it already carries the
   * zap's 1% price-impact buffer); `max` adds `slippageBps` and is what the chain enforces.
   */
  payment: { asset: PreBuyAsset; expected: bigint; max: bigint };
  /** How `payment.expected` was derived, with the zap's own linear quote for comparison. */
  pricing: {
    method: LaunchPreBuyPricingMethod;
    /** The zap's `calculateFee` view of the purchase at 0 bps and at `slippageBps`. */
    protocolQuote: { expected: bigint; max: bigint };
  };
  /** Paired-token routes only: the zap's `_maxPremineCost` (equals `payment.max`). */
  maxPremineCost?: bigint;
  /** ETH sent with the launch — fee plus the maximum ETH-funded purchase; unspent ETH is refunded. */
  value: bigint;
  /** Route C ERC20 payment: the zap allowance to set before the launch. Empty otherwise. */
  approvals: LaunchPreBuyApproveCall[];
  launch: LaunchPreBuyCall;
  /** Paired-token and vested routes. */
  pairedToken?: Address;
  /** Vested route only: keccak256 of the ABI-encoded `VestingSchedule[]` the launch creates. */
  vestingSchedulesHash?: Hex;
  quoteBlockNumber: bigint;
  createdAtMs: number;
  expiresAtMs: number;
  funding: LaunchPreBuyFunding;
  /** keccak of the fields the launch is bound to; recomputed at execution. */
  binding: Hex;
};

export type LaunchPreBuyResult =
  | { supported: true; plan: LaunchPreBuyPlan }
  | {
      supported: false;
      chainId: number;
      route: LaunchPreBuyRoute;
      reasons: LaunchPreBuyReasonCode[];
    };

export type LaunchPreBuyPaymentAssetKind = "native" | "pairedErc20";

export type LaunchPreBuyRouteCapability = {
  supported: boolean;
  route: LaunchPreBuyRoute;
  maxPreBuyBps: number;
  paymentAssets: LaunchPreBuyPaymentAssetKind[];
  requiresApproval: "never" | "erc20Only";
  reasons: LaunchPreBuyReasonCode[];
};

export type LaunchPreBuyCapabilities = {
  chainId: number;
  /** True when at least one route supports pre-buy on this chain. */
  supported: boolean;
  defaultQuoteTtlMs: number;
  routes: Record<LaunchPreBuyRoute, LaunchPreBuyRouteCapability>;
  /** Launch kinds that never support pre-buy in this version, with their reason code. */
  unsupported: {
    pairedTokenWithManager: LaunchPreBuyReasonCode;
    anyFlaunch: LaunchPreBuyReasonCode;
    gasless: LaunchPreBuyReasonCode;
    protectedLaunch: LaunchPreBuyReasonCode;
  };
};

/** Coins for a share of supply in basis points. Exact: 1e29 is divisible by 1e4. */
export function preBuyAmountFromBps(bps: number): bigint {
  if (!isValidPreBuyBps(bps)) {
    throw new Error("preBuyBps must be an integer between 1 and 9,999");
  }
  return (TOTAL_SUPPLY * BigInt(bps)) / BPS_DENOMINATOR;
}

/** Inverse of `preBuyAmountFromBps` for display; exact only for planner-produced amounts. */
export function preBuyBpsFromAmount(amount: bigint): number {
  return Number((amount * BPS_DENOMINATOR) / TOTAL_SUPPLY);
}

export { percentToBps };

export function isValidPreBuyBps(bps: unknown): bps is number {
  return (
    typeof bps === "number" && Number.isSafeInteger(bps) && bps >= 1 && bps <= 9_999
  );
}

export function isValidSlippageBps(bps: unknown): bps is number {
  return (
    typeof bps === "number" && Number.isSafeInteger(bps) && bps >= 0 && bps <= 9_999
  );
}

export function zapFamilyForRoute(
  chainId: number,
  route: LaunchPreBuyRoute
): LaunchPreBuyZapFamily {
  if (route === "pairedToken") return "pairedToken";
  if (route === "vested") return "anyVested";
  return isMultichainDeployment(chainId) ? "multichain" : "legacy";
}

/** The zap a route launches through on `chainId`, or undefined when that family is not deployed. */
export function zapAddressForRoute(
  chainId: number,
  route: LaunchPreBuyRoute
): Address | undefined {
  switch (zapFamilyForRoute(chainId, route)) {
    case "pairedToken":
      return FlaunchZapV1_3Address[chainId];
    case "anyVested":
      return AnyFlaunchZapAddress[chainId];
    case "multichain":
      return FlaunchZapMultichainAddress[chainId];
    case "legacy":
      return FlaunchZapAddress[chainId];
  }
}

function routeReasons(chainId: number, route: LaunchPreBuyRoute): LaunchPreBuyReasonCode[] {
  if (!isChainSupported(chainId)) return ["CHAIN_UNSUPPORTED"];
  const reasons: LaunchPreBuyReasonCode[] = [];
  if (route === "pairedToken") {
    if (!doesChainSupportPairedTokenLaunch(chainId)) reasons.push("ROUTE_UNSUPPORTED");
    return reasons;
  }
  if (route === "vested") {
    if (!doesChainSupportVestedLaunch(chainId)) reasons.push("ROUTE_UNSUPPORTED");
    return reasons;
  }
  if (!zapAddressForRoute(chainId, route)) reasons.push("ROUTE_UNSUPPORTED");
  // The legacy Base zap (v1.1 PositionManager) fills a premine out of the fair-launch
  // allocation, which is deprecated and always 0 here — so it can never premine
  // (`PremineExceedsInitialAmount`). Launch through `pairedToken` with flETH / native ETH instead.
  if (zapFamilyForRoute(chainId, route) === "legacy") {
    reasons.push("ROUTE_PREMINE_UNAVAILABLE");
  }
  if (route === "splitManager" && !AddressFeeSplitManagerAddress[chainId]) {
    reasons.push("ROUTE_UNSUPPORTED");
  }
  if (
    route === "dynamicSplitManager" &&
    !DynamicAddressFeeSplitManagerAddress[chainId]
  ) {
    reasons.push("ROUTE_UNSUPPORTED");
  }
  return [...new Set(reasons)];
}

export function resolveMaxPreBuyBps(override?: number): number {
  if (override === undefined) return DEFAULT_MAX_PRE_BUY_BPS;
  if (!isValidPreBuyBps(override)) {
    throw new Error("maxPreBuyBps must be an integer between 1 and 9,999");
  }
  return override;
}

/**
 * The capability matrix for a chain: which routes can pre-buy, in what asset, with what limit.
 * Pure — built from the SDK's address maps — so a frontend can disable options before any RPC.
 */
export function getLaunchPreBuyCapabilities(
  chainId: number,
  options: { maxPreBuyBps?: number } = {}
): LaunchPreBuyCapabilities {
  const maxPreBuyBps = resolveMaxPreBuyBps(options.maxPreBuyBps);
  const routes = Object.fromEntries(
    LAUNCH_PRE_BUY_ROUTES.map((route) => {
      const reasons = routeReasons(chainId, route);
      // Both follow the pairing: native / flETH from msg.value, ERC20 pairings with an approval.
      const paired = route === "pairedToken" || route === "vested";
      const capability: LaunchPreBuyRouteCapability = {
        route,
        supported: reasons.length === 0,
        maxPreBuyBps,
        paymentAssets: paired ? ["native", "pairedErc20"] : ["native"],
        requiresApproval: paired ? "erc20Only" : "never",
        reasons,
      };
      return [route, capability];
    })
  ) as Record<LaunchPreBuyRoute, LaunchPreBuyRouteCapability>;

  return {
    chainId,
    supported: Object.values(routes).some((route) => route.supported),
    defaultQuoteTtlMs: DEFAULT_QUOTE_TTL_MS,
    routes,
    unsupported: {
      pairedTokenWithManager: "PAIRED_MANAGER_LAUNCH_UNSUPPORTED",
      anyFlaunch: "ANY_FLAUNCH_UNSUPPORTED",
      gasless: "GASLESS_UNSUPPORTED",
      protectedLaunch: "PROTECTED_LAUNCH_UNSUPPORTED",
    },
  };
}

function isEmptyBytes(value: string | undefined): boolean {
  return value === undefined || value === "0x" || value === "";
}

/**
 * Every static reason a pre-buy request cannot proceed, collected (not just the first) and
 * without touching the network. An empty list means the planner may quote.
 */
export function classifyLaunchPreBuyInput(
  chainId: number,
  input: LaunchPreBuyInput
): LaunchPreBuyReasonCode[] {
  const reasons = new Set<LaunchPreBuyReasonCode>(routeReasons(chainId, input.route));

  if (input.gasless) reasons.add("GASLESS_UNSUPPORTED");

  let maxPreBuyBps = DEFAULT_MAX_PRE_BUY_BPS;
  if (input.maxPreBuyBps !== undefined) {
    if (isValidPreBuyBps(input.maxPreBuyBps)) maxPreBuyBps = input.maxPreBuyBps;
    else reasons.add("INVALID_LIMIT");
  }
  if (!isValidPreBuyBps(input.preBuyBps)) reasons.add("INVALID_PERCENTAGE");
  else if (input.preBuyBps > maxPreBuyBps) reasons.add("EXCEEDS_ROUTE_LIMIT");
  if (!isValidSlippageBps(input.slippageBps)) reasons.add("INVALID_SLIPPAGE");

  const params = input.params;
  if (params.premineAmount !== undefined && params.premineAmount !== 0n) {
    reasons.add("PREMINE_ALREADY_SET");
  }
  if (!params.creator || params.creator === zeroAddress) reasons.add("INVALID_CREATOR");

  if (input.route === "pairedToken") {
    const paired = input.params;
    if (!isEmptyBytes(paired.feeCalculatorParams)) reasons.add("PROTECTED_LAUNCH_UNSUPPORTED");
    if (paired.trustedFeeSigner && paired.trustedFeeSigner !== zeroAddress) {
      reasons.add("PROTECTED_LAUNCH_UNSUPPORTED");
    }
    if (paired.treasuryManagerParams !== undefined) {
      reasons.add("PAIRED_MANAGER_LAUNCH_UNSUPPORTED");
    }
  } else if (input.route === "vested") {
    const vested = input.params;
    if (!isEmptyBytes(vested.feeCalculatorParams)) reasons.add("PROTECTED_LAUNCH_UNSUPPORTED");
    if (vested.trustedSignerSettings !== undefined) reasons.add("PROTECTED_LAUNCH_UNSUPPORTED");
    try {
      if (vested.vestingSchedules.length === 0) throw new Error("no schedules");
      toVestingScheduleArgs(vested.vestingSchedules);
    } catch {
      reasons.add("INVALID_VESTING_SCHEDULE");
    }
  } else {
    const flaunch = input.params;
    if (flaunch.trustedSignerSettings !== undefined) reasons.add("PROTECTED_LAUNCH_UNSUPPORTED");
    if (flaunch.fairLaunchPercent !== 0) reasons.add("FAIR_LAUNCH_UNSUPPORTED");
    if (isMultichainDeployment(chainId) && flaunch.fairLaunchDuration !== 0) {
      reasons.add("FAIR_LAUNCH_UNSUPPORTED");
    }
  }

  return [...reasons];
}

/** The fields a plan is bound to. Everything the launch spends or targets; nothing cosmetic. */
export type LaunchPreBuyBindingFields = Pick<
  LaunchPreBuyPlan,
  | "version"
  | "chainId"
  | "route"
  | "zapFamily"
  | "sender"
  | "creator"
  | "preBuyBps"
  | "premineAmount"
  | "slippageBps"
  | "value"
  | "maxPremineCost"
  | "pairedToken"
  | "vestingSchedulesHash"
  | "quoteBlockNumber"
  | "expiresAtMs"
> & { launch: LaunchPreBuyCall; payment: { asset: PreBuyAsset; max: bigint }; fee: PreBuyAmount };

/**
 * keccak256 over the canonical JSON of the bound fields (sorted keys, lower-cased addresses,
 * bigints as decimal strings). Recomputed before execution so any edit to a plan is detected.
 */
export function computeLaunchPreBuyBinding(plan: LaunchPreBuyBindingFields): Hex {
  const canonical = {
    chainId: plan.chainId,
    creator: plan.creator.toLowerCase(),
    expiresAtMs: plan.expiresAtMs,
    feeAmount: plan.fee.amount.toString(),
    feeAsset: assetKey(plan.fee.asset),
    launchData: plan.launch.data.toLowerCase(),
    launchTo: plan.launch.to.toLowerCase(),
    launchValue: plan.launch.value.toString(),
    maxPremineCost: plan.maxPremineCost === undefined ? null : plan.maxPremineCost.toString(),
    pairedToken: plan.pairedToken?.toLowerCase() ?? null,
    paymentAsset: assetKey(plan.payment.asset),
    paymentMax: plan.payment.max.toString(),
    preBuyBps: plan.preBuyBps,
    premineAmount: plan.premineAmount.toString(),
    quoteBlockNumber: plan.quoteBlockNumber.toString(),
    route: plan.route,
    sender: plan.sender.toLowerCase(),
    slippageBps: plan.slippageBps,
    value: plan.value.toString(),
    version: plan.version,
    // Only present on the vested route so existing routes' bindings are unchanged.
    ...(plan.vestingSchedulesHash
      ? { vestingSchedulesHash: plan.vestingSchedulesHash.toLowerCase() }
      : {}),
    zapFamily: plan.zapFamily,
  };
  return keccak256(stringToHex(JSON.stringify(canonical)));
}

function assetKey(asset: PreBuyAsset): string {
  return `${asset.chainId}:${asset.address.toLowerCase()}:${asset.decimals}`;
}

export function nativeAsset(chainId: number): PreBuyAsset {
  return { chainId, address: zeroAddress, decimals: 18 };
}
