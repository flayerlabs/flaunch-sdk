# Flaunch SDK

[![npm version](https://badge.fury.io/js/%40flaunch%2Fsdk.svg)](https://npmjs.com/package/@flaunch/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A TypeScript SDK for seamless interaction with the Flaunch protocol and Uniswap V4.

![Flaunch Header](https://raw.githubusercontent.com/flayerlabs/flaunch-sdk/refs/heads/master/.github/flaunch-header.png)

## Features

- 🚀 Flaunch new memecoins
- 💱 Buy and sell memecoins via Uniswap V4 hooks
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
  - [All SDK functions](#all-sdk-functions)
  - [React Hooks](#react-hooks)
- [Flaunch Docs](#flaunch-reference)

## Installation

Using pnpm (recommended):

```bash
pnpm add @flaunch/sdk @delvtech/drift
```

Using npm:

```bash
npm install @flaunch/sdk @delvtech/drift
```

Using yarn:

```bash
yarn add @flaunch/sdk @delvtech/drift
```

## Quick Start

Here's a simple example to get started with reading token metadata:

```ts
import { ReadFlaunchSDK } from "@flaunch/sdk";
import { createDrift } from "@delvtech/drift";
import { viemAdapter } from "@delvtech/drift-viem";
import { base } from "viem/chains";

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const drift = createDrift({
  adapter: viemAdapter({ publicClient }),
});

const flaunchRead = new ReadFlaunchSDK(base.id, drift);
const { symbol, name, image } = await flaunchRead.getCoinMetadata(coinAddress);
// returns: {symbol: "TEST", name: "Test", image: "https://<IMAGE_URL>"}
```

## Usage

The SDK has 2 exports:

1. `ReadFlaunchSDK`: public read only operations
2. `ReadWriteFlaunchSDK`: read and write operations (extends `ReadFlaunchSDK`)

### Read Operations (with Viem)

1. First, install the Viem adapter:

```bash
pnpm add @delvtech/drift-viem
```

2. Initialize the SDK for read operations:

```ts
import { ReadFlaunchSDK } from "@flaunch/sdk";
import { createDrift } from "@delvtech/drift";
import { viemAdapter } from "@delvtech/drift-viem";
import { base, baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: base,
  transport: http("<RPC_URL>"), // "<RPC_URL>" is optional, defaults to public RPC
});

const drift = createDrift({
  adapter: viemAdapter({ publicClient }),
});

const flaunchRead = new ReadFlaunchSDK(base.id, drift);

// Read token metadata
const { symbol, name, image } = await flaunchRead.getCoinMetadata(coinAddress);
// returns: {symbol: "TEST", name: "Test", image: "https://<IMAGE_URL>"}
```

### Write Operations (with Viem + Wagmi)

For write operations, you'll need both Viem and Wagmi. Here's how to set it up in a React component:

```ts
import { ReadWriteFlaunchSDK } from "@flaunch/sdk";
import { createDrift } from "@delvtech/drift";
import { viemAdapter } from "@delvtech/drift-viem";
import { base } from "viem/chains";
import { useWalletClient } from "wagmi";
import { useMemo } from "react";

// ... your React component ...

const { data: walletClient } = useWalletClient();

const flaunchWrite = useMemo(() => {
  if (walletClient) {
    const drift = createDrift({
      adapter: viemAdapter({ publicClient, walletClient }),
    });
    return new ReadWriteFlaunchSDK(base.id, drift);
  }
}, [walletClient]);

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

"Fast" Flaunch your own memecoin with default parameters:

- $10k starting market cap
- 60% of the total supply goes to the fair launch
- 80% dev / 20% community split

_**Fast Flaunch doesn't incur any protocol fees!**_

```ts
const hash = await flaunchWrite.fastFlaunchIPFS({
  name: "Test",
  symbol: "TEST",
  creator: address,
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
