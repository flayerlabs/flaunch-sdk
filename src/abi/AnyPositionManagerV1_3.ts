/** Current imported-token PoolCreated event (the paired token was added in V1.3). */
export const AnyPositionManagerV1_3Abi = [
  {
    type: "event",
    name: "PoolCreated",
    inputs: [
      { name: "_poolId", type: "bytes32", indexed: true },
      { name: "_memecoin", type: "address", indexed: false },
      { name: "_memecoinTreasury", type: "address", indexed: false },
      { name: "_tokenId", type: "uint256", indexed: false },
      { name: "_currencyFlipped", type: "bool", indexed: false },
      {
        name: "_params",
        type: "tuple",
        indexed: false,
        components: [
          { name: "memecoin", type: "address" },
          { name: "creator", type: "address" },
          { name: "creatorFeeAllocation", type: "uint24" },
          { name: "initialPriceParams", type: "bytes" },
          { name: "feeCalculatorParams", type: "bytes" },
          { name: "pairedToken", type: "address" },
        ],
      },
    ],
    anonymous: false,
  },
] as const;
