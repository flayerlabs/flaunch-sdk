const poolKeyComponents = [
  { name: "currency0", type: "address", internalType: "Currency" },
  { name: "currency1", type: "address", internalType: "Currency" },
  { name: "fee", type: "uint24", internalType: "uint24" },
  { name: "tickSpacing", type: "int24", internalType: "int24" },
  { name: "hooks", type: "address", internalType: "contract IHooks" },
] as const;

const swapParamsComponents = [
  { name: "zeroForOne", type: "bool", internalType: "bool" },
  { name: "amountSpecified", type: "int256", internalType: "int256" },
  { name: "sqrtPriceLimitX96", type: "uint160", internalType: "uint160" },
] as const;

/**
 * `swap(PoolKey, SwapParams, bytes _hookData)` — the overload a spend-gated buy needs: the gate's
 * signed authorisation rides `_hookData` straight into the pool's hook.
 */
export const PoolSwapV1_3SwapWithHookDataAbi = [
  {
    type: "function",
    name: "swap",
    inputs: [
      {
        name: "_key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: poolKeyComponents,
      },
      {
        name: "_params",
        type: "tuple",
        internalType: "struct SwapParams",
        components: swapParamsComponents,
      },
      { name: "_hookData", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "delta_", type: "int256", internalType: "BalanceDelta" }],
    stateMutability: "payable",
  },
] as const;

/** `swap(PoolKey, SwapParams, address _referrer)` — a zero referrer means no attribution. */
export const PoolSwapV1_3SwapWithReferrerAbi = [
  {
    type: "function",
    name: "swap",
    inputs: [
      {
        name: "_key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: poolKeyComponents,
      },
      {
        name: "_params",
        type: "tuple",
        internalType: "struct SwapParams",
        components: swapParamsComponents,
      },
      { name: "_referrer", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "delta_", type: "int256", internalType: "BalanceDelta" }],
    stateMutability: "payable",
  },
] as const;

/** `swap(PoolKey, SwapParams)` — delegates on chain to the referrer overload with `address(0)`. */
export const PoolSwapV1_3SwapAbi = [
  {
    type: "function",
    name: "swap",
    inputs: [
      {
        name: "_key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: poolKeyComponents,
      },
      {
        name: "_params",
        type: "tuple",
        internalType: "struct SwapParams",
        components: swapParamsComponents,
      },
    ],
    outputs: [{ name: "", type: "int256", internalType: "BalanceDelta" }],
    stateMutability: "payable",
  },
] as const;

export const PoolSwapV1_3MsgSenderAbi = [
  {
    type: "function",
    name: "msgSender",
    inputs: [],
    outputs: [{ name: "sender_", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
] as const;

/** Protected exact-input execution; unavailable on legacy router deployments. */
export const PoolSwapExactInputAbi = [
  {
    ...PoolSwapV1_3SwapWithHookDataAbi[0],
    name: "swapExactInput",
    inputs: [
      ...PoolSwapV1_3SwapWithHookDataAbi[0].inputs,
      { name: "_amountOutMinimum", type: "uint256" },
      { name: "_deadline", type: "uint256" },
    ],
  },
  { type: "error", name: "Expired", inputs: [] },
  {
    type: "error",
    name: "InsufficientOutput",
    inputs: [
      { name: "minimum", type: "uint256", internalType: "uint256" },
      { name: "actual", type: "uint256", internalType: "uint256" },
    ],
  },
  { type: "error", name: "InvalidExactInput", inputs: [] },
  { type: "error", name: "InvalidSwapDelta", inputs: [] },
  {
    type: "error",
    name: "PartialFill",
    inputs: [
      { name: "requested", type: "uint256", internalType: "uint256" },
      { name: "consumed", type: "uint256", internalType: "uint256" },
    ],
  },
] as const;

export const PoolSwapExactInputVersionAbi = [
  {
    type: "function",
    name: "exactInputVersion",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "pure",
  },
] as const;

export const PoolSwapExactInputEventAbi = [
  {
    type: "event",
    name: "ExactInputSwap",
    anonymous: false,
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "zeroForOne", type: "bool", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
    ],
  },
] as const;

/** Legacy and protected router ABIs. Probe exactInputVersion before planning protected calls. */
export const PoolSwapV1_3Abi = [
  ...PoolSwapV1_3SwapAbi,
  ...PoolSwapV1_3SwapWithReferrerAbi,
  ...PoolSwapV1_3SwapWithHookDataAbi,
  ...PoolSwapV1_3MsgSenderAbi,
  ...PoolSwapExactInputAbi,
  ...PoolSwapExactInputVersionAbi,
  ...PoolSwapExactInputEventAbi,
] as const;
