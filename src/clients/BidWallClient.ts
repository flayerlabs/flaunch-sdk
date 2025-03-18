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
import { BidwallAbi } from "../abi/BidWall";

export type BidwallABI = typeof BidwallAbi;

export class ReadBidWall {
  public readonly contract: ReadContract<BidwallABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: BidwallAbi,
      address,
    });
  }

  position({ poolId }: { poolId: HexString }) {
    return this.contract.read("position", {
      _poolId: poolId,
    });
  }

  poolInfo({ poolId }: { poolId: HexString }) {
    return this.contract.read("poolInfo", {
      _poolId: poolId,
    });
  }
}
