import { FlaunchParamsV1_3Components } from "./FlaunchParamsV1_3";

/** Minimal paired-token launch interface without treasury-manager overloads. */
export const FlaunchZapV1_3Abi = [
  {
    type: "function",
    name: "calculateFee",
    inputs: [
      {
        name: "_flaunchParams",
        type: "tuple",
        internalType: "struct IPositionManager.FlaunchParams",
        components: FlaunchParamsV1_3Components,
      },
      { name: "_slippage", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "ethRequired_", type: "uint256", internalType: "uint256" },
      {
        name: "pairedPremineCost_",
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
        components: FlaunchParamsV1_3Components,
      },
      {
        name: "_trustedFeeSigner",
        type: "address",
        internalType: "address",
      },
      {
        name: "_maxPremineCost",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      { name: "memecoin_", type: "address", internalType: "address" },
      { name: "ethSpent_", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "payable",
  },
] as const;
