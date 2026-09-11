import {
  type Address,
  type Hex,
  type PublicClient,
  decodeAbiParameters,
  encodeAbiParameters,
} from "viem";

/**
 * Runtime bytecode of `LaunchCostProbe` (Solidity 0.8.26, cancun, optimizer 200):
 *
 *   fallback(bytes calldata input) external payable returns (bytes memory) {
 *     (address target, uint256 value, bytes memory data) = abi.decode(input, (address, uint256, bytes));
 *     uint256 before = address(this).balance;
 *     (bool ok, bytes memory ret) = target.call{value: value}(data);
 *     if (!ok) revert(ret);
 *     return abi.encode(before - address(this).balance, ret);
 *   }
 *   receive() external payable {}
 *
 * It is never deployed. `probeLaunchCost` injects it at the SENDER's address through an
 * `eth_call` state override (code + balance), so the launch executes with the real
 * `msg.sender`, the premined coins go to the real creator, the zap's refund lands on the real
 * address — and the probe reports the ETH the launch actually consumed. That is the only way to
 * price a premine exactly before the pool exists: the zaps' `calculateFee` is a linear
 * estimate that under-quotes larger premines, and the multichain zap's `ethSpent_` return value
 * repeats that estimate rather than the real spend.
 */
export const LAUNCH_COST_PROBE_BYTECODE: Hex =
  "0x60806040523661000b57005b5f36606082808061001c85826100e4565b9250925092505f4790505f80856001600160a01b0316858560405161004191906101bd565b5f6040518083038185875af1925050503d805f811461007b576040519150601f19603f3d011682016040523d82523d5f602084013e610080565b606091505b50915091508161009257805160208201fd5b61009c47846101d3565b816040516020016100ae9291906101f8565b6040516020818303038152906040529650505050505050915050805190602001f35b634e487b7160e01b5f52604160045260245ffd5b5f805f606084860312156100f6575f80fd5b83356001600160a01b038116811461010c575f80fd5b925060208401359150604084013567ffffffffffffffff81111561012e575f80fd5b8401601f8101861361013e575f80fd5b803567ffffffffffffffff811115610158576101586100d0565b604051601f8201601f19908116603f0116810167ffffffffffffffff81118282101715610187576101876100d0565b60405281815282820160200188101561019e575f80fd5b816020840160208301375f602083830101528093505050509250925092565b5f82518060208501845e5f920191825250919050565b818103818111156101f257634e487b7160e01b5f52601160045260245ffd5b92915050565b828152604060208201525f82518060408401528060208501606085015e5f606082850101526060601f19601f830116840101915050939250505056fea2646970667358221220a7072b1f1ce182d734d2a058a9cfb026f3ab86c173014cb74170860f4806c53964736f6c634300081a0033";

export type LaunchCostProbeParams = {
  /** The account the launch will be sent from; its code and balance are overridden for the call only. */
  sender: Address;
  to: Address;
  data: Hex;
  /** ETH forwarded to the launch — an ample cap; the probe reports what was actually kept. */
  value: bigint;
  /** Pin the call to a block (a planner's quote block). */
  blockNumber?: bigint;
};

export type LaunchCostProbeResult = {
  /** ETH the launch consumed from the sender (fee plus premine, after the zap's refund). */
  spent: bigint;
  /** The zap call's own return data (e.g. `memecoin_`, `ethSpent_`), for callers that want it. */
  returnData: Hex;
};

/** Signature the SDK exposes for injection and tests. */
export type LaunchCostProbe = (params: LaunchCostProbeParams) => Promise<LaunchCostProbeResult>;

/**
 * Prices a launch exactly by executing it in an `eth_call` with the sender's code and balance
 * overridden (see `LAUNCH_COST_PROBE_BYTECODE`). Throws the zap's revert when the launch cannot
 * complete within `value`. Requires a node that honours `eth_call` state overrides (geth /
 * op-geth / Nitro / Anvil do).
 */
export function createLaunchCostProbe(publicClient: PublicClient): LaunchCostProbe {
  return async ({ sender, to, data, value, blockNumber }) => {
    const input = encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "bytes" }],
      [to, value, data]
    );
    const { data: output } = await publicClient.call({
      account: sender,
      to: sender,
      data: input,
      value: 0n,
      stateOverride: [{ address: sender, code: LAUNCH_COST_PROBE_BYTECODE, balance: value }],
      ...(blockNumber === undefined ? {} : { blockNumber }),
    });
    if (!output) throw new Error("Launch cost probe returned no data");
    const [spent, returnData] = decodeAbiParameters(
      [{ type: "uint256" }, { type: "bytes" }],
      output
    );
    return { spent, returnData };
  };
}
