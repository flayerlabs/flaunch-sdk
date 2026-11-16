# Changelog

## [1.0.0] - Unreleased

A new major for Flaunch V3. It replaces the whole 0.x API, and nothing from 0.x carries over.

### Added

- **Launch.** `buildGaslessLaunch` builds an `AtomicLaunchZap.launch` that a service wallet can sign for the creator. `buildDevBuyLaunch` builds a `LaunchZap.launch` with an ETH dev buy and a `minOutput` guard. `quoteDevBuy` simulates the dev buy to set that guard. `parseLaunch` reads the token and launch NFT id from a receipt.
- **Starting prices** come from `startingMarketCapEth` and each pair's `ethPerToken`.
- **Recipients.** `recipientConfig` encodes `ADDRESS`, `BUY_AND_BURN` and `STAKING` recipients. `findRecipient` looks up an existing clone through `reusableRecipients`, `buildCreateRecipient` creates a missing one, and `parseRecipients` reads clone addresses from a receipt.
- **Swaps.** `quoteSwap` quotes through the Uniswap V4 quoter, as the swapper when given an `account`. `buildSwap` builds a Universal Router 2.1.2 `V4_SWAP` through the Flaunch hook, with `PERMIT2_PERMIT` for ERC20 input. `readPermit2Allowance` and `permitTypedData` prepare the permit, and `hookData` passes through untouched.
- **Fees.** `buildDistribute` and `buildBurnRoyaltyPermission` build the matching Flaunch calls. `claimFees` claims every escrow currency in one `claimBatch`. If the batch would revert, it claims each currency with credit separately and reports the ones that revert. Wallet rejections and RPC errors throw.
- **Staking.** `buildStake` and `buildWithdraw` build the staking calls. `claimStakingRewards` repeats `claimBatch` while rewards have more intervals to process, and throws if a claim reverts.
- **Uploads.** `uploadImage` and `uploadMetadata` post to the web2 API at a base URL you pass in.
- **Contracts.** Full ABIs generated from the protocol's Foundry artifacts (`pnpm generate:abis`), and `deployment(chainId)` for the Base Sepolia (84532) deployment. The package ships one ESM entry.
- **Releases.** Every merge to `master` publishes a `next` prerelease, and a `v*` tag publishes `latest`.

### Removed

- Every Flaunch 1.x client, ABI, address, helper and guide.
- The `@delvtech/drift`, `axios` and `react` dependencies, along with the `./helpers`, `./hooks` and `./utils` entry points, the CommonJS build and the UMD bundle.
