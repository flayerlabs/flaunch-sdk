import {
  createDrift as createDriftOriginal,
  Drift,
  ReadWriteAdapter,
} from "@delvtech/drift";
import { viemAdapter } from "@delvtech/drift-viem";
import type { PublicClient, WalletClient } from "viem";

export type CreateDriftParams = {
  publicClient: PublicClient;
  walletClient?: WalletClient;
};

/**
 * Creates a read-only Drift instance with only public client
 * @param params - Parameters with only publicClient
 * @returns Drift instance for read-only operations
 * @throws Error if publicClient.chain is not configured
 */
export function createDrift(
  params: Omit<CreateDriftParams, "walletClient">
): Drift;
/**
 * Creates a read-write Drift instance with both public and wallet clients
 * @param params - Parameters with both publicClient and walletClient
 * @returns Drift instance for read and write operations
 * @throws Error if publicClient.chain is not configured
 */
export function createDrift(
  params: Required<CreateDriftParams>
): Drift<ReadWriteAdapter>;

/**
 * Creates a Drift instance with the provided clients
 * @param params - Parameters for creating the Drift instance
 * @returns Drift instance configured with the appropriate clients
 * @throws Error if publicClient.chain is not configured
 */
export function createDrift(
  params: CreateDriftParams
): Drift | Drift<ReadWriteAdapter> {
  const { publicClient, walletClient } = params;

  if (!publicClient.chain) {
    throw new Error("publicClient must be configured with a chain");
  }

  return walletClient
    ? createDriftOriginal({
        adapter: viemAdapter({ publicClient, walletClient }),
      })
    : createDriftOriginal({
        adapter: viemAdapter({ publicClient }),
      });
}
