import {
  type Address,
  type Drift,
  type HexString,
  type ReadContract,
  type ReadWriteAdapter,
  type ReadWriteContract,
  createDrift,
} from "@delvtech/drift";
import {
  PoolSwapV1_3Abi,
  PoolSwapV1_3SwapWithHookDataAbi,
  PoolSwapV1_3SwapWithReferrerAbi,
} from "../abi/PoolSwapV1_3";
import { PoolKey } from "../types";

export type PoolSwapV1_3ABI = typeof PoolSwapV1_3Abi;

/** Uniswap v4 `SwapParams`: negative `amountSpecified` = exact input. */
export type PoolSwapParams = {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
};

export type PoolSwapV1_3SwapParams = {
  poolKey: PoolKey;
  params: PoolSwapParams;
  /**
   * Arbitrary bytes for the pool's hook — a spend-gated launch's signed authorisation travels here.
   * When present the `bytes` overload is used and `referrer` is ignored (the gate's payload already
   * leads with the referrer address).
   */
  hookData?: HexString;
  /** Referral attribution via the `address` overload; zero (or absent) means none. */
  referrer?: Address;
  /** Native ETH input for a pool whose paired side is `address(0)`; 0 for ERC20 / flETH input. */
  value?: bigint;
};

/**
 * The v1.3.1 PoolSwap router: single-pool swaps against any PoolKey on the paired-token
 * PositionManager. Read side exposes `msgSender()`, the transient slot hooks read to learn who
 * initiated the in-flight swap (the spend gate's approved-router buyer binding); it is zero at rest.
 */
export class ReadPoolSwapV1_3 {
  public readonly contract: ReadContract<PoolSwapV1_3ABI>;
  public readonly address: Address;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.address = address;
    this.contract = drift.contract({ abi: PoolSwapV1_3Abi, address });
  }

  msgSender() {
    return this.contract.read("msgSender");
  }
}

export class ReadWritePoolSwapV1_3 extends ReadPoolSwapV1_3 {
  declare contract: ReadWriteContract<PoolSwapV1_3ABI>;
  private readonly drift: Drift<ReadWriteAdapter>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
    this.drift = drift;
  }

  /**
   * Swaps against a paired-token pool. The overload is chosen by the payload: `hookData` → the
   * `bytes` overload, else the `address` overload with `referrer ?? address(0)`. Exact-input only
   * is enforced by callers (the spend gate rejects exact-output swaps).
   */
  swap({ poolKey, params, hookData, referrer, value = 0n }: PoolSwapV1_3SwapParams) {
    if (hookData !== undefined) {
      // A single-overload ABI keeps drift's name-based dispatch unambiguous.
      const contract = this.drift.contract({
        abi: PoolSwapV1_3SwapWithHookDataAbi,
        address: this.address,
      });
      return contract.write(
        "swap",
        { _key: poolKey, _params: params, _hookData: hookData },
        { value }
      );
    }

    const contract = this.drift.contract({
      abi: PoolSwapV1_3SwapWithReferrerAbi,
      address: this.address,
    });
    return contract.write(
      "swap",
      {
        _key: poolKey,
        _params: params,
        _referrer: referrer ?? "0x0000000000000000000000000000000000000000",
      },
      { value }
    );
  }
}
