const test = require("node:test");
const assert = require("node:assert/strict");
const { robinhood } = require("viem/chains");
const {
  FlaunchPositionManagerMultichainAddress,
  FlaunchVersion,
  PairedTokenPositionManagerV1_3Address,
  ReadFlaunchSDK,
  SupersededPositionManagerV1_3Address,
} = require("../dist/index.cjs.js");

// FLA2-397: on a multichain deployment every quote and swap used the chain's v1.2 multichain
// hook, so v1.3.x coins reverted at the quoter. The SDK must resolve the hook per coin.

const V133_HOOK = PairedTokenPositionManagerV1_3Address[robinhood.id];
const SUPERSEDED_HOOK = SupersededPositionManagerV1_3Address[robinhood.id][0];
const V12_HOOK = FlaunchPositionManagerMultichainAddress[robinhood.id];

const V133_COIN = "0x411bE1f78cfEcDBdA70D57642895C1dD64bA3986"; // V133C
const OLD_COIN = "0xfc5633E8CAf9Ec6C6f2a483F2013b57A741bA6C5"; // RHCANARY (2026-08-21 hooks)
const V12_COIN = "0x7FB6e53a849FCC363dF7b7AF46111B42BD225F42";
const UNKNOWN_COIN = "0x9999999999999999999999999999999999999999";
const SENDER = "0x1111111111111111111111111111111111111111";

const lower = (a) => a.toLowerCase();

/** A drift stub whose position managers each know exactly the coins in `poolsByHook`. */
function makeDrift(poolsByHook) {
  const simulations = [];
  const reads = [];
  const drift = {
    contract({ address }) {
      return {
        address,
        cache: { clear: async () => {} },
        async read(fn, args) {
          reads.push({ address, fn, args });
          if (fn === "poolKey") {
            const coins = poolsByHook[lower(address)] ?? [];
            const known = coins.some((c) => lower(c) === lower(args._token));
            return {
              currency0: "0x0000000000000000000000000000000000000000",
              currency1: args._token,
              fee: 0,
              tickSpacing: known ? 60 : 0,
              hooks: address,
            };
          }
          throw new Error(`unexpected read ${fn} on ${address}`);
        },
        async simulateWrite(fn, args, options) {
          simulations.push({ address, fn, args, options });
          return { amountOut: 123n };
        },
      };
    },
  };
  return { drift, simulations, reads };
}

const pools = {
  [lower(V133_HOOK)]: [V133_COIN],
  [lower(SUPERSEDED_HOOK)]: [OLD_COIN],
  [lower(V12_HOOK)]: [V12_COIN],
};

test("resolves the current v1.3 hook for a v1.3.3 coin on Robinhood", async () => {
  const { drift } = makeDrift(pools);
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);
  assert.equal(lower(await sdk.getPositionManagerAddressForCoin(V133_COIN)), lower(V133_HOOK));
  assert.equal(await sdk.getCoinVersion(V133_COIN), FlaunchVersion.V1_3);
  assert.equal(await sdk.isValidCoin(V133_COIN), true);
});

test("resolves a superseded v1.3 hook for a coin still living on it", async () => {
  const { drift } = makeDrift(pools);
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);
  assert.equal(lower(await sdk.getPositionManagerAddressForCoin(OLD_COIN)), lower(SUPERSEDED_HOOK));
  assert.equal(await sdk.getCoinVersion(OLD_COIN), FlaunchVersion.V1_3);
});

test("falls back to the multichain (v1.2) hook for a v1.2 coin and for an unknown coin", async () => {
  const { drift } = makeDrift(pools);
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);
  assert.equal(lower(await sdk.getPositionManagerAddressForCoin(V12_COIN)), lower(V12_HOOK));
  assert.equal(await sdk.getCoinVersion(V12_COIN), FlaunchVersion.V1_2);
  assert.equal(lower(await sdk.getPositionManagerAddressForCoin(UNKNOWN_COIN)), lower(V12_HOOK));
  assert.equal(await sdk.isValidCoin(UNKNOWN_COIN), false);
  await assert.rejects(() => sdk.getCoinVersion(UNKNOWN_COIN), /Unknown coin version/);
});

test("buy quotes route through the coin's own hook and cache the probe", async () => {
  const { drift, simulations, reads } = makeDrift(pools);
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);

  await sdk.getBuyQuoteExactInput({ coinAddress: V133_COIN, amountIn: 10n ** 15n, userWallet: SENDER });
  await sdk.getBuyQuoteExactInput({ coinAddress: OLD_COIN, amountIn: 10n ** 15n, userWallet: SENDER });
  await sdk.getBuyQuoteExactInput({ coinAddress: V133_COIN, amountIn: 2n * 10n ** 15n, userWallet: SENDER });

  assert.equal(simulations.length, 3);
  const hooksIn = (sim) =>
    JSON.stringify(sim.args, (_k, v) => (typeof v === "bigint" ? v.toString() : v)).toLowerCase();
  assert.ok(hooksIn(simulations[0]).includes(lower(V133_HOOK)));
  assert.ok(!hooksIn(simulations[0]).includes(lower(V12_HOOK)));
  assert.ok(hooksIn(simulations[1]).includes(lower(SUPERSEDED_HOOK)));
  assert.ok(hooksIn(simulations[2]).includes(lower(V133_HOOK)));

  // The second V133C quote must not probe again: one poolKey read per hook tried, once per coin.
  const poolKeyReadsForV133 = reads.filter(
    (r) => r.fn === "poolKey" && lower(r.args._token) === lower(V133_COIN)
  );
  assert.equal(poolKeyReadsForV133.length, 1);
});

test("poolId differs per hook generation for the same paired token", async () => {
  const { drift } = makeDrift(pools);
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);
  const a = await sdk.poolId(V133_COIN);
  const b = await sdk.poolId(V12_COIN);
  assert.notEqual(a, b);
});

test("an explicit non-v1.3 version short-circuits to the multichain hook without probing", async () => {
  const { drift, reads } = makeDrift(pools);
  const sdk = new ReadFlaunchSDK(robinhood.id, drift);
  assert.equal(
    lower(await sdk.getPositionManagerAddressForCoin(V133_COIN, FlaunchVersion.V1_2)),
    lower(V12_HOOK)
  );
  assert.equal(reads.length, 0);
});
