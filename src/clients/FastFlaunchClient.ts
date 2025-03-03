import {
  type ReadContract,
  type Address,
  type Drift,
  type EventLog,
  type ReadWriteContract,
  type ReadWriteAdapter,
  createDrift,
} from "@delvtech/drift";
import { FastFlaunchZapAbi } from "../abi/FastFlaunchZap";
import { generateTokenUri } from "../helpers/ipfs";
import { IPFSParams } from "../types";

export type FastFlaunchZapABI = typeof FastFlaunchZapAbi;

export class ReadFastFlaunchZap {
  contract: ReadContract<FastFlaunchZapABI>;
  drift: Drift;

  constructor(address: Address, drift: Drift = createDrift()) {
    this.drift = drift;
    if (!address) {
      throw new Error("Address is required");
    }
    this.contract = drift.contract({
      abi: FastFlaunchZapAbi,
      address,
    });
  }
}

export interface FastFlaunchParams {
  name: string;
  symbol: string;
  tokenUri: string;
  creator: Address;
  creatorFeeAllocationPercent: number;
}

export interface FastFlaunchIPFSParams
  extends Omit<FastFlaunchParams, "tokenUri">,
    IPFSParams {}

export class ReadWriteFastFlaunchZap extends ReadFastFlaunchZap {
  declare contract: ReadWriteContract<FastFlaunchZapABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  fastFlaunch({
    name,
    symbol,
    tokenUri,
    creator,
    creatorFeeAllocationPercent,
  }: FastFlaunchParams) {
    const creatorFeeAllocationInBps = creatorFeeAllocationPercent * 100;

    return this.contract.write("flaunch", {
      _params: {
        name,
        symbol,
        tokenUri,
        creator,
        creatorFeeAllocation: creatorFeeAllocationInBps,
      },
    });
  }

  async fastFlaunchIPFS({
    name,
    symbol,
    creator,
    creatorFeeAllocationPercent,
    metadata,
    pinataConfig,
  }: FastFlaunchIPFSParams) {
    const tokenUri = await generateTokenUri(name, {
      metadata,
      pinataConfig,
    });

    return this.fastFlaunch({
      name,
      symbol,
      tokenUri,
      creator,
      creatorFeeAllocationPercent,
    });
  }
}
