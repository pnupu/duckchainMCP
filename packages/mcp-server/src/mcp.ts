import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getEmbedding } from "./rag/embeddings";
import { readDocs, topK } from "./rag/store";
let _transportMode: "stdio" | "http" = "stdio";
function logInfo(message: string, extra?: unknown) {
  const prefix = `[mcp-server] ${message}`;
  if (extra !== undefined) {
    try {
      const json = typeof extra === "string" ? extra : JSON.stringify(extra);
      if (_transportMode === "http") console.log(prefix + " " + json);
      else console.error(prefix + " " + json);
    } catch {
      if (_transportMode === "http") console.log(prefix);
      else console.error(prefix);
    }
  } else {
    if (_transportMode === "http") console.log(prefix);
    else console.error(prefix);
  }
}
function logError(message: string, error?: unknown) {
  const prefix = `[mcp-server] ${message}`;
  if (error !== undefined) {
    try {
      const json = typeof error === "string" ? error : JSON.stringify(error);
      console.error(prefix + " " + json);
    } catch {
      console.error(prefix);
    }
  } else {
    console.error(prefix);
  }
}

function buildServer(): Server {
  const server = new Server({ name: "duck-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "docs.search",
          description: "Semantic search over ingested DuckChain/ChainGPT docs",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
              k: { type: "number" },
            },
            required: ["query"],
          },
        },
        {
          name: "chain.txLookup",
          description: "Get transaction info from DuckChain (mainnet; testnet best-effort)",
          inputSchema: {
            type: "object",
            properties: {
              txHash: { type: "string" },
              chain: { type: "string", enum: ["testnet", "mainnet"] },
            },
            required: ["txHash", "chain"],
          },
        },
        {
          name: "errors.explain",
          description: "Explain common EVM/dev errors and suggest fixes with citations",
          inputSchema: {
            type: "object",
            properties: {
              message: { type: "string" },
              txHash: { type: "string" },
              chain: { type: "string", enum: ["testnet", "mainnet"] },
            },
            required: ["message"],
          },
        },
        {
          name: "explorer.latestTransactions",
          description: "Fetch latest mainnet transactions from explorer",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number" },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const startedAt = Date.now();
    let argsForLog: string | undefined;
    try { argsForLog = JSON.stringify(args); } catch { argsForLog = undefined; }
    logInfo(`tool ${name} start`, argsForLog);

    // docs.search
    if (name === "docs.search") {
      const SearchArgs = z.object({ query: z.string().min(1), k: z.number().optional() });
      const parsed = SearchArgs.safeParse(args);
      if (!parsed.success) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Invalid arguments", details: parsed.error.flatten() }) }] } as const;
      }
      const { query, k } = parsed.data;
      const emb = await getEmbedding(query);
      const docs = await readDocs();
      const results = topK(emb, docs, (k ?? 5)).map(({ doc, score }) => ({ id: doc.id, title: doc.title, url: doc.url, snippet: doc.content.slice(0, 400), score }));
      const result = { content: [{ type: "text", text: JSON.stringify({ results }) }] } as const;
      logInfo(`tool ${name} ok ${Date.now() - startedAt}ms`);
      return result;
    }

    // chain.txLookup
    if (name === "chain.txLookup") {
      const Schema = z.object({ txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), chain: z.enum(["testnet", "mainnet"]) });
      const parsed = Schema.safeParse(args);
      if (!parsed.success) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Invalid arguments", details: parsed.error.flatten() }) }] } as const;
      }
      const { txHash, chain } = parsed.data;
      if (chain === "mainnet") {
        const explorerBases: string[] = [
          (process.env.DUCKCHAIN_MAINNET_EXPLORER_API ?? "https://scan.duckchain.io/api/v2").replace(/\/$/, ""),
          "https://scan.duckchain.io",
        ];
        const explorerUrl = `https://scan.duckchain.io/tx/${txHash}`;
        for (const base of explorerBases) {
          try {
            const txInfo = await httpJson<unknown>(`${base}/transactions/${txHash}`);
            let logs: unknown = { items: [] as unknown[] };
            try {
              logs = await httpJson<unknown>(`${base}/transactions/${txHash}/logs`);
            } catch {}
            const logsItems = isLogItems(logs) ? logs.items : logs;
            const result = { chain, txHash, explorerUrl, tx: txInfo ?? null, logs: logsItems };
            logInfo(`tool ${name} ok ${Date.now() - startedAt}ms`);
            return { content: [{ type: "text", text: JSON.stringify(result) }] } as const;
          } catch {}
        }
        let rpcUrl = process.env.DUCKCHAIN_MAINNET_RPC ?? "https://rpc.duckchain.io";
        for (const base of explorerBases) {
          try {
            const cfg = await httpJson<{ json_rpc_url?: string }>(`${base}/config/json-rpc-url`);
            if (typeof cfg?.json_rpc_url === "string") { rpcUrl = cfg.json_rpc_url; break; }
          } catch {}
        }
        const txPromise = rpcCall<RpcTx | null>(rpcUrl, "eth_getTransactionByHash", [txHash]);
        const receiptPromise = rpcCall<RpcReceipt | null>(rpcUrl, "eth_getTransactionReceipt", [txHash]);
        const [tx, receipt] = await Promise.all([txPromise, receiptPromise]);
        if (!tx) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Transaction not found", chain, txHash, explorerUrl }) }] };
        }
        const result = { chain, txHash, explorerUrl, tx, receipt: receipt ?? null };
        logInfo(`tool ${name} ok ${Date.now() - startedAt}ms`);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
      const rpcUrl = process.env.DUCKCHAIN_TESTNET_RPC ?? "https://testnet-rpc.duckchain.io";
      const explorerUrl = `https://testnet-scan.duckchain.io/tx/${txHash}`;
      try {
        const txPromise = rpcCall<RpcTx | null>(rpcUrl, "eth_getTransactionByHash", [txHash]);
        const receiptPromise = rpcCall<RpcReceipt | null>(rpcUrl, "eth_getTransactionReceipt", [txHash]);
        const [tx, receipt] = await Promise.all([txPromise, receiptPromise]);
        if (!tx) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Transaction not found", chain, txHash, explorerUrl }) }] };
        }
        const result = { chain, txHash, explorerUrl, tx, receipt: receipt ?? null };
        logInfo(`tool ${name} ok ${Date.now() - startedAt}ms`);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (e) {
        logError(`tool ${name} fail ${Date.now() - startedAt}ms`, e);
        return { content: [{ type: "text", text: JSON.stringify({ error: "Testnet RPC unavailable", details: String(e), chain, txHash, explorerUrl }) }] };
      }
    }

    // errors.explain
    if (name === "errors.explain") {
      const Schema = z.object({ message: z.string().min(1), txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(), chain: z.enum(["testnet", "mainnet"]).optional() });
      const parsed = Schema.safeParse(args);
      if (!parsed.success) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Invalid arguments", details: parsed.error.flatten() }) }] };
      }
      const { message, txHash, chain } = parsed.data;
      const analysis = analyzeErrorMessage(message);
      let txSummary: unknown = null;
      if (txHash && chain === "mainnet") {
        const base = (process.env.DUCKCHAIN_MAINNET_EXPLORER_API ?? "https://scan.duckchain.io/api/v2").replace(/\/$/, "");
        try { txSummary = await httpJson<unknown>(`${base}/transactions/${txHash}/summary`); } catch {}
      }
      const query = buildSearchQueryFromAnalysis(analysis);
      const emb = await getEmbedding(query);
      const docs = await readDocs();
      const citations = topK(emb, docs, 3).map(({ doc, score }) => ({ id: doc.id, title: doc.title, score, snippet: doc.content.slice(0, 300) }));
      const result = { message, analysis, txSummary, citations };
      logInfo(`tool ${name} ok ${Date.now() - startedAt}ms`);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    // explorer.latestTransactions
    if (name === "explorer.latestTransactions") {
      const Args = z.object({ limit: z.number().optional() });
      const parsed = Args.safeParse(args);
      const limit = parsed.success && typeof parsed.data.limit === "number" ? parsed.data.limit : 10;
      const base = (process.env.DUCKCHAIN_MAINNET_EXPLORER_API ?? "https://scan.duckchain.io/api/v2").replace(/\/$/, "");
      let items: unknown[] = [];
      try {
        const data = await httpJson<{ items?: unknown[] }>(`${base}/main-page/transactions`);
        items = Array.isArray(data?.items) ? data.items : [];
      } catch {
        const data = await httpJson<{ items?: unknown[] }>(`${base}/transactions?limit=${encodeURIComponent(String(limit))}`);
        items = Array.isArray(data?.items) ? data.items : [];
      }
      const results = items.slice(0, limit).map((tRaw): { hash: string; status?: string; block?: number; timestamp?: string; from?: string; to?: string; explorerUrl: string } => {
        const t: Record<string, unknown> = typeof tRaw === "object" && tRaw !== null ? (tRaw as Record<string, unknown>) : {};
        const hash = typeof t.hash === "string" ? t.hash : "";
        const status = typeof t.status === "string" ? t.status : (typeof t.result === "string" ? t.result : undefined);
        const block = typeof t.block === "number" ? t.block : undefined;
        const timestamp = typeof t.timestamp === "string" ? t.timestamp : undefined;
        const fromObj: Record<string, unknown> | undefined = (typeof t.from === "object" && t.from !== null) ? (t.from as Record<string, unknown>) : undefined;
        const toObj: Record<string, unknown> | undefined = (typeof t.to === "object" && t.to !== null) ? (t.to as Record<string, unknown>) : undefined;
        const from = typeof fromObj?.hash === "string" ? fromObj.hash : (typeof t.from === "string" ? t.from : undefined);
        const to = typeof toObj?.hash === "string" ? toObj.hash : (typeof t.to === "string" ? t.to : undefined);
        return { hash, status, block, timestamp, from, to, explorerUrl: `https://scan.duckchain.io/tx/${hash}` };
      });
      const result = { results };
      logInfo(`tool ${name} ok ${Date.now() - startedAt}ms`);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

export async function startStdIoServer() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  _transportMode = "stdio";
  await server.connect(transport);
}

export async function startHttpServer(port = 3020) {
  const app = express();
  app.use(express.json());

  const transports: Record<string, SSEServerTransport> = {};

  app.get("/mcp", async (_req, res) => {
    try {
      const transport = new SSEServerTransport("/messages", res);
      transports[transport.sessionId] = transport;
      transport.onclose = () => { delete transports[transport.sessionId]; };
      const server = buildServer();
      await server.connect(transport);
    } catch (err) {
      if (!res.headersSent) res.status(500).send("Error establishing SSE stream");
      logError("SSE /mcp error", err);
    }
  });

  app.post("/messages", async (req, res) => {
    const rawSession = req.query.sessionId;
    const sessionId = typeof rawSession === "string" ? rawSession : Array.isArray(rawSession) ? rawSession[0] : "";
    const transport = transports[sessionId];
    if (!sessionId || !transport) {
      res.status(404).send("Session not found");
      return;
    }
    try {
      await transport.handlePostMessage(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
        req.body,
      );
    } catch (err) {
      if (!res.headersSent) res.status(500).send("Error handling request");
      logError("/messages error", err);
    }
  });

  await new Promise<void>((resolve) => {
    app.listen(port, () => resolve());
  });
  _transportMode = "http";
  logInfo(`HTTP listening on :${port}`);
}

let _rpcId = 1;
type RpcTx = { hash: string; from?: string; to?: string; value?: string; nonce?: string | number; gas?: string; gasPrice?: string; input?: string; blockHash?: string; blockNumber?: string };
type RpcReceipt = { status?: string; blockNumber?: string; gasUsed?: string; contractAddress?: string; logs?: Array<{ address: string; topics: string[]; data: string }>; };
async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: _rpcId++, method, params }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RPC error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { result?: T; error?: unknown };
  if (json.error != null) {
    throw new Error(`RPC ${method} error: ${JSON.stringify(json.error)}`);
  }
  return (json.result as T);
}

async function httpJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

function isLogItems(v: unknown): v is { items: unknown[] } {
  return typeof v === "object" && v !== null && Array.isArray((v as { items?: unknown[] }).items);
}

// keep single implementations (avoid duplicates)
function analyzeErrorMessage(msg: string): { kind: string; probableCauses: string[]; suggestedFixes: string[] } {
  const m = msg.toLowerCase();
  const causes: string[] = [];
  const fixes: string[] = [];
  let kind = "unknown";
  if (m.includes("insufficient funds for gas")) { kind = "insufficient_funds"; causes.push("Account balance too low to cover gas and value"); fixes.push("Fund the account or reduce gas/value"); }
  if (m.includes("nonce too low")) { kind = "nonce_too_low"; causes.push("Another pending tx with higher or equal nonce exists"); fixes.push("Wait for pending tx; or bump nonce; or replace properly"); }
  if (m.includes("replacement transaction underpriced") || m.includes("fee too low")) { kind = "underpriced_replacement"; causes.push("Replacement tx gas/fees not higher than previous pending"); fixes.push("Increase maxFeePerGas and maxPriorityFeePerGas"); }
  if (m.includes("execution reverted")) { kind = "execution_reverted"; causes.push("Contract revert condition hit"); fixes.push("Decode revert reason; check require/assert; verify input/state"); }
  if (m.includes("invalid sender")) { kind = "invalid_sender"; causes.push("From address mismatch or bad signature"); fixes.push("Check chainId, account, and signing key; avoid wrong RPC"); }
  if (m.includes("intrinsic gas too low")) { kind = "intrinsic_gas_too_low"; causes.push("Gas limit below intrinsic cost"); fixes.push("Increase gas limit; estimateGas again"); }
  if (m.includes("max priority fee per gas higher than max fee per gas")) { kind = "bad_eip1559_fees"; causes.push("EIP-1559 fee config invalid"); fixes.push("Ensure maxFeePerGas >= maxPriorityFeePerGas"); }
  if (kind === "unknown") { causes.push("Could not classify; see citations"); fixes.push("Search docs; verify RPC/network, signer, and transaction params"); }
  return { kind, probableCauses: causes, suggestedFixes: fixes };
}

function buildSearchQueryFromAnalysis(a: { kind: string }): string {
  switch (a.kind) {
    case "insufficient_funds": return "insufficient funds for gas DuckChain MetaMask viem ethers";
    case "nonce_too_low": return "nonce too low pending transaction replace DuckChain";
    case "underpriced_replacement": return "replacement transaction underpriced EIP-1559 duckchain";
    case "execution_reverted": return "execution reverted decode revert reason duckchain logs";
    case "invalid_sender": return "invalid sender wrong chainId duckchain";
    case "intrinsic_gas_too_low": return "intrinsic gas too low estimateGas duckchain";
    case "bad_eip1559_fees": return "max priority fee higher than max fee eip-1559 duckchain";
    default: return "duckchain error troubleshooting rpc explorer";
  }
}


