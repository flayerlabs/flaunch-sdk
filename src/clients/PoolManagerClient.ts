import {
  type Contract,
  type ReadContract,
  type Address,
  type Drift,
  type EventLog,
  type ReadWriteContract,
  type ReadWriteAdapter,
  type HexString,
  createDrift,
} from "@delvtech/drift";
import { keccak256, encodePacked, stringToHex, pad, hexToBigInt } from "viem";
import { bytes32ToUint256, uint256ToBytes32 } from "../helpers/hex";
import { PoolManagerAbi } from "../abi/PoolManager";

export type PoolManagerABI = typeof PoolManagerAbi;

export interface PositionInfoParams {
  poolId: HexString;
  owner: Address;
  tickLower: number;
  tickUpper: number;
  salt: string;
}

export class ReadPoolManager {
  public readonly contract: ReadContract<PoolManagerABI>;

  constructor(address: Address, drift: Drift = createDrift()) {
    if (!address) {
      throw new Error("Address is required");
    }

    this.contract = drift.contract({
      abi: PoolManagerAbi,
      address,
    });
  }

  poolStateSlot({ poolId }: { poolId: HexString }) {
    const POOLS_SLOT = uint256ToBytes32(6n);

    return keccak256(
      encodePacked(["bytes32", "bytes32"], [poolId, POOLS_SLOT])
    );
  }

  async poolSlot0({ poolId }: { poolId: HexString }) {
    const stateSlot = this.poolStateSlot({ poolId });

    let res = { sqrtPriceX96: 0n, tick: 0, protocolFee: 0, lpFee: 0 };

    try {
      const result = await this.contract.read("extsload", {
        slot: stateSlot,
      });

      const data = (Array.isArray(result) ? result[0] : result) as HexString;

      // Convert the input hex to a BigInt for bitwise operations
      const dataAsBigInt = BigInt(data);

      // Extract sqrtPriceX96 (bottom 160 bits)
      const sqrtPriceX96Mask = BigInt(
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
      );
      const sqrtPriceX96 = dataAsBigInt & sqrtPriceX96Mask;

      // Extract tick (next 24 bits after sqrtPriceX96)
      // First, shift right by 160 bits to get the tick bits at the bottom
      const tickShifted = dataAsBigInt >> 160n;
      // Then mask to get only the 24 bits we want
      const tickMask = BigInt("0xFFFFFF");
      const tickRaw = Number(tickShifted & tickMask);
      // Sign extend the 24-bit number if needed
      const tick = tickRaw > 0x7fffff ? tickRaw - 0x1000000 : tickRaw;

      // Extract protocolFee (next 24 bits)
      const protocolFeeShifted = dataAsBigInt >> 184n;
      const protocolFeeMask = BigInt("0xFFFFFF");
      const protocolFee = Number(protocolFeeShifted & protocolFeeMask);

      // Extract lpFee (last 24 bits)
      const lpFeeShifted = dataAsBigInt >> 208n;
      const lpFeeMask = BigInt("0xFFFFFF");
      const lpFee = Number(lpFeeShifted & lpFeeMask);

      res = { sqrtPriceX96, tick, protocolFee, lpFee };
    } catch (error) {
      console.error(error);
    }

    return res;
  }

  async positionInfo({
    poolId,
    owner,
    tickLower,
    tickUpper,
    salt,
  }: PositionInfoParams): Promise<{
    liquidity: bigint;
    feeGrowthInside0LastX128: bigint;
    feeGrowthInside1LastX128: bigint;
  }> {
    const saltBytes32 = pad(stringToHex(salt), { size: 32, dir: "right" });

    const positionKey = keccak256(
      encodePacked(
        ["address", "int24", "int24", "bytes32"],
        [owner, tickLower, tickUpper, saltBytes32]
      )
    );

    const stateSlot = this.poolStateSlot({ poolId });

    const POSITIONS_OFFSET = 6n;
    const positionMapping = uint256ToBytes32(
      bytes32ToUint256(stateSlot) + POSITIONS_OFFSET
    );

    const positionInfoSlot = keccak256(
      encodePacked(["bytes32", "bytes32"], [positionKey, positionMapping])
    );

    const data = (await this.contract.read("extsload", {
      startSlot: positionInfoSlot,
      nSlots: 3n,
    })) as HexString[];

    // FIXME: data returned is not an array
    console.log({ data });

    const liquidity = hexToBigInt(data[0]);
    const feeGrowthInside0LastX128 = hexToBigInt(data[1]);
    const feeGrowthInside1LastX128 = hexToBigInt(data[2]);

    return {
      liquidity,
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
    };
  }

  async getStateSlot(stateSlot: HexString): Promise<HexString> {
    const result = await this.contract.read("extsload", {
      slot: stateSlot,
    });
    // Cast through unknown first to avoid type checking issues
    const firstResult = Array.isArray(result) ? result[0] : result;
    return firstResult as unknown as HexString;
  }
}
