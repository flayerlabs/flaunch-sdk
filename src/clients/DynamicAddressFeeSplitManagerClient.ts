import {
  type Address,
  type Drift,
  type HexString,
  type ReadContract,
  type ReadWriteAdapter,
  type ReadWriteContract,
  createDrift,
} from "@delvtech/drift";
import { DynamicAddressFeeSplitManagerAbi } from "../abi/DynamicAddressFeeSplitManager";
import type { FlaunchToken } from "./TreasuryManagerClient";

export type DynamicAddressFeeSplitManagerABI =
  typeof DynamicAddressFeeSplitManagerAbi;

export type RecipientShare = {
  recipient: Address;
  share: bigint;
};

export type DynamicRecipientInfo = {
  share: bigint;
  debtPerShare: bigint;
  snapshotBalance: bigint;
  claimed: bigint;
};

export class ReadDynamicAddressFeeSplitManager {
  public readonly contract: ReadContract<DynamicAddressFeeSplitManagerABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: DynamicAddressFeeSplitManagerAbi,
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

  accumulatorPerShare() {
    return this.contract.read("accumulatorPerShare");
  }

  lastProcessedManagerFees() {
    return this.contract.read("lastProcessedManagerFees");
  }

  recipientCount() {
    return this.contract.read("recipientCount");
  }

  recipientAt(index: bigint) {
    return this.contract.read("recipientAt", {
      _index: index,
    });
  }

  recipients(recipient: Address) {
    return this.contract.read("recipients", {
      _recipient: recipient,
    }) as Promise<DynamicRecipientInfo>;
  }

  balances(recipient: Address) {
    return this.contract.read("balances", {
      _recipient: recipient,
    });
  }

  recipientShare(recipient: Address, data: HexString = "0x") {
    return this.contract.read("recipientShare", {
      _recipient: recipient,
      1: data,
    });
  }

  pendingCreatorFees(recipient: Address) {
    return this.contract.read("pendingCreatorFees", {
      _recipient: recipient,
    });
  }

  pendingOwnerFees() {
    return this.contract.read("pendingOwnerFees");
  }

  claimableOwnerFees() {
    return this.contract.read("claimableOwnerFees");
  }

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
        data: await this.recipients(recipient),
      }))
    );

    return recipientData
      .filter(({ data }) => data.share > 0n)
      .map(({ recipient }) => recipient);
  }
}

export class ReadWriteDynamicAddressFeeSplitManager extends ReadDynamicAddressFeeSplitManager {
  declare contract: ReadWriteContract<DynamicAddressFeeSplitManagerABI>;

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

  claim() {
    return this.contract.write("claim", {});
  }

  claimForData(data: HexString) {
    return this.contract.write("claim", {
      _data: data,
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
}
