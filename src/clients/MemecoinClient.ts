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
import { MemecoinAbi } from "../abi/Memecoin";

export type MemecoinABI = typeof MemecoinAbi;

export class ReadMemecoin {
  contract: ReadContract<MemecoinABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: MemecoinAbi,
      address,
    });
  }

  name() {
    return this.contract.read("name");
  }

  symbol() {
    return this.contract.read("symbol");
  }

  tokenURI() {
    return this.contract.read("tokenURI");
  }
}
