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
import { FLETHAddress, FLETHHooksAddress, USDCETHPoolKeys } from "addresses";
import { PoolWithHookData } from "types";

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
   * Gets a quote for selling an exact amount of tokens for ETH or outputToken
   * @param coinAddress - The address of the token to sell
   * @param amountIn - The exact amount of tokens to sell
   * @param positionManagerAddress - The address of the position manager to use
   * @param intermediatePoolKey - Optional intermediate pool key to use containing outputToken and ETH as currencies
   * @returns Promise<bigint> - The expected amount of ETH to receive
   */
  async getSellQuoteExactInput({
    coinAddress,
    amountIn,
    positionManagerAddress,
    intermediatePoolKey,
  }: {
    coinAddress: Address;
    amountIn: bigint;
    positionManagerAddress: Address;
    intermediatePoolKey?: PoolWithHookData;
  }) {
    if (intermediatePoolKey) {
      // verify that ETH exists in the intermediate pool key
      if (
        intermediatePoolKey.currency0 !== zeroAddress &&
        intermediatePoolKey.currency1 !== zeroAddress
      ) {
        throw new Error(
          "ETH must be one of the currencies in the intermediatePoolKey"
        );
      }

      const outputToken =
        intermediatePoolKey.currency0 === zeroAddress
          ? intermediatePoolKey.currency1
          : intermediatePoolKey.currency0;

      const res = await this.contract.simulateWrite("quoteExactInput", {
        params: {
          exactAmount: amountIn,
          exactCurrency: coinAddress,
          path: [
            {
              fee: 0,
              tickSpacing: 60,
              hooks: positionManagerAddress,
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
            {
              fee: intermediatePoolKey.fee,
              tickSpacing: intermediatePoolKey.tickSpacing,
              hooks: intermediatePoolKey.hooks,
              hookData: intermediatePoolKey.hookData,
              intermediateCurrency: outputToken,
            },
          ],
        },
      });

      return res.amountOut;
    } else {
      const res = await this.contract.simulateWrite("quoteExactInput", {
        params: {
          exactAmount: amountIn,
          exactCurrency: coinAddress,
          path: [
            {
              fee: 0,
              tickSpacing: 60,
              hooks: positionManagerAddress,
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
  }

  /**
   * Gets a quote for buying tokens with an exact amount of ETH or inputToken
   * @param coinAddress - The address of the token to buy
   * @param amountIn - The exact amount of ETH or inputToken to spend
   * @param positionManagerAddress - The address of the position manager to use
   * @param intermediatePoolKey - Optional intermediate pool key to use containing inputToken and ETH as currencies
   * @returns Promise<bigint> - The expected amount of coins to receive
   */
  async getBuyQuoteExactInput({
    coinAddress,
    amountIn,
    positionManagerAddress,
    intermediatePoolKey,
  }: {
    coinAddress: Address;
    amountIn: bigint;
    positionManagerAddress: Address;
    intermediatePoolKey?: PoolWithHookData;
  }) {
    if (intermediatePoolKey) {
      // verify that ETH exists in the intermediate pool key
      if (
        intermediatePoolKey.currency0 !== zeroAddress &&
        intermediatePoolKey.currency1 !== zeroAddress
      ) {
        throw new Error(
          "ETH must be one of the currencies in the intermediatePoolKey"
        );
      }

      const inputToken =
        intermediatePoolKey.currency0 === zeroAddress
          ? intermediatePoolKey.currency1
          : intermediatePoolKey.currency0;

      const res = await this.contract.simulateWrite("quoteExactInput", {
        params: {
          exactAmount: amountIn,
          exactCurrency: inputToken,
          path: [
            {
              fee: intermediatePoolKey.fee,
              tickSpacing: intermediatePoolKey.tickSpacing,
              hooks: intermediatePoolKey.hooks,
              hookData: intermediatePoolKey.hookData,
              intermediateCurrency: zeroAddress,
            },
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
              hooks: positionManagerAddress,
              hookData: "0x",
              intermediateCurrency: coinAddress,
            },
          ],
        },
      });

      return res.amountOut;
    } else {
      const res = await this.contract.simulateWrite("quoteExactInput", {
        params: {
          exactAmount: amountIn,
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
              hooks: positionManagerAddress,
              hookData: "0x",
              intermediateCurrency: coinAddress,
            },
          ],
        },
      });

      return res.amountOut;
    }
  }

  /**
   * Gets a quote for buying an exact amount of tokens with ETH or inputToken
   * @param coinAddress - The address of the token to buy
   * @param coinOut - The exact amount of tokens to receive
   * @param positionManagerAddress - The address of the position manager to use
   * @param intermediatePoolKey - Optional intermediate pool key to use containing inputToken and ETH as currencies
   * @returns Promise<bigint> - The required amount of ETH or inputToken to spend
   */
  async getBuyQuoteExactOutput({
    coinAddress,
    coinOut,
    positionManagerAddress,
    intermediatePoolKey,
  }: {
    coinAddress: Address;
    coinOut: bigint;
    positionManagerAddress: Address;
    intermediatePoolKey?: PoolWithHookData;
  }) {
    if (intermediatePoolKey) {
      // verify that ETH exists in the intermediate pool key
      if (
        intermediatePoolKey.currency0 !== zeroAddress &&
        intermediatePoolKey.currency1 !== zeroAddress
      ) {
        throw new Error(
          "ETH must be one of the currencies in the intermediatePoolKey"
        );
      }

      const inputToken =
        intermediatePoolKey.currency0 === zeroAddress
          ? intermediatePoolKey.currency1
          : intermediatePoolKey.currency0;

      const res = await this.contract.simulateWrite("quoteExactOutput", {
        params: {
          path: [
            {
              intermediateCurrency: inputToken,
              fee: intermediatePoolKey.fee,
              tickSpacing: intermediatePoolKey.tickSpacing,
              hookData: intermediatePoolKey.hookData,
              hooks: intermediatePoolKey.hooks,
            },
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
              hooks: positionManagerAddress,
              hookData: "0x",
            },
          ],
          exactCurrency: coinAddress,
          exactAmount: coinOut,
        },
      });

      return res.amountIn;
    } else {
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
              hooks: positionManagerAddress,
              hookData: "0x",
            },
          ],
          exactCurrency: coinAddress,
          exactAmount: coinOut,
        },
      });

      return res.amountIn;
    }
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
