export const PairedTokenRegistryV1_3Abi = [
  {
    type: "function",
    name: "isApproved",
    inputs: [
      { name: "_token", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenConfig",
    inputs: [
      { name: "_token", type: "address", internalType: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct IPairedTokenRegistry.PairedToken",
        components: [
          { name: "approved", type: "bool", internalType: "bool" },
          {
            name: "tokenType",
            type: "uint8",
            internalType: "enum IPairedTokenRegistry.PairedTokenType",
          },
          { name: "decimals", type: "uint8", internalType: "uint8" },
          { name: "underlying", type: "address", internalType: "address" },
          { name: "feeEscrow", type: "address", internalType: "address" },
          { name: "priceCalculator", type: "address", internalType: "address" },
          { name: "minDistribute", type: "uint256", internalType: "uint256" },
          { name: "bidWallThreshold", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;
