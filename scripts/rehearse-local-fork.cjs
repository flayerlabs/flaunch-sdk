const assert = require('node:assert/strict')
assert.equal(process.env.RELEASE_LOCAL_FORK, '1', 'Explicit local-fork opt-in required')
const { writeFileSync } = require('node:fs')
const sdk = require('@flaunch/sdk')
const { createPublicClient, http, parseEther, toHex, erc20Abi, encodeAbiParameters, encodeFunctionData, parseAbi, zeroAddress } = require('viem')
const { base } = require('viem/chains')
const LOCAL = 'http://127.0.0.1:18545'
const results = []
async function rpc(method, params = []) {
  assert.equal(new URL(LOCAL).hostname, '127.0.0.1')
  const response = await fetch(LOCAL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(30000) })
  const body = await response.json()
  if (body.error) throw Error(JSON.stringify(body.error))
  return body.result
}
async function main() {
  assert.equal(await rpc('eth_chainId'), '0x7a69', 'Only the isolated fork may receive writes')
  const [account] = await rpc('eth_accounts')
  const publicClient = createPublicClient({ chain: base, transport: http(LOCAL, { timeout: 30000, retryCount: 0 }) })
  const calldata = sdk.createFlaunchCalldata({ publicClient, walletAddress: account })
  const read = sdk.createFlaunch({ publicClient })
  async function send(call) {
    assert.equal(await rpc('eth_chainId'), '0x7a69')
    const hash = await rpc('eth_sendTransaction', [{ from: account, to: call.to, data: call.data, value: toHex(call.value || 0n), gas: toHex(15000000n) }])
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    assert.equal(receipt.status, 'success', `Local transaction reverted: ${hash}`)
    return receipt
  }
  for (const pairing of [zeroAddress, sdk.FLETHAddress[base.id]]) {
    try {
      const flaunchParams = { name: 'Local rehearsal', symbol: 'REHEARSE', tokenUri: 'ipfs://local-rehearsal-no-upload', premineAmount: 0n, creator: account, creatorFeeAllocation: 10000, flaunchAt: 0n, initialPriceParams: encodeAbiParameters([{ type: 'uint256' }], [4000000000n]), feeCalculatorParams: '0x', pairedToken: pairing }
      const zap = new sdk.ReadFlaunchZapV1_3(sdk.FlaunchZapV1_3Address[base.id], sdk.createDrift({ publicClient }))
      const fee = await zap.calculateFee({ flaunchParams, slippageBps: 50n })
      const launch = sdk.decodeCallData(await calldata.flaunchPairedToken({ flaunchParams, trustedFeeSigner: zeroAddress, maxPremineCost: 0n, value: fee.ethRequired }))
      const receipt = await send(launch)
      const created = read.getPoolCreatedFromLogs(receipt.logs)
      assert(created, 'SDK must decode the actual launch event')
      const coinAddress = created.memecoin
      assert(coinAddress, 'Decoded launch must name a coin')
      const supply = await publicClient.readContract({ address: coinAddress, abi: erc20Abi, functionName: 'totalSupply' })
      assert.equal(supply, 100000000000n * 10n ** 18n)
      results.push({ pairing, launch: 'PASS', coinAddress, supply: supply.toString(), hash: receipt.transactionHash })
      for (const direction of ['buy', 'sell']) {
        const amountIn = direction === 'buy' ? parseEther('0.00001') : await publicClient.readContract({ address: coinAddress, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
        if (pairing !== zeroAddress && direction === 'buy') {
          await send({ to: pairing, data: encodeFunctionData({ abi: parseAbi(['function deposit(uint256 wethAmount) payable']), functionName: 'deposit', args: [0n] }), value: amountIn })
        }
        const before = await publicClient.readContract({ address: coinAddress, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
        const plan = await read.planPairedTokenSwap({ coinAddress, pairedToken: pairing, direction, amountIn, slippageBps: 100, sender: account })
        for (const call of [plan.approve, plan.swap].filter(Boolean)) await send(call)
        const after = await publicClient.readContract({ address: coinAddress, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
        assert(direction === 'buy' ? after > before : after < before)
        results.push({ pairing, direction, result: 'PASS', before: before.toString(), after: after.toString(), requestedInput: amountIn.toString() })
      }
    } catch (e) { results.push({ pairing, result: 'FAIL', error: e.shortMessage || e.message }); }
  }
  console.log(JSON.stringify(results, null, 2))
  writeFileSync(process.env.RELEASE_FORK_RESULTS || '.release-fork-results.json', JSON.stringify(results, null, 2))
  if (results.some(r => r.result === 'FAIL')) process.exitCode = 1
}
main().catch(e => { console.error(e); process.exitCode = 1 })
