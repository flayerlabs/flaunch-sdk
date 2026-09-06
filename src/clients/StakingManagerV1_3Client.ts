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
import { StakingManagerV1_3Abi } from "../abi/StakingManagerV1_3";
import type { FlaunchToken } from "./TreasuryManagerClient";
import type { AssetBalance } from "./TreasuryManagerV1_3Client";

export type StakingManagerV1_3ABI = typeof StakingManagerV1_3Abi;

/** A user's staked position */
export type StakePositionV1_3 = {
  amount: bigint;
  timelockedUntil: bigint;
};

/** A user's reward checkpoint in one payout asset */
export type StakeRewardsV1_3 = {
  rewardsPerTokenSnapshotX128: bigint;
  /** Rewards deferred because the asset refused the transfer on `unstake`; paid on the next claim */
  owed: bigint;
};

/**
 * Client for a v1.3.1 multi-asset StakingManager (Groups) instance in read-only mode.
 *
 * Staking positions are in the staking token; rewards accrue per payout asset:
 * `zeroAddress` is native ETH, otherwise a deposited coin's paired token.
 */
export class ReadStakingManagerV1_3 {
  public readonly contract: ReadContract<StakingManagerV1_3ABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: StakingManagerV1_3Abi,
      address,
    });
  }

  permissions() {
    return this.contract.read("permissions");
  }

  managerOwner() {
    return this.contract.read("managerOwner");
  }

  stakingToken() {
    return this.contract.read("stakingToken");
  }

  minEscrowDuration() {
    return this.contract.read("minEscrowDuration");
  }

  minStakeDuration() {
    return this.contract.read("minStakeDuration");
  }

  creatorShare() {
    return this.contract.read("creatorShare");
  }

  ownerShare() {
    return this.contract.read("ownerShare");
  }

  /** Total staking tokens deposited across all stakers */
  totalDeposited() {
    return this.contract.read("totalDeposited");
  }

  /**
   * Gets every payout asset the manager has ever been credited in (`zeroAddress` = native ETH)
   */
  payoutAssets() {
    return this.contract.read("payoutAssets");
  }

  /** Gets a user's staked position */
  async userPositions(user: Address): Promise<StakePositionV1_3> {
    const position = await this.contract.read("userPositions", { user });
    return {
      amount: position.amount,
      timelockedUntil: position.timelockedUntil,
    };
  }

  /** Gets a user's reward checkpoint in one payout asset */
  async userRewards(user: Address, asset: Address): Promise<StakeRewardsV1_3> {
    const rewards = await this.contract.read("userRewards", {
      user,
      _asset: asset,
    });
    return {
      rewardsPerTokenSnapshotX128: rewards.rewardsPerTokenSnapshotX128,
      owed: rewards.owed,
    };
  }

  /**
   * Gets the staking rewards a user could claim right now in one payout asset
   * @param user - The staker
   * @param asset - The payout asset (`zeroAddress` for native ETH)
   */
  pendingStakeRewards(user: Address, asset: Address) {
    return this.contract.read("pendingStakeRewards", {
      _user: user,
      _asset: asset,
    });
  }

  /**
   * Gets the claimable balance of one payout asset for a recipient (staker, creator or owner)
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

  /** Gets the creator fees pending for a recipient in one payout asset */
  pendingCreatorFees(recipient: Address, asset: Address) {
    return this.contract.read("pendingCreatorFees", {
      _recipient: recipient,
      _asset: asset,
    });
  }

  /** Gets the owner fees claimable in one payout asset */
  claimableOwnerFees(asset: Address) {
    return this.contract.read("claimableOwnerFees", { _asset: asset });
  }

  /** Gets the flaunch tokens a creator holds in this manager */
  tokens(creator: Address) {
    return this.contract.read("tokens", { _creator: creator });
  }

  /** Gets when a deposited flaunch token's escrow unlocks */
  tokenTimelock(flaunchToken: FlaunchToken) {
    return this.contract.read("tokenTimelock", {
      _flaunch: flaunchToken.flaunch,
      _tokenId: flaunchToken.tokenId,
    });
  }
}

export class ReadWriteStakingManagerV1_3 extends ReadStakingManagerV1_3 {
  declare contract: ReadWriteContract<StakingManagerV1_3ABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Stakes staking tokens. The manager needs an allowance for the amount; the position is
   * timelocked for `minStakeDuration` from now.
   */
  stake(amount: bigint) {
    return this.contract.write("stake", { _amount: amount });
  }

  /**
   * Unstakes staking tokens once the timelock has passed. Rewards are settled in every payout
   * asset; one the asset refuses to transfer is deferred to `userRewards(user, asset).owed`.
   */
  unstake(amount: bigint) {
    return this.contract.write("unstake", { _amount: amount });
  }

  /** Claims the caller's rewards / share in every payout asset */
  claim() {
    return this.contract.write("claim", {});
  }

  /** Claims a creator's share for specific flaunch tokens, in every payout asset */
  claimForTokens(flaunchTokens: FlaunchToken[]) {
    return this.contract.write("claim", {
      _flaunchTokens: flaunchTokens,
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

  /** Withdraws a creator's flaunch token once its escrow has unlocked */
  escrowWithdraw(flaunchToken: FlaunchToken) {
    return this.contract.write("escrowWithdraw", {
      _flaunchToken: flaunchToken,
    });
  }

  /** Extends a deposited flaunch token's escrow by `extendBy` seconds */
  extendEscrowDuration(flaunchToken: FlaunchToken, extendBy: bigint) {
    return this.contract.write("extendEscrowDuration", {
      _flaunchToken: flaunchToken,
      _extendBy: extendBy,
    });
  }

  /**
   * Pushes an ERC20 amount into the manager to be distributed as rewards. The asset must
   * already be a payout asset and the manager needs an allowance for the amount.
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

  /** Withdraws a creator settlement deferred because the asset refused the transfer */
  withdrawUnsettledCreatorFees(asset: Address) {
    return this.contract.write("withdrawUnsettledCreatorFees", {
      _asset: asset,
    });
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
}
