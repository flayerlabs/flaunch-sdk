export const FairLaunchAbi = [
  {
    inputs: [
      {
        internalType: "contract IPoolManager",
        name: "_poolManager",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  { inputs: [], name: "CannotModifyLiquidityDuringFairLaunch", type: "error" },
  { inputs: [], name: "CannotSellTokenDuringFairLaunch", type: "error" },
  { inputs: [], name: "NotPositionManager", type: "error" },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "PoolId",
        name: "_poolId",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_tokens",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_startsAt",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_endsAt",
        type: "uint256",
      },
    ],
    name: "FairLaunchCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "PoolId",
        name: "_poolId",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_revenue",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_supply",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_endedAt",
        type: "uint256",
      },
    ],
    name: "FairLaunchEnded",
    type: "event",
  },
  {
    inputs: [],
    name: "FAIR_LAUNCH_WINDOW",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "Currency", name: "currency0", type: "address" },
          { internalType: "Currency", name: "currency1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickSpacing", type: "int24" },
          { internalType: "contract IHooks", name: "hooks", type: "address" },
        ],
        internalType: "struct PoolKey",
        name: "_poolKey",
        type: "tuple",
      },
      { internalType: "uint256", name: "_tokenFees", type: "uint256" },
      { internalType: "bool", name: "_nativeIsZero", type: "bool" },
    ],
    name: "closePosition",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "startsAt", type: "uint256" },
          { internalType: "uint256", name: "endsAt", type: "uint256" },
          { internalType: "int24", name: "initialTick", type: "int24" },
          { internalType: "uint256", name: "revenue", type: "uint256" },
          { internalType: "uint256", name: "supply", type: "uint256" },
          { internalType: "bool", name: "closed", type: "bool" },
        ],
        internalType: "struct FairLaunch.FairLaunchInfo",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "PoolId", name: "_poolId", type: "bytes32" },
      { internalType: "int24", name: "_initialTick", type: "int24" },
      { internalType: "uint256", name: "_flaunchesAt", type: "uint256" },
      {
        internalType: "uint256",
        name: "_initialTokenFairLaunch",
        type: "uint256",
      },
    ],
    name: "createPosition",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "startsAt", type: "uint256" },
          { internalType: "uint256", name: "endsAt", type: "uint256" },
          { internalType: "int24", name: "initialTick", type: "int24" },
          { internalType: "uint256", name: "revenue", type: "uint256" },
          { internalType: "uint256", name: "supply", type: "uint256" },
          { internalType: "bool", name: "closed", type: "bool" },
        ],
        internalType: "struct FairLaunch.FairLaunchInfo",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "PoolId", name: "_poolId", type: "bytes32" }],
    name: "fairLaunchInfo",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "startsAt", type: "uint256" },
          { internalType: "uint256", name: "endsAt", type: "uint256" },
          { internalType: "int24", name: "initialTick", type: "int24" },
          { internalType: "uint256", name: "revenue", type: "uint256" },
          { internalType: "uint256", name: "supply", type: "uint256" },
          { internalType: "bool", name: "closed", type: "bool" },
        ],
        internalType: "struct FairLaunch.FairLaunchInfo",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "Currency", name: "currency0", type: "address" },
          { internalType: "Currency", name: "currency1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickSpacing", type: "int24" },
          { internalType: "contract IHooks", name: "hooks", type: "address" },
        ],
        internalType: "struct PoolKey",
        name: "_poolKey",
        type: "tuple",
      },
      { internalType: "int256", name: "_amountSpecified", type: "int256" },
      { internalType: "bool", name: "_nativeIsZero", type: "bool" },
    ],
    name: "fillFromPosition",
    outputs: [
      {
        internalType: "BeforeSwapDelta",
        name: "beforeSwapDelta_",
        type: "int256",
      },
      { internalType: "BalanceDelta", name: "balanceDelta_", type: "int256" },
      {
        components: [
          { internalType: "uint256", name: "startsAt", type: "uint256" },
          { internalType: "uint256", name: "endsAt", type: "uint256" },
          { internalType: "int24", name: "initialTick", type: "int24" },
          { internalType: "uint256", name: "revenue", type: "uint256" },
          { internalType: "uint256", name: "supply", type: "uint256" },
          { internalType: "bool", name: "closed", type: "bool" },
        ],
        internalType: "struct FairLaunch.FairLaunchInfo",
        name: "fairLaunchInfo_",
        type: "tuple",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "PoolId", name: "_poolId", type: "bytes32" }],
    name: "inFairLaunchWindow",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "PoolId", name: "_poolId", type: "bytes32" },
      { internalType: "int256", name: "_revenue", type: "int256" },
    ],
    name: "modifyRevenue",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "poolManager",
    outputs: [
      { internalType: "contract IPoolManager", name: "", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "positionManager",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
