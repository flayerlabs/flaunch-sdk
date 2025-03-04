import {
  Address,
  encodeAbiParameters,
  encodeFunctionData,
  Hex,
  maxUint160,
  maxUint256,
  maxUint48,
  parseEther,
  zeroAddress,
} from "viem";
import {
  FlaunchPositionManagerAddress,
  FLETHAddress,
  FLETHHooksAddress,
  Permit2Address,
  UniversalRouterAddress,
} from "addresses";
import { UniversalRouterAbi } from "../abi/UniversalRouter";

export type PermitDetails = {
  token: Address;
  amount: bigint;
  expiration: number;
  nonce: number;
};

export type PermitSingle = {
  details: PermitDetails;
  spender: Address;
  sigDeadline: bigint;
};

const IV4RouterAbiExactInput = [
  {
    type: "tuple",
    components: [
      { type: "address", name: "currencyIn" },
      {
        type: "tuple[]",
        name: "path",
        components: [
          { type: "address", name: "intermediateCurrency" },
          { type: "uint24", name: "fee" },
          { type: "int24", name: "tickSpacing" },
          { type: "address", name: "hooks" },
          { type: "bytes", name: "hookData" },
        ],
      },
      { type: "uint128", name: "amountIn" },
      { type: "uint128", name: "amountOutMinimum" },
    ],
  },
] as const;

const IV4RouterAbiExactOutput = [
  {
    type: "tuple",
    components: [
      { type: "address", name: "currencyOut" },
      {
        type: "tuple[]",
        name: "path",
        components: [
          { type: "address", name: "intermediateCurrency" },
          { type: "uint24", name: "fee" },
          { type: "int24", name: "tickSpacing" },
          { type: "address", name: "hooks" },
          { type: "bytes", name: "hookData" },
        ],
      },
      { type: "uint128", name: "amountOut" },
      { type: "uint128", name: "amountInMaximum" },
    ],
  },
] as const;

const V4Actions = {
  SWAP_EXACT_IN: "07",
  SWAP_EXACT_OUT: "09",
  SETTLE_ALL: "0c",
  TAKE_ALL: "0f",
};

const URCommands = {
  V4_SWAP: "10",
  SWEEP: "04",
  PERMIT2_PERMIT: "0a",
};

export const getAmountWithSlippage = (
  amount: bigint | undefined,
  slippage: string,
  swapType: "EXACT_IN" | "EXACT_OUT"
) => {
  if (amount == null) {
    return 0n;
  }

  const absAmount = amount < 0n ? -amount : amount;
  const slippageMultiplier =
    swapType === "EXACT_IN"
      ? BigInt(1e18) - parseEther(slippage)
      : BigInt(1e18) + parseEther(slippage);

  return (absAmount * slippageMultiplier) / BigInt(1e18);
};

const ETH = zeroAddress;

export const ethToMemecoin = (params: {
  sender: Address;
  memecoin: Address;
  chainId: number;
  referrer: Address | null;
  swapType: "EXACT_IN" | "EXACT_OUT";
  amountIn?: bigint; // Required for 'EXACT_IN' swap
  amountOutMin?: bigint; // Required for 'EXACT_IN' swap
  amountOut?: bigint; // Required for 'EXACT_OUT' swap
  amountInMax?: bigint; // Required for 'EXACT_OUT' swap
}) => {
  const flETH = FLETHAddress[params.chainId];
  const flETHHooks = FLETHHooksAddress[params.chainId];
  const flaunchHooks = FlaunchPositionManagerAddress[params.chainId];

  // Determine actions based on swapType
  const v4Actions = ("0x" +
    (params.swapType === "EXACT_IN"
      ? V4Actions.SWAP_EXACT_IN
      : V4Actions.SWAP_EXACT_OUT) +
    V4Actions.SETTLE_ALL +
    V4Actions.TAKE_ALL) as Hex;

  // Initialize variables for path and v4Params
  let path;
  let v4Params;

  // Configure path and parameters based on swapType
  if (params.swapType === "EXACT_IN") {
    if (params.amountIn == null || params.amountOutMin == null) {
      throw new Error(
        "amountIn and amountOutMin are required for EXACT_IN swap"
      );
    }

    // Path for 'EXACT_IN' swap
    path = [
      {
        intermediateCurrency: flETH,
        fee: 0,
        tickSpacing: 60,
        hooks: flETHHooks,
        hookData: "0x" as Address,
      },
      {
        intermediateCurrency: params.memecoin,
        fee: 0,
        tickSpacing: 60,
        hooks: flaunchHooks,
        hookData: encodeAbiParameters(
          [{ type: "address", name: "referrer" }],
          [params.referrer ?? zeroAddress]
        ),
      },
    ];

    // Parameters for 'EXACT_IN' swap
    v4Params = encodeAbiParameters(IV4RouterAbiExactInput, [
      {
        currencyIn: ETH,
        path: path,
        amountIn: params.amountIn,
        amountOutMinimum: params.amountOutMin,
      },
    ]);
  } else {
    if (params.amountOut == null || params.amountInMax == null) {
      throw new Error(
        "amountOut and amountInMax are required for EXACT_OUT swap"
      );
    }

    // Path for 'EXACT_OUT' swap
    path = [
      {
        fee: 0,
        tickSpacing: 60,
        hookData: "0x" as `0x${string}`,
        hooks: flETHHooks,
        intermediateCurrency: ETH,
      },
      {
        fee: 0,
        tickSpacing: 60,
        hooks: flaunchHooks,
        intermediateCurrency: flETH,
        hookData: encodeAbiParameters(
          [{ type: "address", name: "referrer" }],
          [params.referrer ?? zeroAddress]
        ) as `0x${string}`,
      },
    ];

    // Parameters for 'EXACT_OUT' swap
    v4Params = encodeAbiParameters(IV4RouterAbiExactOutput, [
      {
        currencyOut: params.memecoin,
        path: path,
        amountOut: params.amountOut,
        amountInMaximum: params.amountInMax,
      },
    ]);
  }

  // Common parameters for both swap types
  const settleParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "maxAmount",
      },
    ],
    [
      ETH,
      params.swapType === "EXACT_IN"
        ? params.amountIn ?? maxUint256
        : params.amountInMax ?? maxUint256,
    ]
  );

  const takeParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "minAmount",
      },
    ],
    [
      params.memecoin,
      params.swapType === "EXACT_IN"
        ? params.amountOutMin ?? maxUint256
        : params.amountOut ?? maxUint256,
    ]
  );

  // Encode router data
  const v4RouterData = encodeAbiParameters(
    [
      { type: "bytes", name: "actions" },
      { type: "bytes[]", name: "params" },
    ],
    [v4Actions, [v4Params, settleParams, takeParams]]
  );

  // Commands for Universal Router
  const urCommands = ("0x" + URCommands.V4_SWAP + URCommands.SWEEP) as Hex;
  const sweepInput = encodeAbiParameters(
    [
      { type: "address", name: "token" },
      { type: "address", name: "recipient" },
      { type: "uint160", name: "amountIn" },
    ],
    [ETH, params.sender, 0n]
  );

  // Encode calldata for Universal Router
  const inputs = [v4RouterData, sweepInput];
  const urExecuteCalldata = encodeFunctionData({
    abi: UniversalRouterAbi,
    functionName: "execute",
    args: [urCommands, inputs],
  });

  return {
    calldata: urExecuteCalldata,
    commands: urCommands,
    inputs,
  };
};

// @notice Beofre calling the UniversalRouter the user must have:
// 1. Given the Permit2 contract allowance to spend the memecoin
export const memecoinToEthWithPermit2 = (params: {
  chainId: number;
  memecoin: Address;
  amountIn: bigint;
  ethOutMin: bigint;
  permitSingle: PermitSingle | undefined;
  signature: Hex | undefined;
  referrer: Address | null;
}) => {
  const flETH = FLETHAddress[params.chainId];

  const flETHHooks = FLETHHooksAddress[params.chainId];
  const flaunchHooks = FlaunchPositionManagerAddress[params.chainId];
  const v4Actions = ("0x" +
    V4Actions.SWAP_EXACT_IN +
    V4Actions.SETTLE_ALL +
    V4Actions.TAKE_ALL) as Hex;
  const v4ExactInputParams = encodeAbiParameters(IV4RouterAbiExactInput, [
    {
      currencyIn: params.memecoin,
      path: [
        {
          intermediateCurrency: flETH,
          fee: 0,
          tickSpacing: 60,
          hooks: flaunchHooks,
          hookData: encodeAbiParameters(
            [
              {
                type: "address",
                name: "referrer",
              },
            ],
            [params.referrer ?? zeroAddress]
          ),
        },
        {
          intermediateCurrency: ETH,
          fee: 0,
          tickSpacing: 60,
          hooks: flETHHooks,
          hookData: "0x",
        },
      ],
      amountIn: params.amountIn,
      amountOutMinimum: params.ethOutMin,
    },
  ]);

  const settleParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "maxAmount",
      },
    ],
    [params.memecoin, params.amountIn]
  );

  const takeParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "minAmount",
      },
    ],
    [ETH, params.ethOutMin]
  );

  const v4RouterData = encodeAbiParameters(
    [
      { type: "bytes", name: "actions" },
      { type: "bytes[]", name: "params" },
    ],
    [v4Actions, [v4ExactInputParams, settleParams, takeParams]]
  );

  if (params.signature && params.permitSingle) {
    const urCommands = ("0x" +
      URCommands.PERMIT2_PERMIT +
      URCommands.V4_SWAP) as Hex;

    const permit2PermitInput = encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            {
              type: "tuple",
              components: [
                { type: "address", name: "token" },
                { type: "uint160", name: "amount" },
                { type: "uint48", name: "expiration" },
                { type: "uint48", name: "nonce" },
              ],
              name: "details",
            },
            { type: "address", name: "spender" },
            { type: "uint256", name: "sigDeadline" },
          ],
          name: "PermitSingle",
        },
        { type: "bytes", name: "signature" },
      ],
      [params.permitSingle, params.signature]
    );

    const inputs = [permit2PermitInput, v4RouterData];
    const urExecuteCalldata = encodeFunctionData({
      abi: UniversalRouterAbi,
      functionName: "execute",
      args: [urCommands, inputs],
    });

    return {
      calldata: urExecuteCalldata,
      commands: urCommands,
      inputs,
    };
  } else {
    const urCommands = ("0x" + URCommands.V4_SWAP) as Hex;

    const inputs = [v4RouterData];
    const urExecuteCalldata = encodeFunctionData({
      abi: UniversalRouterAbi,
      functionName: "execute",
      args: [urCommands, inputs],
    });

    return {
      calldata: urExecuteCalldata,
      commands: urCommands,
      inputs,
    };
  }
};

export const PERMIT_DETAILS = [
  { name: "token", type: "address" },
  { name: "amount", type: "uint160" },
  { name: "expiration", type: "uint48" },
  { name: "nonce", type: "uint48" },
];

export const PERMIT_TYPES = {
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: PERMIT_DETAILS,
};

export const getPermit2TypedData = ({
  chainId,
  coinAddress,
  nonce,
  deadline,
}: {
  chainId: number;
  coinAddress: Address;
  nonce: number;
  deadline?: bigint;
}): {
  typedData: {
    primaryType: string;
    domain: {
      name: string;
      chainId: number;
      verifyingContract: Address;
    };
    types: typeof PERMIT_TYPES;
    message: PermitSingle;
  };
  permitSingle: PermitSingle;
} => {
  const domain = {
    name: "Permit2",
    chainId,
    verifyingContract: Permit2Address[chainId],
  };

  const message = {
    details: {
      token: coinAddress,
      amount: maxUint160,
      expiration: deadline === undefined ? Number(maxUint48) : Number(deadline),
      nonce,
    },
    spender: UniversalRouterAddress[chainId],
    sigDeadline: deadline === undefined ? maxUint256 : deadline,
  };

  const typedData = {
    primaryType: "PermitSingle",
    domain,
    types: PERMIT_TYPES,
    message,
  } as const;

  return {
    typedData,
    permitSingle: message,
  };
};
