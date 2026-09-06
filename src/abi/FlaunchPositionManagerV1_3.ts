import { FlaunchParamsV1_3Components } from "./FlaunchParamsV1_3";

/**
 * Paired-token PositionManager V1.3: the `PoolCreated` event plus the two reads a swap needs —
 * `poolKey(memecoin)` (the pool's full key; an unknown coin returns a zeroed key rather than
 * reverting) and `pairedToken(poolId)` (the currency the coin is paired with; `address(0)` is
 * native ETH; reverts `UnknownPool` for a pool this manager never launched).
 */
export const FlaunchPositionManagerV1_3Abi = [
  {
    type: "function",
    name: "poolKey",
    inputs: [{ name: "_token", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pairedToken",
    inputs: [{ name: "_poolId", type: "bytes32", internalType: "PoolId" }],
    outputs: [{ name: "pairedToken_", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
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
