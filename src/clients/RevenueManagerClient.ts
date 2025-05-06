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
import { RevenueManagerAbi } from "../abi/RevenueManager";
import { ReadMulticall } from "./MulticallClient";

export type RevenueManagerABI = typeof RevenueManagerAbi;

export class ReadRevenueManager {
  drift: Drift;
  public readonly contract: ReadContract<RevenueManagerABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    this.drift = drift;
    this.contract = drift.contract({
      abi: RevenueManagerAbi,
      address,
    });
  }

  /**
   * Gets the claimable balance of ETH for the recipient
   * @param recipient - The address of the recipient to check
   * @returns Promise<bigint> - The claimable balance of ETH
   */
  balances(address: Address) {
    return this.contract.read("balances", {
      _recipient: address,
    });
  }

  /**
   * Gets the protocol recipient address
   * @returns Promise<Address> - The protocol recipient address
   */
  protocolRecipient() {
    return this.contract.read("protocolRecipient");
  }

  /**
   * Gets the total number of tokens managed by the revenue manager
   * @returns Promise<bigint> - The total count of tokens
   */
  async tokensCount() {
    const nextInternalId = await this.contract.read("nextInternalId");
    return nextInternalId - 1n;
  }

  /**
   * Gets all tokens created by a specific creator address
   * @param creator - The address of the creator to query tokens for
   * @param sortByDesc - Optional boolean to sort tokens in descending order (default: false)
   * @returns Promise<Array<{flaunch: Address, tokenId: bigint}>> - Array of token objects containing flaunch address and token ID
   */
  async allTokensByCreator(creator: Address, sortByDesc: boolean = false) {
    const tokens = await this.contract.read("tokens", {
      _creator: creator,
    });

    if (sortByDesc) {
      return [...tokens].reverse();
    }

    return tokens;
  }

  /**
   * Gets all tokens currently managed by the revenue manager contract
   * @dev Uses multicall to batch requests for better performance
   * @param sortByDesc - Optional boolean to sort tokens in descending order (default: false)
   * @returns Promise<Array<{flaunch: Address, tokenId: bigint}>> - Array of token objects containing flaunch address and token ID
   */
  async allTokensInManager(sortByDesc: boolean = false) {
    const count = await this.tokensCount();
    const multicall = new ReadMulticall(this.drift);

    let calldatas = Array.from({ length: Number(count) }, (_, i) =>
      this.contract.encodeFunctionData("internalIds", {
        _internalId: BigInt(i + 1),
      })
    );

    // Reverse the array if sortByDesc is true
    if (sortByDesc) {
      calldatas = calldatas.reverse();
    }

    const result = await multicall.aggregate3(
      calldatas.map((calldata) => ({
        target: this.contract.address,
        callData: calldata,
      }))
    );

    return result.map((r) =>
      this.contract.decodeFunctionReturn("internalIds", r.returnData)
    );
  }
}

export class ReadWriteRevenueManager extends ReadRevenueManager {
  declare contract: ReadWriteContract<RevenueManagerABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  /**
   * Allows the protocol recipient to claim the protocol's share of the revenue
   * @returns Promise<TransactionResponse> - The transaction response
   */
  protocolClaim() {
    return this.contract.write("claim", {});
  }

  /**
   * Allows the creator to claim their total share of the revenue from a revenue manager
   * @returns Promise<TransactionResponse> - The transaction response
   */
  creatorClaim() {
    return this.contract.write("claim", {});
  }

  /**
   * Allows the creator to claim their share of the revenue from specific flaunch tokens
   * @param flaunchTokens - The flaunch token ids to claim the revenue for
   * @returns Promise<TransactionResponse> - The transaction response
   */
  creatorClaimForTokens(
    flaunchTokens: { flaunch: Address; tokenId: bigint }[]
  ) {
    return this.contract.write("claim", {
      _flaunchToken: flaunchTokens,
    });
  }
}
