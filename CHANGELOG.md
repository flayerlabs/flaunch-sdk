# Changelog

All notable changes to the @flaunch/sdk package will be documented in this file.

## [0.8.1] - 2025-06-12

### Added

- **AddressFeeSplitManager** support for advanced creator fee distribution
  - `flaunchWithSplitManager()` and `flaunchIPFSWithSplitManager()` methods for distributing creator fees between creator and multiple recipients with configurable percentages
- **Enhanced swap transaction parsing utilities**
  - New `parseSwap.ts` utility with `parseSwapData()` function for parsing raw swap log arguments, returning BUY/SELL type, amounts, and fee information
  - Added `parseSwapTx()` method to all position manager clients (V1, V1.1, and AnyPositionManager)
- **AnyBidWall support** for external coin bid wall functionality
  - New `AnyBidWall` client class with position and pool info methods
  - Integration with SDK's `getBidWall()` method for ANY version

### Changed

- **Improved swap parsing implementation** across all position manager clients
  - Refactored duplicate swap parsing logic into reusable `parseSwapData()` utility
  - All position managers now use the same parsing logic for consistency
- **Updated address mappings** for testnet development
  - Updated `AnyPositionManagerAddress` and `ReferralEscrowAddress` for Base Sepolia
- **Enhanced SDK architecture** for better multi-version support
  - Added generic swap log types for cross-version compatibility
  - Improved position manager selection logic for ANY version

## [0.8.0] - 2025-05-23

### Added

- New `AnyPositionManager` for external coin support with associated client and ABI
- Fee Escrow system for managing creator revenue with `creatorRevenue` and `withdrawCreatorRevenue` functions
- Referral Escrow system with `referralBalance` and `claimReferralBalance` functions
- Coin price and market cap in USD with `coinPriceInUSD` and `coinMarketCapInUSD` functions
- `createDrift` helper function for type-safe Drift SDK instantiation
- `initialSqrtPriceX96` function for calculating initial launch price
- `FlaunchVersion` enum (V1, V1.1, ANY) for better version management

### Changed

- Refactored SDK to support multiple contract versions with `getCoinVersion` and version-aware helper functions
- Updated Quoter and Universal Router to use `positionManagerAddress` instead of `isV1Coin`
- Modified `createFlaunch` factory to use new `createDrift` helper
- Added `totalSupply()` method to `ReadMemecoin` client
- Updated README to reflect new launch parameters and deprecations

### Deprecated

- `fastFlaunch` and `fastFlaunchIPFS` methods in favor of `flaunch` or `flaunchIPFS`

### Fixed

- Consistent total supply calculation for market cap
- Improved handling of position manager versions

## [0.7.1] - 2025-05-15

### Fixed

- Fixed merkle root handling in FlaunchZapClient by using `zeroHash` instead of "0x" for empty bytes32 values
  - Fixes the error: "AbiEncodingBytesSizeMismatchError: Size of bytes "0x" (bytes0) does not match expected size (bytes32)."

## [0.7.0] - 2025-05-14

### Added

- New `createFlaunch` factory function to simplify SDK initialization
  - Provides a more intuitive way to create SDK instances
  - Automatically handles Drift setup internally
  - Type-safe return types based on provided clients

### Changed

- Removed `@delvtech/drift` as a peer dependency
  - Now included as a direct dependency
  - Users no longer need to install it separately
- Simplified SDK setup process
  - Reduced boilerplate code for initialization
  - Better TypeScript type inference
  - Improved developer experience
- Updated dependency on `@delvtech/drift` from 0.3.0 to ^0.8.4
- Updated Viem from 2.23.2 to 2.29.2
- Modified API calls to match latest Drift interfaces
- Changed TypeScript module resolution to "bundler" with stricter type checking
- Better handling of optional parameters in metadata uploads

### Fixed

- Improved null checking in functions to prevent TypeScript errors
- Fixed potential undefined parameter issues when filtering by coin

## [0.6.0] - 2025-05-13

### Added

- New `ReadWritePermit2` client with direct approval support
  - Added `approve` function to execute token approvals via transaction
- Improved TypeScript type safety and null checking

## [0.5.1] - 2025-05-09

### Added

- Quoter functions added to the main SDK to simplify price quoting
  - `getSellQuoteExactInput`: Gets a quote for selling an exact amount of tokens for ETH
  - `getBuyQuoteExactInput`: Gets a quote for buying tokens with an exact amount of ETH
  - `getBuyQuoteExactOutput`: Gets a quote for buying an exact amount of tokens with ETH

## [0.5.0] - 2025-05-09

### Added

- FlaunchZap integration for flaunches with premines
- Auto-calculation of flaunching fees
- Support for calculating premine cost in ETH
- New helper functions:
  - `getFlaunchingFee`: Get the flaunching fee for a given initial price
  - `ethRequiredToFlaunch`: Calculate ETH required to flaunch a token including premine cost and fees
- Detailed documentation for premine functionality

### Changed

- Improved constructor flows with property initialization
- Updated default flaunch flow to use FlaunchZap for better premine support
- Updated parameter handling in flaunch functions (removed need for `
