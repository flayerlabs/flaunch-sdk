const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeAbiParameters, getAddress, zeroAddress } = require("viem");
const { base, baseSepolia, robinhood, mainnet } = require("viem/chains");
const {
  GAME_DEVELOPER_SHARE,
  GAME_DEVELOPER_SPLIT_SHARE_TOTAL,
  GameDeveloperFeeSplitManagerAbi,
  GameDeveloperFeeSplitManagerAddress,
  ReadGameDeveloperFeeSplitManager,
  ReadWriteGameDeveloperFeeSplitManager,
  doesChainSupportGameDeveloperSplit,
  doesChainSupportPairedTokenLaunch,
  encodeGameDeveloperSplitInitializeData,
  percentToGameDeveloperShare,
} = require("../dist/index.cjs.js");

const INITIALIZE_PARAMS = [
  {
    type: "tuple",
    components: [
      { type: "uint256", name: "creatorShare" },
      { type: "uint256", name: "ownerShare" },
      { type: "address", name: "moderator" },
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
  { type: "address" },
];

const dev = "0x000000000000000000000000000000000000dEaD";
const launcher = "0x1111111111111111111111111111111111111111";
const friend = "0x2222222222222222222222222222222222222222";

test("constants match the contract: 5% of a 100_00000 total", () => {
  assert.equal(GAME_DEVELOPER_SHARE, 5_00000n);
  assert.equal(GAME_DEVELOPER_SPLIT_SHARE_TOTAL, 100_00000n);
  assert.equal(percentToGameDeveloperShare(95), 95_00000n);
  assert.throws(() => percentToGameDeveloperShare(12.5));
});

test("initializeData is the parent tuple plus the developer, with the 5% row prepended", () => {
  const data = encodeGameDeveloperSplitInitializeData({
    gameDeveloper: dev,
    moderator: launcher,
    splitReceivers: [
      { address: launcher, share: 60_00000n },
      { address: friend, share: 35_00000n },
    ],
  });
  const [params, gameDeveloper] = decodeAbiParameters(INITIALIZE_PARAMS, data);
  assert.equal(gameDeveloper, getAddress(dev));
  assert.equal(params.creatorShare, 0n);
  assert.equal(params.ownerShare, 0n);
  assert.equal(params.moderator, launcher);
  assert.deepEqual(params.recipientShares, [
    { recipient: getAddress(dev), share: 5_00000n },
    { recipient: launcher, share: 60_00000n },
    { recipient: friend, share: 35_00000n },
  ]);
});

test("moderator defaults to zero, and the encoding rejects what the contract would", () => {
  const data = encodeGameDeveloperSplitInitializeData({
    gameDeveloper: dev,
    splitReceivers: [{ address: launcher, share: 95_00000n }],
  });
  const [params] = decodeAbiParameters(INITIALIZE_PARAMS, data);
  assert.equal(params.moderator, zeroAddress);

  assert.throws(
    () => encodeGameDeveloperSplitInitializeData({ gameDeveloper: zeroAddress, splitReceivers: [] }),
    /zero address/
  );
  assert.throws(
    () =>
      encodeGameDeveloperSplitInitializeData({
        gameDeveloper: dev,
        splitReceivers: [{ address: launcher, share: 90_00000n }],
      }),
    /must total 10000000/
  );
  assert.throws(
    () =>
      encodeGameDeveloperSplitInitializeData({
        gameDeveloper: dev,
        splitReceivers: [
          { address: launcher, share: 90_00000n },
          { address: dev.toLowerCase(), share: 5_00000n },
        ],
      }),
    /already holds the fixed 5%/
  );
  assert.throws(
    () =>
      encodeGameDeveloperSplitInitializeData({
        gameDeveloper: dev,
        splitReceivers: [
          { address: launcher, share: 50_00000n },
          { address: launcher, share: 45_00000n },
        ],
      }),
    /Duplicate/
  );
});

test("chain support follows the address map and the paired-token zap", () => {
  for (const chain of [mainnet, base, baseSepolia, robinhood]) {
    const supported = doesChainSupportGameDeveloperSplit(chain.id);
    assert.equal(
      supported,
      GameDeveloperFeeSplitManagerAddress[chain.id] !== undefined &&
        doesChainSupportPairedTokenLaunch(chain.id)
    );
  }
});

test("clients expose the developer surface on top of the v1.3.1 dynamic split client", () => {
  const abiNames = new Set(GameDeveloperFeeSplitManagerAbi.map((e) => e.name));
  for (const fn of [
    "gameDeveloper",
    "gameDeveloperPayout",
    "originalCreator",
    "setGameDeveloperPayout",
    "transferGameDeveloper",
    "withdrawToCreator",
    "updateRecipients",
    "claim",
  ]) {
    assert.ok(abiNames.has(fn), `${fn} in ABI`);
  }
  for (const m of ["gameDeveloper", "gameDeveloperPayout", "originalCreator", "totalActiveShares", "balances"]) {
    assert.equal(typeof ReadGameDeveloperFeeSplitManager.prototype[m], "function", m);
  }
  for (const m of ["setGameDeveloperPayout", "transferGameDeveloper", "withdrawToCreator", "updateRecipients", "claim"]) {
    assert.equal(typeof ReadWriteGameDeveloperFeeSplitManager.prototype[m], "function", m);
  }
});
