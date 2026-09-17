import { encodeAbiParameters, getAddress, zeroAddress } from "viem";
import type { FlaunchWithSplitManagerParams } from "../clients/FlaunchZapClient";

/** Recipient percentages divide the remainder after creator and owner fees. */
export function encodeStaticSplit(
  params: Pick<
    FlaunchWithSplitManagerParams,
    "creatorSplitPercent" | "managerOwnerSplitPercent" | "splitReceivers"
  >
) {
  const total = 10_000_000n;
  function share(percent: number) {
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      throw new Error("Split percentages must be integers between 0 and 100");
    }
    return BigInt(percent) * 100_000n;
  }
  const creatorShare = share(params.creatorSplitPercent);
  const ownerShare = share(params.managerOwnerSplitPercent);
  if (creatorShare + ownerShare > total) {
    throw new Error("Creator and owner percentages must total at most 100");
  }
  const seen = new Set<string>();
  const recipientShares = params.splitReceivers.map((receiver) => {
    const recipient = getAddress(receiver.address);
    const key = recipient.toLowerCase();
    if (recipient === zeroAddress || seen.has(key)) {
      throw new Error("Split recipients must be unique nonzero addresses");
    }
    seen.add(key);
    const amount = share(receiver.percent);
    if (amount === 0n) throw new Error("Recipient percentages must be positive");
    return { recipient, share: amount };
  });
  if (recipientShares.reduce((sum, receiver) => sum + receiver.share, 0n) !== total) {
    throw new Error("Recipient percentages must total 100 independently of creator and owner");
  }
  return encodeAbiParameters(
    [{ type: "tuple", components: [
      { type: "uint256", name: "creatorShare" },
      { type: "uint256", name: "ownerShare" },
      { type: "tuple[]", name: "recipientShares", components: [
        { type: "address", name: "recipient" },
        { type: "uint256", name: "share" },
      ] },
    ] }],
    [{ creatorShare, ownerShare, recipientShares }]
  );
}
