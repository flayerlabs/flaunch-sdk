import assert from "node:assert/strict";
import {
  createPublicClient,
  encodeAbiParameters,
  getAddress,
  http,
} from "viem";
import { mainnet, robinhood, unichain } from "viem/chains";
import addressExports from "../dist/addresses/index.cjs";
import abiExports from "../dist/abi/index.cjs";

const {
  FeeEscrowAddress,
  FLETHAddress,
  FlaunchMultichainAddress,
  FlaunchPositionManagerMultichainAddress,
  FlaunchZapMultichainAddress,
  PoolManagerAddress,
  PoolSwapV1_3Address,
  StateViewAddress,
} = addressExports;
const { FlaunchZapAbi } = abiExports;

function addressesFor(chainId) {
  return {
    positionManager: FlaunchPositionManagerMultichainAddress[chainId],
    flaunch: FlaunchMultichainAddress[chainId],
    zap: FlaunchZapMultichainAddress[chainId],
    feeEscrow: FeeEscrowAddress[chainId],
    flETH: FLETHAddress[chainId],
    poolManager: PoolManagerAddress[chainId],
    stateView: StateViewAddress[chainId],
    // Only chains with a paired-token PoolSwap carry the key; `getCode` below skips undefined.
    ...(PoolSwapV1_3Address[chainId]
      ? { poolSwap: PoolSwapV1_3Address[chainId] }
      : {}),
  };
}

const deployments = [
  {
    name: "Ethereum",
    chain: mainnet,
    rpcEnv: "ETHEREUM_RPC_URL",
    addresses: addressesFor(mainnet.id),
  },
  {
    name: "Unichain",
    chain: unichain,
    rpcEnv: "UNICHAIN_RPC_URL",
    addresses: addressesFor(unichain.id),
  },
  {
    name: "Robinhood",
    chain: robinhood,
    rpcEnv: "ROBINHOOD_RPC_URL",
    addresses: addressesFor(robinhood.id),
  },
];

const canaryLaunchParams = {
  name: "Deployment canary",
  symbol: "CANARY",
  tokenUri: "ipfs://deployment-canary",
  premineAmount: 0n,
  creator: "0x000000000000000000000000000000000000dEaD",
  creatorFeeAllocation: 8_000,
  flaunchAt: 0n,
  initialPriceParams: encodeAbiParameters(
    [{ type: "uint256" }],
    [10_000n * 10n ** 6n]
  ),
  feeCalculatorParams: "0x",
};

async function validateDeployment(deployment) {
  const rpcUrl = process.env[deployment.rpcEnv];
  assert.ok(rpcUrl, `Missing ${deployment.rpcEnv}`);

  const client = createPublicClient({
    chain: deployment.chain,
    transport: http(rpcUrl),
  });

  const chainId = await client.getChainId();
  assert.equal(
    chainId,
    deployment.chain.id,
    `${deployment.name}: RPC returned chain ID ${chainId}`
  );

  for (const [label, address] of Object.entries(deployment.addresses)) {
    const code = await client.getCode({ address });
    assert.ok(code && code !== "0x", `${deployment.name}: no code at ${label}`);
  }

  const [
    zapPositionManager,
    zapFlaunchContract,
    positionManagerFlaunchContract,
    flaunchPositionManager,
    fee,
  ] = await Promise.all([
    client.readContract({
      address: deployment.addresses.zap,
      abi: FlaunchZapAbi,
      functionName: "positionManager",
    }),
    client.readContract({
      address: deployment.addresses.zap,
      abi: FlaunchZapAbi,
      functionName: "flaunchContract",
    }),
    client.readContract({
      address: deployment.addresses.positionManager,
      abi: FlaunchZapAbi,
      functionName: "flaunchContract",
    }),
    client.readContract({
      address: deployment.addresses.flaunch,
      abi: FlaunchZapAbi,
      functionName: "positionManager",
    }),
    client.readContract({
      address: deployment.addresses.zap,
      abi: FlaunchZapAbi,
      functionName: "calculateFee",
      args: [canaryLaunchParams, 500n],
    }),
  ]);

  assert.equal(
    getAddress(zapPositionManager),
    getAddress(deployment.addresses.positionManager),
    `${deployment.name}: Zap points to an unexpected PositionManager`
  );
  assert.equal(
    getAddress(zapFlaunchContract),
    getAddress(deployment.addresses.flaunch),
    `${deployment.name}: Zap points to an unexpected Flaunch contract`
  );
  assert.equal(
    getAddress(positionManagerFlaunchContract),
    getAddress(deployment.addresses.flaunch),
    `${deployment.name}: PositionManager points to an unexpected Flaunch contract`
  );
  assert.equal(
    getAddress(flaunchPositionManager),
    getAddress(deployment.addresses.positionManager),
    `${deployment.name}: Flaunch points to an unexpected PositionManager`
  );
  assert.equal(typeof fee, "bigint", `${deployment.name}: calculateFee failed`);

  console.log(`${deployment.name} (${deployment.chain.id}): OK`);
}

for (const deployment of deployments) {
  await validateDeployment(deployment);
}
