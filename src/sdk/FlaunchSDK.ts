import {
  createDrift,
  Drift,
  HexString,
  ReadWriteAdapter,
  type Address,
} from "@delvtech/drift";
import {
  ReadFlaunchPositionManager,
  ReadWriteFlaunchPositionManager,
  WatchPoolCreatedParams,
  FlaunchParams,
  FlaunchIPFSParams,
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
import { ReadFlaunch } from "../clients/FlaunchClient";
import { ReadMemecoin } from "../clients/MemecoinClient";
import { ReadQuoter } from "clients/QuoterClient";
import {
  FlaunchPositionManagerAddress,
  StateViewAddress,
  PoolManagerAddress,
  FLETHAddress,
  FairLaunchAddress,
  FastFlaunchZapAddress,
  FlaunchAddress,
  BidWallAddress,
  UniversalRouterAddress,
  QuoterAddress,
  Permit2Address,
} from "../addresses";
import {
  getPoolId,
  orderPoolKey,
  getValidTick,
  calculateUnderlyingTokenBalances,
  TickFinder,
  TICK_SPACING,
} from "../utils/univ4";
import { CoinMetadata } from "types";
import axios from "axios";
import { resolveIPFS } from "../helpers/ipfs";
import {
  ethToMemecoin,
  memecoinToEthWithPermit2,
  getAmountWithSlippage,
  PermitSingle,
  getPermit2TypedData,
} from "utils/universalRouter";
import { UniversalRouterAbi } from "abi/UniversalRouter";
import { ReadPermit2 } from "clients/Permit2Client";
import { zeroAddress } from "viem";

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

export class ReadFlaunchSDK {
  public readonly drift: Drift;
  public readonly chainId: number;
  public readonly TICK_SPACING = TICK_SPACING;
  public readonly readPositionManager: ReadFlaunchPositionManager;
  public readonly readPoolManager: ReadPoolManager;
  public readonly readStateView: ReadStateView;
  public readonly readFairLaunch: ReadFairLaunch;
  public readonly readBidWall: ReadBidWall;
  public readonly readFlaunch: ReadFlaunch;
  public readonly readQuoter: ReadQuoter;
  public readonly readPermit2: ReadPermit2;

  constructor(chainId: number, drift: Drift = createDrift()) {
    this.chainId = chainId;
    this.drift = drift;
    this.readPositionManager = new ReadFlaunchPositionManager(
      FlaunchPositionManagerAddress[this.chainId],
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
    this.readBidWall = new ReadBidWall(BidWallAddress[this.chainId], drift);
    this.readFlaunch = new ReadFlaunch(FlaunchAddress[this.chainId], drift);
    this.readQuoter = new ReadQuoter(
      this.chainId,
      QuoterAddress[this.chainId],
      drift
    );
    this.readPermit2 = new ReadPermit2(Permit2Address[this.chainId], drift);
  }

  isValidCoin(coinAddress: Address) {
    return this.readPositionManager.isValidCoin(coinAddress);
  }

  async getCoinMetadata(
    coinAddress: Address
  ): Promise<CoinMetadata & { symbol: string }> {
    const memecoin = new ReadMemecoin(coinAddress, this.drift);
    const name = await memecoin.name();
    const symbol = await memecoin.symbol();
    const tokenURI = await memecoin.tokenURI();

    // get metadata from tokenURI
    const metadata = (await axios.get(resolveIPFS(tokenURI))).data;

    return {
      name,
      symbol,
      description: metadata.description ?? "",
      image: metadata.image ? resolveIPFS(metadata.image) : "",
      external_link: metadata.websiteUrl ?? "",
      collaborators: metadata.collaborators ?? [],
      discordUrl: metadata.discordUrl ?? "",
      twitterUrl: metadata.twitterUrl ?? "",
      telegramUrl: metadata.telegramUrl ?? "",
    };
  }

  watchPoolCreated(params: WatchPoolCreatedParams) {
    return this.readPositionManager.watchPoolCreated(params);
  }

  pollPoolCreatedNow() {
    const poll = this.readPositionManager.pollPoolCreatedNow;
    if (!poll) {
      return undefined;
    }

    return poll();
  }

  watchPoolSwap(params: WatchPoolSwapParams) {
    return this.readPositionManager.watchPoolSwap<boolean>({
      ...params,
      filterByPoolId: params.filterByCoin
        ? this.poolId(params.filterByCoin)
        : undefined,
      flETHIsCurrencyZero: this.flETHIsCurrencyZero(params.filterByCoin),
    });
  }

  pollPoolSwapNow() {
    const poll = this.readPositionManager.pollPoolSwapNow;
    if (!poll) {
      return undefined;
    }

    return poll();
  }

  positionInfo(params: PositionInfoParams) {
    return this.readStateView.positionInfo(params);
  }

  async currentTick(coinAddress: Address) {
    const poolId = this.poolId(coinAddress);

    const poolState = await this.readStateView.poolSlot0({ poolId });
    return poolState.tick;
  }

  async coinPriceInETH(coinAddress: Address) {
    const isFLETHZero = this.flETHIsCurrencyZero(coinAddress);
    const currentTick = await this.currentTick(coinAddress);

    const price = Math.pow(1.0001, currentTick);

    let ethPerCoin = 0;
    if (isFLETHZero) {
      ethPerCoin = 1 / price;
    } else {
      ethPerCoin = price;
    }

    return ethPerCoin.toFixed(18);
  }

  // optionally pass in a drift instance to get the price from Base Mainnet
  async getETHUSDCPrice(drift?: Drift) {
    if (drift) {
      const chainId = await drift.getChainId();
      const quoter = new ReadQuoter(chainId, QuoterAddress[chainId], drift);
      return quoter.getETHUSDCPrice();
    }

    return this.readQuoter.getETHUSDCPrice();
  }

  async fairLaunchInfo(coinAddress: Address) {
    const poolId = this.poolId(coinAddress);
    return this.readFairLaunch.fairLaunchInfo({ poolId });
  }

  isFairLaunchActive(coinAddress: Address) {
    const poolId = this.poolId(coinAddress);
    return this.readFairLaunch.isFairLaunchActive({ poolId });
  }

  fairLaunchDuration() {
    return 30 * 60; // 30 minutes
  }

  async initialTick(coinAddress: Address) {
    const poolId = this.poolId(coinAddress);

    const fairLaunchInfo = await this.readFairLaunch.fairLaunchInfo({ poolId });
    return fairLaunchInfo.initialTick;
  }

  async fairLaunchETHOnlyPosition(coinAddress: Address) {
    const poolId = this.poolId(coinAddress);
    const initialTick = await this.initialTick(coinAddress);
    const currentTick = await this.currentTick(coinAddress);
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
      owner: FairLaunchAddress[this.chainId],
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

  async fairLaunchCoinOnlyPosition(coinAddress: Address) {
    const poolId = this.poolId(coinAddress);
    const initialTick = await this.initialTick(coinAddress);
    const currentTick = await this.currentTick(coinAddress);
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
      owner: FairLaunchAddress[this.chainId],
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

  async bidWallPosition(coinAddress: Address) {
    const poolId = this.poolId(coinAddress);
    const isFLETHZero = this.flETHIsCurrencyZero(coinAddress);

    const {
      amount0_: amount0,
      amount1_: amount1,
      pendingEth_: pendingEth,
    } = await this.readBidWall.position({ poolId });
    const { tickLower, tickUpper } = await this.readBidWall.poolInfo({
      poolId,
    });

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

  poolId(coinAddress: Address) {
    return getPoolId(
      orderPoolKey({
        currency0: FLETHAddress[this.chainId],
        currency1: coinAddress,
        fee: 0,
        tickSpacing: 60,
        hooks: FlaunchPositionManagerAddress[this.chainId],
      })
    );
  }

  flETHIsCurrencyZero(coinAddress: Address) {
    return coinAddress > FLETHAddress[this.chainId];
  }
}

export class ReadWriteFlaunchSDK extends ReadFlaunchSDK {
  public readonly readWritePositionManager: ReadWriteFlaunchPositionManager;
  public readonly readWriteFastFlaunchZap: ReadWriteFastFlaunchZap;

  constructor(chainId: number, drift: Drift<ReadWriteAdapter> = createDrift()) {
    super(chainId, drift);
    this.readWritePositionManager = new ReadWriteFlaunchPositionManager(
      FlaunchPositionManagerAddress[this.chainId],
      drift
    );
    this.readWriteFastFlaunchZap = new ReadWriteFastFlaunchZap(
      FastFlaunchZapAddress[this.chainId],
      drift
    );
  }

  flaunch(params: FlaunchParams) {
    return this.readWritePositionManager.flaunch(params);
  }

  flaunchIPFS(params: FlaunchIPFSParams) {
    return this.readWritePositionManager.flaunchIPFS(params);
  }

  fastFlaunch(params: FastFlaunchParams) {
    if (this.readWriteFastFlaunchZap.contract.address === zeroAddress) {
      throw new Error(
        `FastFlaunchZap is not deployed at chainId: ${this.chainId}`
      );
    }

    return this.readWriteFastFlaunchZap.fastFlaunch(params);
  }

  fastFlaunchIPFS(params: FastFlaunchIPFSParams) {
    if (this.readWriteFastFlaunchZap.contract.address === zeroAddress) {
      throw new Error(
        `FastFlaunchZap is not deployed at chainId: ${this.chainId}`
      );
    }

    return this.readWriteFastFlaunchZap.fastFlaunchIPFS(params);
  }

  async coinBalance(coinAddress: Address) {
    const user = await this.drift.getSignerAddress();
    const memecoin = new ReadMemecoin(coinAddress, this.drift);
    await memecoin.contract.cache.clear();
    return memecoin.balanceOf(user);
  }

  async buyCoin(params: BuyCoinParams) {
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
            amountIn
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
            amountOut
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

  async sellCoin(params: SellCoinParams) {
    let ethOutMin: bigint;

    await this.readQuoter.contract.cache.clear();

    if (params.ethOutMin === undefined) {
      ethOutMin = getAmountWithSlippage(
        await this.readQuoter.getSellQuoteExactInput(
          params.coinAddress,
          params.amountIn
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
}
