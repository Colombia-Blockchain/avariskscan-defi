import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { paymentMiddleware } from "x402-hono";
import { DeFiRiskAnalyzer } from "./defi-analyzer.js";
import { X402Client, discoverAgents } from "./x402-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const registration = JSON.parse(
  readFileSync(join(__dirname, "..", "registration.json"), "utf-8")
);

const app = new Hono();

const WALLET_ADDRESS = process.env.WALLET_ADDRESS || "0x29a45b03F07D1207f2e3ca34c38e7BE5458CE71a";
const FACILITATOR_URL = "https://facilitator.ultravioletadao.xyz";

// Inicializar analizador DeFi
const analyzer = new DeFiRiskAnalyzer();

// Health check
app.get("/", (c) => {
  return c.json({
    status: "ok",
    agent: "AvaRisk DeFi",
    version: "0.1.0",
    x402: true,
  });
});

// A2A agent card (descubrible por el scanner ERC-8004)
app.get("/.well-known/agent-card.json", (c) => {
  return c.json(registration, 200, {
    "Content-Type": "application/json",
  });
});

// Registration JSON para hospedar como agentURI
app.get("/registration.json", (c) => {
  return c.json(registration, 200, {
    "Content-Type": "application/json",
  });
});

// Endpoint para descubrir otros agentes (público)
app.get("/agents/discover", async (c) => {
  try {
    const registryAddress = "0x8004A818BFB912233c491871b3d84c89A494BD9e"; // Fuji
    const agents = await discoverAgents(registryAddress);

    return c.json({
      success: true,
      registry: registryAddress,
      network: "avalanche-fuji",
      agents: agents.length,
      agentsList: agents,
      info: "Descubriendo agentes registrados en ERC-8004",
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      500
    );
  }
});

// Info de x402 y faucet
app.get("/x402/info", async (c) => {
  try {
    // Check facilitator without requiring private key
    const facilitatorResponse = await fetch("https://facilitator.ultravioletadao.xyz");
    const facilitatorHealthy = facilitatorResponse.ok;

    return c.json({
      facilitator: {
        url: "https://facilitator.ultravioletadao.xyz",
        healthy: facilitatorHealthy,
      },
      usdc: {
        contract: "0x5425890298aed601595a70AB815c96711a31Bc65",
        network: "Avalanche Fuji Testnet",
        chainId: 43113,
        faucet: "https://faucet.circle.com/",
      },
      payment: {
        method: "EIP-712 TransferWithAuthorization",
        offChain: true,
        description: "El agente firma off-chain, el facilitador ejecuta el pago",
      },
      agent: {
        wallet: WALLET_ADDRESS,
        registered: true,
        registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
      },
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Error al obtener info x402",
      },
      500
    );
  }
});

// Rutas protegidas con x402 (UltraVioleta facilitator)
app.use(
  paymentMiddleware(
    WALLET_ADDRESS as `0x${string}`,
    {
      "/a2a/research": {
        price: "$0.01",
        network: "avalanche-fuji", // Fuji testnet
        config: {
          description: "Evaluación de riesgo DeFi en Avalanche",
        },
      },
    },
    {
      url: FACILITATOR_URL,
    }
  )
);

// Endpoint de investigación (requiere pago x402)
app.post("/a2a/research", async (c) => {
  try {
    const body = await c.req.json();
    const { type, address, network, dex } = body;

    // Validar entrada
    if (!type || !address) {
      return c.json(
        {
          success: false,
          error: "Campos requeridos: type (token|pool|contract|protocol) y address",
        },
        400
      );
    }

    // Realizar análisis de riesgo
    const result = await analyzer.analyzeRisk({
      type,
      address,
      network: network || "mainnet",
      dex,
    });

    return c.json({
      success: true,
      agent: "AvaRisk DeFi",
      timestamp: new Date().toISOString(),
      request: { type, address, network, dex },
      result,
    });
  } catch (error) {
    console.error("Error en /a2a/research:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      500
    );
  }
});

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`ERC-8004 agent listening at http://localhost:${info.port}`);
  console.log(`  GET  /                            - Health check`);
  console.log(`  GET  /.well-known/agent-card.json - A2A metadata`);
  console.log(`  GET  /registration.json           - ERC-8004 registration`);
  console.log(`  GET  /agents/discover             - Discover other agents`);
  console.log(`  GET  /x402/info                   - x402 payment info`);
  console.log(`  POST /a2a/research                - Research (x402 protected)`);
});
