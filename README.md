# Flaunch SDK

[![npm version](https://img.shields.io/npm/v/@flaunch/sdk.svg)](https://npmjs.com/package/@flaunch/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeScript functions for launching, trading, claiming and staking on Flaunch V3. The SDK depends only on [viem](https://viem.sh).

Each write builder returns `{ address, abi, functionName, args, value? }`, which you can pass straight to viem's `simulateContract`, `writeContract` or `encodeFunctionData`. Reads and multi-step flows take viem clients.

```bash
pnpm add @flaunch/sdk@next viem
```

## Networks

| Chain | ID | Status |
| --- | --- | --- |
| Base Sepolia | 84532 | Deployed |

`deployment(chainId)` returns every contract address. The full ABIs are exported too, for example `FlaunchAbi`. The package is ESM only.

## Launch

A launch splits the supply across pairs and sends swap fees to recipients. Both splits are in basis points and must each total 10,000. The base fee runs from 100 to 1,000 bp. Every pool starts at the price that makes the whole supply worth `startingMarketCapEth`. An ERC20 pair also needs its `decimals` and its value in ETH (`ethPerToken`).

### Gasless

The service wallet signs `AtomicLaunchZap.launch`, which creates the recipients inside the launch and sends the launch NFT to `owner`.

```ts
import { buildGaslessLaunch, parseLaunch, deployment, FlaunchAbi } from "@flaunch/sdk";
import { zeroAddress } from "viem";

const nonce = await publicClient.readContract({
  address: deployment(84532).flaunch,
  abi: FlaunchAbi,
  functionName: "tokenNonce",
});
const call = buildGaslessLaunch({
  chainId: 84532,
  name: "My Coin",
  symbol: "MINE",
  contractURI: "ipfs://<metadata cid>",
  baseFeeBps: 100,
  startingMarketCapEth: "4",
  pairs: [
    { token: zeroAddress, allocationBps: 5_000 },
    { token: usdc, allocationBps: 5_000, decimals: 6, ethPerToken: "0.0004" },
  ],
  recipients: [
    { kind: "ADDRESS", address: creator, percentage: 7_500 },
    { kind: "STAKING", percentage: 2_500 },
  ],
  owner: creator,
  nonce,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 900),
});
const hash = await walletClient.writeContract(call);
const { token, tokenId } = parseLaunch(await publicClient.waitForTransactionReceipt({ hash }), 84532);
```

`nonce` sets where an ERC20 pool's price sits. If another launch lands first, the launch reverts; read the nonce again and rebuild the call.

### Dev buy

The creator signs `LaunchZap.launch` and buys with ETH in the same transaction. A dev buy needs ETH-only pairs. Its recipients must already exist as clones, so Stakers cannot be one of them.

```ts
import { buildDevBuyLaunch, quoteDevBuy, findRecipient } from "@flaunch/sdk";

const recipient = await findRecipient(publicClient, 84532, { kind: "ADDRESS", address: creator });
// When recipient is null, create the clone first (buildCreateRecipient, or the web2 API's recipients route)
const input = {
  chainId: 84532,
  name: "My Coin",
  symbol: "MINE",
  contractURI: "ipfs://<metadata cid>",
  baseFeeBps: 100,
  startingMarketCapEth: "4",
  pairs: [{ token: zeroAddress, allocationBps: 10_000 }],
  recipients: [{ recipient, percentage: 10_000 }],
  owner: creator,
  devBuy: { amount: parseEther("0.1"), minOutput: 0n },
  deadline,
};
const expected = await quoteDevBuy(publicClient, input, creator);
await walletClient.writeContract(buildDevBuyLaunch({ ...input, devBuy: { ...input.devBuy, minOutput: (expected * 99n) / 100n } }));
```

### Recipients

- `recipientConfig(spec)` encodes an `ADDRESS`, `BUY_AND_BURN` or `STAKING` recipient.
- `findRecipient(client, chainId, recipient)` returns an existing `ADDRESS` or `BUY_AND_BURN` clone, or `null`. It takes the strategy without a percentage.
- `buildCreateRecipient(chainId, recipient)` creates one.
- `parseRecipients(receipt, chainId)` lists the clones that a transaction created or reused.

Recipient addresses are always looked up or read from receipts, never predicted.

## Swap

The currency you pay with picks the pool. ERC20 input goes through Permit2, so approve Permit2 on the token once, then sign a permit for the router.

```ts
import { quoteSwap, buildSwap, readPermit2Allowance, permitTypedData } from "@flaunch/sdk";

// Buy with ETH
const amountOut = await quoteSwap(publicClient, { chainId: 84532, tokenIn: zeroAddress, tokenOut: coin, amountIn, account });
await walletClient.writeContract(
  buildSwap({ chainId: 84532, tokenIn: zeroAddress, tokenOut: coin, amountIn, amountOutMinimum: (amountOut * 99n) / 100n, account, deadline }),
);

// Sell for ETH through Permit2
const { nonce } = await readPermit2Allowance(publicClient, 84532, account, coin);
const typedData = permitTypedData(84532, { token: coin, amount: amountIn, expiration: Number(deadline), nonce }, deadline);
const signature = await walletClient.signTypedData(typedData);
await walletClient.writeContract(
  buildSwap({ chainId: 84532, tokenIn: coin, tokenOut: zeroAddress, amountIn, amountOutMinimum, account, deadline, permit: { permit: typedData.message, signature } }),
);
```

`hookData`, when given, is passed to the Flaunch hook untouched. Pass the swapper as `account` to `quoteSwap` so the quote runs with the same sender as the swap; a fee calculator that checks the buyer in `hookData` rejects a quote without it.

## Fees and staking

- `buildDistribute(chainId, tokenId)` pushes a coin's accrued fees to its recipients. Anyone may call it.
- `buildBurnRoyaltyPermission(chainId, tokenId)` lets the launch NFT owner lock the fee route for good.
- `claimFees({ publicClient, walletClient }, chainId, beneficiary, currencies)` claims escrowed fees in one `claimBatch`. If the batch would revert, it claims each currency that has credit separately and returns the ones that revert in `failed`. A rejected wallet prompt or an RPC error throws.
- `buildStake(staking, amount)` and `buildWithdraw(staking, amount)` stake and unstake the coin. Approve the staking recipient on the coin before you stake.
- `claimStakingRewards(clients, staking, beneficiary, currencies)` moves staking rewards into the escrow and repeats while rewards have more intervals to process. Claim them afterwards with `claimFees`.

## Uploads

```ts
import { uploadImage, uploadMetadata } from "@flaunch/sdk";

const imageCid = await uploadImage(web2ApiUrl, file);
const metadataCid = await uploadMetadata(web2ApiUrl, { name: "My Coin", image: `ipfs://${imageCid}` });
// contractURI: `ipfs://${metadataCid}`
```

## Development

```bash
pnpm install
pnpm test           # builds, then runs test/*.test.ts against dist
pnpm test:package   # packs the tarball and type-checks a consumer against it
RPC_URL=https://sepolia.base.org pnpm smoke   # quotes and simulates a buy and a Permit2 sell of a Base Sepolia coin
```

With `PRIVATE_KEY` set, `pnpm smoke` sends the buy and the sell from that wallet and checks the receipts. It needs an RPC that serves `eth_simulateV1`.

To regenerate the ABIs after a contract change, build `flaunch-v3-protocol` next to this repo and run the generator:

```bash
(cd ../flaunch-v3-protocol && git submodule update --init --recursive && forge build)
pnpm generate:abis
```

## Releasing

The `Release` workflow publishes with the `NPM_TOKEN` secret:

- Every push to `master` publishes `<version>-next.<run>` on the `next` tag.
- A `v*` tag that matches `package.json` publishes that version on `latest`. Run `pnpm version <version>` and then `git push --follow-tags`. The version must not be a prerelease.
- After a release, bump `package.json` to the next version, for example `pnpm version patch --no-git-tag-version`. Otherwise every later `next` build publishes a prerelease of the released version, which sorts below `latest`.

## License

MIT
