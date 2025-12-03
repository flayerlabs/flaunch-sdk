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
import { zeroAddress, parseUnits, formatUnits } from "viem";
import { Verifier } from "../types";
import {
  ClankerWorldVerifierAddress,
  DopplerVerifierAddress,
  SolanaVerifierAddress,
  VirtualsVerifierAddress,
  WhitelistVerifierAddress,
  ZoraVerifierAddress,
} from "addresses";
import { ReadMemecoin } from "./MemecoinClient";

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
      case Verifier.SOLANA:
        return SolanaVerifierAddress[this.chainId];
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

  async initialize(
    params:
      | {
          coinAddress: Address;
          creatorFeeAllocationPercent: number;
          initialMarketCapUSD: number;
          verifier?: Verifier;
        }
      | {
          coinAddress: Address;
          creatorFeeAllocationPercent: number;
          initialPriceUSD: number;
          verifier?: Verifier;
        }
  ) {
    return this.contract.write(
      "initialize",
      await this.getInitializeParams(params)
    );
  }

  async getInitializeParams(
    params:
      | {
          coinAddress: Address;
          creatorFeeAllocationPercent: number;
          initialMarketCapUSD: number;
          verifier?: Verifier;
        }
      | {
          coinAddress: Address;
          creatorFeeAllocationPercent: number;
          initialPriceUSD: number;
          verifier?: Verifier;
        }
  ) {
    let initialMarketCapUSD: number;
    if ("initialMarketCapUSD" in params) {
      initialMarketCapUSD = params.initialMarketCapUSD;
    } else {
      const memecoin = new ReadMemecoin(params.coinAddress, this.drift);
      const totalSupply = await memecoin.totalSupply();
      const decimals = await memecoin.decimals();
      const formattedTotalSupply = parseFloat(
        formatUnits(totalSupply, decimals)
      );

      initialMarketCapUSD = params.initialPriceUSD * formattedTotalSupply;
    }

    const initialMCapInUSDCWei = parseUnits(initialMarketCapUSD.toString(), 6);
    const creatorFeeAllocationInBps = params.creatorFeeAllocationPercent * 100;

    // Passing in the verifier here, as drift doesn't recognize the other initialize function without the verifier param
    let _verifier = params.verifier
      ? this.verifierAddress(params.verifier)
      : await this.contract.read("verifyMemecoin", {
          _memecoin: params.coinAddress,
        });

    return {
      _memecoin: params.coinAddress,
      _creatorFeeAllocation: creatorFeeAllocationInBps,
      _initialMarketCap: initialMCapInUSDCWei,
      _verifier,
    };
  }
}
