import {
  createDrift,
  Drift,
  HexString,
  ReadWriteAdapter,
  type Address,
} from "@delvtech/drift";
import {
  createPublicClient,
  decodeEventLog,
  http,
  zeroAddress,
  Hex,
  type TransactionReceipt,
  type Log,
  type GetContractEventsReturnType,
  encodeAbiParameters,
  parseUnits,
} from "viem";
import axios from "axios";
import {
  FlaunchPositionManagerAddress,
  StateViewAddress,
  PoolManagerAddress,
  FLETHAddress,
  FairLaunchAddress,
  FastFlaunchZapAddress,
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
} from "../addresses";
import {
  ReadFlaunchPositionManager,
  WatchPoolCreatedParams,
  WatchPoolSwapParams as WatchPoolSwapParamsPositionManager,
} from "../clients/FlaunchPositionManagerClient";
import {
  ReadPoolManager,
  PositionInfoParams,
} from "../clients/PoolManagerClient";
import { ReadStateView } from "../clients/StateViewClient";
import { ReadFairLaunch } from "../clients/FairLaunchClient";
import { ReadBidWall } from "../clients/BidWallClient";
import {
  ReadWriteFastFlaunchZap,
  FastFlaunchParams,
  FastFlaunchIPFSParams,
} from "../clients/FastFlaunchClient";
import {
  ReadFlaunchZap,
  ReadWriteFlaunchZap,
  FlaunchParams,
  FlaunchIPFSParams,
  FlaunchWithRevenueManagerParams,
  FlaunchWithRevenueManagerIPFSParams,
} from "../clients/FlaunchZapClient";
import { ReadFlaunch } from "../clients/FlaunchClient";
import { ReadMemecoin } from "../clients/MemecoinClient";
import { ReadQuoter } from "clients/QuoterClient";
import { ReadPermit2 } from "clients/Permit2Client";
import {
  ReadFlaunchPositionManagerV1_1,
  ReadWriteFlaunchPositionManagerV1_1,
} from "clients/FlaunchPositionManagerV1_1Client";
import { ReadBidWallV1_1 } from "clients/BidWallV1_1Client";
import { ReadFairLaunchV1_1 } from "clients/FairLaunchV1_1Client";
import { ReadFlaunchV1_1 } from "clients/FlaunchV1_1Client";
import { ReadWriteTreasuryManagerFactory } from "clients/TreasuryManagerFactoryClient";
import {
  ReadRevenueManager,
  ReadWriteRevenueManager,
} from "clients/RevenueManagerClient";
import { UniversalRouterAbi } from "abi/UniversalRouter";
import { CoinMetadata } from "types";
import {
  getPoolId,
  orderPoolKey,
  getValidTick,
  calculateUnderlyingTokenBalances,
  TickFinder,
  TICK_SPACING,
} from "../utils/univ4";
import {
  ethToMemecoin,
  memecoinToEthWithPermit2,
  getAmountWithSlippage,
  PermitSingle,
  getPermit2TypedData,
} from "utils/universalRouter";
import { resolveIPFS as defaultResolveIPFS } from "../helpers/ipfs";
import { chainIdToChain } from "helpers";
import { TreasuryManagerFactoryAbi } from "abi/TreasuryManagerFactory";
import { ReadMulticall } from "clients/MulticallClient";
import { MemecoinAbi } from "abi";

type WatchPoolSwapParams = Omit<
  WatchPoolSwapParamsPositionManager<boolean>,
  "flETHIsCurrencyZero"
> & {
  filterByCoin?: Address;
};

type BuyCoinBase = {
  coinAddress: Address;
  slippagePercent: number;
  referrer?: Address;
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
  ethOutMin?: bigint;
  referrer?: Address;
  permitSingle?: PermitSingle;
  signature?: HexString;
};

/**
 * Base class for interacting with Flaunch protocol in read-only mode
 */
export class ReadFlaunchSDK {
  public readonly drift: Drift;
  public readonly chainId: number;
  public readonly TICK_SPACING = TICK_SPACING;
  public readonly readPositionManager: ReadFlaunchPositionManager;
  public readonly readPositionManagerV1_1: ReadFlaunchPositionManagerV1_1;
  public readonly readFlaunchZap: ReadFlaunchZap;
  public readonly readPoolManager: ReadPoolManager;
  public readonly readStateView: ReadStateView;
  public readonly readFairLaunch: ReadFairLaunch;
  public readonly readFairLaunchV1_1: ReadFairLaunchV1_1;
  public readonly readBidWall: ReadBidWall;
  public readonly readBidWallV1_1: ReadBidWallV1_1;
  public readonly readFlaunch: ReadFlaunch;
  public readonly readFlaunchV1_1: ReadFlaunchV1_1;
  public readonly readQuoter: ReadQuoter;
  public readonly readPermit2: ReadPermit2;
  public resolveIPFS: (value: string) => string;

  constructor(chainId: number, drift: Drift = createDrift()) {
    this.chainId = chainId;
    this.drift = drift;
    this.resolveIPFS = defaultResolveIPFS;
    this.readPositionManager = new ReadFlaunchPositionManager(
      FlaunchPositionManagerAddress[this.chainId],
      drift
    );
    this.readPositionManagerV1_1 = new ReadFlaunchPositionManagerV1_1(
      FlaunchPositionManagerV1_1Address[this.chainId],
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
    this.readFlaunch = new ReadFlaunch(FlaunchAddress[this.chainId], drift);
    this.readFlaunchV1_1 = new ReadFlaunchV1_1(
      FlaunchV1_1Address[this.chainId],
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
   * Checks if a given coin address is a valid Flaunch coin (either V1 or V1.1)
   * @param coinAddress - The address of the coin to check
   * @returns Promise<boolean> - True if the coin is valid, false otherwise
   */
  async isValidCoin(coinAddress: Address) {
    return (
      (await this.readPositionManagerV1_1.isValidCoin(coinAddress)) ||
      (await this.readPositionManager.isValidCoin(coinAddress))
    );
  }

  /**
   * Checks if a given coin address is a V1 Flaunch coin
   * @param coinAddress - The address of the coin to check
   * @returns Promise<boolean> - True if the coin is V1, false if V1.1
   */
  async isV1Coin(coinAddress: Address): Promise<boolean> {
    return this.readPositionManager.isValidCoin(coinAddress);
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
   * Watches for pool creation events on V1 contracts
   * @param params - Parameters for watching pool creation
   * @returns Subscription to pool creation events
   */
  watchPoolCreatedV1(params: WatchPoolCreatedParams) {
    return this.readPositionManager.watchPoolCreated(params);
  }

  /**
   * Watches for pool creation events on V1.1 contracts
   * @param params - Parameters for watching pool creation
   * @returns Subscription to pool creation events
   */
  watchPoolCreated(params: WatchPoolCreatedParams) {
    return this.readPositionManagerV1_1.watchPoolCreated(params);
  }

  /**
   * Polls for current pool creation events on V1 contracts
   * @returns Current pool creation events or undefined if polling is not available
   */
  pollPoolCreatedNowV1() {
    const poll = this.readPositionManager.pollPoolCreatedNow;
    if (!poll) {
      return undefined;
    }

    return poll();
  }

  /**
   * Polls for current pool creation events on V1.1 contracts
   * @returns Current pool creation events or undefined if polling is not available
   */
  pollPoolCreatedNow() {
    const poll = this.readPositionManagerV1_1.pollPoolCreatedNow;
    if (!poll) {
      return undefined;
    }

    return poll();
  }

  /**
   * Watches for pool swap events on V1 contracts
   * @param params - Parameters for watching pool swaps including optional coin filter
   * @returns Subscription to pool swap events
   */
  async watchPoolSwapV1(params: WatchPoolSwapParams) {
    return this.readPositionManager.watchPoolSwap<boolean>({
      ...params,
      filterByPoolId: params.filterByCoin
        ? await this.poolId(params.filterByCoin, true)
        : undefined,
      flETHIsCurrencyZero: this.flETHIsCurrencyZero(params.filterByCoin),
    });
  }

  /**
   * Watches for pool swap events on V1.1 contracts
   * @param params - Parameters for watching pool swaps including optional coin filter
   * @returns Subscription to pool swap events
   */
  async watchPoolSwap(params: WatchPoolSwapParams) {
    return this.readPositionManagerV1_1.watchPoolSwap<boolean>({
      ...params,
      filterByPoolId: params.filterByCoin
        ? await this.poolId(params.filterByCoin)
        : undefined,
      flETHIsCurrencyZero: this.flETHIsCurrencyZero(params.filterByCoin),
    });
  }

  /**
   * Polls for current pool swap events on V1 contracts
   * @returns Current pool swap events or undefined if polling is not available
   */
  pollPoolSwapNowV1() {
    const poll = this.readPositionManager.pollPoolSwapNow;
    if (!poll) {
      return undefined;
    }

    return poll();
  }

  /**
   * Polls for current pool swap events on V1.1 contracts
   * @returns Current pool swap events or undefined if polling is not available
   */
  pollPoolSwapNow() {
    const poll = this.readPositionManagerV1_1.pollPoolSwapNow;
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
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Promise<number> - The current tick of the pool
   */
  async currentTick(coinAddress: Address, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(coinAddress);
    }
    const poolId = await this.poolId(coinAddress, isV1Coin);

    const poolState = await this.readStateView.poolSlot0({ poolId });
    return poolState.tick;
  }

  /**
   * Calculates the coin price in ETH based on the current tick
   * @param coinAddress - The address of the coin
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Promise<string> - The price of the coin in ETH with 18 decimals precision
   */
  async coinPriceInETH(coinAddress: Address, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(coinAddress);
    }
    const isFLETHZero = this.flETHIsCurrencyZero(coinAddress);
    const currentTick = await this.currentTick(coinAddress, isV1Coin);

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

  /**
   * Gets information about a fair launch for a given coin
   * @param coinAddress - The address of the coin
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Fair launch information from the appropriate contract version
   */
  async fairLaunchInfo(coinAddress: Address, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(coinAddress);
    }
    const poolId = await this.poolId(coinAddress, isV1Coin);
    return isV1Coin
      ? this.readFairLaunch.fairLaunchInfo({ poolId })
      : this.readFairLaunchV1_1.fairLaunchInfo({ poolId });
  }

  /**
   * Checks if a fair launch is currently active for a given coin
   * @param coinAddress - The address of the coin
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Promise<boolean> - True if fair launch is active, false otherwise
   */
  async isFairLaunchActive(coinAddress: Address, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(coinAddress);
    }
    const poolId = await this.poolId(coinAddress, isV1Coin);
    return isV1Coin
      ? this.readFairLaunch.isFairLaunchActive({ poolId })
      : this.readFairLaunchV1_1.isFairLaunchActive({ poolId });
  }

  /**
   * Gets the duration of a fair launch for a given coin
   * @param coinAddress - The address of the coin
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Promise<number> - The duration in seconds (30 minutes for V1, variable for V1.1)
   */
  async fairLaunchDuration(coinAddress: Address, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(coinAddress);
    }
    if (isV1Coin) {
      return 30 * 60; // 30 minutes
    }

    const poolId = await this.poolId(coinAddress, isV1Coin);
    return this.readFairLaunchV1_1.fairLaunchDuration({ poolId });
  }

  /**
   * Gets the initial tick for a fair launch
   * @param coinAddress - The address of the coin
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Promise<number> - The initial tick value
   */
  async initialTick(coinAddress: Address, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(coinAddress);
    }
    const poolId = await this.poolId(coinAddress, isV1Coin);

    const fairLaunchInfo = isV1Coin
      ? await this.readFairLaunch.fairLaunchInfo({ poolId })
      : await this.readFairLaunchV1_1.fairLaunchInfo({ poolId });
    return fairLaunchInfo.initialTick;
  }

  /**
   * Gets information about the ETH-only position in a fair launch
   * @param coinAddress - The address of the coin
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Promise<{flETHAmount: bigint, coinAmount: bigint, tickLower: number, tickUpper: number}> - Position details
   */
  async fairLaunchETHOnlyPosition(coinAddress: Address, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(coinAddress);
    }
    const poolId = await this.poolId(coinAddress, isV1Coin);
    const initialTick = await this.initialTick(coinAddress, isV1Coin);
    const currentTick = await this.currentTick(coinAddress, isV1Coin);
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
      owner: isV1Coin
        ? FairLaunchAddress[this.chainId]
        : FairLaunchV1_1Address[this.chainId],
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
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Promise<{flETHAmount: bigint, coinAmount: bigint, tickLower: number, tickUpper: number}> - Position details
   */
  async fairLaunchCoinOnlyPosition(coinAddress: Address, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(coinAddress);
    }
    const poolId = await this.poolId(coinAddress, isV1Coin);
    const initialTick = await this.initialTick(coinAddress, isV1Coin);
    const currentTick = await this.currentTick(coinAddress, isV1Coin);
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
      owner: isV1Coin
        ? FairLaunchAddress[this.chainId]
        : FairLaunchV1_1Address[this.chainId],
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
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Promise<{flETHAmount: bigint, coinAmount: bigint, pendingEth: bigint, tickLower: number, tickUpper: number}> - Bid wall position details
   */
  async bidWallPosition(coinAddress: Address, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(coinAddress);
    }
    const poolId = await this.poolId(coinAddress, isV1Coin);
    const isFLETHZero = this.flETHIsCurrencyZero(coinAddress);

    const {
      amount0_: amount0,
      amount1_: amount1,
      pendingEth_: pendingEth,
    } = isV1Coin
      ? await this.readBidWall.position({ poolId })
      : await this.readBidWallV1_1.position({ poolId });
    const { tickLower, tickUpper } = isV1Coin
      ? await this.readBidWall.poolInfo({ poolId })
      : await this.readBidWallV1_1.poolInfo({ poolId });

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
   * Gets the pool ID for a given coin
   * @param coinAddress - The address of the coin
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Promise<string> - The pool ID
   */
  async poolId(coinAddress: Address, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(coinAddress);
    }
    return getPoolId(
      orderPoolKey({
        currency0: FLETHAddress[this.chainId],
        currency1: coinAddress,
        fee: 0,
        tickSpacing: 60,
        hooks: isV1Coin
          ? FlaunchPositionManagerAddress[this.chainId]
          : FlaunchPositionManagerV1_1Address[this.chainId],
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
}

export class ReadWriteFlaunchSDK extends ReadFlaunchSDK {
  declare drift: Drift<ReadWriteAdapter>;
  public readonly readWritePositionManagerV1_1: ReadWriteFlaunchPositionManagerV1_1;
  public readonly readWriteFastFlaunchZap: ReadWriteFastFlaunchZap;
  public readonly readWriteFlaunchZap: ReadWriteFlaunchZap;
  public readonly readWriteTreasuryManagerFactory: ReadWriteTreasuryManagerFactory;

  constructor(chainId: number, drift: Drift<ReadWriteAdapter> = createDrift()) {
    super(chainId, drift);
    this.readWritePositionManagerV1_1 = new ReadWriteFlaunchPositionManagerV1_1(
      FlaunchPositionManagerAddress[this.chainId],
      drift
    );
    this.readWriteFastFlaunchZap = new ReadWriteFastFlaunchZap(
      FastFlaunchZapAddress[this.chainId],
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
      drift
    );
  }

  /**
   * Deploys a new revenue manager
   * @param params - Parameters for deploying the revenue manager
   * @param params.protocolRecipient - The address of the protocol recipient
   * @param params.protocolFeePercent - The percentage of the protocol fee
   * @returns Address of the deployed revenue manager
   */
  async deployRevenueManager(params: {
    protocolRecipient: Address;
    protocolFeePercent: number;
  }): Promise<Address> {
    const hash =
      await this.readWriteTreasuryManagerFactory.deployRevenueManager(params);

    // Create a public client to get the transaction receipt with logs
    const publicClient = createPublicClient({
      chain: chainIdToChain[this.chainId],
      transport: http(),
    });

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Get the logs from the receipt and find the ManagerDeployed event
    const events = await publicClient.getContractEvents({
      address: this.readWriteTreasuryManagerFactory.contract.address,
      abi: TreasuryManagerFactoryAbi,
      eventName: "ManagerDeployed",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    // Find the event from our transaction
    const event = events.find((e) => e.transactionHash === hash);
    if (!event) {
      throw new Error("ManagerDeployed event not found in transaction logs");
    }

    return event.args._manager;
  }

  /**
   * Creates a new Flaunch on V1.1
   * @param params - Parameters for creating the Flaunch
   * @returns Transaction response
   */
  flaunch(params: FlaunchParams) {
    return this.readWriteFlaunchZap.flaunch(params);
  }

  /**
   * Creates a new Flaunch on V1.1 with IPFS metadata
   * @param params - Parameters for creating the Flaunch with IPFS data
   * @returns Transaction response
   */
  flaunchIPFS(params: FlaunchIPFSParams) {
    return this.readWriteFlaunchZap.flaunchIPFS(params);
  }

  /**
   * Creates a new fast Flaunch on V1.1
   * @param params - Parameters for creating the fast Flaunch
   * @throws Error if FastFlaunchZap is not deployed on the current chain
   * @returns Transaction response
   */
  fastFlaunch(params: FastFlaunchParams) {
    if (this.readWriteFastFlaunchZap.contract.address === zeroAddress) {
      throw new Error(
        `FastFlaunchZap is not deployed at chainId: ${this.chainId}`
      );
    }

    return this.readWriteFastFlaunchZap.fastFlaunch(params);
  }

  /**
   * Creates a new fast Flaunch on V1.1 with IPFS metadata
   * @param params - Parameters for creating the fast Flaunch with IPFS data
   * @throws Error if FastFlaunchZap is not deployed on the current chain
   * @returns Transaction response
   */
  fastFlaunchIPFS(params: FastFlaunchIPFSParams) {
    if (this.readWriteFastFlaunchZap.contract.address === zeroAddress) {
      throw new Error(
        `FastFlaunchZap is not deployed at chainId: ${this.chainId}`
      );
    }

    return this.readWriteFastFlaunchZap.fastFlaunchIPFS(params);
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
   * Buys a coin with ETH
   * @param params - Parameters for buying the coin including amount, slippage, and referrer
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Transaction response for the buy operation
   */
  async buyCoin(params: BuyCoinParams, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(params.coinAddress);
    }
    const sender = await this.drift.getSignerAddress();

    let amountIn: bigint | undefined;
    let amountOutMin: bigint | undefined;
    let amountOut: bigint | undefined;
    let amountInMax: bigint | undefined;

    await this.readQuoter.contract.cache.clear();

    if (params.swapType === "EXACT_IN") {
      amountIn = params.amountIn;
      if (params.amountOutMin === undefined) {
        amountOutMin = getAmountWithSlippage(
          await this.readQuoter.getBuyQuoteExactInput(
            params.coinAddress,
            amountIn,
            isV1Coin
          ),
          (params.slippagePercent / 100).toFixed(18).toString(),
          params.swapType
        );
      } else {
        amountOutMin = params.amountOutMin;
      }
    } else {
      amountOut = params.amountOut;
      if (params.amountInMax === undefined) {
        amountInMax = getAmountWithSlippage(
          await this.readQuoter.getBuyQuoteExactOutput(
            params.coinAddress,
            amountOut,
            isV1Coin
          ),
          (params.slippagePercent / 100).toFixed(18).toString(),
          params.swapType
        );
      } else {
        amountInMax = params.amountInMax;
      }
    }

    const { commands, inputs } = ethToMemecoin({
      sender: sender,
      memecoin: params.coinAddress,
      chainId: this.chainId,
      referrer: params.referrer,
      swapType: params.swapType,
      amountIn: amountIn,
      amountOutMin: amountOutMin,
      amountOut: amountOut,
      amountInMax: amountInMax,
      isV1Coin: isV1Coin,
    });

    return this.drift.adapter.write({
      abi: UniversalRouterAbi,
      address: UniversalRouterAddress[this.chainId],
      fn: "execute",
      args: {
        commands,
        inputs,
      },
      value: params.swapType === "EXACT_IN" ? amountIn : amountInMax,
    });
  }

  /**
   * Sells a coin for ETH
   * @param params - Parameters for selling the coin including amount, slippage, permit data, and referrer
   * @param isV1Coin - Optional flag to specify if coin is V1. If not provided, will be determined automatically
   * @returns Transaction response for the sell operation
   */
  async sellCoin(params: SellCoinParams, isV1Coin?: boolean) {
    if (isV1Coin === undefined) {
      isV1Coin = await this.isV1Coin(params.coinAddress);
    }
    let ethOutMin: bigint;

    await this.readQuoter.contract.cache.clear();

    if (params.ethOutMin === undefined) {
      ethOutMin = getAmountWithSlippage(
        await this.readQuoter.getSellQuoteExactInput(
          params.coinAddress,
          params.amountIn,
          isV1Coin
        ),
        (params.slippagePercent / 100).toFixed(18).toString(),
        "EXACT_IN"
      );
    } else {
      ethOutMin = params.ethOutMin;
    }

    await this.readPermit2.contract.cache.clear();

    const { commands, inputs } = memecoinToEthWithPermit2({
      chainId: this.chainId,
      memecoin: params.coinAddress,
      amountIn: params.amountIn,
      ethOutMin,
      permitSingle: params.permitSingle,
      signature: params.signature,
      referrer: params.referrer,
      isV1Coin: isV1Coin,
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
}
