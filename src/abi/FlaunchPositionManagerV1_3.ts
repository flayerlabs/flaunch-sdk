import { FlaunchParamsV1_3Components } from "./FlaunchParamsV1_3";

/** Pool creation event emitted by paired-token PositionManager V1.3. */
export const FlaunchPositionManagerV1_3Abi = [
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
        components: FlaunchParamsV1_3Components,
      },
    ],
    anonymous: false,
  },
] as const;
