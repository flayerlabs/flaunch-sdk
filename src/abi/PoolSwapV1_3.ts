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

/**
 * The v1.3.1 PoolSwap router (flaunch-contracts `src/contracts/zaps/PoolSwap.sol`): one
 * `swap` against any PoolKey, in three overloads, plus `msgSender()` — the transient slot hooks
 * read to learn who initiated the in-flight swap (the spend gate's approved-router buyer binding).
 *
 * PoolSwap has no `minOut`: `sqrtPriceLimitX96` is the only on-chain slippage control. Native ETH
 * input travels as `msg.value`; ERC20 input settles by allowance pull, and unused native value is
 * refunded.
 */
export const PoolSwapV1_3Abi = [
  ...PoolSwapV1_3SwapAbi,
  ...PoolSwapV1_3SwapWithReferrerAbi,
  ...PoolSwapV1_3SwapWithHookDataAbi,
  ...PoolSwapV1_3MsgSenderAbi,
] as const;
