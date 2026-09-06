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
