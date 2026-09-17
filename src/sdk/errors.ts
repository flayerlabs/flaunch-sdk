export class PairedSwapUnsupportedRouterError extends Error {
  constructor(
    public readonly router: string,
    public readonly cause?: unknown,
  ) {
    super(`Router ${router} does not support protected exact-input swaps`);
    this.name = "PairedSwapUnsupportedRouterError";
  }
}
export class PairedSwapSlippageExceededError extends Error {
  constructor(
    public readonly amountOutMin: bigint,
    public readonly actualAmountOut: bigint,
  ) {
    super(
      "The current output is below the approved minimum. Request a new quote.",
    );
    this.name = "PairedSwapSlippageExceededError";
  }
}
export class PairedSwapPartialFillError extends Error {
  constructor(
    public readonly amountIn: bigint,
    public readonly consumedIn: bigint,
  ) {
    super("The swap cannot consume the full input.");
    this.name = "PairedSwapPartialFillError";
  }
}

import type {
  LaunchPreBuyReasonCode,
  LaunchPreBuyRequoteReason,
  PreBuyAsset,
} from "./launchPreBuy";

/** The plan cannot be signed as-is; re-run `planLaunchPreBuy` and show the fresh numbers. */
export class LaunchPreBuyRequoteRequiredError extends Error {
  public readonly code = "REQUOTE_REQUIRED" as const;
  constructor(
    public readonly reason: LaunchPreBuyRequoteReason,
    message?: string,
    public readonly cause?: unknown,
  ) {
    super(message ?? `Pre-buy plan requires a fresh quote (${reason})`);
    this.name = "LaunchPreBuyRequoteRequiredError";
  }
}

/** `flaunchWithPreBuy` was asked for a launch the planner reports as unsupported. */
export class LaunchPreBuyUnsupportedError extends Error {
  public readonly code = "UNSUPPORTED" as const;
  constructor(public readonly reasons: LaunchPreBuyReasonCode[]) {
    super(`Pre-buy is not supported for this launch: ${reasons.join(", ")}`);
    this.name = "LaunchPreBuyUnsupportedError";
  }
}

/** The sender cannot fund the quoted maximum; nothing was sent. */
export class LaunchPreBuyInsufficientBalanceError extends Error {
  public readonly code = "INSUFFICIENT_BALANCE" as const;
  constructor(
    public readonly asset: PreBuyAsset,
    public readonly required: bigint,
    public readonly available: bigint,
  ) {
    super(
      `Insufficient balance of ${asset.address} on chain ${asset.chainId}: need ${required}, have ${available}`,
    );
    this.name = "LaunchPreBuyInsufficientBalanceError";
  }
}
