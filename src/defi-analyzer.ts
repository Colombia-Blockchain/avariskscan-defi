import Anthropic from "@anthropic-ai/sdk";
import { ethers } from "ethers";

// Configuración
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const RPC_URL_MAINNET = "https://api.avax.network/ext/bc/C/rpc";
const RPC_URL_FUJI = "https://api.avax-test.network/ext/bc/C/rpc";

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
  private providerMainnet: ethers.JsonRpcProvider;
  private providerFuji: ethers.JsonRpcProvider;

  constructor() {
    this.providerMainnet = new ethers.JsonRpcProvider(RPC_URL_MAINNET);
    this.providerFuji = new ethers.JsonRpcProvider(RPC_URL_FUJI);
    if (ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    }
  }

  private getProvider(network: "mainnet" | "fuji" = "mainnet"): ethers.JsonRpcProvider {
    return network === "fuji" ? this.providerFuji : this.providerMainnet;
  }

  /**
   * Análisis principal de riesgo DeFi
   */
  async analyzeRisk(request: RiskAnalysisRequest): Promise<RiskAnalysisResult> {
    try {
      const network = request.network || "mainnet";
      switch (request.type) {
        case "token":
          return await this.analyzeToken(request.address, network);
        case "pool":
          return await this.analyzePool(request.address, request.dex, network);
        case "contract":
          return await this.analyzeContract(request.address, network);
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
  private async analyzeToken(address: string, network: "mainnet" | "fuji" = "mainnet"): Promise<RiskAnalysisResult> {
    const findings: string[] = [];
    let riskScore = 0;

    try {
      const provider = this.getProvider(network);

      // Verificar código del contrato PRIMERO
      const code = await provider.getCode(address);
      const networkInfo = await provider.getNetwork();
      findings.push(`🌐 Red: ${network === "fuji" ? "Avalanche Fuji Testnet" : "Avalanche Mainnet"} (chainId: ${networkInfo.chainId})`);

      if (code === "0x") {
        findings.push("⚠️ CRÍTICO: No hay código en esta dirección (es una EOA, no un contrato)");
        findings.push("💡 Verifica que estés usando la red correcta (mainnet vs fuji)");
        findings.push("💡 Si es mainnet, usa: network=mainnet o déjalo vacío");
        findings.push("💡 Si es testnet, usa: network=fuji");
        return this.buildResult(100, findings);
      }

      const contract = new ethers.Contract(address, ERC20_ABI, provider);

      // Información básica del token (con manejo individual de errores)
      let name = "Unknown";
      let symbol = "Unknown";
      let decimals = 18;
      let totalSupply = BigInt(0);

      try {
        name = await contract.name();
      } catch (e) {
        findings.push("⚠️ No se pudo obtener name() - puede no ser ERC-20");
        riskScore += 20;
      }

      try {
        symbol = await contract.symbol();
      } catch (e) {
        findings.push("⚠️ No se pudo obtener symbol() - puede no ser ERC-20");
        riskScore += 20;
      }

      try {
        decimals = await contract.decimals();
      } catch (e) {
        findings.push("⚠️ No se pudo obtener decimals() - puede no ser ERC-20");
        riskScore += 20;
      }

      try {
        totalSupply = await contract.totalSupply();
      } catch (e) {
        findings.push("⚠️ No se pudo obtener totalSupply() - puede no ser ERC-20");
        riskScore += 20;
      }

      // Si no se pudo obtener información básica, no es ERC-20 válido
      if (name === "Unknown" && symbol === "Unknown") {
        findings.push("⚠️ CRÍTICO: El contrato no implementa interfaz ERC-20");
        findings.push("💡 Este contrato existe pero no responde a las funciones estándar de tokens");
        return this.buildResult(100, findings);
      }

      findings.push(`Token: ${name} (${symbol})`);
      findings.push(`Decimales: ${decimals}`);
      findings.push(`Supply total: ${ethers.formatUnits(totalSupply, decimals)}`);

      findings.push("✓ Contrato desplegado y verificado");

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
  private async analyzePool(address: string, dex?: string, network: "mainnet" | "fuji" = "mainnet"): Promise<RiskAnalysisResult> {
    const findings: string[] = [];
    let riskScore = 0;

    try {
      const provider = this.getProvider(network);
      const networkInfo = await provider.getNetwork();
      findings.push(`🌐 Red: ${network === "fuji" ? "Avalanche Fuji Testnet" : "Avalanche Mainnet"} (chainId: ${networkInfo.chainId})`);

      const pair = new ethers.Contract(address, PAIR_ABI, provider);

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
      const token0 = new ethers.Contract(token0Addr, ERC20_ABI, provider);
      const token1 = new ethers.Contract(token1Addr, ERC20_ABI, provider);

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
  private async analyzeContract(address: string, network: "mainnet" | "fuji" = "mainnet"): Promise<RiskAnalysisResult> {
    const findings: string[] = [];
    let riskScore = 0;

    try {
      const provider = this.getProvider(network);
      const networkInfo = await provider.getNetwork();
      findings.push(`🌐 Red: ${network === "fuji" ? "Avalanche Fuji Testnet" : "Avalanche Mainnet"} (chainId: ${networkInfo.chainId})`);

      // Verificar que existe código
      const code = await provider.getCode(address);
      if (code === "0x") {
        findings.push("⚠️ CRÍTICO: No hay código en esta dirección (EOA o contrato vacío)");
        findings.push("💡 Verifica que estés usando la red correcta (mainnet vs fuji)");
        return this.buildResult(100, findings);
      }

      findings.push("✓ Contrato desplegado");

      // Analizar tamaño del bytecode
      const codeSize = (code.length - 2) / 2; // bytes
      findings.push(`📏 Tamaño del bytecode: ${codeSize.toLocaleString()} bytes`);

      if (codeSize < 100) {
        findings.push("⚠️ ALTO RIESGO: Contrato muy pequeño (posible proxy malicioso o honeypot)");
        riskScore += 30;
      } else if (codeSize > 24576) {
        findings.push("⚠️ Contrato muy grande (>24KB límite de Ethereum, podría ser proxy)");
        riskScore += 10;
      }

      // Obtener balance del contrato
      const balance = await provider.getBalance(address);
      const balanceAVAX = ethers.formatEther(balance);
      findings.push(`💰 Balance del contrato: ${parseFloat(balanceAVAX).toFixed(4)} AVAX`);

      if (Number(balanceAVAX) > 1000) {
        findings.push("📊 Alto balance bloqueado en el contrato (>1000 AVAX)");
      }

      // Detección de patrones de proxy (ERC-1967, EIP-1167)
      const isProxy = this.detectProxyPattern(code);
      if (isProxy.detected) {
        findings.push(`🔄 Contrato Proxy detectado: ${isProxy.type}`);
        findings.push("⚠️ IMPORTANTE: El contrato es upgradeable, verificar quién controla las actualizaciones");
        riskScore += 20;
      }

      // Detección de funciones peligrosas
      const dangerousFunctions = this.detectDangerousFunctions(code);
      if (dangerousFunctions.length > 0) {
        findings.push(`⚠️ Funciones potencialmente peligrosas detectadas: ${dangerousFunctions.join(", ")}`);
        riskScore += dangerousFunctions.length * 10;
      }

      // Análisis de patrones comunes
      const patterns = this.detectCommonPatterns(code);
      if (patterns.length > 0) {
        findings.push(`🔍 Patrones detectados: ${patterns.join(", ")}`);
      }

      // Verificar transacciones del contrato
      try {
        const txCount = await provider.getTransactionCount(address);
        findings.push(`📈 Transacciones enviadas por el contrato: ${txCount}`);

        if (txCount === 0 && Number(balanceAVAX) > 10) {
          findings.push("⚠️ Contrato con balance alto pero sin transacciones enviadas (sospechoso)");
          riskScore += 15;
        }
      } catch (error) {
        // Ignore tx count error
      }

      // Análisis con IA del bytecode
      if (this.anthropic && codeSize < 10000) {
        const aiAnalysis = await this.analyzeWithAI({
          type: "contract",
          data: {
            address,
            codeSize,
            balance: balanceAVAX,
            isProxy: isProxy.detected,
            dangerousFunctions,
            patterns,
            bytecode: code.substring(0, 1000)
          },
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
   * Detecta patrones de proxy en el bytecode
   */
  private detectProxyPattern(bytecode: string): { detected: boolean; type: string } {
    // ERC-1967 (Transparent/UUPS Proxy) - slot: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
    if (bytecode.includes("360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc")) {
      return { detected: true, type: "ERC-1967 (UUPS/Transparent Proxy)" };
    }

    // EIP-1167 (Minimal Proxy / Clone)
    if (bytecode.includes("363d3d373d3d3d363d73") || bytecode.includes("5af43d82803e903d91602b57fd5bf3")) {
      return { detected: true, type: "EIP-1167 (Minimal Proxy/Clone)" };
    }

    // Beacon Proxy - slot: 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50
    if (bytecode.includes("a3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50")) {
      return { detected: true, type: "Beacon Proxy" };
    }

    // Delegatecall pattern (proxy común)
    if (bytecode.includes("delegatecall") || bytecode.match(/5b[0-9a-f]{2}f4/)) {
      return { detected: true, type: "Custom Proxy (delegatecall detectado)" };
    }

    return { detected: false, type: "" };
  }

  /**
   * Detecta funciones potencialmente peligrosas
   */
  private detectDangerousFunctions(bytecode: string): string[] {
    const dangerous: string[] = [];

    // selfdestruct (opcode: ff)
    if (bytecode.match(/ff$/m) || bytecode.includes("selfdestruct")) {
      dangerous.push("selfdestruct");
    }

    // delegatecall (opcode: f4)
    if (bytecode.includes("f4") && bytecode.length > 1000) {
      dangerous.push("delegatecall");
    }

    // callcode (deprecated, opcode: f2)
    if (bytecode.includes("f2")) {
      dangerous.push("callcode (deprecated)");
    }

    return dangerous;
  }

  /**
   * Detecta patrones comunes de contratos
   */
  private detectCommonPatterns(bytecode: string): string[] {
    const patterns: string[] = [];

    // ERC-20 (transfer signature: a9059cbb)
    if (bytecode.includes("a9059cbb")) {
      patterns.push("ERC-20");
    }

    // ERC-721 (transferFrom signature: 23b872dd)
    if (bytecode.includes("23b872dd") && bytecode.includes("6352211e")) {
      patterns.push("ERC-721");
    }

    // Ownable (owner storage pattern)
    if (bytecode.includes("8da5cb5b")) {
      patterns.push("Ownable");
    }

    // Pausable
    if (bytecode.includes("5c975abb")) {
      patterns.push("Pausable");
    }

    return patterns;
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
