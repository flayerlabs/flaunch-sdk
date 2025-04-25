export const FairLaunchV1_1Abi = [
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
  { inputs: [], name: "AccessControlBadConfirmation", type: "error" },
  {
    inputs: [
      { internalType: "address", name: "account", type: "address" },
      { internalType: "bytes32", name: "neededRole", type: "bytes32" },
    ],
    name: "AccessControlUnauthorizedAccount",
    type: "error",
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
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "role", type: "bytes32" },
      {
        indexed: true,
        internalType: "bytes32",
        name: "previousAdminRole",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "newAdminRole",
        type: "bytes32",
      },
    ],
    name: "RoleAdminChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "role", type: "bytes32" },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "RoleGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "role", type: "bytes32" },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "RoleRevoked",
    type: "event",
  },
  {
    inputs: [],
    name: "DEFAULT_ADMIN_ROLE",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
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
      { internalType: "uint256", name: "_fairLaunchDuration", type: "uint256" },
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
    inputs: [{ internalType: "bytes32", name: "role", type: "bytes32" }],
    name: "getRoleAdmin",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "grantRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "hasRole",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
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
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "callerConfirmation", type: "address" },
    ],
    name: "renounceRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "revokeRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes4", name: "interfaceId", type: "bytes4" }],
    name: "supportsInterface",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
