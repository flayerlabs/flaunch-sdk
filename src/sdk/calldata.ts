import {
  createWalletClient,
  http,
  encodeFunctionData,
  decodeFunctionData,
  parseAbi,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
} from "viem";
import { createDrift } from "./drift";
import { ReadFlaunchSDK, ReadWriteFlaunchSDK } from "./FlaunchSDK";

// ABI for encoding the call data
export const encodedCallAbi = parseAbi([
  "function call(address to, uint256 value, bytes data)",
]);

export interface CallData {
  to: Address;
  value: bigint;
  data: Hex;
}

export type CreateFlaunchCalldataParams = {
  publicClient: PublicClient;
  walletAddress?: Address;
};

/**
 * Creates a custom wallet client that returns encoded calldata instead of broadcasting transactions
 */
export function createCallDataWalletClient(
  publicClient: PublicClient,
  walletAddress: Address
): WalletClient {
  if (!publicClient.chain) {
    throw new Error("publicClient must be configured with a chain");
  }

  // Create a base wallet client with the chain configuration
  const baseWalletClient = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
  });

  // Override the wallet client methods to return encoded calldata
  const callDataWalletClient = baseWalletClient.extend((client) => ({
    // Override the account-related methods to return the provided walletAddress
    get account() {
      return {
        address: walletAddress,
        type: "json-rpc" as const,
      } as any;
    },

    async getAddresses() {
      return [walletAddress];
    },

    async requestAddresses() {
      return [walletAddress];
    },

    // Override writeContract to return encoded calldata instead of broadcasting
    async writeContract(args: any) {
      const to = args.address as Address;
      const value = (args.value ?? 0n) as bigint;

      // Encode the function call data
      const calldata = encodeFunctionData({
        abi: args.abi,
        functionName: args.functionName,
        args: args.args,
      }) as Hex;

      // Encode the call using the standard call format
      const encodedCall = encodeFunctionData({
        abi: encodedCallAbi,
        functionName: "call",
        args: [to, value, calldata],
      }) as Hex;

      return encodedCall;
    },

    // Override sendTransaction to return encoded calldata instead of broadcasting
    async sendTransaction(args: any) {
      const to = args.to as Address;
      const value = (args.value ?? 0n) as bigint;
      const data = (args.data ?? "0x") as Hex;

      // Encode the call using the standard call format
      const encodedCall = encodeFunctionData({
        abi: encodedCallAbi,
        functionName: "call",
        args: [to, value, data],
      }) as Hex;

      return encodedCall;
    },

    // Override signTransaction to return encoded calldata (for consistency)
    async signTransaction(args: any) {
      const to = args.to as Address;
      const value = (args.value ?? 0n) as bigint;
      const data = (args.data ?? "0x") as Hex;

      const encodedCall = encodeFunctionData({
        abi: encodedCallAbi,
        functionName: "call",
        args: [to, value, data],
      }) as Hex;

      return encodedCall;
    },
  }));

  return callDataWalletClient;
}

/**
 * Creates a read-only Flaunch SDK instance with only public client
 * @param params - Parameters with only publicClient
 * @returns ReadFlaunchSDK for read-only operations
 * @throws Error if publicClient.chain is not configured
 */
export function createFlaunchCalldata(
  params: Omit<CreateFlaunchCalldataParams, "walletAddress">
): ReadFlaunchSDK;
/**
 * Creates a read-write Flaunch SDK instance that returns encoded calldata instead of broadcasting transactions
 * @param params - Parameters containing publicClient and walletAddress
 * @returns ReadWriteFlaunchSDK instance configured for calldata generation
 * @throws Error if publicClient.chain is not configured
 */
export function createFlaunchCalldata(
  params: Required<CreateFlaunchCalldataParams>
): ReadWriteFlaunchSDK;

/**
 * Creates a Flaunch SDK instance that returns encoded calldata instead of broadcasting transactions
 * @param params - Parameters containing publicClient and optionally walletAddress
 * @returns ReadFlaunchSDK if only publicClient is provided, ReadWriteFlaunchSDK if walletAddress is also provided
 * @throws Error if publicClient.chain is not configured
 */
export function createFlaunchCalldata(params: CreateFlaunchCalldataParams) {
  const { publicClient, walletAddress } = params;

  if (!publicClient.chain) {
    throw new Error("publicClient must be configured with a chain");
  }

  const chainId = publicClient.chain.id;

  // Return appropriate SDK type based on whether walletAddress is provided
  if (walletAddress) {
    // Create custom wallet client that returns calldata
    const callDataWalletClient = createCallDataWalletClient(
      publicClient,
      walletAddress
    );

    // Create Drift with the custom wallet client
    const drift = createDrift({
      publicClient,
      walletClient: callDataWalletClient,
    });

    return new ReadWriteFlaunchSDK(chainId, drift);
  } else {
    // Create read-only SDK with only public client
    const drift = createDrift({ publicClient });
    return new ReadFlaunchSDK(chainId, drift);
  }
}

/**
 * Decodes the result from SDK methods into transaction object
 * @param encodedCall - The result returned by SDK methods
 * @returns Call data containing to, value, and data
 */
export function decodeCallData(encodedCall: Hex): CallData {
  const decodedCall = decodeFunctionData({
    abi: encodedCallAbi,
    data: encodedCall,
  });

  return {
    to: decodedCall.args[0] as Address,
    value: decodedCall.args[1] as bigint,
    data: decodedCall.args[2] as Hex,
  };
}

/**
 * Convenience function to call an SDK method and automatically parse the result as transaction object
 * @param sdkMethod - A function that returns a Promise<Hex> (encoded calldata)
 * @returns Promise<CallData> with decoded transaction parameters
 */
export async function parseCall<T extends (...args: any[]) => Promise<Hex>>(
  sdkMethod: T
): Promise<CallData> {
  const encodedCall = await sdkMethod();
  return decodeCallData(encodedCall);
}

/**
 * Type helper for SDK methods that return encoded calldata
 */
export type CallDataMethod<T extends any[] = any[]> = (
  ...args: T
) => Promise<Hex>;

/**
 * Type helper for the result of a calldata operation
 */
export type CallDataResult = Promise<CallData>;
