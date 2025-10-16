# Changelog

All notable changes to the @flaunch/sdk package will be documented in this file.

## [0.9.5] - 2025-10-16

### Fixed

- Updated Token Importer contract address for base sepolia.

## [0.9.4] - 2025-10-01

### Fixed

- Updated manager contract addresses.

## [0.9.3] - 2025-10-01

### Fixed

- Updated manager contract addresses.

## [0.9.2] - 2025-10-01

### Fixed

- Updated manager contract addresses to support legacy flaunch V1 coins. The new managers utilize our FeeEscrowRegistry contract.

## [0.9.1] - 2025-09-29

### Fixed

- **RPC Endpoint Reliability Issues** for Transaction Receipts from hash
  - Update `getManagerDeployedAddressFromTx()` method to use provided `publicClient` instead of creating new public client with default endpoints
  - Added optional `publicClient` parameter to `ReadTreasuryManagerFactory` and `ReadWriteTreasuryManagerFactory` constructors
  - Updated `ReadFlaunchSDK` and `ReadWriteFlaunchSDK` constructors to accept and utilize optional `publicClient` parameter
  - Modified `createFlaunch()` factory function to pass provided `publicClient` to SDK instances
  - Resolves issues with unreliable public RPC endpoints when extracting deployed manager addresses from transaction receipts

## [0.9.0] - 2025-09-25

### Added

- **Comprehensive Liquidity Management System** for imported and flaunch coins

  - New `calculateAddLiquidityAmounts()` method for calculating optimal coin and ETH amounts for liquidity provision
  - `checkSingleSidedAddLiquidity()` helper to detect which token input to hide for single-sided liquidity
  - `getAddLiquidityCalls()` method for generating multi-step liquidity addition transaction calls
  - Support for both full-range and concentrated liquidity strategies via `LiquidityMode` enum
  - Flexible input methods: specify amounts by market cap, coin price, or exact token amounts
  - ERC-5792 batch transaction support for streamlined user experience with compatible wallets

- **Advanced Bot Protection System** with TrustedSigner functionality

  - New `FlaunchBackend` class for server-side signature generation and bot protection
  - `generateHookDataWithSignature()` method for creating authenticated swap signatures
  - `trustedPoolKeySignerStatus()` to check bot protection status for any coin
  - Enhanced fair launch protection with configurable `walletCap` and `txCap` during flaunch
  - Integration with premine functionality via `premineSignedMessage` parameter

- **Multi-Token Trading Support** via intermediate pool routing

  - `intermediatePoolKey` parameter in buy/sell functions enabling USDC, USDT, and other token swaps
  - Automatic routing: `USDC -> ETH -> flETH -> Coin` for seamless non-ETH trading
  - Support in all quote functions: `getSellQuoteExactInput()`, `getBuyQuoteExactInput()`, `getBuyQuoteExactOutput()`
  - Enhanced trading accessibility for users without ETH holdings

- **Groups and Treasury Management System**

  - `deployStakingManager()` for creating group functionality with configurable staking parameters
  - Permission system with `Permissions` enum (OPEN, CLOSED, WHITELISTED) and `getPermissionsAddress()` helper
  - `treasuryManagerSetPermissions()` for dynamic permission management
  - `addToTreasuryManager()` for adding existing coins to groups
  - `treasuryManagerParams` support in flaunch methods for direct group creation or depositing into existing manager instance
  - `isFlaunchTokenApprovedForAll()` and `setFlaunchTokenApprovalForAll()` for NFT approval management

- **Account Abstraction and Custom Signer Support**

  - New `createFlaunchCalldata()` function for generating transaction call objects instead of broadcasting
  - `parseCall()` utility for extracting call data from SDK method calls
  - `CallData` interface with `to`, `value`, and `data` properties for external transaction handling
  - `createCallDataWalletClient()` for custom wallet client implementation
  - Enhanced support for account abstraction wallets and external transaction batching

- **Enhanced Import System** for external memecoins

  - `getImportAndAddLiquidityCalls()` for atomic import and liquidity addition in single transaction batch
  - Dual input methods: import by `initialMarketCapUSD` or `initialPriceUSD`
  - `isMemecoinImported()` check function for import status verification

- **Developer Experience Improvements**
  - **Simplified IPFS Integration**: Pinata configuration now optional, defaults to Flaunch API for uploads
  - `getERC20AllowanceToPermit2()` and `setERC20AllowanceToPermit2()` for external token approval management
  - Updated smart contract addresses in `addresses.ts`
  - `getManagerDeployedAddressFromTx()` utility for extracting deployed manager addresses from transaction receipts

### Changed

- **Version Naming Standardization**: Renamed `FlaunchVersion.V1_1_1` to `FlaunchVersion.V1_2` for consistency
- **Enhanced IPFS Upload System**: Made `pinataConfig` optional in `IPFSParams` interface, defaulting to Flaunch API
- **Improved SDK Architecture**: Enhanced multi-version support with better contract address management
- **Updated Contract Address Mappings**: Added comprehensive mainnet addresses for all new contracts:
  - `StakingManagerAddress`, `ClosedPermissionsAddress`, `WhitelistedPermissionsAddress`
  - Updated `FlaunchZapAddress` with trusted signer support
  - New `FlaunchV1_2Address` and `FlaunchPositionManagerV1_2Address` mappings
- **Enhanced Type System**: Added comprehensive types for liquidity management, permissions, and call data generation
- **Improved Error Handling**: Better validation and error messages across all new functionality

### Fixed

- **High-Precision Price Calculations**: Fixed `coinPriceInUSD()` to return 18-decimal precision for accurate price representation
- **Manager Deployment Detection**: Updated `getManagerDeployedAddressFromTx()` to use transaction receipt logs directly for more reliable address extraction
- **Single-Sided Liquidity Calculations**: Fixed amount calculations for single-sided liquidity positions to force correct zero amounts
- **AnyPositionManager Integration**: Updated `initialPriceParams` to include memecoin address for proper external coin support
- **Liquidity Transaction Optimization**: Removed unnecessary transaction calls from liquidity addition flows for gas efficiency

## [0.8.2] - 2025-07-01

### Added

- **TokenImporter support** for importing external memecoins into the Flaunch ecosystem
  - New `ReadTokenImporter` and `ReadWriteTokenImporter` clients with verification capabilities
  - `tokenImporterVerifyMemecoin()` method to check if a memecoin is valid for importing
  - `importMemecoin()` method to import verified memecoins with configurable parameters
  - Support for multiple verifier systems: Clanker, Doppler, Virtuals, Whitelist, and Zora
- **Flaunch into existing groups / treasury managers**
  - New `treasuryManagerParams` option in `flaunch()` and `flaunchIPFS()` methods
- **Expanded utility exports** for better developer experience
  - Added `./utils` export path to package.json for direct access to utility functions
  - `parseSwapData()`, `universalRouter` utilities, and `univ4` helpers now available as standalone imports

### Changed

- **Updated mainnet contract addresses** for production deployment
  - Updated `AnyPositionManagerAddress` and `AnyBidWallAddress` for Base mainnet
  - Updated `AnyFlaunchAddress` for Base mainnet deployment

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
