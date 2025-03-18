import {
  type ReadContract,
  type Address,
  type Drift,
  type EventLog,
  type ReadWriteContract,
  type ReadWriteAdapter,
  type HexString,
  createDrift,
} from "@delvtech/drift";
import { StateViewAbi } from "../abi/StateView";
import { PositionInfoParams } from "./PoolManagerClient";
import { stringToHex } from "viem";
import { pad } from "viem";

export type StateViewABI = typeof StateViewAbi;

export class ReadStateView {
  public readonly contract: ReadContract<StateViewABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: StateViewAbi,
      address,
    });
  }

  poolSlot0({ poolId }: { poolId: HexString }) {
    return this.contract.read("getSlot0", {
      poolId,
    });
  }

  positionInfo({
    poolId,
    owner,
    tickLower,
    tickUpper,
    salt,
  }: PositionInfoParams) {
    const saltBytes32 = pad(stringToHex(salt), { size: 32, dir: "right" });

    return this.contract.read("getPositionInfo", {
      poolId,
      owner,
      tickLower,
      tickUpper,
      salt: saltBytes32,
    });
  }

  getTickLiquidity({ poolId, tick }: { poolId: HexString; tick: number }) {
    return this.contract.read("getTickLiquidity", {
      poolId,
      tick,
    });
  }
}
