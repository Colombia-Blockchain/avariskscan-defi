/**
 * Integraciones con APIs DeFi para analisis profundo
 * - DeFiLlama: TVL, protocolos, yields
 * - Covalent: Holders, transacciones, balances
 * - Snowtrace: Contratos verificados, ABI
 */

// ---------- Cache simple con TTL ----------

class SimpleCache<T> {
  private cache = new Map<string, { data: T; expires: number }>();

  constructor(private ttlMs: number = 5 * 60 * 1000) {} // 5 min default

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, expires: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}

// ---------- Interfaces ----------

interface DeFiLlamaChain {
  name: string;
  tvl: number;
  tokenSymbol?: string;
  cmcId?: string;
}

interface DeFiLlamaProtocol {
  name: string;
  chain: string;
  chains?: string[];
  tvl: number;
  category?: string;
  chainTvls: Record<string, number>;
  change_1h?: number;
  change_1d?: number;
  change_7d?: number;
}

interface CovalentTokenHolder {
  address: string;
  balance: string;
  percentage: number;
}

interface SnowtraceContract {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string;
  Runs: string;
  ConstructorArguments: string;
  EVMVersion: string;
  Library: string;
  LicenseType: string;
  Proxy: string;
  Implementation: string;
  SwarmSource: string;
}

interface TokenDeepAnalysis {
  address: string;
  network: string;
  verified: boolean;
  holders: {
    count: number;
    top10: CovalentTokenHolder[];
  };
  contract?: {
    name: string;
    compiler: string;
    optimized: boolean;
    license: string;
    isProxy: boolean;
    implementation: string;
  };
  concentration?: {
    top10Percentage: number;
    riskLevel: "low" | "medium" | "high";
  };
}

interface ProtocolAnalysis {
  found: boolean;
  tvl: number;
  chain: string;
  changes: {
    "1h"?: number;
    "1d"?: number;
    "7d"?: number;
  };
  data: DeFiLlamaProtocol | null;
}

interface ProtocolSummary {
  name: string;
  tvl: number;
  category?: string;
}

// ---------- CoinGecko Interfaces ----------

interface CoinGeckoPrice {
  usd: number;
  usd_24h_change?: number;
}

interface CoinGeckoMarketChart {
  prices: [number, number][];
}

interface CoinGeckoSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string;
}

// ---------- DEX Screener Interfaces ----------

interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  volume: { h24: number };
  liquidity: { usd: number };
  fdv: number;
  pairCreatedAt: number;
}

interface DexScreenerResponse {
  pairs: DexPair[] | null;
}

// ---------- Glacier Interfaces ----------

interface GlacierErc20Balance {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceValue?: { currencyCode: string; value: number };
}

interface GlacierBlock {
  blockNumber: string;
  blockTimestamp: number;
  txCount: number;
}

interface AvalancheL1 {
  blockchainId: string;
  status: string;
  blockchainName?: string;
  vmId?: string;
  subnetId?: string;
  evmChainId?: number;
}

interface AvalancheSubnet {
  subnetId: string;
  isL1: boolean;
  createBlockTimestamp: number;
  blockchains: {
    blockchainId: string;
    blockchainName: string;
    vmId: string;
    subnetId: string;
    evmChainId?: number;
    createBlockTimestamp: number;
  }[];
  l1ValidatorManagerDetails?: {
    blockchainId: string;
    contractAddress: string;
  };
}

interface AvalancheDeFiProtocol {
  name: string;
  tvl: number;
  category: string;
  change1d?: number;
  change7d?: number;
  logo: string;
  url: string;
}

interface AvalancheMetrics {
  totalTVL: number;
  protocolCount: number;
  topProtocols: ProtocolSummary[];
}

// ---------- DeFiAPIs Class ----------

export class DeFiAPIs {
  private covalentKey: string;
  private snowtraceKey: string;

  // Caches con diferentes TTLs
  private tvlCache = new SimpleCache<number>(10 * 60 * 1000); // 10 min
  private protocolsCache = new SimpleCache<DeFiLlamaProtocol[]>(5 * 60 * 1000); // 5 min
  private contractCache = new SimpleCache<SnowtraceContract | null>(30 * 60 * 1000); // 30 min
  private holdersCache = new SimpleCache<CovalentTokenHolder[]>(5 * 60 * 1000); // 5 min
  private priceCache = new SimpleCache<CoinGeckoPrice>(2 * 60 * 1000); // 2 min
  private dexCache = new SimpleCache<DexPair[]>(2 * 60 * 1000); // 2 min
  private glacierCache = new SimpleCache<unknown>(3 * 60 * 1000); // 3 min

  constructor() {
    this.covalentKey = process.env.COVALENT_API_KEY || "";
    this.snowtraceKey = process.env.SNOWTRACE_API_KEY || "";
  }

  /**
   * DeFiLlama: Obtener TVL de un protocolo
   */
  async getProtocolTVL(protocolName: string): Promise<DeFiLlamaProtocol | null> {
    const cacheKey = `protocol:${protocolName.toLowerCase()}`;
    const cached = this.protocolsCache.get(cacheKey);
    if (cached && cached.length > 0) return cached[0];

    try {
      const response = await fetch(
        `https://api.llama.fi/protocol/${encodeURIComponent(protocolName.toLowerCase())}`,
        { signal: AbortSignal.timeout(15_000) }
      );

      if (!response.ok) {
        console.error(`DeFiLlama error: ${response.status}`);
        return null;
      }

      const data = await response.json() as DeFiLlamaProtocol;
      this.protocolsCache.set(cacheKey, [data]);
      return data;
    } catch (error) {
      console.error("Error fetching DeFiLlama data:", error);
      return null;
    }
  }

  /**
   * DeFiLlama: Obtener TVL de Avalanche
   */
  async getAvalancheTVL(): Promise<number> {
    const cached = this.tvlCache.get("avalanche-tvl");
    if (cached !== null) return cached;

    try {
      const response = await fetch("https://api.llama.fi/v2/chains", {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return 0;

      const chains = await response.json() as DeFiLlamaChain[];
      const avalanche = chains.find(
        (c) => c.name.toLowerCase() === "avalanche"
      );
      const tvl = avalanche?.tvl || 0;
      this.tvlCache.set("avalanche-tvl", tvl);
      return tvl;
    } catch (error) {
      console.error("Error fetching Avalanche TVL:", error);
      return 0;
    }
  }

  /**
   * DeFiLlama: Obtener protocolos en Avalanche
   */
  async getAvalancheProtocols(): Promise<DeFiLlamaProtocol[]> {
    const cached = this.protocolsCache.get("avalanche-protocols");
    if (cached) return cached;

    try {
      const response = await fetch("https://api.llama.fi/protocols", {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return [];

      const protocols = await response.json() as DeFiLlamaProtocol[];
      const avaxProtocols = protocols.filter((p) =>
        p.chains?.includes("Avalanche")
      );
      this.protocolsCache.set("avalanche-protocols", avaxProtocols);
      return avaxProtocols;
    } catch (error) {
      console.error("Error fetching Avalanche protocols:", error);
      return [];
    }
  }

  /**
   * Covalent: Obtener holders de un token
   */
  async getTokenHolders(
    tokenAddress: string,
    chainId: number = 43114
  ): Promise<CovalentTokenHolder[]> {
    if (!this.covalentKey) {
      console.warn("Covalent API key not configured");
      return [];
    }

    const cacheKey = `holders:${chainId}:${tokenAddress}`;
    const cached = this.holdersCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `https://api.covalenthq.com/v1/${chainId}/tokens/${tokenAddress}/token_holders/`,
        {
          headers: {
            Authorization: `Bearer ${this.covalentKey}`,
          },
          signal: AbortSignal.timeout(15_000),
        }
      );

      if (!response.ok) {
        console.error(`Covalent error: ${response.status}`);
        return [];
      }

      const data = await response.json() as { data?: { items?: CovalentTokenHolder[] } };
      const holders = data.data?.items || [];
      this.holdersCache.set(cacheKey, holders);
      return holders;
    } catch (error) {
      console.error("Error fetching Covalent data:", error);
      return [];
    }
  }

  /**
   * Snowtrace: Verificar si un contrato esta verificado
   */
  async getContractSource(
    address: string,
    network: "mainnet" | "fuji" = "mainnet"
  ): Promise<SnowtraceContract | null> {
    if (!this.snowtraceKey) {
      console.warn("Snowtrace API key not configured");
      return null;
    }

    const cacheKey = `contract:${network}:${address}`;
    const cached = this.contractCache.get(cacheKey);
    if (cached !== null) return cached;

    const baseUrl =
      network === "fuji"
        ? "https://api-testnet.snowtrace.io/api"
        : "https://api.snowtrace.io/api";

    try {
      const url = new URL(baseUrl);
      url.searchParams.set("module", "contract");
      url.searchParams.set("action", "getsourcecode");
      url.searchParams.set("address", address);
      url.searchParams.set("apikey", this.snowtraceKey);

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        console.error(`Snowtrace error: ${response.status}`);
        return null;
      }

      const data = await response.json() as { status: string; result?: SnowtraceContract[] };
      const contract = data.status === "1" && data.result?.[0] ? data.result[0] : null;
      this.contractCache.set(cacheKey, contract);
      return contract;
    } catch (error) {
      console.error("Error fetching Snowtrace data:", error);
      return null;
    }
  }

  /**
   * Analisis agregado de un token usando multiples APIs
   */
  async analyzeTokenDeep(
    tokenAddress: string,
    network: "mainnet" | "fuji" = "mainnet"
  ): Promise<TokenDeepAnalysis> {
    const chainId = network === "mainnet" ? 43114 : 43113;

    const [contractSource, holders] = await Promise.all([
      this.getContractSource(tokenAddress, network),
      this.getTokenHolders(tokenAddress, chainId),
    ]);

    const analysis: TokenDeepAnalysis = {
      address: tokenAddress,
      network,
      verified: !!contractSource?.SourceCode,
      holders: {
        count: holders.length,
        top10: holders.slice(0, 10),
      },
    };

    if (contractSource) {
      analysis.contract = {
        name: contractSource.ContractName,
        compiler: contractSource.CompilerVersion,
        optimized: contractSource.OptimizationUsed === "1",
        license: contractSource.LicenseType,
        isProxy: contractSource.Proxy === "1",
        implementation: contractSource.Implementation,
      };
    }

    // Calcular concentracion de holders
    if (holders.length > 0) {
      const top10Percentage = holders
        .slice(0, 10)
        .reduce((sum, h) => sum + (h.percentage ?? 0), 0);

      analysis.concentration = {
        top10Percentage,
        riskLevel:
          top10Percentage > 80
            ? "high"
            : top10Percentage > 50
            ? "medium"
            : "low",
      };
    }

    return analysis;
  }

  /**
   * Analisis de protocolo DeFi completo
   */
  async analyzeProtocol(protocolName: string): Promise<ProtocolAnalysis> {
    const [tvlData, avalancheProtocols] = await Promise.all([
      this.getProtocolTVL(protocolName),
      this.getAvalancheProtocols(),
    ]);

    const protocol = avalancheProtocols.find(
      (p) => p.name.toLowerCase() === protocolName.toLowerCase()
    ) || null;

    return {
      found: !!tvlData || !!protocol,
      tvl: tvlData?.tvl || protocol?.tvl || 0,
      chain: "Avalanche",
      changes: {
        "1h": tvlData?.change_1h,
        "1d": tvlData?.change_1d,
        "7d": tvlData?.change_7d,
      },
      data: tvlData || protocol,
    };
  }

  /**
   * Obtener metricas generales de Avalanche DeFi
   */
  async getAvalancheMetrics(): Promise<AvalancheMetrics> {
    const [tvl, protocols] = await Promise.all([
      this.getAvalancheTVL(),
      this.getAvalancheProtocols(),
    ]);

    const topProtocols = protocols
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 10);

    return {
      totalTVL: tvl,
      protocolCount: protocols.length,
      topProtocols: topProtocols.map((p) => ({
        name: p.name,
        tvl: p.tvl,
        category: p.category,
      })),
    };
  }

  // ========== CoinGecko API (gratis, 30 req/min) ==========

  /**
   * CoinGecko: Precio actual de un token por su ID
   */
  async getTokenPrice(tokenId: string): Promise<CoinGeckoPrice | null> {
    const cacheKey = `cg-price:${tokenId}`;
    const cached = this.priceCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(tokenId)}&vs_currencies=usd&include_24hr_change=true`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!response.ok) return null;

      const data = await response.json() as Record<string, { usd: number; usd_24h_change?: number }>;
      const token = data[tokenId];
      if (!token) return null;

      const price: CoinGeckoPrice = { usd: token.usd, usd_24h_change: token.usd_24h_change };
      this.priceCache.set(cacheKey, price);
      return price;
    } catch (error) {
      console.error("CoinGecko price error:", error);
      return null;
    }
  }

  /**
   * CoinGecko: Precio de AVAX
   */
  async getAvalanchePrice(): Promise<CoinGeckoPrice | null> {
    return this.getTokenPrice("avalanche-2");
  }

  /**
   * CoinGecko: Buscar tokens por nombre
   */
  async searchToken(query: string): Promise<CoinGeckoSearchResult[]> {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!response.ok) return [];

      const data = await response.json() as { coins?: CoinGeckoSearchResult[] };
      return (data.coins || []).slice(0, 10);
    } catch (error) {
      console.error("CoinGecko search error:", error);
      return [];
    }
  }

  // ========== DEX Screener API (gratis, sin key) ==========

  /**
   * DEX Screener: Pares de trading de un token
   */
  async getDexPairs(tokenAddress: string): Promise<DexPair[]> {
    const cacheKey = `dex-pairs:${tokenAddress}`;
    const cached = this.dexCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(tokenAddress)}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!response.ok) return [];

      const data = await response.json() as DexScreenerResponse;
      const pairs = (data.pairs || []).filter((p) => p.chainId === "avalanche");
      this.dexCache.set(cacheKey, pairs);
      return pairs;
    } catch (error) {
      console.error("DEX Screener pairs error:", error);
      return [];
    }
  }

  /**
   * DEX Screener: Buscar pares por nombre
   */
  async searchDexPairs(query: string): Promise<DexPair[]> {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!response.ok) return [];

      const data = await response.json() as DexScreenerResponse;
      return (data.pairs || []).filter((p) => p.chainId === "avalanche").slice(0, 20);
    } catch (error) {
      console.error("DEX Screener search error:", error);
      return [];
    }
  }

  // ========== Glacier / AvaCloud Data API (gratis) ==========

  /**
   * Glacier: Tokens ERC-20 de una wallet
   */
  async getWalletTokens(address: string): Promise<GlacierErc20Balance[]> {
    const cacheKey = `glacier-tokens:${address}`;
    const cached = this.glacierCache.get(cacheKey) as GlacierErc20Balance[] | null;
    if (cached) return cached;

    try {
      const response = await fetch(
        `https://glacier-api.avax.network/v1/chains/43114/addresses/${encodeURIComponent(address)}/balances:listErc20`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!response.ok) return [];

      const data = await response.json() as { erc20TokenBalances?: GlacierErc20Balance[] };
      const tokens = data.erc20TokenBalances || [];
      this.glacierCache.set(cacheKey, tokens);
      return tokens;
    } catch (error) {
      console.error("Glacier wallet tokens error:", error);
      return [];
    }
  }

  /**
   * Glacier: Listar TODAS las L1s (subnets) de Avalanche con paginación completa
   */
  async getAvalancheL1s(): Promise<AvalancheSubnet[]> {
    const cacheKey = "avalanche-subnets-all";
    const cached = this.glacierCache.get(cacheKey) as AvalancheSubnet[] | null;
    if (cached) return cached;

    try {
      const allSubnets: AvalancheSubnet[] = [];
      let pageToken: string | null = null;
      let pages = 0;
      const maxPages = 10; // Safety limit

      do {
        const url = new URL("https://glacier-api.avax.network/v1/networks/mainnet/subnets");
        url.searchParams.set("pageSize", "100");
        url.searchParams.set("sortOrder", "desc");
        if (pageToken) url.searchParams.set("pageToken", pageToken);

        const response = await fetch(url.toString(), {
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) break;

        const data = await response.json() as { subnets?: AvalancheSubnet[]; nextPageToken?: string };
        const subnets = data.subnets || [];
        allSubnets.push(...subnets);

        pageToken = data.nextPageToken || null;
        pages++;
      } while (pageToken && pages < maxPages);

      this.glacierCache.set(cacheKey, allSubnets);
      return allSubnets;
    } catch (error) {
      console.error("Glacier subnets error:", error);
      return [];
    }
  }

  /**
   * DefiLlama: Top protocolos DeFi solo en Avalanche con categorias
   */
  async getAvalancheDeFiProtocols(): Promise<AvalancheDeFiProtocol[]> {
    const cacheKey = "avax-defi-protocols";
    const cached = this.glacierCache.get(cacheKey) as AvalancheDeFiProtocol[] | null;
    if (cached) return cached;

    try {
      const response = await fetch("https://api.llama.fi/protocols", {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return [];

      const protocols = await response.json() as DeFiLlamaProtocol[];
      const excludeCategories = ["CEX", "Chain"];
      const avaxOnly = protocols
        .filter((p) => p.chains?.includes("Avalanche") && !excludeCategories.includes(p.category || ""))
        .sort((a, b) => (b.chainTvls?.["Avalanche"] || b.tvl || 0) - (a.chainTvls?.["Avalanche"] || a.tvl || 0))
        .slice(0, 50)
        .map((p) => ({
          name: p.name,
          tvl: p.chainTvls?.["Avalanche"] || p.tvl || 0,
          category: p.category || "Other",
          change1d: p.change_1d,
          change7d: p.change_7d,
          logo: `https://icons.llama.fi/icons/protocols/${p.name.toLowerCase().replace(/\s+/g, "-")}`,
          url: `https://defillama.com/protocol/${p.name.toLowerCase().replace(/\s+/g, "-")}`,
        }));

      this.glacierCache.set(cacheKey, avaxOnly);
      return avaxOnly;
    } catch (error) {
      console.error("Avalanche DeFi protocols error:", error);
      return [];
    }
  }

  /**
   * DEX Screener: Top pares de Avalanche (múltiples tokens principales)
   */
  async getAvalancheTopPairs(): Promise<DexPair[]> {
    const cacheKey = "avax-top-pairs";
    const cached = this.dexCache.get(cacheKey);
    if (cached) return cached;

    // Top Avalanche token addresses: WAVAX, USDC, USDT, JOE, sAVAX, BTC.b, WETH.e
    const topTokens = [
      "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX
      "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // USDC
      "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd", // JOE
      "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE", // sAVAX
    ];

    try {
      const allPairs: DexPair[] = [];
      const seen = new Set<string>();

      for (const token of topTokens) {
        try {
          const response = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${token}`,
            { signal: AbortSignal.timeout(10_000) }
          );
          if (!response.ok) continue;

          const data = await response.json() as DexScreenerResponse;
          const pairs = (data.pairs || []).filter((p) => p.chainId === "avalanche");
          for (const p of pairs) {
            if (!seen.has(p.pairAddress)) {
              seen.add(p.pairAddress);
              allPairs.push(p);
            }
          }
        } catch { /* skip failed token */ }
      }

      const sorted = allPairs
        .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
        .slice(0, 30);

      this.dexCache.set(cacheKey, sorted);
      return sorted;
    } catch (error) {
      console.error("DEX Screener top pairs error:", error);
      return [];
    }
  }

  /**
   * Glacier: Ultimos bloques de Avalanche C-Chain
   */
  async getLatestBlocks(): Promise<GlacierBlock[]> {
    const cacheKey = "glacier-blocks";
    const cached = this.glacierCache.get(cacheKey) as GlacierBlock[] | null;
    if (cached) return cached;

    try {
      const response = await fetch(
        "https://glacier-api.avax.network/v1/chains/43114/blocks",
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!response.ok) return [];

      const data = await response.json() as { blocks?: GlacierBlock[] };
      const blocks = (data.blocks || []).slice(0, 10);
      this.glacierCache.set(cacheKey, blocks);
      return blocks;
    } catch (error) {
      console.error("Glacier blocks error:", error);
      return [];
    }
  }
}

/**
 * Helper para formatear TVL en formato legible
 */
export function formatTVL(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(2)}K`;
  return `$${tvl.toFixed(2)}`;
}
