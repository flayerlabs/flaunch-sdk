import {
  type Address,
  type Drift,
  type ReadContract,
  type ReadWriteAdapter,
  type ReadWriteContract,
  createDrift,
} from "@delvtech/drift";
import { GameDeveloperFeeSplitManagerAbi } from "../abi/GameDeveloperFeeSplitManager";
import {
  ReadDynamicAddressFeeSplitManagerV1_3,
  ReadWriteDynamicAddressFeeSplitManagerV1_3,
} from "./DynamicAddressFeeSplitManagerV1_3Client";
import type { FlaunchToken } from "./TreasuryManagerClient";

export type GameDeveloperFeeSplitManagerABI = typeof GameDeveloperFeeSplitManagerAbi;

/**
 * Read client for a GameDeveloperFeeSplitManager instance: everything a v1.3.1
 * DynamicAddressFeeSplitManager exposes (shares, balances, claims) plus the developer's slot.
 *
 * The developer (`gameDeveloper`) is the authority; `gameDeveloperPayout` is the recipient that
 * currently holds the protected 5% share. They start equal and the developer may split them.
 */
export class ReadGameDeveloperFeeSplitManager extends ReadDynamicAddressFeeSplitManagerV1_3 {
  public readonly gameContract: ReadContract<GameDeveloperFeeSplitManagerABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    super(address, drift);
    this.gameContract = drift.contract({
      abi: GameDeveloperFeeSplitManagerAbi,
      address,
    });
  }

  gameDeveloper() {
    return this.gameContract.read("gameDeveloper");
  }

  gameDeveloperPayout() {
    return this.gameContract.read("gameDeveloperPayout");
  }

  /** The creator the ERC721 was deposited for; the only address `withdrawToCreator` sends it to. */
  originalCreator(flaunchToken: FlaunchToken) {
    return this.gameContract.read("originalCreator", {
      _flaunch: flaunchToken.flaunch,
      _tokenId: flaunchToken.tokenId,
    });
  }

  gameDeveloperShare() {
    return this.gameContract.read("GAME_DEVELOPER_SHARE");
  }

  shareTotal() {
    return this.gameContract.read("SHARE_TOTAL");
  }
}

export class ReadWriteGameDeveloperFeeSplitManager extends ReadWriteDynamicAddressFeeSplitManagerV1_3 {
  declare gameContract: ReadWriteContract<GameDeveloperFeeSplitManagerABI>;

  constructor(address: Address, drift: Drift<ReadWriteAdapter> = createDrift()) {
    super(address, drift);
    this.gameContract = drift.contract({
      abi: GameDeveloperFeeSplitManagerAbi,
      address,
    });
  }

  /** Developer only: move the 5% slot to another wallet (earned fees stay with the old one). */
  setGameDeveloperPayout(newPayout: Address) {
    return this.gameContract.write("setGameDeveloperPayout", {
      _newPayout: newPayout,
    });
  }

  /** Developer only: hand the developer role to another account; the payout slot is untouched. */
  transferGameDeveloper(newGameDeveloper: Address) {
    return this.gameContract.write("transferGameDeveloper", {
      _newGameDeveloper: newGameDeveloper,
    });
  }

  /** Developer only: return the coin's ERC721 to the creator it was deposited for. */
  withdrawToCreator(flaunchToken: FlaunchToken) {
    return this.gameContract.write("withdrawToCreator", {
      _flaunchToken: flaunchToken,
    });
  }
}
