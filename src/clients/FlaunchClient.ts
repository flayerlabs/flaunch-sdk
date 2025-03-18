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
import { FlaunchAbi } from "../abi/Flaunch";

export type FlaunchABI = typeof FlaunchAbi;

export class ReadFlaunch {
  public readonly contract: ReadContract<FlaunchABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: FlaunchAbi,
      address,
    });
  }

  tokenId(coinAddress: Address) {
    return this.contract.read("tokenId", {
      _memecoin: coinAddress,
    });
  }

  tokenURI(tokenId: bigint) {
    return this.contract.read("tokenURI", {
      _tokenId: tokenId,
    });
  }
}
