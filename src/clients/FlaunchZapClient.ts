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
import { FlaunchZapAbi } from "../abi/FlaunchZap";
import { parseUnits } from "viem";
import { encodeAbiParameters } from "viem";
import { RevenueManagerAddress } from "addresses";
import { generateTokenUri } from "../helpers/ipfs";
import { IPFSParams } from "../types";

export type FlaunchZapABI = typeof FlaunchZapAbi;

/**
 * Base client for interacting with the FlaunchZap contract in read-only mode
 * Provides basic contract initialization
 */
export class ReadFlaunchZap {
  public readonly contract: ReadContract<FlaunchZapABI>;
  public readonly TOTAL_SUPPLY = 100n * 10n ** 27n; // 100 Billion tokens in wei

  /**
   * Creates a new ReadFlaunchZap instance
   * @param address - The address of the FlaunchZap contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }
    this.contract = drift.contract({
      abi: FlaunchZapAbi,
      address,
    });
  }
}

export interface FlaunchParams {
  flaunchingETHFees: bigint;
  name: string;
  symbol: string;
  tokenUri: string;
  fairLaunchPercent: number;
  fairLaunchDuration: number;
  initialMarketCapUSD: number;
  creator: Address;
  creatorFeeAllocationPercent: number;
  flaunchAt?: bigint;
  premineAmount?: bigint;
}

export interface FlaunchWithRevenueManagerParams extends FlaunchParams {
  protocolRecipient: Address;
  protocolFeePercent: number;
}

export interface FlaunchWithRevenueManagerIPFSParams
  extends Omit<FlaunchWithRevenueManagerParams, "tokenUri">,
    IPFSParams {}

/**
 * Extended client for interacting with the FlaunchZap contract with write capabilities
 */
export class ReadWriteFlaunchZap extends ReadFlaunchZap {
  chainId: number;
  declare contract: ReadWriteContract<FlaunchZapABI>;

  constructor(
    chainId: number,
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
    this.chainId = chainId;
  }

  /**
   * Creates a new flaunch with revenue manager configuration
   * @param params - Parameters for the flaunch with revenue manager
   * @param params.name - The name of the token
   * @param params.symbol - The symbol of the token
   * @param params.tokenUri - The URI containing the token metadata
   * @param params.fairLaunchPercent - Percentage of total supply to be used in fair launch (0-100)
   * @param params.fairLaunchDuration - Duration of fair launch in seconds
   * @param params.initialMarketCapUSD - Initial market cap in USD
   * @param params.creator - Address of the token creator
   * @param params.creatorFeeAllocationPercent - Percentage of fees allocated to creator (0-100)
   * @param params.protocolRecipient - Address to receive protocol fees
   * @param params.protocolFeePercent - Percentage of fees allocated to protocol (0-100)
   * @param params.flaunchAt - Optional timestamp when the flaunch should start
   * @param params.premineAmount - Optional amount of tokens to premine
   * @returns Transaction response for the flaunch creation
   */
  flaunchWithRevenueManager(params: FlaunchWithRevenueManagerParams) {
    const initialMCapInUSDCWei = parseUnits(
      params.initialMarketCapUSD.toString(),
      6
    );
    const initialPriceParams = encodeAbiParameters(
      [
        {
          type: "uint256",
        },
      ],
      [initialMCapInUSDCWei]
    );

    const fairLaunchInBps = BigInt(params.fairLaunchPercent * 100);
    const creatorFeeAllocationInBps = params.creatorFeeAllocationPercent * 100;

    return this.contract.write("flaunch", {
      _flaunchParams: {
        name: params.name,
        symbol: params.symbol,
        tokenUri: params.tokenUri,
        initialTokenFairLaunch: (this.TOTAL_SUPPLY * fairLaunchInBps) / 10_000n,
        fairLaunchDuration: BigInt(params.fairLaunchDuration),
        premineAmount: params.premineAmount,
        creator: params.creator,
        creatorFeeAllocation: creatorFeeAllocationInBps,
        flaunchAt: params.flaunchAt,
        initialPriceParams,
        feeCalculatorParams: "0x",
      },
      _treasuryManagerParams: {
        manager: RevenueManagerAddress[this.chainId],
        initializeData: encodeAbiParameters(
          [
            {
              type: "tuple",
              components: [
                { type: "address", name: "protocolRecipient" },
                { type: "uint256", name: "protocolFee" },
              ],
            },
          ],
          [
            {
              protocolRecipient: params.protocolRecipient,
              protocolFee: BigInt(params.protocolFeePercent * 100), // Convert percentage to basis points
            },
          ]
        ),
        depositData: "0x",
      },
      _whitelistParams: {
        merkleRoot: "0x",
        merkleIPFSHash: "",
        maxTokens: 0n,
      },
      _airdropParams: {
        airdropIndex: 0n,
        airdropAmount: 0n,
        airdropEndTime: 0n,
        merkleRoot: "0x",
        merkleIPFSHash: "",
      },
    });
  }

  /**
   * Creates a new flaunch with revenue manager using metadata stored on IPFS
   * @param params - Parameters for the flaunch including all revenue manager params and IPFS metadata
   * @returns Promise resolving to the transaction response for the flaunch creation
   */
  async flaunchIPFSWithRevenueManager(
    params: FlaunchWithRevenueManagerIPFSParams
  ) {
    const tokenUri = await generateTokenUri(params.name, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunchWithRevenueManager({
      ...params,
      tokenUri,
    });
  }
}
