import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getEmbedding } from "./rag/embeddings";
import { readDocs, topK } from "./rag/store";

export async function startStdIoServer() {
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
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    if (name === "docs.search") {
      const query = (args)?.query as string;
      const k = Number((args)?.k ?? 5);
      if (!query) throw new Error("Missing query");
      const emb = await getEmbedding(query);
      const docs = await readDocs();
      const results = topK(emb, docs, k).map(({ doc, score }) => ({ id: doc.id, title: doc.title, url: doc.url, snippet: doc.content.slice(0, 400), score }));
      return { content: [{ type: "text", text: JSON.stringify({ results }) }] } as any;
    }
    if (name === "chain.txLookup") {
      const Schema = z.object({ txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), chain: z.enum(["testnet", "mainnet"]) });
      const parsed = Schema.safeParse(args);
      if (!parsed.success) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Invalid arguments", details: parsed.error.flatten() }) }] } as any;
      }
      const { txHash, chain } = parsed.data;
      if (chain === "mainnet") {
        const explorerBases = [
          (process.env.DUCKCHAIN_MAINNET_EXPLORER_API || "https://scan.duckchain.io/api/v2").replace(/\/$/, ""),
          "https://scan.duckchain.io" // some installs expose endpoints at root
        ];
        const explorerUrl = `https://scan.duckchain.io/tx/${txHash}`;
        // Try explorer API variants
        for (const base of explorerBases) {
          try {
            const txInfo = await httpJson(`${base}/transactions/${txHash}`);
            let logs: any = { items: [] };
            try {
              logs = await httpJson(`${base}/transactions/${txHash}/logs`);
            } catch {
              // ignore logs failure
            }
            const result = {
              chain,
              txHash,
              explorerUrl,
              tx: txInfo ?? null,
              logs: Array.isArray(logs?.items) ? logs.items : logs,
            };
            return { content: [{ type: "text", text: JSON.stringify(result) }] } as any;
          } catch {
            // try next base
          }
        }
        // Fallback to JSON-RPC using explorer-provided RPC URL (try both bases)
        let rpcUrl = process.env.DUCKCHAIN_MAINNET_RPC || "https://rpc.duckchain.io";
        for (const base of explorerBases) {
          try {
            const cfg = await httpJson(`${base}/config/json-rpc-url`);
            if (cfg?.json_rpc_url && typeof cfg.json_rpc_url === "string") {
              rpcUrl = cfg.json_rpc_url;
              break;
            }
          } catch {
            // ignore and continue
          }
        }
        const [tx, receipt] = await Promise.all([
          rpcCall(rpcUrl, "eth_getTransactionByHash", [txHash]),
          rpcCall(rpcUrl, "eth_getTransactionReceipt", [txHash]),
        ]);
        if (!tx) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Transaction not found", chain, txHash, explorerUrl }) }] } as any;
        }
        const result = {
          chain,
          txHash,
          explorerUrl,
          tx,
          receipt: receipt ?? null,
        };
        return { content: [{ type: "text", text: JSON.stringify(result) }] } as any;
      }
      // testnet best-effort via RPC (explorer is flaky)
      const rpcUrl = process.env.DUCKCHAIN_TESTNET_RPC || "https://testnet-rpc.duckchain.io";
      const explorerUrl = `https://testnet-scan.duckchain.io/tx/${txHash}`;
      try {
        const [tx, receipt] = await Promise.all([
          rpcCall(rpcUrl, "eth_getTransactionByHash", [txHash]),
          rpcCall(rpcUrl, "eth_getTransactionReceipt", [txHash]),
        ]);
        if (!tx) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Transaction not found", chain, txHash, explorerUrl }) }] } as any;
        }
        const result = {
          chain,
          txHash,
          explorerUrl,
          tx: tx,
          receipt: receipt ?? null,
        };
        return { content: [{ type: "text", text: JSON.stringify(result) }] } as any;
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Testnet RPC unavailable", details: String(e), chain, txHash, explorerUrl }) }] } as any;
      }
    }
    throw new Error(`Unknown tool: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

let _rpcId = 1;
async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<any> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: _rpcId++, method, params }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RPC error ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(`RPC ${method} error: ${JSON.stringify(json.error)}`);
  }
  return json.result ?? null;
}

async function httpJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return await res.json();
}


