import { encodeAbiParameters, Hex, hexToBigInt, pad } from "viem";

// i.e. 0-255 -> '00'-'ff'
const dec2hex = (dec: number): string => dec.toString(16).padStart(2, "0");

export const bytes32ToUint256 = (value: Hex) => {
  return hexToBigInt(value);
};

export const uint256ToBytes32 = (value: bigint) => {
  return pad(
    encodeAbiParameters([{ type: "uint256", name: "value" }], [value]),
    { size: 32, dir: "right" }
  );
};
