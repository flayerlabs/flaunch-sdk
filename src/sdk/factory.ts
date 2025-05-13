import { createDrift } from "@delvtech/drift";
import { viemAdapter } from "@delvtech/drift-viem";
import type { PublicClient, WalletClient } from "viem";
import { ReadFlaunchSDK, ReadWriteFlaunchSDK } from "./FlaunchSDK";

export type CreateFlaunchParams = {
  publicClient: PublicClient;
  walletClient?: WalletClient;
};

/**
 * Creates a read-only Flaunch SDK instance with only public client
 * @param params - Parameters with only publicClient
 * @returns ReadFlaunchSDK for read-only operations
 * @throws Error if publicClient.chain is not configured
 */
export function createFlaunch(
  params: Omit<CreateFlaunchParams, "walletClient">
): ReadFlaunchSDK;
/**
 * Creates a read-write Flaunch SDK instance with both public and wallet clients
 * @param params - Parameters with both publicClient and walletClient
 * @returns ReadWriteFlaunchSDK for read and write operations
 * @throws Error if publicClient.chain is not configured
 */
export function createFlaunch(
  params: Required<CreateFlaunchParams>
): ReadWriteFlaunchSDK;

/**
 * Creates a Flaunch SDK instance with the provided clients
 * @param params - Parameters for creating the SDK
 * @returns ReadFlaunchSDK if only publicClient is provided, ReadWriteFlaunchSDK if walletClient is also provided
 * @throws Error if publicClient.chain is not configured
 */
export function createFlaunch(params: CreateFlaunchParams) {
  const { publicClient, walletClient } = params;

  if (!publicClient.chain) {
    throw new Error("publicClient must be configured with a chain");
  }

  const chainId = publicClient.chain.id;

  // Return appropriate SDK type based on whether walletClient is provided
  return walletClient
    ? new ReadWriteFlaunchSDK(
        chainId,
        createDrift({
          adapter: viemAdapter({ publicClient, walletClient }),
        })
      )
    : new ReadFlaunchSDK(
        chainId,
        createDrift({
          adapter: viemAdapter({ publicClient }),
        })
      );
}
