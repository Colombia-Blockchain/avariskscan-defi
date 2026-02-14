import { ethers } from "ethers";

/**
 * Cliente x402 para realizar pagos y llamar endpoints protegidos de otros agentes
 *
 * Usa EIP-712 TransferWithAuthorization (no transfer() directo)
 * El facilitador ejecuta el pago on-chain
 */

// Configuracion x402 (configurable via env vars)
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.ultravioletadao.xyz";
const USDC_FUJI = process.env.USDC_CONTRACT || "0x5425890298aed601595a70AB815c96711a31Bc65";
const RECIPIENT = process.env.X402_RECIPIENT || "0x7C599af5Dce814B13CD0c66F9C783Dd1e4C69Ae8";
const NETWORK = process.env.X402_NETWORK || "avalanche-fuji";

// EIP-712 Domain para USDC en Fuji
const EIP712_DOMAIN = {
  name: "USD Coin",
  version: "2",
  chainId: Number(process.env.X402_CHAIN_ID || 43113),
  verifyingContract: USDC_FUJI,
};

// EIP-712 Types para TransferWithAuthorization
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

export interface X402Payment {
  x402Version: number;
  payload: {
    signature: string;
    payload: {
      scheme: "exact";
      network: string;
      asset: string;
      from: string;
      to: string;
      amount: string;
      validAfter: number;
      validBefore: number;
      nonce: string;
    };
  };
  network: string;
  asset: string;
  amount: string;
}

export interface AnalysisRequest {
  type: "token" | "pool" | "contract" | "protocol";
  address: string;
  network?: "mainnet" | "fuji";
  dex?: string;
}

export interface AgentInfo {
  agentId: number;
  metadataURI: string;
  owner: string;
}

export class X402Client {
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    this.wallet = new ethers.Wallet(privateKey);
  }

  /**
   * Crea un payment proof firmado con EIP-712
   */
  async createPaymentProof(amountUSDC: number): Promise<X402Payment> {
    // Fix: usar Math.round para evitar errores de precision flotante
    const amountMicroUSDC = Math.round(amountUSDC * 1_000_000).toString();
    const now = Math.floor(Date.now() / 1000);
    const validBefore = now + 3600; // Valido por 1 hora
    const nonce = ethers.hexlify(ethers.randomBytes(32));

    const payload = {
      scheme: "exact" as const,
      network: NETWORK,
      asset: USDC_FUJI,
      from: this.wallet.address,
      to: RECIPIENT,
      amount: amountMicroUSDC,
      validAfter: 0,
      validBefore,
      nonce,
    };

    // Firmar con EIP-712
    const signature = await this.wallet.signTypedData(
      EIP712_DOMAIN,
      TRANSFER_WITH_AUTHORIZATION_TYPES,
      {
        from: payload.from,
        to: payload.to,
        value: payload.amount,
        validAfter: payload.validAfter,
        validBefore: payload.validBefore,
        nonce: payload.nonce,
      }
    );

    return {
      x402Version: 1,
      payload: {
        signature,
        payload,
      },
      network: NETWORK,
      asset: USDC_FUJI,
      amount: amountMicroUSDC,
    };
  }

  /**
   * Llama un endpoint protegido de otro agente con pago x402
   */
  async callProtectedEndpoint(
    url: string,
    method: string,
    data: AnalysisRequest,
    amountUSDC: number = 0.01
  ): Promise<Record<string, unknown>> {
    try {
      const payment = await this.createPaymentProof(amountUSDC);
      const paymentHeader = Buffer.from(JSON.stringify(payment)).toString("base64");

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT": paymentHeader,
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(30_000), // 30s timeout
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      return await response.json() as Record<string, unknown>;
    } catch (error) {
      console.error("Error al llamar endpoint protegido:", error);
      throw error;
    }
  }

  /**
   * Verifica si el facilitador esta activo
   */
  async checkFacilitator(): Promise<boolean> {
    try {
      const response = await fetch(FACILITATOR_URL, {
        signal: AbortSignal.timeout(10_000),
      });
      return response.ok;
    } catch (error) {
      console.error("Facilitador no disponible:", error);
      return false;
    }
  }

  /**
   * Obtiene USDC de prueba del faucet
   */
  getFaucetInfo(): { url: string; usdc: string; network: string } {
    return {
      url: "https://faucet.circle.com/",
      usdc: USDC_FUJI,
      network: "Avalanche Fuji Testnet",
    };
  }
}

/**
 * Descubre agentes registrados en el registry ERC-8004 leyendo eventos on-chain
 */
export async function discoverAgents(registryAddress: string): Promise<AgentInfo[]> {
  const rpcUrl = process.env.AVALANCHE_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // ABI minimo para leer el registry
    const registryABI = [
      "function totalSupply() view returns (uint256)",
      "function tokenURI(uint256 tokenId) view returns (string)",
      "function ownerOf(uint256 tokenId) view returns (address)",
    ];

    const registry = new ethers.Contract(registryAddress, registryABI, provider);
    const totalSupply = await registry.totalSupply();
    const total = Number(totalSupply);

    // Leer los ultimos 10 agentes registrados (o menos si hay menos)
    const count = Math.min(total, 10);
    const agents: AgentInfo[] = [];

    for (let i = total; i > total - count && i > 0; i--) {
      try {
        const [metadataURI, owner] = await Promise.all([
          registry.tokenURI(i),
          registry.ownerOf(i),
        ]);
        agents.push({ agentId: i, metadataURI, owner });
      } catch {
        // Token ID puede no existir si fue quemado
      }
    }

    return agents;
  } catch (error) {
    console.error(`Error discovering agents in registry ${registryAddress}:`, error);
    return [];
  }
}

/**
 * Helper para llamar el endpoint de research de otro agente
 */
export async function callAgentResearch(
  agentUrl: string,
  analysisRequest: AnalysisRequest,
  privateKey: string
): Promise<Record<string, unknown>> {
  const client = new X402Client(privateKey);
  return await client.callProtectedEndpoint(
    `${agentUrl}/a2a/research`,
    "POST",
    analysisRequest,
    0.01
  );
}
