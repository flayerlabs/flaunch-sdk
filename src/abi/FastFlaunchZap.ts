export const FastFlaunchZapAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_positionManager",
        type: "address",
        internalType: "contract PositionManager",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "FAIR_LAUNCH_SUPPLY",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "USDC_MARKET_CAP",
    inputs: [],
    outputs: [
      {
        name: "",
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
        name: "_params",
        type: "tuple",
        internalType: "struct FastFlaunchZap.FastFlaunchParams",
        components: [
          {
            name: "name",
            type: "string",
            internalType: "string",
          },
          {
            name: "symbol",
            type: "string",
            internalType: "string",
          },
          {
            name: "tokenUri",
            type: "string",
            internalType: "string",
          },
          {
            name: "creator",
            type: "address",
            internalType: "address",
          },
        ],
      },
    ],
    outputs: [
      {
        name: "memecoin_",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
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
] as const;
