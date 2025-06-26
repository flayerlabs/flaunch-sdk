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
import { parseUnits, zeroAddress, zeroHash } from "viem";
import { encodeAbiParameters } from "viem";
import { generateTokenUri } from "../helpers/ipfs";
import { IPFSParams } from "../types";
import { ReadFlaunchPositionManagerV1_1 } from "./FlaunchPositionManagerV1_1Client";
import {
  AddressFeeSplitManagerAddress,
  FlaunchPositionManagerV1_1Address,
} from "addresses";
import { getAmountWithSlippage } from "utils/universalRouter";
import { ReadInitialPrice } from "./InitialPriceClient";

export type FlaunchZapABI = typeof FlaunchZapAbi;

export interface FlaunchParams {
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
  treasuryManagerParams?: {
    manager?: Address;
    initializeData?: HexString;
    depositData?: HexString;
  };
}

export interface FlaunchIPFSParams
  extends Omit<FlaunchParams, "tokenUri">,
    IPFSParams {}

export interface FlaunchWithRevenueManagerParams
  extends Omit<FlaunchParams, "treasuryManagerParams"> {
  revenueManagerInstanceAddress: Address;
}

export interface FlaunchWithRevenueManagerIPFSParams
  extends Omit<FlaunchWithRevenueManagerParams, "tokenUri">,
    IPFSParams {}

export interface FlaunchWithSplitManagerParams
  extends Omit<FlaunchParams, "treasuryManagerParams"> {
  creatorSplitPercent: number;
  splitReceivers: {
    address: Address;
    percent: number;
  }[];
}

export interface FlaunchWithSplitManagerIPFSParams
  extends Omit<FlaunchWithSplitManagerParams, "tokenUri">,
    IPFSParams {}

/**
 * Base client for interacting with the FlaunchZap contract in read-only mode
 * Provides basic contract initialization
 */
export class ReadFlaunchZap {
  drift: Drift;
  chainId: number;
  public readonly contract: ReadContract<FlaunchZapABI>;
  public readonly TOTAL_SUPPLY = 100n * 10n ** 27n; // 100 Billion tokens in wei
  public readonly readPositionManagerV1_1: ReadFlaunchPositionManagerV1_1;

  /**
   * Creates a new ReadFlaunchZap instance
   * @param chainId - The chain ID of the contract
   * @param address - The address of the FlaunchZap contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(chainId: number, address: Address, drift: Drift = createDrift()) {
    this.chainId = chainId;
    this.drift = drift;
    if (!address) {
      throw new Error("Address is required");
    }
    this.contract = drift.contract({
      abi: FlaunchZapAbi,
      address,
    });
    this.readPositionManagerV1_1 = new ReadFlaunchPositionManagerV1_1(
      FlaunchPositionManagerV1_1Address[this.chainId],
      drift
    );
  }

  async getPremineCostInWei(params: {
    initialPriceParams: HexString;
    premineAmount: bigint;
    slippagePercent?: number;
  }) {
    const mcapInWei = await this.readPositionManagerV1_1.getFlaunchingMarketCap(
      params.initialPriceParams
    );
    const premineCostInWei =
      (mcapInWei * params.premineAmount) / this.TOTAL_SUPPLY;

    // increase the premine cost by the slippage percent
    const premineCostInWeiWithSlippage = getAmountWithSlippage(
      premineCostInWei,
      (params.slippagePercent ?? 0 / 100).toFixed(18).toString(),
      "EXACT_OUT" // as we know the output premine amount
    );
    return premineCostInWeiWithSlippage;
  }

  async getFlaunchingFee(params: {
    sender: Address;
    initialPriceParams: HexString;
    slippagePercent?: number;
  }) {
    const readInitialPrice = new ReadInitialPrice(
      await this.readPositionManagerV1_1.initialPrice(),
      this.drift
    );
    const flaunchingFee = await readInitialPrice.getFlaunchingFee(params);

    // increase the flaunching fee by the slippage percent
    const flaunchingFeeWithSlippage = getAmountWithSlippage(
      flaunchingFee,
      (params.slippagePercent ?? 0 / 100).toFixed(18).toString(),
      "EXACT_OUT"
    );
    return flaunchingFeeWithSlippage;
  }

  /**
   * Calculates the ETH required to flaunch a token, takes into account the ETH for premine and the flaunching fee
   */
  ethRequiredToFlaunch(params: {
    premineAmount: bigint;
    initialPriceParams: HexString;
    slippagePercent?: number;
  }) {
    return this.contract.read("calculateFee", {
      _premineAmount: params.premineAmount ?? 0n,
      _slippage: params.slippagePercent
        ? BigInt(params.slippagePercent * 100)
        : 0n,
      _initialPriceParams: params.initialPriceParams,
    });
  }
}

/**
 * Extended client for interacting with the FlaunchZap contract with write capabilities
 */
export class ReadWriteFlaunchZap extends ReadFlaunchZap {
  declare contract: ReadWriteContract<FlaunchZapABI>;

  constructor(
    chainId: number,
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(chainId, address, drift);
  }

  /**
   * Flaunches a new token, supports premine
   * @param params - Parameters for the flaunch
   * @returns Transaction response for the flaunch creation
   */
  async flaunch(params: FlaunchParams) {
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

    const ethRequired = await this.ethRequiredToFlaunch({
      premineAmount: params.premineAmount ?? 0n,
      initialPriceParams,
      slippagePercent: 5,
    });

    const _treasuryManagerParams: {
      manager: Address;
      initializeData: HexString;
      depositData: HexString;
    } = params.treasuryManagerParams
      ? {
          manager: params.treasuryManagerParams.manager ?? zeroAddress,
          initializeData: params.treasuryManagerParams.initializeData ?? "0x",
          depositData: params.treasuryManagerParams.depositData ?? "0x",
        }
      : {
          manager: zeroAddress,
          initializeData: "0x",
          depositData: "0x",
        };

    return this.contract.write(
      "flaunch",
      {
        _flaunchParams: {
          name: params.name,
          symbol: params.symbol,
          tokenUri: params.tokenUri,
          initialTokenFairLaunch:
            (this.TOTAL_SUPPLY * fairLaunchInBps) / 10_000n,
          fairLaunchDuration: BigInt(params.fairLaunchDuration),
          premineAmount: params.premineAmount ?? 0n,
          creator: params.creator,
          creatorFeeAllocation: creatorFeeAllocationInBps,
          flaunchAt: params.flaunchAt ?? 0n,
          initialPriceParams,
          feeCalculatorParams: "0x",
        },
        _treasuryManagerParams,
        _whitelistParams: {
          merkleRoot: zeroHash,
          merkleIPFSHash: "",
          maxTokens: 0n,
        },
        _airdropParams: {
          airdropIndex: 0n,
          airdropAmount: 0n,
          airdropEndTime: 0n,
          merkleRoot: zeroHash,
          merkleIPFSHash: "",
        },
      },
      {
        value: ethRequired,
      }
    );
  }

  async flaunchIPFS(params: FlaunchIPFSParams) {
    const tokenUri = await generateTokenUri(params.name, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunch({
      ...params,
      tokenUri,
    });
  }

  /**
   * Flaunches a new token for a revenue manager
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
  async flaunchWithRevenueManager(params: FlaunchWithRevenueManagerParams) {
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

    const ethRequired = await this.ethRequiredToFlaunch({
      premineAmount: params.premineAmount ?? 0n,
      initialPriceParams,
      slippagePercent: 5,
    });

    return this.contract.write(
      "flaunch",
      {
        _flaunchParams: {
          name: params.name,
          symbol: params.symbol,
          tokenUri: params.tokenUri,
          initialTokenFairLaunch:
            (this.TOTAL_SUPPLY * fairLaunchInBps) / 10_000n,
          fairLaunchDuration: BigInt(params.fairLaunchDuration),
          premineAmount: params.premineAmount ?? 0n,
          creator: params.creator,
          creatorFeeAllocation: creatorFeeAllocationInBps,
          flaunchAt: params.flaunchAt ?? 0n,
          initialPriceParams,
          feeCalculatorParams: "0x",
        },
        _treasuryManagerParams: {
          manager: params.revenueManagerInstanceAddress,
          initializeData: "0x",
          depositData: "0x",
        },
        _whitelistParams: {
          merkleRoot: zeroHash,
          merkleIPFSHash: "",
          maxTokens: 0n,
        },
        _airdropParams: {
          airdropIndex: 0n,
          airdropAmount: 0n,
          airdropEndTime: 0n,
          merkleRoot: zeroHash,
          merkleIPFSHash: "",
        },
      },
      {
        value: ethRequired,
      }
    );
  }

  /**
   * Flaunches a new token for a revenue manager, storing the token metadata on IPFS
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

  /**
   * Flaunches a new token that splits the creator fees to the creator and a list of recipients
   * @param params - Parameters for the flaunch with split manager
   * @param params.name - The name of the token
   * @param params.symbol - The symbol of the token
   * @param params.tokenUri - The URI containing the token metadata
   * @param params.fairLaunchPercent - Percentage of total supply to be used in fair launch (0-100)
   * @param params.fairLaunchDuration - Duration of fair launch in seconds
   * @param params.initialMarketCapUSD - Initial market cap in USD
   * @param params.creator - Address of the token creator
   * @param params.creatorFeeAllocationPercent - Percentage of fees allocated to creator (0-100)
   * @param params.creatorSplitPercent - Percentage of fees allocated to creator (0-100)
   * @param params.splitReceivers - List of recipients and their percentage of the fees
   * @param params.flaunchAt - Optional timestamp when the flaunch should start
   * @param params.premineAmount - Optional amount of tokens to premine
   * @param params.creatorSplitPercent - Split percentage of the fees for the creator (0-100)
   * @param params.splitReceivers - List of recipients and their percentage of the fees
   * @returns Transaction response for the flaunch creation
   */
  async flaunchWithSplitManager(params: FlaunchWithSplitManagerParams) {
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

    const ethRequired = await this.ethRequiredToFlaunch({
      premineAmount: params.premineAmount ?? 0n,
      initialPriceParams,
      slippagePercent: 5,
    });

    const VALID_SHARE_TOTAL = 100_00000n; // 5 decimals as BigInt
    let creatorShare =
      (BigInt(params.creatorSplitPercent) * VALID_SHARE_TOTAL) / 100n;
    const recipientShares = params.splitReceivers.map((receiver) => {
      return {
        recipient: receiver.address,
        share: (BigInt(receiver.percent) * VALID_SHARE_TOTAL) / 100n,
      };
    });

    const totalRecipientShares = recipientShares.reduce(
      (acc, curr) => acc + curr.share,
      0n
    );

    // if there's a remainder (due to rounding errors), add it to the creator share
    const remainderShares = VALID_SHARE_TOTAL - totalRecipientShares;
    creatorShare += remainderShares;

    const initializeData = encodeAbiParameters(
      [
        {
          type: "tuple",
          name: "params",
          components: [
            { type: "uint256", name: "creatorShare" },
            {
              type: "tuple[]",
              name: "recipientShares",
              components: [
                { type: "address", name: "recipient" },
                { type: "uint256", name: "share" },
              ],
            },
          ],
        },
      ],
      [
        {
          creatorShare,
          recipientShares,
        },
      ]
    );

    return this.contract.write(
      "flaunch",
      {
        _flaunchParams: {
          name: params.name,
          symbol: params.symbol,
          tokenUri: params.tokenUri,
          initialTokenFairLaunch:
            (this.TOTAL_SUPPLY * fairLaunchInBps) / 10_000n,
          fairLaunchDuration: BigInt(params.fairLaunchDuration),
          premineAmount: params.premineAmount ?? 0n,
          creator: params.creator,
          creatorFeeAllocation: creatorFeeAllocationInBps,
          flaunchAt: params.flaunchAt ?? 0n,
          initialPriceParams,
          feeCalculatorParams: "0x",
        },
        _treasuryManagerParams: {
          manager: AddressFeeSplitManagerAddress[this.chainId],
          initializeData,
          depositData: "0x",
        },
        _whitelistParams: {
          merkleRoot: zeroHash,
          merkleIPFSHash: "",
          maxTokens: 0n,
        },
        _airdropParams: {
          airdropIndex: 0n,
          airdropAmount: 0n,
          airdropEndTime: 0n,
          merkleRoot: zeroHash,
          merkleIPFSHash: "",
        },
      },
      {
        value: ethRequired,
      }
    );
  }

  /**
   * Flaunches a new token that splits the creator fees to the creator and a list of recipients, storing the token metadata on IPFS
   * @param params - Parameters for the flaunch with split manager including all IPFS metadata
   * @returns Promise resolving to the transaction response for the flaunch creation
   */
  async flaunchIPFSWithSplitManager(params: FlaunchWithSplitManagerIPFSParams) {
    const tokenUri = await generateTokenUri(params.name, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunchWithSplitManager({
      ...params,
      tokenUri,
    });
  }
}
