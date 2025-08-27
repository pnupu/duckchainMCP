import http from "node:http";
import { URL } from "node:url";
import { getEmbedding } from "./rag/embeddings";
import { readDocs, topK } from "./rag/store";

export function startHttpServer(port = Number(process.env.PORT || 8787)) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.method === "POST" && url.pathname === "/search") {
        const body = await readBody(req);
        const { query, k = 5 } = JSON.parse(body || "{}") as { query: string; k?: number };
        if (!query) throw new Error("Missing query");
        const embedding = await getEmbedding(query);
        const docs = await readDocs();
        const results = topK(embedding, docs, k).map(({ doc, score }) => ({ id: doc.id, title: doc.title, url: doc.url, snippet: doc.content.slice(0, 400), score }));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ results }));
        return;
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: msg }));
    }
  });
  server.listen(port, () => {
    console.log(`[mcp-server] HTTP listening on :${port}`);
  });
  return server;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}


