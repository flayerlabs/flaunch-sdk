import {
  type Drift,
  type ReadWriteAdapter,
  type Address as DriftAddress,
} from "@delvtech/drift";
import {
  type Address,
  type Hex,
  decodeFunctionData,
  encodeFunctionData,
  isAddressEqual,
  zeroAddress,
} from "viem";
import { FlaunchZapAbi } from "../abi/FlaunchZap";
import { FlaunchZapV1_1_6Abi } from "../abi/FlaunchZapV1_1_6";
import { FlaunchZapV1_3Abi } from "../abi/FlaunchZapV1_3";
import {
  buildBaseFlaunchArgs,
  toFlaunchParamsWithDynamicSplitManager,
  toFlaunchParamsWithRevenueManager,
  toFlaunchParamsWithSplitManager,
  type BaseFlaunchArgs,
  type FlaunchParams,
  type ReadFlaunchZap,
  type ReadWriteFlaunchZap,
} from "../clients/FlaunchZapClient";
import {
  buildMultichainFlaunchArgs,
  type MultichainFlaunchArgs,
  type ReadFlaunchZapMultichain,
  type ReadWriteFlaunchZapMultichain,
} from "../clients/FlaunchZapMultichainClient";
import {
  type PairedTokenFlaunchParams,
  type ReadFlaunchZapV1_3,
  type ReadWriteFlaunchZapV1_3,
} from "../clients/FlaunchZapV1_3Client";
import { ReadMemecoin, ReadWriteMemecoin } from "../clients/MemecoinClient";
import type { ReadPairedTokenRegistryV1_3 } from "../clients/PairedTokenRegistryV1_3Client";
import { PAIRED_TOKEN_TYPE } from "../types";
import type { LaunchCostProbe } from "./launchCostProbe";
import {
  LaunchPreBuyInsufficientBalanceError,
  LaunchPreBuyRequoteRequiredError,
} from "./errors";
import {
  DEFAULT_QUOTE_TTL_MS,
  LAUNCH_PRE_BUY_PLAN_VERSION,
  classifyLaunchPreBuyInput,
  computeLaunchPreBuyBinding,
  nativeAsset,
  preBuyAmountFromBps,
  zapAddressForRoute,
  zapFamilyForRoute,
  type LaunchPreBuyApproveCall,
  type LaunchPreBuyFunding,
  type LaunchPreBuyInput,
  type LaunchPreBuyPlan,
  type LaunchPreBuyPricingMethod,
  type LaunchPreBuyReasonCode,
  type LaunchPreBuyRequoteReason,
  type LaunchPreBuyResult,
  type LaunchPreBuyZapFamily,
  type PreBuyAsset,
} from "./launchPreBuy";

/*
 * RPC-backed half of launch pre-buy. Functions take a dependency bag rather than the SDK
 * instance so they can be driven by a recording drift in tests; ReadFlaunchSDK /
 * ReadWriteFlaunchSDK wrap them with their own clients.
 */

export type LaunchPreBuyPlannerDeps = {
  chainId: number;
  drift: Drift;
  legacyZap?: ReadFlaunchZap;
  multichainZap?: ReadFlaunchZapMultichain;
  pairedZap?: ReadFlaunchZapV1_3;
  pairedRegistry?: ReadPairedTokenRegistryV1_3;
  /** Resolves the explicit sender or the drift signer; undefined when neither exists. */
  senderFor: (explicit?: Address) => Promise<Address | undefined>;
  /**
   * Executes a launch in an `eth_call` with the sender's code and balance overridden and
   * returns the ETH it really consumed (see ./launchCostProbe.ts). Without it the planner falls
   * back to the zap's linear quote and says so in `pricing.method`.
   */
  probeLaunchCost?: LaunchCostProbe;
};

export type LaunchPreBuyExecutorDeps = LaunchPreBuyPlannerDeps & {
  drift: Drift<ReadWriteAdapter>;
  legacyZapWriter?: ReadWriteFlaunchZap;
  multichainZapWriter?: ReadWriteFlaunchZapMultichain;
  pairedZapWriter?: ReadWriteFlaunchZapV1_3;
};

export type LaunchPreBuyVerification =
  | { mode: "quote"; fee: bigint; expectedTotal: bigint }
  | { mode: "simulate"; fee: bigint; expectedTotal: bigint; ethSpent: bigint; memecoin: Address };

export type LaunchPreBuyExecuteOptions = {
  /**
   * `simulate` (default) re-quotes and `eth_call`s the launch as the sender before signing;
   * `quote` only re-quotes; `none` trusts the plan's own checks (chain, signer, expiry, binding,
   * calldata, balances still run). On-chain caps apply regardless.
   */
  revalidate?: "simulate" | "quote" | "none";
};

export type LaunchPreBuyExecution = { hash: Hex; plan: LaunchPreBuyPlan };

type PreparedLaunch =
  | {
      zapFamily: "legacy";
      args: BaseFlaunchArgs;
      initialPriceParams: Hex;
      premineAmount: bigint;
      data: Hex;
    }
  | {
      zapFamily: "multichain";
      prepared: MultichainFlaunchArgs;
      premineAmount: bigint;
      data: Hex;
    }
  | {
      zapFamily: "pairedToken";
      flaunchParams: PairedTokenFlaunchParams;
      premineAmount: bigint;
      data: Hex;
    };

function flaunchParamsForRoute(input: LaunchPreBuyInput, chainId: number): FlaunchParams {
  switch (input.route) {
    case "standard":
      return input.params;
    case "revenueManager":
      return toFlaunchParamsWithRevenueManager(input.params);
    case "splitManager":
      return toFlaunchParamsWithSplitManager(input.params, chainId);
    case "dynamicSplitManager":
      return toFlaunchParamsWithDynamicSplitManager(input.params, chainId);
    case "pairedToken":
      throw new Error("pairedToken launches do not use FlaunchParams");
  }
}

export function encodeLegacyFlaunch(args: BaseFlaunchArgs): Hex {
  return encodeFunctionData({
    abi: FlaunchZapV1_1_6Abi,
    functionName: "flaunch",
    args: [
      args._flaunchParams,
      args._trustedFeeSigner,
      args._premineSwapHookData,
      args._whitelistParams,
      args._airdropParams,
      args._treasuryManagerParams,
    ],
  });
}

export function encodeMultichainFlaunch(prepared: MultichainFlaunchArgs): Hex {
  if (prepared.overload === "plain") {
    return encodeFunctionData({
      abi: FlaunchZapAbi,
      functionName: "flaunch",
      args: [prepared.args._flaunchParams, prepared.args._trustedFeeSigner],
    });
  }
  return encodeFunctionData({
    abi: FlaunchZapAbi,
    functionName: "flaunch",
    args: [
      prepared.args._flaunchParams,
      prepared.args._treasuryManagerParams,
      prepared.args._trustedFeeSigner,
    ],
  });
}

export function encodePairedFlaunch(
  flaunchParams: PairedTokenFlaunchParams,
  trustedFeeSigner: Address,
  maxPremineCost: bigint
): Hex {
  return encodeFunctionData({
    abi: FlaunchZapV1_3Abi,
    functionName: "flaunch",
    args: [flaunchParams, trustedFeeSigner, maxPremineCost],
  });
}

/** Strips planner-only fields and pins the premine; the shape the v1.3 zap struct expects. */
function toPairedFlaunchParams(
  params: LaunchPreBuyInput extends infer T
    ? T extends { route: "pairedToken"; params: infer P }
      ? P
      : never
    : never,
  premineAmount: bigint
): PairedTokenFlaunchParams {
  return {
    name: params.name,
    symbol: params.symbol,
    tokenUri: params.tokenUri,
    premineAmount,
    creator: params.creator,
    creatorFeeAllocation: params.creatorFeeAllocation,
    flaunchAt: params.flaunchAt,
    initialPriceParams: params.initialPriceParams,
    feeCalculatorParams: params.feeCalculatorParams,
    pairedToken: params.pairedToken,
  };
}

function prepareLaunch(
  chainId: number,
  input: LaunchPreBuyInput,
  premineAmount: bigint,
  maxPremineCost: bigint
): PreparedLaunch {
  const zapFamily = zapFamilyForRoute(chainId, input.route);
  if (input.route === "pairedToken") {
    const flaunchParams = toPairedFlaunchParams(input.params, premineAmount);
    return {
      zapFamily: "pairedToken",
      flaunchParams,
      premineAmount,
      data: encodePairedFlaunch(flaunchParams, zeroAddress, maxPremineCost),
    };
  }
  const params: FlaunchParams = {
    ...flaunchParamsForRoute(input, chainId),
    premineAmount,
  };
  if (zapFamily === "multichain") {
    const prepared = buildMultichainFlaunchArgs(chainId, params);
    return {
      zapFamily,
      prepared,
      premineAmount,
      data: encodeMultichainFlaunch(prepared),
    };
  }
  const { args, initialPriceParams } = buildBaseFlaunchArgs(chainId, params);
  return {
    zapFamily: "legacy",
    args,
    initialPriceParams,
    premineAmount,
    data: encodeLegacyFlaunch(args),
  };
}

async function clearCache(client: { contract: { cache?: { clear?: () => unknown } } } | undefined) {
  await client?.contract.cache?.clear?.();
}

type EthQuotes = { fee: bigint; expected: bigint; max: bigint };

/** Three pinned `calculateFee` reads for an ETH-funded route: fee only, premine at 0 bps, premine at `slippageBps`. */
async function quoteEthRoute(
  deps: LaunchPreBuyPlannerDeps,
  prepared: Exclude<PreparedLaunch, { zapFamily: "pairedToken" }>,
  slippageBps: bigint,
  block?: bigint
): Promise<EthQuotes> {
  const options = block === undefined ? undefined : { block };
  if (prepared.zapFamily === "legacy") {
    const zap = deps.legacyZap;
    if (!zap) throw new Error(`Legacy FlaunchZap is not available on chain ${deps.chainId}`);
    const read = (premineAmount: bigint, slippage: bigint) =>
      zap.calculateFeeBps(
        { premineAmount, slippageBps: slippage, initialPriceParams: prepared.initialPriceParams },
        options
      );
    const [fee, expected, max] = await Promise.all([
      read(0n, 0n),
      read(prepared.premineAmount, 0n),
      read(prepared.premineAmount, slippageBps),
    ]);
    return { fee, expected, max };
  }
  const zap = deps.multichainZap;
  if (!zap) throw new Error(`Multichain FlaunchZap is not available on chain ${deps.chainId}`);
  const struct = prepared.prepared.args._flaunchParams;
  const [fee, expected, max] = await Promise.all([
    zap.calculateFeeBps({ ...struct, premineAmount: 0n }, 0n, options),
    zap.calculateFeeBps(struct, 0n, options),
    zap.calculateFeeBps(struct, slippageBps, options),
  ]);
  return { fee, expected, max };
}

type PairedQuotes = {
  fee: { ethRequired: bigint; pairedPremineCost: bigint };
  expected: { ethRequired: bigint; pairedPremineCost: bigint };
  max: { ethRequired: bigint; pairedPremineCost: bigint };
};

async function quotePairedRoute(
  deps: LaunchPreBuyPlannerDeps,
  flaunchParams: PairedTokenFlaunchParams,
  slippageBps: bigint,
  block?: bigint
): Promise<PairedQuotes> {
  const zap = deps.pairedZap;
  if (!zap) throw new Error(`Paired-token FlaunchZap is not available on chain ${deps.chainId}`);
  const options = block === undefined ? undefined : { block };
  const [fee, expected, max] = await Promise.all([
    zap.calculateFee({ flaunchParams: { ...flaunchParams, premineAmount: 0n }, slippageBps: 0n }, options),
    zap.calculateFee({ flaunchParams, slippageBps: 0n }, options),
    zap.calculateFee({ flaunchParams, slippageBps }, options),
  ]);
  return { fee, expected, max };
}

/** `amount * (10_000 + bps) / 10_000`, rounded up so the cap never sits below the quote. */
function withSlippage(amount: bigint, slippageBps: bigint): bigint {
  return (amount * (10_000n + slippageBps) + 9_999n) / 10_000n;
}

const maxBigint = (a: bigint, b: bigint) => (a > b ? a : b);

/** Thrown inside the planner when the pricing probe reverts: the premine cannot be filled. */
class PremineNotFillableError extends Error {
  constructor(public readonly cause: unknown) {
    super("The premine cannot be filled at this size");
  }
}

type PremineCostPricing = {
  method: LaunchPreBuyPricingMethod;
  /** The purchase alone (fee excluded), in the payment asset. */
  expected: bigint;
};

/**
 * Prices an ETH-funded launch. With a probe: the exact ETH the launch consumes at `block`,
 * measured on the sender with an ample cap (the zaps refund the rest, and neither
 * `calculateFee` nor the multichain zap's `ethSpent_` reflects the real fill). Without one: the
 * zap's linear quote.
 */
async function priceEthLaunch(
  deps: LaunchPreBuyPlannerDeps,
  params: {
    sender: Address;
    to: Address;
    data: Hex;
    fee: bigint;
    linearExpected: bigint;
    linearMax: bigint;
    block?: bigint;
  }
): Promise<PremineCostPricing> {
  if (!deps.probeLaunchCost) {
    return { method: "protocolQuote", expected: params.linearExpected };
  }
  const cap = params.fee + maxBigint(params.linearMax, params.linearExpected * 3n) + 1n;
  let spent: bigint;
  try {
    ({ spent } = await deps.probeLaunchCost({
      sender: params.sender,
      to: params.to,
      data: params.data,
      value: cap,
      blockNumber: params.block,
    }));
  } catch (cause) {
    throw new PremineNotFillableError(cause);
  }
  if (spent < params.fee) throw new Error("Launch probe spent less than the flaunching fee");
  return { method: "simulation", expected: spent - params.fee };
}

/**
 * Prices an ERC20-paired premine. The paired token cannot be conjured for a probe, but the
 * pool the premine fills is the same curve whatever the pairing, so the zap's linear quote in
 * the paired token is scaled by the price impact measured on the native-equivalent launch.
 */
async function priceErc20Premine(
  deps: LaunchPreBuyPlannerDeps,
  params: {
    sender: Address;
    to: Address;
    flaunchParams: PairedTokenFlaunchParams;
    linearExpected: bigint;
    block?: bigint;
  }
): Promise<PremineCostPricing> {
  if (!deps.probeLaunchCost) {
    return { method: "protocolQuote", expected: params.linearExpected };
  }
  const nativeParams = { ...params.flaunchParams, pairedToken: zeroAddress };
  const native = await quotePairedRoute(deps, nativeParams, 0n, params.block);
  const nativeFee = native.fee.ethRequired;
  const linearNative = native.expected.ethRequired - nativeFee;
  if (linearNative <= 0n) {
    return { method: "protocolQuote", expected: params.linearExpected };
  }
  const priced = await priceEthLaunch(deps, {
    sender: params.sender,
    to: params.to,
    data: encodePairedFlaunch(nativeParams, zeroAddress, 0n),
    fee: nativeFee,
    linearExpected: linearNative,
    linearMax: linearNative,
    block: params.block,
  });
  return {
    method: "protocolQuoteWithSimulatedImpact",
    expected: (params.linearExpected * priced.expected + linearNative - 1n) / linearNative,
  };
}

type PaymentResolution =
  | { kind: "native" }
  | { kind: "erc20"; asset: PreBuyAsset }
  | { kind: "unapproved" };

/** How a paired token's premine is paid, from the registry row. `zeroAddress` is native ETH without a read. */
async function resolvePairedPayment(
  deps: LaunchPreBuyPlannerDeps,
  pairedToken: Address,
  block?: bigint
): Promise<PaymentResolution> {
  if (pairedToken === zeroAddress) return { kind: "native" };
  const registry = deps.pairedRegistry;
  if (!registry) throw new Error(`Paired-token registry is not available on chain ${deps.chainId}`);
  const config = await registry.tokenConfig(
    pairedToken,
    block === undefined ? undefined : { block }
  );
  if (!config.approved || config.tokenType === PAIRED_TOKEN_TYPE.unset) {
    return { kind: "unapproved" };
  }
  if (
    config.tokenType === PAIRED_TOKEN_TYPE.nativeEth ||
    config.tokenType === PAIRED_TOKEN_TYPE.nativeWrapper
  ) {
    return { kind: "native" };
  }
  return {
    kind: "erc20",
    asset: { chainId: deps.chainId, address: pairedToken, decimals: config.decimals },
  };
}

function buildApprove(token: Address, spender: Address, amount: bigint): LaunchPreBuyApproveCall {
  return {
    token,
    spender,
    amount,
    to: token,
    value: 0n,
    data: encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "approve",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
        },
      ] as const,
      functionName: "approve",
      args: [spender, amount],
    }),
  };
}

async function readFunding(
  deps: LaunchPreBuyPlannerDeps,
  sender: Address,
  value: bigint,
  paired: { token: Address; required: bigint } | undefined,
  block?: bigint
): Promise<LaunchPreBuyFunding> {
  const nativeAvailable = await deps.drift.getBalance({
    address: sender as DriftAddress,
    ...(block === undefined ? {} : { block }),
  });
  const native = { required: value, available: nativeAvailable };
  if (!paired) {
    return { native, sufficient: nativeAvailable >= value };
  }
  const memecoin = new ReadMemecoin(paired.token, deps.drift);
  await clearCache(memecoin);
  const available = await memecoin.contract.read(
    "balanceOf",
    { account: sender },
    block === undefined ? undefined : { block }
  );
  const pairedLeg = { required: paired.required, available };
  return {
    native,
    paired: pairedLeg,
    sufficient: nativeAvailable >= value && available >= paired.required,
  };
}

/**
 * Quotes a launch-with-pre-buy at one pinned block and returns an executable plan, or the
 * reasons it cannot be planned. Never sends anything.
 */
export async function planLaunchPreBuy(
  deps: LaunchPreBuyPlannerDeps,
  input: LaunchPreBuyInput
): Promise<LaunchPreBuyResult> {
  const { chainId } = deps;
  const unsupported = (reasons: LaunchPreBuyReasonCode[]): LaunchPreBuyResult => ({
    supported: false,
    chainId,
    route: input.route,
    reasons,
  });

  const staticReasons = classifyLaunchPreBuyInput(chainId, input);
  if (staticReasons.length > 0) return unsupported(staticReasons);

  const sender = await deps.senderFor(input.sender);
  if (!sender) return unsupported(["SENDER_REQUIRED"]);

  const premineAmount = preBuyAmountFromBps(input.preBuyBps);
  const slippageBps = BigInt(input.slippageBps);
  const zapFamily = zapFamilyForRoute(chainId, input.route);
  const to = zapAddressForRoute(chainId, input.route);
  if (!to) return unsupported(["ROUTE_UNSUPPORTED"]);

  await Promise.all([
    clearCache(deps.legacyZap),
    clearCache(deps.multichainZap),
    clearCache(deps.pairedZap),
    clearCache(deps.pairedRegistry),
  ]);
  const quoteBlockNumber = await deps.drift.getBlockNumber();
  const createdAtMs = Date.now();
  const expiresAtMs = createdAtMs + (input.quoteTtlMs ?? DEFAULT_QUOTE_TTL_MS);
  const fee = nativeAsset(chainId);

  let plan: Omit<LaunchPreBuyPlan, "binding">;

  if (input.route === "pairedToken") {
    // Quote once with a placeholder cap; the cap is only a calldata argument and does not
    // influence the fee reads, so the calldata is re-encoded with the real maximum below.
    const flaunchParams = toPairedFlaunchParams(input.params, premineAmount);
    const [quotes, payment] = await Promise.all([
      quotePairedRoute(deps, flaunchParams, slippageBps, quoteBlockNumber),
      resolvePairedPayment(deps, flaunchParams.pairedToken, quoteBlockNumber),
    ]);
    if (payment.kind === "unapproved") return unsupported(["PAIRED_TOKEN_NOT_APPROVED"]);
    const feeAmount = quotes.fee.ethRequired;
    if (payment.kind === "native") {
      if (quotes.max.ethRequired < quotes.expected.ethRequired || quotes.expected.ethRequired < feeAmount) {
        return unsupported(["QUOTE_INCONSISTENT"]);
      }
      const linearExpected = quotes.expected.ethRequired - feeAmount;
      const linearMax = quotes.max.ethRequired - feeAmount;
      let priced: PremineCostPricing;
      try {
        priced = await priceEthLaunch(deps, {
          sender,
          to,
          // `_maxPremineCost` is ignored for a native pairing; price with the linear cap.
          data: encodePairedFlaunch(flaunchParams, zeroAddress, linearMax),
          fee: feeAmount,
          linearExpected,
          linearMax,
          block: quoteBlockNumber,
        });
      } catch (error) {
        if (error instanceof PremineNotFillableError) return unsupported(["PREMINE_NOT_FILLABLE"]);
        throw error;
      }
      const max = withSlippage(priced.expected, slippageBps);
      const value = feeAmount + max;
      const data = encodePairedFlaunch(flaunchParams, zeroAddress, max);
      plan = {
        version: LAUNCH_PRE_BUY_PLAN_VERSION,
        chainId,
        route: input.route,
        zapFamily,
        sender,
        creator: flaunchParams.creator,
        preBuyBps: input.preBuyBps,
        premineAmount,
        slippageBps: input.slippageBps,
        fee: { asset: fee, amount: feeAmount },
        payment: { asset: fee, expected: priced.expected, max },
        pricing: { method: priced.method, protocolQuote: { expected: linearExpected, max: linearMax } },
        maxPremineCost: max,
        value,
        approvals: [],
        launch: { to, data, value },
        pairedToken: flaunchParams.pairedToken,
        quoteBlockNumber,
        createdAtMs,
        expiresAtMs,
        funding: await readFunding(deps, sender, value, undefined, quoteBlockNumber),
      };
    } else {
      if (
        quotes.max.ethRequired !== feeAmount ||
        quotes.max.pairedPremineCost < quotes.expected.pairedPremineCost
      ) {
        return unsupported(["QUOTE_INCONSISTENT"]);
      }
      const value = quotes.max.ethRequired;
      const linearExpected = quotes.expected.pairedPremineCost;
      const linearMax = quotes.max.pairedPremineCost;
      let priced: PremineCostPricing;
      try {
        priced = await priceErc20Premine(deps, {
          sender,
          to,
          flaunchParams,
          linearExpected,
          block: quoteBlockNumber,
        });
      } catch (error) {
        if (error instanceof PremineNotFillableError) return unsupported(["PREMINE_NOT_FILLABLE"]);
        throw error;
      }
      const maxPremineCost = withSlippage(priced.expected, slippageBps);
      if (input.approvalAllowance !== undefined && input.approvalAllowance < maxPremineCost) {
        throw new Error("approvalAllowance must be at least the maximum premine cost");
      }
      const memecoin = new ReadMemecoin(payment.asset.address, deps.drift);
      await clearCache(memecoin);
      const allowance = await memecoin.contract.read(
        "allowance",
        { owner: sender, spender: to },
        { block: quoteBlockNumber }
      );
      const data = encodePairedFlaunch(flaunchParams, zeroAddress, maxPremineCost);
      plan = {
        version: LAUNCH_PRE_BUY_PLAN_VERSION,
        chainId,
        route: input.route,
        zapFamily,
        sender,
        creator: flaunchParams.creator,
        preBuyBps: input.preBuyBps,
        premineAmount,
        slippageBps: input.slippageBps,
        fee: { asset: fee, amount: feeAmount },
        payment: { asset: payment.asset, expected: priced.expected, max: maxPremineCost },
        pricing: { method: priced.method, protocolQuote: { expected: linearExpected, max: linearMax } },
        maxPremineCost,
        value,
        approvals:
          allowance < maxPremineCost
            ? [buildApprove(payment.asset.address, to, input.approvalAllowance ?? maxPremineCost)]
            : [],
        launch: { to, data, value },
        pairedToken: flaunchParams.pairedToken,
        quoteBlockNumber,
        createdAtMs,
        expiresAtMs,
        funding: await readFunding(
          deps,
          sender,
          value,
          { token: payment.asset.address, required: maxPremineCost },
          quoteBlockNumber
        ),
      };
    }
  } else {
    const prepared = prepareLaunch(chainId, input, premineAmount, 0n);
    if (prepared.zapFamily === "pairedToken") throw new Error("unreachable");
    const quotes = await quoteEthRoute(deps, prepared, slippageBps, quoteBlockNumber);
    if (quotes.max < quotes.expected || quotes.expected < quotes.fee) {
      return unsupported(["QUOTE_INCONSISTENT"]);
    }
    const linearExpected = quotes.expected - quotes.fee;
    const linearMax = quotes.max - quotes.fee;
    let priced: PremineCostPricing;
    try {
      priced = await priceEthLaunch(deps, {
        sender,
        to,
        data: prepared.data,
        fee: quotes.fee,
        linearExpected,
        linearMax,
        block: quoteBlockNumber,
      });
    } catch (error) {
      if (error instanceof PremineNotFillableError) return unsupported(["PREMINE_NOT_FILLABLE"]);
      throw error;
    }
    const max = withSlippage(priced.expected, slippageBps);
    const value = quotes.fee + max;
    plan = {
      version: LAUNCH_PRE_BUY_PLAN_VERSION,
      chainId,
      route: input.route,
      zapFamily,
      sender,
      creator: input.params.creator,
      preBuyBps: input.preBuyBps,
      premineAmount,
      slippageBps: input.slippageBps,
      fee: { asset: fee, amount: quotes.fee },
      payment: { asset: fee, expected: priced.expected, max },
      pricing: { method: priced.method, protocolQuote: { expected: linearExpected, max: linearMax } },
      value,
      approvals: [],
      launch: { to, data: prepared.data, value },
      quoteBlockNumber,
      createdAtMs,
      expiresAtMs,
      funding: await readFunding(deps, sender, value, undefined, quoteBlockNumber),
    };
  }

  return { supported: true, plan: { ...plan, binding: computeLaunchPreBuyBinding(plan) } };
}

/** The launch arguments a plan's calldata decodes to, per zap family. */
export type DecodedLaunchPreBuyCalldata =
  | { zapFamily: "legacy"; args: BaseFlaunchArgs }
  | { zapFamily: "multichain"; prepared: MultichainFlaunchArgs }
  | {
      zapFamily: "pairedToken";
      flaunchParams: PairedTokenFlaunchParams;
      trustedFeeSigner: Address;
      maxPremineCost: bigint;
    };

export function decodeLaunchPreBuyCalldata(
  zapFamily: LaunchPreBuyZapFamily,
  data: Hex
): DecodedLaunchPreBuyCalldata {
  if (zapFamily === "legacy") {
    const decoded = decodeFunctionData({ abi: FlaunchZapV1_1_6Abi, data });
    if (decoded.functionName !== "flaunch" || decoded.args.length !== 6) {
      throw new Error("Not a legacy zap flaunch call");
    }
    const [flaunchParams, trustedFeeSigner, premineSwapHookData, whitelist, airdrop, manager] =
      decoded.args;
    return {
      zapFamily,
      args: {
        _flaunchParams: { ...flaunchParams },
        _trustedFeeSigner: trustedFeeSigner,
        _premineSwapHookData: premineSwapHookData,
        _treasuryManagerParams: { ...manager },
        _whitelistParams: { ...whitelist },
        _airdropParams: { ...airdrop },
      },
    };
  }
  if (zapFamily === "multichain") {
    const decoded = decodeFunctionData({ abi: FlaunchZapAbi, data });
    if (decoded.functionName !== "flaunch") throw new Error("Not a multichain zap flaunch call");
    if (decoded.args.length === 2) {
      const [flaunchParams, trustedFeeSigner] = decoded.args;
      return {
        zapFamily,
        prepared: {
          overload: "plain",
          args: { _flaunchParams: { ...flaunchParams }, _trustedFeeSigner: trustedFeeSigner },
        },
      };
    }
    const [flaunchParams, manager, trustedFeeSigner] = decoded.args;
    return {
      zapFamily,
      prepared: {
        overload: "manager",
        args: {
          _flaunchParams: { ...flaunchParams },
          _treasuryManagerParams: { ...manager },
          _trustedFeeSigner: trustedFeeSigner,
        },
      },
    };
  }
  const decoded = decodeFunctionData({ abi: FlaunchZapV1_3Abi, data });
  if (decoded.functionName !== "flaunch") throw new Error("Not a paired-token zap flaunch call");
  const [flaunchParams, trustedFeeSigner, maxPremineCost] = decoded.args;
  return {
    zapFamily,
    flaunchParams: { ...flaunchParams },
    trustedFeeSigner,
    maxPremineCost,
  };
}

function requote(reason: LaunchPreBuyRequoteReason, message?: string, cause?: unknown): never {
  throw new LaunchPreBuyRequoteRequiredError(reason, message, cause);
}

/**
 * The plan's own consistency: chain, signer, expiry, binding and calldata agreement. Throws
 * `LaunchPreBuyRequoteRequiredError`; on success returns the decoded launch arguments.
 */
export async function assertLaunchPreBuyPlanCurrent(
  deps: LaunchPreBuyPlannerDeps,
  plan: LaunchPreBuyPlan,
  options: { signer?: Address; nowMs?: number } = {}
): Promise<DecodedLaunchPreBuyCalldata> {
  if (plan.version !== LAUNCH_PRE_BUY_PLAN_VERSION) {
    requote("BINDING_MISMATCH", "Unsupported pre-buy plan version");
  }
  if (plan.chainId !== deps.chainId) {
    requote("CHAIN_MISMATCH", `Pre-buy plan belongs to chain ${plan.chainId}, SDK is on ${deps.chainId}`);
  }
  if (options.signer && !isAddressEqual(options.signer, plan.sender)) {
    requote("SENDER_MISMATCH", "Pre-buy plan was quoted for a different sender");
  }
  if ((options.nowMs ?? Date.now()) >= plan.expiresAtMs) {
    requote("EXPIRED", "Pre-buy quote has expired");
  }
  if (computeLaunchPreBuyBinding(plan) !== plan.binding) {
    requote("BINDING_MISMATCH", "Pre-buy plan was modified after planning");
  }
  const expectedTo = zapAddressForRoute(deps.chainId, plan.route);
  if (
    !expectedTo ||
    !isAddressEqual(plan.launch.to, expectedTo) ||
    plan.launch.value !== plan.value ||
    plan.zapFamily !== zapFamilyForRoute(deps.chainId, plan.route)
  ) {
    requote("CALLDATA_MISMATCH", "Pre-buy plan targets an unexpected zap");
  }

  let decoded: DecodedLaunchPreBuyCalldata;
  try {
    decoded = decodeLaunchPreBuyCalldata(plan.zapFamily, plan.launch.data);
  } catch (cause) {
    requote("CALLDATA_MISMATCH", "Pre-buy plan calldata does not decode", cause);
  }

  const struct =
    decoded.zapFamily === "legacy"
      ? decoded.args._flaunchParams
      : decoded.zapFamily === "multichain"
        ? decoded.prepared.args._flaunchParams
        : decoded.flaunchParams;
  const trustedFeeSigner =
    decoded.zapFamily === "legacy"
      ? decoded.args._trustedFeeSigner
      : decoded.zapFamily === "multichain"
        ? decoded.prepared.args._trustedFeeSigner
        : decoded.trustedFeeSigner;
  const agrees =
    struct.premineAmount === plan.premineAmount &&
    isAddressEqual(struct.creator, plan.creator) &&
    trustedFeeSigner === zeroAddress &&
    struct.feeCalculatorParams === "0x" &&
    (decoded.zapFamily !== "pairedToken" ||
      (decoded.maxPremineCost === plan.maxPremineCost &&
        plan.pairedToken !== undefined &&
        isAddressEqual(decoded.flaunchParams.pairedToken, plan.pairedToken)));
  if (!agrees) requote("CALLDATA_MISMATCH", "Pre-buy plan and calldata disagree");
  return decoded;
}

/**
 * Preflight against live state. `quote` re-runs the fee reads at the latest block and checks
 * they still fit under the plan's caps; `simulate` additionally `eth_call`s the launch as the
 * sender (requires funding and, for an ERC20 payment, the allowance). On-chain caps remain
 * the only real protection.
 */
export async function verifyLaunchPreBuyPlan(
  deps: LaunchPreBuyPlannerDeps,
  plan: LaunchPreBuyPlan,
  mode: "quote" | "simulate" = "quote"
): Promise<LaunchPreBuyVerification> {
  const decoded = await assertLaunchPreBuyPlanCurrent(deps, plan);
  await Promise.all([
    clearCache(deps.legacyZap),
    clearCache(deps.multichainZap),
    clearCache(deps.pairedZap),
  ]);

  let fee: bigint;
  let expectedTotal: bigint;
  const erc20 = plan.payment.asset.address !== zeroAddress;
  if (decoded.zapFamily === "pairedToken") {
    const quotes = await quotePairedRoute(deps, decoded.flaunchParams, 0n);
    fee = quotes.fee.ethRequired;
    if (erc20) {
      if (fee > plan.value) requote("FEE_CHANGED", "The flaunching fee now exceeds the plan's ETH");
      const priced = await priceErc20Premine(deps, {
        sender: plan.sender,
        to: plan.launch.to,
        flaunchParams: decoded.flaunchParams,
        linearExpected: quotes.expected.pairedPremineCost,
      }).catch((cause) => requote("PRICE_MOVED", "The premine can no longer be filled", cause));
      expectedTotal = priced.expected;
      if (priced.expected > (plan.maxPremineCost ?? 0n)) {
        requote("PRICE_MOVED", "The premine now costs more than the approved maximum");
      }
    } else {
      const linearExpected = quotes.expected.ethRequired - fee;
      const priced = await priceEthLaunch(deps, {
        sender: plan.sender,
        to: plan.launch.to,
        data: plan.launch.data,
        fee,
        linearExpected,
        linearMax: linearExpected,
      }).catch((cause) => requote("PRICE_MOVED", "The premine can no longer be filled", cause));
      expectedTotal = fee + priced.expected;
      if (expectedTotal > plan.value) {
        requote(
          fee > plan.fee.amount ? "FEE_CHANGED" : "PRICE_MOVED",
          "The launch now requires more ETH than the plan sends"
        );
      }
    }
  } else {
    const prepared: Exclude<PreparedLaunch, { zapFamily: "pairedToken" }> =
      decoded.zapFamily === "legacy"
        ? {
            zapFamily: "legacy",
            args: decoded.args,
            initialPriceParams: decoded.args._flaunchParams.initialPriceParams,
            premineAmount: plan.premineAmount,
            data: plan.launch.data,
          }
        : {
            zapFamily: "multichain",
            prepared: decoded.prepared,
            premineAmount: plan.premineAmount,
            data: plan.launch.data,
          };
    const quotes = await quoteEthRoute(deps, prepared, 0n);
    fee = quotes.fee;
    const linearExpected = quotes.expected - fee;
    const priced = await priceEthLaunch(deps, {
      sender: plan.sender,
      to: plan.launch.to,
      data: plan.launch.data,
      fee,
      linearExpected,
      linearMax: linearExpected,
    }).catch((cause) => requote("PRICE_MOVED", "The premine can no longer be filled", cause));
    expectedTotal = fee + priced.expected;
    if (expectedTotal > plan.value) {
      requote(
        fee > plan.fee.amount ? "FEE_CHANGED" : "PRICE_MOVED",
        "The launch now requires more ETH than the plan sends"
      );
    }
  }

  if (mode === "quote") return { mode, fee, expectedTotal };

  try {
    if (decoded.zapFamily === "pairedToken") {
      const zap = deps.pairedZap!;
      const { memecoin, ethSpent } = await zap.simulateFlaunch({
        flaunchParams: decoded.flaunchParams,
        trustedFeeSigner: decoded.trustedFeeSigner,
        maxPremineCost: decoded.maxPremineCost,
        value: plan.value,
        from: plan.sender,
      });
      return { mode, fee, expectedTotal, ethSpent, memecoin };
    }
    if (decoded.zapFamily === "legacy") {
      const result = await deps.legacyZap!.contract.simulateWrite("flaunch", decoded.args, {
        from: plan.sender,
        value: plan.value,
      });
      return { mode, fee, expectedTotal, ethSpent: result.ethSpent_, memecoin: result.memecoin_ };
    }
    const result = await deps.multichainZap!.contract.simulateWrite(
      "flaunch",
      decoded.prepared.args,
      { from: plan.sender, value: plan.value }
    );
    return { mode, fee, expectedTotal, ethSpent: result.ethSpent_, memecoin: result.memecoin_ };
  } catch (cause) {
    requote("PRICE_MOVED", "Launch simulation reverted; request a fresh quote", cause);
  }
}

/** Fresh balances versus the plan's requirements; throws before anything is sent. */
export async function assertLaunchPreBuyFunded(
  deps: LaunchPreBuyPlannerDeps,
  plan: LaunchPreBuyPlan
): Promise<LaunchPreBuyFunding> {
  const erc20 =
    plan.payment.asset.address !== zeroAddress
      ? { token: plan.payment.asset.address, required: plan.maxPremineCost ?? plan.payment.max }
      : undefined;
  const funding = await readFunding(deps, plan.sender, plan.value, erc20);
  if (funding.native.available < funding.native.required) {
    throw new LaunchPreBuyInsufficientBalanceError(
      nativeAsset(deps.chainId),
      funding.native.required,
      funding.native.available
    );
  }
  if (funding.paired && funding.paired.available < funding.paired.required) {
    throw new LaunchPreBuyInsufficientBalanceError(
      plan.payment.asset,
      funding.paired.required,
      funding.paired.available
    );
  }
  return funding;
}

/**
 * Sends the plan: approvals first (each awaited and required to succeed), then the launch with
 * the plan's exact calldata and `value`. Revalidates chain, signer, expiry, binding, calldata,
 * balances and (by default) a live quote plus simulation before requesting the first
 * signature. No retry, no internal re-quote; a thrown error means nothing further was sent.
 */
export async function executeLaunchPreBuy(
  deps: LaunchPreBuyExecutorDeps,
  plan: LaunchPreBuyPlan,
  options: LaunchPreBuyExecuteOptions = {}
): Promise<LaunchPreBuyExecution> {
  const signer = await deps.drift.getSignerAddress();
  const decoded = await assertLaunchPreBuyPlanCurrent(deps, plan, { signer });
  await assertLaunchPreBuyFunded(deps, plan);

  const revalidate = options.revalidate ?? "simulate";
  if (revalidate !== "none" && plan.approvals.length === 0) {
    await verifyLaunchPreBuyPlan(deps, plan, revalidate);
  } else if (revalidate !== "none") {
    // The simulation needs the allowance in place; run the read-only quote check first so a
    // stale plan never costs an approval transaction.
    await verifyLaunchPreBuyPlan(deps, plan, "quote");
  }

  for (const approval of plan.approvals) {
    const hash = await new ReadWriteMemecoin(approval.token, deps.drift).approve(
      approval.spender,
      approval.amount
    );
    const receipt = await deps.drift.waitForTransaction({ hash });
    if (!receipt || receipt.status !== "success") {
      throw new Error("Pre-buy approval is not confirmed successful");
    }
  }
  if (revalidate !== "none" && plan.approvals.length > 0) {
    await verifyLaunchPreBuyPlan(deps, plan, revalidate);
  }
  // Re-check expiry right before the signature request: approvals may have consumed the window.
  await assertLaunchPreBuyPlanCurrent(deps, plan, { signer });

  let hash: Hex;
  if (decoded.zapFamily === "legacy") {
    const writer = deps.legacyZapWriter;
    if (!writer) throw new Error(`Legacy FlaunchZap writer is not available on chain ${deps.chainId}`);
    hash = await writer.flaunchPrepared(decoded.args, plan.value);
  } else if (decoded.zapFamily === "multichain") {
    const writer = deps.multichainZapWriter;
    if (!writer) throw new Error(`Multichain FlaunchZap writer is not available on chain ${deps.chainId}`);
    hash = await writer.flaunchPrepared(decoded.prepared, plan.value);
  } else {
    const writer = deps.pairedZapWriter;
    if (!writer) throw new Error(`Paired-token FlaunchZap writer is not available on chain ${deps.chainId}`);
    hash = await writer.flaunch({
      flaunchParams: decoded.flaunchParams,
      trustedFeeSigner: decoded.trustedFeeSigner,
      maxPremineCost: decoded.maxPremineCost,
      value: plan.value,
    });
  }
  return { hash, plan };
}
