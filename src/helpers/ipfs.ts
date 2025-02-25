export const resolveIPFS = (value: string) => {
  if (value.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${value.slice(7)}`;
  }
  return value;
};
