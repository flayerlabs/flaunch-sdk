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
  - [Read Operations](#read-operations-with-viem)
  - [Write Operations](#write-operations-with-viem--wagmi)
  - [Selling with Permit2](#selling-with-permit2)
  - [Flaunching a Memecoin](#flaunching-a-memecoin)
    - [How to generate Base64Image from file upload](#how-to-generate-base64image-from-user-uploaded-file)
  - [Advanced Integration: Revenue Sharing with RevenueManager](#advanced-integration-revenue-sharing-with-revenuemanager)
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

// Execute a buy transaction
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
  pinataConfig: {
    // Use one-time JWT for client-side uploads
    // Refer: https://www.pinata.cloud/blog/how-to-upload-to-ipfs-from-the-frontend-with-signed-jwts/
    jwt: pinataJWT,
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
  pinataConfig: {
    jwt: "...",
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
