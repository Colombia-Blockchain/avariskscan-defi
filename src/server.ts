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
  ) {
    // Cleanup stale IPs every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const recent = timestamps.filter((t) => now - t < this.windowMs);
    if (recent.length >= this.maxRequests) return false;
    recent.push(now);
    this.requests.set(key, recent);
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.requests) {
      const recent = timestamps.filter((t) => now - t < this.windowMs);
      if (recent.length === 0) this.requests.delete(key);
      else this.requests.set(key, recent);
    }
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
    version: "2.1.0",
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

// Address validation helper
const isValidAddress = (addr: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(addr);

// Token info: DEX Screener + CoinGecko combined
app.get("/api/token/:address", async (c) => {
  try {
    const address = c.req.param("address");
    if (!isValidAddress(address)) {
      return c.json({ success: false, error: "Invalid address format. Expected 0x followed by 40 hex characters." }, 400);
    }
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
    if (!isValidAddress(address)) {
      return c.json({ success: false, error: "Invalid address format. Expected 0x followed by 40 hex characters." }, 400);
    }
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
      const chains = s.blockchains || [];
      const chain = chains[0];
      return {
        name: chain?.blockchainName || "Unknown",
        subnetId: s.subnetId,
        blockchainId: chain?.blockchainId || "",
        evmChainId: chain?.evmChainId || null,
        isL1: s.isL1,
        chainsCount: chains.length,
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

// ---------- FREE Knowledge & Builder routes ----------

// Ecosystem overview
app.get("/api/ecosystem", (c) => {
  const overview = guide.getEcosystemOverview();
  return c.json({ success: true, timestamp: new Date().toISOString(), ...overview });
});

// Available knowledge topics
app.get("/api/topics", (c) => {
  const topics = guide.getTopics();
  return c.json({ success: true, timestamp: new Date().toISOString(), count: topics.length, topics });
});

// Build templates
app.get("/api/templates", (c) => {
  const category = c.req.query("category");
  const templates = guide.getTemplates(category);
  return c.json({ success: true, timestamp: new Date().toISOString(), count: templates.length, templates });
});

// Specific build template
app.get("/api/templates/:id", (c) => {
  const template = guide.getTemplate(c.req.param("id"));
  if (!template) return c.json({ success: false, error: "Template not found" }, 404);
  return c.json({ success: true, timestamp: new Date().toISOString(), template });
});

// Learning paths
app.get("/api/learning", (c) => {
  const paths = guide.getLearningPaths();
  return c.json({ success: true, timestamp: new Date().toISOString(), count: paths.length, paths });
});

// Specific learning path
app.get("/api/learning/:id", (c) => {
  const path = guide.getLearningPath(c.req.param("id"));
  if (!path) return c.json({ success: false, error: "Learning path not found" }, 404);
  return c.json({ success: true, timestamp: new Date().toISOString(), path });
});

// ---------- MCP Server (Model Context Protocol) ----------

const MCP_TOOLS = [
  {
    name: "get_avax_price",
    description: "Get current AVAX price and 24h change from CoinGecko",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_avalanche_tvl",
    description: "Get Avalanche total TVL and top 10 DeFi protocols (excluding CEXs)",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_avalanche_defi",
    description: "Get top 50 Avalanche-native DeFi protocols sorted by TVL",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_token_info",
    description: "Get DEX trading data for a token on Avalanche by contract address",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string", description: "Token contract address (0x...)" } },
      required: ["address"],
    },
  },
  {
    name: "get_top_pairs",
    description: "Get top 30 trading pairs on Avalanche DEXs by 24h volume",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_avalanche_l1s",
    description: "Get all Avalanche L1 blockchains (subnets) from Glacier API",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_ecosystem_overview",
    description: "Get Avalanche ecosystem overview: chains, consensus, tools, key features, and links",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_build_templates",
    description: "Get step-by-step build templates for Avalanche (L1, ERC-20, DEX, bridge, gaming, RWA, x402 agent)",
    inputSchema: {
      type: "object",
      properties: { category: { type: "string", description: "Optional filter: l1, defi, cross-chain, token, gaming, rwa, agent" } },
      required: [],
    },
  },
  {
    name: "get_learning_paths",
    description: "Get structured learning paths for Avalanche development (Zero to L1, DeFi Builder, Full-Stack Web3)",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_topics",
    description: "List all available Avalanche knowledge topics the agent can answer questions about",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

// MCP initialize + tools/list + tools/call
app.post("/mcp", async (c) => {
  try {
    const body = await c.req.json();
    const { method, id, params } = body;

    // JSON-RPC response helper
    const rpcOk = (result: unknown) => c.json({ jsonrpc: "2.0", id, result });
    const rpcErr = (code: number, message: string) =>
      c.json({ jsonrpc: "2.0", id, error: { code, message } });

    if (method === "initialize") {
      return rpcOk({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "AvaBuilder Agent MCP", version: "2.1.0" },
      });
    }

    if (method === "tools/list") {
      return rpcOk({ tools: MCP_TOOLS });
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments || {};

      let result: unknown;

      switch (toolName) {
        case "get_avax_price": {
          const price = await defiAPIs.getAvalanchePrice();
          result = price ? { priceUsd: price.usd, change24h: price.usd_24h_change } : { error: "Price unavailable" };
          break;
        }
        case "get_avalanche_tvl": {
          const metrics = await defiAPIs.getAvalancheMetrics();
          result = { totalTVL: metrics.totalTVL, protocolCount: metrics.protocolCount, topProtocols: metrics.topProtocols };
          break;
        }
        case "get_avalanche_defi": {
          result = await defiAPIs.getAvalancheDeFiProtocols();
          break;
        }
        case "get_token_info": {
          if (!args.address || !/^0x[a-fA-F0-9]{40}$/.test(args.address)) {
            return rpcOk({ content: [{ type: "text", text: "Invalid address format" }], isError: true });
          }
          const pairs = await defiAPIs.getDexPairs(args.address);
          const top = pairs[0];
          result = top
            ? { name: top.baseToken.name, symbol: top.baseToken.symbol, priceUsd: top.priceUsd, volume24h: top.volume?.h24, liquidity: top.liquidity?.usd, pairs: pairs.length }
            : { error: "No DEX data found" };
          break;
        }
        case "get_top_pairs": {
          const pairs = await defiAPIs.getAvalancheTopPairs();
          result = pairs.map((p) => ({ pair: `${p.baseToken.symbol}/${p.quoteToken.symbol}`, dex: p.dexId, priceUsd: p.priceUsd, volume24h: p.volume?.h24 }));
          break;
        }
        case "get_avalanche_l1s": {
          const subnets = await defiAPIs.getAvalancheL1s();
          result = { count: subnets.length, l1s: subnets.slice(0, 50).map((s) => ({ subnetId: s.subnetId, isL1: s.isL1, name: s.blockchains?.[0]?.blockchainName || "Unknown" })) };
          break;
        }
        case "get_ecosystem_overview": {
          result = guide.getEcosystemOverview();
          break;
        }
        case "get_build_templates": {
          const templates = guide.getTemplates(args.category);
          result = { count: templates.length, templates: templates.map((t) => ({ id: t.id, name: t.name, category: t.category, difficulty: t.difficulty, description: t.description, steps: t.steps })) };
          break;
        }
        case "get_learning_paths": {
          const paths = guide.getLearningPaths();
          result = { count: paths.length, paths: paths.map((p) => ({ id: p.id, name: p.name, description: p.description, modules: p.modules })) };
          break;
        }
        case "get_topics": {
          result = guide.getTopics();
          break;
        }
        default:
          return rpcErr(-32601, `Tool not found: ${toolName}`);
      }

      return rpcOk({ content: [{ type: "text", text: JSON.stringify(result) }] });
    }

    return rpcErr(-32601, `Method not supported: ${method}`);
  } catch (error) {
    return c.json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error" } }, 500);
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
  console.log(`\n  AvaBuilder Agent v2.1.0 - http://localhost:${info.port}`);
  console.log(`  The first AI builder agent on Avalanche\n`);
  console.log(`  FREE:`);
  console.log(`  GET /                                  Health check`);
  console.log(`  GET /dashboard                         Avalanche AI Builder`);
  console.log(`  GET /.well-known/agent-card.json       ERC-8004 agent card`);
  console.log(`  GET /agents/discover                   Discover agents`);
  console.log(`  GET /api/market                        AVAX price + metrics`);
  console.log(`  GET /api/defi                          TVL + top protocols`);
  console.log(`  GET /api/avax-defi                     Avalanche DeFi protocols`);
  console.log(`  GET /api/l1s                           Avalanche L1 blockchains`);
  console.log(`  GET /api/top-pairs                     Top Avalanche trading pairs`);
  console.log(`  GET /api/token/:address                Token info (DEX + CoinGecko)`);
  console.log(`  GET /api/pairs/:address                Trading pairs`);
  console.log(`  GET /api/ecosystem                     Avalanche ecosystem overview`);
  console.log(`  GET /api/topics                        Knowledge topics`);
  console.log(`  GET /api/templates                     Build templates`);
  console.log(`  GET /api/templates/:id                 Specific template`);
  console.log(`  GET /api/learning                      Learning paths`);
  console.log(`  GET /api/learning/:id                  Specific learning path`);
  console.log(`  GET /public/:filename                  Static files`);
  console.log(`  POST /mcp                              MCP server (10 tools)`);
  console.log(`\n  PAID (x402 Agent-to-Agent):`);
  console.log(`  POST /a2a/guide  [$0.01 USDC]          AI builder guide\n`);
});
