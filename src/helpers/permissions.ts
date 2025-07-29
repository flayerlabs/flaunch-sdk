import { Address, zeroAddress } from "viem";
import { Permissions } from "../types";
import {
  ClosedPermissionsAddress,
  WhitelistedPermissionsAddress,
} from "../addresses";

/**
 * Maps a Permissions enum value to its corresponding contract address
 * @param permissions - The permissions enum value
 * @param chainId - The chain ID to get the address for
 * @returns The corresponding permissions contract address
 */
export function getPermissionsAddress(
  permissions: Permissions,
  chainId: number
): Address {
  switch (permissions) {
    case Permissions.CLOSED:
      return ClosedPermissionsAddress[chainId];
    case Permissions.WHITELISTED:
      return WhitelistedPermissionsAddress[chainId];
    case Permissions.OPEN:
    default:
      return zeroAddress;
  }
}
