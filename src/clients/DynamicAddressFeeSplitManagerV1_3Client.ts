import {
  type Address,
  type Drift,
  type HexString,
  type ReadContract,
  type ReadWriteAdapter,
  type ReadWriteContract,
  createDrift,
} from "@delvtech/drift";
import { zeroAddress } from "viem";
import { DynamicAddressFeeSplitManagerV1_3Abi } from "../abi/DynamicAddressFeeSplitManagerV1_3";
import type { FlaunchToken } from "./TreasuryManagerClient";
import type { RecipientShare } from "./DynamicAddressFeeSplitManagerClient";
import type { AssetBalance } from "./TreasuryManagerV1_3Client";

export type DynamicAddressFeeSplitManagerV1_3ABI =
  typeof DynamicAddressFeeSplitManagerV1_3Abi;

/** A recipient's split position in one payout asset */
export type DynamicRecipientInfoV1_3 = {
  share: bigint;
  debtPerShare: bigint;
  snapshotBalance: bigint;
  claimed: bigint;
};

/**
 * Client for a v1.3.1 multi-asset DynamicAddressFeeSplitManager instance in read-only mode.
 *
 * Shares are asset-agnostic; fee accounting (accumulators, pending and claimable fees) is kept
 * per payout asset: `zeroAddress` is native ETH, otherwise the coin's paired token.
 */
export class ReadDynamicAddressFeeSplitManagerV1_3 {
  public readonly contract: ReadContract<DynamicAddressFeeSplitManagerV1_3ABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: DynamicAddressFeeSplitManagerV1_3Abi,
      address,
    });
  }

  permissions() {
    return this.contract.read("permissions");
  }

  managerOwner() {
    return this.contract.read("managerOwner");
  }

  moderator() {
    return this.contract.read("moderator");
  }

  creatorShare() {
    return this.contract.read("creatorShare");
  }

  ownerShare() {
    return this.contract.read("ownerShare");
  }

  totalActiveShares() {
    return this.contract.read("totalActiveShares");
  }

  recipientCount() {
    return this.contract.read("recipientCount");
  }

  recipientAt(index: bigint) {
    return this.contract.read("recipientAt", {
      _index: index,
    });
  }

  /**
   * Gets every payout asset the manager has ever been credited in (`zeroAddress` = native ETH)
   */
  payoutAssets() {
    return this.contract.read("payoutAssets");
  }

  /**
   * Gets a recipient's split position in one payout asset. `share` is the same in every asset.
   * @param recipient - The recipient to check
   * @param asset - The payout asset (`zeroAddress` for native ETH)
   */
  async recipientInfo(
    recipient: Address,
    asset: Address
  ): Promise<DynamicRecipientInfoV1_3> {
    const info = await this.contract.read("recipientInfo", {
      _recipient: recipient,
      _asset: asset,
    });
    return {
      share: info.share_,
      debtPerShare: info.debtPerShare_,
      snapshotBalance: info.snapshotBalance_,
      claimed: info.claimed_,
    };
  }

  /**
   * Gets the claimable balance of one payout asset for a recipient
   * @param recipient - The recipient to check
   * @param asset - The payout asset (`zeroAddress` for native ETH)
   */
  balances(recipient: Address, asset: Address) {
    return this.contract.read("balances", {
      _recipient: recipient,
      _asset: asset,
    });
  }

  /** Gets the claimable native ETH balance for a recipient (the `address(0)` bucket) */
  balancesETH(recipient: Address) {
    return this.balances(recipient, zeroAddress);
  }

  /**
   * Gets the claimable balances across payout assets (zero balances kept)
   * @param recipient - The recipient to check
   * @param assets - The payout assets to read. Defaults to every asset the manager has paid out in
   */
  async balancesByAsset(
    recipient: Address,
    assets?: Address[]
  ): Promise<AssetBalance[]> {
    const targets = assets ?? [...(await this.payoutAssets())];
    const amounts = await Promise.all(
      targets.map((asset) => this.balances(recipient, asset))
    );
    return targets.map((asset, index) => ({ asset, amount: amounts[index] }));
  }

  /** Gets the manager-wide fees received in one payout asset */
  managerFees(asset: Address) {
    return this.contract.read("managerFees", { _asset: asset });
  }

  /** Gets the accumulated fees per share in one payout asset */
  accumulatorPerShare(asset: Address) {
    return this.contract.read("accumulatorPerShare", { _asset: asset });
  }

  /** Gets the creator fees pending for a recipient in one payout asset */
  pendingCreatorFees(recipient: Address, asset: Address) {
    return this.contract.read("pendingCreatorFees", {
      _recipient: recipient,
      _asset: asset,
    });
  }

  /** Gets the owner fees pending in one payout asset */
  pendingOwnerFees(asset: Address) {
    return this.contract.read("pendingOwnerFees", { _asset: asset });
  }

  /** Gets the owner fees claimable in one payout asset */
  claimableOwnerFees(asset: Address) {
    return this.contract.read("claimableOwnerFees", { _asset: asset });
  }

  /**
   * Lists the recipients, active ones only unless `includeInactive` is set
   */
  async allRecipients(includeInactive: boolean = false) {
    const count = await this.recipientCount();
    const recipients = await Promise.all(
      Array.from({ length: Number(count) }, (_, i) => this.recipientAt(BigInt(i)))
    );

    if (includeInactive) {
      return recipients;
    }

    const recipientData = await Promise.all(
      recipients.map(async (recipient) => ({
        recipient,
        data: await this.recipientInfo(recipient, zeroAddress),
      }))
    );

    return recipientData
      .filter(({ data }) => data.share > 0n)
      .map(({ recipient }) => recipient);
  }
}

export class ReadWriteDynamicAddressFeeSplitManagerV1_3 extends ReadDynamicAddressFeeSplitManagerV1_3 {
  declare contract: ReadWriteContract<DynamicAddressFeeSplitManagerV1_3ABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  setPermissions(permissions: Address) {
    return this.contract.write("setPermissions", {
      _permissions: permissions,
    });
  }

  transferManagerOwnership(newManagerOwner: Address) {
    return this.contract.write("transferManagerOwnership", {
      _newManagerOwner: newManagerOwner,
    });
  }

  setModerator(moderator: Address) {
    return this.contract.write("setModerator", {
      _moderator: moderator,
    });
  }

  updateRecipients(recipients: RecipientShare[]) {
    return this.contract.write("updateRecipients", {
      _recipients: recipients,
    });
  }

  transferRecipientShare(newRecipient: Address) {
    return this.contract.write("transferRecipientShare", {
      _newRecipient: newRecipient,
    });
  }

  /** Claims the caller's balance in every payout asset */
  claim() {
    return this.contract.write("claim", {});
  }

  /** Claims in every payout asset with manager-specific claim data */
  claimForData(data: HexString) {
    return this.contract.write("claim", {
      _data: data,
    });
  }

  /**
   * Claims a subset of payout assets, so a recipient blocked on one asset can still collect the
   * others. Every asset must be in `payoutAssets()`.
   * @param assets - The payout assets to settle (`zeroAddress` for native ETH)
   * @param data - Manager-specific claim data (defaults to empty)
   */
  claimAssets(assets: Address[], data: HexString = "0x") {
    return this.contract.write("claim", {
      _assets: assets,
      _data: data,
    });
  }

  /**
   * Pushes an ERC20 amount into the manager to be split as revenue. The asset must already be
   * a payout asset and the manager needs an allowance for the amount.
   */
  depositRevenue(asset: Address, amount: bigint) {
    return this.contract.write("depositRevenue", {
      _asset: asset,
      _amount: amount,
    });
  }

  deposit(flaunchToken: FlaunchToken, creator: Address, data: HexString) {
    return this.contract.write("deposit", {
      _flaunchToken: flaunchToken,
      _creator: creator,
      _data: data,
    });
  }

  setCreator(flaunchToken: FlaunchToken, creator: Address) {
    return this.contract.write("setCreator", {
      _flaunchToken: flaunchToken,
      _creator: creator,
    });
  }

  rescue(flaunchToken: FlaunchToken, recipient: Address) {
    return this.contract.write("rescue", {
      _flaunchToken: flaunchToken,
      _recipient: recipient,
    });
  }

  /** Withdraws a creator settlement deferred because the asset refused the transfer */
  withdrawUnsettledCreatorFees(asset: Address) {
    return this.contract.write("withdrawUnsettledCreatorFees", {
      _asset: asset,
    });
  }
}
