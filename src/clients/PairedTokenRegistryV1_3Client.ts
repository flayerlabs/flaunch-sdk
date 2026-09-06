import {
  type Address,
  type Drift,
  type ReadContract,
  createDrift,
} from "@delvtech/drift";
import { PairedTokenRegistryV1_3Abi } from "../abi/PairedTokenRegistryV1_3";
import { PAIRED_TOKEN_TYPE, type PairedTokenType } from "../types";

/** A registry row for a paired token — `IPairedTokenRegistry.PairedToken`. */
export type PairedTokenConfig = {
  approved: boolean;
  tokenType: PairedTokenType;
  /** The token's own decimals (6 for mUSD/USDC, 8 for the B20 equities, 18 for flETH). */
  decimals: number;
  underlying: Address;
  feeEscrow: Address;
  priceCalculator: Address;
  minDistribute: bigint;
  bidWallThreshold: bigint;
};

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

  /** The full registry row: approval, type, decimals, escrow and pricing hooks. */
  async tokenConfig(token: Address): Promise<PairedTokenConfig> {
    const row = await this.contract.read("tokenConfig", { _token: token });
    const tokenType = Number(row.tokenType);
    return {
      approved: row.approved,
      tokenType: (Object.values(PAIRED_TOKEN_TYPE) as number[]).includes(
        tokenType
      )
        ? (tokenType as PairedTokenType)
        : PAIRED_TOKEN_TYPE.unset,
      decimals: Number(row.decimals),
      underlying: row.underlying,
      feeEscrow: row.feeEscrow,
      priceCalculator: row.priceCalculator,
      minDistribute: row.minDistribute,
      bidWallThreshold: row.bidWallThreshold,
    };
  }
}
