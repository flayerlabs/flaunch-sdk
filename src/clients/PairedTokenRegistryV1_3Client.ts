import {
  type Address,
  type Drift,
  type ReadContract,
  createDrift,
} from "@delvtech/drift";
import { PairedTokenRegistryV1_3Abi } from "../abi/PairedTokenRegistryV1_3";

export type PairedTokenRegistryV1_3ABI =
  typeof PairedTokenRegistryV1_3Abi;

export class ReadPairedTokenRegistryV1_3 {
  public readonly contract: ReadContract<PairedTokenRegistryV1_3ABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: PairedTokenRegistryV1_3Abi,
      address,
    });
  }

  isApproved(token: Address) {
    return this.contract.read("isApproved", { _token: token });
  }
}
