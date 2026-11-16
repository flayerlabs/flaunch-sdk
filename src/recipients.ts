import {
  encodeAbiParameters,
  keccak256,
  parseEventLogs,
  stringToHex,
  zeroAddress,
  type Address,
  type Hex,
  type Client,
  type TransactionReceipt,
} from "viem";
import { readContract } from "viem/actions";
import { RecipientFactoryAbi } from "./abi/index.js";
import { deployment } from "./addresses.js";

/** A fee recipient strategy and its settings. X accounts resolve to a wallet before reaching here. */
export type RecipientStrategy = { kind: "ADDRESS"; address: Address } | { kind: "BUY_AND_BURN" } | { kind: "STAKING" };

/** A fee recipient and its share of fees in basis points. */
export type RecipientSpec = RecipientStrategy & { percentage: number };

/** Recipient strategies that share one clone per configuration, so an existing clone can be found and reused. */
export type ReusableRecipient = Exclude<RecipientStrategy, { kind: "STAKING" }>;

const VERSION = 1n;

/** The `AtomicLaunchZap.RecipientConfig` for a recipient. */
export function recipientConfig(spec: RecipientSpec) {
  return {
    ...strategyConfig(spec),
    percentage: spec.percentage,
    // A staking recipient is bound to its launch, whose id only exists once the zap has launched
    useLaunchId: spec.kind === "STAKING",
  };
}

/** The existing clone for this recipient, or `null` when one must be created first. */
export async function findRecipient(client: Client, chainId: number, recipient: ReusableRecipient): Promise<Address | null> {
  const { typeId, version, configuration } = strategyConfig(recipient);
  const clone = await readContract(client, {
    address: deployment(chainId).recipientFactory,
    abi: RecipientFactoryAbi,
    functionName: "reusableRecipients",
    // The factory keys clones by the hash of the validated configuration, which these strategies return unchanged
    args: [typeId, version, keccak256(configuration)],
  });
  return clone === zeroAddress ? null : clone;
}

/** `RecipientFactory.createRecipient`, which returns the existing clone instead when one matches. */
export function buildCreateRecipient(chainId: number, recipient: ReusableRecipient) {
  const { typeId, version, configuration } = strategyConfig(recipient);
  return {
    address: deployment(chainId).recipientFactory,
    abi: RecipientFactoryAbi,
    functionName: "createRecipient",
    args: [typeId, version, configuration],
  } as const;
}

/** Every recipient the factory created or reused in a transaction, in log order. */
export function parseRecipients(receipt: TransactionReceipt, chainId: number) {
  const factory = deployment(chainId).recipientFactory.toLowerCase();
  return parseEventLogs({ abi: RecipientFactoryAbi, logs: receipt.logs, eventName: ["RecipientCreated", "RecipientReused"] })
    .filter((log) => log.address.toLowerCase() === factory)
    .map(({ args }) => ({
      recipient: args.recipient,
      typeId: args.typeId,
      version: args.version,
      configurationHash: args.configurationHash,
    }));
}

function strategyConfig(strategy: RecipientStrategy) {
  // Buy-and-burn takes no settings, and the zap supplies the staking launch id itself
  const configuration: Hex = strategy.kind === "ADDRESS" ? encodeAbiParameters([{ type: "address" }], [strategy.address]) : "0x";
  return { typeId: stringToHex(strategy.kind, { size: 32 }), version: VERSION, configuration };
}
