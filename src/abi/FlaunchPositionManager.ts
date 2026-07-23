export const FlaunchPositionManagerAbi = [
  {
    type: "event",
    name: "PoolCreated",
    inputs: [
      {
        name: "_poolId",
        type: "bytes32",
        indexed: true,
        internalType: "PoolId",
      },
      {
        name: "_memecoin",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "_memecoinTreasury",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "_tokenId",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "_currencyFlipped",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
      {
        name: "_flaunchFee",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "_params",
        type: "tuple",
        indexed: false,
        internalType: "struct IPositionManager.FlaunchParams",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
          { name: "tokenUri", type: "string", internalType: "string" },
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
    anonymous: false,
  },
] as const;
