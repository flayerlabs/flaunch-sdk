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
import { TokenImporterAbi } from "../abi/TokenImporter";
import { zeroAddress, parseUnits } from "viem";
import { Verifier } from "../types";
import {
  ClankerWorldVerifierAddress,
  DopplerVerifierAddress,
  VirtualsVerifierAddress,
  WhitelistVerifierAddress,
  ZoraVerifierAddress,
} from "addresses";

export type TokenImporterABI = typeof TokenImporterAbi;

/**
 * Base client for interacting with the TokenImporter contract in read-only mode
 * Provides basic contract initialization
 */
export class ReadTokenImporter {
  drift: Drift;
  chainId: number;
  public readonly contract: ReadContract<TokenImporterABI>;

  constructor(chainId: number, address: Address, drift: Drift = createDrift()) {
    this.chainId = chainId;
    this.drift = drift;
    this.contract = drift.contract({
      abi: TokenImporterAbi,
      address,
    });
  }

  /**
   * Verifies if a memecoin is valid for importing
   * @param memecoin - The address of the memecoin to import
   * @returns Promise<{ isValid: boolean; verifier: Address }> - The result of the verification
   */
  async verifyMemecoin(memecoin: Address): Promise<{
    isValid: boolean;
    verifier: Address;
  }> {
    const verifier = await this.contract.read("verifyMemecoin", {
      _memecoin: memecoin,
    });

    return {
      isValid: verifier !== zeroAddress,
      verifier,
    };
  }

  /**
   * Returns the address of a verifier
   */
  verifierAddress(verifier: Verifier) {
    switch (verifier) {
      case Verifier.CLANKER:
        return ClankerWorldVerifierAddress[this.chainId];
      case Verifier.DOPPLER:
        return DopplerVerifierAddress[this.chainId];
      case Verifier.VIRTUALS:
        return VirtualsVerifierAddress[this.chainId];
      case Verifier.WHITELIST:
        return WhitelistVerifierAddress[this.chainId];
      case Verifier.ZORA:
        return ZoraVerifierAddress[this.chainId];
      default:
        throw new Error(`Unknown verifier: ${verifier}`);
    }
  }
}

/**
 * Extended client for interacting with the TokenImporter contract with write capabilities
 */
export class ReadWriteTokenImporter extends ReadTokenImporter {
  declare contract: ReadWriteContract<TokenImporterABI>;

  constructor(
    chainId: number,
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(chainId, address, drift);
  }

  initialize({
    memecoin,
    creatorFeeAllocationPercent,
    initialMarketCapUSD,
    verifier,
  }: {
    memecoin: Address;
    creatorFeeAllocationPercent: number;
    initialMarketCapUSD: number;
    verifier?: Verifier;
  }) {
    const initialMCapInUSDCWei = parseUnits(initialMarketCapUSD.toString(), 6);
    const creatorFeeAllocationInBps = creatorFeeAllocationPercent * 100;

    // if the verifier is known then use that to save on gas
    if (verifier) {
      const verifierAddress = this.verifierAddress(verifier);
      return this.contract.write("initialize", {
        _memecoin: memecoin,
        _creatorFeeAllocation: creatorFeeAllocationInBps,
        _initialMarketCap: initialMCapInUSDCWei,
        _verifier: verifierAddress,
      });
    } else {
      return this.contract.write("initialize", {
        _memecoin: memecoin,
        _creatorFeeAllocation: creatorFeeAllocationInBps,
        _initialMarketCap: initialMCapInUSDCWei,
      });
    }
  }
}
