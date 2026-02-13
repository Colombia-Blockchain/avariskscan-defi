import { ethers } from "ethers";

/**
 * Cliente x402 para realizar pagos y llamar endpoints protegidos de otros agentes
 *
 * Usa EIP-712 TransferWithAuthorization (no transfer() directo)
 * El facilitador ejecuta el pago on-chain
 */

// Configuración x402 en Fuji
const FACILITATOR_URL = "https://facilitator.ultravioletadao.xyz";
const USDC_FUJI = "0x5425890298aed601595a70AB815c96711a31Bc65";
const RECIPIENT = "0x7C599af5Dce814B13CD0c66F9C783Dd1e4C69Ae8"; // Wallet del facilitador
const NETWORK = "avalanche-fuji";

// EIP-712 Domain para USDC en Fuji
const EIP712_DOMAIN = {
  name: "USD Coin",
  version: "2",
  chainId: 43113,
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

export class X402Client {
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    this.wallet = new ethers.Wallet(privateKey);
  }

  /**
   * Crea un payment proof firmado con EIP-712
   */
  async createPaymentProof(amountUSDC: number): Promise<X402Payment> {
    const amountMicroUSDC = (amountUSDC * 1_000_000).toString(); // USDC tiene 6 decimales
    const validBefore = Math.floor(Date.now() / 1000) + 3600; // Válido por 1 hora
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
    data: any,
    amountUSDC: number = 0.01
  ): Promise<any> {
    try {
      // Crear payment proof
      const payment = await this.createPaymentProof(amountUSDC);

      // Codificar en base64
      const paymentHeader = Buffer.from(JSON.stringify(payment)).toString("base64");

      // Hacer la petición
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT": paymentHeader,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error al llamar endpoint protegido:", error);
      throw error;
    }
  }

  /**
   * Verifica si el facilitador está activo
   */
  async checkFacilitator(): Promise<boolean> {
    try {
      const response = await fetch(FACILITATOR_URL);
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
 * Helper para descubrir otros agentes en el registry
 */
export async function discoverAgents(registryAddress: string): Promise<any[]> {
  // Placeholder: integrar con el scanner o leer eventos del registry
  // Por ahora retorna vacío, pero aquí podrías:
  // 1. Leer eventos AgentRegistered del registry
  // 2. Consultar el scanner API
  // 3. Mantener una base de datos local de agentes

  console.log(`Discovering agents in registry ${registryAddress}...`);
  return [];
}

/**
 * Helper para llamar el endpoint de research de otro agente
 */
export async function callAgentResearch(
  agentUrl: string,
  analysisRequest: any,
  privateKey: string
): Promise<any> {
  const client = new X402Client(privateKey);
  return await client.callProtectedEndpoint(
    `${agentUrl}/a2a/research`,
    "POST",
    analysisRequest,
    0.01 // $0.01 en USDC
  );
}
