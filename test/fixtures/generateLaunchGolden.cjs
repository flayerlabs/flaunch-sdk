// Regenerates test/fixtures/launchGolden.json from the CURRENT dist build.
//
// Run this ONLY against a build whose launch calldata is known-good (the 0.13.0 release,
// commit 4b31a2c). test/launchByteIdentity.test.cjs then asserts later builds encode every
// existing launch entry point byte-for-byte identically. Never regenerate to "fix" a failing
// identity test without a deliberate, reviewed calldata change.
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
