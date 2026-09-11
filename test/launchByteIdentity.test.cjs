// Every existing launch entry point must keep encoding byte-identical calldata, fee quotes and
// value. The fixtures were generated from the 0.13.0 release build (see
// test/fixtures/generateLaunchGolden.cjs); a diff here is a behaviour change for live integrators.
const test = require("node:test");
const assert = require("node:assert/strict");
const golden = require("./fixtures/launchGolden.json");
const {
  launchGoldenScenarios,
  runScenario,
} = require("./fixtures/launchGoldenScenarios.cjs");

test("golden fixtures cover every scenario", () => {
  assert.deepEqual(
    golden.cases.map(({ id }) => id),
    launchGoldenScenarios.map(({ id }) => id)
  );
});

test("existing launch entry points encode byte-identical calldata, fee calls and value", async (t) => {
  for (const scenario of launchGoldenScenarios) {
    await t.test(scenario.id, async () => {
      const expected = golden.cases.find(({ id }) => id === scenario.id);
      const actual = await runScenario(scenario);
      assert.deepEqual(actual.ethCalls, expected.ethCalls, "fee quote eth_calls");
      assert.equal(actual.to, expected.to, "target");
      assert.equal(actual.value, expected.value, "value");
      assert.equal(actual.data, expected.data, "calldata");
    });
  }
});
