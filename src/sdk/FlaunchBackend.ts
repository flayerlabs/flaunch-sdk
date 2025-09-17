import {
  Address,
  Hex,
  keccak256,
  encodePacked,
  zeroAddress,
  encodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { TICK_SPACING, orderPoolKey, getPoolId } from "../utils/univ4";
import { FlaunchVersion } from "../types";
import {
  FLETHAddress,
  FlaunchPositionManagerAddress,
  FlaunchPositionManagerV1_1Address,
  FlaunchPositionManagerV1_2Address,
} from "addresses";

/**
 * Backend class for interacting with Flaunch protocol for generating hookData with signature for swaps.
 * Doesn't require any publicClient or walletClient to be initialized.
 */
export class FlaunchBackend {
  signerPrivateKey: Hex;
  public readonly chainId: number;

  constructor(signerPrivateKey: Hex, chainId: number) {
    this.signerPrivateKey = signerPrivateKey;
    this.chainId = chainId;
  }

  /**
   * Generates the hookData for swaps when TrustedSigner is enabled for a coin during fair launch
   *
   * @param userWallet - The wallet address to generate a signature for
   * @param coinAddress - The address of the coin to generate a signature for
   * @param deadlineFromNowInSeconds - The deadline from now in seconds
   * @param version - The version to get the position manager address for, defaults to the latest version if undefined
   * @param referrer - (optional) The referrer address for the swap
   * @return The encoded hookData as hex string
   */
  async generateHookDataWithSignature({
    userWallet,
    coinAddress,
    deadlineFromNowInSeconds,
    version,
    referrer,
  }: {
    userWallet: Address;
    coinAddress: Address;
    deadlineFromNowInSeconds: number;
    version?: FlaunchVersion;
    referrer?: Address;
  }): Promise<Hex> {
    const poolId = getPoolId(
      orderPoolKey({
        currency0: FLETHAddress[this.chainId],
        currency1: coinAddress,
        fee: 0,
        tickSpacing: TICK_SPACING,
        hooks: this.getPositionManagerAddress(version),
      })
    );

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const deadline = BigInt(nowInSeconds + deadlineFromNowInSeconds);

    const signature = await generateSignatureRaw({
      userWallet,
      poolId,
      deadline,
      privateKey: this.signerPrivateKey,
    });

    if (!referrer) {
      referrer = zeroAddress;
    }

    // Encode hookData equivalent to Solidity's abi.encode(referrer, SignedMessage)
    const hookData = encodeAbiParameters(
      [
        { name: "referrer", type: "address" },
        {
          name: "signedMessage",
          type: "tuple",
          components: [
            { name: "poolId", type: "bytes32" },
            { name: "deadline", type: "uint256" },
            { name: "signature", type: "bytes" },
          ],
        },
      ],
      [
        referrer,
        {
          poolId,
          deadline,
          signature,
        },
      ]
    );

    return hookData;
  }

  /**
   * Gets the position manager address for a given version
   * @param version - The version to get the position manager address for, defaults to the latest version if undefined
   */
  getPositionManagerAddress(version?: FlaunchVersion) {
    const latestVersionAddress =
      FlaunchPositionManagerV1_2Address[this.chainId];

    if (!version) {
      return latestVersionAddress;
    }

    switch (version) {
      case FlaunchVersion.V1:
        return FlaunchPositionManagerAddress[this.chainId];
      case FlaunchVersion.V1_1:
        return FlaunchPositionManagerV1_1Address[this.chainId];
      case FlaunchVersion.V1_2:
        return FlaunchPositionManagerV1_2Address[this.chainId];
      case FlaunchVersion.ANY:
        throw Error("AnyPositionManager is not supported for TrustedSigner");
      default:
        return latestVersionAddress;
    }
  }
}

/**
 * Generates a signature for a given wallet, poolId, deadline and private key.
 *
 * @param userWallet The wallet address to generate a signature for
 * @param poolId The pool id that this signature is valid for (as hex string)
 * @param deadline The deadline for the signature
 * @param privateKey The private key to use to generate the signature (as hex string)
 * @return The encoded signature as hex string
 */
export const generateSignatureRaw = async ({
  userWallet,
  poolId,
  deadline,
  privateKey,
}: {
  userWallet: Address;
  poolId: Hex;
  deadline: bigint;
  privateKey: Hex;
}): Promise<Hex> => {
  // Equivalent to: keccak256(abi.encodePacked(_wallet, _poolId, _deadline))
  const hash = keccak256(
    encodePacked(
      ["address", "bytes32", "uint256"],
      [userWallet, poolId, deadline]
    )
  );

  // Equivalent to: keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash))
  const ethSignedMessagePrefix = "\x19Ethereum Signed Message:\n32";
  const message = keccak256(
    encodePacked(["string", "bytes32"], [ethSignedMessagePrefix, hash])
  );

  // Create account from private key and sign the prefixed hash
  const account = privateKeyToAccount(privateKey);
  const signature = await account.sign({ hash: message });

  return signature;
};
