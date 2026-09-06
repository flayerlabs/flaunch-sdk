export const FlaunchParamsV1_3Components = [
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
  { name: "pairedToken", type: "address", internalType: "address" },
] as const;
