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
import { MulticallAbi } from "../abi/Multicall";

export type MulticallABI = typeof MulticallAbi;

export class ReadMulticall {
  // same address across all chains
  public readonly address: Address =
    "0xcA11bde05977b3631167028862bE2a173976CA11";

  public readonly contract: ReadContract<MulticallABI>;

  constructor(drift: Drift) {
    this.contract = drift.contract({
      abi: MulticallAbi,
      address: this.address,
    });
  }

  aggregate3(calls: { target: Address; callData: HexString }[]) {
    return this.contract.simulateWrite("aggregate3", {
      calls: calls.map((call) => ({
        target: call.target,
        allowFailure: true,
        callData: call.callData,
      })),
    });
  }
}
