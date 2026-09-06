import {
  type Address,
  type Drift,
  type HexString,
  type ReadContract,
  type ReadWriteAdapter,
  type ReadWriteContract,
  createDrift,
} from "@delvtech/drift";
import { FlaunchZapV1_3Abi } from "../abi/FlaunchZapV1_3";

export type FlaunchZapV1_3ABI = typeof FlaunchZapV1_3Abi;

export type PairedTokenFlaunchParams = {
  name: string;
  symbol: string;
  tokenUri: string;
  premineAmount: bigint;
  creator: Address;
  creatorFeeAllocation: number;
  flaunchAt: bigint;
  initialPriceParams: HexString;
  feeCalculatorParams: HexString;
  pairedToken: Address;
};

export type PairedTokenFlaunchFee = {
  ethRequired: bigint;
  pairedPremineCost: bigint;
};

export type CalculatePairedTokenFlaunchFeeParams = {
  flaunchParams: PairedTokenFlaunchParams;
  slippageBps: bigint;
};

export type FlaunchPairedTokenParams = {
  flaunchParams: PairedTokenFlaunchParams;
  trustedFeeSigner: Address;
  maxPremineCost: bigint;
  value: bigint;
};

export class ReadFlaunchZapV1_3 {
  public readonly contract: ReadContract<FlaunchZapV1_3ABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({ abi: FlaunchZapV1_3Abi, address });
  }

  async calculateFee({
    flaunchParams,
    slippageBps,
  }: CalculatePairedTokenFlaunchFeeParams): Promise<PairedTokenFlaunchFee> {
    const { ethRequired_, pairedPremineCost_ } = await this.contract.read(
      "calculateFee",
      {
        _flaunchParams: flaunchParams,
        _slippage: slippageBps,
      }
    );

    return {
      ethRequired: ethRequired_,
      pairedPremineCost: pairedPremineCost_,
    };
  }
}

export class ReadWriteFlaunchZapV1_3 extends ReadFlaunchZapV1_3 {
  declare contract: ReadWriteContract<FlaunchZapV1_3ABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  flaunch({
    flaunchParams,
    trustedFeeSigner,
    maxPremineCost,
    value,
  }: FlaunchPairedTokenParams) {
    return this.contract.write(
      "flaunch",
      {
        _flaunchParams: flaunchParams,
        _trustedFeeSigner: trustedFeeSigner,
        _maxPremineCost: maxPremineCost,
      },
      { value }
    );
  }
}
