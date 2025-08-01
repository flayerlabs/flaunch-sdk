export const FlaunchZapAbi = [
  {
    inputs: [
      {
        internalType: "contract PositionManager",
        name: "_positionManager",
        type: "address",
      },
      {
        internalType: "contract Flaunch",
        name: "_flaunchContract",
        type: "address",
      },
      { internalType: "contract IFLETH", name: "_flETH", type: "address" },
      { internalType: "contract PoolSwap", name: "_poolSwap", type: "address" },
      {
        internalType: "contract ITreasuryManagerFactory",
        name: "_treasuryManagerFactory",
        type: "address",
      },
      {
        internalType: "contract IMerkleAirdrop",
        name: "_merkleAirdrop",
        type: "address",
      },
      {
        internalType: "contract WhitelistFairLaunch",
        name: "_whitelistFairLaunch",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  { inputs: [], name: "CreatorCannotBeZero", type: "error" },
  { inputs: [], name: "InsufficientMemecoinsForAirdrop", type: "error" },
  {
    inputs: [
      { internalType: "uint256", name: "_premineAmount", type: "uint256" },
      { internalType: "uint256", name: "_slippage", type: "uint256" },
      { internalType: "bytes", name: "_initialPriceParams", type: "bytes" },
    ],
    name: "calculateFee",
    outputs: [
      { internalType: "uint256", name: "ethRequired_", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_managerImplementation",
        type: "address",
      },
      { internalType: "address", name: "_owner", type: "address" },
      { internalType: "bytes", name: "_data", type: "bytes" },
      { internalType: "address", name: "_permissions", type: "address" },
    ],
    name: "deployAndInitializeManager",
    outputs: [
      { internalType: "address payable", name: "manager_", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "flETH",
    outputs: [{ internalType: "contract IFLETH", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "string", name: "name", type: "string" },
          { internalType: "string", name: "symbol", type: "string" },
          { internalType: "string", name: "tokenUri", type: "string" },
          {
            internalType: "uint256",
            name: "initialTokenFairLaunch",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fairLaunchDuration",
            type: "uint256",
          },
          { internalType: "uint256", name: "premineAmount", type: "uint256" },
          { internalType: "address", name: "creator", type: "address" },
          {
            internalType: "uint24",
            name: "creatorFeeAllocation",
            type: "uint24",
          },
          { internalType: "uint256", name: "flaunchAt", type: "uint256" },
          { internalType: "bytes", name: "initialPriceParams", type: "bytes" },
          { internalType: "bytes", name: "feeCalculatorParams", type: "bytes" },
        ],
        internalType: "struct PositionManager.FlaunchParams",
        name: "_flaunchParams",
        type: "tuple",
      },
      { internalType: "bytes", name: "_premineSwapHookData", type: "bytes" },
      {
        components: [
          { internalType: "bytes32", name: "merkleRoot", type: "bytes32" },
          { internalType: "string", name: "merkleIPFSHash", type: "string" },
          { internalType: "uint256", name: "maxTokens", type: "uint256" },
        ],
        internalType: "struct FlaunchZap.WhitelistParams",
        name: "_whitelistParams",
        type: "tuple",
      },
      {
        components: [
          { internalType: "uint256", name: "airdropIndex", type: "uint256" },
          { internalType: "uint256", name: "airdropAmount", type: "uint256" },
          { internalType: "uint256", name: "airdropEndTime", type: "uint256" },
          { internalType: "bytes32", name: "merkleRoot", type: "bytes32" },
          { internalType: "string", name: "merkleIPFSHash", type: "string" },
        ],
        internalType: "struct FlaunchZap.AirdropParams",
        name: "_airdropParams",
        type: "tuple",
      },
      {
        components: [
          { internalType: "address", name: "manager", type: "address" },
          { internalType: "address", name: "permissions", type: "address" },
          { internalType: "bytes", name: "initializeData", type: "bytes" },
          { internalType: "bytes", name: "depositData", type: "bytes" },
        ],
        internalType: "struct FlaunchZap.TreasuryManagerParams",
        name: "_treasuryManagerParams",
        type: "tuple",
      },
    ],
    name: "flaunch",
    outputs: [
      { internalType: "address", name: "memecoin_", type: "address" },
      { internalType: "uint256", name: "ethSpent_", type: "uint256" },
      { internalType: "address", name: "deployedManager_", type: "address" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "string", name: "name", type: "string" },
          { internalType: "string", name: "symbol", type: "string" },
          { internalType: "string", name: "tokenUri", type: "string" },
          {
            internalType: "uint256",
            name: "initialTokenFairLaunch",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fairLaunchDuration",
            type: "uint256",
          },
          { internalType: "uint256", name: "premineAmount", type: "uint256" },
          { internalType: "address", name: "creator", type: "address" },
          {
            internalType: "uint24",
            name: "creatorFeeAllocation",
            type: "uint24",
          },
          { internalType: "uint256", name: "flaunchAt", type: "uint256" },
          { internalType: "bytes", name: "initialPriceParams", type: "bytes" },
          { internalType: "bytes", name: "feeCalculatorParams", type: "bytes" },
        ],
        internalType: "struct PositionManager.FlaunchParams",
        name: "_flaunchParams",
        type: "tuple",
      },
      { internalType: "bytes", name: "_premineSwapHookData", type: "bytes" },
    ],
    name: "flaunch",
    outputs: [
      { internalType: "address", name: "memecoin_", type: "address" },
      { internalType: "uint256", name: "ethSpent_", type: "uint256" },
      { internalType: "address", name: "", type: "address" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "flaunchContract",
    outputs: [{ internalType: "contract Flaunch", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "merkleAirdrop",
    outputs: [
      { internalType: "contract IMerkleAirdrop", name: "", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "poolSwap",
    outputs: [{ internalType: "contract PoolSwap", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "positionManager",
    outputs: [
      { internalType: "contract PositionManager", name: "", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "treasuryManagerFactory",
    outputs: [
      {
        internalType: "contract ITreasuryManagerFactory",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "whitelistFairLaunch",
    outputs: [
      {
        internalType: "contract WhitelistFairLaunch",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  { stateMutability: "payable", type: "receive" },
] as const;
