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
import { DynamicAddressFeeSplitManagerAddress } from "../addresses";
import { getPermissionsAddress } from "../helpers/permissions";
import { Permissions } from "../types";
import type {
  FlaunchParams,
  FlaunchWithDynamicSplitManagerParams,
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
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  async flaunch(params: FlaunchParams) {
    if (params.treasuryManagerParams) {
      throw new Error("Treasury managers are not supported on this chain");
    }

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

    const flaunchParams = this.prepareFlaunch(params);
    const ethRequired = await this.calculateFee(flaunchParams);

    return this.contract.write(
      "flaunch",
      {
        _flaunchParams: flaunchParams,
        _treasuryManagerParams: {
          manager: DynamicAddressFeeSplitManagerAddress[chainId],
          permissions: getPermissionsAddress(
            params.treasuryManagerParams?.permissions ?? Permissions.OPEN,
            chainId
          ),
          initializeData,
          depositData: "0x",
        },
        _trustedFeeSigner: zeroAddress,
      },
      { value: ethRequired }
    );
  }
}
