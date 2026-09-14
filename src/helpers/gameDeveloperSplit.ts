import {
  encodeAbiParameters,
  getAddress,
  isAddressEqual,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { GameDeveloperFeeSplitManagerAddress } from "../addresses";

/** Every active share weight on a GameDeveloperFeeSplitManager sums to this (5 dp: 100_00000 = 100%). */
export const GAME_DEVELOPER_SPLIT_SHARE_TOTAL = 100_00000n;

/** The game developer's protected share weight: 5% of {@link GAME_DEVELOPER_SPLIT_SHARE_TOTAL}. */
export const GAME_DEVELOPER_SHARE = 5_00000n;

export type GameDeveloperSplitReceiver = {
  address: Address;
  /** Share weight in 5 dp (1_00000 = 1%). The receivers plus the developer's 5% must total 100_00000. */
  share: bigint;
};

export type GameDeveloperSplitInitializeParams = {
  /** The game's registered owner: holds the 5% slot and the only exit for the coin's ERC721. */
  gameDeveloper: Address;
  /** Can re-split the other 95% alongside the manager owner. `zeroAddress` disables the role. */
  moderator?: Address;
  /** Everyone except the developer, whose 5% row is added here. */
  splitReceivers: GameDeveloperSplitReceiver[];
};

/**
 * Converts whole-percent rows (as an earnings editor holds them) to 5 dp share weights.
 * The rows are expected to sum to 95, leaving the developer's fixed 5.
 */
export function percentToGameDeveloperShare(percent: number): bigint {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new Error("Game developer split percentages must be whole numbers from 0 to 100");
  }
  return BigInt(percent) * 1_00000n;
}

/**
 * Builds the `initializeData` for a GameDeveloperFeeSplitManager:
 * `abi.encode(DynamicAddressFeeSplitManager.InitializeParams, address gameDeveloper)`, with the
 * developer's 5% row prepended to the recipient list and creator / owner shares at zero (the
 * manager refuses anything else). Throws on a zero, duplicate or zero-share receiver, on a
 * receiver that is the developer, and when the shares do not total exactly 100_00000.
 */
export function encodeGameDeveloperSplitInitializeData(
  params: GameDeveloperSplitInitializeParams
): Hex {
  if (params.gameDeveloper === zeroAddress) {
    throw new Error("Game developer cannot be zero address");
  }
  const gameDeveloper = getAddress(params.gameDeveloper);

  const seen = new Set<string>([gameDeveloper]);
  const recipientShares = [
    { recipient: gameDeveloper, share: GAME_DEVELOPER_SHARE },
    ...params.splitReceivers.map((receiver) => {
      if (receiver.address === zeroAddress) {
        throw new Error("Recipient address cannot be zero address");
      }
      if (receiver.share <= 0n) {
        throw new Error("Recipient share must be greater than zero");
      }
      const recipient = getAddress(receiver.address);
      if (seen.has(recipient)) {
        throw new Error(
          recipient === gameDeveloper
            ? "The game developer already holds the fixed 5% and cannot be added again"
            : "Duplicate recipient found in split receivers"
        );
      }
      seen.add(recipient);
      return { recipient, share: receiver.share };
    }),
  ];

  const total = recipientShares.reduce((sum, r) => sum + r.share, 0n);
  if (total !== GAME_DEVELOPER_SPLIT_SHARE_TOTAL) {
    throw new Error(
      `Game developer split shares must total ${GAME_DEVELOPER_SPLIT_SHARE_TOTAL} including the developer's ${GAME_DEVELOPER_SHARE} (got ${total})`
    );
  }

  return encodeAbiParameters(
    [
      {
        type: "tuple",
        name: "params",
        components: [
          { type: "uint256", name: "creatorShare" },
          { type: "uint256", name: "ownerShare" },
          { type: "address", name: "moderator" },
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
      { type: "address", name: "gameDeveloper" },
    ],
    [
      {
        creatorShare: 0n,
        ownerShare: 0n,
        moderator: params.moderator ?? zeroAddress,
        recipientShares,
      },
      gameDeveloper,
    ]
  );
}

/**
 * Whether `implementation` (as `TreasuryManagerFactory.managerImplementation(manager)` reports
 * it) is the chain's GameDeveloperFeeSplitManager. False on chains where it is not deployed.
 */
export function isGameDeveloperFeeSplitManagerImplementation(
  chainId: number,
  implementation: Address | undefined | null
): boolean {
  const expected = GameDeveloperFeeSplitManagerAddress[chainId];
  if (!expected || !implementation || implementation === zeroAddress) return false;
  return isAddressEqual(implementation, expected);
}
