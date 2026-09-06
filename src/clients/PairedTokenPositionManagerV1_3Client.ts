import {
  type Address,
  type Drift,
  type HexString,
  type ReadContract,
  createDrift,
} from "@delvtech/drift";
import { FlaunchPositionManagerV1_3Abi } from "../abi/FlaunchPositionManagerV1_3";
import { PoolKey } from "../types";

export type PairedTokenPositionManagerV1_3ABI =
  typeof FlaunchPositionManagerV1_3Abi;

/**
 * Read side of the paired-token PositionManager V1.3 — the hook every `.vpt2` pool lives on.
 * Wired at `PairedTokenPositionManagerV1_3Address` (which, unlike `FlaunchPositionManagerV1_3Address`,
 * also covers Base Sepolia).
 */
export class ReadPairedTokenPositionManagerV1_3 {
  public readonly contract: ReadContract<PairedTokenPositionManagerV1_3ABI>;
  public readonly address: Address;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.address = address;
    this.contract = drift.contract({
      abi: FlaunchPositionManagerV1_3Abi,
      address,
    });
  }

  /**
   * The pool key this manager launched for `memecoin`. An unknown coin yields a zeroed key
   * (`hooks === address(0)`) rather than reverting — callers should treat that as "not a
   * paired-token coin on this manager".
   */
  poolKey(memecoin: Address): Promise<PoolKey> {
    return this.contract.read("poolKey", { _token: memecoin });
  }

  /** The currency `poolId` is paired with; `address(0)` is native ETH. Reverts `UnknownPool` otherwise. */
  pairedToken(poolId: HexString): Promise<Address> {
    return this.contract.read("pairedToken", { _poolId: poolId });
  }
}
