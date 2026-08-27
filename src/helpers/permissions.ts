import { Address, zeroAddress } from "viem";
import { Permissions } from "../types";
import {
  ClosedPermissionsAddress,
  WhitelistedPermissionsAddress,
  WhitelistedPermissionsV1_3Address,
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

/**
 * Maps a Permissions enum value to the contract address to set on a v1.3.1 multi-asset
 * manager. WhitelistedPermissions validates a group against the factory it was deployed
 * with, so managers from the v1.3.1 factory must use the v1.3.1 instance; ClosedPermissions
 * is factory-agnostic and shared with the previous generation.
 * @param permissions - The permissions enum value
 * @param chainId - The chain ID to get the address for
 * @returns The corresponding permissions contract address
 */
export function getPermissionsAddressV1_3(
  permissions: Permissions,
  chainId: number
): Address {
  switch (permissions) {
    case Permissions.CLOSED:
      return ClosedPermissionsAddress[chainId];
    case Permissions.WHITELISTED:
      return WhitelistedPermissionsV1_3Address[chainId];
    case Permissions.OPEN:
    default:
      return zeroAddress;
  }
}
