import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ---------- Types ----------

export interface GuideRequest {
  question: string;
  topic?: string;
  level?: "beginner" | "intermediate" | "advanced";
  context?: string;
}

export interface GuideResponse {
  answer: string;
  topic: string;
  level: string;
  sources: string[];
  relatedTopics: string[];
  nextSteps: string[];
}

export interface BuildTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
  steps: string[];
  tools: string[];
  estimatedTime: string;
  prerequisites: string[];
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  modules: LearningModule[];
  totalSteps: number;
}

interface LearningModule {
  title: string;
  description: string;
  topics: string[];
}

// ---------- Knowledge Base ----------

const TOPIC_MAP: Record<string, { file: string; label: string }> = {
  "l1": { file: "docs/avalanche-l1s.md", label: "L1/Subnet Creation" },
  "l1s": { file: "docs/avalanche-l1s.md", label: "L1/Subnet Creation" },
  "subnet": { file: "docs/avalanche-l1s.md", label: "L1/Subnet Creation" },
  "subnets": { file: "docs/avalanche-l1s.md", label: "L1/Subnet Creation" },
  "primary-network": { file: "docs/primary-network.md", label: "Primary Network" },
  "c-chain": { file: "docs/primary-network.md", label: "C-Chain" },
  "p-chain": { file: "docs/primary-network.md", label: "P-Chain" },
  "x-chain": { file: "docs/primary-network.md", label: "X-Chain" },
  "staking": { file: "docs/primary-network.md", label: "Staking & Validation" },
  "cross-chain": { file: "docs/cross-chain.md", label: "Cross-Chain Messaging" },
  "awm": { file: "docs/cross-chain.md", label: "Avalanche Warp Messaging" },
  "icm": { file: "docs/cross-chain.md", label: "Interchain Messaging" },
  "bridge": { file: "academy/token-bridges.md", label: "Token Bridges" },
  "bridges": { file: "academy/token-bridges.md", label: "Token Bridges" },
  "nodes": { file: "docs/nodes.md", label: "Node Operations" },
  "node": { file: "docs/nodes.md", label: "Node Operations" },
  "validator": { file: "docs/nodes.md", label: "Validator Setup" },
  "rpc": { file: "docs/rpcs.md", label: "RPC APIs" },
  "api": { file: "docs/api-reference.md", label: "API Reference" },
  "cli": { file: "docs/tooling.md", label: "Avalanche CLI & Tooling" },
  "tooling": { file: "docs/tooling.md", label: "Tooling" },
  "sdk": { file: "docs/tooling.md", label: "Avalanche SDK" },
  "evm": { file: "academy/l1-development.md", label: "EVM Development" },
  "solidity": { file: "academy/solidity-foundry.md", label: "Solidity & Foundry" },
  "foundry": { file: "academy/solidity-foundry.md", label: "Foundry on Avalanche" },
  "smart-contract": { file: "academy/solidity-foundry.md", label: "Smart Contracts" },
  "smart-contracts": { file: "academy/solidity-foundry.md", label: "Smart Contracts" },
  "tokenomics": { file: "academy/tokenomics.md", label: "Tokenomics & Fee Config" },
  "token": { file: "academy/tokenomics.md", label: "Token Design" },
  "x402": { file: "academy/x402-payments.md", label: "x402 Payments" },
  "payments": { file: "academy/x402-payments.md", label: "Payment Infrastructure" },
  "fundamentals": { file: "academy/fundamentals.md", label: "Avalanche Fundamentals" },
  "basics": { file: "common/avalanche-basics.md", label: "Avalanche Basics" },
  "consensus": { file: "academy/fundamentals.md", label: "Consensus Protocol" },
  "precompile": { file: "academy/l1-development.md", label: "Precompiles" },
  "precompiles": { file: "academy/l1-development.md", label: "Precompiles" },
  "defi": { file: "academy/solidity-foundry.md", label: "DeFi Development" },
  "chainlink": { file: "academy/chainlink.md", label: "Chainlink Integration" },
  "avacloud": { file: "academy/avacloud-apis.md", label: "AvaCloud APIs" },
  "integrations": { file: "integrations/integrations.md", label: "Ecosystem Integrations" },
  "entrepreneur": { file: "academy/entrepreneur.md", label: "Business & Fundraising" },
  "business": { file: "academy/entrepreneur.md", label: "Business Models" },
  "advanced": { file: "academy/advanced.md", label: "Advanced Topics" },
  "encryption": { file: "academy/advanced.md", label: "Encrypted Tokens" },
  "interchain": { file: "academy/interchain-messaging.md", label: "Interchain Messaging" },
};

const BUILD_TEMPLATES: BuildTemplate[] = [
  {
    id: "l1-basic",
    name: "Create Your First L1 Blockchain",
    description: "Deploy a custom L1 blockchain on Avalanche Fuji testnet using the Avalanche CLI",
    difficulty: "beginner",
    category: "L1 Development",
    steps: [
      "Install Avalanche CLI: curl -sSfL https://raw.githubusercontent.com/ava-labs/avalanche-cli/main/scripts/install.sh | sh -s",
      "Create your L1: avalanche blockchain create myL1",
      "Choose SubnetEVM as the VM",
      "Configure chain ID, token symbol, and gas settings",
      "Deploy to Fuji testnet: avalanche blockchain deploy myL1 --fuji",
      "Connect Core wallet to your L1 using the provided RPC URL",
      "Deploy a test smart contract on your L1",
    ],
    tools: ["Avalanche CLI", "Core Wallet", "Remix IDE"],
    estimatedTime: "30 minutes",
    prerequisites: ["Node.js 18+", "Basic terminal knowledge"],
  },
  {
    id: "l1-custom-evm",
    name: "Custom EVM with Precompiles",
    description: "Create a customized EVM blockchain with custom precompiled contracts for advanced functionality",
    difficulty: "advanced",
    category: "L1 Development",
    steps: [
      "Fork the precompile-evm repository",
      "Set up Go development environment",
      "Design your precompile interface in Solidity",
      "Implement the precompile logic in Go",
      "Register the precompile with the VM",
      "Write tests for your precompile",
      "Build and deploy your custom VM",
      "Create an L1 using your custom VM",
    ],
    tools: ["Go 1.21+", "Avalanche CLI", "Foundry", "Git"],
    estimatedTime: "2-4 hours",
    prerequisites: ["Go programming", "Solidity basics", "EVM understanding"],
  },
  {
    id: "erc20-token",
    name: "Deploy ERC-20 Token on Avalanche",
    description: "Create and deploy a custom ERC-20 token on Avalanche C-Chain using Foundry",
    difficulty: "beginner",
    category: "Smart Contracts",
    steps: [
      "Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup",
      "Create project: forge init my-token && cd my-token",
      "Write ERC-20 contract using OpenZeppelin",
      "Write deployment script",
      "Test: forge test",
      "Deploy to Fuji: forge script script/Deploy.s.sol --rpc-url https://api.avax-test.network/ext/bc/C/rpc --broadcast",
      "Verify on Snowtrace",
    ],
    tools: ["Foundry", "Solidity", "Core Wallet"],
    estimatedTime: "45 minutes",
    prerequisites: ["Basic Solidity", "Terminal familiarity"],
  },
  {
    id: "cross-chain-bridge",
    name: "Build a Cross-Chain Token Bridge",
    description: "Use Avalanche Interchain Token Transfer (ICTT) to bridge tokens between L1s",
    difficulty: "intermediate",
    category: "Cross-Chain",
    steps: [
      "Deploy two L1 blockchains on Fuji",
      "Deploy ERC20TokenHome contract on source L1",
      "Deploy ERC20TokenRemote contract on destination L1",
      "Set up AWM relayer between L1s",
      "Register the remote token with the home contract",
      "Test bridging tokens between L1s",
      "Verify balances on both chains",
    ],
    tools: ["Avalanche CLI", "Foundry", "AWM Relayer"],
    estimatedTime: "1-2 hours",
    prerequisites: ["L1 deployment experience", "Smart contract basics"],
  },
  {
    id: "defi-dex",
    name: "Build a DEX on Your L1",
    description: "Deploy a Uniswap V2-style DEX on your custom Avalanche L1",
    difficulty: "intermediate",
    category: "DeFi",
    steps: [
      "Create and deploy an L1 blockchain",
      "Deploy WAVAX wrapper contract",
      "Deploy UniswapV2Factory contract",
      "Deploy UniswapV2Router02 contract",
      "Create token pairs and add liquidity",
      "Build a frontend with ethers.js",
      "Test swaps and liquidity operations",
    ],
    tools: ["Avalanche CLI", "Foundry/Hardhat", "React/Next.js", "ethers.js"],
    estimatedTime: "3-5 hours",
    prerequisites: ["Smart contract experience", "Frontend basics"],
  },
  {
    id: "gaming-l1",
    name: "Gaming L1 with Custom Tokenomics",
    description: "Create a gaming-focused L1 with custom fee structure and native token",
    difficulty: "intermediate",
    category: "Gaming",
    steps: [
      "Design tokenomics: supply, inflation, fee structure",
      "Create L1 with custom genesis configuration",
      "Set low gas fees for gaming transactions",
      "Configure fee recipient for game treasury",
      "Deploy game NFT contracts (ERC-721/ERC-1155)",
      "Deploy game logic contracts",
      "Set up marketplace contract",
      "Connect with game frontend",
    ],
    tools: ["Avalanche CLI", "Foundry", "Unity/Unreal (optional)"],
    estimatedTime: "1-2 days",
    prerequisites: ["L1 basics", "Smart contract experience"],
  },
  {
    id: "rwa-tokenization",
    name: "Real World Asset Tokenization",
    description: "Tokenize real-world assets with compliance and access controls on Avalanche",
    difficulty: "advanced",
    category: "RWA",
    steps: [
      "Create a permissioned L1 with access controls",
      "Configure AllowList precompile for KYC/AML",
      "Deploy compliant ERC-20 token with transfer restrictions",
      "Implement role-based access control (admin, minter, transferer)",
      "Deploy oracle integration for asset pricing",
      "Build compliance dashboard",
      "Set up cross-chain bridge to C-Chain for liquidity",
    ],
    tools: ["Avalanche CLI", "Foundry", "Chainlink", "Core Wallet"],
    estimatedTime: "2-3 days",
    prerequisites: ["Smart contract experience", "Understanding of compliance"],
  },
  {
    id: "x402-agent",
    name: "Build an x402 Payment Agent",
    description: "Create an AI agent that accepts x402 micropayments on Avalanche",
    difficulty: "intermediate",
    category: "Payments & Agents",
    steps: [
      "Set up Node.js project with Hono framework",
      "Install x402-hono middleware",
      "Configure wallet and USDC contract addresses",
      "Implement payment-protected endpoints",
      "Register agent in ERC-8004 registry",
      "Set up A2A agent card endpoint",
      "Deploy to Railway/Vercel",
      "Get testnet USDC from Circle faucet",
    ],
    tools: ["Node.js", "TypeScript", "Hono", "x402-hono", "ethers.js"],
    estimatedTime: "2-3 hours",
    prerequisites: ["TypeScript/Node.js", "Basic blockchain knowledge"],
  },
];

const LEARNING_PATHS: LearningPath[] = [
  {
    id: "zero-to-l1",
    name: "Zero to L1 Builder",
    description: "Go from zero blockchain knowledge to deploying your own L1 on Avalanche",
    totalSteps: 24,
    modules: [
      {
        title: "Blockchain Fundamentals",
        description: "Understand consensus, chains, and the Avalanche architecture",
        topics: ["fundamentals", "consensus", "primary-network"],
      },
      {
        title: "EVM Deep Dive",
        description: "Master the Ethereum Virtual Machine and how Avalanche extends it",
        topics: ["evm", "solidity", "smart-contracts"],
      },
      {
        title: "L1 Creation",
        description: "Create, configure, and deploy your own L1 blockchain",
        topics: ["l1", "cli", "tokenomics"],
      },
      {
        title: "Advanced Customization",
        description: "Precompiles, custom VMs, and advanced configurations",
        topics: ["precompiles", "advanced"],
      },
    ],
  },
  {
    id: "defi-builder",
    name: "DeFi Builder Path",
    description: "Build DeFi protocols on Avalanche - from tokens to full DEXes",
    totalSteps: 18,
    modules: [
      {
        title: "Smart Contract Foundations",
        description: "Solidity, Foundry, and contract security",
        topics: ["solidity", "foundry", "smart-contracts"],
      },
      {
        title: "Token Engineering",
        description: "ERC-20, tokenomics, and fee configuration",
        topics: ["token", "tokenomics"],
      },
      {
        title: "DeFi Protocols",
        description: "Build DEXes, lending protocols, and yield farms",
        topics: ["defi", "integrations"],
      },
      {
        title: "Cross-Chain DeFi",
        description: "Bridge assets and build multi-chain DeFi",
        topics: ["cross-chain", "bridges", "interchain"],
      },
    ],
  },
  {
    id: "full-stack-web3",
    name: "Full-Stack Web3 on Avalanche",
    description: "Build complete dApps with frontend, contracts, and infrastructure",
    totalSteps: 20,
    modules: [
      {
        title: "Avalanche Basics",
        description: "Network architecture and developer tools",
        topics: ["basics", "tooling", "rpc"],
      },
      {
        title: "Smart Contracts",
        description: "Write, test, and deploy contracts",
        topics: ["solidity", "foundry"],
      },
      {
        title: "APIs & SDKs",
        description: "Integrate with Avalanche APIs and the SDK",
        topics: ["api", "sdk", "avacloud"],
      },
      {
        title: "Production Deployment",
        description: "Deploy, monitor, and scale your dApp",
        topics: ["nodes", "integrations"],
      },
    ],
  },
];

// ---------- AvalancheGuide Class ----------

export class AvalancheGuide {
  private anthropic: Anthropic | null = null;
  private knowledgeBasePath: string;
  private knowledgeCache = new Map<string, string>();

  constructor(knowledgeBasePath?: string) {
    this.knowledgeBasePath = knowledgeBasePath || "/Users/jquiceva/avalanche-skill";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  /**
   * Load knowledge from a specific topic file
   */
  private loadKnowledge(topic: string, maxLines: number = 2000): string {
    const mapping = TOPIC_MAP[topic.toLowerCase()];
    if (!mapping) return "";

    const cacheKey = `${mapping.file}:${maxLines}`;
    const cached = this.knowledgeCache.get(cacheKey);
    if (cached) return cached;

    const filePath = join(this.knowledgeBasePath, mapping.file);
    if (!existsSync(filePath)) return "";

    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const truncated = lines.slice(0, maxLines).join("\n");
      this.knowledgeCache.set(cacheKey, truncated);
      return truncated;
    } catch {
      return "";
    }
  }

  /**
   * Detect relevant topics from a question
   */
  private detectTopics(question: string): string[] {
    const q = question.toLowerCase();
    const detected: string[] = [];

    const keywords: Record<string, string[]> = {
      "l1": ["l1", "subnet", "blockchain", "chain", "cadena", "crear cadena", "crear blockchain", "deploy blockchain"],
      "smart-contracts": ["contract", "contrato", "solidity", "deploy", "erc20", "erc721", "nft"],
      "evm": ["evm", "virtual machine", "maquina virtual", "gas", "bytecode", "opcode"],
      "cross-chain": ["cross-chain", "bridge", "puente", "warp", "awm", "icm", "interchain", "teleporter"],
      "tokenomics": ["token", "tokenomics", "fee", "gas price", "supply", "mint", "burn"],
      "defi": ["defi", "dex", "swap", "liquidity", "liquidez", "yield", "lending", "prestamo", "amm"],
      "cli": ["cli", "command", "comando", "terminal", "avalanche cli", "install"],
      "sdk": ["sdk", "library", "libreria", "package", "npm"],
      "nodes": ["node", "nodo", "validator", "validador", "staking"],
      "rpc": ["rpc", "endpoint", "api call", "json-rpc"],
      "fundamentals": ["what is avalanche", "que es avalanche", "consensus", "consenso", "como funciona", "how does"],
      "x402": ["x402", "payment", "pago", "micropago", "402"],
      "integrations": ["integration", "integracion", "third party", "servicio"],
      "foundry": ["foundry", "forge", "cast", "anvil"],
      "precompiles": ["precompile", "precompilado", "custom opcode"],
      "basics": ["start", "empezar", "comenzar", "beginner", "principiante", "basico", "basic"],
      "entrepreneur": ["business", "negocio", "fundraising", "gtm", "market", "startup"],
      "advanced": ["access control", "permission", "permiso", "restrict", "encrypt"],
      "chainlink": ["chainlink", "oracle", "oraculo", "vrf", "random"],
      "avacloud": ["avacloud", "webhook", "data api"],
    };

    for (const [topic, words] of Object.entries(keywords)) {
      if (words.some((w) => q.includes(w))) {
        detected.push(topic);
      }
    }

    if (detected.length === 0) {
      detected.push("fundamentals");
    }

    return detected.slice(0, 3);
  }

  /**
   * Main guide function - answers any question about Avalanche
   */
  async askGuide(request: GuideRequest): Promise<GuideResponse> {
    const topics = this.detectTopics(request.question);
    const level = request.level || "beginner";

    // Load relevant knowledge
    const knowledgeParts: string[] = [];
    const sources: string[] = [];

    for (const topic of topics) {
      const knowledge = this.loadKnowledge(topic, 1500);
      if (knowledge) {
        const mapping = TOPIC_MAP[topic];
        knowledgeParts.push(`--- ${mapping?.label || topic} ---\n${knowledge}`);
        sources.push(mapping?.file || topic);
      }
    }

    const knowledgeContext = knowledgeParts.join("\n\n");

    // Find related topics
    const relatedTopics = this.getRelatedTopics(topics);
    const nextSteps = this.getNextSteps(topics, level);

    if (!this.anthropic) {
      return this.generateFallbackResponse(request, topics, sources, relatedTopics, nextSteps);
    }

    try {
      const systemPrompt = `You are AvaBuilder Agent — the first agentic builder on Avalanche. You are NOT a documentation bot. You are a hands-on co-builder that writes real code, generates real configs, and gets people building IMMEDIATELY.

YOUR PERSONALITY:
- You are a senior blockchain architect who BUILDS, not lectures
- You give WORKING CODE first, explanation second
- When someone asks "how to create an L1" you give them the exact commands to run RIGHT NOW
- You think in terms of shipping, not studying
- You adapt to the user's level but ALWAYS push them to build something concrete

YOUR KNOWLEDGE (128,000+ lines of official Avalanche documentation internalized):
- L1/Subnet creation: genesis configs, VM selection, validator setup, deployment
- Smart contracts: Solidity, Foundry, OpenZeppelin, deployment scripts, verification
- EVM customization: precompiles, gas configs, fee recipients, access controls
- Cross-chain: AWM, ICM contracts, ICTT token bridges, relayer setup
- Tokenomics: native tokens, fee structures, minting policies, governance
- Nodes: AvalancheGo setup, validator requirements, monitoring
- Tooling: Avalanche CLI (every command), SDK, AvaCloud APIs
- x402 payments: EIP-712, facilitator, USDC integration
- Full stack: React/Next.js frontends, ethers.js, wagmi, contract interaction

RESPONSE FORMAT:
1. Start with what to BUILD (the goal)
2. Give the EXACT commands or code to run
3. Use code blocks with the right language tag
4. Brief explanation of WHY only if needed
5. End with "Next:" and the immediate next action

LEVEL ADAPTATION for ${level}:
- beginner: Full commands with explanations, one step at a time, verify each step
- intermediate: Efficient commands, skip basics, focus on architecture decisions
- advanced: Minimal explanation, advanced patterns, production considerations, edge cases

LANGUAGE: Answer in the same language the user writes in (Spanish/English).

CRITICAL RULES:
- NEVER say "refer to the documentation" — YOU ARE the documentation, give the answer directly
- NEVER give generic advice — always give specific commands, code, addresses, configs
- When generating Solidity, ALWAYS target EVM version cancun (Avalanche doesn't support Pectra yet)
- Use Avalanche-specific RPC URLs: mainnet https://api.avax.network/ext/bc/C/rpc, fuji https://api.avax-test.network/ext/bc/C/rpc
- Fuji chain ID: 43113, Mainnet chain ID: 43114
- Default to Foundry over Hardhat for new projects
- Always include the install/setup step — assume nothing is installed`;

      const userMessage = `User question (level: ${level}): ${request.question}

${request.context ? `Additional context: ${request.context}` : ""}

Relevant documentation:
${knowledgeContext || "No specific documentation loaded for this topic."}`;

      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const answer = response.content[0].type === "text" ? response.content[0].text : "No response generated.";

      return {
        answer,
        topic: topics.map((t) => TOPIC_MAP[t]?.label || t).join(", "),
        level,
        sources,
        relatedTopics,
        nextSteps,
      };
    } catch (error) {
      console.error("Error calling Anthropic API:", error);
      return this.generateFallbackResponse(request, topics, sources, relatedTopics, nextSteps);
    }
  }

  /**
   * Fallback response when no API key is available
   */
  private generateFallbackResponse(
    request: GuideRequest,
    topics: string[],
    sources: string[],
    relatedTopics: string[],
    nextSteps: string[]
  ): GuideResponse {
    const topicLabels = topics.map((t) => TOPIC_MAP[t]?.label || t);

    let answer = `## About: ${topicLabels.join(", ")}\n\n`;
    answer += `Your question relates to: **${topicLabels.join(", ")}**.\n\n`;
    answer += `To get AI-powered detailed answers, configure your ANTHROPIC_API_KEY in the environment.\n\n`;
    answer += `### Quick Resources:\n`;

    for (const topic of topics) {
      const mapping = TOPIC_MAP[topic];
      if (mapping) {
        answer += `- **${mapping.label}**: Available in \`${mapping.file}\`\n`;
      }
    }

    answer += `\n### Key Links:\n`;
    answer += `- [Avalanche Docs](https://build.avax.network/docs)\n`;
    answer += `- [Avalanche Academy](https://build.avax.network/academy)\n`;
    answer += `- [Avalanche CLI](https://build.avax.network/docs/tooling/avalanche-cli)\n`;

    return {
      answer,
      topic: topicLabels.join(", "),
      level: request.level || "beginner",
      sources,
      relatedTopics,
      nextSteps,
    };
  }

  /**
   * Get related topics for further exploration
   */
  private getRelatedTopics(currentTopics: string[]): string[] {
    const relations: Record<string, string[]> = {
      "l1": ["tokenomics", "precompiles", "cli", "nodes"],
      "smart-contracts": ["foundry", "evm", "defi"],
      "evm": ["precompiles", "l1", "smart-contracts"],
      "cross-chain": ["bridges", "interchain", "l1"],
      "tokenomics": ["l1", "defi", "token"],
      "defi": ["smart-contracts", "tokenomics", "integrations"],
      "cli": ["l1", "sdk", "nodes"],
      "sdk": ["cli", "api", "rpc"],
      "nodes": ["staking", "validator", "rpc"],
      "fundamentals": ["basics", "evm", "l1"],
      "x402": ["payments", "integrations"],
      "foundry": ["solidity", "smart-contracts"],
      "precompiles": ["evm", "l1", "advanced"],
      "basics": ["fundamentals", "cli", "evm"],
    };

    const related = new Set<string>();
    for (const topic of currentTopics) {
      const rel = relations[topic] || [];
      for (const r of rel) {
        if (!currentTopics.includes(r)) {
          const label = TOPIC_MAP[r]?.label;
          if (label) related.add(label);
        }
      }
    }

    return Array.from(related).slice(0, 5);
  }

  /**
   * Suggest next steps based on current topics and level
   */
  private getNextSteps(topics: string[], level: string): string[] {
    const steps: string[] = [];

    if (level === "beginner") {
      steps.push("Install Avalanche CLI and create your first L1");
      steps.push("Get testnet AVAX from the faucet at core.app");
      steps.push("Deploy a simple smart contract on Fuji testnet");
    } else if (level === "intermediate") {
      steps.push("Customize your L1 with precompiles");
      steps.push("Set up cross-chain messaging between L1s");
      steps.push("Build a dApp with x402 payment integration");
    } else {
      steps.push("Build a custom VM for specialized use cases");
      steps.push("Implement production-grade cross-chain protocols");
      steps.push("Deploy to mainnet with proper validator setup");
    }

    return steps;
  }

  /**
   * Get build templates
   */
  getTemplates(category?: string): BuildTemplate[] {
    if (category) {
      return BUILD_TEMPLATES.filter(
        (t) => t.category.toLowerCase() === category.toLowerCase()
      );
    }
    return BUILD_TEMPLATES;
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(id: string): BuildTemplate | null {
    return BUILD_TEMPLATES.find((t) => t.id === id) || null;
  }

  /**
   * Get learning paths
   */
  getLearningPaths(): LearningPath[] {
    return LEARNING_PATHS;
  }

  /**
   * Get a specific learning path
   */
  getLearningPath(id: string): LearningPath | null {
    return LEARNING_PATHS.find((p) => p.id === id) || null;
  }

  /**
   * Get available topics
   */
  getTopics(): Array<{ key: string; label: string }> {
    const seen = new Set<string>();
    const result: Array<{ key: string; label: string }> = [];

    for (const [key, mapping] of Object.entries(TOPIC_MAP)) {
      if (!seen.has(mapping.label)) {
        seen.add(mapping.label);
        result.push({ key, label: mapping.label });
      }
    }

    return result;
  }

  /**
   * Get ecosystem overview
   */
  getEcosystemOverview(): Record<string, unknown> {
    return {
      name: "Avalanche",
      consensus: "Snowman (linear chain) + Avalanche (DAG)",
      chains: {
        "C-Chain": {
          purpose: "Smart contracts (EVM compatible)",
          chainId: { mainnet: 43114, fuji: 43113 },
        },
        "P-Chain": {
          purpose: "Platform chain - L1/Subnet management, staking",
        },
        "X-Chain": {
          purpose: "Exchange chain - asset transfers",
        },
      },
      keyFeatures: [
        "Sub-second finality",
        "Custom L1 blockchains (Subnets)",
        "EVM compatibility with customization",
        "Cross-chain messaging (AWM/ICM)",
        "x402 payment protocol",
        "ERC-8004 agent identity",
      ],
      tools: [
        "Avalanche CLI",
        "Core Wallet",
        "Foundry",
        "Avalanche SDK",
        "AvaCloud APIs",
      ],
      links: {
        docs: "https://build.avax.network/docs",
        academy: "https://build.avax.network/academy",
        faucet: "https://core.app/tools/testnet-faucet",
        explorer: "https://snowtrace.io",
        github: "https://github.com/ava-labs",
      },
    };
  }
}
