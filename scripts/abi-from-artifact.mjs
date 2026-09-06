#!/usr/bin/env node
// Writes a `src/abi/<Name>.ts` module (an `as const` ABI array) from a Foundry artifact's
// `abi` field, in the same shape as the hand-maintained ABI modules in this repo.
//
//   node scripts/abi-from-artifact.mjs <artifact.json> <ExportName> <out.ts> [-- header line ...]
//
// Example (v1.3.1 multi-asset managers, flaunch-managers release v1.3.1-base):
//   node scripts/abi-from-artifact.mjs ../flaunch-managers/out/RevenueManager.sol/RevenueManager.json \
//     RevenueManagerV1_3Abi src/abi/RevenueManagerV1_3.ts -- \
//     "Flaunch v1.3.1 multi-asset RevenueManager (flaunch-managers release v1.3.1-base)."
import { readFileSync, writeFileSync } from "node:fs";

const [artifactPath, exportName, outPath, ...rest] = process.argv.slice(2);
if (!artifactPath || !exportName || !outPath) {
  console.error(
    "usage: abi-from-artifact.mjs <artifact.json> <ExportName> <out.ts> [-- header line ...]"
  );
  process.exit(1);
}

const headerLines = rest[0] === "--" ? rest.slice(1) : rest;
const { abi } = JSON.parse(readFileSync(artifactPath, "utf8"));
if (!Array.isArray(abi)) {
  console.error(`${artifactPath} has no \`abi\` array`);
  process.exit(1);
}

// JSON with the object keys unquoted, matching e.g. src/abi/FeeEscrowV1_3.ts
const body = JSON.stringify(abi, null, 2).replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, "$1$2:");

const header = headerLines.map((line) => `// ${line}`).join("\n");
writeFileSync(outPath, `${header ? header + "\n" : ""}export const ${exportName} = ${body} as const;\n`);
console.log(`wrote ${outPath} (${abi.length} ABI entries)`);
