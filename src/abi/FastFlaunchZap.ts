export const FastFlaunchZapAbi = [
  {
    inputs: [
      {
        internalType: "contract PositionManager",
        name: "_positionManager",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "CREATOR_FEE_ALLOCATION",
    outputs: [{ internalType: "uint24", name: "", type: "uint24" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "FAIR_LAUNCH_SUPPLY",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "USDC_MARKET_CAP",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
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
          { internalType: "address", name: "creator", type: "address" },
        ],
        internalType: "struct FastFlaunchZap.FastFlaunchParams",
        name: "_params",
        type: "tuple",
      },
    ],
    name: "flaunch",
    outputs: [{ internalType: "address", name: "memecoin_", type: "address" }],
    stateMutability: "nonpayable",
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
] as const;
