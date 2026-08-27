// Flaunch v1.3.1 FlaunchManagerZap (flaunch-managers release v1.3.1-base): deploys + initializes a manager through the v1.3.1 TreasuryManagerFactory, sets permissions and hands ownership to the caller-chosen owner.
// Generated from flaunch-managers `out/FlaunchManagerZap.sol/FlaunchManagerZap.json` via scripts/abi-from-artifact.mjs.
export const FlaunchManagerZapV1_3Abi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_treasuryManagerFactory",
        type: "address",
        internalType: "contract ITreasuryManagerFactory"
      }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "deployAndInitializeManager",
    inputs: [
      {
        name: "_managerImplementation",
        type: "address",
        internalType: "address"
      },
      {
        name: "_owner",
        type: "address",
        internalType: "address"
      },
      {
        name: "_data",
        type: "bytes",
        internalType: "bytes"
      },
      {
        name: "_permissions",
        type: "address",
        internalType: "address"
      }
    ],
    outputs: [
      {
        name: "manager_",
        type: "address",
        internalType: "address payable"
      }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "treasuryManagerFactory",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract ITreasuryManagerFactory"
      }
    ],
    stateMutability: "view"
  }
] as const;
