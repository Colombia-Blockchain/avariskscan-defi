import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { paymentMiddleware } from "x402-hono";
import { AvalancheGuide } from "./avalanche-guide.js";
import type { GuideRequest } from "./avalanche-guide.js";
import { discoverAgents } from "./x402-client.js";
import { DeFiAPIs, formatTVL } from "./defi-apis.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const registration = JSON.parse(
  readFileSync(join(__dirname, "..", "registration.json"), "utf-8")
);

const app = new Hono();

// ---------- Configuration ----------

const WALLET_ADDRESS = process.env.WALLET_ADDRESS || "0x29a45b03F07D1207f2e3ca34c38e7BE5458CE71a";
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.ultravioletadao.xyz";
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || "0x8004A818BFB912233c491871b3d84c89A494BD9e";

// ---------- Rate Limiting ----------

class RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(
    private maxRequests: number = 60,
    private windowMs: number = 60_000
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const recent = timestamps.filter((t) => now - t < this.windowMs);
    if (recent.length >= this.maxRequests) return false;
    recent.push(now);
    this.requests.set(key, recent);
    return true;
  }
}

const rateLimiter = new RateLimiter();

// ---------- Middleware ----------

app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-PAYMENT"],
  })
);

app.use("/*", async (c, next) => {
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  if (!rateLimiter.isAllowed(ip)) {
    return c.json({ success: false, error: "Rate limit exceeded. Try again later." }, 429);
  }
  await next();
});

// ---------- Initialize services ----------

const guide = new AvalancheGuide();
const defiAPIs = new DeFiAPIs();

// ---------- FREE Public routes ----------

// Health check
app.get("/", (c) => {
  return c.json({
    status: "ok",
    agent: "AvaBuilder Agent",
    tagline: "The first AI builder agent on Avalanche",
    version: "2.0.0",
    dashboard: "/dashboard (free - powered by Avalanche AI)",
    a2a: "/a2a/guide (x402 paid - agent-to-agent)",
    capabilities: [
      "l1-creation",
      "validator-nodes",
      "smart-contracts",
      "defi-building",
      "cross-chain",
      "nft-collections",
      "gaming-chains",
      "rwa-tokenization",
    ],
  });
});

// A2A agent card (ERC-8004)
app.get("/.well-known/agent-card.json", (c) => {
  return c.json(registration, 200, {
    "Content-Type": "application/json",
  });
});

// Domain verification for ERC-8004
app.get("/.well-known/agent-registration.json", (c) => {
  try {
    const verificationJSON = readFileSync(
      join(__dirname, "..", ".well-known", "agent-registration.json"),
      "utf-8"
    );
    return c.json(JSON.parse(verificationJSON), 200, {
      "Content-Type": "application/json",
    });
  } catch {
    return c.json({ error: "Verification file not found" }, 404);
  }
});

// Registration JSON
app.get("/registration.json", (c) => {
  return c.json(registration, 200, {
    "Content-Type": "application/json",
  });
});

// Dashboard - FREE interface with embedded Avalanche AI
app.get("/dashboard", (c) => {
  try {
    const dashboardHTML = readFileSync(join(__dirname, "..", "dashboard.html"), "utf-8");
    return c.html(dashboardHTML);
  } catch {
    return c.json({ error: "Dashboard not found" }, 404);
  }
});

// Serve static files from public/
app.get("/public/:filename", (c) => {
  const filename = c.req.param("filename");
  const filePath = join(__dirname, "..", "public", filename);
  if (!existsSync(filePath)) {
    return c.json({ error: "File not found" }, 404);
  }
  const ext = extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";
  const file = readFileSync(filePath);
  return new Response(file, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
});

// Discover other ERC-8004 agents
app.get("/agents/discover", async (c) => {
  try {
    const agents = await discoverAgents(REGISTRY_ADDRESS);
    return c.json({
      success: true,
      registry: REGISTRY_ADDRESS,
      network: "avalanche-fuji",
      agents: agents.length,
      agentsList: agents,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});

// ---------- FREE DeFi API routes ----------

// Market data: AVAX price + metrics
app.get("/api/market", async (c) => {
  try {
    const price = await defiAPIs.getAvalanchePrice();
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      avax: price
        ? { priceUsd: price.usd, change24h: price.usd_24h_change }
        : null,
    });
  } catch (error) {
    return c.json({ success: false, error: "Failed to fetch market data" }, 500);
  }
});

// DeFi overview: TVL + top protocols
app.get("/api/defi", async (c) => {
  try {
    const metrics = await defiAPIs.getAvalancheMetrics();
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalTVL: metrics.totalTVL,
      totalTVLFormatted: formatTVL(metrics.totalTVL),
      protocolCount: metrics.protocolCount,
      topProtocols: metrics.topProtocols.slice(0, 10).map((p) => ({
        name: p.name,
        tvl: p.tvl,
        tvlFormatted: formatTVL(p.tvl),
        category: p.category,
      })),
    });
  } catch (error) {
    return c.json({ success: false, error: "Failed to fetch DeFi data" }, 500);
  }
});

// Token info: DEX Screener + CoinGecko combined
app.get("/api/token/:address", async (c) => {
  try {
    const address = c.req.param("address");
    const [dexPairs, searchResults] = await Promise.all([
      defiAPIs.getDexPairs(address),
      defiAPIs.searchToken(address),
    ]);

    const topPair = dexPairs[0] || null;
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      address,
      dex: topPair
        ? {
            name: topPair.baseToken.name,
            symbol: topPair.baseToken.symbol,
            priceUsd: topPair.priceUsd,
            volume24h: topPair.volume?.h24,
            liquidity: topPair.liquidity?.usd,
            fdv: topPair.fdv,
            dexId: topPair.dexId,
            pairAddress: topPair.pairAddress,
          }
        : null,
      pairsCount: dexPairs.length,
      coingecko: searchResults.length > 0 ? searchResults[0] : null,
    });
  } catch (error) {
    return c.json({ success: false, error: "Failed to fetch token data" }, 500);
  }
});

// Trading pairs for a token
app.get("/api/pairs/:address", async (c) => {
  try {
    const address = c.req.param("address");
    const pairs = await defiAPIs.getDexPairs(address);
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      address,
      pairsCount: pairs.length,
      pairs: pairs.slice(0, 20).map((p) => ({
        dex: p.dexId,
        pair: `${p.baseToken.symbol}/${p.quoteToken.symbol}`,
        priceUsd: p.priceUsd,
        volume24h: p.volume?.h24,
        liquidity: p.liquidity?.usd,
        pairAddress: p.pairAddress,
      })),
    });
  } catch (error) {
    return c.json({ success: false, error: "Failed to fetch pairs data" }, 500);
  }
});

// Avalanche L1s (subnets/blockchains)
app.get("/api/l1s", async (c) => {
  try {
    const subnets = await defiAPIs.getAvalancheL1s();
    const l1s = subnets.map((s) => {
      const chain = s.blockchains[0];
      return {
        name: chain?.blockchainName || "Unknown",
        subnetId: s.subnetId,
        blockchainId: chain?.blockchainId || "",
        evmChainId: chain?.evmChainId || null,
        isL1: s.isL1,
        chainsCount: s.blockchains.length,
        createdAt: new Date(s.createBlockTimestamp * 1000).toISOString(),
        explorerUrl: `https://subnets.avax.network/${chain?.blockchainName?.toLowerCase().replace(/\s+/g, "-") || "c-chain"}`,
        hasValidatorManager: !!s.l1ValidatorManagerDetails,
      };
    });
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: l1s.length,
      l1s,
    });
  } catch (error) {
    return c.json({ success: false, error: "Failed to fetch L1s" }, 500);
  }
});

// Avalanche DeFi protocols (Avalanche-only, sorted by TVL)
app.get("/api/avax-defi", async (c) => {
  try {
    const protocols = await defiAPIs.getAvalancheDeFiProtocols();
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: protocols.length,
      protocols,
    });
  } catch (error) {
    return c.json({ success: false, error: "Failed to fetch Avalanche DeFi" }, 500);
  }
});

// Top trading pairs on Avalanche DEXs
app.get("/api/top-pairs", async (c) => {
  try {
    const pairs = await defiAPIs.getAvalancheTopPairs();
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: pairs.length,
      pairs: pairs.map((p) => ({
        dex: p.dexId,
        pair: `${p.baseToken.symbol}/${p.quoteToken.symbol}`,
        baseToken: p.baseToken,
        quoteToken: p.quoteToken,
        priceUsd: p.priceUsd,
        volume24h: p.volume?.h24,
        liquidity: p.liquidity?.usd,
        fdv: p.fdv,
        pairAddress: p.pairAddress,
        tradeUrl: `https://dexscreener.com/avalanche/${p.pairAddress}`,
        traderJoeUrl: `https://traderjoexyz.com/avalanche/trade/${p.baseToken.address}`,
      })),
    });
  } catch (error) {
    return c.json({ success: false, error: "Failed to fetch top pairs" }, 500);
  }
});

// ---------- x402 PAID routes (agent-to-agent) ----------

app.use(
  paymentMiddleware(
    WALLET_ADDRESS as `0x${string}`,
    {
      "/a2a/guide": {
        price: "$0.01",
        network: "avalanche-fuji",
        config: {
          description: "AvaBuilder Agent - AI builder guide for Avalanche",
        },
      },
    },
    {
      url: FACILITATOR_URL as `${string}://${string}`,
    }
  )
);

// A2A guide endpoint (x402 protected - other agents pay to use this)
app.post("/a2a/guide", async (c) => {
  try {
    const body = await c.req.json();
    const request: GuideRequest = {
      question: body.question || "",
      topic: body.topic,
      level: body.level || "beginner",
      context: body.context,
    };

    if (!request.question) {
      return c.json({
        success: false,
        error: "Field 'question' is required",
      }, 400);
    }

    const response = await guide.askGuide(request);

    return c.json({
      success: true,
      agent: "AvaBuilder Agent",
      timestamp: new Date().toISOString(),
      ...response,
    });
  } catch (error) {
    console.error("Error in /a2a/guide:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});

// ---------- Server ----------

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`\n  AvaBuilder Agent v2.1 - http://localhost:${info.port}`);
  console.log(`  The first AI builder agent on Avalanche\n`);
  console.log(`  FREE:`);
  console.log(`  GET /                                  Health check`);
  console.log(`  GET /dashboard                         Avalanche AI Builder`);
  console.log(`  GET /.well-known/agent-card.json       ERC-8004 agent card`);
  console.log(`  GET /agents/discover                   Discover agents`);
  console.log(`  GET /api/market                        AVAX price + metrics`);
  console.log(`  GET /api/defi                          TVL + top protocols`);
  console.log(`  GET /api/token/:address                Token info (DEX + CoinGecko)`);
  console.log(`  GET /api/pairs/:address                Trading pairs`);
  console.log(`\n  PAID (x402 Agent-to-Agent):`);
  console.log(`  POST /a2a/guide  [$0.01 USDC]          AI builder guide\n`);
});
