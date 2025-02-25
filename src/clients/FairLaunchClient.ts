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
import { FairLaunchAbi } from "../abi/FairLaunch";

export type FairLaunchABI = typeof FairLaunchAbi;

export class ReadFairLaunch {
  contract: ReadContract<FairLaunchABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: FairLaunchAbi,
      address,
    });
  }

  fairLaunchInfo({ poolId }: { poolId: HexString }) {
    return this.contract.read("fairLaunchInfo", {
      _poolId: poolId,
    });
  }
}
