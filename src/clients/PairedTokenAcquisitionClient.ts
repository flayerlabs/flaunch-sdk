import { type Address, type Drift, createDrift } from "@delvtech/drift";
import { zeroAddress } from "viem";
import {
  PairedTokenAcquisitionDexAddress,
  PairedTokenRegistryV1_3Address,
  type PairedTokenAcquisitionDex,
} from "../addresses";
import { ReadPairedTokenRegistryV1_3 } from "./PairedTokenRegistryV1_3Client";
import {
  acquisitionPoolAbi,
  clSpotAmountOut,
  encodeAcquisitionExactInputPath,
  TwoHopPriceCalculatorAbi,
  UniswapV3FactoryAbi,
  UniswapV3QuoterV2Abi,
  type PairedTokenAcquisitionInput,
  type PairedTokenAcquisitionRoute,
} from "../utils/pairedTokenAcquisition";

export interface PairedTokenAcquisitionQuote {
  route: PairedTokenAcquisitionRoute;
  /** Expected paired-token output for the exact input, before any slippage haircut. */
  expectedOut: bigint;
  /** How the number was produced — a depth-aware quoter, or the calculator pool's single-tick spot. */
  source: "quoter" | "spot";
}

/**
 * Pools come and go slowly, but they DO come (a new fee tier gets seeded) — so the venue set is
 * cached briefly rather than for the session.
 */
const VENUE_TTL_MS = 5 * 60_000;

/**
 * Reads for buying a non-ETH paired token from ETH or the chain's USD hub. Route resolution comes
 * from live protocol config rather than a table: the registry's `tokenConfig(token).priceCalculator`
 * already binds the exact pool the launch pricing reads (`hubPairedPool`), so a newly registered
 * equity routes with no SDK change. On a chain with a `QuoterV2`, every existing pool for the token
 * is quoted and the best output wins.
 */
export class ReadPairedTokenAcquisition {
  public readonly chainId: number;
  public readonly dex: PairedTokenAcquisitionDex;
  private readonly drift: Drift;
  private readonly registry: ReadPairedTokenRegistryV1_3;
  private readonly routes = new Map<string, PairedTokenAcquisitionRoute>();
  private readonly venues = new Map<string, { venues: PairedTokenAcquisitionRoute[]; expiresAt: number }>();

  constructor(chainId: number, drift: Drift = createDrift()) {
    const dex = PairedTokenAcquisitionDexAddress[chainId];
    const registry = PairedTokenRegistryV1_3Address[chainId];
    if (!dex || !registry) {
      throw new Error(`Paired-token acquisition is not supported on chain ${chainId}`);
    }
    this.chainId = chainId;
    this.dex = dex;
    this.drift = drift;
    this.registry = new ReadPairedTokenRegistryV1_3(registry, drift);
  }

  private pool(address: Address) {
    return this.drift.contract({ abi: acquisitionPoolAbi(this.dex), address });
  }

  /**
   * The calculator-bound hub pool for a paired token. Everything resolved here is immutable on
   * chain, so it caches for the session; a failed resolution is not cached.
   */
  async resolveRoute(pairedToken: Address): Promise<PairedTokenAcquisitionRoute> {
    const key = pairedToken.toLowerCase();
    const cached = this.routes.get(key);
    if (cached) return cached;

    const config = await this.registry.tokenConfig(pairedToken);
    if (config.priceCalculator === zeroAddress) {
      throw new Error("This pairing has no registered price calculator to route through");
    }
    const calculator = this.drift.contract({ abi: TwoHopPriceCalculatorAbi, address: config.priceCalculator });
    const [pool, hubToken] = await Promise.all([
      calculator.read("hubPairedPool", {}),
      calculator.read("hubToken", {}),
    ]);
    // The route swaps through the chain's USD hub; a calculator quoting through any other hub would
    // make the encoded path wrong, so refuse rather than misroute.
    if (hubToken.toLowerCase() !== this.dex.hubToken.toLowerCase()) {
      throw new Error("This pairing does not quote through the USD hub token and cannot be routed");
    }
    const [poolKey, token0] = await Promise.all([
      this.dex.flavor === "slipstream"
        ? this.drift.contract({ abi: acquisitionPoolAbi(this.dex), address: pool }).read("tickSpacing", {})
        : this.pool(pool).read("fee", {}),
      this.pool(pool).read("token0", {}),
    ]);
    const route: PairedTokenAcquisitionRoute = {
      pool,
      poolKey: Number(poolKey),
      payingIsToken0: token0.toLowerCase() === this.dex.hubToken.toLowerCase(),
    };
    this.routes.set(key, route);
    return route;
  }

  private async poolPrice(pool: Address): Promise<{ sqrtPriceX96: bigint; fee: bigint }> {
    const [slot0, fee] = await Promise.all([this.pool(pool).read("slot0", {}), this.pool(pool).read("fee", {})]);
    return { sqrtPriceX96: slot0.sqrtPriceX96, fee: BigInt(fee) };
  }

  /** Every existing pool the token can be bought through on the chain's V3 factory (uniswapV3 only). */
  private async enumerateVenues(
    pairedToken: Address,
    input: PairedTokenAcquisitionInput
  ): Promise<PairedTokenAcquisitionRoute[]> {
    const venues = this.dex.venues;
    if (!venues) return [];
    const key = `${pairedToken.toLowerCase()}:${input}`;
    const cached = this.venues.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.venues;

    const factory = this.drift.contract({ abi: UniswapV3FactoryAbi, address: venues.factory });
    const probes = [
      ...venues.feeTiers.map((fee) => ({ other: this.dex.hubToken, fee, direct: false })),
      // Only an ETH input can take a WETH:token pool — a hub-token buy has no ETH to put in.
      ...(input === "eth" ? venues.feeTiers.map((fee) => ({ other: this.dex.weth, fee, direct: true })) : []),
    ];
    const pools = await Promise.all(
      probes.map((probe) => factory.read("getPool", { tokenA: probe.other, tokenB: pairedToken, fee: probe.fee }))
    );
    const found: PairedTokenAcquisitionRoute[] = [];
    probes.forEach((probe, i) => {
      const pool = pools[i];
      if (!pool || pool === zeroAddress) return;
      found.push({
        pool,
        poolKey: probe.fee,
        // token0 is the lower address; the leg is zeroForOne when the paying side leads
        payingIsToken0: BigInt(probe.other) < BigInt(pairedToken),
        direct: probe.direct,
      });
    });
    this.venues.set(key, { venues: found, expiresAt: Date.now() + VENUE_TTL_MS });
    return found;
  }

  /** Spot output through a HUB route: ETH takes the WETH:hub hop first. */
  async quoteSpot(
    pairedToken: Address,
    route: PairedTokenAcquisitionRoute,
    input: PairedTokenAcquisitionInput,
    amountIn: bigint
  ): Promise<bigint> {
    if (route.direct) {
      // A direct route pays WETH into the token pool with no hub leg; this pricing walks
      // ETH -> hub -> token and would mis-price it. Direct routes only ever come from QuoterV2
      // discovery, which prices them itself.
      throw new Error("quoteSpot prices hub routes only; quote a direct route through the venue quoter");
    }
    let hubAmount = amountIn;
    if (input === "eth") {
      const [{ sqrtPriceX96, fee }, token0] = await Promise.all([
        this.poolPrice(this.dex.wethHubPool),
        this.pool(this.dex.wethHubPool).read("token0", {}),
      ]);
      hubAmount = clSpotAmountOut(amountIn, sqrtPriceX96, fee, token0.toLowerCase() === this.dex.weth.toLowerCase());
    }
    const { sqrtPriceX96, fee } = await this.poolPrice(route.pool);
    return clSpotAmountOut(hubAmount, sqrtPriceX96, fee, route.payingIsToken0);
  }

  /**
   * Picks the venue and expected output for buying the paired token with an exact input. With a
   * QuoterV2 every existing pool is quoted depth-aware and the best output wins; otherwise (Slipstream,
   * no quoter, quoter failure) the registry calculator's pool is priced at its single-tick spot.
   */
  async quote(
    pairedToken: Address,
    input: PairedTokenAcquisitionInput,
    amountIn: bigint
  ): Promise<PairedTokenAcquisitionQuote> {
    const quoter = this.dex.venues?.quoterV2;
    if (quoter) {
      try {
        const venues = await this.enumerateVenues(pairedToken, input);
        const quotes = await Promise.all(
          venues.map(async (route) => {
            try {
              const res = await this.drift
                .contract({ abi: UniswapV3QuoterV2Abi, address: quoter })
                .simulateWrite("quoteExactInput", {
                  path: encodeAcquisitionExactInputPath(this.dex, pairedToken, route, input),
                  amountIn,
                });
              return { route, amountOut: res.amountOut };
            } catch {
              // A pool with no liquidity in range simply cannot quote — not a candidate, not an error.
              return null;
            }
          })
        );
        const best = quotes
          .filter((q): q is { route: PairedTokenAcquisitionRoute; amountOut: bigint } => !!q && q.amountOut > 0n)
          .sort((a, b) => (a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0))[0];
        if (best) return { route: best.route, expectedOut: best.amountOut, source: "quoter" };
      } catch {
        // Discovery itself failed (RPC) — fall through to the calculator pool
      }
    }
    const route = await this.resolveRoute(pairedToken);
    const expectedOut = await this.quoteSpot(pairedToken, route, input, amountIn);
    return { route, expectedOut, source: "spot" };
  }
}
