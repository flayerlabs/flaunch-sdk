import {
  type Address,
  type Drift,
  type HexString,
  type ReadContract,
  type ReadWriteAdapter,
  type ReadWriteContract,
  createDrift,
} from "@delvtech/drift";
import { encodeAbiParameters, parseUnits, zeroAddress } from "viem";
import { FlaunchZapAbi } from "../abi/FlaunchZap";
import { generateTokenUri } from "../helpers/ipfs";
import { getPermissionsAddress } from "../helpers/permissions";
import { Permissions } from "../types";
import {
  toFlaunchParamsWithDynamicSplitManager,
  toFlaunchParamsWithRevenueManager,
  toFlaunchParamsWithSplitManager,
  type FlaunchIPFSParams,
  type FlaunchParams,
  type FlaunchWithDynamicSplitManagerIPFSParams,
  type FlaunchWithDynamicSplitManagerParams,
  type FlaunchWithRevenueManagerIPFSParams,
  type FlaunchWithRevenueManagerParams,
  type FlaunchWithSplitManagerIPFSParams,
  type FlaunchWithSplitManagerParams,
} from "./FlaunchZapClient";

export type FlaunchZapMultichainABI = typeof FlaunchZapAbi;

/** `IPositionManager.FlaunchParams` as the multichain (v1.2+) zap takes it — no fair-launch fields. */
export type FlaunchParamsMultichain = {
  name: string;
  symbol: string;
  tokenUri: string;
  premineAmount: bigint;
  creator: Address;
  creatorFeeAllocation: number;
  flaunchAt: bigint;
  initialPriceParams: HexString;
  feeCalculatorParams: HexString;
};

/** The `_treasuryManagerParams` tuple of the multichain zap's manager overload. */
export type MultichainTreasuryManagerArgs = {
  manager: Address;
  permissions: Address;
  initializeData: HexString;
  depositData: HexString;
};

/** The exact argument object the multichain zap `flaunch` overloads take; the key set selects the overload. */
export type MultichainFlaunchArgs =
  | {
      overload: "plain";
      args: { _flaunchParams: FlaunchParamsMultichain; _trustedFeeSigner: Address };
    }
  | {
      overload: "manager";
      args: {
        _flaunchParams: FlaunchParamsMultichain;
        _treasuryManagerParams: MultichainTreasuryManagerArgs;
        _trustedFeeSigner: Address;
      };
    };

/**
 * Builds the multichain zap `flaunch` arguments without touching the network, selecting the
 * manager overload when a manager is configured. `flaunch()` and the pre-buy planner share this.
 * @throws on fair-launch or trusted-signer inputs, which this deployment family does not support
 */
export function buildMultichainFlaunchArgs(
  chainId: number,
  params: FlaunchParams
): MultichainFlaunchArgs {
  const flaunchParams = toFlaunchParamsMultichain(params);
  const manager = params.treasuryManagerParams?.manager;

  if (!manager) {
    return {
      overload: "plain",
      args: { _flaunchParams: flaunchParams, _trustedFeeSigner: zeroAddress },
    };
  }

  return {
    overload: "manager",
    args: {
      _flaunchParams: flaunchParams,
      _treasuryManagerParams: {
        manager,
        permissions: getPermissionsAddress(
          params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
          chainId
        ),
        initializeData: params.treasuryManagerParams?.initializeData ?? "0x",
        depositData: params.treasuryManagerParams?.depositData ?? "0x",
      },
      _trustedFeeSigner: zeroAddress,
    },
  };
}

export function toFlaunchParamsMultichain(
  params: FlaunchParams
): FlaunchParamsMultichain {
  if (params.fairLaunchPercent !== 0 || params.fairLaunchDuration !== 0) {
    throw new Error("Fair launches are not supported on this chain");
  }

  if (params.trustedSignerSettings) {
    throw new Error("Trusted signers are not supported on this chain");
  }

  const initialMarketCap = parseUnits(
    params.initialMarketCapUSD.toString(),
    6
  );

  return {
    name: params.name,
    symbol: params.symbol,
    tokenUri: params.tokenUri,
    premineAmount: params.premineAmount ?? 0n,
    creator: params.creator,
    creatorFeeAllocation: Math.round(
      params.creatorFeeAllocationPercent * 100
    ),
    flaunchAt: params.flaunchAt ?? 0n,
    initialPriceParams: encodeAbiParameters(
      [{ type: "uint256" }],
      [initialMarketCap]
    ),
    feeCalculatorParams: "0x",
  };
}

/** Minimal read client for the multichain FlaunchZap deployment family. */
export class ReadFlaunchZapMultichain {
  public readonly contract: ReadContract<FlaunchZapMultichainABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: FlaunchZapAbi,
      address,
    });
  }

  protected prepareFlaunch(params: FlaunchParams) {
    return toFlaunchParamsMultichain(params);
  }

  protected calculateFee(params: FlaunchParamsMultichain) {
    return this.contract.read("calculateFee", {
      _flaunchParams: params,
      _slippage: 500n,
    });
  }

  /**
   * The zap's `calculateFee` with caller-chosen slippage (integer basis points) and an optional
   * pinned block: the ETH a launch must send — flaunch fee plus the buffered premine cost, both
   * native on this route. Used by the pre-buy planner.
   */
  calculateFeeBps(
    params: FlaunchParamsMultichain,
    slippageBps: bigint,
    options?: { block?: bigint }
  ) {
    return this.contract.read(
      "calculateFee",
      { _flaunchParams: params, _slippage: slippageBps },
      options
    );
  }
}

/** Minimal write client for standard launches on multichain deployments. */
export class ReadWriteFlaunchZapMultichain extends ReadFlaunchZapMultichain {
  declare contract: ReadWriteContract<FlaunchZapMultichainABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Creates a new Flaunch, optionally depositing it into a treasury manager.
   *
   * FlaunchZap exposes two `flaunch` overloads. Without a manager the
   * two-argument form is used; with one, the three-argument form that takes
   * `_treasuryManagerParams`. Picking the wrong overload would still produce a
   * valid transaction that silently drops the manager, so the manager presence
   * is what selects it.
   */
  async flaunch(chainId: number, params: FlaunchParams) {
    const prepared = buildMultichainFlaunchArgs(chainId, params);
    const ethRequired = await this.calculateFee(prepared.args._flaunchParams);
    return this.flaunchPrepared(prepared, ethRequired);
  }

  /**
   * Sends prepared `flaunch` arguments (see `buildMultichainFlaunchArgs`) with an explicit
   * `value` — the pre-buy executor's quoted maximum, which is the on-chain spending cap.
   */
  flaunchPrepared(prepared: MultichainFlaunchArgs, value: bigint) {
    if (prepared.overload === "plain") {
      return this.contract.write("flaunch", prepared.args, { value });
    }
    return this.contract.write("flaunch", prepared.args, { value });
  }

  /**
   * Creates a new Flaunch, storing the token metadata on IPFS
   */
  async flaunchIPFS(chainId: number, params: FlaunchIPFSParams) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunch(chainId, {
      ...params,
      tokenUri,
    });
  }

  /**
   * Creates a new Flaunch that deposits into an existing RevenueManager
   * instance. Mirrors the base deployment: the instance address is passed
   * through as the manager with no initialization data, and the zap deposits
   * into it rather than deploying a new manager.
   */
  async flaunchWithRevenueManager(
    chainId: number,
    params: FlaunchWithRevenueManagerParams
  ) {
    return this.flaunch(chainId, toFlaunchParamsWithRevenueManager(params));
  }

  /**
   * Creates a new Flaunch for a revenue manager, storing metadata on IPFS
   */
  async flaunchIPFSWithRevenueManager(
    chainId: number,
    params: FlaunchWithRevenueManagerIPFSParams
  ) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunchWithRevenueManager(chainId, {
      ...params,
      tokenUri,
    });
  }

  /**
   * Creates a new Flaunch that splits creator fees across a fixed list of
   * recipients, deploying an AddressFeeSplitManager at launch.
   */
  async flaunchWithSplitManager(
    chainId: number,
    params: FlaunchWithSplitManagerParams
  ) {
    return this.flaunch(
      chainId,
      toFlaunchParamsWithSplitManager(params, chainId)
    );
  }

  /**
   * Creates a new Flaunch with a split manager, storing metadata on IPFS
   */
  async flaunchIPFSWithSplitManager(
    chainId: number,
    params: FlaunchWithSplitManagerIPFSParams
  ) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunchWithSplitManager(chainId, {
      ...params,
      tokenUri,
    });
  }

  /**
   * Creates a new Flaunch with a dynamic split manager, storing metadata on IPFS
   */
  async flaunchIPFSWithDynamicSplitManager(
    chainId: number,
    params: FlaunchWithDynamicSplitManagerIPFSParams
  ) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunchWithDynamicSplitManager(chainId, {
      ...params,
      tokenUri,
    });
  }

  async flaunchWithDynamicSplitManager(
    chainId: number,
    params: FlaunchWithDynamicSplitManagerParams
  ) {
    return this.flaunch(
      chainId,
      toFlaunchParamsWithDynamicSplitManager(params, chainId)
    );
  }
}
