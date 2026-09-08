import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

// Builds are explicit: this check never publishes and installs with lifecycle scripts disabled.
const root = process.cwd();
const fixture = mkdtempSync(join(tmpdir(), "flaunch-package-consumer-"));
function run(command, args, cwd = fixture) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 180_000,
  });
}
const [pack] = JSON.parse(
  run(
    "npm",
    ["pack", "--ignore-scripts", "--pack-destination", fixture, "--json"],
    root,
  ),
);
assert(
  pack.files.every(({ path }) =>
    /^(dist\/|package\.json$|README(?:\.md)?$|LICENSE(?:\.md)?$)/i.test(path),
  ),
  "Unexpected published file",
);
for (const { path } of pack.files.filter(({ path }) =>
  path.startsWith("dist/"),
)) {
  const content = readFileSync(resolve(root, path), "utf8");
  assert(
    !/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content),
    `Private key in ${path}`,
  );
}
writeFileSync(
  join(fixture, "package.json"),
  JSON.stringify({
    name: "flaunch-package-consumer",
    private: true,
    type: "module",
    dependencies: {
      "@flaunch/sdk": `file:${join(fixture, pack.filename)}`,
      viem: "2.55.2",
      typescript: "5.9.3",
      "@types/react": "^19.0.10",
    },
    pnpm: { overrides: { viem: "2.55.2" } },
  }),
);
run("pnpm", ["install", "--ignore-scripts"]);
const entries = [
  "@flaunch/sdk",
  ...["abi", "addresses", "helpers", "hooks", "utils"].map(
    (p) => `@flaunch/sdk/${p}`,
  ),
];
for (const entry of entries) {
  run("node", [
    "--input-type=module",
    "-e",
    `import * as m from ${JSON.stringify(entry)}; if (!Object.keys(m).length) throw Error('Empty exports')`,
  ]);
  run("node", [
    "--input-type=commonjs",
    "-e",
    `const m=require(${JSON.stringify(entry)}); if (!Object.keys(m).length) throw Error('Empty exports')`,
  ]);
}
writeFileSync(
  join(fixture, "consumer.ts"),
  `
import { createFlaunch, createFlaunchCalldata } from '@flaunch/sdk';
import { createPublicClient, http, type Chain } from 'viem';
import { base } from 'viem/chains';
${entries
  .slice(1)
  .map((entry, i) => `import * as sub${i} from '${entry}'; void sub${i};`)
  .join("\n")}
// The API accepts the generic viem Chain client, not Base's narrower deposit-transaction client.
const publicClient = createPublicClient({ chain: base as Chain, transport: http('http://127.0.0.1:18545') });
createFlaunch({ publicClient });
createFlaunchCalldata({ publicClient, walletAddress: '0x0000000000000000000000000000000000000001' });
import {
  encodeSpendReferralHookData, decodeSpendReferralHookData, resolveReferralHookData,
  decodeReferralEvents, type ReferralTokenBalance, type ReferralConfig,
} from '@flaunch/sdk';
const user = '0x1111111111111111111111111111111111111111' as const;
const escrow = '0x2222222222222222222222222222222222222222' as const;
const poolId = '0x' + '00'.repeat(32) as \`0x\${string}\`;
const payload = encodeSpendReferralHookData({ buyer: user, poolId, deadline: 1n, maxSpendWei: 1n, nonce: 0n, signature: '0x' }, user);
decodeSpendReferralHookData(resolveReferralHookData({ referrer: user, hookData: payload }));
decodeReferralEvents([], { chainId: base.id, hooks: [], escrows: [escrow] });
const reader = createFlaunch({ publicClient });
const balances: Promise<ReferralTokenBalance[]> = reader.referralBalances({ recipient: user, balances: [{ escrow, token: user }] });
const config: Promise<ReferralConfig> = reader.getReferralConfig({ poolKey: { currency0: user, currency1: escrow, fee: 0, tickSpacing: 60, hooks: user } });
const writer = createFlaunchCalldata({ publicClient, walletAddress: user });
writer.claimReferralBalance([user], user, { escrow, unwrap: false });
void balances; void config;

`,
);
for (const mode of ["NodeNext", "Bundler"]) {
  run("pnpm", [
    "exec",
    "tsc",
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--target",
    "ES2022",
    "--module",
    mode === "NodeNext" ? "NodeNext" : "ESNext",
    "--moduleResolution",
    mode,
    "consumer.ts",
  ]);
}
console.log(
  JSON.stringify(
    {
      version: pack.version,
      integrity: pack.integrity,
      entries: entries.length,
      fixture,
    },
    null,
    2,
  ),
);
