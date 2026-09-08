import {
  decodeAbiParameters,
  decodeEventLog,
  encodeAbiParameters,
  getAddress,
  isAddress,
  isAddressEqual,
  isHex,
  zeroAddress,
  type Address,
  type Hex,
  type Log,
} from "viem";
import { ReferralEventsAbi } from "../abi/Referral";

/** Validate without normalizing opaque signed payloads or changing their bytes. */
export function resolveReferralHookData(params: {
  referrer?: Address;
  hookData?: Hex;
}): Hex {
  if (params.referrer !== undefined && !isAddress(params.referrer)) {
    throw new Error("Invalid referrer address");
  }
  if (params.hookData !== undefined) {
    if (
      !isHex(params.hookData, { strict: true }) ||
      params.hookData.length % 2 !== 0
    ) {
      throw new Error("Invalid referral hook data");
    }
    const embedded = decodeReferralHookData(params.hookData);
    if (
      params.referrer !== undefined &&
      !isAddressEqual(embedded, params.referrer)
    ) {
      throw new Error("Referrer conflicts with hook data");
    }
    return params.hookData;
  }
  return params.referrer && !isAddressEqual(params.referrer, zeroAddress)
    ? encodeAbiParameters([{ type: "address" }], [params.referrer])
    : "0x";
}

/** The leading word is the referral recipient, not proof of a permanent binding. */
export function decodeReferralHookData(hookData: Hex): Address {
  if (hookData === "0x") return zeroAddress;
  if (
    !isHex(hookData, { strict: true }) ||
    hookData.length < 66 ||
    hookData.length % 2 !== 0
  ) {
    throw new Error("Referral hook data must contain an ABI-encoded address");
  }
  const word = hookData.slice(2, 66);
  if (!/^0{24}[0-9a-fA-F]{40}$/.test(word)) {
    throw new Error("Invalid referral address word");
  }
  return getAddress(`0x${word.slice(24)}`);
}

const trustedMessage = [
  { name: "referrer", type: "address" },
  {
    name: "message",
    type: "tuple",
    components: [
      { name: "poolId", type: "bytes32" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
  },
] as const;
const spendMessage = [
  { name: "referrer", type: "address" },
  {
    name: "message",
    type: "tuple",
    components: [
      { name: "buyer", type: "address" },
      { name: "poolId", type: "bytes32" },
      { name: "deadline", type: "uint256" },
      { name: "maxSpendWei", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
  },
] as const;

export type TrustedReferralMessage = {
  poolId: Hex;
  deadline: bigint;
  signature: Hex;
};
export type SpendReferralMessage = TrustedReferralMessage & {
  buyer: Address;
  maxSpendWei: bigint;
  nonce: bigint;
};

/** Packages an existing authorization; it does not sign or alter its signed fields. */
export function encodeTrustedReferralHookData(
  message: TrustedReferralMessage,
  referrer: Address = zeroAddress,
): Hex {
  return encodeAbiParameters(trustedMessage, [referrer, message]);
}

/** For SpendGatedSignerFeeCalculator, including Game Mode. */
export function encodeSpendReferralHookData(
  message: SpendReferralMessage,
  referrer: Address = zeroAddress,
): Hex {
  return encodeAbiParameters(spendMessage, [referrer, message]);
}

export function decodeTrustedReferralHookData(hookData: Hex) {
  const [referrer, message] = decodeAbiParameters(trustedMessage, hookData);
  return { referrer, message };
}

export function decodeSpendReferralHookData(hookData: Hex) {
  const [referrer, message] = decodeAbiParameters(spendMessage, hookData);
  return { referrer, message };
}

export type ReferralEvent = {
  chainId: number;
  emitter: Address;
  kind: "assigned" | "claimed" | "paid";
  user: Address;
  recipient: Address;
  token: Address;
  amount: bigint;
  poolId?: Hex;
  transactionHash: Hex | null;
  logIndex: number | null;
  blockNumber: bigint | null;
};

/** Decode only logs from caller-verified hooks/escrows. Removed logs are never earnings. */
export function decodeReferralEvents(
  logs: readonly Log[],
  params: {
    chainId: number;
    escrows: readonly Address[];
    hooks: readonly Address[];
  },
): ReferralEvent[] {
  const escrows = new Set(params.escrows.map((a) => a.toLowerCase()));
  const hooks = new Set(params.hooks.map((a) => a.toLowerCase()));
  return logs.flatMap((log): ReferralEvent[] => {
    if (log.removed) return [];
    try {
      const event = decodeEventLog({
        abi: ReferralEventsAbi,
        data: log.data,
        topics: log.topics,
      });
      const base = {
        chainId: params.chainId,
        emitter: log.address,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
      };
      if (event.eventName === "ReferrerFeePaid") {
        if (!hooks.has(log.address.toLowerCase())) return [];
        const a = event.args;
        return [
          {
            ...base,
            kind: "paid",
            user: a._recipient,
            recipient: a._recipient,
            token: a._token,
            amount: a._amount,
            poolId: a._poolId,
          },
        ];
      }
      if (!escrows.has(log.address.toLowerCase())) return [];
      const a = event.args;
      return event.eventName === "TokensAssigned"
        ? [
            {
              ...base,
              kind: "assigned",
              user: a._user,
              recipient: a._user,
              token: a._token,
              amount: a._amount,
              poolId: event.args._poolId,
            },
          ]
        : [
            {
              ...base,
              kind: "claimed",
              user: a._user,
              recipient: event.args._recipient,
              token: a._token,
              amount: a._amount,
            },
          ];
    } catch {
      return [];
    }
  });
}
