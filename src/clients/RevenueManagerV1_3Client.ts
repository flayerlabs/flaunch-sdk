import {
  type ReadContract,
  type Address,
  type Drift,
  type HexString,
  type ReadWriteContract,
  type ReadWriteAdapter,
  createDrift,
} from "@delvtech/drift";
import { encodeAbiParameters, zeroAddress } from "viem";
import { RevenueManagerV1_3Abi } from "../abi/RevenueManagerV1_3";
import type { FlaunchToken } from "./TreasuryManagerClient";
import type { AssetBalance } from "./TreasuryManagerV1_3Client";

export type RevenueManagerV1_3ABI = typeof RevenueManagerV1_3Abi;

/** ABI shape of `ITreasuryManager.FlaunchToken[]`, as `claim(address[],bytes)` decodes its data */
const flaunchTokenArrayAbi = [
  {
    type: "tuple[]",
    components: [
      { type: "address", name: "flaunch" },
      { type: "uint256", name: "tokenId" },
    ],
  },
] as const;

/**
 * Encodes flaunch tokens as the `_data` argument of `claim(address[] assets, bytes data)`
 * @param flaunchTokens - The flaunch tokens to claim against
 * @returns The ABI-encoded `FlaunchToken[]`
 */
export function encodeRevenueManagerClaimData(
  flaunchTokens: FlaunchToken[]
): HexString {
  return encodeAbiParameters(flaunchTokenArrayAbi, [flaunchTokens]);
}

/**
 * Client for a v1.3.1 multi-asset RevenueManager instance in read-only mode.
 *
 * Unlike the previous generation, balances and claims are kept per payout asset:
 * `zeroAddress` is native ETH, otherwise the coin's paired token (or a wrapper's underlying).
 * The legacy `balances(address)` / `claim()` pair means the ETH bucket.
 */
export class ReadRevenueManagerV1_3 {
  public readonly contract: ReadContract<RevenueManagerV1_3ABI>;

  /**
   * Creates a new ReadRevenueManagerV1_3 instance
   * @param address - The address of the v1.3.1 RevenueManager instance
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: RevenueManagerV1_3Abi,
      address,
    });
  }

  /**
   * Gets the claimable balance of one payout asset for a recipient
   * @param recipient - The address of the recipient to check
   * @param asset - The payout asset (`zeroAddress` for native ETH)
   * @returns Promise<bigint> - The claimable balance in the asset's raw units
   */
  balances(recipient: Address, asset: Address) {
    return this.contract.read("balances", {
      _recipient: recipient,
      _asset: asset,
    });
  }

  /**
   * Gets the claimable native ETH balance for a recipient (the `address(0)` bucket)
   * @param recipient - The address of the recipient to check
   * @returns Promise<bigint> - The claimable ETH balance in wei
   */
  balancesETH(recipient: Address) {
    return this.balances(recipient, zeroAddress);
  }

  /**
   * Gets the claimable balances across payout assets. Zero balances are kept so callers can
   * decide what to claim.
   * @param recipient - The address of the recipient to check
   * @param assets - The payout assets to read. Defaults to every asset the manager has paid out in
   * @returns Promise<AssetBalance[]> - One entry per asset, in the order given
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

  /**
   * Gets every payout asset the manager has ever been credited in. `zeroAddress` (native ETH)
   * is always present; other entries come from the paired tokens of deposited pools.
   * @returns Promise<readonly Address[]> - The payout assets
   */
  payoutAssets() {
    return this.contract.read("payoutAssets");
  }

  /**
   * Gets the protocol recipient address
   * @returns Promise<Address> - The protocol recipient address
   */
  protocolRecipient() {
    return this.contract.read("protocolRecipient");
  }

  /**
   * Gets the protocol fee in basis points (2 dp of a percent; 2000 = 20%)
   * @returns Promise<bigint> - The protocol fee
   */
  protocolFee() {
    return this.contract.read("protocolFee");
  }

  /**
   * Gets the permissions contract address
   * @returns Promise<Address> - The address of the permissions contract
   */
  permissions() {
    return this.contract.read("permissions");
  }

  /**
   * Gets the manager owner address
   * @returns Promise<Address> - The address of the manager owner
   */
  managerOwner() {
    return this.contract.read("managerOwner");
  }

  /**
   * Gets the flaunch tokens a creator holds in this manager
   * @param creator - The address of the creator to query tokens for
   * @returns Promise<readonly FlaunchToken[]> - The creator's tokens
   */
  tokens(creator: Address) {
    return this.contract.read("tokens", { _creator: creator });
  }

  /**
   * Gets the total number of tokens managed by the revenue manager
   * @returns Promise<bigint> - The total count of tokens
   */
  async tokensCount() {
    const nextInternalId = await this.contract.read("nextInternalId");
    return nextInternalId - 1n;
  }

  /**
   * Gets the total a creator has claimed in one payout asset
   * @param creator - The creator
   * @param asset - The payout asset
   * @returns Promise<bigint> - The total claimed in the asset's raw units
   */
  creatorTotalClaimed(creator: Address, asset: Address) {
    return this.contract.read("creatorTotalClaimed", {
      _creator: creator,
      _asset: asset,
    });
  }

  /**
   * Gets the total the protocol recipient has claimed in one payout asset
   * @param asset - The payout asset
   * @returns Promise<bigint> - The total claimed in the asset's raw units
   */
  protocolTotalClaimed(asset: Address) {
    return this.contract.read("protocolTotalClaimed", { _asset: asset });
  }

  /**
   * Gets a creator settlement that was deferred because the asset refused the transfer
   * (a transfer-restricted stock on `rescue`), claimable via `withdrawUnsettledCreatorFees`
   * @param creator - The creator
   * @param asset - The payout asset
   * @returns Promise<bigint> - The deferred amount in the asset's raw units
   */
  unsettledCreatorFees(creator: Address, asset: Address) {
    return this.contract.read("unsettledCreatorFees", {
      _creator: creator,
      _asset: asset,
    });
  }
}

/**
 * Extended client for a v1.3.1 multi-asset RevenueManager with write capabilities
 */
export class ReadWriteRevenueManagerV1_3 extends ReadRevenueManagerV1_3 {
  declare contract: ReadWriteContract<RevenueManagerV1_3ABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Claims the caller's balance in every payout asset — the protocol recipient's share, or a
   * creator's share across all their tokens. Same entrypoint for both roles.
   * @returns Promise<Hex> - The transaction hash
   */
  claim() {
    return this.contract.write("claim", {});
  }

  /**
   * Claims a creator's share for specific flaunch tokens, in every payout asset. The contract
   * returns `(assets, amounts)`.
   * @param flaunchTokens - The flaunch tokens to claim against
   * @returns Promise<Hex> - The transaction hash
   */
  claimForTokens(flaunchTokens: FlaunchToken[]) {
    return this.contract.write("claim", {
      _flaunchToken: flaunchTokens,
    });
  }

  /**
   * Claims a subset of payout assets, so a recipient blocked on one asset (a transfer-restricted
   * stock) can still collect the others. Behaves as `claim()` restricted to `assets` when no
   * tokens are given, otherwise as `claimForTokens(flaunchTokens)` restricted to `assets`. Every
   * asset must be in `payoutAssets()`, otherwise the call reverts with `UnsupportedAsset`.
   * @param assets - The payout assets to settle (`zeroAddress` for native ETH)
   * @param flaunchTokens - Optionally, the flaunch tokens to claim against
   * @returns Promise<Hex> - The transaction hash
   */
  claimAssets(assets: Address[], flaunchTokens?: FlaunchToken[]) {
    return this.contract.write("claim", {
      _assets: assets,
      _data: flaunchTokens?.length
        ? encodeRevenueManagerClaimData(flaunchTokens)
        : "0x",
    });
  }

  /**
   * Withdraws a creator settlement that was deferred because the asset refused the transfer
   * @param asset - The payout asset
   * @returns Promise<Hex> - The transaction hash
   */
  withdrawUnsettledCreatorFees(asset: Address) {
    return this.contract.write("withdrawUnsettledCreatorFees", {
      _asset: asset,
    });
  }

  /**
   * Pushes an ERC20 amount into the manager to be distributed as revenue (the protocol fee
   * share becomes claimable, as it does for ETH sent to the manager). The asset must already be
   * a payout asset and the manager needs an allowance for the amount.
   * @param asset - The payout asset to deposit
   * @param amount - The amount to pull from the caller, in the asset's raw units
   * @returns Promise<Hex> - The transaction hash
   */
  depositRevenue(asset: Address, amount: bigint) {
    return this.contract.write("depositRevenue", {
      _asset: asset,
      _amount: amount,
    });
  }

  /**
   * Sets the protocol recipient. Only the current protocol recipient may call this.
   * @param protocolRecipient - The new protocol recipient
   * @returns Promise<Hex> - The transaction hash
   */
  setProtocolRecipient(protocolRecipient: Address) {
    return this.contract.write("setProtocolRecipient", {
      _protocolRecipient: protocolRecipient,
    });
  }

  /**
   * Sets the permissions contract address
   * @param permissions - The address of the new permissions contract
   * @returns Promise<Hex> - The transaction hash
   */
  setPermissions(permissions: Address) {
    return this.contract.write("setPermissions", {
      _permissions: permissions,
    });
  }

  /**
   * Transfers the manager ownership to a new address
   * @param newManagerOwner - The address of the new manager owner
   * @returns Promise<Hex> - The transaction hash
   */
  transferManagerOwnership(newManagerOwner: Address) {
    return this.contract.write("transferManagerOwnership", {
      _newManagerOwner: newManagerOwner,
    });
  }
}
