// Regenerates test/fixtures/launchGolden.json from the CURRENT dist build.
//
// Run this ONLY against a build whose launch calldata is known-good (the 0.13.0 release,
// commit 4b31a2c). test/launchByteIdentity.test.cjs then asserts later builds encode every
// existing launch entry point byte-for-byte identically. Never regenerate to "fix" a failing
// identity test without a deliberate, reviewed calldata change.
//
//
// Reviewed regenerations: the eight `multichain:1:*` cases were regenerated for 0.16.0 after
// 0.15.0 (#41) moved Ethereum launches to the v1.3 zap with native ETH as the default pairing;
// every other case is still byte-identical to the 0.13.0 build.
//
// The two `vested:84532:vestedDynamicSplitManager:*` cases were regenerated for 0.17.1: the
// vested dynamic split now deploys `DynamicAddressFeeSplitManagerV1_3Address`, the manager the
// AnyFlaunchZap's v1.3.1 factory approves, instead of the multichain zap's generation (which the
// zap would have handed the coin's ownership NFT to, raw). Only `_treasuryManagerParams.manager`
// changes in those two cases.
//
//   node test/fixtures/generateLaunchGolden.cjs
const { writeFileSync } = require("node:fs");
const path = require("node:path");
const { launchGoldenScenarios, runScenario } = require("./launchGoldenScenarios.cjs");

async function main() {
  const { execSync } = require("node:child_process");
  const commit = execSync("git rev-parse --short HEAD", { cwd: path.join(__dirname, "..", "..") })
    .toString()
    .trim();
  const cases = [];
  for (const scenario of launchGoldenScenarios) {
    cases.push({ id: scenario.id, ...(await runScenario(scenario)) });
  }
  const out = path.join(__dirname, "launchGolden.json");
  writeFileSync(
    out,
    JSON.stringify({ generatedFrom: commit, cases }, null, 2) + "\n"
  );
  console.log(`wrote ${cases.length} cases from ${commit} to ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
