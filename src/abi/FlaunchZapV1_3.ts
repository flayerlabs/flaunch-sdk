import { FlaunchParamsV1_3Components } from "./FlaunchParamsV1_3";

/**
 * Paired-token launches with an explicit premine cap. Keep the plain overload first:
 * Drift breaks ties by ABI order when both overloads match the three plain named arguments.
 */
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
      { name: "_trustedFeeSigner", type: "address" },
      { name: "_maxPremineCost", type: "uint256" },
    ],
    outputs: [
      { name: "memecoin_", type: "address" },
      { name: "ethSpent_", type: "uint256" },
    ],
    stateMutability: "payable",
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
        name: "_treasuryManagerParams",
        type: "tuple",
        components: [
          { name: "manager", type: "address" },
          { name: "permissions", type: "address" },
          { name: "initializeData", type: "bytes" },
          { name: "depositData", type: "bytes" },
        ],
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
      { name: "deployedManager_", type: "address" },
    ],
    stateMutability: "payable",
  },
] as const;
