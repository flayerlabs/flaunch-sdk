import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createPublicClient, createWalletClient, http, keccak256, parseAbi, pad } from 'viem';
import { baseSepolia } from 'viem/chains';

// Deliberately accepts only the disposable fork endpoint, never an external RPC.
const rpc = 'http://127.0.0.1:18547';
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
assert.equal(await publicClient.getChainId(), 84532);
assert.match(await publicClient.request({ method: 'web3_clientVersion' }), /anvil/i);
const [deployer] = await publicClient.request({ method: 'eth_accounts' });
const wallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: http(rpc) });
const artifact = JSON.parse(readFileSync(process.env.PROTECTED_ROUTER_ARTIFACT, 'utf8'));
const manager = '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408';
const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: [manager] });
const receipt = await publicClient.waitForTransactionReceipt({ hash });
assert.equal(receipt.status, 'success');
const router = receipt.contractAddress;
assert.ok(router);

// PoolSwap has exactly one immutable: its constructor-bound PoolManager.
const template = Buffer.from(artifact.deployedBytecode.object.slice(2), 'hex');
const references = Object.values(artifact.deployedBytecode.immutableReferences);
assert.equal(references.length, 1);
for (const { start, length } of references[0]) {
  assert.equal(length, 32);
  Buffer.from(pad(manager, { size: 32 }).slice(2), 'hex').copy(template, start);
}
const expectedCode = `0x${template.toString('hex')}`;
assert.equal((await publicClient.getCode({ address: router })).toLowerCase(), expectedCode.toLowerCase());
const owner = '0xB8A70b4d1547bf6193bd67A73F4F98ea9FD0A973';
const gates = ['0x2c9127654ded3b6b2ba017e84f44b02cafdf9f55', '0x54cdcf0bcbc3a33f470e07134c10582f93058a32'];
const abi = parseAbi(['function owner() view returns (address)', 'function setApprovedRouter(address,bool)']);
await publicClient.request({ method: 'anvil_impersonateAccount', params: [owner] });
try {
  await publicClient.request({ method: 'anvil_setBalance', params: [owner, '0xDE0B6B3A7640000'] });
  for (const gate of gates) {
    assert.equal((await publicClient.readContract({ address: gate, abi, functionName: 'owner' })).toLowerCase(), owner.toLowerCase());
    const tx = await wallet.writeContract({ account: owner, address: gate, abi, functionName: 'setApprovedRouter', args: [router, true] });
    assert.equal((await publicClient.waitForTransactionReceipt({ hash: tx })).status, 'success');
  }
} finally {
  await publicClient.request({ method: 'anvil_stopImpersonatingAccount', params: [owner] });
}
const check = spawnSync(process.execPath, ['scripts/check-protected-sepolia.mjs'], {
  encoding: 'utf8', env: { ...process.env, BASE_SEPOLIA_RPC_URL: rpc, PROTECTED_ROUTER: router, PROTECTED_ROUTER_CODEHASH: keccak256(expectedCode) },
});
assert.equal(check.status, 0, check.stdout + check.stderr);
console.log(JSON.stringify({ localForkOnly: true, chainId: 84532, router, runtimeHash: keccak256(expectedCode), gatesApproved: gates, readiness: 'passed' }, null, 2));
