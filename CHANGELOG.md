# Changelog

All notable changes to the @flaunch/sdk package will be documented in this file.

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
- Updated parameter handling in flaunch functions (removed need for `flaunchingETHFees` param)

## [0.4.2] - 2025-05-06

### Added

- Additional comments and documentation for better developer experience

### Fixed

- IPFS gateway rate limiting issue fixed by implementing a gateway rotation system
  - Added multiple IPFS gateways to cycle through for fetching metadata
  - Prevents rate limiting when making multiple concurrent IPFS requests

## [0.4.1] - 2025-05-06

### Added

- Custom IPFS resolver function via `setIPFSResolver`
- Improved documentation in Publishing.md

### Fixed

- Optimized IPFS handling to avoid rate limiting
- Batch processing for IPFS requests with configurable batch size and delay

## [0.4.0] - 2025-05-02

### Added

- Revenue Manager support for sophisticated revenue-sharing models
- New functions for revenue sharing:
  - `deployRevenueManager`: Deploy a new revenue manager instance
  - `flaunchWithRevenueManager`: Launch tokens directly into a revenue manager
  - `flaunchIPFSWithRevenueManager`: Launch with IPFS metadata into a revenue manager
  - `revenueManagerBalance`: Check claimable ETH balance for specific recipient
  - `revenueManagerProtocolBalance`: Check claimable ETH balance for protocol
  - `revenueManagerProtocolClaim`: Claim protocol's share of revenue
  - `revenueManagerCreatorClaim`: Claim creator's share of revenue
  - `revenueManagerCreatorClaimForTokens`: Claim creator's share for specific tokens

### Changed

- Updated creator claim functionality to support both general claims and token-specific claims
- Improved documentation with comprehensive examples for revenue sharing

## [0.3.1] - 2025-03-26

### Added

- FastFlaunchZap base mainnet address

## [0.3.0] - 2025-03-18

### Added

- More clients and functions for expanded functionality
- Made client instances publicly accessible for advanced use cases

## [0.2.0] - 2025-03-07

### Changed

- Updated FastFlaunch address and ABI
- Removed `createFeeAllocationPercent` parameter (deprecated)

## [0.1.1] - 2025-03-05

### Fixed

- README badge URL fix
- Documentation updates before publishing

## [0.1.0] - 2025-03-04

### Added

- Initial release of the Flaunch SDK
- Core functionality:
  - Flaunching new memecoins
  - Buying and selling memecoins via Uniswap V4 hooks
  - Read functions for token and pool data
  - Permit2 support for gasless approvals
  - Support for Base and Base Sepolia networks
- Key features:
  - Token metadata handling via IPFS
  - Fair launch support
  - Swap functionality
  - Price queries
  - Pool data access
