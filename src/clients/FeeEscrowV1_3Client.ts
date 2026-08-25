import {
  type ReadContract,
  type Address,
  type Drift,
  type ReadWriteContract,
  type ReadWriteAdapter,
  createDrift,
} from "@delvtech/drift";
import { FeeEscrowV1_3Abi } from "../abi/FeeEscrowV1_3";

export type FeeEscrowV1_3ABI = typeof FeeEscrowV1_3Abi;

/** A claimable balance on the multi-token escrow, in the escrow token's own raw units. */
export interface EscrowTokenBalance {
  /** The escrow token key — `zeroAddress` for native ETH */
  token: Address;
  amount: bigint;
}

/**
 * Client for the v1.3.1 multi-token FeeEscrow in read-only mode.
 *
 * One escrow per chain serves every paired token — flETH, native ETH (`address(0)`) and the
 * registry's ERC20 pairings such as the B20 equities. Balances are keyed (recipient, token) and
 * denominated in that token, so callers name the tokens they are interested in: the contract
 * cannot enumerate a recipient's keys.
 */
export class ReadFeeEscrowV1_3 {
  public readonly contract: ReadContract<FeeEscrowV1_3ABI>;

  /**
   * Creates a new ReadFeeEscrowV1_3 instance
   * @param address - The address of the multi-token FeeEscrow contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: FeeEscrowV1_3Abi,
      address,
    });
  }

  /**
   * Gets the claimable balance of one escrow token for a recipient
   * @param recipient - The address of the recipient to check
   * @param token - The escrow token (`zeroAddress` for native ETH)
   * @returns Promise<bigint> - The claimable balance in the token's raw units
   */
  balances(recipient: Address, token: Address) {
    return this.contract.read("balances", {
      _recipient: recipient,
      _token: token,
    });
  }

  /**
   * Gets the claimable balances across several escrow tokens. Zero balances are kept so callers
   * can decide what to sweep.
   * @param recipient - The address of the recipient to check
   * @param tokens - The escrow tokens to read
   * @returns Promise<EscrowTokenBalance[]> - One entry per token, in the order given
   */
  async balancesForTokens(
    recipient: Address,
    tokens: Address[]
  ): Promise<EscrowTokenBalance[]> {
    const amounts = await Promise.all(
      tokens.map((token) => this.balances(recipient, token))
    );
    return tokens.map((token, index) => ({ token, amount: amounts[index] }));
  }

  /**
   * Gets the total fees a pool has accrued in one escrow token
   * @param poolId - The pool to check
   * @param token - The escrow token
   * @returns Promise<bigint> - The total allocated, in the token's raw units
   */
  totalFeesAllocated(poolId: `0x${string}`, token: Address) {
    return this.contract.read("totalFeesAllocated", {
      _poolId: poolId,
      _token: token,
    });
  }

  /**
   * Gets the PairedTokenRegistry that decides each token's unwrap policy on withdrawal
   * @returns Promise<Address> - The registry address
   */
  pairedTokenRegistry() {
    return this.contract.read("pairedTokenRegistry");
  }
}

/**
 * Extended client for the v1.3.1 multi-token FeeEscrow with write capabilities
 */
export class ReadWriteFeeEscrowV1_3 extends ReadFeeEscrowV1_3 {
  declare contract: ReadWriteContract<FeeEscrowV1_3ABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Withdraws the caller's balance in every listed escrow token to a recipient, in one
   * transaction. A zero-balance or duplicate entry is a harmless no-op on-chain. With `unwrap`
   * (the default) flETH pays out as ETH and an ERC20 wrapper as its underlying; a plain ERC20
   * such as a stock is delivered as itself either way.
   * @param params.tokens - The escrow tokens to withdraw (`zeroAddress` for native ETH)
   * @param params.recipient - The address to receive the fees
   * @param params.unwrap - Whether to unwrap wrappers to their underlying asset. Defaults to true
   * @returns Promise<Hex> - The transaction hash
   */
  withdrawFees(params: {
    tokens: Address[];
    recipient: Address;
    unwrap?: boolean;
  }) {
    return this.contract.write("withdrawFees", {
      _tokens: params.tokens,
      _recipient: params.recipient,
      _unwrap: params.unwrap ?? true,
    });
  }
}
