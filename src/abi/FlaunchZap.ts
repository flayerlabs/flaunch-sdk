export const FlaunchZapAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_positionManager",
        type: "address",
        internalType: "contract PositionManager",
      },
      {
        name: "_flaunchContract",
        type: "address",
        internalType: "contract Flaunch",
      },
      {
        name: "_flETH",
        type: "address",
        internalType: "contract IFLETH",
      },
      {
        name: "_poolSwap",
        type: "address",
        internalType: "contract PoolSwap",
      },
      {
        name: "_treasuryManagerFactory",
        type: "address",
        internalType: "contract ITreasuryManagerFactory",
      },
      {
        name: "_merkleAirdrop",
        type: "address",
        internalType: "contract IMerkleAirdrop",
      },
      {
        name: "_whitelistFairLaunch",
        type: "address",
        internalType: "contract WhitelistFairLaunch",
      },
    ],
    stateMutability: "nonpayable",
  },
  { type: "receive", stateMutability: "payable" },
  {
    type: "function",
    name: "calculateFee",
    inputs: [
      {
        name: "_premineAmount",
        type: "uint256",
        internalType: "uint256",
      },
      { name: "_slippage", type: "uint256", internalType: "uint256" },
      {
        name: "_initialPriceParams",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [
      { name: "ethRequired_", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "flETH",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IFLETH" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "flaunch",
    inputs: [
      {
        name: "_flaunchParams",
        type: "tuple",
        internalType: "struct PositionManager.FlaunchParams",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
          { name: "tokenUri", type: "string", internalType: "string" },
          {
            name: "initialTokenFairLaunch",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "fairLaunchDuration",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "premineAmount",
            type: "uint256",
            internalType: "uint256",
          },
          { name: "creator", type: "address", internalType: "address" },
          {
            name: "creatorFeeAllocation",
            type: "uint24",
            internalType: "uint24",
          },
          {
            name: "flaunchAt",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "initialPriceParams",
            type: "bytes",
            internalType: "bytes",
          },
          {
            name: "feeCalculatorParams",
            type: "bytes",
            internalType: "bytes",
          },
        ],
      },
    ],
    outputs: [
      { name: "memecoin_", type: "address", internalType: "address" },
      { name: "ethSpent_", type: "uint256", internalType: "uint256" },
      { name: "", type: "address", internalType: "address" },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "flaunch",
    inputs: [
      {
        name: "_flaunchParams",
        type: "tuple",
        internalType: "struct PositionManager.FlaunchParams",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
          { name: "tokenUri", type: "string", internalType: "string" },
          {
            name: "initialTokenFairLaunch",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "fairLaunchDuration",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "premineAmount",
            type: "uint256",
            internalType: "uint256",
          },
          { name: "creator", type: "address", internalType: "address" },
          {
            name: "creatorFeeAllocation",
            type: "uint24",
            internalType: "uint24",
          },
          {
            name: "flaunchAt",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "initialPriceParams",
            type: "bytes",
            internalType: "bytes",
          },
          {
            name: "feeCalculatorParams",
            type: "bytes",
            internalType: "bytes",
          },
        ],
      },
      {
        name: "_whitelistParams",
        type: "tuple",
        internalType: "struct FlaunchZap.WhitelistParams",
        components: [
          {
            name: "merkleRoot",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "merkleIPFSHash",
            type: "string",
            internalType: "string",
          },
          {
            name: "maxTokens",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
      {
        name: "_airdropParams",
        type: "tuple",
        internalType: "struct FlaunchZap.AirdropParams",
        components: [
          {
            name: "airdropIndex",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "airdropAmount",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "airdropEndTime",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "merkleRoot",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "merkleIPFSHash",
            type: "string",
            internalType: "string",
          },
        ],
      },
      {
        name: "_treasuryManagerParams",
        type: "tuple",
        internalType: "struct FlaunchZap.TreasuryManagerParams",
        components: [
          { name: "manager", type: "address", internalType: "address" },
          {
            name: "permissions",
            type: "address",
            internalType: "address",
          },
          {
            name: "initializeData",
            type: "bytes",
            internalType: "bytes",
          },
          { name: "depositData", type: "bytes", internalType: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "memecoin_", type: "address", internalType: "address" },
      { name: "ethSpent_", type: "uint256", internalType: "uint256" },
      {
        name: "deployedManager_",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "flaunchContract",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract Flaunch" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "merkleAirdrop",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IMerkleAirdrop",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "poolSwap",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract PoolSwap" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "positionManager",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract PositionManager",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "treasuryManagerFactory",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract ITreasuryManagerFactory",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "whitelistFairLaunch",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract WhitelistFairLaunch",
      },
    ],
    stateMutability: "view",
  },
  { type: "error", name: "CreatorCannotBeZero", inputs: [] },
  { type: "error", name: "InsufficientMemecoinsForAirdrop", inputs: [] },
] as const;
