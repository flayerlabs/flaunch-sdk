// Read-only deployment gate. No signer, broadcast, or approval transaction is used.
import assert from 'node:assert/strict';
import { createPublicClient, http, parseAbi, keccak256, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';
import { PoolSwapForHookV1_3Address, PoolManagerAddress } from '../dist/addresses/index.mjs';

const client = createPublicClient({ chain: baseSepolia, transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org', { timeout: 15000, retryCount: 1 }) });
assert.equal(await client.getChainId(), 84532, 'Refusing a non-Sepolia RPC');
const blockNumber = await client.getBlockNumber();
const abi = parseAbi([
  'function exactInputVersion() view returns (uint256)', 'function manager() view returns (address)',
  'function owner() view returns (address)', 'function approvedRouters(address) view returns (bool)',
  'function feeCalculator() view returns (address)', 'function registeredCalculators(address) view returns (bool)',
  'function setApprovedRouter(address,bool)',
]);
const gates = {
  '0x5558e7271ec2e8b2faaf05f0eedab1cd986be5dc': '0x2c9127654ded3b6b2ba017e84f44b02cafdf9f55',
  '0x28118f40eca9b884beb42b0196409a73269525dc': '0x2c9127654ded3b6b2ba017e84f44b02cafdf9f55',
  '0x8d346f24278c5cd786309161aac0fc2bbe4c25dc': '0x54cdcf0bcbc3a33f470e07134c10582f93058a32',
};
const read = (address, functionName, args = []) => client.readContract({ address, abi, functionName, args, blockNumber });
const results = [];
for (const [hook, mappedRouter] of Object.entries(PoolSwapForHookV1_3Address[84532])) {
  const router = process.env.PROTECTED_ROUTER || mappedRouter;
  const gate = gates[hook];
  const result = { hook, router, gate, failures: [] };
  try {
    assert.ok(gate, 'No reviewed gate mapping for hook');
    const [code, manager, owner, approved, dispatcher] = await Promise.all([
      client.getCode({ address: router, blockNumber }), read(router, 'manager'), read(gate, 'owner'),
      read(gate, 'approvedRouters', [router]), read(hook, 'feeCalculator'),
    ]);
    result.owner = owner; result.approved = approved; result.dispatcher = dispatcher;
    result.runtimeHash = code && code !== '0x' ? keccak256(code) : null;
    if (manager.toLowerCase() !== PoolManagerAddress[84532].toLowerCase()) result.failures.push('Wrong PoolManager');
    if (!approved) result.failures.push('Router not approved by this gate');
    if (!await read(dispatcher, 'registeredCalculators', [gate])) result.failures.push('Gate not registered by hook dispatcher');
    try { if (await read(router, 'exactInputVersion') !== 1n) result.failures.push('Unsupported protected API'); }
    catch { result.failures.push('Missing exactInputVersion capability'); }
    if (!process.env.PROTECTED_ROUTER_CODEHASH || result.runtimeHash?.toLowerCase() !== process.env.PROTECTED_ROUTER_CODEHASH.toLowerCase()) result.failures.push('Runtime hash not matched to reviewed deployment evidence');
    result.approvalTransaction = { chainId: 84532, to: gate, value: '0', data: encodeFunctionData({ abi, functionName: 'setApprovedRouter', args: [router, true] }) };
  } catch {
    result.failures.push('Required onchain read failed; readiness is unproven');
  }
  results.push(result);
}
console.log(JSON.stringify({ chainId: 84532, blockNumber: blockNumber.toString(), results }, null, 2));
if (results.some((result) => result.failures.length)) process.exitCode = 1;
