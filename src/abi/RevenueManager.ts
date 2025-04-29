export const RevenueManagerAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_treasuryManagerFactory",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  { inputs: [], name: "AlreadyInitialized", type: "error" },
  { inputs: [], name: "FailedToClaim", type: "error" },
  { inputs: [], name: "FlaunchContractNotValid", type: "error" },
  { inputs: [], name: "InvalidClaimer", type: "error" },
  { inputs: [], name: "InvalidCreatorAddress", type: "error" },
  { inputs: [], name: "InvalidProtocolFee", type: "error" },
  { inputs: [], name: "NotInitialized", type: "error" },
  { inputs: [], name: "NotManagerOwner", type: "error" },
  {
    inputs: [{ internalType: "uint256", name: "_unlockedAt", type: "uint256" }],
    name: "TokenTimelocked",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "_flaunch",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "_tokenId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "_creator",
        type: "address",
      },
    ],
    name: "CreatorUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_owner",
        type: "address",
      },
      {
        components: [
          {
            internalType: "address payable",
            name: "protocolRecipient",
            type: "address",
          },
          { internalType: "uint256", name: "protocolFee", type: "uint256" },
        ],
        indexed: false,
        internalType: "struct RevenueManager.InitializeParams",
        name: "_params",
        type: "tuple",
      },
    ],
    name: "ManagerInitialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "_previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "_newOwner",
        type: "address",
      },
    ],
    name: "ManagerOwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "_protocolFee",
        type: "uint256",
      },
    ],
    name: "ProtocolFeeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_protocolRecipient",
        type: "address",
      },
    ],
    name: "ProtocolRecipientUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_recipient",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "ProtocolRevenueClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "_flaunch",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "_tokenId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "_recipient",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "RevenueClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "_flaunch",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "_tokenId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "_owner",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "_sender",
        type: "address",
      },
    ],
    name: "TreasuryEscrowed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "_flaunch",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "_tokenId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "_sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "_recipient",
        type: "address",
      },
    ],
    name: "TreasuryReclaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "_flaunch",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "_tokenId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_unlockedAt",
        type: "uint256",
      },
    ],
    name: "TreasuryTimelocked",
    type: "event",
  },
  {
    inputs: [],
    name: "claim",
    outputs: [{ internalType: "uint256", name: "amount_", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "contract Flaunch",
            name: "flaunch",
            type: "address",
          },
          { internalType: "uint256", name: "tokenId", type: "uint256" },
        ],
        internalType: "struct ITreasuryManager.FlaunchToken[]",
        name: "_flaunchToken",
        type: "tuple[]",
      },
    ],
    name: "claim",
    outputs: [{ internalType: "uint256", name: "amount_", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_flaunch", type: "address" },
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
    ],
    name: "creator",
    outputs: [{ internalType: "address", name: "_creator", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_creator", type: "address" }],
    name: "creatorTotalClaim",
    outputs: [{ internalType: "uint256", name: "_claimed", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "contract Flaunch",
            name: "flaunch",
            type: "address",
          },
          { internalType: "uint256", name: "tokenId", type: "uint256" },
        ],
        internalType: "struct ITreasuryManager.FlaunchToken",
        name: "_flaunchToken",
        type: "tuple",
      },
      { internalType: "address", name: "_creator", type: "address" },
      { internalType: "bytes", name: "_data", type: "bytes" },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }],
    name: "getProtocolFee",
    outputs: [
      { internalType: "uint256", name: "protocolFee_", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_owner", type: "address" },
      { internalType: "bytes", name: "_data", type: "bytes" },
    ],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "initialized",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "managerOwner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "protocolAvailableClaim",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "protocolFee",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "protocolFeesClaimable",
    outputs: [{ internalType: "uint256", name: "claimable_", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "protocolRecipient",
    outputs: [{ internalType: "address payable", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "protocolTotalClaim",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "contract Flaunch",
            name: "flaunch",
            type: "address",
          },
          { internalType: "uint256", name: "tokenId", type: "uint256" },
        ],
        internalType: "struct ITreasuryManager.FlaunchToken",
        name: "_flaunchToken",
        type: "tuple",
      },
      { internalType: "address", name: "_recipient", type: "address" },
    ],
    name: "rescue",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "contract Flaunch",
            name: "flaunch",
            type: "address",
          },
          { internalType: "uint256", name: "tokenId", type: "uint256" },
        ],
        internalType: "struct ITreasuryManager.FlaunchToken",
        name: "_flaunchToken",
        type: "tuple",
      },
      { internalType: "address payable", name: "_creator", type: "address" },
    ],
    name: "setCreator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address payable",
        name: "_protocolRecipient",
        type: "address",
      },
    ],
    name: "setProtocolRecipient",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_flaunch", type: "address" },
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
    ],
    name: "tokenPoolId",
    outputs: [{ internalType: "PoolId", name: "_poolId", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_flaunch", type: "address" },
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
    ],
    name: "tokenTimelock",
    outputs: [
      { internalType: "uint256", name: "_unlockedAt", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_flaunch", type: "address" },
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
    ],
    name: "tokenTotalClaim",
    outputs: [{ internalType: "uint256", name: "_claimed", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_newManagerOwner", type: "address" },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "treasuryManagerFactory",
    outputs: [
      {
        internalType: "contract TreasuryManagerFactory",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  { stateMutability: "payable", type: "receive" },
] as const;
