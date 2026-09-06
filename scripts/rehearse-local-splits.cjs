const assert = require('node:assert/strict')
assert.equal(process.env.RELEASE_LOCAL_FORK, '1', 'Explicit local-fork opt-in required')
const { writeFileSync } = require('node:fs')
const sdk = require('@flaunch/sdk')
const { createPublicClient, http, toHex, erc20Abi, decodeFunctionData, decodeAbiParameters } = require('viem')
const { base } = require('viem/chains')
const results = []
const local = 'http://127.0.0.1:18545'
async function rpc(method, params = []) {
  const body = await (await fetch(local, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json()
  if (body.error) throw Error(JSON.stringify(body.error))
  return body.result
}
async function main() {
  assert.equal(await rpc('eth_chainId'), '0x7a69')
  const [account, recipient] = await rpc('eth_accounts')
  const publicClient = createPublicClient({ chain: base, transport: http(local) })
  const calldata = sdk.createFlaunchCalldata({ publicClient, walletAddress: account })
  const read = sdk.createFlaunch({ publicClient })
  for (const creatorSplitPercent of [60, 0]) {
    try {
      const call = sdk.decodeCallData(await calldata.flaunchWithSplitManager({ name: 'Rehearsal legacy split', symbol: 'SPLIT', tokenUri: 'ipfs://local-rehearsal-no-upload', fairLaunchPercent: 0, fairLaunchDuration: 0, initialMarketCapUSD: 4000, creator: account, creatorFeeAllocationPercent: 100, creatorSplitPercent, managerOwnerSplitPercent: 0, splitReceivers: [{ address: recipient, percent: 100 }] }))
      const decoded = decodeFunctionData({ abi: sdk.FlaunchZapV1_1_6Abi, data: call.data })
      const manager = decoded.args.find(a => a && typeof a === 'object' && 'initializeData' in a)
      assert(manager, 'Must retain split manager overload')
      const [split] = decodeAbiParameters([{ type: 'tuple', components: [{ name: 'creatorShare', type: 'uint256' }, { name: 'ownerShare', type: 'uint256' }, { name: 'recipientShares', type: 'tuple[]', components: [{ name: 'recipient', type: 'address' }, { name: 'share', type: 'uint256' }] }] }], manager.initializeData)
      assert.equal(split.creatorShare, BigInt(creatorSplitPercent) * 100000n)
      assert.equal(split.ownerShare, 0n)
      assert.equal(split.recipientShares[0].share, 10000000n)
      assert.equal(await rpc('eth_chainId'), '0x7a69')
      const hash = await rpc('eth_sendTransaction', [{ from: account, to: call.to, data: call.data, value: toHex(call.value || 0n), gas: toHex(15000000n) }])
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      assert.equal(receipt.status, 'success')
      const created = read.getPoolCreatedFromLogs(receipt.logs)
      assert(created)
      const supply = await publicClient.readContract({ address: created.memecoin, abi: erc20Abi, functionName: 'totalSupply' })
      assert.equal(supply, 100000000000n * 10n ** 18n)
      results.push({ creatorSplitPercent, result: 'PASS', hash, coin: created.memecoin, recipient, managerTemplate: manager.manager })
    } catch (e) { results.push({ creatorSplitPercent, result: 'FAIL', error: e.shortMessage || e.message }) }
  }
  console.log(JSON.stringify(results, null, 2))
  writeFileSync(process.env.RELEASE_FORK_RESULTS || '.release-legacy-split-results.json', JSON.stringify(results, null, 2))
  if (results.some(r => r.result === 'FAIL')) process.exitCode = 1
}
main().catch(e => { console.error(e); process.exitCode = 1 })
