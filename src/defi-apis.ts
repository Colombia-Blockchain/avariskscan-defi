/**
 * Integraciones con APIs DeFi para análisis profundo
 * - DeFiLlama: TVL, protocolos, yields
 * - Covalent: Holders, transacciones, balances
 * - Snowtrace: Contratos verificados, ABI
 */

interface DeFiLlamaProtocol {
  name: string;
  chain: string;
  tvl: number;
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

export class DeFiAPIs {
  private covalentKey: string;
  private snowtraceKey: string;

  constructor() {
    this.covalentKey = process.env.COVALENT_API_KEY || "";
    this.snowtraceKey = process.env.SNOWTRACE_API_KEY || "";
  }

  /**
   * DeFiLlama: Obtener TVL de un protocolo
   */
  async getProtocolTVL(protocolName: string): Promise<DeFiLlamaProtocol | null> {
    try {
      const response = await fetch(
        `https://api.llama.fi/protocol/${protocolName.toLowerCase()}`
      );

      if (!response.ok) {
        console.error(`DeFiLlama error: ${response.status}`);
        return null;
      }

      const data = await response.json();
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
    try {
      const response = await fetch("https://api.llama.fi/v2/chains");
      if (!response.ok) return 0;

      const chains = await response.json();
      const avalanche = chains.find(
        (c: any) => c.name.toLowerCase() === "avalanche"
      );
      return avalanche?.tvl || 0;
    } catch (error) {
      console.error("Error fetching Avalanche TVL:", error);
      return 0;
    }
  }

  /**
   * DeFiLlama: Obtener protocolos en Avalanche
   */
  async getAvalancheProtocols(): Promise<any[]> {
    try {
      const response = await fetch("https://api.llama.fi/protocols");
      if (!response.ok) return [];

      const protocols = await response.json();
      return protocols.filter((p: any) =>
        p.chains?.includes("Avalanche")
      );
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

    try {
      const response = await fetch(
        `https://api.covalenthq.com/v1/${chainId}/tokens/${tokenAddress}/token_holders/`,
        {
          headers: {
            Authorization: `Bearer ${this.covalentKey}`,
          },
        }
      );

      if (!response.ok) {
        console.error(`Covalent error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data.data?.items || [];
    } catch (error) {
      console.error("Error fetching Covalent data:", error);
      return [];
    }
  }

  /**
   * Snowtrace: Verificar si un contrato está verificado
   */
  async getContractSource(
    address: string,
    network: "mainnet" | "fuji" = "mainnet"
  ): Promise<SnowtraceContract | null> {
    if (!this.snowtraceKey) {
      console.warn("Snowtrace API key not configured");
      return null;
    }

    const baseUrl =
      network === "fuji"
        ? "https://api-testnet.snowtrace.io/api"
        : "https://api.snowtrace.io/api";

    try {
      const response = await fetch(
        `${baseUrl}?module=contract&action=getsourcecode&address=${address}&apikey=${this.snowtraceKey}`
      );

      if (!response.ok) {
        console.error(`Snowtrace error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (data.status === "1" && data.result?.[0]) {
        return data.result[0];
      }
      return null;
    } catch (error) {
      console.error("Error fetching Snowtrace data:", error);
      return null;
    }
  }

  /**
   * Análisis agregado de un token usando múltiples APIs
   */
  async analyzeTokenDeep(tokenAddress: string, network: "mainnet" | "fuji" = "mainnet") {
    const chainId = network === "mainnet" ? 43114 : 43113;

    const [contractSource, holders] = await Promise.all([
      this.getContractSource(tokenAddress, network),
      this.getTokenHolders(tokenAddress, chainId),
    ]);

    const analysis: any = {
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

    // Calcular concentración de holders
    if (holders.length > 0) {
      const top10Percentage = holders
        .slice(0, 10)
        .reduce((sum, h) => sum + (h.percentage || 0), 0);

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
   * Análisis de protocolo DeFi completo
   */
  async analyzeProtocol(protocolName: string) {
    const [tvlData, avalancheProtocols] = await Promise.all([
      this.getProtocolTVL(protocolName),
      this.getAvalancheProtocols(),
    ]);

    const protocol = avalancheProtocols.find(
      (p) => p.name.toLowerCase() === protocolName.toLowerCase()
    );

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
   * Obtener métricas generales de Avalanche DeFi
   */
  async getAvalancheMetrics() {
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
