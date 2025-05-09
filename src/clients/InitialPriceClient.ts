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
import { InitialPriceAbi } from "../abi/InitialPrice";

export type InitialPriceABI = typeof InitialPriceAbi;

export class ReadInitialPrice {
  public readonly contract: ReadContract<InitialPriceABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: InitialPriceAbi,
      address,
    });
  }

  /**
   * Returns a flaunching fee of 0.1% of the initial market cap IF the market cap is greater than 10k & the sender is not fee exempt
   * @param params - The parameters for the flaunching fee calculation
   * @param params.sender - The address of the sender
   * @param params.initialPriceParams - The initial price parameters
   * @returns The flaunching fee
   */
  getFlaunchingFee(params: { sender: Address; initialPriceParams: HexString }) {
    return this.contract.read("getFlaunchingFee", {
      _sender: params.sender,
      _initialPriceParams: params.initialPriceParams,
    });
  }
}
