import {
  type ReadContract,
  type Address,
  type Drift,
  type ReadWriteContract,
  type ReadWriteAdapter,
  createDrift,
  HexString,
} from "@delvtech/drift";
import { TrustedSignerFeeCalculatorAbi } from "../abi/TrustedSignerFeeCalculator";

export type TrustedSignerFeeCalculatorABI =
  typeof TrustedSignerFeeCalculatorAbi;

export class ReadTrustedSignerFeeCalculator {
  public readonly contract: ReadContract<TrustedSignerFeeCalculatorABI>;

  /**
   * Creates a new ReadTrustedSignerFeeCalculator instance
   * @param address - The address of the TrustedSignerFeeCalculator contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: TrustedSignerFeeCalculatorAbi,
      address,
    });
  }

  trustedPoolKeySigner({ poolId }: { poolId: HexString }) {
    return this.contract.read("trustedPoolKeySigner", {
      _poolId: poolId,
    });
  }
}
