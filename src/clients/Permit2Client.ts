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
import { Permit2Abi } from "../abi/Permit2";

export type Permit2ABI = typeof Permit2Abi;

export class ReadPermit2 {
  contract: ReadContract<Permit2ABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: Permit2Abi,
      address,
    });
  }

  async allowance(owner: Address, coinAddress: Address, spender: Address) {
    return this.contract.read("allowance", {
      0: owner,
      1: coinAddress,
      2: spender,
    });
  }
}
