import {
  type Address,
  type Drift,
  type ReadContract,
  type ReadWriteAdapter,
  type ReadWriteContract,
  createDrift,
} from "@delvtech/drift";
import { MemecoinVestingAbi } from "../abi/MemecoinVesting";

export type MemecoinVestingABI = typeof MemecoinVestingAbi;

/** One stored schedule (`MemecoinVesting.schedules(token, beneficiary)[i]`). */
export type VestingSchedule = {
  total: bigint;
  claimed: bigint;
  /** Unix seconds. */
  start: number;
  /** Seconds. */
  cliffDuration: number;
  /** Seconds. */
  vestDuration: number;
  kind: number;
};

export type VestingPositionSchedule = VestingSchedule & {
  /** Index into `schedules(token, beneficiary)`; the id `claim` takes. */
  scheduleId: bigint;
  /** Unix seconds when the cliff lifts: `start + cliffDuration`. */
  cliffAt: number;
  /** Unix seconds when the schedule is fully vested: `start + vestDuration`. */
  endsAt: number;
  /** Coins vested so far (claimed or not), from the contract. */
  vested: bigint;
  /** Coins claimable now, from the contract. */
  claimable: bigint;
};

export type VestingPosition = {
  token: Address;
  beneficiary: Address;
  schedules: VestingPositionSchedule[];
  total: bigint;
  claimed: bigint;
  vested: bigint;
  claimable: bigint;
};

/** Read client for MemecoinVesting — the escrow that holds a vested launch's schedules. */
export class ReadMemecoinVesting {
  public readonly contract: ReadContract<MemecoinVestingABI>;
  public readonly address: Address;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.address = address;
    this.contract = drift.contract({ abi: MemecoinVestingAbi, address });
  }

  /** Every schedule of `beneficiary` for `token`, in id order. */
  async schedules(
    token: Address,
    beneficiary: Address,
    options?: { block?: bigint }
  ): Promise<VestingSchedule[]> {
    const rows = await this.contract.read(
      "schedules",
      { _token: token, _beneficiary: beneficiary },
      options
    );
    return rows.map((row) => ({
      total: row.total,
      claimed: row.claimed,
      start: row.start,
      cliffDuration: row.cliffDuration,
      vestDuration: row.vestDuration,
      kind: row.kind,
    }));
  }

  claimable(
    token: Address,
    beneficiary: Address,
    scheduleId: bigint,
    options?: { block?: bigint }
  ): Promise<bigint> {
    return this.contract.read(
      "claimable",
      { _token: token, _beneficiary: beneficiary, _scheduleId: scheduleId },
      options
    );
  }

  vestedAmount(
    token: Address,
    beneficiary: Address,
    scheduleId: bigint,
    options?: { block?: bigint }
  ): Promise<bigint> {
    return this.contract.read(
      "vestedAmount",
      { _token: token, _beneficiary: beneficiary, _scheduleId: scheduleId },
      options
    );
  }

  /**
   * Every schedule of `beneficiary` for `token` with its id, cliff/end timestamps and the
   * contract's own vested / claimable figures, plus totals across schedules.
   */
  async getVestingPosition(
    token: Address,
    beneficiary: Address,
    options?: { block?: bigint }
  ): Promise<VestingPosition> {
    await this.contract.cache?.clear?.();
    const rows = await this.schedules(token, beneficiary, options);
    const schedules = await Promise.all(
      rows.map(async (row, index) => {
        const scheduleId = BigInt(index);
        const [vested, claimable] = await Promise.all([
          this.vestedAmount(token, beneficiary, scheduleId, options),
          this.claimable(token, beneficiary, scheduleId, options),
        ]);
        return {
          ...row,
          scheduleId,
          cliffAt: row.start + row.cliffDuration,
          endsAt: row.start + row.vestDuration,
          vested,
          claimable,
        };
      })
    );
    const sum = (key: "total" | "claimed" | "vested" | "claimable") =>
      schedules.reduce((acc, schedule) => acc + schedule[key], 0n);
    return {
      token,
      beneficiary,
      schedules,
      total: sum("total"),
      claimed: sum("claimed"),
      vested: sum("vested"),
      claimable: sum("claimable"),
    };
  }
}

/** Write client for MemecoinVesting: the connected wallet claims its own schedules. */
export class ReadWriteMemecoinVesting extends ReadMemecoinVesting {
  declare contract: ReadWriteContract<MemecoinVestingABI>;
  protected readonly writeDrift: Drift<ReadWriteAdapter>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
    this.writeDrift = drift;
  }

  /**
   * Claims the vested coins of `scheduleIds` for the connected wallet (the beneficiary is
   * `msg.sender`). Reverts `NothingToClaim` when every id has nothing claimable.
   */
  claim(token: Address, scheduleIds: bigint[]) {
    if (scheduleIds.length === 0) {
      throw new Error("At least one vesting schedule id is required");
    }
    return this.contract.write("claim", {
      _token: token,
      _scheduleIds: scheduleIds,
    });
  }

  /**
   * Claims every schedule of `token` that has something claimable for the connected wallet.
   * @throws when the wallet has no claimable coins on `token`
   */
  async claimAll(token: Address) {
    const beneficiary = await this.writeDrift.getSignerAddress();
    const position = await this.getVestingPosition(token, beneficiary);
    const ids = position.schedules
      .filter((schedule) => schedule.claimable > 0n)
      .map((schedule) => schedule.scheduleId);
    if (ids.length === 0) {
      throw new Error(
        position.schedules.length === 0
          ? `${beneficiary} has no vesting schedules on ${token}`
          : `${beneficiary} has nothing claimable on ${token} yet`
      );
    }
    return this.claim(token, ids);
  }
}
