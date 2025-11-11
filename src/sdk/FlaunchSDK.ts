import {
  createDrift,
  Drift,
  HexString,
  ReadWriteAdapter,
  type Address,
} from "@delvtech/drift";
import {
  type PublicClient,
  zeroAddress,
  Hex,
  encodeAbiParameters,
  parseUnits,
  erc20Abi,
  encodeFunctionData,
  erc721Abi,
  formatUnits,
} from "viem";
import axios from "axios";
import {
  FlaunchPositionManagerAddress,
  StateViewAddress,
  PoolManagerAddress,
  FLETHAddress,
  FairLaunchAddress,
  FlaunchZapAddress,
  FlaunchAddress,
  BidWallAddress,
  UniversalRouterAddress,
  QuoterAddress,
  Permit2Address,
  FlaunchPositionManagerV1_1Address,
  BidWallV1_1Address,
  FlaunchV1_1Address,
  FairLaunchV1_1Address,
  TreasuryManagerFactoryAddress,
  AnyPositionManagerAddress,
  AnyBidWallAddress,
  AnyFlaunchAddress,
  FeeEscrowAddress,
  ReferralEscrowAddress,
  TokenImporterAddress,
  UniV4PositionManagerAddress,
  FlaunchPositionManagerV1_2Address,
  FlaunchV1_2Address,
  // V1.2 and AnyPositionManager addresses will be imported here when available
} from "../addresses";
import {
  ReadFlaunchPositionManager,
  ReadWriteFlaunchPositionManager,
  WatchPoolCreatedParams,
  WatchPoolSwapParams as WatchPoolSwapParamsPositionManager,
  type BaseSwapLog as FlaunchBaseSwapLog,
  type BuySwapLog as FlaunchBuySwapLog,
  type SellSwapLog as FlaunchSellSwapLog,
} from "../clients/FlaunchPositionManagerClient";
import {
  ReadPoolManager,
  PositionInfoParams,
} from "../clients/PoolManagerClient";
import { ReadStateView } from "../clients/StateViewClient";
import { ReadFairLaunch } from "../clients/FairLaunchClient";
import { ReadBidWall } from "../clients/BidWallClient";
import { AnyBidWall } from "../clients/AnyBidWall";
import {
  ReadFlaunchZap,
  ReadWriteFlaunchZap,
  FlaunchParams,
  FlaunchIPFSParams,
  FlaunchWithRevenueManagerParams,
  FlaunchWithRevenueManagerIPFSParams,
  FlaunchWithSplitManagerParams,
  FlaunchWithSplitManagerIPFSParams,
  DeployRevenueManagerParams,
  DeployStakingManagerParams,
  DeployBuyBackManagerParams,
} from "../clients/FlaunchZapClient";
import { ReadFlaunch } from "../clients/FlaunchClient";
import { ReadMemecoin, ReadWriteMemecoin } from "../clients/MemecoinClient";
import { ReadQuoter } from "clients/QuoterClient";
import { ReadPermit2, ReadWritePermit2 } from "clients/Permit2Client";
import {
  ReadFlaunchPositionManagerV1_1,
  ReadWriteFlaunchPositionManagerV1_1,
} from "clients/FlaunchPositionManagerV1_1Client";
import {
  ReadFlaunchPositionManagerV1_2,
  ReadWriteFlaunchPositionManagerV1_2,
} from "clients/FlaunchPositionManagerV1_2Client";
import {
  AnyFlaunchParams,
  ReadAnyPositionManager,
  ReadWriteAnyPositionManager,
  type BaseSwapLog as AnyBaseSwapLog,
  type BuySwapLog as AnyBuySwapLog,
  type SellSwapLog as AnySellSwapLog,
} from "clients/AnyPositionManagerClient";
import {
  ReadTokenImporter,
  ReadWriteTokenImporter,
} from "clients/TokenImporter";
import { ReadFeeEscrow, ReadWriteFeeEscrow } from "clients/FeeEscrowClient";
import {
  ReadReferralEscrow,
  ReadWriteReferralEscrow,
} from "clients/ReferralEscrowClient";
import { ReadBidWallV1_1 } from "clients/BidWallV1_1Client";
import { ReadFairLaunchV1_1 } from "clients/FairLaunchV1_1Client";
import { ReadFlaunchV1_1 } from "clients/FlaunchV1_1Client";
import { ReadFlaunchV1_2 } from "clients/FlaunchV1_2Client";
import { ReadWriteTreasuryManagerFactory } from "clients/TreasuryManagerFactoryClient";
import {
  ReadRevenueManager,
  ReadWriteRevenueManager,
} from "clients/RevenueManagerClient";
import { ReadInitialPrice } from "clients/InitialPriceClient";
import {
  ReadTreasuryManager,
  ReadWriteTreasuryManager,
} from "clients/TreasuryManagerClient";
import { UniversalRouterAbi } from "abi/UniversalRouter";
import {
  CallWithDescription,
  CoinMetadata,
  FlaunchVersion,
  LiquidityMode,
  Permissions,
  ImportMemecoinParams,
  GetAddLiquidityCallsParams,
  CalculateAddLiquidityAmountsParams,
  CheckSingleSidedAddLiquidityParams,
  SingleSidedLiquidityInfo,
  PoolWithHookData,
  GetSingleSidedCoinAddLiquidityCallsParams,
  ImportAndAddLiquidityParams,
  ImportAndSingleSidedCoinAddLiquidityParams,
  ImportAndSingleSidedCoinAddLiquidityWithMarketCap,
  ImportAndSingleSidedCoinAddLiquidityWithPrice,
  ImportAndAddLiquidityWithMarketCap,
  ImportAndAddLiquidityWithPrice,
  ImportAndAddLiquidityWithExactAmounts,
} from "types";
import {
  getPoolId,
  orderPoolKey,
  getValidTick,
  calculateUnderlyingTokenBalances,
  TickFinder,
  TICK_SPACING,
  getNearestUsableTick,
  priceRatioToTick,
  getSqrtPriceX96FromTick,
  Q96,
  Q192,
  getLiquidityFromAmounts,
  getAmountsForLiquidity,
} from "../utils/univ4";
import {
  buyMemecoin,
  sellMemecoinWithPermit2,
  getAmountWithSlippage,
  PermitSingle,
  getPermit2TypedData,
} from "utils/universalRouter";
import { resolveIPFS as defaultResolveIPFS } from "../helpers/ipfs";
import { getPermissionsAddress } from "helpers";
import { ReadMulticall } from "clients/MulticallClient";
import { MemecoinAbi, Permit2Abi } from "abi";
import { FLETHAbi } from "abi/FLETH";
import { ReadTrustedSignerFeeCalculator } from "clients/TrustedSignerFeeCalculatorClient";

type WatchPoolSwapParams = Omit<
  WatchPoolSwapParamsPositionManager<boolean>,
  "flETHIsCurrencyZero"
> & {
  filterByCoin?: Address;
};

// Generic swap log types that work across all position manager versions
type GenericBaseSwapLog = {
  timestamp: number;
  transactionHash: Hex;
  blockNumber: bigint;
  args: any;
};

type GenericBuySwapLog = GenericBaseSwapLog & {
  type: "BUY";
  delta: {
    coinsBought: bigint;
    flETHSold: bigint;
    fees: {
      isInFLETH: boolean;
      amount: bigint;
    };
  };
};

type GenericSellSwapLog = GenericBaseSwapLog & {
  type: "SELL";
  delta: {
    coinsSold: bigint;
    flETHBought: bigint;
    fees: {
      isInFLETH: boolean;
      amount: bigint;
    };
  };
};

type GenericPoolSwapLog =
  | GenericBuySwapLog
  | GenericSellSwapLog
  | GenericBaseSwapLog;

type BuyCoinBase = {
  coinAddress: Address;
  slippagePercent: number;
  referrer?: Address;
  intermediatePoolKey?: PoolWithHookData;
  permitSingle?: PermitSingle;
  signature?: Hex;
  hookData?: Hex; // for swaps when TrustedSigner is enabled
};

type BuyCoinExactInParams = BuyCoinBase & {
  swapType: "EXACT_IN";
  amountIn: bigint;
  amountOutMin?: bigint;
};

type BuyCoinExactOutParams = BuyCoinBase & {
  swapType: "EXACT_OUT";
  amountOut: bigint;
  amountInMax?: bigint;
};

type BuyCoinParams = BuyCoinExactInParams | BuyCoinExactOutParams;

type SellCoinParams = {
  coinAddress: Address;
  amountIn: bigint;
  slippagePercent: number;
  amountOutMin?: bigint;
  referrer?: Address;
  intermediatePoolKey?: PoolWithHookData;
  permitSingle?: PermitSingle;
  signature?: HexString;
};

/**
 * Base class for interacting with Flaunch protocol in read-only mode
 */
export class ReadFlaunchSDK {
  public readonly drift: Drift;
  public readonly chainId: number;
  public readonly publicClient: PublicClient | undefined;
  public readonly TICK_SPACING = TICK_SPACING;
  public readonly readPositionManager: ReadFlaunchPositionManager;
  public readonly readPositionManagerV1_1: ReadFlaunchPositionManagerV1_1;
  public readonly readAnyPositionManager: ReadAnyPositionManager;
  public readonly readTokenImporter: ReadTokenImporter;
  public readonly readFeeEscrow: ReadFeeEscrow;
  public readonly readReferralEscrow: ReadReferralEscrow;
  public readonly readFlaunchZap: ReadFlaunchZap;
  public readonly readPoolManager: ReadPoolManager;
  public readonly readStateView: ReadStateView;
  public readonly readFairLaunch: ReadFairLaunch;
  public readonly readFairLaunchV1_1: ReadFairLaunchV1_1;
  public readonly readBidWall: ReadBidWall;
  public readonly readAnyBidWall: AnyBidWall;
  public readonly readBidWallV1_1: ReadBidWallV1_1;
  public readonly readFlaunch: ReadFlaunch;
  public readonly readFlaunchV1_1: ReadFlaunchV1_1;
  public readonly readQuoter: ReadQuoter;
  public readonly readPermit2: ReadPermit2;

  // These properties will be initialized when the clients are available
  public readonly readPositionManagerV1_2: ReadFlaunchPositionManagerV1_2;
  // public readonly readFairLaunchV1_2: ReadFairLaunchV1_2;
  // public readonly readBidWallV1_2: ReadBidWallV1_2;
  public readonly readFlaunchV1_2: ReadFlaunchV1_2;
  // public readonly readAnyFlaunch: ReadAnyFlaunch;

  public resolveIPFS: (value: string) => string;

  constructor(
    chainId: number,
    drift: Drift = createDrift(),
    publicClient?: PublicClient
  ) {
    this.chainId = chainId;
    this.drift = drift;
    this.publicClient = publicClient;
    this.resolveIPFS = defaultResolveIPFS;
    this.readPositionManager = new ReadFlaunchPositionManager(
      FlaunchPositionManagerAddress[this.chainId],
      drift
    );
    this.readPositionManagerV1_1 = new ReadFlaunchPositionManagerV1_1(
      FlaunchPositionManagerV1_1Address[this.chainId],
      drift
    );
    this.readPositionManagerV1_2 = new ReadFlaunchPositionManagerV1_2(
      FlaunchPositionManagerV1_2Address[this.chainId],
      drift
    );
    this.readAnyPositionManager = new ReadAnyPositionManager(
      AnyPositionManagerAddress[this.chainId],
      drift
    );
    this.readTokenImporter = new ReadTokenImporter(
      this.chainId,
      TokenImporterAddress[this.chainId],
      drift
    );
    this.readFeeEscrow = new ReadFeeEscrow(
      FeeEscrowAddress[this.chainId],
      drift
    );
    this.readReferralEscrow = new ReadReferralEscrow(
      ReferralEscrowAddress[this.chainId],
      drift
    );
    this.readFlaunchZap = new ReadFlaunchZap(
      this.chainId,
      FlaunchZapAddress[this.chainId],
      drift
    );
    this.readPoolManager = new ReadPoolManager(
      PoolManagerAddress[this.chainId],
      drift
    );
    this.readStateView = new ReadStateView(
      StateViewAddress[this.chainId],
      drift
    );
    this.readFairLaunch = new ReadFairLaunch(
      FairLaunchAddress[this.chainId],
      drift
    );
    this.readFairLaunchV1_1 = new ReadFairLaunchV1_1(
      FairLaunchV1_1Address[this.chainId],
      drift
    );
    this.readBidWall = new ReadBidWall(BidWallAddress[this.chainId], drift);
    this.readBidWallV1_1 = new ReadBidWallV1_1(
      BidWallV1_1Address[this.chainId],
      drift
    );
    this.readAnyBidWall = new AnyBidWall(
      AnyBidWallAddress[this.chainId],
      drift
    );
    this.readFlaunch = new ReadFlaunch(FlaunchAddress[this.chainId], drift);
    this.readFlaunchV1_1 = new ReadFlaunchV1_1(
      FlaunchV1_1Address[this.chainId],
      drift
    );
    this.readFlaunchV1_2 = new ReadFlaunchV1_2(
      FlaunchV1_2Address[this.chainId],
      drift
    );
    this.readQuoter = new ReadQuoter(
      this.chainId,
      QuoterAddress[this.chainId],
      drift
    );
    this.readPermit2 = new ReadPermit2(Permit2Address[this.chainId], drift);
  }

  /**
   * Checks if a given coin address is a valid Flaunch coin (supports all versions)
   * @param coinAddress - The address of the coin to check
   * @returns Promise<boolean> - True if the coin is valid, false otherwise
   */
  async isValidCoin(coinAddress: Address) {
    return (
      (await this.readPositionManagerV1_2.isValidCoin(coinAddress)) ||
      (await this.readPositionManagerV1_1.isValidCoin(coinAddress)) ||
      (await this.readPositionManager.isValidCoin(coinAddress)) ||
      (await this.readAnyPositionManager.isValidCoin(coinAddress))
    );
  }

  /**
   * Determines the version of a Flaunch coin
   * @param coinAddress - The address of the coin to check
   * @returns Promise<FlaunchVersion> - The version of the coin
   */
  async getCoinVersion(coinAddress: Address): Promise<FlaunchVersion> {
    if (await this.readPositionManagerV1_2.isValidCoin(coinAddress)) {
      return FlaunchVersion.V1_2;
    } else if (await this.readPositionManagerV1_1.isValidCoin(coinAddress)) {
      return FlaunchVersion.V1_1;
    } else if (await this.readPositionManager.isValidCoin(coinAddress)) {
      return FlaunchVersion.V1;
    } else if (await this.readAnyPositionManager.isValidCoin(coinAddress)) {
      return FlaunchVersion.ANY;
    }

    throw new Error(`Unknown coin version for address: ${coinAddress}`);
  }

  // @note update FlaunchBackend as well when new version is added
  /**
   * Gets the position manager instance for a given version
   * @param version - The version to get the position manager instance for
   */
  getPositionManager(version: FlaunchVersion) {
    switch (version) {
      case FlaunchVersion.V1:
        return this.readPositionManager;
      case FlaunchVersion.V1_1:
        return this.readPositionManagerV1_1;
      case FlaunchVersion.V1_2:
        return this.readPositionManagerV1_2;
      case FlaunchVersion.ANY:
        return this.readAnyPositionManager;
      default:
        return this.readPositionManagerV1_2;
    }
  }

  /**
   * Gets the fair launch instance for a given version
   * @param version - The version to get the fair launch instance for
   */
  getFairLaunch(version: FlaunchVersion) {
    switch (version) {
      case FlaunchVersion.V1:
        return this.readFairLaunch;
      case FlaunchVersion.V1_1:
        return this.readFairLaunchV1_1;
      case FlaunchVersion.V1_2:
        return this.readFairLaunchV1_1;
      case FlaunchVersion.ANY:
        return this.readFairLaunchV1_1;
      default:
        return this.readFairLaunchV1_1;
    }
  }

  /**
   * Gets the bid wall instance for a given version
   * @param version - The version to get the bid wall instance for
   */
  getBidWall(version: FlaunchVersion) {
    switch (version) {
      case FlaunchVersion.V1:
        return this.readBidWall;
      case FlaunchVersion.V1_1:
        return this.readBidWallV1_1;
      case FlaunchVersion.V1_2:
        return this.readBidWallV1_1;
      case FlaunchVersion.ANY:
        return this.readAnyBidWall;
      default:
        return this.readBidWallV1_1;
    }
  }

  /**
   * Gets the flaunch contract address for a given version
   * @param version - The version to get the flaunch contract address for
   */
  getFlaunchAddress(version: FlaunchVersion) {
    switch (version) {
      case FlaunchVersion.V1:
        return this.readFlaunch.contract.address;
      case FlaunchVersion.V1_1:
        return this.readFlaunchV1_1.contract.address;
      case FlaunchVersion.V1_2:
        return this.readFlaunchV1_2.contract.address;
      case FlaunchVersion.ANY:
        return this.readFlaunchV1_1.contract.address;
      default:
        return this.readFlaunchV1_1.contract.address;
    }
  }

  getPositionManagerAddress(version: FlaunchVersion) {
    return this.getPositionManager(version).contract.address;
  }

  getFairLaunchAddress(version: FlaunchVersion) {
    return this.getFairLaunch(version).contract.address;
  }

  getBidWallAddress(version: FlaunchVersion) {
    return this.getBidWall(version).contract.address;
  }

  /**
   * Retrieves metadata for a given Flaunch coin
   * @param coinAddress - The address of the coin
   * @returns Promise<CoinMetadata & { symbol: string }> - The coin's metadata including name, symbol, description, and social links
   */
  async getCoinMetadata(
    coinAddress: Address
  ): Promise<CoinMetadata & { symbol: string }> {
    const memecoin = new ReadMemecoin(coinAddress, this.drift);
    const name = await memecoin.name();
    const symbol = await memecoin.symbol();
    const tokenURI = await memecoin.tokenURI();

    // get metadata from tokenURI
    const metadata = (await axios.get(this.resolveIPFS(tokenURI))).data;

    return {
      name,
      symbol,
      description: metadata.description ?? "",
      image: metadata.image ? this.resolveIPFS(metadata.image) : "",
      external_link: metadata.websiteUrl ?? "",
      collaborators: metadata.collaborators ?? [],
      discordUrl: metadata.discordUrl ?? "",
      twitterUrl: metadata.twitterUrl ?? "",
      telegramUrl: metadata.telegramUrl ?? "",
    };
  }

  /**
   * Retrieves metadata for a given Flaunch coin using its token ID & Flaunch contract address
   * @param flaunch - The address of the Flaunch contract
   * @param tokenId - The token ID of the coin
   * @returns The coin's metadata including name, symbol, description, and social links
   */
  async getCoinMetadataFromTokenId(
    flaunch: Address,
    tokenId: bigint
  ): Promise<CoinMetadata & { symbol: string }> {
    const _flaunch = new ReadFlaunch(flaunch, this.drift);
    const coinAddress = await _flaunch.memecoin(tokenId);
    return this.getCoinMetadata(coinAddress);
  }

  /**
   * Retrieves metadata for multiple Flaunch coins using their token IDs & Flaunch contract addresses
   * @param params - An array of objects containing flaunch contract address and token ID
   * @param batchSize - Optional, the number of ipfs requests to process in each batch
   * @param batchDelay - Optional, the delay in milliseconds between batches
   * @returns An array of objects containing coin address, name, symbol, description, and social links
   */
  async getCoinMetadataFromTokenIds(
    params: {
      flaunch: Address;
      tokenId: bigint;
    }[],
    batchSize: number = 9,
    batchDelay: number = 500
  ): Promise<
    {
      coinAddress: Address;
      name: string;
      symbol: string;
      description: any;
      image: string;
      external_link: any;
      collaborators: any;
      discordUrl: any;
      twitterUrl: any;
      telegramUrl: any;
    }[]
  > {
    const multicall = new ReadMulticall(this.drift);

    // get coin addresses via multicall
    const coinAddresses_calldata = params.map((p) =>
      this.readFlaunch.contract.encodeFunctionData("memecoin", {
        _tokenId: p.tokenId,
      })
    );
    const coinAddresses_result = await multicall.aggregate3(
      coinAddresses_calldata.map((calldata, i) => ({
        target: params[i].flaunch,
        callData: calldata,
      }))
    );
    const coinAddresses = coinAddresses_result.map((r) =>
      this.readFlaunch.contract.decodeFunctionReturn("memecoin", r.returnData)
    );

    /// get coin metadata for each coin address via multicall
    const coinMetadata_calldata: Hex[] = [];
    // name, symbol, tokenURI for each coin
    coinAddresses.forEach(() => {
      coinMetadata_calldata.push(
        this.drift.adapter.encodeFunctionData({
          abi: MemecoinAbi,
          fn: "name",
        })
      );
      coinMetadata_calldata.push(
        this.drift.adapter.encodeFunctionData({
          abi: MemecoinAbi,
          fn: "symbol",
        })
      );
      coinMetadata_calldata.push(
        this.drift.adapter.encodeFunctionData({
          abi: MemecoinAbi,
          fn: "tokenURI",
        })
      );
    });
    const coinMetadata_result = await multicall.aggregate3(
      coinMetadata_calldata.map((calldata, i) => ({
        target: coinAddresses[Math.floor(i / 3)],
        callData: calldata,
      }))
    );

    // First decode all the results
    const results = [];
    for (let i = 0; i < coinAddresses.length; i++) {
      const name = this.drift.adapter.decodeFunctionReturn({
        abi: MemecoinAbi,
        fn: "name",
        data: coinMetadata_result[i * 3].returnData,
      });
      const symbol = this.drift.adapter.decodeFunctionReturn({
        abi: MemecoinAbi,
        fn: "symbol",
        data: coinMetadata_result[i * 3 + 1].returnData,
      });
      const tokenURI = this.drift.adapter.decodeFunctionReturn({
        abi: MemecoinAbi,
        fn: "tokenURI",
        data: coinMetadata_result[i * 3 + 2].returnData,
      });

      results.push({ name, symbol, tokenURI, coinAddress: coinAddresses[i] });
    }

    // Process IPFS requests in batches to avoid rate limiting
    const processedResults = [];
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async ({ name, symbol, tokenURI, coinAddress }) => {
          const metadata = (await axios.get(this.resolveIPFS(tokenURI))).data;

          return {
            coinAddress,
            name,
            symbol,
            description: metadata.description ?? "",
            image: metadata.image ? this.resolveIPFS(metadata.image) : "",
            external_link: metadata.websiteUrl ?? "",
            collaborators: metadata.collaborators ?? [],
            discordUrl: metadata.discordUrl ?? "",
            twitterUrl: metadata.twitterUrl ?? "",
            telegramUrl: metadata.telegramUrl ?? "",
          };
        })
      );
      processedResults.push(...batchResults);

      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < results.length) {
        await new Promise((resolve) => setTimeout(resolve, batchDelay));
      }
    }

    return processedResults;
  }

  /**
   * Watches for pool creation events
   * @param params - Parameters for watching pool creation
   * @param version - Version of Flaunch to use (defaults to V1_1)
   * @returns Subscription to pool creation events
   */
  watchPoolCreated(
    params: WatchPoolCreatedParams,
    version: FlaunchVersion = FlaunchVersion.V1_1
  ) {
    return version === FlaunchVersion.V1
      ? this.readPositionManager.watchPoolCreated(params)
      : this.readPositionManagerV1_1.watchPoolCreated(params);
  }

  /**
   * Polls for current pool creation events
   * @param version - Version of Flaunch to use (defaults to V1_1)
   * @returns Current pool creation events or undefined if polling is not available
   */
  pollPoolCreatedNow(version: FlaunchVersion = FlaunchVersion.V1_1) {
    const positionManager =
      version === FlaunchVersion.V1
        ? this.readPositionManager
        : this.readPositionManagerV1_1;

    const poll = positionManager.pollPoolCreatedNow;
    if (!poll) {
      return undefined;
    }

    return poll();
  }

  /**
   * Watches for pool swap events
   * @param params - Parameters for watching pool swaps including optional coin filter
   * @param version - Version of Flaunch to use (defaults to V1_1)
   * @returns Subscription to pool swap events
   */
  async watchPoolSwap(
    params: WatchPoolSwapParams,
    version: FlaunchVersion = FlaunchVersion.V1_1
  ) {
    const positionManager =
      version === FlaunchVersion.V1
        ? this.readPositionManager
        : this.readPositionManagerV1_1;

    return positionManager.watchPoolSwap<boolean>({
      ...params,
      filterByPoolId: params.filterByCoin
        ? await this.poolId(params.filterByCoin, version)
        : undefined,
      flETHIsCurrencyZero: params.filterByCoin
        ? this.flETHIsCurrencyZero(params.filterByCoin)
        : undefined,
    });
  }

  /**
   * Polls for current pool swap events
   * @param version - Version of Flaunch to use (defaults to V1_1)
   * @returns Current pool swap events or undefined if polling is not available
   */
  pollPoolSwapNow(version: FlaunchVersion = FlaunchVersion.V1_1) {
    const positionManager =
      version === FlaunchVersion.V1
        ? this.readPositionManager
        : this.readPositionManagerV1_1;

    const poll = positionManager.pollPoolSwapNow;
    if (!poll) {
      return undefined;
    }

    return poll();
  }

  /**
   * Gets information about a liquidity position
   * @param params - Parameters for querying position info
   * @returns Position information from the state view contract
   */
  positionInfo(params: PositionInfoParams) {
    return this.readStateView.positionInfo(params);
  }

  /**
   * Gets the current tick for a given coin's pool
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use. If not provided, will be determined automatically
   * @returns Promise<number> - The current tick of the pool
   */
  async currentTick(coinAddress: Address, version?: FlaunchVersion) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    const poolId = await this.poolId(coinAddress, coinVersion);

    const poolState = await this.readStateView.poolSlot0({ poolId });
    return poolState.tick;
  }

  /**
   * Calculates the coin price in ETH based on the current tick
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use. If not provided, will be determined automatically
   * @returns Promise<string> - The price of the coin in ETH with 18 decimals precision
   */
  async coinPriceInETH(coinAddress: Address, version?: FlaunchVersion) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    const isFLETHZero = this.flETHIsCurrencyZero(coinAddress);
    const currentTick = await this.currentTick(coinAddress, coinVersion);

    const price = Math.pow(1.0001, currentTick);

    let ethPerCoin = 0;
    if (isFLETHZero) {
      ethPerCoin = 1 / price;
    } else {
      ethPerCoin = price;
    }

    return ethPerCoin.toFixed(18);
  }

  /**
   * Calculates the coin price in USD based on the current ETH/USDC price
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use. If not provided, will be determined automatically
   * @returns Promise<string> - The price of the coin in USD with 18 decimal precision
   */
  async coinPriceInUSD({
    coinAddress,
    version,
    drift,
  }: {
    coinAddress: Address;
    version?: FlaunchVersion;
    drift?: Drift;
  }) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    const ethPerCoin = await this.coinPriceInETH(coinAddress, coinVersion);
    const ethPrice = await this.getETHUSDCPrice(drift);
    return (parseFloat(ethPerCoin) * ethPrice).toFixed(18);
  }

  async coinMarketCapInUSD({
    coinAddress,
    version,
    drift,
  }: {
    coinAddress: Address;
    version?: FlaunchVersion;
    drift?: Drift;
  }) {
    const totalSupply = 100_000_000_000; // 100 Billion tokens
    const priceInUSD = await this.coinPriceInUSD({
      coinAddress,
      version,
      drift,
    });
    return (parseFloat(priceInUSD) * totalSupply).toFixed(2);
  }

  /**
   * Gets the current ETH/USDC price
   * @param drift - Optional drift instance to get price from Base Mainnet
   * @returns Promise<number> - The current ETH/USDC price
   */
  async getETHUSDCPrice(drift?: Drift) {
    if (drift) {
      const chainId = await drift.getChainId();
      const quoter = new ReadQuoter(chainId, QuoterAddress[chainId], drift);
      return quoter.getETHUSDCPrice();
    }

    return this.readQuoter.getETHUSDCPrice();
  }

  async initialSqrtPriceX96(params: {
    coinAddress: Address;
    initialMarketCapUSD: number;
  }) {
    const initialMCapInUSDCWei = parseUnits(
      params.initialMarketCapUSD.toString(),
      6
    );
    const initialPriceParams = encodeAbiParameters(
      [
        {
          type: "uint256",
        },
      ],
      [initialMCapInUSDCWei]
    );
    const isFLETHZero = this.flETHIsCurrencyZero(params.coinAddress);

    const initialPrice = new ReadInitialPrice(
      await this.readPositionManagerV1_1.initialPrice(),
      this.drift
    );

    return initialPrice.getSqrtPriceX96({
      isFLETHZero,
      initialPriceParams,
    });
  }

  /**
   * Gets information about a fair launch for a given coin
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use. If not provided, will be determined automatically
   * @returns Fair launch information from the appropriate contract version
   */
  async fairLaunchInfo(coinAddress: Address, version?: FlaunchVersion) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    const poolId = await this.poolId(coinAddress, coinVersion);
    return this.getFairLaunch(coinVersion).fairLaunchInfo({ poolId });
  }

  /**
   * Checks if a fair launch is currently active for a given coin
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use. If not provided, will be determined automatically
   * @returns Promise<boolean> - True if fair launch is active, false otherwise
   */
  async isFairLaunchActive(coinAddress: Address, version?: FlaunchVersion) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    const poolId = await this.poolId(coinAddress, coinVersion);
    return this.getFairLaunch(coinVersion).isFairLaunchActive({ poolId });
  }

  async trustedPoolKeySignerStatus(
    coinAddress: Address,
    version?: FlaunchVersion
  ): Promise<{
    isCurrentlyEnabled: boolean;
    trustedSignerEnabled: boolean;
    signer: Address;
    fairLaunchStartsAt: number;
    fairLaunchEndsAt: number;
    isFairLaunchActive: boolean;
  }> {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);
    if (coinVersion === FlaunchVersion.ANY) {
      throw new Error("AnyPositionManager is not supported for TrustedSigner");
    }

    // TrustedSigner fee calculator is only active during fair launch
    const fairLaunchInfo = await this.fairLaunchInfo(coinAddress, coinVersion);

    // determine fair launch status
    let isFairLaunchActive: boolean;
    if (fairLaunchInfo.closed) {
      isFairLaunchActive = false;
    }
    if (new Date().getTime() / 1000 > fairLaunchInfo.endsAt) {
      isFairLaunchActive = false;
    }
    isFairLaunchActive = true;

    const baseReturn = {
      isFairLaunchActive,
      fairLaunchStartsAt: Number(fairLaunchInfo.startsAt),
      fairLaunchEndsAt: Number(fairLaunchInfo.endsAt),
    };

    const fairLaunchFeeCalculator = await (
      this.getPositionManager(coinVersion) as ReadFlaunchPositionManagerV1_2
    ).getFeeCalculator({ forFairLaunch: true });

    try {
      const trustedSignerFeeCalculator = new ReadTrustedSignerFeeCalculator(
        fairLaunchFeeCalculator,
        this.drift
      );

      const poolId = await this.poolId(coinAddress, coinVersion);
      const trustedSigner =
        await trustedSignerFeeCalculator.trustedPoolKeySigner({ poolId });

      return {
        isCurrentlyEnabled: trustedSigner.enabled && isFairLaunchActive,
        trustedSignerEnabled: trustedSigner.enabled,
        signer: trustedSigner.signer,
        ...baseReturn,
      };
    } catch {
      // might throw error in the future if the fair launch calculator is not the TrustedSignerFeeCalculator
      return {
        isCurrentlyEnabled: false,
        trustedSignerEnabled: false,
        signer: zeroAddress,
        ...baseReturn,
      };
    }
  }

  /**
   * Gets the duration of a fair launch for a given coin
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use. If not provided, will be determined automatically
   * @returns Promise<number> - The duration in seconds (30 minutes for V1, variable for V1.1)
   */
  async fairLaunchDuration(coinAddress: Address, version?: FlaunchVersion) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    const poolId = await this.poolId(coinAddress, coinVersion);
    return this.getFairLaunch(coinVersion).fairLaunchDuration({ poolId });
  }

  /**
   * Gets the initial tick for a fair launch
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use. If not provided, will be determined automatically
   * @returns Promise<number> - The initial tick value
   */
  async initialTick(coinAddress: Address, version?: FlaunchVersion) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    const poolId = await this.poolId(coinAddress, coinVersion);

    const fairLaunchInfo = await this.getFairLaunch(coinVersion).fairLaunchInfo(
      { poolId }
    );
    return fairLaunchInfo.initialTick;
  }

  /**
   * Gets information about the ETH-only position in a fair launch
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use. If not provided, will be determined automatically
   * @returns Promise<{flETHAmount: bigint, coinAmount: bigint, tickLower: number, tickUpper: number}> - Position details
   */
  async fairLaunchETHOnlyPosition(
    coinAddress: Address,
    version?: FlaunchVersion
  ) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    const poolId = await this.poolId(coinAddress, coinVersion);
    const initialTick = await this.initialTick(coinAddress, coinVersion);
    const currentTick = await this.currentTick(coinAddress, coinVersion);
    const isFLETHZero = this.flETHIsCurrencyZero(coinAddress);

    let tickLower: number;
    let tickUpper: number;

    if (isFLETHZero) {
      tickLower = getValidTick({
        tick: initialTick + 1,
        roundDown: false,
        tickSpacing: this.TICK_SPACING,
      });
      tickUpper = tickLower + this.TICK_SPACING;
    } else {
      tickUpper = getValidTick({
        tick: initialTick - 1,
        roundDown: true,
        tickSpacing: this.TICK_SPACING,
      });
      tickLower = tickUpper - this.TICK_SPACING;
    }

    const { liquidity } = await this.readStateView.positionInfo({
      poolId,
      owner: this.getFairLaunchAddress(coinVersion),
      tickLower,
      tickUpper,
      salt: "",
    });

    const { amount0, amount1 } = calculateUnderlyingTokenBalances(
      liquidity,
      tickLower,
      tickUpper,
      currentTick
    );

    const [flETHAmount, coinAmount] = isFLETHZero
      ? [amount0, amount1]
      : [amount1, amount0];

    return {
      flETHAmount,
      coinAmount,
      tickLower,
      tickUpper,
    };
  }

  /**
   * Gets information about the coin-only position in a fair launch
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use. If not provided, will be determined automatically
   * @returns Promise<{flETHAmount: bigint, coinAmount: bigint, tickLower: number, tickUpper: number}> - Position details
   */
  async fairLaunchCoinOnlyPosition(
    coinAddress: Address,
    version?: FlaunchVersion
  ) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    const poolId = await this.poolId(coinAddress, coinVersion);
    const initialTick = await this.initialTick(coinAddress, coinVersion);
    const currentTick = await this.currentTick(coinAddress, coinVersion);
    const isFLETHZero = this.flETHIsCurrencyZero(coinAddress);

    let tickLower: number;
    let tickUpper: number;

    if (isFLETHZero) {
      tickLower = TickFinder.MIN_TICK;
      tickUpper = getValidTick({
        tick: initialTick - 1,
        roundDown: true,
        tickSpacing: this.TICK_SPACING,
      });
    } else {
      tickLower = getValidTick({
        tick: initialTick + 1,
        roundDown: false,
        tickSpacing: this.TICK_SPACING,
      });
      tickUpper = TickFinder.MAX_TICK;
    }

    const { liquidity } = await this.readStateView.positionInfo({
      poolId,
      owner: this.getFairLaunchAddress(coinVersion),
      tickLower,
      tickUpper,
      salt: "",
    });

    const { amount0, amount1 } = calculateUnderlyingTokenBalances(
      liquidity,
      tickLower,
      tickUpper,
      currentTick
    );

    const [flETHAmount, coinAmount] = isFLETHZero
      ? [amount0, amount1]
      : [amount1, amount0];

    return {
      flETHAmount,
      coinAmount,
      tickLower,
      tickUpper,
    };
  }

  /**
   * Gets information about the bid wall position for a coin
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use. If not provided, will be determined automatically
   * @returns Promise<{flETHAmount: bigint, coinAmount: bigint, pendingEth: bigint, tickLower: number, tickUpper: number}> - Bid wall position details
   */
  async bidWallPosition(coinAddress: Address, version?: FlaunchVersion) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    const poolId = await this.poolId(coinAddress, coinVersion);
    const isFLETHZero = this.flETHIsCurrencyZero(coinAddress);

    const {
      amount0_: amount0,
      amount1_: amount1,
      pendingEth_: pendingEth,
    } = await this.getBidWall(coinVersion).position({ poolId });
    const { tickLower, tickUpper } = await this.getBidWall(
      coinVersion
    ).poolInfo({ poolId });

    const [flETHAmount, coinAmount] = isFLETHZero
      ? [amount0, amount1]
      : [amount1, amount0];

    return {
      flETHAmount,
      coinAmount,
      pendingEth,
      tickLower,
      tickUpper,
    };
  }

  /**
   * Gets the ETH balance for the creator to claim
   * @param creator - The address of the creator to check
   * @param isV1 - Optional boolean to check the balance for V1. V1.1 & AnyPositionManager use the same FeeEscrow contract
   * @returns The balance of the creator
   */
  creatorRevenue(creator: Address, isV1?: boolean) {
    if (isV1) {
      return this.readPositionManager.creatorBalance(creator);
    } else {
      return this.readFeeEscrow.balances(creator);
    }
  }

  /**
   * Gets the balance of a recipient for a given coin
   * @param recipient - The address of the recipient to check
   * @param coinAddress - The address of the coin
   * @returns Promise<bigint> - The balance of the recipient
   */
  referralBalance(recipient: Address, coinAddress: Address) {
    return this.readReferralEscrow.allocations(recipient, coinAddress);
  }

  /**
   * Gets the claimable balance of ETH for the recipient from a revenue manager
   * @param params - Parameters for checking the balance
   * @param params.revenueManagerAddress - The address of the revenue manager
   * @param params.recipient - The address of the recipient to check
   * @returns Promise<bigint> - The claimable balance of ETH
   */
  revenueManagerBalance(params: {
    revenueManagerAddress: Address;
    recipient: Address;
  }) {
    const readRevenueManager = new ReadRevenueManager(
      params.revenueManagerAddress,
      this.drift
    );
    return readRevenueManager.balances(params.recipient);
  }

  /**
   * Gets the claimable balance of ETH for the protocol from a revenue manager
   * @param revenueManagerAddress - The address of the revenue manager
   * @returns Promise<bigint> - The claimable balance of ETH
   */
  async revenueManagerProtocolBalance(revenueManagerAddress: Address) {
    const readRevenueManager = new ReadRevenueManager(
      revenueManagerAddress,
      this.drift
    );
    const protocolRecipient = await readRevenueManager.protocolRecipient();
    return readRevenueManager.balances(protocolRecipient);
  }

  /**
   * Gets the total number of tokens managed by a revenue manager
   * @param revenueManagerAddress - The address of the revenue manager
   * @returns Promise<bigint> - The total count of tokens
   */
  async revenueManagerTokensCount(revenueManagerAddress: Address) {
    const readRevenueManager = new ReadRevenueManager(
      revenueManagerAddress,
      this.drift
    );
    return readRevenueManager.tokensCount();
  }

  /**
   * Gets all tokens created by a specific creator address
   * @param params - Parameters for querying tokens by creator
   * @param params.revenueManagerAddress - The address of the revenue manager
   * @param params.creator - The address of the creator to query tokens for
   * @param params.sortByDesc - Whether to sort the tokens by descending order
   * @returns Promise<Array<{flaunch: Address, tokenId: bigint}>> - Array of token objects containing flaunch address and token ID
   */
  async revenueManagerAllTokensByCreator(params: {
    revenueManagerAddress: Address;
    creator: Address;
    sortByDesc?: boolean;
  }) {
    const readRevenueManager = new ReadRevenueManager(
      params.revenueManagerAddress,
      this.drift
    );
    return readRevenueManager.allTokensByCreator(
      params.creator,
      params.sortByDesc
    );
  }

  /**
   * Gets all tokens currently managed by a revenue manager
   * @param params - Parameters for querying tokens in manager
   * @param params.revenueManagerAddress - The address of the revenue manager
   * @param params.sortByDesc - Optional boolean to sort tokens in descending order (default: false)
   * @returns Promise<Array<{flaunch: Address, tokenId: bigint}>> - Array of token objects containing flaunch address and token ID
   */
  async revenueManagerAllTokensInManager(params: {
    revenueManagerAddress: Address;
    sortByDesc?: boolean;
  }) {
    const readRevenueManager = new ReadRevenueManager(
      params.revenueManagerAddress,
      this.drift
    );
    return readRevenueManager.allTokensInManager(params.sortByDesc);
  }

  /**
   * Gets treasury manager information including owner and permissions
   * @param treasuryManagerAddress - The address of the treasury manager
   * @returns Promise<{managerOwner: Address, permissions: Address}> - Treasury manager owner and permissions contract addresses
   */
  async treasuryManagerInfo(treasuryManagerAddress: Address) {
    const readTreasuryManager = new ReadTreasuryManager(
      treasuryManagerAddress,
      this.drift
    );

    const [managerOwner, permissions] = await Promise.all([
      readTreasuryManager.managerOwner(),
      readTreasuryManager.permissions(),
    ]);

    return {
      managerOwner,
      permissions,
    };
  }

  /**
   * Gets the pool ID for a given coin
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use
   * @returns Promise<string> - The pool ID
   */
  async poolId(coinAddress: Address, version?: FlaunchVersion) {
    let hookAddress: Address;

    const coinVersion = await this.determineCoinVersion(coinAddress, version);
    hookAddress = this.getPositionManagerAddress(coinVersion);

    return getPoolId(
      orderPoolKey({
        currency0: FLETHAddress[this.chainId],
        currency1: coinAddress,
        fee: 0,
        tickSpacing: 60,
        hooks: hookAddress,
      })
    );
  }

  /**
   * Gets the flaunching fee for a given initial price and slippage percent
   * @param params.sender - The address of the sender
   * @param params.initialMarketCapUSD - The initial market cap in USD
   * @param params.slippagePercent - The slippage percent
   * @returns Promise<bigint> - The flaunching fee
   */
  getFlaunchingFee(params: {
    sender: Address;
    initialMarketCapUSD: number;
    slippagePercent?: number;
  }) {
    const initialMCapInUSDCWei = parseUnits(
      params.initialMarketCapUSD.toString(),
      6
    );
    const initialPriceParams = encodeAbiParameters(
      [
        {
          type: "uint256",
        },
      ],
      [initialMCapInUSDCWei]
    );

    return this.readPositionManagerV1_1.getFlaunchingFee({
      sender: params.sender,
      initialPriceParams,
      slippagePercent: params.slippagePercent,
    });
  }

  /**
   * Calculates the ETH required to flaunch a token, takes into account the ETH for premine and the flaunching fee
   * @param params.premineAmount - The amount of coins to be premined
   * @param params.initialMarketCapUSD - The initial market cap in USD
   * @param params.slippagePercent - The slippage percent
   * @returns Promise<bigint> - The ETH required to flaunch
   */
  ethRequiredToFlaunch(params: {
    premineAmount: bigint;
    initialMarketCapUSD: number;
    slippagePercent?: number;
  }) {
    const initialMCapInUSDCWei = parseUnits(
      params.initialMarketCapUSD.toString(),
      6
    );
    const initialPriceParams = encodeAbiParameters(
      [
        {
          type: "uint256",
        },
      ],
      [initialMCapInUSDCWei]
    );

    return this.readFlaunchZap.ethRequiredToFlaunch({
      premineAmount: params.premineAmount,
      initialPriceParams,
      slippagePercent: params.slippagePercent,
    });
  }

  /**
   * Gets a quote for selling an exact amount of tokens for ETH
   * @param coinAddress - The address of the token to sell
   * @param version - Optional specify Flaunch version, if not provided, will determine automatically
   * @param amountIn - The exact amount of tokens to sell
   * @param intermediatePoolKey - Optional intermediate pool key to use containing outputToken and ETH as currencies
   * @returns Promise<bigint> - The expected amount of ETH to receive
   */
  async getSellQuoteExactInput({
    coinAddress,
    version,
    amountIn,
    intermediatePoolKey,
  }: {
    coinAddress: Address;
    version?: FlaunchVersion;
    amountIn: bigint;
    intermediatePoolKey?: PoolWithHookData;
  }) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    return this.readQuoter.getSellQuoteExactInput({
      coinAddress,
      amountIn,
      positionManagerAddress: this.getPositionManagerAddress(coinVersion),
      intermediatePoolKey,
    });
  }

  /**
   * Gets a quote for buying tokens with an exact amount of ETH or inputToken
   * @param coinAddress - The address of the token to buy
   * @param version - Optional specify Flaunch version, if not provided, will determine automatically
   * @param amountIn - The exact amount of ETH or inputToken to spend
   * @param intermediatePoolKey - Optional intermediate pool key to use containing inputToken and ETH as currencies
   * @param hookData - Optional hook data to use for the fleth <> coin swap. Only used when TrustedSigner is currently enabled
   * @param userWallet - Optional user wallet to use for the swap. Only used when TrustedSigner is currently enabled
   * @returns Promise<bigint> - The expected amount of coins to receive
   */
  async getBuyQuoteExactInput({
    coinAddress,
    version,
    amountIn,
    intermediatePoolKey,
    hookData,
    userWallet,
  }: {
    coinAddress: Address;
    version?: FlaunchVersion;
    amountIn: bigint;
    intermediatePoolKey?: PoolWithHookData;
    hookData?: Hex;
    userWallet?: Address;
  }) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    return this.readQuoter.getBuyQuoteExactInput({
      coinAddress,
      amountIn,
      positionManagerAddress: this.getPositionManagerAddress(coinVersion),
      intermediatePoolKey,
      hookData,
      userWallet,
    });
  }

  /**
   * Gets a quote for buying an exact amount of tokens with ETH or inputToken
   * @param coinAddress - The address of the token to buy
   * @param version - Optional specify Flaunch version, if not provided, will determine automatically
   * @param coinOut - The exact amount of tokens to receive
   * @param intermediatePoolKey - Optional intermediate pool key to use containing inputToken and ETH as currencies
   * @param hookData - Optional hook data to use for the fleth <> coin swap. Only used when TrustedSigner is currently enabled
   * @param userWallet - Optional user wallet to use for the swap. Only used when TrustedSigner is currently enabled
   * @returns Promise<bigint> - The required amount of ETH or inputToken to spend
   */
  async getBuyQuoteExactOutput({
    coinAddress,
    amountOut,
    version,
    intermediatePoolKey,
    hookData,
    userWallet,
  }: {
    coinAddress: Address;
    amountOut: bigint;
    version?: FlaunchVersion;
    intermediatePoolKey?: PoolWithHookData;
    hookData?: Hex;
    userWallet?: Address;
  }) {
    const coinVersion = await this.determineCoinVersion(coinAddress, version);

    return this.readQuoter.getBuyQuoteExactOutput({
      coinAddress,
      coinOut: amountOut,
      positionManagerAddress: this.getPositionManagerAddress(coinVersion),
      intermediatePoolKey,
      hookData,
      userWallet,
    });
  }

  /**
   * Determines if flETH is currency0 in the pool
   * @param coinAddress - The address of the coin
   * @returns boolean - True if flETH is currency0, false otherwise
   */
  flETHIsCurrencyZero(coinAddress: Address) {
    return coinAddress > FLETHAddress[this.chainId];
  }

  /**
   * Sets a custom IPFS resolver function
   * @dev this is used to resolve IPFS hash to a gateway URL
   * eg: input: Qabc, output: https://ipfs.io/ipfs/Qabc
   * @param resolverFn - Custom function to resolve IPFS URIs
   */
  setIPFSResolver(resolverFn: (ipfsHash: string) => string): void {
    this.resolveIPFS = resolverFn;
  }

  /**
   * Parses a transaction hash to extract PoolSwap events and return parsed swap data
   * @param params - Object containing parsing parameters
   * @param params.txHash - The transaction hash to parse
   * @param params.version - The Flaunch version to use for parsing
   * @param params.flETHIsCurrencyZero - Whether flETH is currency 0 in the pool (optional)
   * @returns Parsed swap log or undefined if no PoolSwap event found.
   *          If flETHIsCurrencyZero is provided, returns typed swap data with BUY/SELL information.
   *          If flETHIsCurrencyZero is undefined, returns basic swap log without parsed delta.
   */
  async parseSwapTx<T extends boolean | undefined = undefined>(params: {
    txHash: Hex;
    version: FlaunchVersion;
    flETHIsCurrencyZero?: T;
  }): Promise<
    T extends boolean
      ? GenericBuySwapLog | GenericSellSwapLog | undefined
      : GenericBaseSwapLog | undefined
  > {
    const positionManager = this.getPositionManager(params.version);
    return positionManager.parseSwapTx(
      params.txHash,
      params.flETHIsCurrencyZero
    ) as any;
  }

  /**
   * Verifies if a memecoin is valid for importing
   * @param memecoin - The address of the memecoin to import
   * @returns Promise<{ isValid: boolean; verifier: Address }> - The result of the verification
   */
  tokenImporterVerifyMemecoin(memecoin: Address) {
    return this.readTokenImporter.verifyMemecoin(memecoin);
  }

  /**
   * Gets basic coin information (total supply and decimals)
   */
  async getCoinInfo(coinAddress: Address): Promise<{
    totalSupply: bigint;
    decimals: number;
    formattedTotalSupplyInDecimals: number;
  }> {
    const memecoin = new ReadMemecoin(coinAddress, this.drift);
    const [totalSupply, decimals] = await Promise.all([
      memecoin.totalSupply(),
      memecoin.decimals(),
    ]);
    const formattedTotalSupplyInDecimals = parseFloat(
      formatUnits(totalSupply, decimals)
    );
    return { totalSupply, decimals, formattedTotalSupplyInDecimals };
  }

  /**
   * Gets market context information needed for tick calculations
   */
  async getMarketContext(
    coinAddress: Address,
    coinDecimals: number
  ): Promise<{
    ethUsdPrice: number;
    isFlethZero: boolean;
    decimals0: number;
    decimals1: number;
  }> {
    const ethUsdPrice = await this.getETHUSDCPrice();
    const isFlethZero = this.flETHIsCurrencyZero(coinAddress);
    const flETHDecimals = 18; // flETH has 18 decimals

    // Determine decimals based on token ordering
    const decimals0 = isFlethZero ? flETHDecimals : coinDecimals;
    const decimals1 = isFlethZero ? coinDecimals : flETHDecimals;

    return {
      ethUsdPrice,
      isFlethZero,
      decimals0,
      decimals1,
    };
  }

  /**
   * Converts market cap in USD to token price in ETH
   */
  marketCapToTokenPriceEth(
    marketCapUsd: number,
    formattedTotalSupplyInDecimals: number,
    ethUsdPrice: number
  ): number {
    const tokenPriceUsd = marketCapUsd / formattedTotalSupplyInDecimals;
    return tokenPriceUsd / ethUsdPrice;
  }

  /**
   * Converts token price in ETH to tick
   */
  convertPriceToTick(
    priceEth: number,
    isFlethZero: boolean,
    decimals0: number,
    decimals1: number
  ): number {
    return priceRatioToTick({
      priceInput: priceEth.toString(),
      isDirection1Per0: !isFlethZero,
      decimals0,
      decimals1,
      spacing: TICK_SPACING,
    });
  }

  /**
   * Calculates current tick from market cap if provided
   */
  calculateCurrentTickFromMarketCap(
    currentMarketCap: string | undefined,
    formattedTotalSupplyInDecimals: number,
    marketContext: {
      ethUsdPrice: number;
      isFlethZero: boolean;
      decimals0: number;
      decimals1: number;
    }
  ): number | undefined {
    if (!currentMarketCap) {
      return undefined;
    }

    const currentMarketCapNum = parseFloat(currentMarketCap);
    const currentTokenPriceEth = this.marketCapToTokenPriceEth(
      currentMarketCapNum,
      formattedTotalSupplyInDecimals,
      marketContext.ethUsdPrice
    );

    return this.convertPriceToTick(
      currentTokenPriceEth,
      marketContext.isFlethZero,
      marketContext.decimals0,
      marketContext.decimals1
    );
  }

  async calculateAddLiquidityTicks({
    coinAddress,
    liquidityMode,
    minMarketCap,
    maxMarketCap,
    currentMarketCap,
  }: {
    coinAddress: Address;
    liquidityMode: LiquidityMode;
    minMarketCap: string;
    maxMarketCap: string;
    currentMarketCap?: string;
  }): Promise<{
    tickLower: number;
    tickUpper: number;
    currentTick?: number;
    coinTotalSupply: bigint;
    coinDecimals: number;
  }> {
    // Get coin information
    const {
      totalSupply: coinTotalSupply,
      decimals: coinDecimals,
      formattedTotalSupplyInDecimals,
    } = await this.getCoinInfo(coinAddress);

    if (liquidityMode === LiquidityMode.FULL_RANGE) {
      let currentTick: number | undefined;

      if (currentMarketCap) {
        const marketContext = await this.getMarketContext(
          coinAddress,
          coinDecimals
        );
        currentTick = this.calculateCurrentTickFromMarketCap(
          currentMarketCap,
          formattedTotalSupplyInDecimals,
          marketContext
        );
      }

      return {
        tickLower: getNearestUsableTick({
          tick: TickFinder.MIN_TICK,
          tickSpacing: TICK_SPACING,
        }),
        tickUpper: getNearestUsableTick({
          tick: TickFinder.MAX_TICK,
          tickSpacing: TICK_SPACING,
        }),
        currentTick,
        coinTotalSupply,
        coinDecimals,
      };
    } else {
      // Get market context
      const marketContext = await this.getMarketContext(
        coinAddress,
        coinDecimals
      );

      const minMarketCapNum = parseFloat(minMarketCap);
      const maxMarketCapNum = parseFloat(maxMarketCap);

      if (
        minMarketCapNum <= 0 ||
        maxMarketCapNum <= 0 ||
        minMarketCapNum >= maxMarketCapNum
      ) {
        throw new Error(
          "[ReadFlaunchSDK.addLiquidityCalculateTicks]: Invalid market cap range"
        );
      }

      // Convert market caps to token prices in ETH
      const minTokenPriceEth = this.marketCapToTokenPriceEth(
        minMarketCapNum,
        formattedTotalSupplyInDecimals,
        marketContext.ethUsdPrice
      );
      const maxTokenPriceEth = this.marketCapToTokenPriceEth(
        maxMarketCapNum,
        formattedTotalSupplyInDecimals,
        marketContext.ethUsdPrice
      );

      // Convert to ticks
      const minTick = this.convertPriceToTick(
        minTokenPriceEth,
        marketContext.isFlethZero,
        marketContext.decimals0,
        marketContext.decimals1
      );
      const maxTick = this.convertPriceToTick(
        maxTokenPriceEth,
        marketContext.isFlethZero,
        marketContext.decimals0,
        marketContext.decimals1
      );

      // Calculate current tick if provided
      const currentTick = this.calculateCurrentTickFromMarketCap(
        currentMarketCap,
        formattedTotalSupplyInDecimals,
        marketContext
      );

      return {
        tickLower: Math.min(minTick, maxTick),
        tickUpper: Math.max(minTick, maxTick),
        currentTick,
        coinTotalSupply,
        coinDecimals,
      };
    }
  }

  async checkSingleSidedAddLiquidity(
    params: CheckSingleSidedAddLiquidityParams
  ): Promise<SingleSidedLiquidityInfo> {
    const { coinAddress, liquidityMode } = params;

    let minMarketCap: string;
    let maxMarketCap: string;
    let currentMarketCap: string | undefined;

    if ("minMarketCap" in params) {
      minMarketCap = params.minMarketCap;
      maxMarketCap = params.maxMarketCap;
      currentMarketCap = params.currentMarketCap;
    } else {
      const { formattedTotalSupplyInDecimals } = await this.getCoinInfo(
        coinAddress
      );

      minMarketCap = (
        parseFloat(params.minPriceUSD) * formattedTotalSupplyInDecimals
      ).toString();
      maxMarketCap = (
        parseFloat(params.maxPriceUSD) * formattedTotalSupplyInDecimals
      ).toString();

      if (params.currentPriceUSD) {
        currentMarketCap = (
          params.currentPriceUSD * formattedTotalSupplyInDecimals
        ).toString();
      }
    }

    let { tickLower, tickUpper, currentTick } =
      await this.calculateAddLiquidityTicks({
        coinAddress,
        liquidityMode,
        minMarketCap,
        maxMarketCap,
        currentMarketCap,
      });

    // If no current tick is provided from the above calculation, get it from the pool state
    if (!currentTick) {
      const version = await this.determineCoinVersion(
        coinAddress,
        params.version
      );

      const poolState = await this.readStateView.poolSlot0({
        poolId: getPoolId(this.createPoolKey(coinAddress, version)),
      });
      currentTick = poolState.tick;
    }

    // Determine currency ordering
    const isFlETHCurrency0 = this.flETHIsCurrencyZero(coinAddress);

    // Check if position is single-sided
    const isSingleSided = currentTick <= tickLower || currentTick >= tickUpper;

    if (!isSingleSided) {
      return {
        isSingleSided: false,
        shouldHideCoinInput: false,
        shouldHideETHInput: false,
      };
    }

    // Determine which input should be hidden based on current price position
    let shouldHideCoinInput = false;
    let shouldHideETHInput = false;

    if (currentTick <= tickLower) {
      // Current price is below the range - only the lower currency (currency0) is needed
      if (isFlETHCurrency0) {
        // flETH is currency0, so we need only flETH (ETH)
        shouldHideCoinInput = true;
      } else {
        // Coin is currency0, so we need only coin
        shouldHideETHInput = true;
      }
    } else if (currentTick >= tickUpper) {
      // Current price is above the range - only the upper currency (currency1) is needed
      if (isFlETHCurrency0) {
        // flETH is currency0, so coin is currency1 and we need only coin
        shouldHideETHInput = true;
      } else {
        // Coin is currency0, so flETH is currency1 and we need only flETH (ETH)
        shouldHideCoinInput = true;
      }
    }

    return {
      isSingleSided: true,
      shouldHideCoinInput,
      shouldHideETHInput,
    };
  }

  async calculateAddLiquidityAmounts(
    params: CalculateAddLiquidityAmountsParams
  ): Promise<{
    coinAmount: bigint;
    ethAmount: bigint;
    tickLower: number;
    tickUpper: number;
    currentTick: number;
  }> {
    const { coinAddress, liquidityMode, inputToken, coinOrEthInputAmount } =
      params;

    let minMarketCap: string;
    let maxMarketCap: string;
    let currentMarketCap: string | undefined;

    if ("minMarketCap" in params) {
      minMarketCap = params.minMarketCap;
      maxMarketCap = params.maxMarketCap;
      currentMarketCap = params.currentMarketCap;
    } else {
      const { formattedTotalSupplyInDecimals } = await this.getCoinInfo(
        coinAddress
      );

      minMarketCap = (
        parseFloat(params.minPriceUSD) * formattedTotalSupplyInDecimals
      ).toString();
      maxMarketCap = (
        parseFloat(params.maxPriceUSD) * formattedTotalSupplyInDecimals
      ).toString();

      if (params.currentPriceUSD) {
        currentMarketCap = (
          params.currentPriceUSD * formattedTotalSupplyInDecimals
        ).toString();
      }
    }

    let { tickLower, tickUpper, currentTick } =
      await this.calculateAddLiquidityTicks({
        coinAddress,
        liquidityMode,
        minMarketCap,
        maxMarketCap,
        currentMarketCap,
      });

    // get the current pool state for the coin
    if (!currentTick) {
      const version = await this.determineCoinVersion(
        coinAddress,
        params.version
      );

      const poolState = await this.readStateView.poolSlot0({
        poolId: getPoolId(this.createPoolKey(coinAddress, version)),
      });
      currentTick = poolState.tick;
    }

    // Determine currency ordering
    const isFlETHCurrency0 = this.flETHIsCurrencyZero(coinAddress);

    try {
      const sqrtRatioCurrentX96 = getSqrtPriceX96FromTick(currentTick);
      let sqrtRatioLowerX96 = getSqrtPriceX96FromTick(tickLower);
      let sqrtRatioUpperX96 = getSqrtPriceX96FromTick(tickUpper);

      if (sqrtRatioLowerX96 > sqrtRatioUpperX96) {
        [sqrtRatioLowerX96, sqrtRatioUpperX96] = [
          sqrtRatioUpperX96,
          sqrtRatioLowerX96,
        ];
      }

      let amount0Calculated: bigint;
      let amount1Calculated: bigint;

      // Determine which calculation to use based on input token and currency ordering
      const isCoinInput = inputToken === "coin";
      const inputAmount = coinOrEthInputAmount;

      if (
        (isCoinInput && !isFlETHCurrency0) || // coin input and coin is currency0
        (!isCoinInput && isFlETHCurrency0) // eth input and flETH is currency0
      ) {
        // We have amount0 and need to calculate amount1
        amount0Calculated = inputAmount;

        if (sqrtRatioCurrentX96 <= sqrtRatioLowerX96) {
          // Current price below range - no currency1 needed
          amount1Calculated = 0n;
        } else if (sqrtRatioCurrentX96 >= sqrtRatioUpperX96) {
          // Current price above range - proportional amount1 needed
          const ratio = (sqrtRatioUpperX96 * sqrtRatioUpperX96) / Q96;
          amount1Calculated = (inputAmount * ratio) / Q96;
        } else {
          // Current price in range - proportional amounts
          const intermediate1 =
            (sqrtRatioUpperX96 *
              sqrtRatioCurrentX96 *
              (sqrtRatioCurrentX96 - sqrtRatioLowerX96)) /
            Q96;
          const intermediate2 =
            (Q192 * (sqrtRatioUpperX96 - sqrtRatioCurrentX96)) / Q96;
          if (intermediate2 > 0n) {
            amount1Calculated = (inputAmount * intermediate1) / intermediate2;
          } else {
            amount1Calculated = 0n;
          }
        }
      } else {
        // We have amount1 and need to calculate amount0
        amount1Calculated = inputAmount;

        if (sqrtRatioCurrentX96 <= sqrtRatioLowerX96) {
          // Current price below range - proportional amount0 needed
          const ratio = (sqrtRatioLowerX96 * sqrtRatioLowerX96) / Q96;
          amount0Calculated = (inputAmount * Q96) / ratio;
        } else if (sqrtRatioCurrentX96 >= sqrtRatioUpperX96) {
          // Current price above range - no amount0 needed
          amount0Calculated = 0n;
        } else {
          // Current price in range - proportional amounts
          const intermediate1 =
            (sqrtRatioUpperX96 *
              sqrtRatioCurrentX96 *
              (sqrtRatioCurrentX96 - sqrtRatioLowerX96)) /
            Q96;
          const intermediate2 =
            (Q192 * (sqrtRatioUpperX96 - sqrtRatioCurrentX96)) / Q96;
          if (intermediate1 > 0n) {
            amount0Calculated = (inputAmount * intermediate2) / intermediate1;
          } else {
            amount0Calculated = 0n;
          }
        }
      }

      // Map amount0/amount1 back to coin/eth amounts based on currency ordering
      let [ethAmount, coinAmount] = isFlETHCurrency0
        ? [amount0Calculated, amount1Calculated]
        : [amount1Calculated, amount0Calculated];

      // Check if this is single-sided liquidity and force unused token amounts to 0
      const isSingleSided =
        currentTick <= tickLower || currentTick >= tickUpper;

      if (isSingleSided) {
        if (currentTick <= tickLower) {
          // Current price is below the range - only the lower currency (currency0) is needed
          if (isFlETHCurrency0) {
            // flETH is currency0, so we need only flETH (ETH), force coin amount to 0
            coinAmount = 0n;
          } else {
            // Coin is currency0, so we need only coin, force ETH amount to 0
            ethAmount = 0n;
          }
        } else if (currentTick >= tickUpper) {
          // Current price is above the range - only the upper currency (currency1) is needed
          if (isFlETHCurrency0) {
            // flETH is currency0, so coin is currency1 and we need only coin, force ETH to 0
            ethAmount = 0n;
          } else {
            // Coin is currency0, so flETH is currency1 and we need only flETH (ETH), force coin to 0
            coinAmount = 0n;
          }
        }
      }

      return {
        coinAmount,
        ethAmount,
        tickLower,
        tickUpper,
        currentTick,
      };
    } catch (error) {
      console.error("Error calculating liquidity amounts:", error);
      throw error;
    }
  }

  /**
   * Checks if an external memecoin has been imported to Flaunch
   * @param memecoin - The address of the memecoin to check
   * @returns Promise<boolean> - True if the memecoin has been imported
   */
  async isMemecoinImported(memecoin: Address): Promise<boolean> {
    const poolKey = orderPoolKey({
      currency0: memecoin,
      currency1: FLETHAddress[this.chainId],
      fee: 0,
      tickSpacing: TICK_SPACING,
      hooks: AnyPositionManagerAddress[this.chainId],
    });

    // check if pool's sqrtPriceX96 is not 0
    const poolState = await this.readStateView.poolSlot0({
      poolId: getPoolId(poolKey),
    });

    return poolState.sqrtPriceX96 !== 0n;
  }

  /**
   * Checks if an operator is approved for all flaunch tokens of an owner
   * @param version - The flaunch version to determine the correct contract address
   * @param owner - The owner address to check
   * @param operator - The operator address to check
   * @returns Promise<boolean> - True if operator is approved for all tokens
   */
  async isFlaunchTokenApprovedForAll(
    version: FlaunchVersion,
    owner: Address,
    operator: Address
  ) {
    const flaunchAddress = this.getFlaunchAddress(version);

    return this.drift.read({
      abi: erc721Abi,
      address: flaunchAddress,
      fn: "isApprovedForAll",
      args: { owner, operator },
    });
  }

  /**
   * Determines the version for a coin, using provided version or fetching it
   * @param coinAddress - The coin address
   * @param version - Optional version, if not provided will be fetched
   * @returns The determined version
   */
  protected async determineCoinVersion(
    coinAddress: Address,
    version?: FlaunchVersion
  ): Promise<FlaunchVersion> {
    if (!version) {
      try {
        version = await this.getCoinVersion(coinAddress);
      } catch {
        version = FlaunchVersion.ANY;
      }
    }
    return version;
  }

  /**
   * Creates a pool key for the given coin and version
   * @param coinAddress - The coin address
   * @param version - The version to use for position manager
   * @returns The ordered pool key
   */
  protected createPoolKey(coinAddress: Address, version: FlaunchVersion) {
    const flethAddress = FLETHAddress[this.chainId];
    return orderPoolKey({
      currency0: coinAddress,
      currency1: flethAddress,
      fee: 0,
      tickSpacing: this.TICK_SPACING,
      hooks: this.getPositionManagerAddress(version),
    });
  }
}

export class ReadWriteFlaunchSDK extends ReadFlaunchSDK {
  declare drift: Drift<ReadWriteAdapter>;
  public readonly readWritePositionManager: ReadWriteFlaunchPositionManager;
  public readonly readWritePositionManagerV1_1: ReadWriteFlaunchPositionManagerV1_1;
  public readonly readWriteAnyPositionManager: ReadWriteAnyPositionManager;
  public readonly readWriteTokenImporter: ReadWriteTokenImporter;
  public readonly readWriteFeeEscrow: ReadWriteFeeEscrow;
  public readonly readWriteReferralEscrow: ReadWriteReferralEscrow;
  public readonly readWriteFlaunchZap: ReadWriteFlaunchZap;
  public readonly readWriteTreasuryManagerFactory: ReadWriteTreasuryManagerFactory;
  public readonly readWritePermit2: ReadWritePermit2;

  constructor(
    chainId: number,
    drift: Drift<ReadWriteAdapter> = createDrift(),
    publicClient?: PublicClient
  ) {
    super(chainId, drift, publicClient);
    this.readWritePositionManager = new ReadWriteFlaunchPositionManager(
      FlaunchPositionManagerAddress[this.chainId],
      drift
    );
    this.readWritePositionManagerV1_1 = new ReadWriteFlaunchPositionManagerV1_1(
      FlaunchPositionManagerV1_1Address[this.chainId],
      drift
    );
    this.readWriteAnyPositionManager = new ReadWriteAnyPositionManager(
      AnyPositionManagerAddress[this.chainId],
      drift
    );
    this.readWriteTokenImporter = new ReadWriteTokenImporter(
      this.chainId,
      TokenImporterAddress[this.chainId],
      drift
    );
    this.readWriteFeeEscrow = new ReadWriteFeeEscrow(
      FeeEscrowAddress[this.chainId],
      drift
    );
    this.readWriteReferralEscrow = new ReadWriteReferralEscrow(
      ReferralEscrowAddress[this.chainId],
      drift
    );
    this.readWriteFlaunchZap = new ReadWriteFlaunchZap(
      this.chainId,
      FlaunchZapAddress[this.chainId],
      drift
    );
    this.readWriteTreasuryManagerFactory = new ReadWriteTreasuryManagerFactory(
      this.chainId,
      TreasuryManagerFactoryAddress[this.chainId],
      drift,
      this.publicClient
    );
    this.readWritePermit2 = new ReadWritePermit2(
      Permit2Address[this.chainId],
      drift
    );
  }

  /**
   * Deploys a new revenue manager
   * @param params - Parameters for deploying the revenue manager
   * @param params.protocolRecipient - The address of the protocol recipient
   * @param params.protocolFeePercent - The percentage of the protocol fee
   * @param params.permissions - The permissions for the revenue manager
   * @returns Address of the deployed revenue manager
   */
  async deployRevenueManager(
    params: DeployRevenueManagerParams
  ): Promise<Address> {
    const hash = await this.readWriteFlaunchZap.deployRevenueManager(params);

    return await this.readWriteTreasuryManagerFactory.getManagerDeployedAddressFromTx(
      hash
    );
  }

  /**
   * Deploys a new staking manager
   * @param params - Parameters for deploying the staking manager
   * @param params.managerOwner - The address of the manager owner
   * @param params.stakingToken - The address of the token to be staked
   * @param params.minEscrowDuration - The minimum duration (in seconds) that the creator's NFT is locked for
   * @param params.minStakeDuration - The minimum duration (in seconds) that the user's tokens are locked for
   * @param params.creatorSharePercent - The % share that a creator will earn from their token
   * @param params.ownerSharePercent - The % share that the manager owner will earn from their token
   * @param params.permissions - The permissions for the staking manager
   * @returns Address of the deployed staking manager
   */
  async deployStakingManager(
    params: DeployStakingManagerParams
  ): Promise<Address> {
    const hash = await this.readWriteFlaunchZap.deployStakingManager(params);

    return await this.readWriteTreasuryManagerFactory.getManagerDeployedAddressFromTx(
      hash
    );
  }

  /**
   * Deploys a new BuyBack manager
   * @param params - Parameters for deploying the BuyBack manager
   * @param params.managerOwner - The address of the manager owner
   * @param params.creatorSharePercent - The % share that a creator will earn from their token (0-100)
   * @param params.ownerSharePercent - The % share that the manager owner will earn from their token (0-100)
   * @param params.buyBackPoolKey - The Uniswap V4 pool key configuration for the buyback pool
   * @param params.buyBackPoolKey.currency0 - The lower currency of the pool (sorted numerically)
   * @param params.buyBackPoolKey.currency1 - The higher currency of the pool (sorted numerically)
   * @param params.buyBackPoolKey.fee - The pool LP fee, capped at 1_000_000
   * @param params.buyBackPoolKey.tickSpacing - Tick spacing for the pool
   * @param params.buyBackPoolKey.hooks - The hooks address of the pool
   * @param params.permissions - The permissions for the BuyBack manager
   * @returns Address of the deployed BuyBack manager
   */
  async deployBuyBackManager(
    params: DeployBuyBackManagerParams
  ): Promise<Address> {
    const hash = await this.readWriteFlaunchZap.deployBuyBackManager(params);

    return await this.readWriteTreasuryManagerFactory.getManagerDeployedAddressFromTx(
      hash
    );
  }

  /**
   * Creates a new Flaunch on the specified version
   * @param params - Parameters for creating the Flaunch
   * @returns Transaction response
   */
  flaunch(params: FlaunchParams) {
    return this.readWriteFlaunchZap.flaunch(params);
  }

  /**
   * Creates a new Flaunch with IPFS metadata and optional version specification
   * @param params - Parameters for creating the Flaunch with IPFS data
   * @returns Transaction response
   */
  flaunchIPFS(params: FlaunchIPFSParams) {
    return this.readWriteFlaunchZap.flaunchIPFS(params);
  }

  /**
   * Creates a new Flaunch with revenue manager configuration
   * @param params - Parameters for creating the Flaunch with revenue manager
   * @throws Error if FlaunchZap is not deployed on the current chain
   * @returns Transaction response
   */
  flaunchWithRevenueManager(params: FlaunchWithRevenueManagerParams) {
    if (this.readWriteFlaunchZap.contract.address === zeroAddress) {
      throw new Error(`FlaunchZap is not deployed at chainId: ${this.chainId}`);
    }

    return this.readWriteFlaunchZap.flaunchWithRevenueManager(params);
  }

  /**
   * Creates a new Flaunch with revenue manager configuration and IPFS metadata
   * @param params - Parameters for creating the Flaunch with revenue manager and IPFS data
   * @throws Error if FlaunchZap is not deployed on the current chain
   * @returns Transaction response
   */
  async flaunchIPFSWithRevenueManager(
    params: FlaunchWithRevenueManagerIPFSParams
  ) {
    if (this.readWriteFlaunchZap.contract.address === zeroAddress) {
      throw new Error(`FlaunchZap is not deployed at chainId: ${this.chainId}`);
    }

    return this.readWriteFlaunchZap.flaunchIPFSWithRevenueManager(params);
  }

  /**
   * Creates a new Flaunch that splits the creator fees to the creator and a list of recipients
   * @param params - Parameters for creating the Flaunch with split manager
   * @returns Transaction response
   */
  flaunchWithSplitManager(params: FlaunchWithSplitManagerParams) {
    return this.readWriteFlaunchZap.flaunchWithSplitManager(params);
  }

  /**
   * Creates a new Flaunch that splits the creator fees to the creator and a list of recipients, storing the token metadata on IPFS
   * @param params - Parameters for creating the Flaunch with split manager including all IPFS metadata
   * @returns Transaction response
   */
  flaunchIPFSWithSplitManager(params: FlaunchWithSplitManagerIPFSParams) {
    return this.readWriteFlaunchZap.flaunchIPFSWithSplitManager(params);
  }

  /**
   * Creates a new Flaunch with AnyPositionManager for external coins
   * @param params - Parameters for creating the Flaunch with AnyPositionManager
   * @returns Transaction response
   */
  anyFlaunch(params: AnyFlaunchParams) {
    return this.readWriteAnyPositionManager.flaunch(params);
  }

  /**
   * Gets the balance of a specific coin for the connected wallet
   * @param coinAddress - The address of the coin to check
   * @returns Promise<bigint> - The balance of the coin
   */
  async coinBalance(coinAddress: Address) {
    const user = await this.drift.getSignerAddress();
    const memecoin = new ReadMemecoin(coinAddress, this.drift);
    await memecoin.contract.cache.clear();
    return memecoin.balanceOf(user);
  }

  /**
   * Buys a coin with ETH or custom inputToken via intermediatePoolKey
   * @param params - Parameters for buying the coin including amount, slippage, and referrer
   * @param version - Optional specific version to use. If not provided, will determine automatically
   * @returns Transaction response for the buy operation
   */
  async buyCoin(params: BuyCoinParams, version?: FlaunchVersion) {
    const coinVersion = await this.determineCoinVersion(
      params.coinAddress,
      version
    );

    const sender = await this.drift.getSignerAddress();

    let amountIn: bigint | undefined;
    let amountOutMin: bigint | undefined;
    let amountOut: bigint | undefined;
    let amountInMax: bigint | undefined;

    await this.readQuoter.contract.cache.clear();

    if (params.swapType === "EXACT_IN") {
      amountIn = params.amountIn;
      if (params.amountOutMin === undefined) {
        amountOutMin = getAmountWithSlippage({
          amount: await this.readQuoter.getBuyQuoteExactInput({
            coinAddress: params.coinAddress,
            amountIn,
            positionManagerAddress: this.getPositionManagerAddress(coinVersion),
            intermediatePoolKey: params.intermediatePoolKey,
            hookData: params.hookData,
            userWallet: sender,
          }),
          slippage: (params.slippagePercent / 100).toFixed(18).toString(),
          swapType: params.swapType,
        });
      } else {
        amountOutMin = params.amountOutMin;
      }
    } else {
      amountOut = params.amountOut;
      if (params.amountInMax === undefined) {
        amountInMax = getAmountWithSlippage({
          amount: await this.readQuoter.getBuyQuoteExactOutput({
            coinAddress: params.coinAddress,
            coinOut: amountOut,
            positionManagerAddress: this.getPositionManagerAddress(coinVersion),
            intermediatePoolKey: params.intermediatePoolKey,
            hookData: params.hookData,
            userWallet: sender,
          }),
          slippage: (params.slippagePercent / 100).toFixed(18).toString(),
          swapType: params.swapType,
        });
      } else {
        amountInMax = params.amountInMax;
      }
    }

    const { commands, inputs } = buyMemecoin({
      sender: sender,
      memecoin: params.coinAddress,
      chainId: this.chainId,
      referrer: params.referrer ?? null,
      swapType: params.swapType,
      amountIn: amountIn,
      amountOutMin: amountOutMin,
      amountOut: amountOut,
      amountInMax: amountInMax,
      positionManagerAddress: this.getPositionManagerAddress(coinVersion),
      intermediatePoolKey: params.intermediatePoolKey,
      permitSingle: params.permitSingle,
      signature: params.signature,
      hookData: params.hookData,
    });

    return this.drift.adapter.write({
      abi: UniversalRouterAbi,
      address: UniversalRouterAddress[this.chainId],
      fn: "execute",
      args: {
        commands,
        inputs,
      },
      value: params.intermediatePoolKey
        ? 0n // 0 ETH as inputToken is in another currency
        : params.swapType === "EXACT_IN"
        ? amountIn
        : amountInMax,
    });
  }

  /**
   * Sells a coin for ETH
   * @param params - Parameters for selling the coin including amount, slippage, permit data, and referrer
   * @param version - Optional specific version to use. If not provided, will determine automatically
   * @returns Transaction response for the sell operation
   */
  async sellCoin(params: SellCoinParams, version?: FlaunchVersion) {
    const coinVersion = await this.determineCoinVersion(
      params.coinAddress,
      version
    );

    let amountOutMin: bigint;

    await this.readQuoter.contract.cache.clear();

    if (params.amountOutMin === undefined) {
      amountOutMin = getAmountWithSlippage({
        amount: await this.readQuoter.getSellQuoteExactInput({
          coinAddress: params.coinAddress,
          amountIn: params.amountIn,
          positionManagerAddress: this.getPositionManagerAddress(coinVersion),
          intermediatePoolKey: params.intermediatePoolKey,
        }),
        slippage: (params.slippagePercent / 100).toFixed(18).toString(),
        swapType: "EXACT_IN",
      });
    } else {
      amountOutMin = params.amountOutMin;
    }

    await this.readPermit2.contract.cache.clear();

    const { commands, inputs } = sellMemecoinWithPermit2({
      chainId: this.chainId,
      memecoin: params.coinAddress,
      amountIn: params.amountIn,
      amountOutMin,
      permitSingle: params.permitSingle,
      signature: params.signature,
      referrer: params.referrer ?? null,
      positionManagerAddress: this.getPositionManagerAddress(coinVersion),
      intermediatePoolKey: params.intermediatePoolKey,
    });

    return this.drift.write({
      abi: UniversalRouterAbi,
      address: UniversalRouterAddress[this.chainId],
      fn: "execute",
      args: {
        commands,
        inputs,
      },
    });
  }

  /**
   * Gets the typed data for a Permit2 signature
   * @param coinAddress - The address of the coin to permit
   * @param deadline - Optional deadline for the permit (defaults to 10 years)
   * @returns The typed data object for signing
   */
  async getPermit2TypedData(coinAddress: Address, deadline?: bigint) {
    const { nonce } = await this.getPermit2AllowanceAndNonce(coinAddress);

    // 10 years in seconds
    const defaultDeadline = BigInt(
      Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10
    );

    return getPermit2TypedData({
      chainId: this.chainId,
      coinAddress,
      nonce,
      deadline: deadline !== undefined ? deadline : defaultDeadline,
    });
  }

  /**
   * Gets the current Permit2 allowance and nonce for a coin
   * @param coinAddress - The address of the coin to check
   * @returns Promise<{allowance: bigint, nonce: bigint}> - Current allowance and nonce
   */
  async getPermit2AllowanceAndNonce(coinAddress: Address) {
    const { amount, nonce } = await this.readPermit2.allowance(
      await this.drift.getSignerAddress(),
      coinAddress,
      UniversalRouterAddress[this.chainId]
    );

    return {
      allowance: amount,
      nonce,
    };
  }

  /**
   * Gets the allowance of an ERC20 token to Permit2 contract. Flaunch coins automatically have infinite approval for Permit2.
   * this function is for external tokens.
   * @param coinAddress - The address of the coin to check
   * @returns Promise<bigint> - The allowance of the coin to Permit2
   */
  async getERC20AllowanceToPermit2(coinAddress: Address) {
    const coin = new ReadMemecoin(coinAddress, this.drift);
    return coin.allowance(
      await this.drift.getSignerAddress(),
      Permit2Address[this.chainId]
    );
  }

  /**
   * Sets the allowance of an ERC20 token to Permit2 contract. Flaunch coins automatically have infinite approval for Permit2.
   * this function is for external tokens.
   * @param coinAddress - The address of the coin to approve
   * @param amount - The amount of the token to approve
   * @returns Promise<Hex> - The transaction hash
   */
  async setERC20AllowanceToPermit2(coinAddress: Address, amount: bigint) {
    const coin = new ReadWriteMemecoin(coinAddress, this.drift);
    return coin.approve(Permit2Address[this.chainId], amount);
  }

  /**
   * Withdraws the creator's share of the revenue
   * @param params - Parameters for withdrawing the creator's share of the revenue
   * @param params.recipient - The address to withdraw the revenue to. Defaults to the connected wallet
   * @param params.isV1 - Optional boolean to withdraw from V1. V1.1 & AnyPositionManager use the same FeeEscrow contract
   * @returns Transaction response
   */
  async withdrawCreatorRevenue(params: {
    recipient?: Address;
    isV1?: boolean;
  }) {
    const recipient = params.recipient ?? (await this.drift.getSignerAddress());

    if (params.isV1) {
      return this.readWritePositionManager.withdrawFees(recipient);
    } else {
      return this.readWriteFeeEscrow.withdrawFees(recipient);
    }
  }

  /**
   * Claims the referral balance for a given recipient
   * @param coins - The addresses of the coins to claim
   * @param recipient - The address of the recipient to claim the balance for
   * @returns Transaction response
   */
  claimReferralBalance(coins: Address[], recipient: Address) {
    return this.readWriteReferralEscrow.claimTokens(coins, recipient);
  }

  /**
   * Claims the protocol's share of the revenue
   * @param params - Parameters for claiming the protocol's share of the revenue
   * @returns Transaction response
   */
  revenueManagerProtocolClaim(params: { revenueManagerAddress: Address }) {
    const readWriteRevenueManager = new ReadWriteRevenueManager(
      params.revenueManagerAddress,
      this.drift
    );
    return readWriteRevenueManager.protocolClaim();
  }

  /**
   * Claims the total creator's share of the revenue from a revenue manager
   * @param params - Parameters for claiming the creator's share of the revenue
   * @returns Transaction response
   */
  revenueManagerCreatorClaim(params: { revenueManagerAddress: Address }) {
    const readWriteRevenueManager = new ReadWriteRevenueManager(
      params.revenueManagerAddress,
      this.drift
    );
    return readWriteRevenueManager.creatorClaim();
  }

  /**
   * Claims the creator's share of the revenue from specific flaunch tokens
   * @param params - Parameters for claiming the creator's share of the revenue
   * @returns Transaction response
   */
  revenueManagerCreatorClaimForTokens(params: {
    revenueManagerAddress: Address;
    flaunchTokens: { flaunch: Address; tokenId: bigint }[];
  }) {
    const readWriteRevenueManager = new ReadWriteRevenueManager(
      params.revenueManagerAddress,
      this.drift
    );
    return readWriteRevenueManager.creatorClaimForTokens(params.flaunchTokens);
  }

  /**
   * Sets the permissions contract address for a treasury manager
   * @param treasuryManagerAddress - The address of the treasury manager
   * @param permissions - The permissions enum value to set
   * @returns Transaction response
   */
  treasuryManagerSetPermissions(
    treasuryManagerAddress: Address,
    permissions: Permissions
  ) {
    const readWriteTreasuryManager = new ReadWriteTreasuryManager(
      treasuryManagerAddress,
      this.drift
    );
    const permissionsAddress = getPermissionsAddress(permissions, this.chainId);
    return readWriteTreasuryManager.setPermissions(permissionsAddress);
  }

  /**
   * Transfers the ownership of a treasury manager to a new address
   * @param treasuryManagerAddress - The address of the treasury manager
   * @param newManagerOwner - The address of the new manager owner
   * @returns Transaction response
   */
  treasuryManagerTransferOwnership(
    treasuryManagerAddress: Address,
    newManagerOwner: Address
  ) {
    const readWriteTreasuryManager = new ReadWriteTreasuryManager(
      treasuryManagerAddress,
      this.drift
    );
    return readWriteTreasuryManager.transferManagerOwnership(newManagerOwner);
  }

  /**
   * Sets approval for all flaunch tokens to an operator
   * @param version - The flaunch version to determine the correct contract address
   * @param operator - The operator address to approve/revoke
   * @param approved - Whether to approve or revoke approval
   * @returns Transaction response
   */
  async setFlaunchTokenApprovalForAll(
    version: FlaunchVersion,
    operator: Address,
    approved: boolean
  ) {
    const flaunchAddress = this.getFlaunchAddress(version);

    return this.drift.write({
      abi: erc721Abi,
      address: flaunchAddress,
      fn: "setApprovalForAll",
      args: { operator, approved },
    });
  }

  /**
   * Adds an existing flaunch token to a treasury manager. NFT approval must be given prior to calling this function.
   * @param treasuryManagerAddress - The address of the treasury manager
   * @param version - The flaunch version to determine the correct contract address
   * @param tokenId - The token ID to deposit
   * @param creator - Optional creator address. If not provided, uses the connected wallet address
   * @param data - Optional additional data for the deposit (defaults to empty bytes)
   * @returns Transaction response
   */
  async addToTreasuryManager(
    treasuryManagerAddress: Address,
    version: FlaunchVersion,
    tokenId: bigint,
    creator?: Address,
    data: `0x${string}` = "0x"
  ) {
    const readWriteTreasuryManager = new ReadWriteTreasuryManager(
      treasuryManagerAddress,
      this.drift
    );

    // Get the flaunch contract address based on version
    const flaunchAddress = this.getFlaunchAddress(version);

    const flaunchToken = {
      flaunch: flaunchAddress,
      tokenId,
    };

    const creatorAddress = creator ?? (await this.drift.getSignerAddress());

    return readWriteTreasuryManager.deposit(flaunchToken, creatorAddress, data);
  }

  /**
   * Imports a memecoin into the TokenImporter
   * @param params.coinAddress - The address of the memecoin to import
   * @param params.creatorFeeAllocationPercent - The creator fee allocation percentage
   * @param params.initialMarketCapUSD - The initial market cap in USD
   * @param params.verifier - Optional verifier to use for importing the memecoin
   * @returns Transaction response
   */
  importMemecoin(params: ImportMemecoinParams) {
    return this.readWriteTokenImporter.initialize(params);
  }

  /**
   * Gets the calls needed to add liquidity to flaunch or imported coins
   * @param params - Parameters for adding liquidity
   * @returns Array of calls with descriptions
   */
  async getAddLiquidityCalls(
    params: GetAddLiquidityCallsParams
  ): Promise<CallWithDescription[]> {
    const { coinAddress } = params;
    const flethAddress = FLETHAddress[this.chainId];

    let coinAmount: bigint;
    let flethAmount: bigint;
    let tickLower: number;
    let tickUpper: number;
    let currentTick: number;

    const version = await this.determineCoinVersion(
      coinAddress,
      params.version
    );
    const poolKey = this.createPoolKey(coinAddress, version);

    // Check if we need to calculate values or use direct values
    if ("tickLower" in params) {
      // Use the directly provided values
      coinAmount = params.coinAmount;
      flethAmount = params.flethAmount;
      tickLower = params.tickLower;
      tickUpper = params.tickUpper;

      if (params.currentTick) {
        currentTick = params.currentTick;
      } else {
        const poolState = await this.readStateView.poolSlot0({
          poolId: getPoolId(poolKey),
        });
        currentTick = poolState.tick;
      }
    } else {
      // Calculate the amounts
      let minMarketCap: string;
      let maxMarketCap: string;
      let initialMarketCapUSD: number | undefined;

      if ("minMarketCap" in params) {
        minMarketCap = params.minMarketCap;
        maxMarketCap = params.maxMarketCap;
        initialMarketCapUSD = params.initialMarketCapUSD;
      } else {
        const { formattedTotalSupplyInDecimals } = await this.getCoinInfo(
          coinAddress
        );

        minMarketCap = (
          parseFloat(params.minPriceUSD) * formattedTotalSupplyInDecimals
        ).toString();
        maxMarketCap = (
          parseFloat(params.maxPriceUSD) * formattedTotalSupplyInDecimals
        ).toString();

        if (params.initialPriceUSD) {
          initialMarketCapUSD =
            params.initialPriceUSD * formattedTotalSupplyInDecimals;
        }
      }

      const calculated = await this.calculateAddLiquidityAmounts({
        coinAddress,
        liquidityMode: params.liquidityMode,
        coinOrEthInputAmount: params.coinOrEthInputAmount,
        inputToken: params.inputToken,
        minMarketCap,
        maxMarketCap,
        currentMarketCap: initialMarketCapUSD?.toString(),
        version,
      });

      coinAmount = calculated.coinAmount;
      flethAmount = calculated.ethAmount;
      tickLower = calculated.tickLower;
      tickUpper = calculated.tickUpper;
      currentTick = calculated.currentTick;
    }

    // Fetch approvals via multicall
    const userAddress = await this.drift.getSignerAddress();
    const permit2Address = Permit2Address[this.chainId];

    const results = await this.drift.multicall({
      calls: [
        // coin -> permit2
        {
          address: coinAddress,
          abi: erc20Abi,
          fn: "allowance",
          args: {
            owner: userAddress,
            spender: permit2Address,
          },
        },
        // flETH -> permit2
        {
          address: flethAddress,
          abi: erc20Abi,
          fn: "allowance",
          args: {
            owner: userAddress,
            spender: permit2Address,
          },
        },
        // coin --permit2--> uni position manager
        {
          address: permit2Address,
          abi: Permit2Abi,
          fn: "allowance",
          args: {
            0: userAddress,
            1: coinAddress,
            2: UniV4PositionManagerAddress[this.chainId],
          },
        },
        // flETH --permit2--> uni position manager
        {
          address: permit2Address,
          abi: Permit2Abi,
          fn: "allowance",
          args: {
            0: userAddress,
            1: flethAddress,
            2: UniV4PositionManagerAddress[this.chainId],
          },
        },
        // coin symbol
        {
          address: coinAddress,
          abi: erc20Abi,
          fn: "symbol",
        },
      ],
    });
    const coinToPermit2 = results[0].value!;
    const flethToPermit2 = results[1].value!;
    const permit2ToUniPosManagerCoinAllowance = results[2].value!;
    const permit2ToUniPosManagerFlethAllowance = results[3].value!;
    const coinSymbol = results[4].value!;

    const needsCoinApproval = coinToPermit2 < coinAmount;
    const needsFlethApproval = flethToPermit2 < flethAmount;

    const currentTime = Math.floor(Date.now() / 1000);
    const needsCoinPermit2Approval =
      permit2ToUniPosManagerCoinAllowance.amount < coinAmount ||
      permit2ToUniPosManagerCoinAllowance.expiration <= currentTime;
    const needsFlethPermit2Approval =
      flethAmount > 0n &&
      (permit2ToUniPosManagerFlethAllowance.amount < flethAmount ||
        permit2ToUniPosManagerFlethAllowance.expiration <= currentTime);

    const calls: CallWithDescription[] = [];

    // 1. Coin approval to Permit2
    if (needsCoinApproval) {
      calls.push({
        to: coinAddress,
        description: `Approve ${coinSymbol} for Permit2`,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [permit2Address, coinAmount],
        }),
      });
    }
    // 2. flETH approval to Permit2 (after wrapping)
    if (needsFlethApproval) {
      calls.push({
        to: flethAddress,
        description: `Approve flETH for Permit2`,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [permit2Address, flethAmount],
        }),
      });
    }
    // 3. Permit2 approval for coin to uni position manager
    const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    if (needsCoinPermit2Approval) {
      calls.push({
        to: permit2Address,
        description: `Permit2 approval for ${coinSymbol} to UniV4PositionManager`,
        data: encodeFunctionData({
          abi: Permit2Abi,
          functionName: "approve",
          args: [
            coinAddress,
            UniV4PositionManagerAddress[this.chainId],
            coinAmount,
            expiration,
          ],
        }),
      });
    }
    // 4. Permit2 approval for flETH to uni position manager
    if (needsFlethPermit2Approval) {
      calls.push({
        to: permit2Address,
        description: `Permit2 approval for flETH to UniV4PositionManager`,
        data: encodeFunctionData({
          abi: Permit2Abi,
          functionName: "approve",
          args: [
            flethAddress,
            UniV4PositionManagerAddress[this.chainId],
            flethAmount,
            expiration,
          ],
        }),
      });
    }

    // 5. Wrap ETH to flETH
    if (flethAmount > 0n) {
      calls.push({
        to: flethAddress,
        description: "Wrap ETH to flETH",
        data: encodeFunctionData({
          abi: FLETHAbi,
          functionName: "deposit",
          args: [0n], // wethAmount = 0, we're only sending ETH
        }),
        value: flethAmount,
      });
    }

    // === generate add liquidity call ===
    // Determine amounts for each currency based on pool key ordering
    const amount0 =
      poolKey.currency0 === coinAddress ? coinAmount : flethAmount;
    const amount1 =
      poolKey.currency0 === coinAddress ? flethAmount : coinAmount;

    // Calculate and constrain liquidity using shared method
    const { finalLiquidity, finalAmount0, finalAmount1 } =
      this.calculateConstrainedLiquidity(
        currentTick,
        tickLower,
        tickUpper,
        amount0,
        amount1
      );

    // 6. Add liquidity
    calls.push(
      this.createLiquidityCall(
        poolKey,
        tickLower,
        tickUpper,
        finalLiquidity,
        finalAmount0,
        finalAmount1,
        userAddress
      )
    );

    return calls;
  }

  /**
   * Gets the calls needed to import a memecoin to Flaunch and add liquidity to AnyPositionManager as a batch
   * @param params - Parameters for importing and adding liquidity with market cap constraints
   * @returns Array of calls with descriptions
   *
   * @example
   * ```typescript
   * const calls = await sdk.getImportAndAddLiquidityCalls({
   *   coinAddress: "0x...",
   *   verifier: Verifier.CLANKER,
   *   creatorFeeAllocationPercent: 5,
   *   liquidityMode: LiquidityMode.CONCENTRATED,
   *   coinOrEthInputAmount: parseEther("1"),
   *   inputToken: "eth",
   *   minMarketCap: "10000",
   *   maxMarketCap: "100000",
   *   initialMarketCapUSD: 50000
   * });
   * ```
   */
  async getImportAndAddLiquidityCalls(
    params: ImportAndAddLiquidityWithMarketCap
  ): Promise<CallWithDescription[]>;

  /**
   * Gets the calls needed to import a memecoin to Flaunch and add liquidity to AnyPositionManager as a batch
   * @param params - Parameters for importing and adding liquidity with price constraints
   * @returns Array of calls with descriptions
   *
   * @example
   * ```typescript
   * const calls = await sdk.getImportAndAddLiquidityCalls({
   *   coinAddress: "0x...",
   *   verifier: Verifier.CLANKER,
   *   creatorFeeAllocationPercent: 5,
   *   liquidityMode: LiquidityMode.CONCENTRATED,
   *   coinOrEthInputAmount: parseEther("1"),
   *   inputToken: "eth",
   *   minPriceUSD: "0.0001",
   *   maxPriceUSD: "0.001",
   *   initialPriceUSD: 0.0005
   * });
   * ```
   */
  async getImportAndAddLiquidityCalls(
    params: ImportAndAddLiquidityWithPrice
  ): Promise<CallWithDescription[]>;

  /**
   * Gets the calls needed to import a memecoin to Flaunch and add liquidity to AnyPositionManager as a batch
   * @param params - Parameters for importing and adding liquidity with exact amounts
   * @returns Array of calls with descriptions
   *
   * @example
   * ```typescript
   * const calls = await sdk.getImportAndAddLiquidityCalls({
   *   coinAddress: "0x...",
   *   verifier: Verifier.CLANKER,
   *   creatorFeeAllocationPercent: 5,
   *   coinAmount: parseEther("1000"),
   *   flethAmount: parseEther("0.5"),
   *   tickLower: -887220,
   *   tickUpper: 887220,
   *   currentTick: 0
   * });
   * ```
   */
  async getImportAndAddLiquidityCalls(
    params: ImportAndAddLiquidityWithExactAmounts
  ): Promise<CallWithDescription[]>;

  // Implementation with union type for internal use
  async getImportAndAddLiquidityCalls(
    params: ImportAndAddLiquidityParams
  ): Promise<CallWithDescription[]> {
    let importParams;
    if ("initialMarketCapUSD" in params) {
      const paramsWithMarketCap = params as ImportAndAddLiquidityParams & {
        initialMarketCapUSD: number;
      };
      importParams = await this.readWriteTokenImporter.getInitializeParams({
        coinAddress: paramsWithMarketCap.coinAddress,
        creatorFeeAllocationPercent:
          paramsWithMarketCap.creatorFeeAllocationPercent,
        initialMarketCapUSD: paramsWithMarketCap.initialMarketCapUSD,
        verifier: paramsWithMarketCap.verifier,
      });
    } else {
      const paramsWithPrice = params as ImportAndAddLiquidityParams & {
        initialPriceUSD: number;
      };
      importParams = await this.readWriteTokenImporter.getInitializeParams({
        coinAddress: paramsWithPrice.coinAddress,
        creatorFeeAllocationPercent:
          paramsWithPrice.creatorFeeAllocationPercent,
        initialPriceUSD: paramsWithPrice.initialPriceUSD,
        verifier: paramsWithPrice.verifier,
      });
    }

    const addLiquidityCalls = await this.getAddLiquidityCalls({
      ...params,
      version: FlaunchVersion.ANY, // optimize to avoid fetching if not passed
    });

    return [
      {
        to: this.readWriteTokenImporter.contract.address,
        data: this.readWriteTokenImporter.contract.encodeFunctionData(
          "initialize",
          importParams
        ),
        description: "Import Memecoin to Flaunch",
      },
      ...addLiquidityCalls,
    ];
  }

  /**
   * Gets the calls needed to add single-sided liquidity in coin from current tick to infinity
   * @param params - Parameters for adding single-sided liquidity
   * @returns Array of calls with descriptions
   */
  async getSingleSidedCoinAddLiquidityCalls(
    params: GetSingleSidedCoinAddLiquidityCallsParams
  ): Promise<CallWithDescription[]> {
    const { coinAddress, coinAmount } = params;

    const version = await this.determineCoinVersion(
      coinAddress,
      params.version
    );
    const poolKey = this.createPoolKey(coinAddress, version);

    let currentTick: number;

    // if initial marketcap or price is provided, it means that the pool is not initialized yet
    // so determining the currentTick
    if (
      ("initialMarketCapUSD" in params && params.initialMarketCapUSD) ||
      ("initialPriceUSD" in params && params.initialPriceUSD)
    ) {
      const { decimals: coinDecimals, formattedTotalSupplyInDecimals } =
        await this.getCoinInfo(coinAddress);

      // Determine market cap based on provided parameter
      let initialMarketCapUSD: number;
      if ("initialMarketCapUSD" in params && params.initialMarketCapUSD) {
        initialMarketCapUSD = params.initialMarketCapUSD;
      } else if ("initialPriceUSD" in params && params.initialPriceUSD) {
        initialMarketCapUSD =
          params.initialPriceUSD * formattedTotalSupplyInDecimals;
      } else {
        throw new Error(
          "Either initialMarketCapUSD or initialPriceUSD must be provided"
        );
      }

      const marketContext = await this.getMarketContext(
        coinAddress,
        coinDecimals
      );

      const calculatedTick = this.calculateCurrentTickFromMarketCap(
        initialMarketCapUSD.toString(),
        formattedTotalSupplyInDecimals,
        marketContext
      );

      if (calculatedTick === undefined) {
        throw new Error("Failed to calculate current tick from market cap");
      }

      currentTick = calculatedTick;
    } else {
      // the pool is already initialized, get the current tick from the pool
      const poolState = await this.readStateView.poolSlot0({
        poolId: getPoolId(poolKey),
      });
      currentTick = poolState.tick;
    }

    // We want to add liquidity from current price to infinity (as coin appreciates vs flETH)
    // This means providing single-sided coin liquidity that becomes active as coin price increases

    const isFLETHZero = this.flETHIsCurrencyZero(coinAddress);

    let tickLower: number;
    let tickUpper: number;

    if (isFLETHZero) {
      // flETH is currency0, coin is currency1
      // Price = coin/flETH. As coin appreciates, price and tick increase.
      // For single-sided coin position, we need the range to end at current tick
      // so as price increases beyond current, position becomes coin-only
      tickLower = TickFinder.MIN_TICK;
      tickUpper = getValidTick({
        tick: currentTick,
        tickSpacing: this.TICK_SPACING,
        roundDown: true,
      });
    } else {
      // coin is currency0, flETH is currency1
      // Price = flETH/coin. As coin appreciates, price decreases and tick decreases.
      // For single-sided coin position, we need the range to start at current tick
      // so as price decreases below current, position becomes coin-only
      tickLower = getValidTick({
        tick: currentTick,
        tickSpacing: this.TICK_SPACING,
        roundDown: false,
      });
      tickUpper = TickFinder.MAX_TICK;
    }

    // Fetch approvals via multicall
    const userAddress = await this.drift.getSignerAddress();
    const permit2Address = Permit2Address[this.chainId];

    const results = await this.drift.multicall({
      calls: [
        // coin -> permit2
        {
          address: coinAddress,
          abi: erc20Abi,
          fn: "allowance",
          args: {
            owner: userAddress,
            spender: permit2Address,
          },
        },
        // coin --permit2--> uni position manager
        {
          address: permit2Address,
          abi: Permit2Abi,
          fn: "allowance",
          args: {
            0: userAddress,
            1: coinAddress,
            2: UniV4PositionManagerAddress[this.chainId],
          },
        },
        // coin symbol
        {
          address: coinAddress,
          abi: erc20Abi,
          fn: "symbol",
        },
      ],
    });
    const coinToPermit2 = results[0].value!;
    const permit2ToUniPosManagerCoinAllowance = results[1].value!;
    const coinSymbol = results[2].value!;

    const needsCoinApproval = coinToPermit2 < coinAmount;
    const currentTime = Math.floor(Date.now() / 1000);
    const needsCoinPermit2Approval =
      permit2ToUniPosManagerCoinAllowance.amount < coinAmount ||
      permit2ToUniPosManagerCoinAllowance.expiration <= currentTime;

    const calls: CallWithDescription[] = [];

    // 1. Coin approval to Permit2
    if (needsCoinApproval) {
      calls.push({
        to: coinAddress,
        description: `Approve ${coinSymbol} for Permit2`,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [permit2Address, coinAmount],
        }),
      });
    }

    // 2. Permit2 approval for coin to uni position manager
    const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    if (needsCoinPermit2Approval) {
      calls.push({
        to: permit2Address,
        description: `Permit2 approval for ${coinSymbol} to UniV4PositionManager`,
        data: encodeFunctionData({
          abi: Permit2Abi,
          functionName: "approve",
          args: [
            coinAddress,
            UniV4PositionManagerAddress[this.chainId],
            coinAmount,
            expiration,
          ],
        }),
      });
    }

    // === generate add liquidity call ===
    // Determine amounts for each currency based on pool key ordering
    const flethAmount = 0n;
    const amount0 =
      poolKey.currency0 === coinAddress ? coinAmount : flethAmount;
    const amount1 =
      poolKey.currency0 === coinAddress ? flethAmount : coinAmount;

    // Calculate and constrain liquidity using shared method
    const { finalLiquidity, finalAmount0, finalAmount1 } =
      this.calculateConstrainedLiquidity(
        currentTick,
        tickLower,
        tickUpper,
        amount0,
        amount1
      );

    // 3. Add liquidity
    calls.push(
      this.createLiquidityCall(
        poolKey,
        tickLower,
        tickUpper,
        finalLiquidity,
        finalAmount0,
        finalAmount1,
        userAddress
      )
    );

    return calls;
  }

  /**
   * Gets the calls needed to import a memecoin to Flaunch and single-sided liquidity in coin (from current tick to infinity) to AnyPositionManager as a batch
   * @param params - Parameters for importing and adding liquidity with initial market cap
   * @returns Array of calls with descriptions
   *
   * @example
   * ```typescript
   * const calls = await sdk.getImportAndSingleSidedCoinAddLiquidityCalls({
   *   coinAddress: "0x...",
   *   verifier: Verifier.CLANKER,
   *   creatorFeeAllocationPercent: 5,
   *   coinAmount: parseEther("1000"),
   *   initialMarketCapUSD: 50000
   * });
   * ```
   */
  async getImportAndSingleSidedCoinAddLiquidityCalls(
    params: ImportAndSingleSidedCoinAddLiquidityWithMarketCap
  ): Promise<CallWithDescription[]>;

  /**
   * Gets the calls needed to import a memecoin to Flaunch and single-sided liquidity in coin (from current tick to infinity) to AnyPositionManager as a batch
   * @param params - Parameters for importing and adding liquidity with initial price
   * @returns Array of calls with descriptions
   *
   * @example
   * ```typescript
   * const calls = await sdk.getImportAndSingleSidedCoinAddLiquidityCalls({
   *   coinAddress: "0x...",
   *   verifier: Verifier.CLANKER,
   *   creatorFeeAllocationPercent: 5,
   *   coinAmount: parseEther("1000"),
   *   initialPriceUSD: 0.001
   * });
   * ```
   */
  async getImportAndSingleSidedCoinAddLiquidityCalls(
    params: ImportAndSingleSidedCoinAddLiquidityWithPrice
  ): Promise<CallWithDescription[]>;

  // Implementation with union type for internal use
  async getImportAndSingleSidedCoinAddLiquidityCalls(
    params: ImportAndSingleSidedCoinAddLiquidityParams
  ): Promise<CallWithDescription[]> {
    let importParams;
    if ("initialMarketCapUSD" in params) {
      const paramsWithMarketCap =
        params as ImportAndSingleSidedCoinAddLiquidityParams & {
          initialMarketCapUSD: number;
        };
      importParams = await this.readWriteTokenImporter.getInitializeParams({
        coinAddress: paramsWithMarketCap.coinAddress,
        creatorFeeAllocationPercent:
          paramsWithMarketCap.creatorFeeAllocationPercent,
        initialMarketCapUSD: paramsWithMarketCap.initialMarketCapUSD,
        verifier: paramsWithMarketCap.verifier,
      });
    } else {
      const paramsWithPrice =
        params as ImportAndSingleSidedCoinAddLiquidityParams & {
          initialPriceUSD: number;
        };
      importParams = await this.readWriteTokenImporter.getInitializeParams({
        coinAddress: paramsWithPrice.coinAddress,
        creatorFeeAllocationPercent:
          paramsWithPrice.creatorFeeAllocationPercent,
        initialPriceUSD: paramsWithPrice.initialPriceUSD,
        verifier: paramsWithPrice.verifier,
      });
    }

    const addLiquidityCalls = await this.getSingleSidedCoinAddLiquidityCalls({
      ...params,
      version: FlaunchVersion.ANY, // optimize to avoid fetching if not passed
    });

    return [
      {
        to: this.readWriteTokenImporter.contract.address,
        data: this.readWriteTokenImporter.contract.encodeFunctionData(
          "initialize",
          importParams
        ),
        description: "Import Memecoin to Flaunch",
      },
      ...addLiquidityCalls,
    ];
  }

  /**
   * === Private helper functions ===
   */

  /**
   * Calculates and constrains liquidity amounts for a position
   * @param currentTick - Current pool tick
   * @param tickLower - Lower tick of the position
   * @param tickUpper - Upper tick of the position
   * @param amount0 - Amount of currency0
   * @param amount1 - Amount of currency1
   * @returns Final liquidity and amounts
   */
  private calculateConstrainedLiquidity(
    currentTick: number,
    tickLower: number,
    tickUpper: number,
    amount0: bigint,
    amount1: bigint
  ): {
    finalLiquidity: bigint;
    finalAmount0: bigint;
    finalAmount1: bigint;
  } {
    // Calculate liquidity first using user's input amounts
    const initialLiquidity = getLiquidityFromAmounts({
      currentTick,
      tickLower,
      tickUpper,
      amount0,
      amount1,
    });

    // Calculate the actual amounts needed for this liquidity
    const actualAmounts = getAmountsForLiquidity({
      currentTick,
      tickLower,
      tickUpper,
      liquidity: initialLiquidity,
    });

    // Check if actual amounts exceed user input - if so, constrain them
    let finalLiquidity = initialLiquidity;
    let finalAmount0 = actualAmounts.amount0;
    let finalAmount1 = actualAmounts.amount1;

    // If actual amounts exceed user input, we need to recalculate with constraints
    if (actualAmounts.amount0 > amount0 || actualAmounts.amount1 > amount1) {
      console.log("Actual amounts exceed user input, constraining...");

      // Calculate liquidity constrained by each amount separately
      const liquidity0Constrained = getLiquidityFromAmounts({
        currentTick,
        tickLower,
        tickUpper,
        amount0,
        amount1: 0n, // Only constrain by amount0
      });

      const liquidity1Constrained = getLiquidityFromAmounts({
        currentTick,
        tickLower,
        tickUpper,
        amount0: 0n, // Only constrain by amount1
        amount1,
      });

      // Use the smaller liquidity to ensure we don't exceed either amount
      finalLiquidity =
        liquidity0Constrained < liquidity1Constrained
          ? liquidity0Constrained
          : liquidity1Constrained;

      // Recalculate amounts for the constrained liquidity
      const constrainedAmounts = getAmountsForLiquidity({
        currentTick,
        tickLower,
        tickUpper,
        liquidity: finalLiquidity,
      });

      finalAmount0 = constrainedAmounts.amount0;
      finalAmount1 = constrainedAmounts.amount1;
    }

    // IMPORTANT: Add conservative buffer to account for contract rounding differences
    // Reduce liquidity by 0.05% to ensure contract calculations stay within user bounds
    const liquidityBuffer = finalLiquidity / 2000n; // 0.05%
    const conservativeLiquidity =
      finalLiquidity - (liquidityBuffer > 1n ? liquidityBuffer : 1n);

    // Use conservative liquidity but keep user's original amounts as maximums
    // The conservative liquidity ensures the contract won't need more than user provided
    if (currentTick !== undefined) {
      // If pool is already initialized then use conservative liquidity
      // as a new pool would accept any liquidity amounts given by us
      finalLiquidity = conservativeLiquidity;
    }
    finalAmount0 = amount0; // Use user's full amount as maximum
    finalAmount1 = amount1; // Use user's full amount as maximum

    return {
      finalLiquidity,
      finalAmount0,
      finalAmount1,
    };
  }

  /**
   * Creates the UniV4 Position Manager liquidity call
   * @param poolKey - The pool key
   * @param tickLower - Lower tick of the position
   * @param tickUpper - Upper tick of the position
   * @param finalLiquidity - Final liquidity amount
   * @param finalAmount0 - Final amount of currency0
   * @param finalAmount1 - Final amount of currency1
   * @param userAddress - User's address
   * @returns CallWithDescription for adding liquidity
   */
  private createLiquidityCall(
    poolKey: any,
    tickLower: number,
    tickUpper: number,
    finalLiquidity: bigint,
    finalAmount0: bigint,
    finalAmount1: bigint,
    userAddress: string
  ): CallWithDescription {
    // Prepare mint position parameters
    const V4PMActions = {
      MINT_POSITION: "02",
      SETTLE_PAIR: "0d",
    };

    const v4Actions = ("0x" +
      V4PMActions.MINT_POSITION +
      V4PMActions.SETTLE_PAIR) as Hex;

    // Validate hookData format
    const validHookData = "0x" as Hex; // Empty hook data for now

    const UniV4PM_MintPositionAbi = [
      {
        type: "tuple",
        components: [
          { type: "address", name: "currency0" },
          { type: "address", name: "currency1" },
          { type: "uint24", name: "fee" },
          { type: "int24", name: "tickSpacing" },
          { type: "address", name: "hooks" },
        ],
      },
      { type: "int24", name: "tickLower" },
      { type: "int24", name: "tickUpper" },
      { type: "uint256", name: "liquidity" },
      { type: "uint128", name: "amount0Max" },
      { type: "uint128", name: "amount1Max" },
      { type: "address", name: "owner" },
      { type: "bytes", name: "hookData" },
    ] as const;

    const UniV4PM_SettlePairAbi = [
      {
        type: "tuple",
        components: [
          { type: "address", name: "currency0" },
          { type: "address", name: "currency1" },
        ],
      },
    ] as const;

    const mintPositionParams = encodeAbiParameters(UniV4PM_MintPositionAbi, [
      poolKey,
      tickLower,
      tickUpper,
      finalLiquidity,
      finalAmount0,
      finalAmount1,
      userAddress as Address,
      validHookData,
    ]);

    const settlePairParams = encodeAbiParameters(UniV4PM_SettlePairAbi, [
      {
        currency0: poolKey.currency0,
        currency1: poolKey.currency1,
      },
    ]);

    return {
      to: UniV4PositionManagerAddress[this.chainId],
      data: encodeFunctionData({
        abi: [
          {
            inputs: [
              { internalType: "bytes", name: "unlockData", type: "bytes" },
              { internalType: "uint256", name: "deadline", type: "uint256" },
            ],
            name: "modifyLiquidities",
            outputs: [],
            stateMutability: "payable",
            type: "function",
          },
        ],
        functionName: "modifyLiquidities",
        args: [
          encodeAbiParameters(
            [
              { type: "bytes", name: "actions" },
              { type: "bytes[]", name: "params" },
            ],
            [v4Actions, [mintPositionParams, settlePairParams]]
          ),
          BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
        ],
      }),
      value: 0n,
      description: "Add Liquidity",
    };
  }
}
