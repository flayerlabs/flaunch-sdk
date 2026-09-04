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
  decodeEventLog,
  isAddressEqual,
  type Log,
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
  FeeEscrowV1_3Address,
  FlaunchManagerZapV1_3Address,
  TreasuryManagerFactoryV1_3Address,
  ReferralEscrowAddress,
  TokenImporterAddress,
  UniV4PositionManagerAddress,
  FlaunchPositionManagerV1_2Address,
  FlaunchV1_2Address,
  // v1.3.1 (GitHub release v1.3.1) - Base mainnet + Robinhood (4663)
  FlaunchPositionManagerV1_3Address,
  SupersededPositionManagerV1_3Address,
  FlaunchZapV1_3Address,
  PairedTokenPositionManagerV1_3Address,
  PairedTokenRegistryV1_3Address,
  PoolSwapV1_3Address,
  FlaunchV1_3Address,
  BidWallV1_3Address,
  FlaunchPositionManagerMultichainAddress,
  FlaunchZapMultichainAddress,
  // V1.2 and AnyPositionManager addresses will be imported here when available
  PoolSwapForHookV1_3Address,
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
  FlaunchWithDynamicSplitManagerParams,
  FlaunchWithDynamicSplitManagerIPFSParams,
  DeployRevenueManagerParams,
  DeployStakingManagerParams,
  DeployBuyBackManagerParams,
} from "../clients/FlaunchZapClient";
import { ReadWriteFlaunchZapMultichain } from "../clients/FlaunchZapMultichainClient";
import {
  type CalculatePairedTokenFlaunchFeeParams,
  type FlaunchPairedTokenParams,
  ReadFlaunchZapV1_3,
  ReadWriteFlaunchZapV1_3,
} from "../clients/FlaunchZapV1_3Client";
import { ReadPairedTokenRegistryV1_3 } from "../clients/PairedTokenRegistryV1_3Client";
import {
  ReadPoolSwapV1_3,
  ReadWritePoolSwapV1_3,
} from "../clients/PoolSwapV1_3Client";
import { ReadPairedTokenPositionManagerV1_3 } from "../clients/PairedTokenPositionManagerV1_3Client";
import {
  ReadPairedTokenAcquisition,
  type PairedTokenAcquisitionQuote,
} from "../clients/PairedTokenAcquisitionClient";
import {
  encodeAcquisitionEthBuy,
  encodeAcquisitionHubBuy,
  type PairedTokenAcquisitionInput,
  type PairedTokenAcquisitionRoute,
} from "../utils/pairedTokenAcquisition";
import {
  PoolSwapV1_3SwapWithHookDataAbi,
  PoolSwapV1_3SwapWithReferrerAbi,
} from "../abi/PoolSwapV1_3";
import { ReadFlaunch } from "../clients/FlaunchClient";
import { ReadAnyFlaunch } from "../clients/AnyFlaunchClient";
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
  ReadFeeEscrowV1_3,
  ReadWriteFeeEscrowV1_3,
  type EscrowTokenBalance,
} from "clients/FeeEscrowV1_3Client";
import {
  ReadTreasuryManagerV1_3,
  ReadWriteTreasuryManagerV1_3,
  type AssetBalance,
} from "clients/TreasuryManagerV1_3Client";
import {
  ReadRevenueManagerV1_3,
  ReadWriteRevenueManagerV1_3,
} from "clients/RevenueManagerV1_3Client";
import {
  ReadFlaunchManagerZapV1_3,
  ReadWriteFlaunchManagerZapV1_3,
} from "clients/FlaunchManagerZapV1_3Client";
import {
  ReadReferralEscrow,
  ReadWriteReferralEscrow,
} from "clients/ReferralEscrowClient";
import { ReadBidWallV1_1 } from "clients/BidWallV1_1Client";
import { ReadFairLaunchV1_1 } from "clients/FairLaunchV1_1Client";
import { ReadFlaunchV1_1 } from "clients/FlaunchV1_1Client";
import { ReadFlaunchV1_2 } from "clients/FlaunchV1_2Client";
import {
  ReadTreasuryManagerFactory,
  ReadWriteTreasuryManagerFactory,
} from "clients/TreasuryManagerFactoryClient";
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
import { FlaunchPositionManagerV1_2Abi } from "abi/FlaunchPositionManagerV1_2";
import { FlaunchPositionManagerV1_3Abi } from "abi/FlaunchPositionManagerV1_3";
import { FlaunchPositionManagerAbi } from "abi/FlaunchPositionManager";
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
  PoolKey,
  GetSingleSidedCoinAddLiquidityCallsParams,
  ImportAndAddLiquidityParams,
  ImportAndSingleSidedCoinAddLiquidityParams,
  ImportAndSingleSidedCoinAddLiquidityWithMarketCap,
  ImportAndSingleSidedCoinAddLiquidityWithPrice,
  ImportAndAddLiquidityWithMarketCap,
  ImportAndAddLiquidityWithPrice,
  ImportAndAddLiquidityWithExactAmounts,
  PoolCreatedEventData,
} from "types";
import {
  getPoolId,
  orderPoolKey,
  isZeroForOne,
  pairedTokenOfPoolKey,
  isEmptyPoolKey,
  sqrtPriceLimitFromSlippage,
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
import {
  isChainSupported,
  isMultichainDeployment,
  getV1_3PositionManagers,
  doesChainSupportMultiAssetManagers,
  doesChainSupportPairedTokenLaunch,
  doesChainSupportPairedTokenSwap,
  poolSwapForHook,
  doesChainSupportPairedTokenAcquisition,
} from "helpers/supportedChains";

// Re-export PoolCreatedEventData so it's available as part of FlaunchSDK module
export type { PoolCreatedEventData } from "types";

type WatchPoolSwapParams = Omit<
  WatchPoolSwapParamsPositionManager<boolean>,
  "flETHIsCurrencyZero"
> & {
  filterByCoin?: Address;
};

type BaseReadClients = {
  readPositionManager: ReadFlaunchPositionManager;
  readPositionManagerV1_1: ReadFlaunchPositionManagerV1_1;
  readPositionManagerV1_2: ReadFlaunchPositionManagerV1_2;
  // v1.3.1 clients are optional: they are built only on the base-clients path
  // (Base mainnet). Robinhood (4663) also runs v1.3.1 but is a multichain
  // deployment, so its v1.3.1 addresses resolve via the *V1_3Address maps. They reuse
  // the V1_2 / V1_1 client classes since v1.3.1 shares those ABIs/interfaces.
  readPositionManagerV1_3?: ReadFlaunchPositionManagerV1_2;
  readAnyPositionManager: ReadAnyPositionManager;
  readTokenImporter: ReadTokenImporter;
  readReferralEscrow: ReadReferralEscrow;
  readFlaunchZap: ReadFlaunchZap;
  readPoolManager: ReadPoolManager;
  readStateView: ReadStateView;
  readFairLaunch: ReadFairLaunch;
  readFairLaunchV1_1: ReadFairLaunchV1_1;
  readBidWall: ReadBidWall;
  readBidWallV1_1: ReadBidWallV1_1;
  readBidWallV1_3?: ReadBidWallV1_1;
  readAnyBidWall: AnyBidWall;
  readFlaunch: ReadFlaunch;
  readFlaunchV1_1: ReadFlaunchV1_1;
  readFlaunchV1_2: ReadFlaunchV1_2;
  readFlaunchV1_3?: ReadFlaunchV1_2;
  readAnyFlaunch: ReadAnyFlaunch;
};

type SwapReadClients = {
  readQuoter: ReadQuoter;
  readPermit2: ReadPermit2;
};

type BaseReadWriteClients = {
  readWritePositionManager: ReadWriteFlaunchPositionManager;
  readWritePositionManagerV1_1: ReadWriteFlaunchPositionManagerV1_1;
  readWriteAnyPositionManager: ReadWriteAnyPositionManager;
  readWriteTokenImporter: ReadWriteTokenImporter;
  readWriteReferralEscrow: ReadWriteReferralEscrow;
  readWriteFlaunchZap: ReadWriteFlaunchZap;
  readWriteTreasuryManagerFactory: ReadWriteTreasuryManagerFactory;
  readWritePermit2: ReadWritePermit2;
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
  hookData?: Hex; // for swaps when a signer-gated calculator is enabled; replaces the referrer encoding on the coin <> flETH hop
};

export type PairedSwapDirection = "buy" | "sell";

/**
 * An exact-input swap on a paired-token pool (a coin launched through `flaunchPairedToken`,
 * paired with mUSD, native ETH, flETH or a B20 equity). Exact-output is deliberately absent — the
 * spend gate rejects it, and PoolSwap has no `minOut` — so the only price protection is the
 * sqrt-price bound derived from `slippageBps`.
 */
export type PairedTokenSwapParams = {
  coinAddress: Address;
  /** The pool's paired side; resolved on chain from the PositionManager when omitted. `zeroAddress` = native ETH. */
  pairedToken?: Address;
  /** Exact input, in the input currency's own decimals (a buy spends the paired token, a sell spends the coin). */
  amountIn: bigint;
  /** Tolerance in basis points, 1..9999 (50 = 0.5%), enforced against the pool's current spot price. */
  slippageBps: number;
  /** Bytes for the pool's hook — a spend-gated pool's signed authorisation. */
  hookData?: Hex;
  /** Referral attribution; ignored when `hookData` is given (the gate's payload leads with the referrer). */
  referrer?: Address;
  /**
   * The wallet that will send the swap. Used for the ERC20 allowance check; defaults to the
   * drift signer. When neither is available the plan always includes the approve step.
   */
  sender?: Address;
  /**
   * When an approve is needed, approve this much instead of `amountIn` (must be ≥ `amountIn`). A
   * standing allowance — a round's wallet cap, say — turns every later buy into a single swap call.
   */
  approvalAllowance?: bigint;
  /**
   * The PoolSwap to route through. Defaults to the router approved on the spend gate of the hook
   * the coin's pool lives on (`poolSwapForHook`); a host that learned the router from the gate's
   * own `/config` passes it here.
   */
  router?: Address;
};

export type PairedTokenApprovalParams = {
  coinAddress: Address;
  pairedToken?: Address;
  /** The allowance to set when the current one is short of it. */
  amount: bigint;
  sender?: Address;
  router?: Address;
};

/** A routed buy of a non-ETH paired token (a B20 equity) from ETH or the chain's USD hub. */
/** {@link planPairedTokenSwap}'s input: the swap params plus which way the swap goes. */
export type PairedSwapPlanParams = PairedTokenSwapParams & {
  direction: PairedSwapDirection;
};

export type PairedTokenAcquisitionParams = {
  pairedToken: Address;
  input: PairedTokenAcquisitionInput;
  /** Exactly this much paired token is delivered (exact-output). */
  target: bigint;
  /** The most the router may spend — the price protection; native ETH travels as `value`. */
  maxIn: bigint;
  recipient: Address;
  /** Unix seconds; defaults to now + 10 minutes. */
  deadline?: bigint;
  /** For the hub-token allowance check; defaults to the drift signer, else the approve is always planned. */
  sender?: Address;
  /**
   * The venue to execute on. Defaults to the registry calculator's route — but a caller that
   * QUOTED first must pass the quote's route through, or the plan may execute on a different
   * pool than the one that priced the target (a better-priced venue's target can exceed what
   * the calculator pool delivers within `maxIn`, reverting the buy).
   */
  route?: PairedTokenAcquisitionRoute;
};

export type PairedTokenAcquisitionPlan = {
  route: PairedTokenAcquisitionRoute;
  input: PairedTokenAcquisitionInput;
  target: bigint;
  maxIn: bigint;
  /** Present for a hub-token input whose router allowance is short of `maxIn`. */
  approve?: PairedSwapApproveCall;
  /** The router call; `value` is `maxIn` for an ETH input (the router refunds the unspent part). */
  swap: PairedSwapCall;
};

export type PairedPoolQuoteParams = {
  coinAddress: Address;
  pairedToken?: Address;
  amountIn: bigint;
  direction?: PairedSwapDirection;
  hookData?: Hex;
  /** Simulate as this wallet — required when the hook binds `hookData` to a buyer. */
  userWallet?: Address;
};

export type ResolvedPairedPool = {
  poolKey: PoolKey;
  poolId: Hex;
  /** The non-coin side of the key; `zeroAddress` is native ETH. */
  pairedToken: Address;
};

export type PairedSwapCall = { to: Address; data: Hex; value: bigint };
export type PairedSwapApproveCall = PairedSwapCall & {
  token: Address;
  spender: Address;
  amount: bigint;
};

/**
 * Everything a host needs to execute a paired-token swap itself — as one batched
 * `wallet_sendCalls` or two sequential transactions: the optional ERC20 approve, then the PoolSwap
 * call. `buyCoinPairedToken` / `sellCoinPairedToken` run exactly this plan.
 */
export type PairedSwapPlan = ResolvedPairedPool & {
  direction: PairedSwapDirection;
  tokenIn: Address;
  tokenOut: Address;
  /** True for a buy on a native-ETH pool: `amountIn` travels as `swap.value`, no approve needed. */
  isNativeInput: boolean;
  zeroForOne: boolean;
  amountIn: bigint;
  sqrtPriceLimitX96: bigint;
  /** Present when the PoolSwap allowance is short of `amountIn` (never for native input). */
  approve?: PairedSwapApproveCall;
  swap: PairedSwapCall;
};

/**
 * Base class for interacting with Flaunch protocol in read-only mode
 */
/** An ERC20 `approve(spender, amount)` as the call object paired-token plans carry. */
function buildApproveCall(token: Address, spender: Address, amount: bigint): PairedSwapApproveCall {
  return {
    token,
    spender,
    amount,
    to: token,
    value: 0n,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] }),
  };
}

export class ReadFlaunchSDK {
  public readonly drift: Drift;
  public readonly chainId: number;
  public readonly publicClient: PublicClient | undefined;
  public readonly TICK_SPACING = TICK_SPACING;
  private readonly baseClients?: BaseReadClients;
  private readonly swapClients?: SwapReadClients;
  public readonly readFeeEscrow: ReadFeeEscrow;
  private readonly feeEscrowV1_3?: ReadFeeEscrowV1_3;
  private readonly flaunchManagerZapV1_3?: ReadFlaunchManagerZapV1_3;
  private readonly treasuryManagerFactoryV1_3?: ReadTreasuryManagerFactory;
  private readonly flaunchZapV1_3?: ReadFlaunchZapV1_3;
  private readonly pairedTokenRegistryV1_3?: ReadPairedTokenRegistryV1_3;
  private readonly poolSwapV1_3?: ReadPoolSwapV1_3;
  private readonly pairedTokenPositionManagerV1_3?: ReadPairedTokenPositionManagerV1_3;
  private pairedTokenAcquisition?: ReadPairedTokenAcquisition;
  /** StateView for paired-pool spot prices; separate from `baseClients` so multichain chains (Robinhood) have one too. */
  private readonly pairedSwapStateView?: ReadStateView;

  public resolveIPFS: (value: string) => string;

  /**
   * The v1.3.1 multi-token FeeEscrow. Throws on chains without one — gate with
   * `doesChainSupportMultiTokenFeeEscrow()`.
   */
  get readFeeEscrowV1_3(): ReadFeeEscrowV1_3 {
    if (!this.feeEscrowV1_3) {
      throw new Error(
        `Multi-token FeeEscrow is not supported on chain ${this.chainId}`
      );
    }
    return this.feeEscrowV1_3;
  }

  /**
   * The v1.3.1 FlaunchManagerZap, which deploys managers of the multi-asset generation.
   * Throws on chains without one — gate with `doesChainSupportMultiAssetManagers()`.
   */
  get readFlaunchManagerZapV1_3(): ReadFlaunchManagerZapV1_3 {
    if (!this.flaunchManagerZapV1_3) {
      throw new Error(
        `Multi-asset managers are not supported on chain ${this.chainId}`
      );
    }
    return this.flaunchManagerZapV1_3;
  }

  /**
   * The v1.3.1 TreasuryManagerFactory (multi-asset manager generation), used to resolve
   * `ManagerDeployed` events from that factory only. Throws on chains without one — gate
   * with `doesChainSupportMultiAssetManagers()`.
   */
  get readTreasuryManagerFactoryV1_3(): ReadTreasuryManagerFactory {
    if (!this.treasuryManagerFactoryV1_3) {
      throw new Error(
        `Multi-asset managers are not supported on chain ${this.chainId}`
      );
    }
    return this.treasuryManagerFactoryV1_3;
  }

  private getBaseClient<K extends keyof BaseReadClients>(
    name: K
  ): BaseReadClients[K] {
    const client = this.baseClients?.[name];
    if (!client) {
      throw new Error(`${name} is not supported on chain ${this.chainId}`);
    }
    return client;
  }

  private getSwapClient<K extends keyof SwapReadClients>(
    name: K
  ): SwapReadClients[K] {
    const client = this.swapClients?.[name];
    if (!client) {
      throw new Error(`${name} is not supported on chain ${this.chainId}`);
    }
    return client;
  }

  protected assertBaseOnlyOperation(operation: string) {
    if (isMultichainDeployment(this.chainId)) {
      throw new Error(`${operation} is not supported on chain ${this.chainId}`);
    }
  }

  /**
   * The v1.3.1 multi-asset manager generation is Base mainnet only; the `*V1_3` manager
   * methods refuse to run anywhere it is not deployed rather than sending calls that revert.
   */
  protected assertMultiAssetManagersSupported(operation: string) {
    if (!doesChainSupportMultiAssetManagers(this.chainId)) {
      throw new Error(
        `${operation} is not supported on chain ${this.chainId}: multi-asset managers are not deployed there`
      );
    }
  }

  get readPositionManager() {
    return this.getBaseClient("readPositionManager");
  }
  get readPositionManagerV1_1() {
    return this.getBaseClient("readPositionManagerV1_1");
  }
  get readPositionManagerV1_2() {
    return this.getBaseClient("readPositionManagerV1_2");
  }
  get readPositionManagerV1_3() {
    return this.baseClients?.readPositionManagerV1_3;
  }
  get readFlaunchZapV1_3(): ReadFlaunchZapV1_3 {
    if (!this.flaunchZapV1_3) {
      throw new Error(
        `Paired-token launches are not supported on chain ${this.chainId}`
      );
    }
    return this.flaunchZapV1_3;
  }
  get readPairedTokenRegistryV1_3(): ReadPairedTokenRegistryV1_3 {
    if (!this.pairedTokenRegistryV1_3) {
      throw new Error(
        `Paired-token launches are not supported on chain ${this.chainId}`
      );
    }
    return this.pairedTokenRegistryV1_3;
  }
  /**
   * The v1.3.1 PoolSwap router. Throws on chains without paired-token swap support — gate with
   * `doesChainSupportPairedTokenSwap()`.
   */
  get readPoolSwapV1_3(): ReadPoolSwapV1_3 {
    if (!this.poolSwapV1_3) {
      throw new Error(
        `Paired-token swaps are not supported on chain ${this.chainId}`
      );
    }
    return this.poolSwapV1_3;
  }
  /** The paired-token PositionManager V1.3 (pool keys, paired tokens). Same gate as `readPoolSwapV1_3`. */
  get readPairedTokenPositionManagerV1_3(): ReadPairedTokenPositionManagerV1_3 {
    if (!this.pairedTokenPositionManagerV1_3) {
      throw new Error(
        `Paired-token swaps are not supported on chain ${this.chainId}`
      );
    }
    return this.pairedTokenPositionManagerV1_3;
  }
  get readAnyPositionManager() {
    return this.getBaseClient("readAnyPositionManager");
  }
  get readTokenImporter() {
    return this.getBaseClient("readTokenImporter");
  }
  get readReferralEscrow() {
    return this.getBaseClient("readReferralEscrow");
  }
  get readFlaunchZap() {
    return this.getBaseClient("readFlaunchZap");
  }
  get readPoolManager() {
    return this.getBaseClient("readPoolManager");
  }
  get readStateView() {
    return this.getBaseClient("readStateView");
  }
  get readFairLaunch() {
    return this.getBaseClient("readFairLaunch");
  }
  get readFairLaunchV1_1() {
    return this.getBaseClient("readFairLaunchV1_1");
  }
  get readBidWall() {
    return this.getBaseClient("readBidWall");
  }
  get readBidWallV1_1() {
    return this.getBaseClient("readBidWallV1_1");
  }
  // v1.3.1 read clients exist only where baseClients are built (Base mainnet).
  // Robinhood (4663) also runs v1.3.1 but takes the multichain path, which does
  // not construct these — resolve its addresses from the *V1_3Address maps.
  // Null-safe access returns undefined elsewhere.
  get readBidWallV1_3() {
    return this.baseClients?.readBidWallV1_3;
  }
  get readAnyBidWall() {
    return this.getBaseClient("readAnyBidWall");
  }
  get readFlaunch() {
    return this.getBaseClient("readFlaunch");
  }
  get readFlaunchV1_1() {
    return this.getBaseClient("readFlaunchV1_1");
  }
  get readFlaunchV1_2() {
    return this.getBaseClient("readFlaunchV1_2");
  }
  // v1.3.1 read clients exist only where baseClients are built (Base mainnet).
  // Robinhood (4663) also runs v1.3.1 but takes the multichain path, which does
  // not construct these — resolve its addresses from the *V1_3Address maps.
  // Null-safe access returns undefined elsewhere.
  get readFlaunchV1_3() {
    return this.baseClients?.readFlaunchV1_3;
  }
  get readAnyFlaunch() {
    return this.getBaseClient("readAnyFlaunch");
  }
  get readQuoter() {
    return this.getSwapClient("readQuoter");
  }
  get readPermit2() {
    return this.getSwapClient("readPermit2");
  }

  constructor(
    chainId: number,
    drift: Drift = createDrift(),
    publicClient?: PublicClient
  ) {
    if (!isChainSupported(chainId)) {
      throw new Error(`Chain ${chainId} is not supported`);
    }

    this.chainId = chainId;
    this.drift = drift;
    this.publicClient = publicClient;
    this.resolveIPFS = defaultResolveIPFS;
    this.readFeeEscrow = new ReadFeeEscrow(
      FeeEscrowAddress[this.chainId],
      drift
    );
    const feeEscrowV1_3Address = FeeEscrowV1_3Address[this.chainId];
    if (feeEscrowV1_3Address) {
      this.feeEscrowV1_3 = new ReadFeeEscrowV1_3(feeEscrowV1_3Address, drift);
    }
    if (doesChainSupportMultiAssetManagers(this.chainId)) {
      this.flaunchManagerZapV1_3 = new ReadFlaunchManagerZapV1_3(
        this.chainId,
        FlaunchManagerZapV1_3Address[this.chainId],
        drift
      );
      this.treasuryManagerFactoryV1_3 = new ReadTreasuryManagerFactory(
        this.chainId,
        TreasuryManagerFactoryV1_3Address[this.chainId],
        drift,
        publicClient
      );
    }

    if (doesChainSupportPairedTokenLaunch(this.chainId)) {
      this.flaunchZapV1_3 = new ReadFlaunchZapV1_3(
        FlaunchZapV1_3Address[this.chainId],
        drift
      );
      this.pairedTokenRegistryV1_3 = new ReadPairedTokenRegistryV1_3(
        PairedTokenRegistryV1_3Address[this.chainId],
        drift
      );
    }

    if (doesChainSupportPairedTokenSwap(this.chainId)) {
      this.poolSwapV1_3 = new ReadPoolSwapV1_3(
        PoolSwapV1_3Address[this.chainId],
        drift
      );
      this.pairedTokenPositionManagerV1_3 =
        new ReadPairedTokenPositionManagerV1_3(
          PairedTokenPositionManagerV1_3Address[this.chainId],
          drift
        );
      this.pairedSwapStateView = new ReadStateView(
        StateViewAddress[this.chainId],
        drift
      );
    }

    const quoterAddress = QuoterAddress[this.chainId];
    const permit2Address = Permit2Address[this.chainId];
    if (quoterAddress && permit2Address) {
      this.swapClients = {
        readQuoter: new ReadQuoter(this.chainId, quoterAddress, drift),
        readPermit2: new ReadPermit2(permit2Address, drift),
      };
    }

    if (isMultichainDeployment(this.chainId)) {
      return;
    }

    this.baseClients = {
      readPositionManager: new ReadFlaunchPositionManager(
        FlaunchPositionManagerAddress[this.chainId],
        drift
      ),
      readPositionManagerV1_1: new ReadFlaunchPositionManagerV1_1(
        FlaunchPositionManagerV1_1Address[this.chainId],
        drift
      ),
      readPositionManagerV1_2: new ReadFlaunchPositionManagerV1_2(
        FlaunchPositionManagerV1_2Address[this.chainId],
        drift
      ),
      // v1.3.1: present when this chain has a v1.3.1 deployment (Base mainnet here;
      // Robinhood's v1.3.1 lives behind the multichain path and early-returns above).
      // Reuses the V1_2 client/ABI since v1.3.1 shares the same interface.
      ...(FlaunchPositionManagerV1_3Address[this.chainId]
        ? {
            readPositionManagerV1_3: new ReadFlaunchPositionManagerV1_2(
              FlaunchPositionManagerV1_3Address[this.chainId],
              drift
            ),
          }
        : {}),
      readAnyPositionManager: new ReadAnyPositionManager(
        AnyPositionManagerAddress[this.chainId],
        drift
      ),
      readTokenImporter: new ReadTokenImporter(
        this.chainId,
        TokenImporterAddress[this.chainId],
        drift
      ),
      readReferralEscrow: new ReadReferralEscrow(
        ReferralEscrowAddress[this.chainId],
        drift
      ),
      readFlaunchZap: new ReadFlaunchZap(
        this.chainId,
        FlaunchZapAddress[this.chainId],
        drift
      ),
      readPoolManager: new ReadPoolManager(
        PoolManagerAddress[this.chainId],
        drift
      ),
      readStateView: new ReadStateView(
        StateViewAddress[this.chainId],
        drift
      ),
      readFairLaunch: new ReadFairLaunch(
        FairLaunchAddress[this.chainId],
        drift
      ),
      readFairLaunchV1_1: new ReadFairLaunchV1_1(
        FairLaunchV1_1Address[this.chainId],
        drift
      ),
      readBidWall: new ReadBidWall(BidWallAddress[this.chainId], drift),
      readBidWallV1_1: new ReadBidWallV1_1(
        BidWallV1_1Address[this.chainId],
        drift
      ),
      // v1.3.1: present when this chain has a v1.3.1 deployment (Base mainnet here;
      // Robinhood's v1.3.1 lives behind the multichain path and early-returns above).
      // Reuses the V1_1 BidWall client/ABI since v1.3.1 shares the interface.
      ...(BidWallV1_3Address[this.chainId]
        ? {
            readBidWallV1_3: new ReadBidWallV1_1(
              BidWallV1_3Address[this.chainId],
              drift
            ),
          }
        : {}),
      readAnyBidWall: new AnyBidWall(
        AnyBidWallAddress[this.chainId],
        drift
      ),
      readFlaunch: new ReadFlaunch(FlaunchAddress[this.chainId], drift),
      readFlaunchV1_1: new ReadFlaunchV1_1(
        FlaunchV1_1Address[this.chainId],
        drift
      ),
      readFlaunchV1_2: new ReadFlaunchV1_2(
        FlaunchV1_2Address[this.chainId],
        drift
      ),
      // v1.3.1: present when this chain has a v1.3.1 deployment (Base mainnet here;
      // Robinhood's v1.3.1 lives behind the multichain path and early-returns above).
      // Reuses the V1_2 Flaunch client/ABI since v1.3.1 shares the interface.
      ...(FlaunchV1_3Address[this.chainId]
        ? {
            readFlaunchV1_3: new ReadFlaunchV1_2(
              FlaunchV1_3Address[this.chainId],
              drift
            ),
          }
        : {}),
      readAnyFlaunch: new ReadAnyFlaunch(
        AnyFlaunchAddress[this.chainId],
        drift
      ),
    };
  }

  isPairedTokenApproved(token: Address) {
    return this.readPairedTokenRegistryV1_3.isApproved(token);
  }

  calculatePairedTokenFlaunchFee(
    params: CalculatePairedTokenFlaunchFeeParams
  ) {
    return this.readFlaunchZapV1_3.calculateFee(params);
  }

  /** Per-coin hook resolution results on multichain deployments (a coin never changes hook). */
  private multichainCoinHooks = new Map<string, { hook: Address; version: FlaunchVersion } | null>();
  /** Per-coin memo of the v1.3 hook a paired-token pool lives on, with its key — a coin never migrates hooks. */
  private pairedPoolsByCoin = new Map<string, { hook: Address; poolKey: PoolKey }>();
  private pairedPositionManagersByHook = new Map<string, ReadPairedTokenPositionManagerV1_3>();

  /**
   * On a multichain deployment a chain can serve several hook generations at once (Robinhood:
   * the v1.2 multichain hook, the 2026-08-21 v1.3.1 hooks and the v1.3.3 regeneration). Every
   * pool key — and so every quote and swap — derives from the hook the coin was created on, so
   * it has to be probed per coin rather than taken from the chain's current default. Probes the
   * current and superseded v1.3 hooks first, then the multichain (v1.2) hook.
   * @returns The coin's hook and version, or null when no hook on this chain knows the coin.
   */
  protected async probeMultichainCoinHook(
    coinAddress: Address
  ): Promise<{ hook: Address; version: FlaunchVersion } | null> {
    const key = coinAddress.toLowerCase();
    const cached = this.multichainCoinHooks.get(key);
    if (cached !== undefined) return cached;

    const isValidOn = async (hook: Address) => {
      try {
        return await new ReadFlaunchPositionManagerV1_2(
          hook,
          this.drift
        ).isValidCoin(coinAddress);
      } catch {
        return false;
      }
    };

    let result: { hook: Address; version: FlaunchVersion } | null = null;
    for (const hook of getV1_3PositionManagers(this.chainId)) {
      if (await isValidOn(hook)) {
        result = { hook, version: FlaunchVersion.V1_3 };
        break;
      }
    }
    if (!result) {
      const multichainHook = FlaunchPositionManagerMultichainAddress[this.chainId];
      if (multichainHook && (await isValidOn(multichainHook))) {
        result = { hook: multichainHook, version: FlaunchVersion.V1_2 };
      }
    }

    this.multichainCoinHooks.set(key, result);
    return result;
  }

  /**
   * The hook (PositionManager) a coin's pool lives on. On Base this is the position manager
   * for the coin's version; on a multichain deployment it is probed per coin (see
   * `probeMultichainCoinHook`), falling back to the chain's multichain hook for an unknown coin.
   * @param coinAddress - The coin to resolve
   * @param version - Optional version override (skips detection on Base; on multichain a
   *   non-v1.3 version short-circuits to the multichain hook)
   */
  async getPositionManagerAddressForCoin(
    coinAddress: Address,
    version?: FlaunchVersion
  ): Promise<Address> {
    if (!isMultichainDeployment(this.chainId)) {
      return this.getPositionManagerAddress(
        await this.determineCoinVersion(coinAddress, version)
      );
    }
    if (
      version !== undefined &&
      version !== FlaunchVersion.V1_3 &&
      version !== FlaunchVersion.ANY
    ) {
      return FlaunchPositionManagerMultichainAddress[this.chainId];
    }
    const probed = await this.probeMultichainCoinHook(coinAddress);
    return probed?.hook ?? FlaunchPositionManagerMultichainAddress[this.chainId];
  }

  protected assertPairedTokenSwapSupported(operation: string) {
    if (!doesChainSupportPairedTokenSwap(this.chainId)) {
      throw new Error(
        `${operation} is not supported on chain ${this.chainId}: paired-token swaps are not deployed there`
      );
    }
  }

  /** The paired-token PositionManager client for a given hook address, memoised per hook. */
  protected pairedTokenPositionManagerAt(hook: Address): ReadPairedTokenPositionManagerV1_3 {
    const key = hook.toLowerCase();
    let client = this.pairedPositionManagersByHook.get(key);
    if (!client) {
      client = new ReadPairedTokenPositionManagerV1_3(hook, this.drift);
      this.pairedPositionManagersByHook.set(key, client);
    }
    return client;
  }

  /**
   * Which v1.3 hook a coin's paired pool lives on, and its key.
   *
   * A chain can carry more than one v1.3 hook generation — on Robinhood the 2026-08-21 v1.3.1
   * hooks were regenerated as v1.3.3 and both keep serving their pools — so the hook is probed per
   * coin (`poolKey(coin)` on the current paired PositionManager, then each superseded one) rather
   * than taken from the chain's current default: a key built on the wrong hook names a pool that
   * does not exist, and the swap reverts. A hook that never launched the coin answers a zeroed key
   * (or reverts, for the AnyPositionManager in that list); the first real key wins. Memoised per
   * coin.
   * @returns The hook and pool key, or null when no v1.3 hook on this chain knows the coin.
   */
  protected async locatePairedPool(
    coinAddress: Address
  ): Promise<{ hook: Address; poolKey: PoolKey } | null> {
    const key = coinAddress.toLowerCase();
    const cached = this.pairedPoolsByCoin.get(key);
    if (cached) return cached;

    for (const hook of getV1_3PositionManagers(this.chainId)) {
      let poolKey: PoolKey;
      try {
        poolKey = await this.pairedTokenPositionManagerAt(hook).poolKey(coinAddress);
      } catch {
        continue;
      }
      if (isEmptyPoolKey(poolKey)) continue;
      const located = { hook, poolKey };
      this.pairedPoolsByCoin.set(key, located);
      return located;
    }
    return null;
  }

  /**
   * The pool a paired-token coin trades on: its full key, id and paired side, read from the hook
   * the coin was launched on (see `locatePairedPool` — one `poolKey` read per hook probed, then
   * memoised). `pairedToken`, when given, is checked against the pool's real paired side rather
   * than trusted: building a key from a caller's belief about the pairing is how a swap ends up
   * aimed at a pool that does not exist.
   * @throws when no v1.3 hook on this chain launched the coin, or `pairedToken` disagrees with the pool
   */
  async resolvePairedPool(
    coinAddress: Address,
    pairedToken?: Address
  ): Promise<ResolvedPairedPool> {
    this.assertPairedTokenSwapSupported("resolvePairedPool");
    const located = await this.locatePairedPool(coinAddress);
    if (!located) {
      throw new Error(
        `${coinAddress} was not launched on a paired-token PositionManager on chain ${this.chainId}`
      );
    }
    const resolved = pairedTokenOfPoolKey(located.poolKey, coinAddress);
    if (
      pairedToken !== undefined &&
      pairedToken.toLowerCase() !== resolved.toLowerCase()
    ) {
      throw new Error(
        `${coinAddress} is paired with ${resolved} on chain ${this.chainId}, not ${pairedToken}`
      );
    }
    return {
      poolKey: located.poolKey,
      poolId: getPoolId(located.poolKey),
      pairedToken: resolved,
    };
  }

  /**
   * Expected output of an exact-input swap on a paired-token pool, via the v4 Quoter's single-hop
   * quote (hook fees included). A buy spends the paired token for the coin; a sell the reverse.
   */
  async getPairedPoolQuoteExactInput({
    coinAddress,
    pairedToken,
    amountIn,
    direction = "buy",
    hookData,
    userWallet,
  }: PairedPoolQuoteParams): Promise<bigint> {
    this.assertPairedTokenSwapSupported("getPairedPoolQuoteExactInput");
    const pool = await this.resolvePairedPool(coinAddress, pairedToken);
    const tokenIn = direction === "buy" ? pool.pairedToken : coinAddress;

    await this.readQuoter.contract.cache.clear();
    return this.readQuoter.getQuoteExactInputSingle({
      poolKey: pool.poolKey,
      zeroForOne: isZeroForOne(pool.poolKey, tokenIn),
      exactAmount: amountIn,
      hookData,
      userWallet,
    });
  }

  /**
   * The PoolSwap a pool on `hook` must be traded through. Router approval is per spend gate and
   * each hook generation ships its own gate, so a gated buy sent through the wrong generation's
   * router is refused on chain — see `PoolSwapForHookV1_3Address`.
   */
  protected routerForPool(hook: Address): Address {
    const router = poolSwapForHook(this.chainId, hook);
    if (!router) {
      throw new Error(`No PoolSwap router is known for hook ${hook} on chain ${this.chainId}`);
    }
    return router;
  }

  private async senderFor(explicit?: Address): Promise<Address | undefined> {
    if (explicit) return explicit;
    // A read-only drift has no signer; callers then get the approve planned unconditionally.
    const signer = (this.drift as { getSignerAddress?: () => Promise<Address> }).getSignerAddress;
    return signer ? await signer.call(this.drift).catch(() => undefined) : undefined;
  }

  /**
   * Just the ERC20 approve a paired-token BUY needs, sized to `amount` — for a host that wants the
   * player ready before a round starts (approve the whole wallet cap once; every in-round buy is
   * then a single swap). `undefined` when the pool is paired with native ETH (nothing to approve)
   * or the standing allowance already covers `amount`.
   */
  async planPairedTokenApproval(
    params: PairedTokenApprovalParams
  ): Promise<PairedSwapApproveCall | undefined> {
    this.assertPairedTokenSwapSupported("planPairedTokenApproval");
    if (params.amount <= 0n) throw new Error("amount must be positive");
    const pool = await this.resolvePairedPool(params.coinAddress, params.pairedToken);
    if (pool.pairedToken === zeroAddress) return undefined;
    const router = params.router ?? this.routerForPool(pool.poolKey.hooks);
    const sender = await this.senderFor(params.sender);
    const allowance = sender
      ? await new ReadMemecoin(pool.pairedToken, this.drift).allowance(sender, router)
      : 0n;
    return allowance >= params.amount
      ? undefined
      : buildApproveCall(pool.pairedToken, router, params.amount);
  }

  protected assertPairedTokenAcquisitionSupported(operation: string) {
    if (!doesChainSupportPairedTokenAcquisition(this.chainId)) {
      throw new Error(
        `${operation} is not supported on chain ${this.chainId}: no paired-token acquisition venue is configured there`
      );
    }
  }

  /** Reads for buying a non-ETH paired token from ETH / the USD hub. Gate with `doesChainSupportPairedTokenAcquisition()`. */
  get readPairedTokenAcquisition(): ReadPairedTokenAcquisition {
    if (!this.pairedTokenAcquisition) {
      this.assertPairedTokenAcquisitionSupported("readPairedTokenAcquisition");
      this.pairedTokenAcquisition = new ReadPairedTokenAcquisition(this.chainId, this.drift);
    }
    return this.pairedTokenAcquisition;
  }

  /** Expected paired-token output (and the venue) for an exact ETH / hub-token input. */
  async quotePairedTokenAcquisition(params: {
    pairedToken: Address;
    input: PairedTokenAcquisitionInput;
    amountIn: bigint;
  }): Promise<PairedTokenAcquisitionQuote> {
    this.assertPairedTokenAcquisitionSupported("quotePairedTokenAcquisition");
    if (params.amountIn <= 0n) throw new Error("amountIn must be positive");
    return this.readPairedTokenAcquisition.quote(params.pairedToken, params.input, params.amountIn);
  }

  /**
   * The calls that buy exactly `target` of a paired token from ETH or the USD hub: an optional
   * hub-token approve to the venue's router, then the exact-output router call (ETH rides as
   * `value = maxIn`; the router refunds the unspent part). Exact-output so a following PoolSwap leg
   * can be encoded up front — batched wallets resolve every call before the first executes.
   */
  async planPairedTokenAcquisition(
    params: PairedTokenAcquisitionParams
  ): Promise<PairedTokenAcquisitionPlan> {
    this.assertPairedTokenAcquisitionSupported("planPairedTokenAcquisition");
    if (params.target <= 0n) throw new Error("target must be positive");
    if (params.maxIn <= 0n) throw new Error("maxIn must be positive");
    const acquisition = this.readPairedTokenAcquisition;
    const dex = acquisition.dex;
    const route = params.route ?? (await acquisition.resolveRoute(params.pairedToken));
    const deadline = params.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 600);
    const leg = {
      pairedToken: params.pairedToken,
      route,
      recipient: params.recipient,
      deadline,
      amountOut: params.target,
      amountInMaximum: params.maxIn,
    };

    let approve: PairedSwapApproveCall | undefined;
    if (params.input === "hub") {
      const sender = await this.senderFor(params.sender);
      const allowance = sender
        ? await new ReadMemecoin(dex.hubToken, this.drift).allowance(sender, dex.swapRouter)
        : 0n;
      if (allowance < params.maxIn) {
        approve = buildApproveCall(dex.hubToken, dex.swapRouter, params.maxIn);
      }
    }

    return {
      route,
      input: params.input,
      target: params.target,
      maxIn: params.maxIn,
      ...(approve ? { approve } : {}),
      swap:
        params.input === "eth"
          ? { to: dex.swapRouter, data: encodeAcquisitionEthBuy(dex, leg), value: params.maxIn }
          : { to: dex.swapRouter, data: encodeAcquisitionHubBuy(dex, leg), value: 0n },
    };
  }

  /**
   * Sizes and plans a routed buy from a BUDGET: quotes the exact input, takes `slippageBps` off, and
   * plans an exact-output buy of that much with the whole budget as the price protection — the
   * pattern that keeps a downstream PoolSwap leg deterministic. Returns the plan and the target.
   */
  async planPairedTokenAcquisitionForBudget(params: {
    pairedToken: Address;
    input: PairedTokenAcquisitionInput;
    amountIn: bigint;
    slippageBps: number;
    recipient: Address;
    deadline?: bigint;
    sender?: Address;
  }): Promise<PairedTokenAcquisitionPlan & { quote: PairedTokenAcquisitionQuote }> {
    if (!Number.isInteger(params.slippageBps) || params.slippageBps <= 0 || params.slippageBps >= 10_000) {
      throw new Error("Slippage must be between 1 and 9,999 basis points");
    }
    const quote = await this.quotePairedTokenAcquisition(params);
    const target = (quote.expectedOut * BigInt(10_000 - params.slippageBps)) / 10_000n;
    if (target <= 0n) throw new Error("Amount is too small to route through the paired-token pool");
    const plan = await this.planPairedTokenAcquisition({
      pairedToken: params.pairedToken,
      input: params.input,
      target,
      maxIn: params.amountIn,
      recipient: params.recipient,
      deadline: params.deadline,
      sender: params.sender,
      // Execute on the venue that PRICED the target. Quoting on the best-discovered pool and
      // then buying on the calculator's would size an exact-output leg off a pool it never
      // touches — reverting when the calculator pool cannot deliver within the budget.
      route: quote.route,
    });
    return { ...plan, quote };
  }

  /**
   * Builds the calls for an exact-input swap on a paired-token pool without sending them:
   * an optional ERC20 `approve(PoolSwap, amountIn)` when the standing allowance is short, then the
   * PoolSwap `swap` (the `bytes` overload when `hookData` is given, else the referrer overload).
   *
   * Funding by pairing: a buy on a native-ETH pool sends `amountIn` as `swap.value` and needs no
   * approve; flETH / ERC20 (mUSD, B20 equities) input settles by allowance pull; a sell always
   * spends the coin. `amountSpecified` is negative (v4 exact-input). The sqrt-price bound comes from
   * the pool's spot price and `slippageBps` — PoolSwap has no `minOut`, so this is the price
   * protection. Hosts that batch calls (`wallet_sendCalls`) run `approve` then `swap`; wallets that
   * cannot batch send them as two transactions.
   */
  async planPairedTokenSwap(
    params: PairedSwapPlanParams
  ): Promise<PairedSwapPlan> {
    const { direction } = params;
    this.assertPairedTokenSwapSupported("planPairedTokenSwap");
    if (params.amountIn <= 0n) {
      throw new Error("amountIn must be positive");
    }
    if (
      params.approvalAllowance !== undefined &&
      params.approvalAllowance < params.amountIn
    ) {
      throw new Error("approvalAllowance must be at least amountIn");
    }
    const approveAmount = params.approvalAllowance ?? params.amountIn;

    const pool = await this.resolvePairedPool(
      params.coinAddress,
      params.pairedToken
    );
    const tokenIn = direction === "buy" ? pool.pairedToken : params.coinAddress;
    const tokenOut = direction === "buy" ? params.coinAddress : pool.pairedToken;
    const isNativeInput = direction === "buy" && tokenIn === zeroAddress;
    const zeroForOne = isZeroForOne(pool.poolKey, tokenIn);
    // STRICT lookup, not `poolSwapForHook` — that helper falls back to the chain's current
    // router, which is the right default for an ungated swap and exactly wrong for a gated one.
    const mappedRouter =
      PoolSwapForHookV1_3Address[this.chainId]?.[pool.poolKey.hooks.toLowerCase()];
    if (params.hookData !== undefined && params.router === undefined && mappedRouter === undefined) {
      // Router approval is per spend gate, per hook generation. Guessing the chain's current
      // router for an unmapped hook would send a signed authorisation to a router its gate never
      // approved — an opaque on-chain revert. The gate's /config names the right one.
      throw new Error(
        `No approved router is known for hook ${pool.poolKey.hooks} on chain ${this.chainId} — pass \`router\` (the gate's /config announces it)`
      );
    }
    const poolSwap = params.router ?? mappedRouter ?? this.routerForPool(pool.poolKey.hooks);

    const sender = await this.senderFor(params.sender);

    // Fresh reads, not drift's cache: an approve or a buy that just landed changes both numbers,
    // and a stale allowance here plans a swap with no approve that reverts on-chain, while a
    // stale spot price computes a slippage bound for a market that has moved.
    const memecoin = new ReadMemecoin(tokenIn, this.drift);
    await Promise.all([
      this.pairedSwapStateView!.contract.cache.clear(),
      isNativeInput || !sender ? Promise.resolve() : memecoin.contract.cache.clear(),
    ]);
    const [slot0, allowance] = await Promise.all([
      this.pairedSwapStateView!.poolSlot0({ poolId: pool.poolId }),
      isNativeInput
        ? Promise.resolve(params.amountIn)
        : sender
        ? memecoin.allowance(sender, poolSwap)
        : Promise.resolve(0n),
    ]);

    const sqrtPriceLimitX96 = sqrtPriceLimitFromSlippage(
      slot0.sqrtPriceX96,
      params.slippageBps,
      zeroForOne
    );

    const swapParams = {
      zeroForOne,
      amountSpecified: -params.amountIn,
      sqrtPriceLimitX96,
    };
    const data =
      params.hookData !== undefined
        ? encodeFunctionData({
            abi: PoolSwapV1_3SwapWithHookDataAbi,
            functionName: "swap",
            args: [pool.poolKey, swapParams, params.hookData],
          })
        : encodeFunctionData({
            abi: PoolSwapV1_3SwapWithReferrerAbi,
            functionName: "swap",
            args: [pool.poolKey, swapParams, params.referrer ?? zeroAddress],
          });

    return {
      ...pool,
      direction,
      tokenIn,
      tokenOut,
      isNativeInput,
      zeroForOne,
      amountIn: params.amountIn,
      sqrtPriceLimitX96,
      ...(!isNativeInput && allowance < params.amountIn
        ? { approve: buildApproveCall(tokenIn, poolSwap, approveAmount) }
        : {}),
      swap: {
        to: poolSwap,
        data,
        value: isNativeInput ? params.amountIn : 0n,
      },
    };
  }

  /**
   * Checks if a given coin address is a valid Flaunch coin (supports all versions)
   * @param coinAddress - The address of the coin to check
   * @returns Promise<boolean> - True if the coin is valid, false otherwise
   */
  async isValidCoin(coinAddress: Address) {
    if (isMultichainDeployment(this.chainId)) {
      return (await this.probeMultichainCoinHook(coinAddress)) !== null;
    }
    return (
      (this.readPositionManagerV1_3
        ? await this.readPositionManagerV1_3.isValidCoin(coinAddress)
        : false) ||
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
    if (isMultichainDeployment(this.chainId)) {
      const probed = await this.probeMultichainCoinHook(coinAddress);
      if (probed) return probed.version;
      throw new Error(`Unknown coin version for address: ${coinAddress}`);
    }
    if (
      this.readPositionManagerV1_3 &&
      (await this.readPositionManagerV1_3.isValidCoin(coinAddress))
    ) {
      return FlaunchVersion.V1_3;
    } else if (await this.readPositionManagerV1_2.isValidCoin(coinAddress)) {
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
      case FlaunchVersion.V1_3:
        return this.readPositionManagerV1_3 ?? this.readPositionManagerV1_2;
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
      case FlaunchVersion.V1_3:
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
      case FlaunchVersion.V1_3:
        return this.readBidWallV1_3 ?? this.readBidWallV1_1;
      case FlaunchVersion.ANY:
        return this.readAnyBidWall;
      default:
        return this.readBidWallV1_1;
    }
  }

  /**
   * Gets the flaunch contract instance for a given version
   * @param version - The version to get the flaunch contract instance for
   */
  getFlaunch(version: FlaunchVersion) {
    switch (version) {
      case FlaunchVersion.V1:
        return this.readFlaunch;
      case FlaunchVersion.V1_1:
        return this.readFlaunchV1_1;
      case FlaunchVersion.V1_2:
        return this.readFlaunchV1_2;
      case FlaunchVersion.V1_3:
        return this.readFlaunchV1_3 ?? this.readFlaunchV1_2;
      case FlaunchVersion.ANY:
        return this.readAnyFlaunch;
      default:
        return this.readFlaunchV1_2;
    }
  }

  /**
   * Gets the flaunch contract address for a given version
   * @param version - The version to get the flaunch contract address for
   */
  getFlaunchAddress(version: FlaunchVersion) {
    return this.getFlaunch(version).contract.address;
  }

  getPositionManagerAddress(version: FlaunchVersion) {
    if (isMultichainDeployment(this.chainId)) {
      return FlaunchPositionManagerMultichainAddress[this.chainId];
    }
    return this.getPositionManager(version).contract.address;
  }

  getFairLaunchAddress(version: FlaunchVersion) {
    return this.getFairLaunch(version).contract.address;
  }

  getBidWallAddress(version: FlaunchVersion) {
    return this.getBidWall(version).contract.address;
  }

  /**
   * Gets the flaunch contract address and token ID for a memecoin
   * @param coinAddress - The address of the memecoin
   * @returns Promise<{ flaunchAddress: Address; tokenId: bigint }> - The flaunch contract address and token ID
   */
  async getFlaunchTokenIdForMemecoin(
    coinAddress: Address
  ): Promise<{ flaunchAddress: Address; tokenId: bigint }> {
    const version = await this.getCoinVersion(coinAddress);
    const flaunch = this.getFlaunch(version);
    const tokenId = await flaunch.tokenId(coinAddress);

    return {
      flaunchAddress: flaunch.contract.address,
      tokenId,
    };
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

  /** Parses PoolCreated from logs emitted by a PositionManager on this chain. */
  getPoolCreatedFromLogs(logs: readonly Log[]): PoolCreatedEventData | null {
    const positionManagerV1_3 =
      PairedTokenPositionManagerV1_3Address[this.chainId];
    // A chain can carry more than one v1.3 hook generation (Robinhood: the v1.3.1 hooks were
    // regenerated as v1.3.3); a receipt from either is a v1.3 PoolCreated.
    const v1_3Hooks = [
      ...(positionManagerV1_3 ? [positionManagerV1_3] : []),
      ...(SupersededPositionManagerV1_3Address[this.chainId] ?? []),
    ];

    if (v1_3Hooks.length > 0) {
      for (const log of logs) {
        if (!v1_3Hooks.some((hook) => isAddressEqual(log.address, hook))) {
          continue;
        }

        try {
          const decodedLog = decodeEventLog({
            abi: FlaunchPositionManagerV1_3Abi,
            data: log.data,
            topics: log.topics,
          });

          if (decodedLog.eventName === "PoolCreated") {
            return {
              poolId: decodedLog.args._poolId,
              memecoin: decodedLog.args._memecoin,
              memecoinTreasury: decodedLog.args._memecoinTreasury,
              tokenId: decodedLog.args._tokenId,
              currencyFlipped: decodedLog.args._currencyFlipped,
              flaunchFee: decodedLog.args._flaunchFee,
              params: {
                ...decodedLog.args._params,
                initialTokenFairLaunch: 0n,
                creatorFeeAllocation: Number(
                  decodedLog.args._params.creatorFeeAllocation
                ),
              },
            };
          }
        } catch {
          continue;
        }
      }
    }

    if (isMultichainDeployment(this.chainId)) {
      const positionManager =
        FlaunchPositionManagerMultichainAddress[this.chainId];

      for (const log of logs) {
        if (!isAddressEqual(log.address, positionManager)) {
          continue;
        }

        try {
          const decodedLog = decodeEventLog({
            abi: FlaunchPositionManagerAbi,
            data: log.data,
            topics: log.topics,
          });

          if (decodedLog.eventName === "PoolCreated") {
            return {
              poolId: decodedLog.args._poolId,
              memecoin: decodedLog.args._memecoin,
              memecoinTreasury: decodedLog.args._memecoinTreasury,
              tokenId: decodedLog.args._tokenId,
              currencyFlipped: decodedLog.args._currencyFlipped,
              flaunchFee: decodedLog.args._flaunchFee,
              params: {
                name: decodedLog.args._params.name,
                symbol: decodedLog.args._params.symbol,
                tokenUri: decodedLog.args._params.tokenUri,
                initialTokenFairLaunch: 0n,
                premineAmount: decodedLog.args._params.premineAmount,
                creator: decodedLog.args._params.creator,
                creatorFeeAllocation: Number(
                  decodedLog.args._params.creatorFeeAllocation
                ),
                flaunchAt: decodedLog.args._params.flaunchAt,
                initialPriceParams:
                  decodedLog.args._params.initialPriceParams,
                feeCalculatorParams:
                  decodedLog.args._params.feeCalculatorParams,
              },
            };
          }
        } catch {
          continue;
        }
      }

      return null;
    }

    for (const log of logs) {
      try {
        const decodedLog = decodeEventLog({
          abi: FlaunchPositionManagerV1_2Abi,
          data: log.data,
          topics: log.topics,
        });

        if (decodedLog.eventName === "PoolCreated") {
          return {
            poolId: decodedLog.args._poolId as Hex,
            memecoin: decodedLog.args._memecoin as Address,
            memecoinTreasury: decodedLog.args._memecoinTreasury as Address,
            tokenId: decodedLog.args._tokenId as bigint,
            currencyFlipped: decodedLog.args._currencyFlipped as boolean,
            flaunchFee: decodedLog.args._flaunchFee as bigint,
            params: decodedLog.args._params as PoolCreatedEventData["params"],
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Parses a transaction to extract PoolCreated event data
   * @param txHash - The transaction hash to parse
   * @returns PoolCreated event parameters or null if not found
   */
  async getPoolCreatedFromTx(
    txHash: Hex
  ): Promise<PoolCreatedEventData | null> {
    if (!this.publicClient) {
      throw new Error("Public client is required to fetch transaction data");
    }

    const receipt = await this.publicClient.getTransactionReceipt({
      hash: txHash,
    });

    if (!receipt) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    return this.getPoolCreatedFromLogs(receipt.logs);
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
   * Gets the creator's claimable revenue on the v1.3.1 multi-token FeeEscrow, per escrow token.
   * Coins paired with anything other than flETH (native ETH, the B20 equities, …) escrow their
   * creator fees there, denominated in the paired token, where `creatorRevenue()` cannot see
   * them. The escrow cannot enumerate a recipient's keys, so pass the paired tokens to look at.
   * @param params.creator - The address of the creator to check
   * @param params.tokens - The escrow tokens to read (`zeroAddress` for native ETH)
   * @returns The claimable amount per token, in that token's raw units (zero balances included)
   */
  creatorRevenueByToken(params: {
    creator: Address;
    tokens: Address[];
  }): Promise<EscrowTokenBalance[]> {
    return this.readFeeEscrowV1_3.balancesForTokens(
      params.creator,
      params.tokens
    );
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
    this.assertBaseOnlyOperation("revenueManagerBalance");
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
    this.assertBaseOnlyOperation("revenueManagerProtocolBalance");
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
    this.assertBaseOnlyOperation("revenueManagerTokensCount");
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
    this.assertBaseOnlyOperation("revenueManagerAllTokensByCreator");
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
    this.assertBaseOnlyOperation("revenueManagerAllTokensInManager");
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
    this.assertBaseOnlyOperation("treasuryManagerInfo");
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
   * Gets the claimable balance of one payout asset for a recipient on a v1.3.1 multi-asset
   * RevenueManager. Managers of that generation keep a balance per payout asset — native ETH
   * (`zeroAddress`) for flETH / native pools, otherwise the coin's paired token (a wrapper's
   * underlying, or a B20 stock as itself) — so a stock-paired coin's fees do not show up under
   * ETH. `revenueManagerBalance()` only speaks to the previous generation.
   * @param params.revenueManagerAddress - The address of the v1.3.1 revenue manager
   * @param params.recipient - The address of the recipient to check
   * @param params.asset - The payout asset to read. Defaults to native ETH
   * @returns Promise<bigint> - The claimable balance in the asset's raw units
   */
  revenueManagerBalanceV1_3(params: {
    revenueManagerAddress: Address;
    recipient: Address;
    asset?: Address;
  }) {
    this.assertMultiAssetManagersSupported("revenueManagerBalanceV1_3");
    const readRevenueManager = new ReadRevenueManagerV1_3(
      params.revenueManagerAddress,
      this.drift
    );
    return readRevenueManager.balances(
      params.recipient,
      params.asset ?? zeroAddress
    );
  }

  /**
   * Gets every payout asset a v1.3.1 revenue manager has ever been credited in. Native ETH
   * (`zeroAddress`) is always present; other entries come from the paired tokens of the coins
   * deposited into it. Use it to know which assets to read or claim.
   * @param revenueManagerAddress - The address of the v1.3.1 revenue manager
   * @returns Promise<readonly Address[]> - The payout assets
   */
  revenueManagerPayoutAssets(revenueManagerAddress: Address) {
    this.assertMultiAssetManagersSupported("revenueManagerPayoutAssets");
    const readRevenueManager = new ReadRevenueManagerV1_3(
      revenueManagerAddress,
      this.drift
    );
    return readRevenueManager.payoutAssets();
  }

  /**
   * Gets the claimable balance of one payout asset for the protocol on a v1.3.1 revenue manager
   * @param params.revenueManagerAddress - The address of the v1.3.1 revenue manager
   * @param params.asset - The payout asset to read. Defaults to native ETH
   * @returns Promise<bigint> - The claimable balance in the asset's raw units
   */
  async revenueManagerProtocolBalanceV1_3(params: {
    revenueManagerAddress: Address;
    asset?: Address;
  }) {
    this.assertMultiAssetManagersSupported("revenueManagerProtocolBalanceV1_3");
    const readRevenueManager = new ReadRevenueManagerV1_3(
      params.revenueManagerAddress,
      this.drift
    );
    const protocolRecipient = await readRevenueManager.protocolRecipient();
    return readRevenueManager.balances(
      protocolRecipient,
      params.asset ?? zeroAddress
    );
  }

  /**
   * Gets a recipient's claimable balances across payout assets on any v1.3.1 multi-asset
   * treasury manager (RevenueManager, the fee-split managers, StakingManager). Zero balances are
   * kept so callers can decide what to claim.
   * @param params.treasuryManagerAddress - The address of the v1.3.1 treasury manager
   * @param params.recipient - The address of the recipient to check
   * @param params.assets - The payout assets to read. Defaults to every asset the manager has paid out in
   * @returns Promise<AssetBalance[]> - One entry per asset, in the order given
   */
  treasuryManagerBalancesV1_3(params: {
    treasuryManagerAddress: Address;
    recipient: Address;
    assets?: Address[];
  }): Promise<AssetBalance[]> {
    this.assertMultiAssetManagersSupported("treasuryManagerBalancesV1_3");
    const readTreasuryManager = new ReadTreasuryManagerV1_3(
      params.treasuryManagerAddress,
      this.drift
    );
    return readTreasuryManager.balancesForAssets(
      params.recipient,
      params.assets
    );
  }

  /**
   * Gets the pool ID for a given coin
   * @param coinAddress - The address of the coin
   * @param version - Optional specific version to use
   * @returns Promise<string> - The pool ID
   */
  async poolId(coinAddress: Address, version?: FlaunchVersion) {
    const hookAddress = await this.getPositionManagerAddressForCoin(
      coinAddress,
      version
    );

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
    const hookAddress = await this.getPositionManagerAddressForCoin(
      coinAddress,
      version
    );

    return this.readQuoter.getSellQuoteExactInput({
      coinAddress,
      amountIn,
      positionManagerAddress: hookAddress,
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
    const hookAddress = await this.getPositionManagerAddressForCoin(
      coinAddress,
      version
    );

    return this.readQuoter.getBuyQuoteExactInput({
      coinAddress,
      amountIn,
      positionManagerAddress: hookAddress,
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
    const hookAddress = await this.getPositionManagerAddressForCoin(
      coinAddress,
      version
    );

    return this.readQuoter.getBuyQuoteExactOutput({
      coinAddress,
      coinOut: amountOut,
      positionManagerAddress: hookAddress,
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
      const poolState = await this.readStateView.poolSlot0({
        poolId: getPoolId(
          await this.createPoolKeyForCoin(coinAddress, params.version)
        ),
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
      const poolState = await this.readStateView.poolSlot0({
        poolId: getPoolId(
          await this.createPoolKeyForCoin(coinAddress, params.version)
        ),
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
    if (isMultichainDeployment(this.chainId)) {
      return version ?? FlaunchVersion.ANY;
    }

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

  /**
   * `createPoolKey` resolved by coin rather than by version: on a multichain deployment the
   * hook is probed per coin (see `getPositionManagerAddressForCoin`), so the key matches the
   * pool the coin was actually created on. The liquidity helpers use this.
   */
  protected async createPoolKeyForCoin(
    coinAddress: Address,
    version?: FlaunchVersion
  ) {
    const flethAddress = FLETHAddress[this.chainId];
    return orderPoolKey({
      currency0: coinAddress,
      currency1: flethAddress,
      fee: 0,
      tickSpacing: this.TICK_SPACING,
      hooks: await this.getPositionManagerAddressForCoin(coinAddress, version),
    });
  }
}

export class ReadWriteFlaunchSDK extends ReadFlaunchSDK {
  declare drift: Drift<ReadWriteAdapter>;
  private readonly baseReadWriteClients?: BaseReadWriteClients;
  private readonly readWriteFlaunchZapMultichain?: ReadWriteFlaunchZapMultichain;
  private readonly readWriteFlaunchZapV1_3Client?: ReadWriteFlaunchZapV1_3;
  private readonly readWritePoolSwapV1_3Client?: ReadWritePoolSwapV1_3;
  public readonly readWriteFeeEscrow: ReadWriteFeeEscrow;
  private readonly readWriteFeeEscrowV1_3Client?: ReadWriteFeeEscrowV1_3;
  private readonly readWriteFlaunchManagerZapV1_3Client?: ReadWriteFlaunchManagerZapV1_3;

  /**
   * The v1.3.1 multi-token FeeEscrow with write capabilities. Throws on chains without one —
   * gate with `doesChainSupportMultiTokenFeeEscrow()`.
   */
  get readWriteFeeEscrowV1_3(): ReadWriteFeeEscrowV1_3 {
    if (!this.readWriteFeeEscrowV1_3Client) {
      throw new Error(
        `Multi-token FeeEscrow is not supported on chain ${this.chainId}`
      );
    }
    return this.readWriteFeeEscrowV1_3Client;
  }

  /**
   * The v1.3.1 FlaunchManagerZap with write capabilities: deploys managers of the multi-asset
   * generation through the v1.3.1 factory. Throws on chains without one — gate with
   * `doesChainSupportMultiAssetManagers()`.
   */
  get readWriteFlaunchManagerZapV1_3(): ReadWriteFlaunchManagerZapV1_3 {
    if (!this.readWriteFlaunchManagerZapV1_3Client) {
      throw new Error(
        `Multi-asset managers are not supported on chain ${this.chainId}`
      );
    }
    return this.readWriteFlaunchManagerZapV1_3Client;
  }

  get readWriteFlaunchZapV1_3(): ReadWriteFlaunchZapV1_3 {
    if (!this.readWriteFlaunchZapV1_3Client) {
      throw new Error(
        `Paired-token launches are not supported on chain ${this.chainId}`
      );
    }
    return this.readWriteFlaunchZapV1_3Client;
  }

  private readonly poolSwapWriters = new Map<string, ReadWritePoolSwapV1_3>();

  /** A PoolSwap writer for a specific router — the one a plan resolved for its pool's hook generation. */
  protected poolSwapWriterAt(router: Address): ReadWritePoolSwapV1_3 {
    const key = router.toLowerCase();
    let writer = this.poolSwapWriters.get(key);
    if (!writer) {
      writer = new ReadWritePoolSwapV1_3(router, this.drift);
      this.poolSwapWriters.set(key, writer);
    }
    return writer;
  }

  /** The chain's CURRENT v1.3 PoolSwap router with write capabilities — gate with `doesChainSupportPairedTokenSwap()`. */
  get readWritePoolSwapV1_3(): ReadWritePoolSwapV1_3 {
    if (!this.readWritePoolSwapV1_3Client) {
      throw new Error(
        `Paired-token swaps are not supported on chain ${this.chainId}`
      );
    }
    return this.readWritePoolSwapV1_3Client;
  }

  private getBaseReadWriteClient<K extends keyof BaseReadWriteClients>(
    name: K
  ): BaseReadWriteClients[K] {
    const client = this.baseReadWriteClients?.[name];
    if (!client) {
      throw new Error(`${name} is not supported on chain ${this.chainId}`);
    }
    return client;
  }

  get readWritePositionManager() {
    return this.getBaseReadWriteClient("readWritePositionManager");
  }
  get readWritePositionManagerV1_1() {
    return this.getBaseReadWriteClient("readWritePositionManagerV1_1");
  }
  get readWriteAnyPositionManager() {
    return this.getBaseReadWriteClient("readWriteAnyPositionManager");
  }
  get readWriteTokenImporter() {
    return this.getBaseReadWriteClient("readWriteTokenImporter");
  }
  get readWriteReferralEscrow() {
    return this.getBaseReadWriteClient("readWriteReferralEscrow");
  }
  get readWriteFlaunchZap() {
    return this.getBaseReadWriteClient("readWriteFlaunchZap");
  }
  get readWriteTreasuryManagerFactory() {
    return this.getBaseReadWriteClient(
      "readWriteTreasuryManagerFactory"
    );
  }
  get readWritePermit2() {
    return this.getBaseReadWriteClient("readWritePermit2");
  }

  constructor(
    chainId: number,
    drift: Drift<ReadWriteAdapter> = createDrift(),
    publicClient?: PublicClient
  ) {
    super(chainId, drift, publicClient);
    this.readWriteFeeEscrow = new ReadWriteFeeEscrow(
      FeeEscrowAddress[this.chainId],
      drift
    );
    const feeEscrowV1_3Address = FeeEscrowV1_3Address[this.chainId];
    if (feeEscrowV1_3Address) {
      this.readWriteFeeEscrowV1_3Client = new ReadWriteFeeEscrowV1_3(
        feeEscrowV1_3Address,
        drift
      );
    }
    if (doesChainSupportMultiAssetManagers(this.chainId)) {
      this.readWriteFlaunchManagerZapV1_3Client =
        new ReadWriteFlaunchManagerZapV1_3(
          this.chainId,
          FlaunchManagerZapV1_3Address[this.chainId],
          drift
        );
    }

    if (doesChainSupportPairedTokenLaunch(this.chainId)) {
      this.readWriteFlaunchZapV1_3Client = new ReadWriteFlaunchZapV1_3(
        FlaunchZapV1_3Address[this.chainId],
        drift
      );
    }
    if (doesChainSupportPairedTokenSwap(this.chainId)) {
      this.readWritePoolSwapV1_3Client = new ReadWritePoolSwapV1_3(
        PoolSwapV1_3Address[this.chainId],
        drift
      );
    }

    if (isMultichainDeployment(this.chainId)) {
      this.readWriteFlaunchZapMultichain = new ReadWriteFlaunchZapMultichain(
        FlaunchZapMultichainAddress[this.chainId],
        drift
      );
      return;
    }

    this.baseReadWriteClients = {
      readWritePositionManager: new ReadWriteFlaunchPositionManager(
        FlaunchPositionManagerAddress[this.chainId],
        drift
      ),
      readWritePositionManagerV1_1:
        new ReadWriteFlaunchPositionManagerV1_1(
          FlaunchPositionManagerV1_1Address[this.chainId],
          drift
        ),
      readWriteAnyPositionManager: new ReadWriteAnyPositionManager(
        AnyPositionManagerAddress[this.chainId],
        drift
      ),
      readWriteTokenImporter: new ReadWriteTokenImporter(
        this.chainId,
        TokenImporterAddress[this.chainId],
        drift
      ),
      readWriteReferralEscrow: new ReadWriteReferralEscrow(
        ReferralEscrowAddress[this.chainId],
        drift
      ),
      readWriteFlaunchZap: new ReadWriteFlaunchZap(
        this.chainId,
        FlaunchZapAddress[this.chainId],
        drift
      ),
      readWriteTreasuryManagerFactory: new ReadWriteTreasuryManagerFactory(
        this.chainId,
        TreasuryManagerFactoryAddress[this.chainId],
        drift,
        this.publicClient
      ),
      readWritePermit2: new ReadWritePermit2(
        Permit2Address[this.chainId],
        drift
      ),
    };
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
   * Deploys a new v1.3.1 multi-asset revenue manager through the v1.3.1 FlaunchManagerZap.
   * Managers of this generation pay out per payout asset (native ETH or a coin's paired
   * token), so they are the ones to use for coins paired with a B20 stock or native ETH;
   * `deployRevenueManager()` keeps deploying the previous generation. The address is resolved
   * from the `ManagerDeployed` event of the v1.3.1 factory only.
   * @param params - Parameters for deploying the revenue manager
   * @param params.protocolRecipient - The address of the protocol recipient (and manager owner)
   * @param params.protocolFeePercent - The percentage of fees taken by the protocol (0-100)
   * @param params.permissions - The permissions for the revenue manager. Defaults to OPEN
   * @returns Address of the deployed revenue manager
   */
  async deployRevenueManagerV1_3(
    params: DeployRevenueManagerParams
  ): Promise<Address> {
    this.assertMultiAssetManagersSupported("deployRevenueManagerV1_3");
    const hash =
      await this.readWriteFlaunchManagerZapV1_3.deployRevenueManager(params);

    return await this.readTreasuryManagerFactoryV1_3.getManagerDeployedAddressFromTx(
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
    if (isMultichainDeployment(this.chainId)) {
      return this.readWriteFlaunchZapMultichain!.flaunch(params);
    }

    return this.readWriteFlaunchZap.flaunch(params);
  }

  flaunchPairedToken(params: FlaunchPairedTokenParams) {
    return this.readWriteFlaunchZapV1_3.flaunch(params);
  }

  /**
   * Buys a paired-token coin with an exact amount of its paired token (mUSD, native ETH, flETH, a
   * B20 equity) through the v1.3.1 PoolSwap. Sends the ERC20 approve first when the allowance is
   * short, then the swap; returns the swap transaction. To batch both into one wallet call, run
   * `planPairedTokenSwap({ ...params, direction: "buy" })` and submit its calls yourself.
   */
  async buyCoinPairedToken(params: PairedTokenSwapParams) {
    return this.executePairedTokenSwap(params, "buy");
  }

  /** Sells an exact amount of a paired-token coin for its paired token through PoolSwap. See `buyCoinPairedToken`. */
  async sellCoinPairedToken(params: PairedTokenSwapParams) {
    return this.executePairedTokenSwap(params, "sell");
  }

  private async executePairedTokenSwap(
    params: PairedTokenSwapParams,
    direction: PairedSwapDirection
  ) {
    const sender = params.sender ?? (await this.drift.getSignerAddress());
    const plan = await this.planPairedTokenSwap({ ...params, sender, direction });

    if (plan.approve) {
      await new ReadWriteMemecoin(plan.approve.token, this.drift).approve(
        plan.approve.spender,
        plan.approve.amount
      );
    }

    return this.poolSwapWriterAt(plan.swap.to).swap({
      poolKey: plan.poolKey,
      params: {
        zeroForOne: plan.zeroForOne,
        amountSpecified: -plan.amountIn,
        sqrtPriceLimitX96: plan.sqrtPriceLimitX96,
      },
      hookData: params.hookData,
      referrer: params.referrer,
      value: plan.swap.value,
    });
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
   * Creates a new Flaunch with dynamic split manager configuration.
   * @param params - Parameters for creating the Flaunch with dynamic split manager
   * @returns Transaction response
   */
  flaunchWithDynamicSplitManager(
    params: FlaunchWithDynamicSplitManagerParams
  ) {
    if (isMultichainDeployment(this.chainId)) {
      return this.readWriteFlaunchZapMultichain!.flaunchWithDynamicSplitManager(
        this.chainId,
        params
      );
    }

    return this.readWriteFlaunchZap.flaunchWithDynamicSplitManager(params);
  }

  /**
   * Creates a new Flaunch with dynamic split manager configuration and IPFS metadata.
   * @param params - Parameters for creating the Flaunch with dynamic split manager and IPFS data
   * @returns Transaction response
   */
  flaunchIPFSWithDynamicSplitManager(
    params: FlaunchWithDynamicSplitManagerIPFSParams
  ) {
    // Keep this guard here (before the client call): the client uploads metadata
    // before delegating to the direct dynamic-split method.
    this.assertBaseOnlyOperation("flaunchIPFSWithDynamicSplitManager");
    return this.readWriteFlaunchZap.flaunchIPFSWithDynamicSplitManager(params);
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
    const hookAddress = await this.getPositionManagerAddressForCoin(
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
            positionManagerAddress: hookAddress,
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
            positionManagerAddress: hookAddress,
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
      positionManagerAddress: hookAddress,
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
    const hookAddress = await this.getPositionManagerAddressForCoin(
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
          positionManagerAddress: hookAddress,
          intermediatePoolKey: params.intermediatePoolKey,
          hookData: params.hookData,
          userWallet: params.hookData
            ? await this.drift.getSignerAddress()
            : undefined,
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
      positionManagerAddress: hookAddress,
      intermediatePoolKey: params.intermediatePoolKey,
      hookData: params.hookData,
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
    if (params.isV1) {
      const positionManager = this.readWritePositionManager;
      const recipient =
        params.recipient ?? (await this.drift.getSignerAddress());
      return positionManager.withdrawFees(recipient);
    }

    const recipient = params.recipient ?? (await this.drift.getSignerAddress());
    return this.readWriteFeeEscrow.withdrawFees(recipient);
  }

  /**
   * Withdraws the creator's revenue from the v1.3.1 multi-token FeeEscrow across the given
   * escrow tokens, in one transaction. Pass every token with a balance from
   * `creatorRevenueByToken()`; a zero balance is a harmless no-op. flETH pays out as ETH while
   * `unwrap` is left on; a stock pairing is delivered as the stock itself either way.
   * @param params - Parameters for withdrawing the creator's revenue
   * @param params.tokens - The escrow tokens to withdraw (`zeroAddress` for native ETH)
   * @param params.recipient - The address to withdraw the revenue to. Defaults to the connected wallet
   * @param params.unwrap - Whether to unwrap wrappers to their underlying asset. Defaults to true
   * @returns Transaction response
   */
  async withdrawCreatorRevenueByToken(params: {
    tokens: Address[];
    recipient?: Address;
    unwrap?: boolean;
  }) {
    const recipient = params.recipient ?? (await this.drift.getSignerAddress());
    return this.readWriteFeeEscrowV1_3.withdrawFees({
      tokens: params.tokens,
      recipient,
      unwrap: params.unwrap,
    });
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
    this.assertBaseOnlyOperation("revenueManagerProtocolClaim");
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
    this.assertBaseOnlyOperation("revenueManagerCreatorClaim");
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
    this.assertBaseOnlyOperation("revenueManagerCreatorClaimForTokens");
    const readWriteRevenueManager = new ReadWriteRevenueManager(
      params.revenueManagerAddress,
      this.drift
    );
    return readWriteRevenueManager.creatorClaimForTokens(params.flaunchTokens);
  }

  /**
   * Claims the protocol's share from a v1.3.1 multi-asset revenue manager. With no `assets`
   * every payout asset is settled; pass a subset when one asset would block the claim (a
   * transfer-restricted stock). The connected wallet must be the protocol recipient.
   * @param params.revenueManagerAddress - The address of the v1.3.1 revenue manager
   * @param params.assets - Optionally, the payout assets to settle (`zeroAddress` for native ETH)
   * @returns Transaction response
   */
  revenueManagerProtocolClaimV1_3(params: {
    revenueManagerAddress: Address;
    assets?: Address[];
  }) {
    this.assertMultiAssetManagersSupported("revenueManagerProtocolClaimV1_3");
    const readWriteRevenueManager = new ReadWriteRevenueManagerV1_3(
      params.revenueManagerAddress,
      this.drift
    );
    return params.assets
      ? readWriteRevenueManager.claimAssets(params.assets)
      : readWriteRevenueManager.claim();
  }

  /**
   * Claims a creator's share from a v1.3.1 multi-asset revenue manager. With no `assets`
   * every payout asset is settled, across all the creator's tokens or the `flaunchTokens`
   * given; pass `assets` to settle a subset (e.g. skip a transfer-restricted stock). The
   * connected wallet must be the creator.
   * @param params.revenueManagerAddress - The address of the v1.3.1 revenue manager
   * @param params.assets - Optionally, the payout assets to settle (`zeroAddress` for native ETH)
   * @param params.flaunchTokens - Optionally, the flaunch tokens to claim against
   * @returns Transaction response
   */
  revenueManagerCreatorClaimV1_3(params: {
    revenueManagerAddress: Address;
    assets?: Address[];
    flaunchTokens?: { flaunch: Address; tokenId: bigint }[];
  }) {
    this.assertMultiAssetManagersSupported("revenueManagerCreatorClaimV1_3");
    const readWriteRevenueManager = new ReadWriteRevenueManagerV1_3(
      params.revenueManagerAddress,
      this.drift
    );
    if (params.assets) {
      return readWriteRevenueManager.claimAssets(
        params.assets,
        params.flaunchTokens
      );
    }
    if (params.flaunchTokens?.length) {
      return readWriteRevenueManager.claimForTokens(params.flaunchTokens);
    }
    return readWriteRevenueManager.claim();
  }

  /**
   * Claims a subset of payout assets from any v1.3.1 multi-asset treasury manager, so a
   * recipient blocked on one asset can still collect the others. Every asset must be one the
   * manager has paid out in (`treasuryManagerBalancesV1_3()` / `payoutAssets()`).
   * @param params.treasuryManagerAddress - The address of the v1.3.1 treasury manager
   * @param params.assets - The payout assets to settle (`zeroAddress` for native ETH)
   * @param params.data - Manager-specific claim data (defaults to empty)
   * @returns Transaction response
   */
  treasuryManagerClaimAssetsV1_3(params: {
    treasuryManagerAddress: Address;
    assets: Address[];
    data?: HexString;
  }) {
    this.assertMultiAssetManagersSupported("treasuryManagerClaimAssetsV1_3");
    const readWriteTreasuryManager = new ReadWriteTreasuryManagerV1_3(
      params.treasuryManagerAddress,
      this.drift
    );
    return readWriteTreasuryManager.claimAssets(params.assets, params.data);
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
    this.assertBaseOnlyOperation("treasuryManagerSetPermissions");
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
    this.assertBaseOnlyOperation("treasuryManagerTransferOwnership");
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
    this.assertBaseOnlyOperation("addToTreasuryManager");
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
    const poolKey = await this.createPoolKeyForCoin(coinAddress, params.version);

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
    const slippagePercent = params.slippagePercent;
    const { finalLiquidity, finalAmount0, finalAmount1 } =
      this.calculateConstrainedLiquidity(
        currentTick,
        tickLower,
        tickUpper,
        amount0,
        amount1,
        slippagePercent
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
    const poolKey = await this.createPoolKeyForCoin(coinAddress, params.version);

    let currentTick: number;

    // First, check if the pool is initialized as we can then get the current tick directly from
    // the state view.
    const poolState = await this.readStateView.poolSlot0({
      poolId: getPoolId(poolKey),
    });
    currentTick = poolState.tick;

    // If the current sqrtPriceX96 of the pool is zero, and the initial marketcap or price is provided,
    // we can use this to determine the current tick.
    if (
      poolState.sqrtPriceX96 === 0n &&
      (("initialMarketCapUSD" in params && params.initialMarketCapUSD) ||
        ("initialPriceUSD" in params && params.initialPriceUSD))
    ) {
      let { decimals: coinDecimals, formattedTotalSupplyInDecimals } =
        await this.getCoinInfo(coinAddress);

      // If we have a tokenSupply set, then overwrite the value
      if ("tokenSupply" in params && params.tokenSupply !== undefined) {
        formattedTotalSupplyInDecimals = parseFloat(
          formatUnits(params.tokenSupply, coinDecimals)
        );
      }

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
    const slippagePercent = params.slippagePercent;
    const { finalLiquidity, finalAmount0, finalAmount1 } =
      this.calculateConstrainedLiquidity(
        currentTick,
        tickLower,
        tickUpper,
        amount0,
        amount1,
        slippagePercent
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
   *   initialMarketCapUSD: 50000,
   *   tokenSupply: 1000000e6 // 1 million tokens (6 decimals)
   * });
   * ```
   */
  async getImportAndSingleSidedCoinAddLiquidityCalls(
    params: ImportAndSingleSidedCoinAddLiquidityWithMarketCap & {
      tokenSupply: bigint;
    }
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
   *   initialPriceUSD: 0.001,
   *   tokenSupply: 1000000e6 // 1 million tokens (6 decimals)
   * });
   * ```
   */
  async getImportAndSingleSidedCoinAddLiquidityCalls(
    params: ImportAndSingleSidedCoinAddLiquidityWithPrice & {
      tokenSupply: bigint;
    }
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
      if (
        "tokenSupply" in paramsWithMarketCap &&
        paramsWithMarketCap.tokenSupply !== undefined
      ) {
        importParams = await this.readWriteTokenImporter.getInitializeParams({
          coinAddress: paramsWithMarketCap.coinAddress,
          creatorFeeAllocationPercent:
            paramsWithMarketCap.creatorFeeAllocationPercent,
          initialMarketCapUSD: paramsWithMarketCap.initialMarketCapUSD,
          verifier: paramsWithMarketCap.verifier,
          tokenSupply: paramsWithMarketCap.tokenSupply as bigint,
        });
      } else {
        importParams = await this.readWriteTokenImporter.getInitializeParams({
          coinAddress: paramsWithMarketCap.coinAddress,
          creatorFeeAllocationPercent:
            paramsWithMarketCap.creatorFeeAllocationPercent,
          initialMarketCapUSD: paramsWithMarketCap.initialMarketCapUSD,
          verifier: paramsWithMarketCap.verifier,
        });
      }
    } else {
      const paramsWithPrice =
        params as ImportAndSingleSidedCoinAddLiquidityParams & {
          initialPriceUSD: number;
        };
      if (
        "tokenSupply" in paramsWithPrice &&
        paramsWithPrice.tokenSupply !== undefined
      ) {
        importParams = await this.readWriteTokenImporter.getInitializeParams({
          coinAddress: paramsWithPrice.coinAddress,
          creatorFeeAllocationPercent:
            paramsWithPrice.creatorFeeAllocationPercent,
          initialPriceUSD: paramsWithPrice.initialPriceUSD,
          verifier: paramsWithPrice.verifier,
          tokenSupply: paramsWithPrice.tokenSupply as bigint,
        });
      } else {
        importParams = await this.readWriteTokenImporter.getInitializeParams({
          coinAddress: paramsWithPrice.coinAddress,
          creatorFeeAllocationPercent:
            paramsWithPrice.creatorFeeAllocationPercent,
          initialPriceUSD: paramsWithPrice.initialPriceUSD,
          verifier: paramsWithPrice.verifier,
        });
      }
    }

    const addLiquidityCalls = await this.getSingleSidedCoinAddLiquidityCalls({
      // Add our liquidity parameters
      ...params,

      // Add our optional tokenSupply if provided from our initialize params
      ...("_totalSupply" in importParams && {
        tokenSupply: importParams._totalSupply,
      }),

      // Set our FlaunchVersion
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
    amount1: bigint,
    slippagePercent: number = 0.05 // Default to 0.05%
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
    // Reduce liquidity by slippagePercent to ensure contract calculations stay within user bounds
    // slippagePercent is passed as decimal percentage (e.g., 0.05 for 0.05%), convert to decimal
    const slippageAsDecimal = slippagePercent / 100;
    const slippageMultiplier = BigInt(Math.floor(1 / slippageAsDecimal));
    const liquidityBuffer = finalLiquidity / slippageMultiplier;
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
