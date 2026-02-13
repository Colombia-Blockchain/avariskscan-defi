import Anthropic from "@anthropic-ai/sdk";
import { ethers } from "ethers";

// Configuración
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const RPC_URL =
  process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc";

// ABIs simplificados para análisis
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function totalSupply() view returns (uint256)",
];

export interface RiskAnalysisRequest {
  type: "contract" | "token" | "pool" | "protocol";
  address: string;
  network?: "fuji" | "mainnet";
  dex?: "traderjoe" | "pangolin" | "uniswap";
}

export interface RiskAnalysisResult {
  risk_score: number; // 0-100 (0 = seguro, 100 = muy riesgoso)
  risk_level: "low" | "medium" | "high" | "critical";
  findings: string[];
  recommendations: string[];
  analysis: string;
  metadata?: Record<string, any>;
}

export class DeFiRiskAnalyzer {
  private anthropic: Anthropic | null = null;
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    if (ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    }
  }

  /**
   * Análisis principal de riesgo DeFi
   */
  async analyzeRisk(request: RiskAnalysisRequest): Promise<RiskAnalysisResult> {
    try {
      switch (request.type) {
        case "token":
          return await this.analyzeToken(request.address);
        case "pool":
          return await this.analyzePool(request.address, request.dex);
        case "contract":
          return await this.analyzeContract(request.address);
        case "protocol":
          return await this.analyzeProtocol(request.address);
        default:
          throw new Error(`Tipo de análisis no soportado: ${request.type}`);
      }
    } catch (error) {
      console.error("Error en análisis de riesgo:", error);
      return {
        risk_score: 100,
        risk_level: "critical",
        findings: [`Error al analizar: ${error instanceof Error ? error.message : "Unknown error"}`],
        recommendations: ["No se pudo completar el análisis. Verificar manualmente."],
        analysis: "Análisis fallido",
      };
    }
  }

  /**
   * Análisis de token ERC-20
   */
  private async analyzeToken(address: string): Promise<RiskAnalysisResult> {
    const findings: string[] = [];
    let riskScore = 0;

    try {
      const contract = new ethers.Contract(address, ERC20_ABI, this.provider);

      // Información básica del token
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.totalSupply(),
      ]);

      findings.push(`Token: ${name} (${symbol})`);
      findings.push(`Decimales: ${decimals}`);
      findings.push(`Supply total: ${ethers.formatUnits(totalSupply, decimals)}`);

      // Verificar código del contrato
      const code = await this.provider.getCode(address);
      if (code === "0x") {
        findings.push("⚠️ CRÍTICO: No hay código en esta dirección");
        riskScore += 50;
      }

      // Análisis de concentración (top holder)
      const topHolders = await this.getTopHolders(address);
      if (topHolders.length > 0) {
        const topHolderBalance = await contract.balanceOf(topHolders[0]);
        const percentage =
          (Number(topHolderBalance) / Number(totalSupply)) * 100;

        if (percentage > 50) {
          findings.push(`⚠️ ALTO RIESGO: Top holder posee ${percentage.toFixed(2)}% del supply`);
          riskScore += 30;
        } else if (percentage > 20) {
          findings.push(`⚠️ Top holder posee ${percentage.toFixed(2)}% del supply`);
          riskScore += 15;
        }
      }

      // Análisis con IA si está disponible
      if (this.anthropic) {
        const aiAnalysis = await this.analyzeWithAI({
          type: "token",
          data: { name, symbol, decimals, totalSupply: totalSupply.toString() },
          findings,
        });
        return this.buildResult(riskScore, findings, aiAnalysis);
      }

      return this.buildResult(riskScore, findings);
    } catch (error) {
      findings.push(`Error al analizar token: ${error instanceof Error ? error.message : "Unknown"}`);
      return this.buildResult(100, findings);
    }
  }

  /**
   * Análisis de pool de liquidez (Uniswap V2 style)
   */
  private async analyzePool(address: string, dex?: string): Promise<RiskAnalysisResult> {
    const findings: string[] = [];
    let riskScore = 0;

    try {
      const pair = new ethers.Contract(address, PAIR_ABI, this.provider);

      // Obtener tokens del pool
      const [token0Addr, token1Addr, reserves, totalSupply] = await Promise.all([
        pair.token0(),
        pair.token1(),
        pair.getReserves(),
        pair.totalSupply(),
      ]);

      findings.push(`Pool en ${dex || "DEX desconocido"}`);
      findings.push(`Token0: ${token0Addr}`);
      findings.push(`Token1: ${token1Addr}`);

      // Información de los tokens
      const token0 = new ethers.Contract(token0Addr, ERC20_ABI, this.provider);
      const token1 = new ethers.Contract(token1Addr, ERC20_ABI, this.provider);

      const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
        token0.symbol(),
        token1.symbol(),
        token0.decimals(),
        token1.decimals(),
      ]);

      findings.push(`Par: ${symbol0}/${symbol1}`);

      // Análisis de liquidez
      const reserve0 = ethers.formatUnits(reserves[0], decimals0);
      const reserve1 = ethers.formatUnits(reserves[1], decimals1);

      findings.push(`Reserva ${symbol0}: ${reserve0}`);
      findings.push(`Reserva ${symbol1}: ${reserve1}`);

      // Riesgo por liquidez baja
      const liquidityScore = Number(reserve0) * Number(reserve1);
      if (liquidityScore < 1000) {
        findings.push("⚠️ ALTO RIESGO: Liquidez muy baja (< $1000 TVL estimado)");
        riskScore += 40;
      } else if (liquidityScore < 10000) {
        findings.push("⚠️ Liquidez baja (< $10k TVL estimado)");
        riskScore += 20;
      }

      // Análisis de concentración de LP tokens
      const lpSupply = ethers.formatEther(totalSupply);
      findings.push(`LP Total Supply: ${lpSupply}`);

      if (Number(lpSupply) < 0.001) {
        findings.push("⚠️ Supply de LP tokens muy bajo");
        riskScore += 15;
      }

      // Análisis con IA
      if (this.anthropic) {
        const aiAnalysis = await this.analyzeWithAI({
          type: "pool",
          data: {
            dex,
            pair: `${symbol0}/${symbol1}`,
            reserves: { [symbol0]: reserve0, [symbol1]: reserve1 },
            lpSupply,
          },
          findings,
        });
        return this.buildResult(riskScore, findings, aiAnalysis);
      }

      return this.buildResult(riskScore, findings);
    } catch (error) {
      findings.push(`Error al analizar pool: ${error instanceof Error ? error.message : "Unknown"}`);
      return this.buildResult(100, findings);
    }
  }

  /**
   * Análisis de contrato inteligente
   */
  private async analyzeContract(address: string): Promise<RiskAnalysisResult> {
    const findings: string[] = [];
    let riskScore = 0;

    try {
      // Verificar que existe código
      const code = await this.provider.getCode(address);
      if (code === "0x") {
        findings.push("⚠️ CRÍTICO: No hay código en esta dirección (EOA o contrato vacío)");
        return this.buildResult(100, findings);
      }

      findings.push("✓ Contrato desplegado");

      // Analizar tamaño del bytecode
      const codeSize = (code.length - 2) / 2; // bytes
      findings.push(`Tamaño del bytecode: ${codeSize} bytes`);

      if (codeSize < 100) {
        findings.push("⚠️ Contrato muy pequeño (posible proxy o scam)");
        riskScore += 25;
      }

      // Análisis con IA del bytecode
      if (this.anthropic && codeSize < 10000) {
        const aiAnalysis = await this.analyzeWithAI({
          type: "contract",
          data: { address, codeSize, bytecode: code.substring(0, 1000) },
          findings,
        });
        return this.buildResult(riskScore, findings, aiAnalysis);
      }

      return this.buildResult(riskScore, findings);
    } catch (error) {
      findings.push(`Error al analizar contrato: ${error instanceof Error ? error.message : "Unknown"}`);
      return this.buildResult(100, findings);
    }
  }

  /**
   * Análisis de protocolo DeFi
   */
  private async analyzeProtocol(address: string): Promise<RiskAnalysisResult> {
    const findings: string[] = [];
    findings.push("Análisis de protocolo en desarrollo");
    findings.push("Por implementar: TVL, auditorías, historial");

    return this.buildResult(50, findings);
  }

  /**
   * Análisis con IA usando Claude
   */
  private async analyzeWithAI(context: any): Promise<string> {
    if (!this.anthropic) {
      return "Análisis de IA no disponible (API key no configurada)";
    }

    try {
      const prompt = `Eres un experto en seguridad DeFi. Analiza los siguientes datos y proporciona un análisis de riesgo conciso:

Tipo: ${context.type}
Datos: ${JSON.stringify(context.data, null, 2)}
Hallazgos previos: ${context.findings.join(", ")}

Proporciona:
1. Evaluación de riesgo general
2. Principales preocupaciones de seguridad
3. Recomendaciones específicas
4. Conclusión en 2-3 líneas

Sé conciso y directo.`;

      const message = await this.anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });

      const textContent = message.content.find((c) => c.type === "text");
      return textContent && "text" in textContent ? textContent.text : "Sin análisis";
    } catch (error) {
      console.error("Error en análisis de IA:", error);
      return "Error al obtener análisis de IA";
    }
  }

  /**
   * Obtener top holders (simplificado - en producción usar API como Covalent)
   */
  private async getTopHolders(tokenAddress: string): Promise<string[]> {
    // Placeholder: en producción integrar con APIs como Covalent, Moralis, etc.
    return [];
  }

  /**
   * Construir resultado final
   */
  private buildResult(
    riskScore: number,
    findings: string[],
    aiAnalysis?: string
  ): RiskAnalysisResult {
    const level: "low" | "medium" | "high" | "critical" =
      riskScore < 25 ? "low" : riskScore < 50 ? "medium" : riskScore < 75 ? "high" : "critical";

    const recommendations: string[] = [];
    if (riskScore > 70) {
      recommendations.push("⚠️ ALTO RIESGO: Evitar interactuar con este contrato/token");
    } else if (riskScore > 40) {
      recommendations.push("Proceder con precaución y hacer análisis adicional");
    } else {
      recommendations.push("Riesgo aceptable, pero siempre verificar por fuentes adicionales");
    }

    return {
      risk_score: Math.min(riskScore, 100),
      risk_level: level,
      findings,
      recommendations,
      analysis: aiAnalysis || "Análisis básico completado",
    };
  }
}
