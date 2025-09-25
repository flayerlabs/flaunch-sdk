# Flaunch SDK

[![npm version](https://img.shields.io/npm/v/@flaunch/sdk.svg)](https://npmjs.com/package/@flaunch/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A TypeScript SDK for seamless interaction with the Flaunch protocol and Uniswap V4.

![Flaunch Header](https://raw.githubusercontent.com/flayerlabs/flaunch-sdk/refs/heads/master/.github/flaunch-header.png)

_Note: Add this `llms-full.txt` file into Cursor IDE / LLMs to provide context about using the Flaunch SDK: [llms-full.txt](https://raw.githubusercontent.com/flayerlabs/flaunch-sdk/refs/heads/master/llms-full.txt)_

## Features

- 🚀 Flaunch new memecoins
- 💱 Buy and sell memecoins via Uniswap V4 hooks
- 🏗️ Build your own token launchpads on top of the flaunch protocol
- 📊 Read functions for token and pool data
- 🔒 Built-in Permit2 support for gasless approvals
- 🔵 Works on Base and Base Sepolia networks

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Read Operations (with Viem)](#read-operations-with-viem)
  - [Write Operations (with Viem + Wagmi)](#write-operations-with-viem--wagmi)
  - [Flaunching a Memecoin](#flaunching-a-memecoin)
    - [How to generate `base64Image` from User uploaded file](#how-to-generate-base64image-from-user-uploaded-file)
  - [Flaunch with Address Fee Splits](#flaunch-with-address-fee-splits)
  - [Buying a Flaunch coin](#buying-a-flaunch-coin)
  - [Selling with Permit2](#selling-with-permit2)
  - [Swap using USDC or other tokens by passing `intermediatePoolKey`](#swap-using-usdc-or-other-tokens-by-passing-intermediatepoolkey)
  - [Advanced Integration: Revenue Sharing with RevenueManager](#advanced-integration-revenue-sharing-with-revenuemanager)
  - [Bot Protection during Fair Launch via TrustedSigner](#bot-protection-during-fair-launch-via-trustedsigner)
  - [Groups](#groups)
  - [Importing External Coins into Flaunch](#importing-external-coins-into-flaunch)
  - [Adding Liquidity to Imported (or flaunch) coins](#adding-liquidity-to-imported-or-flaunch-coins)
  - [Import AND Add Liquidity calls in a single batch](#import-and-add-liquidity-calls-in-a-single-batch)
  - [`createFlaunchCalldata`: alternative to `createFlaunch`](#createflaunchcalldata-alternative-to-createflaunch-that-returns-the-tx-call-object-with-to-data-and-value-instead-of-directly-broadcasting-the-tx-from-walletclient)
  - [All SDK functions](#all-sdk-functions)
  - [React Hooks](#react-hooks)
- [Flaunch Docs](#flaunch-reference)

## Installation

Using pnpm (recommended):

```bash
pnpm add @flaunch/sdk
```

Using npm:

```bash
npm install @flaunch/sdk
```

Using yarn:

```bash
yarn add @flaunch/sdk
```

## Quick Start

Here's a simple example to get started with reading token metadata:

```ts
import { createFlaunch } from "@flaunch/sdk";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const flaunchRead = createFlaunch({ publicClient });
const { symbol, name, image } = await flaunchRead.getCoinMetadata(coinAddress);
// returns: {symbol: "TEST", name: "Test", image: "https://<IMAGE_URL>"}
```

## Usage

The SDK provides two types of operations:

1. Read operations: Only require a `publicClient`
2. Write operations: Require both `publicClient` and `walletClient`

### Read Operations (with Viem)

```ts
import { createFlaunch } from "@flaunch/sdk";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const publicClient = createPublicClient({
  chain: base,
  transport: http("<RPC_URL>"), // "<RPC_URL>" is optional, defaults to public RPC
});

const flaunchRead = createFlaunch({ publicClient });

// Read token metadata
const { symbol, name, image } = await flaunchRead.getCoinMetadata(coinAddress);
// returns: {symbol: "TEST", name: "Test", image: "https://<IMAGE_URL>"}
```

### Write Operations (with Viem + Wagmi)

For write operations, you'll need both Viem and Wagmi. Here's how to set it up in a React component:

```ts
import { createFlaunch, ReadWriteFlaunchSDK } from "@flaunch/sdk";
import { base } from "viem/chains";
import { useWalletClient } from "wagmi";
import { useMemo } from "react";

// ... your React component ...

const publicClient = createPublicClient({
  chain: base,
  transport: http("<RPC_URL>"), // "<RPC_URL>" is optional, defaults to public RPC
});
const { data: walletClient } = useWalletClient();

const flaunchWrite = useMemo(() => {
  if (!publicClient && !walletClient) return null;

  return createFlaunch({
    publicClient,
    walletClient,
  }) as ReadWriteFlaunchSDK;
}, [publicClient, walletClient]);
```

### Flaunching a Memecoin

Flaunch your own memecoin with default parameters:

_**Flaunches below $10k market caps don't incur any protocol fees!**_

```ts
const hash = await flaunchWrite.flaunchIPFS({
  name: "Test",
  symbol: "TEST",
  fairLaunchPercent: 60, // 60%
  fairLaunchDuration: 30 * 60, // 30 mins
  initialMarketCapUSD: 10_000, // $10k
  creator: address,
  creatorFeeAllocationPercent: 80, // 80% to creator, 20% to community
  metadata: {
    base64Image: imageData, // refer to the code below, on how to generate this base64Image
    description: "Your memecoin description",
    // optional:
    websiteUrl: "https://example.com/",
    discordUrl: "https://discord.gg/example",
    twitterUrl: "https://x.com/example",
    telegramUrl: "https://t.me/example",
  },
});
```

#### How to generate `base64Image` from User uploaded file

```tsx
// handle image file input and convert into base64
const handleImageChange = useCallback(
  (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // read the file as base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;

        // this can be passed to the flaunch function call
        handleFlaunch({ imageData: base64String });

        // use `storedImagePreview` to display the uploaded image with <image src={storedImagePreview} />
        setStoredImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  },
  [setStoredImagePreview]
);

// File upload input
<input
  type="file"
  accept="image/*"
  onchange="handleImageChange(event)"
  id="image-upload"
/>;
```

### Flaunch with Address Fee Splits

You can flaunch a coin and share the revenue with the creator and an array of recipients, each with a different percentage share.\
Example below of a creator splitting 50% of their revenue with 2 addresses, with 30% and 70% share respectively:

```ts
await flaunchWrite.flaunchIPFSWithSplitManager({
  name: "...",
  symbol: "...",
  metadata: {
    base64Image: "...",
  },
  fairLaunchPercent: 40,
  fairLaunchDuration: 30 * 60, // 30 mins
  initialMarketCapUSD: 1_000,
  creator: "0x...",
  creatorFeeAllocationPercent: 100,
  // **Note:** Split related params
  creatorSplitPercent: 50,
  splitReceivers: [
    {
      address: "0x123...",
      percent: 30,
    },
    {
      address: "0xabc...",
      percent: 70,
    },
  ],
});
```

### Buying a Flaunch coin

```ts
// Execute the buy transaction
const buyTokens = async () => {
  const hash = await flaunchWrite.buyCoin({
    coinAddress,
    slippagePercent: 5,
    swapType: "EXACT_IN",
    amountIn: parseEther("0.1"),
  });

  // Wait for confirmation
  const receipt = await flaunchWrite.drift.waitForTransaction({ hash });
  console.log(receipt.status === "success" ? "Success" : "Failed");
};
```

### Selling with Permit2

Permit2 enables gasless token approvals. Here's how to implement token selling with Permit2:

```ts
import { useSignTypedData } from "wagmi";
import { parseEther, Hex } from "viem";

const {
  signTypedData,
  status: sigStatus,
  error: sigError,
  data: signature,
} = useSignTypedData();

// Check allowance and permit if needed
const { allowance } = await flaunchWrite.getPermit2AllowanceAndNonce(
  coinAddress
);

if (allowance < parseEther(coinAmount)) {
  const { typedData, permitSingle } = await flaunchWrite.getPermit2TypedData(
    coinAddress
  );
  signTypedData(typedData);

  // then call this when signature is not undefined
  const hash = await flaunchWrite.sellCoin({
    coinAddress,
    amountIn: parseEther(coinAmount),
    slippagePercent: 5,
    permitSingle,
    signature,
  });
} else {
  // if already approved
  const hash = await flaunchWrite.sellCoin({
    coinAddress,
    amountIn: parseEther(coinAmount),
    slippagePercent: 5,
  });
}
```

### Swap using USDC or other tokens by passing `intermediatePoolKey`

An `intermediatePoolKey` can be specified for the swap, where one currency of the poolKey is required to be `ETH` and the other currency can be `USDC` or some other token for which you want to swap from or into.
With the addition of this intermediate pool key, the swap gets routed as: `USDC -> ETH -> flETH -> Coin`

1. Buy Coin with USDC

```ts
import { useSignTypedData } from "wagmi";
const {
  signTypedData,
  status: sigStatus,
  error: sigError,
  data: signature,
} = useSignTypedData();

// flaunch coins by default have infinite approval for Permit2
// this is required for external tokens like USDC
const usdcAllowanceToPermit2 = await flaunchWrite.getERC20AllowanceToPermit2(
  usdcAddress
);
if (usdcAllowanceToPermit2 < amount) {
  // 1. max approve tx for Permit2 address to spend USDC
  await flaunchWrite.setERC20AllowanceToPermit2(usdcAddress, maxUint256);
}

const { allowance: usdcPermit2Allowance } =
  await flaunchWrite.getPermit2AllowanceAndNonce(usdcAddress);
if (usdcPermit2Allowance < amount) {
  // 2. sign permit2 signature to spend USDC for swap
  const { typedData, permitSingle } = await flaunchWrite.getPermit2TypedData(
    usdcAddress
  );
  signTypedData(typedData);
}

// 3. Buy flaunch coin with USDC
await flaunchWrite.buyCoin({
  coinAddress: coin,
  slippagePercent: 5,
  swapType: "EXACT_IN",
  amountIn: amount, // USDC amount
  // poolKey to route USDC to ETH swap
  intermediatePoolKey: {
    currency0: zeroAddress,
    currency1: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
    fee: 500,
    tickSpacing: 10,
    hooks: zeroAddress,
    hookData: "0x",
  },
  permitSingle,
  signature,
  referrer: referrer,
});
```

2. Sell coin for USDC

```ts
import { useSignTypedData } from "wagmi";
import { parseEther, Hex } from "viem";

const {
  signTypedData,
  status: sigStatus,
  error: sigError,
  data: signature,
} = useSignTypedData();

// Check allowance and permit if needed
const { allowance } = await flaunchWrite.getPermit2AllowanceAndNonce(
  coinAddress
);

if (allowance < parseEther(coinAmount)) {
  const { typedData, permitSingle } = await flaunchWrite.getPermit2TypedData(
    coinAddress
  );
  signTypedData(typedData);

  // then call this when signature is not undefined
  const hash = await flaunchWrite.sellCoin({
    coinAddress,
    amountIn: parseEther(coinAmount),
    slippagePercent: 5,
    permitSingle,
    signature,
    // poolKey to route ETH to USDC swap
    intermediatePoolKey: {
      currency0: zeroAddress,
      currency1: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      fee: 500,
      tickSpacing: 10,
      hooks: zeroAddress,
      hookData: "0x",
    },
  });
} else {
  // if already approved
  const hash = await flaunchWrite.sellCoin({
    coinAddress,
    amountIn: parseEther(coinAmount),
    slippagePercent: 5,
    // poolKey to route ETH to USDC swap
    intermediatePoolKey: {
      currency0: zeroAddress,
      currency1: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      fee: 500,
      tickSpacing: 10,
      hooks: zeroAddress,
      hookData: "0x",
    },
  });
}
```

3. The quote functions `getSellQuoteExactInput`, `getBuyQuoteExactInput` and `getBuyQuoteExactOutput` also support passing optional `intermediatePoolKey`.

### Advanced Integration: Revenue Sharing with RevenueManager

For platforms building on top of Flaunch, the `RevenueManager` contract enables sophisticated revenue-sharing models. It allows platforms to automatically take a protocol fee from the trading fees generated by memecoins launched through their integration.

**Key Concepts:**

1.  **Deployment & Initialization**: Before flaunching tokens via your platform, deploy an instance of your `RevenueManager` with your protocol fee and recipient address.

```ts
const revenueManagerInstanceAddress = await flaunchWrite.deployRevenueManager({
  protocolRecipient: "0xabc...",
  protocolFeePercent: 20, // 20% revenue share between protocol and 80% to coin creators (of the 1% swap fees)
});
```

2.  **Flaunching Directly to Manager**: Instead of the creator receiving the Flaunch NFT, you'd flaunch the token directly into the `RevenueManager`. This automatically sets up the fee split.

```ts
await flaunchWrite.flaunchIPFSWithRevenueManager({
  name: "...",
  symbol: "...",
  metadata: {
    base64Image: "...",
  },
  fairLaunchPercent: 40,
  fairLaunchDuration: 30 * 60, // 30 mins
  initialMarketCapUSD: 1_000,
  creator: "0x...",
  creatorFeeAllocationPercent: 100,
  // **Note:** Specify your instance of the RevenueManager here
  revenueManagerInstanceAddress: "...",
});
```

3.  **Claiming Fees**: Creators can claim their share of earned fees, and the protocol can claim its share via the `RevenueManager` contract.

```ts
// check address' balance
const balance = await flaunchRead.revenueManagerBalance({
  revenueManagerAddress: revenueManagerInstanceAddress,
  recipient: "0xabc...",
});

// protocol claim: the connected wallet must be the protocol recipient for the revenue manager
await flaunchWrite.revenueManagerProtocolClaim({
  revenueManagerAddress: revenueManagerInstanceAddress,
});

// creator claim: the connected wallet must be the coin's creator for them to claim their share
await flaunchWrite.revenueManagerCreatorClaim({
  revenueManagerAddress: revenueManagerInstanceAddress,
});

// creator claim: for specific flaunch token ids:
await flaunchWrite.revenueManagerCreatorClaimForTokens({
  revenueManagerAddress: revenueManagerInstanceAddress,
  flaunchTokens: [
    {
      flaunch: FlaunchAddress[base.id],
      tokenId: 5,
    },
    {
      flaunch: FlaunchV1_1Address[base.id],
      tokenId: 10,
    },
  ],
});
```

Refer to the [RevenueManager Docs](https://docs.flaunch.gg/manager-types/revenuemanager) for detailed implementation guides and function references.

### Bot Protection during Fair Launch via TrustedSigner

1. The `flaunch` call can be modified to enable TrustedSigner. For coins where it's enabled in their fair launch period, the buy transactions revert if they don't include the hookData with the signature (unique to the coin & sender address).
   It's upto your UI integration to use some captcha service or other sort of gating to allow the signature to be generated only for the selected users that are trying to buy the coin during it's fair launch.

You can also limit the amount of coins that can be bought in a single swap tx, or even set per wallet caps.

**Note:** If your have provided your custom `trustedFeeSigner`, then the signatures are expected to be signed by your address. The Flaunch UI won't be able to execute the swaps during fair launch in that case, as our UI won't have access to your keys.
But you may leave the `trustedFeeSigner` param `undefined`, then the swaps can go through our UI. But you won't be able to generate valid signatures on end, as you won't access to our signer address.

1.1. Without Premine

```ts
const hash = await flaunchWrite.flaunchIPFS({
  name: "Test",
  ...
  trustedSignerSettings: {
    enabled: true,
    trustedFeeSigner: "0x..",
    walletCap: parseEther("1000000"), // optional
    txCap: parseEther("10000"),       // optional
  }
});
```

1.2. With Premine
Refer to '2.' below to understand how to generate the deadline and signature, that needs to be passed here.

```ts
const hash = await flaunchWrite.flaunchIPFS({
  name: "Test",
  ...
  premineAmount: 123..,
  trustedSignerSettings: {
    enabled: true,
    trustedFeeSigner: "0x...",
    walletCap: parseEther("1000000"), // optional
    txCap: parseEther("10000"),       // optional
    premineSignedMessage: {
    	deadline: 1234..,
    	signature: "0xabc...",
    }
  }
});
```

2. Backend SDK to sign & generate hookData
   As the signing happens via your secure privateKey, we have a separate `FlaunchBackend` exported from our SDK package that's intended to be run on your nodejs backend or API. The API can verify if the request is legit (post captcha verification), and then return the signed hookData to be used for the `buyCoin` transaction.

```ts
import { FlaunchBackend } from "@flaunch/sdk";

const flaunchBackend = new FlaunchBackend(privateKeyHex, chain.id);

const { hookData, deadline, signature } =
  await flaunchBackend.generateHookDataWithSignature({
    userWallet,
    coinAddress,
    referrer: referrer || undefined, // Optional parameter
    deadlineFromNowInSeconds: 10 * 60, // 10 minutes in seconds
  });

// hookData would be passed to buyQuote and buyCoin functions
// signature and deadline useful for passing to the flaunch call with premine, via `trustedSignerSettings.premineSignedMessage` parameter
```

3. Check TrustedSigner status for a coin

```ts
const {
  isCurrentlyEnabled,
  trustedSignerEnabled,
  signer,
  fairLaunchStartsAt,
  fairLaunchEndsAt,
  isFairLaunchActive,
} = await flaunchRead.trustedPoolKeySignerStatus(coinAddress);

// if `isCurrentlyEnabled` is true, then we need to sign & pass in the hookData for the swaps with the given `signer` address
```

4. Buy quotes with TrustedSigner

```ts
const quote = await flaunchRead.getBuyQuoteExactInput({
  coinAddress: coin,
  amountIn: amount,
  // when trusted signer is currently enabled:
  hookData, // from the backend SDK
  userWallet: address,
});
```

5. Buy coin transaction with TrustedSigner

```ts
await flaunchWrite.buyCoin({
  coinAddress: coin,
  slippagePercent: 5,
  swapType: "EXACT_IN",
  referrer: referrer,
  // when trusted signer is currently enabled:
  hookData, // from the backend SDK
});
```

### Groups

The technical side of Groups is handled by the StakingManager. It allows the creator to deposit their flaunch memestream into the manager, and then a defined ERC20 token can be staked by the user to earn their share of the ETH rewards from the memestream.

1. Deploy your instance of the staking manager

```ts
import { Permissions } from "@flaunch/sdk";

const stakingManagerInstance = await flaunchWrite.deployStakingManager({
  managerOwner: ...,
  stakingToken: ..., // The ERC20 token to stake
  minEscrowDuration: ..., // The minimum duration (in seconds) that the creator's memestream NFT would be locked for
  minStakeDuration: ..., // The minimum duration (in seconds) that the user's tokens would be locked for
  creatorSharePercent: ..., // The % share that a creator will earn from their token
  ownerSharePercent: ..., // The % share that the manager owner will earn from their token
  // The Permissions can be OPEN, CLOSED, or WHITELISTED
  // OPEN = anyone can stake
  // CLOSED = no one except the managerOwner can stake
  // WHITELISTED = only whitelisted addresses can stake
  permissions: Permissions.OPEN,
});
```

2. Setting permissions after a Group is deployed (can only be called by the manager owner)

```ts
await flaunchWrite.treasuryManagerSetPermissions(
	treasuryManagerAddress: stakingManagerInstance,
	permissions: Permissions.CLOSED
);
```

3. Flaunch a new coin into your Group
   3.1. Flaunching into your staking manager instance

```ts
const hash = await flaunchWrite.flaunchIPFS({
  name: "Test",
  ...
  treasuryManagerParams: {
  	manager: stakingManagerInstance
  }
});
```

3.2. Deploying a new staking manager instance, and flaunching a new coin into it in a single transaction

```ts
import { StakingManagerAddress } from "@flaunch/sdk";

const hash = await flaunchWrite.flaunchIPFS({
  name: "Test",
  ...
  treasuryManagerParams: {
  	manager: StakingManagerAddress[chain.id],
    permissions: Permissions.CLOSED
  }
});
```

Note: the `treasuryManagerParams.permissions` value is ignored if the `treasuryManagerParams.manager` is your manager instance instead.

4. Add an already flaunched coin to a group

```ts
import { FlaunchVersion } from "@flaunch/sdk";

// first approve then deposit
const tokenId = 123;
const isApproved = await flaunchRead.isFlaunchTokenApprovedForAll(
  FlaunchVersion.V1_1_1,
  owner,
  treasuryManagerAddress
);

if (!isApproved) {
  await flaunchWrite.setFlaunchTokenApprovalForAll(
    FlaunchVersion.V1_1_1,
    treasuryManagerAddress,
    true
  );
}

await flaunchWrite.addToTreasuryManager(
  treasuryManagerAddress,
  FlaunchVersion.V1_1_1,
  tokenId
);
```

### Importing External Coins into Flaunch

You can import external ERC20 coins launched on other platforms like Zora, Virtuals, etc. into Flaunch to utilize the power of our Uniswap V4 hooks!

1.1. Import with coin's current price

```ts
await flaunchWrite.importMemecoin({
  coinAddress: "0x...", // ERC20 token contract address
  creatorFeeAllocationPercent: 100, // Fee allocation to creator (0-100%)
  initialPriceUSD: 1, // Starting price in USD
});
```

1.2. Import with coin's current market cap. For memecoins, market caps are more human readable so you can pass it as follows

```ts
await flaunchWrite.importMemecoin({
  coinAddress: "0x...", // ERC20 token contract address
  creatorFeeAllocationPercent: 100, // Fee allocation to creator (0-100%)
  initialMarketCapUSD: 10_000, // Starting market cap in USD
});
```

**Note:** The Flaunch Version for imported coins is: `FlaunchVersion.ANY` where `import {FlaunchVersion} from "@flaunch/sdk"`

**⚠️ Note:** The term "MarketCap" used throughout simply means `current coin price * ERC20.totalSupply()`. Some coins might show it as FDV, make sure to verify so that the Pool is initialized at the right price, and the liquidity gets provided at the expected range.

### Adding Liquidity to Imported (or flaunch) coins

When an external coin is imported into Flaunch's Uniswap V4 hooks, it has no liquidity in the pool. We can add liquidity by using the functions below.

Note: for existing flaunch coins you can pass `version` param as `FlaunchVersion.V1_2`, if left blank then the SDK can determine it automatically, defaulting to `FlaunchVersion.ANY` for external coins

1. Read call to calculate the Coin & ETH amounts required for providing liquidity, based on the liquidity range specified. The return values are useful for displaying on the UI, before sending the liquidity transaction.

1.1. Full Range liquidity

```ts
const result = await flaunchRead.calculateAddLiquidityAmounts({
  coinAddress: "0x...", // Token contract address
  // version = FlaunchVersion.ANY for imported coins as they use our {AnyPositionManager}
  version: FlaunchVersion.ANY, // optional (auto determines Flaunch version if not provided, else defaults to ANY if not found)
  liquidityMode: LiquidityMode.FULL_RANGE,
  coinOrEthInputAmount: parseEther("1"), // Input amount in wei
  inputToken: "coin", // "coin" or "eth" - which token amount is specified
  minMarketCap: "0", // not needed for FULL_RANGE
  maxMarketCap: "0", // not needed for FULL_RANGE
});
// Returns: { coinAmount, ethAmount, tickLower, tickUpper, currentTick }
```

1.2. Concentrated Range liquidity
1.2.1. With Market Cap inputs

```ts
const result = await flaunchRead.calculateAddLiquidityAmounts({
  coinAddress: "0x...", // Token contract address
  version: FlaunchVersion.ANY,
  liquidityMode: LiquidityMode.CONCENTRATED,
  coinOrEthInputAmount: parseEther("1"), // Input amount in wei
  inputToken: "coin", // "coin" or "eth" - which token amount is specified
  minMarketCap: "1000000", // $1M
  maxMarketCap: "5000000", // $5M
});
// Returns: { coinAmount, ethAmount, tickLower, tickUpper, currentTick }
```

1.2.2. With Coin Price inputs

```ts
const result = await flaunchRead.calculateAddLiquidityAmounts({
  coinAddress: "0x...", // Token contract address
  version: FlaunchVersion.ANY,
  liquidityMode: LiquidityMode.CONCENTRATED,
  coinOrEthInputAmount: parseEther("1"), // Input amount in wei
  inputToken: "coin", // "coin" or "eth" - which token amount is specified
  minPriceUSD: "1",
  maxPriceUSD: "5",
});
// Returns: { coinAmount, ethAmount, tickLower, tickUpper, currentTick }
```

1.2.3. `checkSingleSidedAddLiquidity`: helper check function to detect which token input to hide during single-sided concentrated liquidity addition.

Based on the specified concentrated range, we can determine which token (memecoin or ETH) to hide on the UI, as the liquidity would be single-sided

```ts
const { isSingleSided, shouldHideCoinInput, shouldHideETHInput } = await flaunchRead.checkSingleSidedAddLiquidity({
  coinAddress,
  liquidityMode: LiquidityMode.CONCENTRATED,
  // Option 1: can pass market caps
  minMarketCap: "1000000", // $1M
  maxMarketCap: "5000000", // $5M
  currentMarketCap: "1000000" // (optional) can be queried from the pool if not specified
  // OR Option 2: or can pass price
  minPriceUSD: "1",
  maxPriceUSD: "5",
  currentPriceUSD: 0.001, // (optional) can be queried from the pool if not specified
});
```

2. Add Liquidity Transactions
   Adding liquidity is a multi-step process, but we have abstracted away all the complexities. With wallets supporting ERCs 5792 & 7702, users would only get one wallet popup to confirm the transactions. See code snippet below at 2.3. for the same

2.1. With Market Cap inputs

```ts
const addLiqCalls = await flaunchWrite.getAddLiquidityCalls({
  coinAddress: "0x...", // Same parameters as calculateAddLiquidityAmounts
  version: FlaunchVersion.ANY, // optional
  liquidityMode: LiquidityMode.CONCENTRATED,
  coinOrEthInputAmount: parseEther("1"),
  inputToken: "coin",
  minMarketCap: "1000000", // $1M
  maxMarketCap: "5000000", // $5M
});
// Returns: CallWithDescription[] - Array of transaction calls with descriptions
```

2.2. With Coin Price inputs

```ts
const addLiqCalls = await flaunchWrite.getAddLiquidityCalls({
  coinAddress: "0x...", // Same parameters as calculateAddLiquidityAmounts
  version: FlaunchVersion.ANY, // optional
  liquidityMode: LiquidityMode.CONCENTRATED,
  coinOrEthInputAmount: parseEther("1"),
  inputToken: "coin",
  minPriceUSD: "1",
  maxPriceUSD: "5",
});
```

2.3. Sending the transactions as a single batch to the Wallet via ERC-5792 and wagmi

**Note:** if the user's connected wallet doesn't support ERC-5792 (can be checked via `useCapabilities`), then you can simply loop through the `addLiqCalls` array and use `useSendTransaction` to send the transactions individually. The calls have a description to show on the UI if they'd be sent sequentially.

```ts
import { useSendCalls } from "wagmi";

const { sendCalls } = useSendCalls();

const calls = addLiqCalls.map((call) => ({
  to: call.to as `0x${string}`,
  value: call.value,
  data: call.data as `0x${string}`,
}));

await sendCalls({ calls });
```

### Import AND Add Liquidity calls in a single batch

1. This allows an external coin to be live on flaunch, and be tradeable instantly with the liquidity being provided in the same transaction batch.

💡 Tip: To mimic the traditional flaunch liquidity curve, the coin creator can provide liquidity from current market cap to a higher market cap. This makes the liquidity addition to be single-sided, entirely being in their coin with no ETH required. As people buy into the pool and the price goes up, the liquidity position accumulates ETH while selling the coins from the position.

Note: As a flaunch liquidity provider, you won't accumulate the trading fees. The fees are only accumulated to the Creator or split based on the TreasuryManager used.

1.1. With Market Cap inputs

```ts
const importAndAddLiqCalls = await flaunchWrite.getImportAndAddLiquidityCalls({
  coinAddress: "0x...", // ERC20 token contract address
  creatorFeeAllocationPercent: 100, // Fee allocation to creator (0-100%)
  initialMarketCapUSD: 10_000, // Starting market cap in USD
  liquidityMode: LiquidityMode.CONCENTRATED,
  coinOrEthInputAmount: parseEther("1"), // Input amount in wei
  inputToken: "coin", // "coin" or "eth" - which token amount is specified
  minMarketCap: "1000000", // $1M
  maxMarketCap: "5000000", // $5M
});
// Returns: CallWithDescription[] - Array of transaction calls with descriptions

// === send these calls to user's wallet as a batch ===
import { useSendCalls } from "wagmi";

const { sendCalls } = useSendCalls();

const calls = importAndAddLiqCalls.map((call) => ({
  to: call.to as `0x${string}`,
  value: call.value,
  data: call.data as `0x${string}`,
}));

await sendCalls({ calls });
```

1.2. With Coin Price inputs

```ts
const importAndAddLiqCalls = await flaunchWrite.getImportAndAddLiquidityCalls({
  coinAddress: "0x...", // ERC20 token contract address
  creatorFeeAllocationPercent: 100, // Fee allocation to creator (0-100%)
  initialPriceUSD: 1, // Starting price in USD
  liquidityMode: LiquidityMode.CONCENTRATED,
  coinOrEthInputAmount: parseEther("1"), // Input amount in wei
  inputToken: "coin", // "coin" or "eth" - which token amount is specified
  minPriceUSD: "1",
  maxPriceUSD: "5",
});
```

### `createFlaunchCalldata`: alternative to `createFlaunch` that returns the tx call object with to, data, and value instead of directly broadcasting the tx from walletClient

To support custom signers that might not be compatible with our `walletClient` approach, or to enable account abstraction and batching on your wallet signer's end we have `createFlaunchCalldata` that returns the tx object, leaving the tx broadcasting to be flexible & handled on your end.

All the write calls must go via `parseCall` as shown below, read calls are made normally as before

```ts
import { createFlaunchCalldata, parseCall } from "@flaunch/sdk";

// 1. Can create read-only SDK (similar to createFlaunch without walletClient)
const flaunchRead = createFlaunchCalldata({
  publicClient,
});

// 2. Create read-write SDK for call generation
const flaunchCalldata = createFlaunchCalldata({
  publicClient,
  walletAddress,
});

const call = await parseCall(() =>
  flaunchCalldata.setERC20AllowanceToPermit2(usdcAddress, maxUint256)
);

console.log("Call:", {
  to: call.to,
  value: call.value.toString(),
  data: call.data,
});
```

### All SDK functions

For a list of all the functions in the SDK, refer to: [FlaunchSDK.ts](./src/sdk/FlaunchSDK.ts)

### React Hooks

The package also has hooks to listen for new Flaunches and new Coin Swaps. Refer to: [hooks](./src/hooks/FlaunchPositionManagerHooks.ts)

```tsx
import { usePoolCreatedEvents, usePoolSwapEvents } from "@flaunch/sdk/hooks";

const { logs: poolCreatedLogs } = usePoolCreatedEvents(flaunchRead);
const { logs: poolSwapLogs } = usePoolSwapEvents(flaunchRead, coinAddress);

/**
 * The `poolSwapLogs` calculates & returns the net swapped amount:
 *
 * type BuySwapLog = {
 *  ...eventLog,
 *  timestamp: number;
 *  type: "BUY";
 *   delta: {
 *     coinsBought: bigint;
 *     flETHSold: bigint;
 *     fees: {
 *       isInFLETH: boolean;
 *       amount: bigint;
 *     };
 *   };
 * };
 *
 * type SellSwapLog = {
 *  ...eventLog,
 *  timestamp: number;
 *  type: "SELL";
 *   delta: {
 *     coinsSold: bigint;
 *     flETHBought: bigint;
 *     fees: {
 *       isInFLETH: boolean;
 *       amount: bigint;
 *     };
 *   };
 * };
 */
```

## Flaunch Reference

For detailed protocol documentation, visit our [Docs](https://docs.flaunch.gg/).
