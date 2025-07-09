export const TreasuryManagerAbi = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      {
        name: "_flaunchToken",
        type: "tuple",
        internalType: "struct ITreasuryManager.FlaunchToken",
        components: [
          {
            name: "flaunch",
            type: "address",
            internalType: "contract Flaunch",
          },
          { name: "tokenId", type: "uint256", internalType: "uint256" },
        ],
      },
      { name: "_creator", type: "address", internalType: "address" },
      { name: "_data", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      { name: "_owner", type: "address", internalType: "address" },
      { name: "_data", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "managerOwner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "permissions",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IManagerPermissions",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rescue",
    inputs: [
      {
        name: "_flaunchToken",
        type: "tuple",
        internalType: "struct ITreasuryManager.FlaunchToken",
        components: [
          {
            name: "flaunch",
            type: "address",
            internalType: "contract Flaunch",
          },
          { name: "tokenId", type: "uint256", internalType: "uint256" },
        ],
      },
      { name: "_recipient", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPermissions",
    inputs: [
      { name: "_permissions", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferManagerOwnership",
    inputs: [
      {
        name: "_newManagerOwner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
