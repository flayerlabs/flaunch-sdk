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
import { UniversalRouterAbi } from "../abi/UniversalRouter";
import { QuoterAbi } from "../abi/Quoter";
import { zeroAddress } from "viem";
import {
  FairLaunchAddress,
  FlaunchPositionManagerAddress,
  FLETHAddress,
  FLETHHooksAddress,
} from "addresses";

export type QuoterABI = typeof QuoterAbi;

export class ReadQuoter {
  chainId: number;
  contract: ReadContract<QuoterABI>;

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

  async getSellQuoteExactInput(coinAddress: Address, amountIn: bigint) {
    const res = await this.contract.simulateWrite("quoteExactInput", {
      params: {
        exactAmount: amountIn,
        exactCurrency: coinAddress,
        path: [
          {
            fee: 0,
            tickSpacing: 60,
            hooks: FlaunchPositionManagerAddress[this.chainId],
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

  async getBuyQuoteExactInput(coinAddress: Address, ethIn: bigint) {
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
            hooks: FlaunchPositionManagerAddress[this.chainId],
            hookData: "0x",
            intermediateCurrency: coinAddress,
          },
        ],
      },
    });

    return res.amountOut;
  }

  async getBuyQuoteExactOutput(coinAddress: Address, coinOut: bigint) {
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
            hooks: FlaunchPositionManagerAddress[this.chainId],
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
