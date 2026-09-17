const test = require("node:test");
const assert = require("node:assert/strict");
const { createPublicClient, custom, decodeFunctionData, getAddress, toHex, zeroAddress } = require("viem");
const { arbitrum, base, mainnet } = require("viem/chains");
const sdk = require("../dist/index.cjs.js");

// v1.4.1 updated arbitrum-mainnet.json, including the 2026-09-14 manager/zap addendum.
// Uniswap periphery: https://developers.uniswap.org/docs/protocols/v4/deployments#arbitrum-one-42161
const DEPLOYMENTS = {
  "FlaunchZapV1_3Address": "0xBd5ae825DDC67834002A6b586CfF5802971e3A7F",
  "FlaunchPositionManagerV1_3Address": "0xCAb62e007AB6656877Ab556cEa330De27AE025DC",
  "PairedTokenPositionManagerV1_3Address": "0xCAb62e007AB6656877Ab556cEa330De27AE025DC",
  "PairedTokenRegistryV1_3Address": "0x16EF4F8e1d41cE4727d98ae0E9EC4e9cDDd14Ac4",
  "PoolSwapV1_3Address": "0x206cD26d8567Ea76Ffa719995251a3878073Fb8A",
  "AnyPositionManagerV1_3Address": "0xbbE1b9831117E829Fe80Be97fCe82F2b49C1a5DC",
  "FlaunchV1_3Address": "0x99c55BC5C2e4a15a98cBc705F240cF8b1889775f",
  "AnyFlaunchV1_3Address": "0x71001DD43209015cdd430F2ea043c93AfcE43666",
  "BidWallV1_3Address": "0x36b41E8F726011D26Dc9812d2e8E76F490e9B590",
  "AnyBidWallV1_3Address": "0xd9e3c35ea96C1108a574050BD1Be940b1622A147",
  "TreasuryManagerFactoryV1_3Address": "0x15617e43Ba6E4f51cE2A54d30Af26E744190e313",
  "RevenueManagerV1_3Address": "0x32e59c950DBBf0123E3A7008DaB56480c3500983",
  "AddressFeeSplitManagerV1_3Address": "0xB4512bf57d50fbcb64a3adF8b17a79b2A204C18C",
  "DynamicAddressFeeSplitManagerV1_3Address": "0xFE5a906379F78965393D23BC604036bb74214926",
  "ERC721OwnerFeeSplitManagerV1_3Address": "0x8C31AC369f6e2807109d0C25F2c26dB6A666138e",
  "StakingManagerV1_3Address": "0xA56f12E2488E0Eb0EFC3468a39aefEFa9F28233a",
  "GroupMapperV1_3Address": "0xd0c557c72B2d381f7794599E4d39d906744FBc21",
  "FlaunchManagerZapV1_3Address": "0xa55904b7a456859649766CF7f30264A90285df05",
  "TokenImporterV1_3Address": "0x083a628477048CB37831A4A7D8Ebff1A0659af3f",
  "WhitelistedPermissionsV1_3Address": "0x862D5471B3E49d48E2E152793f00c91a9CAf054A",
  "FeeEscrowV1_3Address": "0x635B4afCf977ed946BDa31fc7E381c970159077a",
  "ReferralEscrowV1_3Address": "0x9972EFc88674bbeeB1B0f0116A73a3006a98Ba3c",
  "PoolManagerAddress": "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
  "UniversalRouterAddress": "0xa51afafe0263b40edaef0df8781ea9aa03e381a3",
  "QuoterAddress": "0x3972c00f7ed4885e145823eb7c655375d275a1c5",
  "StateViewAddress": "0x76fd297e2d437cd7f76d50f01afe6160f86e9990",
  "Permit2Address": "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  "UniV4PositionManagerAddress": "0xd88f38f930b7952f2db2432cb002e7abbf3dd869",
  "ClosedPermissionsV1_3Address": "0x8ea82B35B890987CD6B55271F593aBbC0Fe226f6"
};
const CREATOR = "0x1111111111111111111111111111111111111111";

test("Arbitrum deployments match the released core, managers and Uniswap periphery", () => {
  for (const [name, address] of Object.entries(DEPLOYMENTS)) {
    assert.equal(getAddress(sdk[name][arbitrum.id]), getAddress(address), name);
  }
  assert.equal(sdk.isChainSupported(arbitrum.id), true);
  assert.equal(sdk.isV1_4Deployment(arbitrum.id), true);
  assert.equal(sdk.isV1_4Deployment(mainnet.id), true);
  assert.equal(sdk.isV1_4Deployment(base.id), false);
  assert.equal(sdk.DefaultPairedTokenAddress[arbitrum.id], zeroAddress);
  for (const capability of [
    "doesChainSupportPairedTokenLaunch", "doesChainSupportPairedTokenSwap",
    "doesChainSupportMultiTokenFeeEscrow", "doesChainSupportMultiAssetManagers",
    "doesChainSupportSplitManager",
  ]) assert.equal(sdk[capability](arbitrum.id), true, capability);
  for (const name of ["FLETHAddress", "FLETHHooksAddress", "FeeEscrowAddress", "FlaunchZapMultichainAddress", "DopplerVerifierAddress"]) {
    assert.equal(sdk[name][arbitrum.id], undefined, name);
  }
  assert.equal(sdk.doesChainSupportMultichainNativeETHSwap(arbitrum.id), false);
  assert.equal(sdk.doesChainSupportPairedTokenAcquisition(arbitrum.id), false);
  for (const hook of sdk.getV1_3PositionManagers(arbitrum.id)) {
    assert.equal(sdk.poolSwapForHook(arbitrum.id, getAddress(hook)), DEPLOYMENTS.PoolSwapV1_3Address);
  }
});

test("Arbitrum SDK never constructs absent legacy contracts", () => {
  const addresses = [];
  const drift = { contract({ address }) {
    assert.ok(address, "every client must have a deployed address");
    addresses.push(address.toLowerCase());
    return { address };
  }};
  const client = new sdk.ReadWriteFlaunchSDK(arbitrum.id, drift);
  assert.ok(addresses.includes(DEPLOYMENTS.FlaunchZapV1_3Address.toLowerCase()));
  assert.ok(addresses.includes(DEPLOYMENTS.TreasuryManagerFactoryV1_3Address.toLowerCase()));
  assert.throws(() => client.readFlaunchZapMultichain, /multichain FlaunchZap is not deployed/);
  assert.throws(() => client.readFeeEscrow, /Legacy FeeEscrow.*creatorRevenueByToken/);
  assert.throws(() => client.readWriteFeeEscrow, /Legacy FeeEscrow.*withdrawCreatorRevenueByToken/);
  assert.equal(client.readFeeEscrowV1_3.contract.address, DEPLOYMENTS.FeeEscrowV1_3Address);
});

test("Arbitrum native fee claims encode only the current multi-token escrow", async () => {
  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: custom({ async request({ method }) {
      if (method === "eth_chainId") return toHex(arbitrum.id);
      throw new Error(`Unexpected RPC request: ${method}`);
    }}),
  });
  const client = sdk.createFlaunchCalldata({ publicClient, walletAddress: CREATOR });
  const tx = sdk.decodeCallData(await client.withdrawCreatorRevenueByToken({ tokens: [zeroAddress] }));
  assert.equal(tx.to.toLowerCase(), DEPLOYMENTS.FeeEscrowV1_3Address.toLowerCase());
  assert.equal(tx.value, 0n);
  const decoded = decodeFunctionData({ abi: sdk.FeeEscrowV1_3Abi, data: tx.data });
  assert.equal(decoded.functionName, "withdrawFees");
  assert.deepEqual(decoded.args, [[zeroAddress], CREATOR, true]);
});

test("Arbitrum receipt parsing ignores unrelated and malformed logs", () => {
  const drift = { contract({ address }) { return { address }; } };
  const client = new sdk.ReadFlaunchSDK(arbitrum.id, drift);
  for (const address of [CREATOR, DEPLOYMENTS.FlaunchPositionManagerV1_3Address, DEPLOYMENTS.AnyPositionManagerV1_3Address]) {
    assert.equal(client.getPoolCreatedFromLogs([{ address, topics: [], data: "0x" }]), null);
  }
});


test("combined candidate retains Arbitrum pre-buy and Sepolia preview capabilities", () => {
  const capabilities = sdk.getLaunchPreBuyCapabilities(arbitrum.id);
  assert.equal(capabilities.routes.pairedToken.supported, true);
  assert.equal(capabilities.routes.dynamicSplitManager.supported, false);
  // the CREATE3 parity maps make Arbitrum a vested / Game Mode chain as well
  assert.equal(sdk.doesChainSupportVestedLaunch(arbitrum.id), true);
  assert.equal(sdk.doesChainSupportGameDeveloperSplit(arbitrum.id), true);
  assert.equal(sdk.doesChainSupportVestedLaunch(84532), true);
  assert.equal(sdk.doesChainSupportGameDeveloperSplit(84532), true);
  assert.equal(sdk.doesChainSupportAnyGameDeveloperSplit(84532), true);
});
