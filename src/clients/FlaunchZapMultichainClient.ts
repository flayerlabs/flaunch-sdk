import { encodeStaticSplit } from "../helpers/staticSplit";
import {
  type Address,
  type Drift,
  type HexString,
  type ReadContract,
  type ReadWriteAdapter,
  type ReadWriteContract,
  createDrift,
} from "@delvtech/drift";
import {
  encodeAbiParameters,
  getAddress,
  parseUnits,
  zeroAddress,
} from "viem";
import { FlaunchZapAbi } from "../abi/FlaunchZap";
import {
  AddressFeeSplitManagerAddress,
  AddressFeeSplitManagerV1_3Address,
  DefaultPairedTokenAddress,
  DynamicAddressFeeSplitManagerAddress,
  DynamicAddressFeeSplitManagerV1_3Address,
  FlaunchZapV1_3Address,
} from "../addresses";
import { generateTokenUri } from "../helpers/ipfs";
import { getPermissionsAddress, getPermissionsAddressV1_3 } from "../helpers/permissions";
import { ReadWriteFlaunchZapV1_3 } from "./FlaunchZapV1_3Client";
import { Permissions } from "../types";
import type {
  FlaunchIPFSParams,
  FlaunchParams,
  FlaunchWithDynamicSplitManagerIPFSParams,
  FlaunchWithDynamicSplitManagerParams,
  FlaunchWithRevenueManagerIPFSParams,
  FlaunchWithRevenueManagerParams,
  FlaunchWithSplitManagerIPFSParams,
  FlaunchWithSplitManagerParams,
} from "./FlaunchZapClient";

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
    private readonly drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Creates a new Flaunch, optionally depositing it into a treasury manager.
   *
   * FlaunchZap exposes two `flaunch` overloads. Without a manager the
   * two-argument form is used; with one, the three-argument form that takes
   * `_treasuryManagerParams`. Picking the wrong overload would still produce a
   * valid transaction that silently drops the manager, so the manager presence
   * is what selects it.
   */
  async flaunch(chainId: number, params: FlaunchParams) {
    const flaunchParams = this.prepareFlaunch(params);
    const manager = params.treasuryManagerParams?.manager;

    // Ethereum's current generation defaults to native ETH. Keep the legacy client and
    // address maps intact for existing pools while new launches use the paired-token ABI.
    if (DefaultPairedTokenAddress[chainId] === zeroAddress) {
      const zap = new ReadWriteFlaunchZapV1_3(FlaunchZapV1_3Address[chainId], this.drift);
      const pairedParams = { ...flaunchParams, pairedToken: zeroAddress };
      const fee = await zap.calculateFee({ flaunchParams: pairedParams, slippageBps: 500n });
      return zap.flaunch({
        flaunchParams: pairedParams,
        trustedFeeSigner: zeroAddress,
        maxPremineCost: fee.pairedPremineCost,
        value: fee.ethRequired,
        treasuryManagerParams: manager ? {
          manager,
          permissions: getPermissionsAddressV1_3(
            params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
            chainId
          ),
          initializeData: params.treasuryManagerParams?.initializeData ?? "0x",
          depositData: params.treasuryManagerParams?.depositData ?? "0x",
        } : undefined,
      });
    }

    const ethRequired = await this.calculateFee(flaunchParams);

    if (!manager) {
      return this.contract.write(
        "flaunch",
        {
          _flaunchParams: flaunchParams,
          _trustedFeeSigner: zeroAddress,
        },
        { value: ethRequired }
      );
    }

    return this.contract.write(
      "flaunch",
      {
        _flaunchParams: flaunchParams,
        _treasuryManagerParams: {
          manager,
          permissions: getPermissionsAddress(
            params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
            chainId
          ),
          initializeData: params.treasuryManagerParams?.initializeData ?? "0x",
          depositData: params.treasuryManagerParams?.depositData ?? "0x",
        },
        _trustedFeeSigner: zeroAddress,
      },
      { value: ethRequired }
    );
  }

  /**
   * Creates a new Flaunch, storing the token metadata on IPFS
   */
  async flaunchIPFS(chainId: number, params: FlaunchIPFSParams) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunch(chainId, {
      ...params,
      tokenUri,
    });
  }

  /**
   * Creates a new Flaunch that deposits into an existing RevenueManager
   * instance. Mirrors the base deployment: the instance address is passed
   * through as the manager with no initialization data, and the zap deposits
   * into it rather than deploying a new manager.
   */
  async flaunchWithRevenueManager(
    chainId: number,
    params: FlaunchWithRevenueManagerParams
  ) {
    return this.flaunch(chainId, {
      ...params,
      treasuryManagerParams: {
        manager: params.revenueManagerInstanceAddress,
        permissions:
          params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
        initializeData: "0x",
        depositData: "0x",
      },
    });
  }

  /**
   * Creates a new Flaunch for a revenue manager, storing metadata on IPFS
   */
  async flaunchIPFSWithRevenueManager(
    chainId: number,
    params: FlaunchWithRevenueManagerIPFSParams
  ) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunchWithRevenueManager(chainId, {
      ...params,
      tokenUri,
    });
  }

  /**
   * Creates a new Flaunch that splits creator fees across a fixed list of
   * recipients, deploying an AddressFeeSplitManager at launch.
   */
  async flaunchWithSplitManager(
    chainId: number,
    params: FlaunchWithSplitManagerParams
  ) {
    const initializeData = encodeStaticSplit(params);

    return this.flaunch(chainId, {
      ...params,
      treasuryManagerParams: {
        manager: DefaultPairedTokenAddress[chainId] === zeroAddress
          ? AddressFeeSplitManagerV1_3Address[chainId]
          : AddressFeeSplitManagerAddress[chainId],
        permissions:
          params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
        initializeData,
        depositData: "0x",
      },
    });
  }

  /**
   * Creates a new Flaunch with a split manager, storing metadata on IPFS
   */
  async flaunchIPFSWithSplitManager(
    chainId: number,
    params: FlaunchWithSplitManagerIPFSParams
  ) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunchWithSplitManager(chainId, {
      ...params,
      tokenUri,
    });
  }

  /**
   * Creates a new Flaunch with a dynamic split manager, storing metadata on IPFS
   */
  async flaunchIPFSWithDynamicSplitManager(
    chainId: number,
    params: FlaunchWithDynamicSplitManagerIPFSParams
  ) {
    const tokenUri = await generateTokenUri(params.name, params.symbol, {
      metadata: params.metadata,
      pinataConfig: params.pinataConfig,
    });

    return this.flaunchWithDynamicSplitManager(chainId, {
      ...params,
      tokenUri,
    });
  }

  async flaunchWithDynamicSplitManager(
    chainId: number,
    params: FlaunchWithDynamicSplitManagerParams
  ) {
    const validShareTotal = 100_00000n;

    if (params.moderator === zeroAddress) {
      throw new Error("Dynamic split moderator cannot be zero address");
    }

    if (params.creatorShare < 0n || params.managerOwnerShare < 0n) {
      throw new Error("Creator and manager owner shares cannot be negative");
    }

    if (params.creatorShare + params.managerOwnerShare > validShareTotal) {
      throw new Error(
        "Creator and manager owner shares must be less than or equal to 100_00000"
      );
    }

    const duplicateRecipients = new Set<string>();
    const recipientShares = params.splitReceivers.map((receiver) => {
      if (receiver.address === zeroAddress) {
        throw new Error("Recipient address cannot be zero address");
      }

      if (receiver.share <= 0n) {
        throw new Error("Recipient share must be greater than zero");
      }

      const recipient = getAddress(receiver.address);
      if (duplicateRecipients.has(recipient)) {
        throw new Error("Duplicate recipient found in split receivers");
      }

      duplicateRecipients.add(recipient);
      return { recipient, share: receiver.share };
    });

    const initializeData = encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "creatorShare", type: "uint256" },
            { name: "ownerShare", type: "uint256" },
            { name: "moderator", type: "address" },
            {
              name: "recipientShares",
              type: "tuple[]",
              components: [
                { name: "recipient", type: "address" },
                { name: "share", type: "uint256" },
              ],
            },
          ],
        },
      ],
      [
        {
          creatorShare: params.creatorShare,
          ownerShare: params.managerOwnerShare,
          moderator: params.moderator,
          recipientShares,
        },
      ]
    );

    return this.flaunch(chainId, {
      ...params,
      treasuryManagerParams: {
        manager: DefaultPairedTokenAddress[chainId] === zeroAddress
          ? DynamicAddressFeeSplitManagerV1_3Address[chainId]
          : DynamicAddressFeeSplitManagerAddress[chainId],
        permissions: params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
        initializeData,
        depositData: "0x",
      },
    });
  }
}
