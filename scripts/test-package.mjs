import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
writeFileSync(
  join(fixture, "package.json"),
  JSON.stringify({
    name: "flaunch-package-consumer",
    private: true,
    type: "module",
    dependencies: {
      "@flaunch/sdk": `file:${join(fixture, pack.filename)}`,
      viem: "2.56.3",
      typescript: "5.9.3",
    },
  }),
);
run("pnpm", ["install", "--ignore-scripts"]);
run("node", [
  "--input-type=module",
  "-e",
  "import * as m from '@flaunch/sdk'; if (!Object.keys(m).length) throw Error('Empty exports')",
]);
writeFileSync(
  join(fixture, "consumer.ts"),
  `
import { buildSwap, claimFees, deployment, findRecipient, FlaunchAbi, quoteSwap } from '@flaunch/sdk';
import { createPublicClient, createWalletClient, http, zeroAddress } from 'viem';
import { baseSepolia } from 'viem/chains';
// Clients typed with an OP Stack chain's formatters must be accepted as they are
const chain = baseSepolia;
const publicClient = createPublicClient({ chain, transport: http('http://127.0.0.1:18545') });
const walletClient = createWalletClient({ chain, transport: http('http://127.0.0.1:18545'), account: '0x1111111111111111111111111111111111111111' });
const user = walletClient.account.address;
const swap = buildSwap({ chainId: chain.id, tokenIn: zeroAddress, tokenOut: user, amountIn: 1n, amountOutMinimum: 1n, account: user, deadline: 1n });
void walletClient.writeContract(swap);
void quoteSwap(publicClient, { chainId: chain.id, tokenIn: zeroAddress, tokenOut: user, amountIn: 1n });
void findRecipient(publicClient, chain.id, { kind: 'BUY_AND_BURN' });
void claimFees({ publicClient, walletClient }, chain.id, user, [zeroAddress]);
void publicClient.readContract({ address: deployment(chain.id).flaunch, abi: FlaunchAbi, functionName: 'tokenNonce' });
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
      fixture,
    },
    null,
    2,
  ),
);
