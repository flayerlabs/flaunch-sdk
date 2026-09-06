const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPublicClient,
  custom,
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  toHex,
  zeroAddress,
} = require("viem");
const { base, mainnet, robinhood, unichain } = require("viem/chains");
const {
  AddressFeeSplitManagerAddress,
  DynamicAddressFeeSplitManagerAddress,
  FlaunchZapAbi,
  FlaunchZapMultichainAddress,
  createFlaunchCalldata,
  decodeCallData,
} = require("../dist/index.cjs.js");

const CREATOR = "0x1111111111111111111111111111111111111111";
const FEE = 987_654_321n;
const multichainDeploymentChains = [mainnet, unichain, robinhood];
const params = {
  name: "Multichain Coin",
  symbol: "MULTI",
  tokenUri: "ipfs://multichain-coin",
  fairLaunchPercent: 0,
  fairLaunchDuration: 0,
  initialMarketCapUSD: 1234.5,
  creator: CREATOR,
  creatorFeeAllocationPercent: 1.1,
  premineAmount: 42n,
  flaunchAt: 123n,
};

function multichainHarness(chain) {
  const ethCalls = [];
  let requestCount = 0;
  const publicClient = createPublicClient({
    chain,
    transport: custom({
      async request({ method, params: rpcParams }) {
        requestCount += 1;
        if (method === "eth_chainId") return toHex(chain.id);
        if (method === "eth_call") {
          const transaction = rpcParams[0];
          ethCalls.push({
            transaction,
            decoded: decodeFunctionData({
              abi: FlaunchZapAbi,
              data: transaction.data,
            }),
          });
          return encodeAbiParameters([{ type: "uint256" }], [FEE]);
        }
        throw new Error(`Unexpected RPC request: ${method}`);
      },
    }),
  });

  return {
    ethCalls,
    get requestCount() {
      return requestCount;
    },
    sdk: createFlaunchCalldata({
      publicClient,
      walletAddress: CREATOR,
    }),
  };
}

test("multichain launches encode the canonical tuple on all three chains", async (t) => {
  for (const chain of multichainDeploymentChains) {
    await t.test(`${chain.name} (${chain.id})`, async () => {
      const harness = multichainHarness(chain);
      const encodedCall = await harness.sdk.flaunch(params);

      assert.equal(harness.ethCalls.length, 1);
      const feeCall = harness.ethCalls[0];
      assert.equal(
        feeCall.transaction.to.toLowerCase(),
        FlaunchZapMultichainAddress[chain.id].toLowerCase()
      );
      assert.equal(feeCall.decoded.functionName, "calculateFee");
      assert.equal(feeCall.decoded.args[1], 500n);

      const feeParams = feeCall.decoded.args[0];
      assert.deepEqual(Object.keys(feeParams), [
        "name",
        "symbol",
        "tokenUri",
        "premineAmount",
        "creator",
        "creatorFeeAllocation",
        "flaunchAt",
        "initialPriceParams",
        "feeCalculatorParams",
      ]);
      assert.equal(feeParams.premineAmount, 42n);
      assert.equal(feeParams.flaunchAt, 123n);
      assert.equal(feeParams.creatorFeeAllocation, 110);
      assert.equal(feeParams.feeCalculatorParams, "0x");
      assert.equal(
        decodeAbiParameters(
          [{ type: "uint256" }],
          feeParams.initialPriceParams
        )[0],
        1_234_500_000n
      );

      const transaction = decodeCallData(encodedCall);
      assert.equal(
        transaction.to.toLowerCase(),
        FlaunchZapMultichainAddress[chain.id].toLowerCase()
      );
      assert.equal(transaction.value, FEE);
      const flaunchCall = decodeFunctionData({
        abi: FlaunchZapAbi,
        data: transaction.data,
      });
      assert.equal(flaunchCall.functionName, "flaunch");
      assert.deepEqual(flaunchCall.args[0], feeParams);
      assert.equal(flaunchCall.args[1], zeroAddress);
    });
  }
});

test("multichain dynamic split launches encode the v1.2.2 manager overload", async (t) => {
  const secondRecipient = "0x2222222222222222222222222222222222222222";

  for (const chain of multichainDeploymentChains) {
    await t.test(`${chain.name} (${chain.id})`, async () => {
      const harness = multichainHarness(chain);
      const encodedCall = await harness.sdk.flaunchWithDynamicSplitManager({
        ...params,
        creatorShare: 0n,
        managerOwnerShare: 0n,
        moderator: CREATOR,
        splitReceivers: [
          { address: CREATOR, share: 5_000_000n },
          { address: secondRecipient, share: 5_000_000n },
        ],
      });

      assert.equal(harness.ethCalls.length, 1);

      const transaction = decodeCallData(encodedCall);
      assert.equal(
        transaction.to.toLowerCase(),
        FlaunchZapMultichainAddress[chain.id].toLowerCase()
      );
      assert.equal(transaction.value, FEE);

      const flaunchCall = decodeFunctionData({
        abi: FlaunchZapAbi,
        data: transaction.data,
      });
      assert.equal(flaunchCall.functionName, "flaunch");

      const managerParams = flaunchCall.args[1];
      assert.equal(
        managerParams.manager.toLowerCase(),
        DynamicAddressFeeSplitManagerAddress[chain.id].toLowerCase()
      );
      assert.equal(managerParams.permissions, zeroAddress);
      assert.equal(managerParams.depositData, "0x");
      assert.equal(flaunchCall.args[2], zeroAddress);

      const [initializeParams] = decodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              { name: "creatorShare", type: "uint256" },
              { name: "ownerShare", type: "uint256" },
              { name: "moderator", type: "address" },
              {
                name: "recipientShares",
                type: "tuple[]",
                components: [
                  { name: "recipient", type: "address" },
                  { name: "share", type: "uint256" },
                ],
              },
            ],
          },
        ],
        managerParams.initializeData
      );
      assert.equal(initializeParams.creatorShare, 0n);
      assert.equal(initializeParams.ownerShare, 0n);
      assert.equal(initializeParams.moderator, CREATOR);
      assert.deepEqual(
        initializeParams.recipientShares.map(({ recipient, share }) => ({
          recipient,
          share,
        })),
        [
          { recipient: CREATOR, share: 5_000_000n },
          { recipient: secondRecipient, share: 5_000_000n },
        ]
      );
    });
  }
});

test("unsupported multichain launch inputs fail before eth_call", async (t) => {
  const invalidCases = [
    ["fair launch percent", { fairLaunchPercent: 1 }, /Fair launches/],
    ["fair launch duration", { fairLaunchDuration: 1 }, /Fair launches/],
    [
      "trusted signer",
      { trustedSignerSettings: { enabled: false } },
      /Trusted signers/,
    ],
  ];

  for (const [name, override, error] of invalidCases) {
    await t.test(name, async () => {
      const harness = multichainHarness(robinhood);
      await assert.rejects(harness.sdk.flaunch({ ...params, ...override }), error);
      assert.equal(harness.requestCount, 0);
      assert.equal(harness.ethCalls.length, 0);
    });
  }
});

test("multichain revenue manager launches deposit into the existing instance", async (t) => {
  const revenueManagerInstanceAddress =
    "0x3333333333333333333333333333333333333333";

  for (const chain of multichainDeploymentChains) {
    await t.test(`${chain.name} (${chain.id})`, async () => {
      const harness = multichainHarness(chain);
      const encodedCall = await harness.sdk.flaunchWithRevenueManager({
        ...params,
        revenueManagerInstanceAddress,
      });

      const transaction = decodeCallData(encodedCall);
      assert.equal(
        transaction.to.toLowerCase(),
        FlaunchZapMultichainAddress[chain.id].toLowerCase()
      );
      assert.equal(transaction.value, FEE);

      const flaunchCall = decodeFunctionData({
        abi: FlaunchZapAbi,
        data: transaction.data,
      });
      assert.equal(flaunchCall.functionName, "flaunch");
      // Three arguments means the treasury-manager overload was selected. The
      // two-argument overload would encode a valid call that silently drops
      // the manager.
      assert.equal(flaunchCall.args.length, 3);

      const managerParams = flaunchCall.args[1];
      assert.equal(managerParams.manager, revenueManagerInstanceAddress);
      // An existing instance is deposited into, never re-initialized.
      assert.equal(managerParams.initializeData, "0x");
      assert.equal(managerParams.depositData, "0x");
      assert.equal(managerParams.permissions, zeroAddress);
      assert.equal(flaunchCall.args[2], zeroAddress);
    });
  }
});

test("multichain static split launches deploy the AddressFeeSplitManager", async (t) => {
  const secondRecipient = "0x2222222222222222222222222222222222222222";

  for (const chain of multichainDeploymentChains) {
    await t.test(`${chain.name} (${chain.id})`, async () => {
      const harness = multichainHarness(chain);
      const encodedCall = await harness.sdk.flaunchWithSplitManager({
        ...params,
        creatorSplitPercent: 20,
        managerOwnerSplitPercent: 0,
        splitReceivers: [
          { address: CREATOR, percent: 50 },
          { address: secondRecipient, percent: 50 },
        ],
      });

      const flaunchCall = decodeFunctionData({
        abi: FlaunchZapAbi,
        data: decodeCallData(encodedCall).data,
      });
      assert.equal(flaunchCall.args.length, 3);

      const managerParams = flaunchCall.args[1];
      assert.equal(
        managerParams.manager.toLowerCase(),
        AddressFeeSplitManagerAddress[chain.id].toLowerCase()
      );

      const [initializeParams] = decodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              { type: "uint256", name: "creatorShare" },
              { type: "uint256", name: "ownerShare" },
              {
                type: "tuple[]",
                name: "recipientShares",
                components: [
                  { type: "address", name: "recipient" },
                  { type: "uint256", name: "share" },
                ],
              },
            ],
          },
        ],
        managerParams.initializeData
      );
      assert.equal(initializeParams.creatorShare, 2_000_000n);
      assert.equal(initializeParams.ownerShare, 0n);
      assert.deepEqual(
        initializeParams.recipientShares.map(({ share }) => share),
        [5_000_000n, 5_000_000n]
      );
    });
  }
});

test("multichain plain launches still use the two-argument overload", async () => {
  const harness = multichainHarness(robinhood);
  const encodedCall = await harness.sdk.flaunch(params);

  const flaunchCall = decodeFunctionData({
    abi: FlaunchZapAbi,
    data: decodeCallData(encodedCall).data,
  });
  assert.equal(flaunchCall.args.length, 2);
  assert.equal(flaunchCall.args[1], zeroAddress);
});

const staticSplit = {
  ...params,
  creatorSplitPercent: 20,
  managerOwnerSplitPercent: 10,
  splitReceivers: [{ address: CREATOR, percent: 100 }],
};
const splitTuple = [{ type: "tuple", components: [
  { name: "creatorShare", type: "uint256" },
  { name: "ownerShare", type: "uint256" },
  { name: "recipientShares", type: "tuple[]", components: [
    { name: "recipient", type: "address" }, { name: "share", type: "uint256" },
  ] },
] }];

test("Base static splits preserve creator and owner allocations independently of recipients", async () => {
  const { sdk } = multichainHarness(base);
  sdk.readWriteFlaunchZap.flaunch = async (launch) => launch;
  const launch = await sdk.flaunchWithSplitManager(staticSplit);
  const [split] = decodeAbiParameters(splitTuple, launch.treasuryManagerParams.initializeData);
  assert.equal(split.creatorShare, 2_000_000n);
  assert.equal(split.ownerShare, 1_000_000n);
  assert.equal(split.recipientShares[0].share, 10_000_000n);
});

test("static splits reject invalid allocations before RPC on Base and multichain", async (t) => {
  const cases = [
    [{ creatorSplitPercent: 95 }, /at most 100/],
    [{ creatorSplitPercent: -1 }, /integers/],
    [{ creatorSplitPercent: 0.5 }, /integers/],
    [{ managerOwnerSplitPercent: NaN }, /integers/],
    [{ splitReceivers: [] }, /total 100/],
    [{ splitReceivers: [{ address: CREATOR, percent: 80 }] }, /total 100/],
    [{ splitReceivers: [{ address: zeroAddress, percent: 100 }] }, /nonzero/],
    [{ splitReceivers: [{ address: CREATOR, percent: 50 }, { address: CREATOR, percent: 50 }] }, /unique/],
    [{ splitReceivers: [{ address: CREATOR, percent: 0 }] }, /positive/],
  ];
  for (const chain of [base, ...multichainDeploymentChains]) {
    await t.test(chain.name, async () => {
      const harness = multichainHarness(chain);
      for (const [override, error] of cases) {
        await assert.rejects(harness.sdk.flaunchWithSplitManager({ ...staticSplit, ...override }), error);
      }
      assert.equal(harness.requestCount, 0);
    });
  }
});

test("every multichain IPFS entry point preserves its manager and uploaded URI", async (t) => {
  const axios = require("axios");
  const upload = t.mock.method(axios, "post", async () => ({ data: { ipfsHash: "test-cid" } }));
  const revenueManagerInstanceAddress = "0x3333333333333333333333333333333333333333";
  for (const chain of multichainDeploymentChains) {
    const cases = [
      ["flaunchIPFS", params, undefined],
      ["flaunchIPFSWithRevenueManager", { ...params, revenueManagerInstanceAddress }, revenueManagerInstanceAddress],
      ["flaunchIPFSWithSplitManager", staticSplit, AddressFeeSplitManagerAddress[chain.id]],
      ["flaunchIPFSWithDynamicSplitManager", {
        ...params, creatorShare: 2_000_000n, managerOwnerShare: 0n,
        moderator: CREATOR, splitReceivers: [{ address: CREATOR, share: 10_000_000n }],
      }, DynamicAddressFeeSplitManagerAddress[chain.id]],
    ];
    for (const [method, input, manager] of cases) {
      const { sdk } = multichainHarness(chain);
      const call = decodeCallData(await sdk[method]({
        ...input, metadata: { base64Image: "aW1hZ2U=", description: "Test" },
      }));
      const decoded = decodeFunctionData({ abi: FlaunchZapAbi, data: call.data });
      assert.equal(decoded.args[0].tokenUri, "ipfs://test-cid");
      assert.equal(decoded.args.length, manager ? 3 : 2);
      if (manager) assert.equal(decoded.args[1].manager.toLowerCase(), manager.toLowerCase());
    }
  }
  assert.equal(upload.mock.callCount(), 24);
});
