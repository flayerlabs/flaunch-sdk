import {
  type ReadContract,
  type Address,
  type Drift,
  type EventLog,
  type ReadWriteContract,
  type ReadWriteAdapter,
  type HexString,
  createDrift,
} from "@delvtech/drift";
import { QuoterAbi } from "../abi/Quoter";
import { formatUnits, parseEther, zeroAddress } from "viem";
import {
  FlaunchPositionManagerAddress,
  FlaunchPositionManagerV1_1Address,
  FLETHAddress,
  FLETHHooksAddress,
  USDCETHPoolKeys,
} from "addresses";

export type QuoterABI = typeof QuoterAbi;

/**
 * Client for interacting with the Quoter contract to get price quotes for swaps
 * Provides methods to simulate trades and get expected output amounts
 */
export class ReadQuoter {
  chainId: number;
  public readonly contract: ReadContract<QuoterABI>;

  /**
   * Creates a new ReadQuoter instance
   * @param chainId - The chain ID where the Quoter contract is deployed
   * @param address - The address of the Quoter contract
   * @param drift - Optional drift instance for contract interactions (creates new instance if not provided)
   * @throws Error if address is not provided
   */
  constructor(chainId: number, address: Address, drift: Drift = createDrift()) {
    this.chainId = chainId;
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: QuoterAbi,
      address,
    });
  }

  /**
   * Gets a quote for selling an exact amount of tokens for ETH
   * @param coinAddress - The address of the token to sell
   * @param amountIn - The exact amount of tokens to sell
   * @param isV1Coin - Optional flag to specify if token is V1. If not provided, V1.1 is assumed
   * @returns Promise<bigint> - The expected amount of ETH to receive
   */
  async getSellQuoteExactInput(
    coinAddress: Address,
    amountIn: bigint,
    isV1Coin?: boolean
  ) {
    const res = await this.contract.simulateWrite("quoteExactInput", {
      params: {
        exactAmount: amountIn,
        exactCurrency: coinAddress,
        path: [
          {
            fee: 0,
            tickSpacing: 60,
            hooks: isV1Coin
              ? FlaunchPositionManagerAddress[this.chainId]
              : FlaunchPositionManagerV1_1Address[this.chainId],
            hookData: "0x",
            intermediateCurrency: FLETHAddress[this.chainId],
          },
          {
            fee: 0,
            tickSpacing: 60,
            hookData: "0x",
            hooks: FLETHHooksAddress[this.chainId],
            intermediateCurrency: zeroAddress,
          },
        ],
      },
    });

    return res.amountOut;
  }

  /**
   * Gets a quote for buying tokens with an exact amount of ETH
   * @param coinAddress - The address of the token to buy
   * @param ethIn - The exact amount of ETH to spend
   * @param isV1Coin - Optional flag to specify if token is V1. If not provided, V1.1 is assumed
   * @returns Promise<bigint> - The expected amount of tokens to receive
   */
  async getBuyQuoteExactInput(
    coinAddress: Address,
    ethIn: bigint,
    isV1Coin?: boolean
  ) {
    const res = await this.contract.simulateWrite("quoteExactInput", {
      params: {
        exactAmount: ethIn,
        exactCurrency: zeroAddress,
        path: [
          {
            fee: 0,
            tickSpacing: 60,
            hookData: "0x",
            hooks: FLETHHooksAddress[this.chainId],
            intermediateCurrency: FLETHAddress[this.chainId],
          },
          {
            fee: 0,
            tickSpacing: 60,
            hooks: isV1Coin
              ? FlaunchPositionManagerAddress[this.chainId]
              : FlaunchPositionManagerV1_1Address[this.chainId],
            hookData: "0x",
            intermediateCurrency: coinAddress,
          },
        ],
      },
    });

    return res.amountOut;
  }

  /**
   * Gets a quote for buying an exact amount of tokens with ETH
   * @param coinAddress - The address of the token to buy
   * @param coinOut - The exact amount of tokens to receive
   * @param isV1Coin - Optional flag to specify if token is V1. If not provided, V1.1 is assumed
   * @returns Promise<bigint> - The required amount of ETH to spend
   */
  async getBuyQuoteExactOutput(
    coinAddress: Address,
    coinOut: bigint,
    isV1Coin?: boolean
  ) {
    const res = await this.contract.simulateWrite("quoteExactOutput", {
      params: {
        path: [
          {
            intermediateCurrency: zeroAddress,
            fee: 0,
            tickSpacing: 60,
            hookData: "0x",
            hooks: FLETHHooksAddress[this.chainId],
          },
          {
            intermediateCurrency: FLETHAddress[this.chainId],
            fee: 0,
            tickSpacing: 60,
            hooks: isV1Coin
              ? FlaunchPositionManagerAddress[this.chainId]
              : FlaunchPositionManagerV1_1Address[this.chainId],
            hookData: "0x",
          },
        ],
        exactCurrency: coinAddress,
        exactAmount: coinOut,
      },
    });

    return res.amountIn;
  }

  /**
   * Gets the current ETH/USDC price from the pool
   * @returns Promise<number> - The price of 1 ETH in USDC, formatted with 2 decimal places
   */
  async getETHUSDCPrice() {
    const amountIn = parseEther("1");

    const res = await this.contract.simulateWrite("quoteExactInput", {
      params: {
        exactAmount: amountIn,
        exactCurrency: zeroAddress,
        path: [
          {
            fee: USDCETHPoolKeys[this.chainId].fee,
            tickSpacing: USDCETHPoolKeys[this.chainId].tickSpacing,
            hooks: USDCETHPoolKeys[this.chainId].hooks,
            hookData: "0x",
            intermediateCurrency: USDCETHPoolKeys[this.chainId].currency1,
          },
        ],
      },
    });

    return Number(Number(formatUnits(res.amountOut, 6)).toFixed(2));
  }
}
