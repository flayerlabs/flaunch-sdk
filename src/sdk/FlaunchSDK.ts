import {
  createDrift,
  Drift,
  ReadWriteAdapter,
  type Address,
  type HexString,
} from "@delvtech/drift";
import {
  ReadFlaunchPositionManager,
  ReadWriteFlaunchPositionManager,
  WatchPoolCreatedParams,
  FlaunchParams,
  FlaunchIPFSParams,
  PoolSwapLogs,
} from "../clients/FlaunchPositionManagerClient";
import {
  ReadPoolManager,
  PositionInfoParams,
} from "../clients/PoolManagerClient";
import { ReadFairLaunch } from "../clients/FairLaunchClient";
import {
  ReadWriteFastFlaunchZap,
  FastFlaunchParams,
  FastFlaunchIPFSParams,
} from "../clients/FastFlaunchClient";
import {
  FlaunchPositionManagerAddress,
  PoolManagerAddress,
  FLETHAddress,
  FairLaunchAddress,
  FastFlaunchZapAddress,
} from "../addresses";
import {
  getPoolId,
  orderPoolKey,
  getValidTick,
  calculateUnderlyingTokenBalances,
} from "../utils/univ4";

export class ReadFlaunchSDK {
  public readonly drift: Drift;
  public readonly chainId: number;
  TICK_SPACING = 60;
  readPositionManager: ReadFlaunchPositionManager;
  readPoolManager: ReadPoolManager;
  readFairLaunch: ReadFairLaunch;

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
    this.readFairLaunch = new ReadFairLaunch(
      FairLaunchAddress[this.chainId],
      drift
    );
  }

  isValidCoin(coinAddress: Address) {
    return this.readPositionManager.isValidCoin(coinAddress);
  }

  watchPoolCreated(params: WatchPoolCreatedParams) {
    return this.readPositionManager.watchPoolCreated(params);
  }

  watchPoolSwap(params: {
    onPoolSwap: ({
      logs,
      isFetchingFromStart,
    }: {
      logs: PoolSwapLogs;
      isFetchingFromStart: boolean;
    }) => void;
    startBlockNumber?: bigint;
    filterByCoin?: Address;
  }) {
    return this.readPositionManager.watchPoolSwap({
      ...params,
      filterByPoolId: params.filterByCoin
        ? this.poolId(params.filterByCoin)
        : undefined,
      flETHIsCurrencyZero: this.flETHIsCurrencyZero(params.filterByCoin),
    });
  }

  positionInfo(params: PositionInfoParams) {
    return this.readPoolManager.positionInfo(params);
  }

  async currentTick(coinAddress: Address) {
    const poolId = this.poolId(coinAddress);

    const poolState = await this.readPoolManager.poolSlot0({ poolId });
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

  async fairLaunchInfo(coinAddress: Address) {
    const poolId = this.poolId(coinAddress);
    return this.readFairLaunch.fairLaunchInfo({ poolId });
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

    const { liquidity } = await this.readPoolManager.positionInfo({
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
  readWritePositionManager: ReadWriteFlaunchPositionManager;
  readWriteFastFlaunchZap: ReadWriteFastFlaunchZap;

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
    return this.readWriteFastFlaunchZap.fastFlaunch(params);
  }

  fastFlaunchIPFS(params: FastFlaunchIPFSParams) {
    return this.readWriteFastFlaunchZap.fastFlaunchIPFS(params);
  }
}
