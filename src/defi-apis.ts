/**
 * Integraciones con APIs DeFi gratuitas para Avalanche
 * - DeFiLlama: TVL, protocolos
 * - CoinGecko: Precios
 * - DEX Screener: Trading pairs
 * - Glacier: L1s, subnets
 */

// ---------- Cache simple con TTL ----------

class SimpleCache<T> {
  private cache = new Map<string, { data: T; expires: number }>();

  constructor(private ttlMs: number = 5 * 60 * 1000) {
    // Periodic cleanup every 5 minutes to prevent memory leaks
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

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

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expires) this.cache.delete(key);
    }
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

interface ProtocolSummary {
  name: string;
  tvl: number;
  category?: string;
}

interface CoinGeckoPrice {
  usd: number;
  usd_24h_change?: number;
}

interface CoinGeckoSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string;
}

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
  private tvlCache = new SimpleCache<number>(10 * 60 * 1000);
  private protocolsCache = new SimpleCache<DeFiLlamaProtocol[]>(5 * 60 * 1000);
  private priceCache = new SimpleCache<CoinGeckoPrice>(2 * 60 * 1000);
  private dexCache = new SimpleCache<DexPair[]>(2 * 60 * 1000);
  private glacierCache = new SimpleCache<unknown>(3 * 60 * 1000);

  // ========== DeFiLlama API ==========

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

  async getAvalancheMetrics(): Promise<AvalancheMetrics> {
    const [tvl, protocols] = await Promise.all([
      this.getAvalancheTVL(),
      this.getAvalancheProtocols(),
    ]);

    const excludeCategories = ["CEX", "Chain"];
    const topProtocols = protocols
      .filter((p) => !excludeCategories.includes(p.category || ""))
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

  // ========== CoinGecko API (gratis, 30 req/min) ==========

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

  async getAvalanchePrice(): Promise<CoinGeckoPrice | null> {
    return this.getTokenPrice("avalanche-2");
  }

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

  async getAvalancheTopPairs(): Promise<DexPair[]> {
    const cacheKey = "avax-top-pairs";
    const cached = this.dexCache.get(cacheKey);
    if (cached) return cached;

    const topTokens = [
      "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX
      "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // USDC
      "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd", // JOE
      "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE", // sAVAX
    ];

    try {
      const results = await Promise.allSettled(
        topTokens.map((token) =>
          fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`, {
            signal: AbortSignal.timeout(10_000),
          }).then((r) => r.ok ? r.json() as Promise<DexScreenerResponse> : { pairs: null })
        )
      );

      const allPairs: DexPair[] = [];
      const seen = new Set<string>();

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const pairs = (result.value.pairs || []).filter((p) => p.chainId === "avalanche");
        for (const p of pairs) {
          if (!seen.has(p.pairAddress)) {
            seen.add(p.pairAddress);
            allPairs.push(p);
          }
        }
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

  // ========== Glacier / AvaCloud Data API (gratis) ==========

  async getAvalancheL1s(): Promise<AvalancheSubnet[]> {
    const cacheKey = "avalanche-subnets-all";
    const cached = this.glacierCache.get(cacheKey) as AvalancheSubnet[] | null;
    if (cached) return cached;

    try {
      const allSubnets: AvalancheSubnet[] = [];
      let pageToken: string | null = null;
      let pages = 0;
      const maxPages = 10;

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
