import {
  type ReadContract,
  type Address,
  type Drift,
  type HexString,
  type ReadWriteContract,
  type ReadWriteAdapter,
  createDrift,
} from "@delvtech/drift";
import { zeroAddress } from "viem";
import { TreasuryManagerV1_3Abi } from "../abi/TreasuryManagerV1_3";
import type { FlaunchToken } from "./TreasuryManagerClient";

export type TreasuryManagerV1_3ABI = typeof TreasuryManagerV1_3Abi;

/** A claimable balance on a v1.3.1 multi-asset manager, in the payout asset's own raw units. */
export interface AssetBalance {
  /** The payout asset — `zeroAddress` for native ETH */
  asset: Address;
  amount: bigint;
}

/**
 * Generic client for any v1.3.1 multi-asset treasury manager in read-only mode (the
 * `ITreasuryManager` + `IMultiAssetTreasuryManager` surface every manager of that generation
 * shares). Use the manager-specific clients for RevenueManager / split / staking extras.
 *
 * Balances are kept per payout asset: `zeroAddress` is native ETH (flETH and native pools),
 * a wrapper's underlying (USDC for flUSDC) or the paired token itself (a B20 stock). The
 * legacy single-value `balances(address)` / `claim()` pair means the ETH bucket.
 */
export class ReadTreasuryManagerV1_3 {
  public readonly contract: ReadContract<TreasuryManagerV1_3ABI>;

  /**
   * Creates a new ReadTreasuryManagerV1_3 instance
   * @param address - The address of a v1.3.1 treasury manager instance
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: TreasuryManagerV1_3Abi,
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
  async balancesForAssets(
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
   * Gets the escrow-token keys the manager sweeps from the multi-token FeeEscrow
   * @returns Promise<readonly Address[]> - The escrow tokens
   */
  escrowTokens() {
    return this.contract.read("escrowTokens");
  }

  /**
   * Gets the payout asset an escrow token unwraps to (ETH for flETH, USDC for flUSDC, …)
   * @param token - The escrow token
   * @returns Promise<Address> - The payout asset
   */
  payoutAsset(token: Address) {
    return this.contract.read("payoutAsset", { _token: token });
  }

  /**
   * Gets the escrow token a deposited pool's fees sit under
   * @param poolId - The pool to check
   * @returns Promise<Address> - The escrow token
   */
  poolEscrowToken(poolId: HexString) {
    return this.contract.read("poolEscrowToken", { _poolId: poolId });
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
   * Gets the TreasuryManagerFactory this manager was deployed from
   * @returns Promise<Address> - The factory address
   */
  treasuryManagerFactory() {
    return this.contract.read("treasuryManagerFactory");
  }
}

/**
 * Extended generic client for a v1.3.1 multi-asset treasury manager with write capabilities
 */
export class ReadWriteTreasuryManagerV1_3 extends ReadTreasuryManagerV1_3 {
  declare contract: ReadWriteContract<TreasuryManagerV1_3ABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Claims the caller's balance in every payout asset (the legacy `claim()` entrypoint)
   * @returns Promise<Hex> - The transaction hash
   */
  claim() {
    return this.contract.write("claim", {});
  }

  /**
   * Claims the caller's balance in a subset of payout assets, so a recipient blocked on one
   * asset (a transfer-restricted stock) can still collect the others. Every asset must be one
   * the manager has paid out in (`payoutAssets()`), otherwise the call reverts with
   * `UnsupportedAsset`. The contract returns `(assets, amounts)`.
   * @param assets - The payout assets to settle (`zeroAddress` for native ETH)
   * @param data - Manager-specific claim data (defaults to empty)
   * @returns Promise<Hex> - The transaction hash
   */
  claimAssets(assets: Address[], data: HexString = "0x") {
    return this.contract.write("claim", {
      _assets: assets,
      _data: data,
    });
  }

  /**
   * Pushes an ERC20 amount into the manager to be distributed as revenue — the token analogue
   * of sending ETH to the manager. The asset must already be a payout asset of the manager, and
   * the manager needs an allowance for the amount. An ERC20 sent straight to a manager is never
   * booked and has no recovery path.
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
   * Deposits a flaunch token to the manager. NFT approval must be given beforehand.
   * @param flaunchToken - The flaunch token to deposit
   * @param creator - The address of the creator
   * @param data - Additional data for the deposit
   * @returns Promise<Hex> - The transaction hash
   */
  deposit(flaunchToken: FlaunchToken, creator: Address, data: HexString) {
    return this.contract.write("deposit", {
      _flaunchToken: flaunchToken,
      _creator: creator,
      _data: data,
    });
  }

  /**
   * Adds a registry-approved escrow token key without a pool, e.g. for balances credited to
   * the manager directly on the multi-token FeeEscrow
   * @param token - The escrow token to register
   * @returns Promise<Hex> - The transaction hash
   */
  registerEscrowToken(token: Address) {
    return this.contract.write("registerEscrowToken", { _token: token });
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
