const test = require("node:test");
const assert = require("node:assert/strict");
const {
  decodeAbiParameters, decodeFunctionData, encodeAbiParameters,
  encodeEventTopics, getAddress, parseAbi, zeroAddress,
} = require("viem");
const { base, baseSepolia, mainnet, robinhood, unichain } = require("viem/chains");
const sdkExports = require("../dist/index.cjs.js");
const {
  AnyPositionManagerV1_3Address,
  DefaultPairedTokenAddress, FLETHAddress, FlaunchVersion,
  FlaunchZapV1_3Abi, FlaunchZapV1_3Address, PairedTokenPositionManagerV1_3Address,
  Permissions, ReadFlaunchSDK, ReadWriteFlaunchSDK, getPermissionsAddressV1_3,
  getPoolId, getV1_3PositionManagers, pairedPoolKey,
} = sdkExports;

// flaunch-contracts v1.4.0 deployments/ethereum-mainnet-2026-09-11.json;
// deployed core 62c95ca2, managers 17e018f3. Legacy maps must remain separate.
const RELEASE_ADDRESSES = {
  FlaunchPositionManagerV1_3Address: "0xb741a710E456FC6d7f76c88F5C56B27D05e8A5DC",
  PairedTokenPositionManagerV1_3Address: "0xb741a710E456FC6d7f76c88F5C56B27D05e8A5DC",
  AnyPositionManagerV1_3Address: "0x0215C3ef94ef3e86c32e847c662ad649000965Dc",
  FlaunchV1_3Address: "0x393a09033Bf60cF67809d6D8b77C1254f39d2FF9",
  AnyFlaunchV1_3Address: "0x154f2E2ef6fAdFFe6bCF4d86a2639A6Ef4981c5C",
  FlaunchZapV1_3Address: "0x11666704fcd96e1CAFF9b99501FA1e79D64900fC",
  PoolSwapV1_3Address: "0x05c6C717B2a985809a83D27F779044c2da27fd56",
  PairedTokenRegistryV1_3Address: "0xFc28B339376018727eFcD45fdb257D0A0861A391",
  FeeEscrowV1_3Address: "0xd992F465d55B005E8D2Aff9fcE977Cb78f5652e0",
  BidWallV1_3Address: "0xE02e0C934969647E0099Cb231BBC6BBCe1b91dF6",
  AnyBidWallV1_3Address: "0xE1eBcD62AEBd327A4c22dB9e68A8E81119a7eABF",
  ReferralEscrowV1_3Address: "0x2FAde59484677FE39144D6d1B74aE57E8E424595",
  TokenImporterV1_3Address: "0x319A17b4D6529107FC9a8312371f3C74D4083e5e",
  TreasuryManagerFactoryV1_3Address: "0xD2B91d92AF59b7BEd15b5458feCF0e87C8A7c21e",
  RevenueManagerV1_3Address: "0xf2947840eeA730f9E9ECC6559526392d68e89569",
  AddressFeeSplitManagerV1_3Address: "0x740f8278Fd9C548fF50b64805337eA8Ad24b2553",
  DynamicAddressFeeSplitManagerV1_3Address: "0x0f03Aa8d303Ee15ed3Be81Bf43c41EFfFa4a7a5B",
  ERC721OwnerFeeSplitManagerV1_3Address: "0x43ff2F15A821C24A0576Fc376B789846080F2F0f",
  StakingManagerV1_3Address: "0xEf8be05d08fbCBFB89bAa05fA7a56BD818Ca9181",
  GroupMapperV1_3Address: "0x3F7C69F516238FEC37CF06Fde0B95BD37B2B531D",
  FlaunchManagerZapV1_3Address: "0xf7579C3cb8607F6CE00311465d28Ac45666f39Ad",
  ClosedPermissionsV1_3Address: "0x00BD5d089626F84E0DfF241D5e71336Add6D4bF3",
  WhitelistedPermissionsV1_3Address: "0x4765Ea884Bc29219eCC430F2C478d4f646071d78",
};
const COIN = "0xf000000000000000000000000000000000000001";
const CREATOR = "0x1111111111111111111111111111111111111111";
const TREASURY = "0x2222222222222222222222222222222222222222";
const MILADY = "0x8b3bc6942d6823a8022605648b671a2feb954800";
const HOOK = PairedTokenPositionManagerV1_3Address[mainnet.id];
const ANY_HOOK = AnyPositionManagerV1_3Address[mainnet.id];
const TX_HASH = `0x${"01".repeat(32)}`;

function harness(hook = HOOK, pairedToken = zeroAddress) {
  const calls = [];
  const key = pairedPoolKey(COIN, pairedToken, hook);
  const drift = {
    contract({ address, abi }) {
      return {
        address,
        async read(fn, args) {
          calls.push({ kind: "read", address, fn, args });
          if (fn === "poolKey") return address.toLowerCase() === hook.toLowerCase() && args._token.toLowerCase() === COIN
            ? key : { ...key, tickSpacing: 0, hooks: zeroAddress };
          if (fn === "flaunchContract") return hook === ANY_HOOK ? RELEASE_ADDRESSES.AnyFlaunchV1_3Address : RELEASE_ADDRESSES.FlaunchV1_3Address;
          if (fn === "tokenId") return 7n;
          if (fn === "getFlaunchingMarketCap") return 4n * 10n ** 18n;
          if (fn === "initialPrice") return "0x8FAaCFd24B6EaAa4e51DE1686930fbF4b5Fa8ab0";
          if (fn === "getFlaunchingFee") return 100n;
          if (fn === "calculateFee") return { ethRequired_: 123n, pairedPremineCost_: 0n };
          if (fn === "getSlot0") return { sqrtPriceX96: 0n, tick: 100, protocolFee: 0, lpFee: 0 };
          throw new Error(`Unexpected read ${fn}`);
        },
        async write(fn, args, options) {
          calls.push({ kind: "write", address, abi, fn, args, options });
          return TX_HASH;
        },
      };
    },
  };
  return { calls, key, sdk: new ReadWriteFlaunchSDK(mainnet.id, drift), drift };
}

test("Ethereum maps match the verified deployment and keep legacy/default pairings separate", () => {
  for (const [name, address] of Object.entries(RELEASE_ADDRESSES)) {
    assert.equal(getAddress(sdkExports[name][mainnet.id]), getAddress(address), name);
  }
  assert.equal(DefaultPairedTokenAddress[mainnet.id], zeroAddress);
  assert.equal(FLETHAddress[mainnet.id], "0x000000000bB1f9944965c64066D10038a84F9af2");
  for (const chain of [base, baseSepolia, robinhood, unichain]) {
    assert.equal(DefaultPairedTokenAddress[chain.id], FLETHAddress[chain.id]);
  }
  assert.deepEqual(getV1_3PositionManagers(mainnet.id), [HOOK, ANY_HOOK]);
  assert.equal(getPermissionsAddressV1_3(Permissions.CLOSED, mainnet.id), RELEASE_ADDRESSES.ClosedPermissionsV1_3Address);
  assert.equal(getPermissionsAddressV1_3(Permissions.WHITELISTED, mainnet.id), RELEASE_ADDRESSES.WhitelistedPermissionsV1_3Address);
  assert.equal(sdkExports.QuoterAddress[mainnet.id], "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203");
  assert.equal(sdkExports.Permit2Address[mainnet.id], "0x000000000022D473030F116dDEE9F6B43aC78BA3");
});

test("native fee and USD helpers use current contracts and correct denominations", async () => {
  const { sdk, calls } = harness();
  assert.equal(await sdk.getETHUSDCPrice(), 2500);
  assert.equal(await sdk.getFlaunchingFee({ sender: CREATOR, initialMarketCapUSD: 10_000, slippagePercent: 5 }), 105n);
  assert.equal(await sdk.ethRequiredToFlaunch({ premineAmount: 5n, initialMarketCapUSD: 10_000, slippagePercent: 2 }), 123n);
  const price = calls.find(({ fn }) => fn === "getFlaunchingMarketCap");
  assert.equal(price.address, HOOK);
  assert.deepEqual(decodeAbiParameters([{ type: "uint256" }], price.args._initialPriceParams), [10_000_000_000n]);
  const quote = calls.find(({ fn }) => fn === "calculateFee");
  assert.equal(quote.address, FlaunchZapV1_3Address[mainnet.id]);
  assert.equal(quote.args._flaunchParams.pairedToken, zeroAddress);
  assert.equal(quote.args._flaunchParams.premineAmount, 5n);
  assert.equal(quote.args._slippage, 200n);
});

test("paired-token manager launches retain the caller's cap, funding and manager tuple", async () => {
  const { sdk, calls } = harness();
  const flaunchParams = {
    name: "Test", symbol: "TEST", tokenUri: "ipfs://test", premineAmount: 100n,
    creator: CREATOR, creatorFeeAllocation: 10_000, flaunchAt: 0n,
    initialPriceParams: encodeAbiParameters([{ type: "uint256" }], [10_000_000_000n]),
    feeCalculatorParams: "0x", pairedToken: MILADY,
  };
  const treasuryManagerParams = {
    manager: RELEASE_ADDRESSES.DynamicAddressFeeSplitManagerV1_3Address,
    permissions: RELEASE_ADDRESSES.WhitelistedPermissionsV1_3Address,
    initializeData: "0x1234", depositData: "0xabcd",
  };
  await sdk.flaunchPairedToken({ flaunchParams, treasuryManagerParams, trustedFeeSigner: zeroAddress, maxPremineCost: 456n, value: 123n });
  const call = calls.find(({ kind }) => kind === "write");
  assert.equal(call.address, FlaunchZapV1_3Address[mainnet.id]);
  assert.deepEqual(call.args, { _flaunchParams: flaunchParams, _treasuryManagerParams: treasuryManagerParams, _trustedFeeSigner: zeroAddress, _maxPremineCost: 456n });
  assert.equal(call.options.value, 123n);
  // Test the actual overload encoding, not only the recorded named arguments.
  const { encodeFunctionData } = require("viem");
  const decoded = decodeFunctionData({ abi: FlaunchZapV1_3Abi, data: encodeFunctionData({
    abi: call.abi, functionName: call.fn, args: [flaunchParams, treasuryManagerParams, zeroAddress, 456n],
  }) });
  assert.equal(decoded.args.length, 4);
  assert.equal(decoded.args[3], 456n);
});

test("current AnyPositionManager pools resolve their actual pool and NFT contract", async () => {
  const { sdk, key } = harness(ANY_HOOK, MILADY);
  assert.equal(await sdk.getCoinVersion(COIN), FlaunchVersion.V1_3);
  assert.equal(await sdk.getPositionManagerAddressForCoin(COIN), ANY_HOOK);
  assert.equal(await sdk.poolId(COIN), getPoolId(key));
  assert.deepEqual(await sdk.getFlaunchTokenIdForMemecoin(COIN), {
    flaunchAddress: RELEASE_ADDRESSES.AnyFlaunchV1_3Address, tokenId: 7n,
  });
  await assert.rejects(() => sdk.coinPriceInETH(COIN), /ERC20-paired coin prices require conversion/);
});

test("native ETH coin prices read the actual pool and invert its nonzero tick", async () => {
  const { sdk, key, calls } = harness();
  const price = await sdk.coinPriceInETH(COIN);
  assert.match(price, /^\d+\.\d{18}$/);
  assert.ok(Math.abs(Number(price) - 0.9900503287412106) < 1e-15);
  const state = calls.find(({ fn }) => fn === "getSlot0");
  assert.equal(state.address, sdkExports.StateViewAddress[mainnet.id]);
  assert.equal(state.args.poolId, getPoolId(key));
});

test("current imported PoolCreated receipts preserve the paired token and ignore other emitters", () => {
  const { sdk, key } = harness(ANY_HOOK, MILADY);
  const params = { memecoin: COIN, creator: CREATOR, creatorFeeAllocation: 10_000, initialPriceParams: "0x1234", feeCalculatorParams: "0x", pairedToken: MILADY };
  // Independent schema from flaunch-contracts v1.4.0 IAnyPositionManager.sol:29,72.
  const contractEventAbi = parseAbi([
    "event PoolCreated(bytes32 indexed _poolId, address _memecoin, address _memecoinTreasury, uint256 _tokenId, bool _currencyFlipped, (address memecoin, address creator, uint24 creatorFeeAllocation, bytes initialPriceParams, bytes feeCalculatorParams, address pairedToken) _params)",
  ]);
  const event = contractEventAbi[0];
  const log = {
    address: ANY_HOOK,
    topics: encodeEventTopics({ abi: contractEventAbi, eventName: "PoolCreated", args: { _poolId: getPoolId(key) } }),
    data: encodeAbiParameters(event.inputs.filter(({ indexed }) => !indexed), [COIN, TREASURY, 7n, false, params]),
  };
  assert.equal(sdk.getPoolCreatedFromLogs([{ ...log, address: CREATOR }]), null);
  const parsed = sdk.getPoolCreatedFromLogs([log]);
  assert.equal(parsed.memecoin.toLowerCase(), COIN);
  assert.equal(parsed.tokenId, 7n);
  assert.equal(parsed.params.pairedToken.toLowerCase(), MILADY);
  assert.equal(parsed.params.creator, CREATOR);
  assert.equal(parsed.params.name, "");
});

test("legacy flETH swap entry points refuse current Ethereum pools before any simulation or write", async () => {
  const { sdk, calls } = harness();
  for (const operation of [
    () => sdk.getBuyQuoteExactInput({ coinAddress: COIN, amountIn: 100n }),
    () => sdk.getBuyQuoteExactOutput({ coinAddress: COIN, amountOut: 100n }),
    () => sdk.getSellQuoteExactInput({ coinAddress: COIN, amountIn: 100n }),
    () => sdk.buyCoin({ coinAddress: COIN, amountIn: 100n, swapType: "EXACT_IN", slippagePercent: 1 }),
    () => sdk.sellCoin({ coinAddress: COIN, amountIn: 100n, slippagePercent: 1 }),
  ]) {
    await assert.rejects(operation, /protected paired-token swap API/);
  }
  assert.ok(calls.every(({ fn }) => fn === "poolKey"));
});
