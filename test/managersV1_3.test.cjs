const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPublicClient,
  custom,
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  getAddress,
  parseAbi,
  toFunctionSelector,
  toHex,
  zeroAddress,
} = require("viem");
const { base, robinhood, baseSepolia, mainnet } = require("viem/chains");
const {
  createFlaunchCalldata,
  decodeCallData,
  doesChainSupportMultiAssetManagers,
  encodeRevenueManagerClaimData,
  getPermissionsAddress,
  getPermissionsAddressV1_3,
  Permissions,
  ClosedPermissionsAddress,
  FlaunchZapAddress,
  FlaunchZapV1_3Address,
  RevenueManagerAddress,
  WhitelistedPermissionsAddress,
  TreasuryManagerFactoryV1_3Address,
  RevenueManagerV1_3Address,
  AddressFeeSplitManagerV1_3Address,
  DynamicAddressFeeSplitManagerV1_3Address,
  ERC721OwnerFeeSplitManagerV1_3Address,
  StakingManagerV1_3Address,
  GroupMapperV1_3Address,
  FlaunchManagerZapV1_3Address,
  WhitelistedPermissionsV1_3Address,
  SupersededPositionManagerV1_3Address,
  FlaunchPositionManagerV1_3Address,
  getV1_3PositionManagers,
  FlaunchManagerZapV1_3Abi,
  RevenueManagerV1_3Abi,
  TreasuryManagerV1_3Abi,
} = require("../dist/index.cjs.js");

const CREATOR = "0xD2FfD38191e6B4DF807DF3F13536D1cdBE8d059e";
const PROTOCOL = "0x2222222222222222222222222222222222222222";
const MANAGER = "0x3333333333333333333333333333333333333333";
const AAPLC = "0xb200000000000000000000C2e324d24d7eEcd1fb";
const FLAUNCH_V1_3 = "0x475a09618BfD00FA4CB03B8504e95b62075E6F7D";
const ZAP = FlaunchManagerZapV1_3Address[base.id];
/** balances(address,address) */
const BALANCES_SELECTOR = "0xc23f001f";
/** claim(address[],bytes) */
const CLAIM_ASSETS_SELECTOR = "0x10f946d5";
/** claim() */
const CLAIM_SELECTOR = "0x4e71d92d";
/** claim((address,uint256)[]) */
const CLAIM_TOKENS_SELECTOR = "0x85c7a70e";
/** deployAndInitializeManager(address,address,bytes,address) */
const DEPLOY_SELECTOR = "0xfea48514";
/** payoutAssets() */
const PAYOUT_ASSETS_SELECTOR = "0x27b72e39";
const PROTOCOL_RECIPIENT_SELECTOR = toFunctionSelector("protocolRecipient()");

/** The flaunch-managers `v1.3.1-base` release (Base mainnet, blocks 50439728–50439746). */
// [map, Base address, Robinhood address] — Robinhood rows landed with FLA2-388 (2026-09-02).
const RELEASE_ADDRESSES = {
  TreasuryManagerFactoryV1_3Address: [TreasuryManagerFactoryV1_3Address, "0xB03Be6c735ef90189D6a22bBC8F6A45a33348fDe", "0xE1eBcD62AEBd327A4c22dB9e68A8E81119a7eABF"],
  RevenueManagerV1_3Address: [RevenueManagerV1_3Address, "0x908D692E628073A5B644Bc32B8dF57A5d1842288", "0xFc28B339376018727eFcD45fdb257D0A0861A391"],
  AddressFeeSplitManagerV1_3Address: [AddressFeeSplitManagerV1_3Address, "0x7dC776cf57DacA91b315fe4F8803577dAb560ba5", "0x7dc0f14204841e0314eB0265a0c420995F200243"],
  DynamicAddressFeeSplitManagerV1_3Address: [DynamicAddressFeeSplitManagerV1_3Address, "0xC4a0B79A0dB1F7F67da97E7F9A8867B6CaF017b2", "0x1969bcF2779D53FeEA95480a7ab79f7cEfeE1681"],
  ERC721OwnerFeeSplitManagerV1_3Address: [ERC721OwnerFeeSplitManagerV1_3Address, "0xDbFA9d3cab72EAE6Ba44ebC27175706aA451d9c0", "0x51BdE7C1e2Ea54949C015F4f3ED3CAE185543C0b"],
  StakingManagerV1_3Address: [StakingManagerV1_3Address, "0x72b9192017361eA00cDc1Cf1AC0F178cf89920cA", "0xd992F465d55B005E8D2Aff9fcE977Cb78f5652e0"],
  GroupMapperV1_3Address: [GroupMapperV1_3Address, "0x4a68638179De37163d86B10e6B4b927CA1a0dE87", "0xBdbF379f9EdFB5993FC00b41AAEfeE8475eAC0Ac"],
  FlaunchManagerZapV1_3Address: [FlaunchManagerZapV1_3Address, "0xD7E0c1D2B2a588cEC3b2Bdc9428FfE59b739749B", "0xAf037090FF86EFdc8d4ba82728aC93042ad1EC73"],
  WhitelistedPermissionsV1_3Address: [WhitelistedPermissionsV1_3Address, "0xaCE028CB08A19C4d2a6e442516EbA7d114C09Af9", "0xF772256B811D2241488d3d659E9cf797B387eFC3"],
};
// Base Sepolia (84532) — v1.3.1 managers deployed 2026-09-03 (blocks 46348872–46348885)
const SEPOLIA_RELEASE_ADDRESSES = {
  TreasuryManagerFactoryV1_3Address: "0x98dfdd0AAc46c85FA35d67941d394019b7e3a18d",
  RevenueManagerV1_3Address: "0x0cf6BdF0a85A9d6763361037985B76C8893553Af",
  AddressFeeSplitManagerV1_3Address: "0x7397390360Bd9D559D9277E60d47b99933791232",
  DynamicAddressFeeSplitManagerV1_3Address: "0xD37aeE3eDebf59F149b5D3b29B6Ad2239F8A6B00",
  ERC721OwnerFeeSplitManagerV1_3Address: "0xcE84bdD578c60E98E79A3A05392010b443DdaA9e",
  StakingManagerV1_3Address: "0x4D5616c04e59CE47b40e54c1D106363DA74c1a2E",
  GroupMapperV1_3Address: "0x41964Dd84F25Cd5830F5c4deEb54eFab3eD7E087",
  FlaunchManagerZapV1_3Address: "0xF175A370Eb26Ea26C42caAEcD10EE723ed844C50",
  WhitelistedPermissionsV1_3Address: "0xBe6245B2C8d59618A080BD5B2d67B3c813a9AB7c",
};


/** Drift batches concurrent reads through Multicall3; answer each inner call on its own. */
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const aggregate3Abi = parseAbi([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[] returnData)",
]);

function answerReads(call, calls, respond) {
  if (call.to.toLowerCase() === MULTICALL3.toLowerCase()) {
    const [inner] = decodeFunctionData({ abi: aggregate3Abi, data: call.data }).args;
    const results = inner.map(({ target, callData }) => {
      const innerCall = { to: target, data: callData };
      calls.push(innerCall);
      return { success: true, returnData: respond(innerCall) };
    });
    return encodeAbiParameters(aggregate3Abi[0].outputs, [results]);
  }
  calls.push(call);
  return respond(call);
}

/** A v1.3.1 manager holding ETH and AAPLc, every balance 110000678 */
function managerResponder(call) {
  const selector = call.data.slice(0, 10);
  if (selector === PAYOUT_ASSETS_SELECTOR) {
    return encodeAbiParameters([{ type: "address[]" }], [[zeroAddress, AAPLC]]);
  }
  if (selector === BALANCES_SELECTOR) {
    return encodeAbiParameters([{ type: "uint256" }], [110000678n]);
  }
  if (selector === PROTOCOL_RECIPIENT_SELECTOR) {
    return encodeAbiParameters([{ type: "address" }], [PROTOCOL]);
  }
  throw new Error(`Unexpected selector ${selector}`);
}

function publicClientFor(chain, onCall) {
  return createPublicClient({
    chain,
    transport: custom({
      async request({ method, params }) {
        if (method === "eth_chainId") return toHex(chain.id);
        if (method === "eth_call") return onCall(params[0]);
        throw new Error(`Unexpected RPC request: ${method}`);
      },
    }),
  });
}

function calldataSdk(chain, onCall = () => "0x") {
  return createFlaunchCalldata({
    publicClient: publicClientFor(chain, onCall),
    walletAddress: CREATOR,
  });
}

function decodeBalancesArgs(call) {
  return decodeFunctionData({ abi: TreasuryManagerV1_3Abi, data: call.data }).args;
}

test("the v1.3.1 manager generation is pinned to the Base, Robinhood and Base Sepolia releases and absent elsewhere", () => {
  for (const [name, [map, expectedBase, expectedRobinhood]] of Object.entries(RELEASE_ADDRESSES)) {
    assert.deepEqual(
      Object.keys(map).sort(),
      [String(robinhood.id), String(base.id), String(baseSepolia.id)].sort(),
      `${name} should be Base + Robinhood + Base Sepolia only`
    );
    assert.equal(getAddress(map[base.id]), getAddress(expectedBase), name);
    assert.equal(getAddress(map[robinhood.id]), getAddress(expectedRobinhood), name);
    assert.equal(getAddress(map[baseSepolia.id]), getAddress(SEPOLIA_RELEASE_ADDRESSES[name]), `${name} (Base Sepolia)`);
  }
  assert.equal(doesChainSupportMultiAssetManagers(baseSepolia.id), true);
  // Base Sepolia's `.vpt2` hooks were superseded by the v1.3.3 regeneration on 2026-09-03
  assert.deepEqual(
    SupersededPositionManagerV1_3Address[baseSepolia.id].map((a) => a.toLowerCase()),
    ["0x5558e7271ec2e8b2faaf05f0eedab1cd986be5dc", "0x28118f40eca9b884beb42b0196409a73269525dc"]
  );
  // ClosedPermissions is factory-agnostic and reused by the new generation
  assert.equal(getAddress(ClosedPermissionsAddress[base.id]), "0x4dfc76A31A2a0110739611683a8b6C5201480fa1");
  assert.equal(getAddress(ClosedPermissionsAddress[robinhood.id]), "0xF0469beF728c498f3621008C65B95EDa56C82Ae3");
  // the core zaps bound to each chain's v1.3.1 factory: Base's 08-27 rebind, Robinhood's v1.3.3
  // regeneration zap (deployed bound in-run; supersedes the 09-02 rebind 0xFCd1eB4B… and the
  // factory-less 0x2e744436…). Live on 4663 since 2026-09-03.
  assert.equal(getAddress(FlaunchZapV1_3Address[base.id]), "0xf787d757674b21efD713fB636B16ed994bfa82A8");
  assert.equal(getAddress(FlaunchZapV1_3Address[robinhood.id]), "0x740f8278Fd9C548fF50b64805337eA8Ad24b2553");
  // Robinhood's superseded v1.3.1 hooks stay resolvable for the coins that live on them.
  assert.deepEqual(
    SupersededPositionManagerV1_3Address[robinhood.id].map((a) => a.toLowerCase()),
    ["0x588c683ecc450f8b2aadb13d7f63792b840425dc", "0x6ea0edee449a287504990df8d87951b9436825dc"]
  );
  assert.equal(SupersededPositionManagerV1_3Address[base.id], undefined);
  assert.deepEqual(
    getV1_3PositionManagers(robinhood.id).map((a) => a.toLowerCase()),
    [FlaunchPositionManagerV1_3Address[robinhood.id].toLowerCase(), "0x588c683ecc450f8b2aadb13d7f63792b840425dc", "0x6ea0edee449a287504990df8d87951b9436825dc"]
  );
  assert.equal(doesChainSupportMultiAssetManagers(robinhood.id), true);

  assert.equal(doesChainSupportMultiAssetManagers(base.id), true);
  assert.equal(doesChainSupportMultiAssetManagers(baseSepolia.id), true); // since 2026-09-03
  assert.equal(doesChainSupportMultiAssetManagers(mainnet.id), false);
});

test("v1.3.1 permissions map WHITELISTED to the factory-bound instance and leave the old mapping alone", () => {
  assert.equal(getPermissionsAddressV1_3(Permissions.OPEN, base.id), zeroAddress);
  assert.equal(getPermissionsAddressV1_3(Permissions.CLOSED, base.id), ClosedPermissionsAddress[base.id]);
  assert.equal(getPermissionsAddressV1_3(Permissions.WHITELISTED, base.id), WhitelistedPermissionsV1_3Address[base.id]);
  assert.equal(getPermissionsAddress(Permissions.WHITELISTED, base.id), WhitelistedPermissionsAddress[base.id]);
  assert.notEqual(
    WhitelistedPermissionsV1_3Address[base.id].toLowerCase(),
    WhitelistedPermissionsAddress[base.id].toLowerCase()
  );
});

test("deployRevenueManager on the v1.3.1 manager zap encodes deployAndInitializeManager(address,address,bytes,address)", async () => {
  const sdk = calldataSdk(base);

  const encoded = await sdk.readWriteFlaunchManagerZapV1_3.deployRevenueManager({
    protocolRecipient: PROTOCOL,
    protocolFeePercent: 20,
    permissions: Permissions.WHITELISTED,
  });
  const transaction = decodeCallData(encoded);

  assert.equal(transaction.to.toLowerCase(), ZAP.toLowerCase());
  assert.equal(transaction.value, 0n);
  assert.equal(transaction.data.slice(0, 10), DEPLOY_SELECTOR);
  const decoded = decodeFunctionData({ abi: FlaunchManagerZapV1_3Abi, data: transaction.data });
  assert.equal(decoded.functionName, "deployAndInitializeManager");
  const [implementation, owner, data, permissions] = decoded.args;
  assert.equal(getAddress(implementation), getAddress(RevenueManagerV1_3Address[base.id]));
  assert.equal(getAddress(owner), PROTOCOL);
  assert.equal(getAddress(permissions), getAddress(WhitelistedPermissionsV1_3Address[base.id]));
  // (address protocolRecipient, uint256 protocolFee) with the percent in basis points
  const [params] = decodeAbiParameters(
    [{ type: "tuple", components: [{ type: "address", name: "protocolRecipient" }, { type: "uint256", name: "protocolFee" }] }],
    data
  );
  assert.deepEqual(params, { protocolRecipient: PROTOCOL, protocolFee: 2000n });

  // OPEN is the default and means no permissions contract
  const open = decodeFunctionData({
    abi: FlaunchManagerZapV1_3Abi,
    data: decodeCallData(
      await sdk.readWriteFlaunchManagerZapV1_3.deployRevenueManager({ protocolRecipient: PROTOCOL, protocolFeePercent: 0 })
    ).data,
  });
  assert.equal(open.args[3], zeroAddress);

  assert.throws(
    () => sdk.readWriteFlaunchManagerZapV1_3.deployRevenueManager({ protocolRecipient: PROTOCOL, protocolFeePercent: 101 }),
    /protocolFeePercent must be between 0 and 100/
  );
});

test("deployStakingManager on the v1.3.1 manager zap encodes the StakingManager InitializeParams tuple", async () => {
  const sdk = calldataSdk(base);
  const STAKING_TOKEN = "0x4444444444444444444444444444444444444444";

  const transaction = decodeCallData(
    await sdk.readWriteFlaunchManagerZapV1_3.deployStakingManager({
      managerOwner: PROTOCOL,
      stakingToken: STAKING_TOKEN,
      minEscrowDuration: 60n,
      minStakeDuration: 30n,
      creatorSharePercent: 10,
      ownerSharePercent: 5,
      permissions: Permissions.CLOSED,
    })
  );

  assert.equal(transaction.to.toLowerCase(), ZAP.toLowerCase());
  const [implementation, owner, data, permissions] = decodeFunctionData({
    abi: FlaunchManagerZapV1_3Abi,
    data: transaction.data,
  }).args;
  assert.equal(getAddress(implementation), getAddress(StakingManagerV1_3Address[base.id]));
  assert.equal(getAddress(owner), PROTOCOL);
  assert.equal(getAddress(permissions), getAddress(ClosedPermissionsAddress[base.id]));
  // (address stakingToken, uint256 minEscrowDuration, uint256 minStakeDuration, uint256 creatorShare, uint256 ownerShare)
  // with shares against VALID_SHARE_TOTAL = 100_00000
  const [params] = decodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { type: "address", name: "stakingToken" },
          { type: "uint256", name: "minEscrowDuration" },
          { type: "uint256", name: "minStakeDuration" },
          { type: "uint256", name: "creatorShare" },
          { type: "uint256", name: "ownerShare" },
        ],
      },
    ],
    data
  );
  assert.deepEqual(params, {
    stakingToken: STAKING_TOKEN,
    minEscrowDuration: 60n,
    minStakeDuration: 30n,
    creatorShare: 10_00000n,
    ownerShare: 5_00000n,
  });

  assert.throws(
    () =>
      sdk.readWriteFlaunchManagerZapV1_3.deployStakingManager({
        managerOwner: PROTOCOL,
        stakingToken: STAKING_TOKEN,
        minEscrowDuration: 60n,
        minStakeDuration: 30n,
        creatorSharePercent: 60,
        ownerSharePercent: 50,
      }),
    /must not exceed 100/
  );
});

test("the previous-generation deployRevenueManager still targets the old zap, implementation and permissions", async () => {
  const sdk = calldataSdk(base);

  const transaction = decodeCallData(
    await sdk.readWriteFlaunchZap.deployRevenueManager({
      protocolRecipient: PROTOCOL,
      protocolFeePercent: 20,
      permissions: Permissions.WHITELISTED,
    })
  );

  assert.equal(transaction.to.toLowerCase(), FlaunchZapAddress[base.id].toLowerCase());
  const [implementation, , , permissions] = decodeFunctionData({
    abi: FlaunchManagerZapV1_3Abi, // same selector + shape on both zaps
    data: transaction.data,
  }).args;
  assert.equal(getAddress(implementation), getAddress(RevenueManagerAddress[base.id]));
  assert.equal(getAddress(permissions), getAddress(WhitelistedPermissionsAddress[base.id]));
});

test("revenueManagerCreatorClaimV1_3 picks the claim overload from what is passed", async () => {
  const sdk = calldataSdk(base);
  const flaunchTokens = [{ flaunch: FLAUNCH_V1_3, tokenId: 7n }];

  // nothing: claim() — every asset, every token
  const all = decodeCallData(await sdk.revenueManagerCreatorClaimV1_3({ revenueManagerAddress: MANAGER }));
  assert.equal(all.to.toLowerCase(), MANAGER.toLowerCase());
  assert.equal(all.data, CLAIM_SELECTOR);

  // assets only: claim(address[],bytes) with empty data
  const subset = decodeCallData(
    await sdk.revenueManagerCreatorClaimV1_3({ revenueManagerAddress: MANAGER, assets: [AAPLC, zeroAddress] })
  );
  assert.equal(subset.data.slice(0, 10), CLAIM_ASSETS_SELECTOR);
  assert.deepEqual(decodeFunctionData({ abi: RevenueManagerV1_3Abi, data: subset.data }).args, [[AAPLC, zeroAddress], "0x"]);

  // assets + tokens: claim(address[],bytes) with the tokens ABI-encoded as FlaunchToken[]
  const subsetForTokens = decodeCallData(
    await sdk.revenueManagerCreatorClaimV1_3({ revenueManagerAddress: MANAGER, assets: [AAPLC], flaunchTokens })
  );
  const [assets, data] = decodeFunctionData({ abi: RevenueManagerV1_3Abi, data: subsetForTokens.data }).args;
  assert.deepEqual(assets, [AAPLC]);
  assert.equal(data, encodeRevenueManagerClaimData(flaunchTokens));
  assert.deepEqual(
    decodeAbiParameters([{ type: "tuple[]", components: [{ type: "address", name: "flaunch" }, { type: "uint256", name: "tokenId" }] }], data)[0],
    flaunchTokens
  );

  // tokens only: claim(FlaunchToken[])
  const forTokens = decodeCallData(await sdk.revenueManagerCreatorClaimV1_3({ revenueManagerAddress: MANAGER, flaunchTokens }));
  assert.equal(forTokens.data.slice(0, 10), CLAIM_TOKENS_SELECTOR);
  assert.deepEqual(decodeFunctionData({ abi: RevenueManagerV1_3Abi, data: forTokens.data }).args, [flaunchTokens]);
});

test("protocol and generic claims encode claim() / claim(address[],bytes) on the manager", async () => {
  const sdk = calldataSdk(base);

  const protocolAll = decodeCallData(await sdk.revenueManagerProtocolClaimV1_3({ revenueManagerAddress: MANAGER }));
  assert.equal(protocolAll.to.toLowerCase(), MANAGER.toLowerCase());
  assert.equal(protocolAll.data, CLAIM_SELECTOR);

  const protocolSubset = decodeCallData(
    await sdk.revenueManagerProtocolClaimV1_3({ revenueManagerAddress: MANAGER, assets: [AAPLC] })
  );
  assert.deepEqual(decodeFunctionData({ abi: RevenueManagerV1_3Abi, data: protocolSubset.data }).args, [[AAPLC], "0x"]);

  const generic = decodeCallData(
    await sdk.treasuryManagerClaimAssetsV1_3({ treasuryManagerAddress: MANAGER, assets: [zeroAddress], data: "0xdead" })
  );
  assert.equal(generic.to.toLowerCase(), MANAGER.toLowerCase());
  assert.equal(generic.data.slice(0, 10), CLAIM_ASSETS_SELECTOR);
  assert.deepEqual(decodeFunctionData({ abi: TreasuryManagerV1_3Abi, data: generic.data }).args, [[zeroAddress], "0xdead"]);
});

test("v1.3.1 balance reads go through balances(address,address), defaulting to the ETH bucket", async () => {
  const calls = [];
  const sdk = calldataSdk(base, (call) => answerReads(call, calls, managerResponder));

  assert.equal(
    await sdk.revenueManagerBalanceV1_3({ revenueManagerAddress: MANAGER, recipient: CREATOR, asset: AAPLC }),
    110000678n
  );
  assert.equal(await sdk.revenueManagerBalanceV1_3({ revenueManagerAddress: MANAGER, recipient: CREATOR }), 110000678n);

  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.to.toLowerCase() === MANAGER.toLowerCase()));
  assert.ok(calls.every((call) => call.data.slice(0, 10) === BALANCES_SELECTOR));
  assert.deepEqual(decodeBalancesArgs(calls[0]), [CREATOR, AAPLC]);
  assert.deepEqual(decodeBalancesArgs(calls[1]), [CREATOR, zeroAddress]);
});

test("revenueManagerPayoutAssets and treasuryManagerBalancesV1_3 enumerate the manager's payout assets", async () => {
  // Drift caches reads per client, so every step gets its own SDK to see the calls it makes
  const step = () => {
    const calls = [];
    const sdk = calldataSdk(base, (call) => answerReads(call, calls, managerResponder));
    return { calls, sdk };
  };

  {
    const { calls, sdk } = step();
    const assets = await sdk.revenueManagerPayoutAssets(MANAGER);
    assert.deepEqual(assets.map((a) => a.toLowerCase()), [zeroAddress, AAPLC.toLowerCase()]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].to.toLowerCase(), MANAGER.toLowerCase());
    assert.equal(calls[0].data, PAYOUT_ASSETS_SELECTOR);
  }

  {
    // explicit assets: one balances() per asset, no payoutAssets() lookup
    const { calls, sdk } = step();
    const explicit = await sdk.treasuryManagerBalancesV1_3({
      treasuryManagerAddress: MANAGER,
      recipient: CREATOR,
      assets: [AAPLC, zeroAddress],
    });
    assert.deepEqual(explicit, [
      { asset: AAPLC, amount: 110000678n },
      { asset: zeroAddress, amount: 110000678n },
    ]);
    assert.deepEqual(calls.map((c) => c.data.slice(0, 10)), [BALANCES_SELECTOR, BALANCES_SELECTOR]);
    assert.deepEqual(decodeBalancesArgs(calls[0]), [CREATOR, AAPLC]);
    assert.deepEqual(decodeBalancesArgs(calls[1]), [CREATOR, zeroAddress]);
  }

  {
    // no assets: payoutAssets() first, then every asset it returned
    const { calls, sdk } = step();
    const discovered = await sdk.treasuryManagerBalancesV1_3({ treasuryManagerAddress: MANAGER, recipient: CREATOR });
    assert.deepEqual(
      discovered.map(({ asset, amount }) => ({ asset: asset.toLowerCase(), amount })),
      [
        { asset: zeroAddress, amount: 110000678n },
        { asset: AAPLC.toLowerCase(), amount: 110000678n },
      ]
    );
    assert.deepEqual(calls.map((c) => c.data.slice(0, 10)), [PAYOUT_ASSETS_SELECTOR, BALANCES_SELECTOR, BALANCES_SELECTOR]);
  }

  {
    // protocol balance resolves the recipient first
    const { calls, sdk } = step();
    assert.equal(
      await sdk.revenueManagerProtocolBalanceV1_3({ revenueManagerAddress: MANAGER, asset: AAPLC }),
      110000678n
    );
    assert.deepEqual(calls.map((c) => c.data.slice(0, 10)), [PROTOCOL_RECIPIENT_SELECTOR, BALANCES_SELECTOR]);
    assert.deepEqual(decodeBalancesArgs(calls[1]), [PROTOCOL, AAPLC]);
  }
});

test("chains without the v1.3.1 manager generation say so before anything is sent", async () => {
  for (const chain of [mainnet]) {
    const requests = [];
    const sdk = calldataSdk(chain, (call) => {
      requests.push(call);
      return "0x";
    });

    assert.throws(() => sdk.readFlaunchManagerZapV1_3, new RegExp(`Multi-asset managers are not supported on chain ${chain.id}`));
    assert.throws(() => sdk.readWriteFlaunchManagerZapV1_3, new RegExp(`Multi-asset managers are not supported on chain ${chain.id}`));
    assert.throws(() => sdk.readTreasuryManagerFactoryV1_3, new RegExp(`Multi-asset managers are not supported on chain ${chain.id}`));
    assert.throws(
      () => sdk.revenueManagerBalanceV1_3({ revenueManagerAddress: MANAGER, recipient: CREATOR }),
      new RegExp(`revenueManagerBalanceV1_3 is not supported on chain ${chain.id}`)
    );
    assert.throws(
      () => sdk.revenueManagerPayoutAssets(MANAGER),
      new RegExp(`revenueManagerPayoutAssets is not supported on chain ${chain.id}`)
    );
    await assert.rejects(
      () => sdk.revenueManagerProtocolBalanceV1_3({ revenueManagerAddress: MANAGER }),
      new RegExp(`revenueManagerProtocolBalanceV1_3 is not supported on chain ${chain.id}`)
    );
    assert.throws(
      () => sdk.treasuryManagerBalancesV1_3({ treasuryManagerAddress: MANAGER, recipient: CREATOR }),
      new RegExp(`treasuryManagerBalancesV1_3 is not supported on chain ${chain.id}`)
    );
    assert.throws(
      () => sdk.revenueManagerCreatorClaimV1_3({ revenueManagerAddress: MANAGER }),
      new RegExp(`revenueManagerCreatorClaimV1_3 is not supported on chain ${chain.id}`)
    );
    assert.throws(
      () => sdk.revenueManagerProtocolClaimV1_3({ revenueManagerAddress: MANAGER }),
      new RegExp(`revenueManagerProtocolClaimV1_3 is not supported on chain ${chain.id}`)
    );
    assert.throws(
      () => sdk.treasuryManagerClaimAssetsV1_3({ treasuryManagerAddress: MANAGER, assets: [zeroAddress] }),
      new RegExp(`treasuryManagerClaimAssetsV1_3 is not supported on chain ${chain.id}`)
    );
    await assert.rejects(
      () => sdk.deployRevenueManagerV1_3({ protocolRecipient: PROTOCOL, protocolFeePercent: 20 }),
      new RegExp(`deployRevenueManagerV1_3 is not supported on chain ${chain.id}`)
    );
    assert.equal(requests.length, 0, `an RPC call was made on ${chain.id}`);
  }
});
