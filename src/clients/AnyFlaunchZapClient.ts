import {
  type Address,
  type Drift,
  type HexString,
  type ReadContract,
  type ReadWriteAdapter,
  type ReadWriteContract,
  createDrift,
  decodeFunctionReturn,
  encodeFunctionData,
} from "@delvtech/drift";
import { encodeFunctionData as viemEncodeFunctionData, zeroAddress } from "viem";
import { AnyFlaunchZapAbi } from "../abi/AnyFlaunchZap";

export type AnyFlaunchZapABI = typeof AnyFlaunchZapAbi;

/** One `VestingSchedule` as the zap / MemecoinVesting take it. */
export type VestingScheduleArgs = {
  beneficiary: Address;
  /** Coins, in wei (the supply is `FLAUNCH_TOTAL_SUPPLY`). */
  amount: bigint;
  /** Unix seconds; 0 = the launch block's timestamp. An explicit past start reverts (`ScheduleStartInvalid`). */
  start: number;
  /** Seconds; must be <= `vestDuration`. */
  cliffDuration: number;
  /** Seconds; must be > 0. */
  vestDuration: number;
};

/** `AnyFlaunchZap.FlaunchParams` — the contract struct. */
export type AnyFlaunchZapFlaunchParams = {
  name: string;
  symbol: string;
  tokenUri: string;
  creator: Address;
  /** 2 dp percent: 5000 = 50%. */
  creatorFeeAllocation: number;
  /** USDC, 6 dp: 4_000e6 = $4,000. */
  initialMarketCap: bigint;
  feeCalculatorParams: HexString;
  /** Registry-approved; flETH or `zeroAddress` for native ETH, or an approved ERC20. */
  pairedToken: Address;
  premineAmount: bigint;
  /** 0 = now. */
  flaunchAt: bigint;
  vestingSchedules: VestingScheduleArgs[];
};

export type AnyFlaunchZapFee = {
  /** ETH the launch must send: flaunching fee plus the buffered premine cost when ETH-funded. */
  ethRequired: bigint;
  /** The premine's cost in the paired token (equals the ETH premine cost for native pairings). */
  pairedPremineCost: bigint;
};

export type CalculateAnyFlaunchZapFeeParams = {
  flaunchParams: AnyFlaunchZapFlaunchParams;
  slippageBps: bigint;
};

/** The `_treasuryManagerParams` tuple, permissions already resolved to a contract address. */
export type AnyFlaunchZapTreasuryManagerArgs = {
  manager: Address;
  permissions: Address;
  initializeData: HexString;
  depositData: HexString;
};

/** The exact argument object of each `flaunch` overload; the key set selects the overload. */
export type AnyFlaunchZapFlaunchArgs =
  | {
      overload: "plain";
      args: {
        _flaunchParams: AnyFlaunchZapFlaunchParams;
        _trustedFeeSigner: Address;
      };
    }
  | {
      overload: "maxPremineCost";
      args: {
        _flaunchParams: AnyFlaunchZapFlaunchParams;
        _trustedFeeSigner: Address;
        _maxPremineCost: bigint;
      };
    }
  | {
      overload: "manager";
      args: {
        _flaunchParams: AnyFlaunchZapFlaunchParams;
        _treasuryManagerParams: AnyFlaunchZapTreasuryManagerArgs;
        _trustedFeeSigner: Address;
      };
    }
  | {
      overload: "managerMaxPremineCost";
      args: {
        _flaunchParams: AnyFlaunchZapFlaunchParams;
        _treasuryManagerParams: AnyFlaunchZapTreasuryManagerArgs;
        _trustedFeeSigner: Address;
        _maxPremineCost: bigint;
      };
    };

export type BuildAnyFlaunchZapFlaunchArgsParams = {
  flaunchParams: AnyFlaunchZapFlaunchParams;
  /** `zeroAddress` unless the launch is signer-gated. */
  trustedFeeSigner?: Address;
  /**
   * The paired-token spend cap. Selects the `_maxPremineCost` overloads, which are REQUIRED
   * for a premine on an ERC20 pairing (`Erc20PremineRequiresMaxCost`); ignored on chain for
   * native / flETH pairings.
   */
  maxPremineCost?: bigint;
  /** Selects the manager overloads when `manager` is a non-zero address. */
  treasuryManagerParams?: AnyFlaunchZapTreasuryManagerArgs;
};

export type AnyFlaunchZapFlaunchCall = BuildAnyFlaunchZapFlaunchArgsParams & {
  /** ETH sent: the flaunching fee plus the ETH-funded premine cap. */
  value: bigint;
};

/**
 * Builds the `flaunch` arguments without touching the network. Manager overloads iff
 * `treasuryManagerParams.manager` is a non-zero address; `_maxPremineCost` overloads iff
 * `maxPremineCost !== undefined`. Picking the wrong overload would still be a valid call that
 * silently drops the manager, so presence is what selects it.
 */
export function buildAnyFlaunchZapFlaunchArgs({
  flaunchParams,
  trustedFeeSigner = zeroAddress,
  maxPremineCost,
  treasuryManagerParams,
}: BuildAnyFlaunchZapFlaunchArgsParams): AnyFlaunchZapFlaunchArgs {
  const withManager =
    treasuryManagerParams !== undefined &&
    treasuryManagerParams.manager !== zeroAddress;

  if (withManager) {
    if (maxPremineCost !== undefined) {
      return {
        overload: "managerMaxPremineCost",
        args: {
          _flaunchParams: flaunchParams,
          _treasuryManagerParams: treasuryManagerParams,
          _trustedFeeSigner: trustedFeeSigner,
          _maxPremineCost: maxPremineCost,
        },
      };
    }
    return {
      overload: "manager",
      args: {
        _flaunchParams: flaunchParams,
        _treasuryManagerParams: treasuryManagerParams,
        _trustedFeeSigner: trustedFeeSigner,
      },
    };
  }

  if (maxPremineCost !== undefined) {
    return {
      overload: "maxPremineCost",
      args: {
        _flaunchParams: flaunchParams,
        _trustedFeeSigner: trustedFeeSigner,
        _maxPremineCost: maxPremineCost,
      },
    };
  }
  return {
    overload: "plain",
    args: { _flaunchParams: flaunchParams, _trustedFeeSigner: trustedFeeSigner },
  };
}

const FLAUNCH_OVERLOAD_INPUTS: Record<AnyFlaunchZapFlaunchArgs["overload"], readonly string[]> = {
  plain: ["_flaunchParams", "_trustedFeeSigner"],
  maxPremineCost: ["_flaunchParams", "_trustedFeeSigner", "_maxPremineCost"],
  manager: ["_flaunchParams", "_treasuryManagerParams", "_trustedFeeSigner"],
  managerMaxPremineCost: [
    "_flaunchParams",
    "_treasuryManagerParams",
    "_trustedFeeSigner",
    "_maxPremineCost",
  ],
};

/**
 * The zap ABI with a single `flaunch` — the named overload. Drift resolves an overloaded
 * function by argument count, and two `flaunch` overloads take three arguments, so each
 * overload is called through its own ABI slice.
 */
export function anyFlaunchZapAbiFor(
  overload: AnyFlaunchZapFlaunchArgs["overload"]
): AnyFlaunchZapABI {
  const inputs = FLAUNCH_OVERLOAD_INPUTS[overload];
  return AnyFlaunchZapAbi.filter(
    (entry) =>
      entry.type !== "function" ||
      entry.name !== "flaunch" ||
      (entry.inputs.length === inputs.length &&
        entry.inputs.every((input, index) => input.name === inputs[index]))
  ) as unknown as AnyFlaunchZapABI;
}

/** ABI-encodes prepared `flaunch` arguments (the pre-buy planner's calldata). */
export function encodeAnyFlaunchZapFlaunch(prepared: AnyFlaunchZapFlaunchArgs): HexString {
  switch (prepared.overload) {
    case "plain":
      return viemEncodeFunctionData({
        abi: AnyFlaunchZapAbi,
        functionName: "flaunch",
        args: [prepared.args._flaunchParams, prepared.args._trustedFeeSigner],
      });
    case "maxPremineCost":
      return viemEncodeFunctionData({
        abi: AnyFlaunchZapAbi,
        functionName: "flaunch",
        args: [
          prepared.args._flaunchParams,
          prepared.args._trustedFeeSigner,
          prepared.args._maxPremineCost,
        ],
      });
    case "manager":
      return viemEncodeFunctionData({
        abi: AnyFlaunchZapAbi,
        functionName: "flaunch",
        args: [
          prepared.args._flaunchParams,
          prepared.args._treasuryManagerParams,
          prepared.args._trustedFeeSigner,
        ],
      });
    case "managerMaxPremineCost":
      return viemEncodeFunctionData({
        abi: AnyFlaunchZapAbi,
        functionName: "flaunch",
        args: [
          prepared.args._flaunchParams,
          prepared.args._treasuryManagerParams,
          prepared.args._trustedFeeSigner,
          prepared.args._maxPremineCost,
        ],
      });
  }
}

/** Read client for the AnyFlaunchZap (vested launches). */
export class ReadAnyFlaunchZap {
  public readonly contract: ReadContract<AnyFlaunchZapABI>;
  public readonly address: Address;
  protected readonly drift: Drift;

  private readonly overloadContracts = new Map<
    AnyFlaunchZapFlaunchArgs["overload"],
    ReadContract<AnyFlaunchZapABI>
  >();

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.address = address;
    this.drift = drift;
    this.contract = drift.contract({ abi: AnyFlaunchZapAbi, address });
  }

  /** A contract bound to the ABI slice holding only the named `flaunch` overload. */
  protected contractFor(
    overload: AnyFlaunchZapFlaunchArgs["overload"]
  ): ReadContract<AnyFlaunchZapABI> {
    let contract = this.overloadContracts.get(overload);
    if (!contract) {
      contract = this.drift.contract({ abi: anyFlaunchZapAbiFor(overload), address: this.address });
      this.overloadContracts.set(overload, contract);
    }
    return contract;
  }

  /**
   * The zap's `calculateFee`: the ETH the launch must send and the premine's paired-token cost,
   * at caller-chosen slippage (integer bps) and an optional pinned block. The flaunching fee
   * exemption is checked against the CALLER, so pass `from` to quote as the launching wallet;
   * without it the read is an anonymous `eth_call`.
   */
  async calculateFee(
    { flaunchParams, slippageBps }: CalculateAnyFlaunchZapFeeParams,
    options?: { block?: bigint; from?: Address }
  ): Promise<AnyFlaunchZapFee> {
    const args = { _flaunchParams: flaunchParams, _slippage: slippageBps };
    if (options?.from) {
      const data = await this.drift.call({
        to: this.address,
        data: encodeFunctionData({ abi: AnyFlaunchZapAbi, fn: "calculateFee", args }),
        from: options.from,
        ...(options.block === undefined ? {} : { block: options.block }),
      });
      const { ethRequired_, pairedPremineCost_ } = decodeFunctionReturn({
        abi: AnyFlaunchZapAbi,
        fn: "calculateFee",
        data,
      });
      return { ethRequired: ethRequired_, pairedPremineCost: pairedPremineCost_ };
    }
    const { ethRequired_, pairedPremineCost_ } = await this.contract.read(
      "calculateFee",
      args,
      options?.block === undefined ? undefined : { block: options.block }
    );
    return { ethRequired: ethRequired_, pairedPremineCost: pairedPremineCost_ };
  }

  /**
   * `eth_call`s the launch as `from` with `value`: the coin address, the ETH the zap would spend
   * and the deployed manager (zero without one), or the revert (`VestedSupplyExceedsCap`,
   * `PremineCostExceedsMaximum`, …) before anything is signed.
   */
  async simulateFlaunch(
    prepared: AnyFlaunchZapFlaunchArgs,
    { from, value }: { from: Address; value: bigint }
  ): Promise<{ memecoin: Address; ethSpent: bigint; deployedManager: Address }> {
    // Drift types the return as the union across overloads; only the manager overloads carry
    // `deployedManager_`.
    const result = (await this.contractFor(prepared.overload).simulateWrite(
      "flaunch",
      prepared.args,
      { from, value }
    )) as { memecoin_: Address; ethSpent_: bigint; deployedManager_?: Address };
    return {
      memecoin: result.memecoin_,
      ethSpent: result.ethSpent_,
      deployedManager: result.deployedManager_ ?? zeroAddress,
    };
  }

  /** The cap on vested supply, in bps of total supply (5000 = 50% by default; always < 10000). */
  maxVestedBps(options?: { block?: bigint }): Promise<bigint> {
    return this.contract.read("maxVestedBps", {}, options);
  }

  flaunchFeeRecipient(): Promise<Address> {
    return this.contract.read("flaunchFeeRecipient");
  }

  memecoinVesting(): Promise<Address> {
    return this.contract.read("memecoinVesting");
  }

  /** The AnyFlaunch ERC721 of the hook this zap launches through. */
  flaunchContract(): Promise<Address> {
    return this.contract.read("flaunchContract");
  }

  /** The AnyPositionManager hook this zap launches through (emits the coins' `PoolCreated`). */
  anyPositionManager(): Promise<Address> {
    return this.contract.read("anyPositionManager");
  }

  treasuryManagerFactory(): Promise<Address> {
    return this.contract.read("treasuryManagerFactory");
  }
}

/** Write client for the AnyFlaunchZap. */
export class ReadWriteAnyFlaunchZap extends ReadAnyFlaunchZap {
  declare contract: ReadWriteContract<AnyFlaunchZapABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /** Launches with the overload `buildAnyFlaunchZapFlaunchArgs` selects, sending `value`. */
  flaunch({ value, ...params }: AnyFlaunchZapFlaunchCall) {
    return this.flaunchPrepared(buildAnyFlaunchZapFlaunchArgs(params), value);
  }

  /** Sends prepared `flaunch` arguments with an explicit `value` (the pre-buy executor's cap). */
  flaunchPrepared(prepared: AnyFlaunchZapFlaunchArgs, value: bigint) {
    // The drift is read-write (see the constructor), so the overload slice is too.
    const contract = this.contractFor(prepared.overload) as ReadWriteContract<AnyFlaunchZapABI>;
    return contract.write("flaunch", prepared.args, { value });
  }

  /** Deploys and initializes a treasury manager through the zap's factory (no launch). */
  deployAndInitializeManager(params: {
    managerImplementation: Address;
    owner: Address;
    data: HexString;
    permissions: Address;
  }) {
    return this.contract.write("deployAndInitializeManager", {
      _managerImplementation: params.managerImplementation,
      _owner: params.owner,
      _data: params.data,
      _permissions: params.permissions,
    });
  }
}
