const flaunchParams = [
  { name: "name", type: "string", internalType: "string" },
  { name: "symbol", type: "string", internalType: "string" },
  { name: "tokenUri", type: "string", internalType: "string" },
  { name: "premineAmount", type: "uint256", internalType: "uint256" },
  { name: "creator", type: "address", internalType: "address" },
  {
    name: "creatorFeeAllocation",
    type: "uint24",
    internalType: "uint24",
  },
  { name: "flaunchAt", type: "uint256", internalType: "uint256" },
  { name: "initialPriceParams", type: "bytes", internalType: "bytes" },
  { name: "feeCalculatorParams", type: "bytes", internalType: "bytes" },
] as const;

export const FlaunchZapAbi = [
  {
    type: "function",
    name: "calculateFee",
    inputs: [
      {
        name: "_flaunchParams",
        type: "tuple",
        internalType: "struct IPositionManager.FlaunchParams",
        components: flaunchParams,
      },
      {
        name: "_slippage",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "ethRequired_",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "flaunch",
    inputs: [
      {
        name: "_flaunchParams",
        type: "tuple",
        internalType: "struct IPositionManager.FlaunchParams",
        components: flaunchParams,
      },
      {
        name: "_trustedFeeSigner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      { name: "memecoin_", type: "address", internalType: "address" },
      { name: "ethSpent_", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "flaunchContract",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract Flaunch",
      },
    ],
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
    type: "error",
    name: "CreatorCannotBeZero",
    inputs: [],
  },
] as const;
