import {
  type Address,
  type Drift,
  type HexString,
  type ReadContract,
  type ReadWriteAdapter,
  type ReadWriteContract,
  createDrift,
} from "@delvtech/drift";
import { encodeAbiParameters, parseUnits, zeroAddress } from "viem";
import { FlaunchZapAbi } from "../abi/FlaunchZap";
import type { FlaunchParams } from "./FlaunchZapClient";

export type FlaunchZapMultichainABI = typeof FlaunchZapAbi;

type FlaunchParamsMultichain = {
  name: string;
  symbol: string;
  tokenUri: string;
  premineAmount: bigint;
  creator: Address;
  creatorFeeAllocation: number;
  flaunchAt: bigint;
  initialPriceParams: HexString;
  feeCalculatorParams: HexString;
};

function toFlaunchParamsMultichain(
  params: FlaunchParams
): FlaunchParamsMultichain {
  if (params.fairLaunchPercent !== 0 || params.fairLaunchDuration !== 0) {
    throw new Error("Fair launches are not supported on this chain");
  }

  if (params.treasuryManagerParams) {
    throw new Error("Treasury managers are not supported on this chain");
  }

  if (params.trustedSignerSettings) {
    throw new Error("Trusted signers are not supported on this chain");
  }

  const initialMarketCap = parseUnits(
    params.initialMarketCapUSD.toString(),
    6
  );

  return {
    name: params.name,
    symbol: params.symbol,
    tokenUri: params.tokenUri,
    premineAmount: params.premineAmount ?? 0n,
    creator: params.creator,
    creatorFeeAllocation: Math.round(
      params.creatorFeeAllocationPercent * 100
    ),
    flaunchAt: params.flaunchAt ?? 0n,
    initialPriceParams: encodeAbiParameters(
      [{ type: "uint256" }],
      [initialMarketCap]
    ),
    feeCalculatorParams: "0x",
  };
}

/** Minimal read client for the multichain FlaunchZap deployment family. */
export class ReadFlaunchZapMultichain {
  public readonly contract: ReadContract<FlaunchZapMultichainABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: FlaunchZapAbi,
      address,
    });
  }

  protected prepareFlaunch(params: FlaunchParams) {
    return toFlaunchParamsMultichain(params);
  }

  protected calculateFee(params: FlaunchParamsMultichain) {
    return this.contract.read("calculateFee", {
      _flaunchParams: params,
      _slippage: 500n,
    });
  }
}

/** Minimal write client for standard launches on multichain deployments. */
export class ReadWriteFlaunchZapMultichain extends ReadFlaunchZapMultichain {
  declare contract: ReadWriteContract<FlaunchZapMultichainABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  async flaunch(params: FlaunchParams) {
    const flaunchParams = this.prepareFlaunch(params);
    const ethRequired = await this.calculateFee(flaunchParams);

    return this.contract.write(
      "flaunch",
      {
        _flaunchParams: flaunchParams,
        _trustedFeeSigner: zeroAddress,
      },
      { value: ethRequired }
    );
  }
}
