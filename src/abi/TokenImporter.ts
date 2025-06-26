export const TokenImporterAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_anyPositionManager",
        type: "address",
        internalType: "address payable",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addVerifier",
    inputs: [{ name: "_verifier", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "anyPositionManager",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract AnyPositionManager",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "cancelOwnershipHandover",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "completeOwnershipHandover",
    inputs: [
      { name: "pendingOwner", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getAllVerifiers",
    inputs: [],
    outputs: [
      {
        name: "verifiers_",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      { name: "_memecoin", type: "address", internalType: "address" },
      {
        name: "_creatorFeeAllocation",
        type: "uint24",
        internalType: "uint24",
      },
      {
        name: "_initialMarketCap",
        type: "uint256",
        internalType: "uint256",
      },
      { name: "_verifier", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      { name: "_memecoin", type: "address", internalType: "address" },
      {
        name: "_creatorFeeAllocation",
        type: "uint24",
        internalType: "uint24",
      },
      {
        name: "_initialMarketCap",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "result", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownershipHandoverExpiresAt",
    inputs: [
      { name: "pendingOwner", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "result", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "removeVerifier",
    inputs: [{ name: "_verifier", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "requestOwnershipHandover",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "setAnyPositionManager",
    inputs: [
      {
        name: "_anyPositionManager",
        type: "address",
        internalType: "address payable",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "verifyMemecoin",
    inputs: [{ name: "_memecoin", type: "address", internalType: "address" }],
    outputs: [{ name: "verifier_", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AnyPositionManagerSet",
    inputs: [
      {
        name: "_anyPositionManager",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipHandoverCanceled",
    inputs: [
      {
        name: "pendingOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipHandoverRequested",
    inputs: [
      {
        name: "pendingOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "oldOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TokenImported",
    inputs: [
      {
        name: "_memecoin",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "_verifier",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "VerifierAdded",
    inputs: [
      {
        name: "_verifier",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "VerifierRemoved",
    inputs: [
      {
        name: "_verifier",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  { type: "error", name: "AlreadyInitialized", inputs: [] },
  { type: "error", name: "InvalidMemecoin", inputs: [] },
  { type: "error", name: "NewOwnerIsZeroAddress", inputs: [] },
  { type: "error", name: "NoHandoverRequest", inputs: [] },
  { type: "error", name: "Unauthorized", inputs: [] },
  { type: "error", name: "VerifierAlreadyAdded", inputs: [] },
  { type: "error", name: "VerifierNotAdded", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
] as const;
