#!/usr/bin/env node 

// Placeholder MCP server entrypoint. We'll wire tools next.
export function start() {
  console.log("@duck/mcp-server starting (stub)");
}

import { ingestMarkdownDir } from "./ingest";
import { startHttpServer } from "./http";
import { startStdIoServer } from "./mcp";

async function main() {
  const argvRaw = process.argv.slice(2);
  const args: string[] = Array.isArray(argvRaw) ? (argvRaw) : [];
  if (args.includes("--help")) {
    console.log(`Usage: duck-mcp [--ingest ./docs] [--http [port]] [--stdio]\n  Env: OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL`);
    process.exit(0);
  }
  const ingestIdx = args.indexOf("--ingest");
  if (ingestIdx !== -1) {
    const dir = args[ingestIdx + 1] ?? "";
    if (!dir) throw new Error("--ingest requires a directory path");
    const res = await ingestMarkdownDir(dir);
    console.log(`[mcp-server] Ingested ${res.added} docs. Total ${res.total}.`);
  }
  if (args.includes("--http")) {
    const portIdx = args.indexOf("--http") + 1;
    const maybePort = Number(args[portIdx] ?? NaN);
    startHttpServer(Number.isFinite(maybePort) ? maybePort : undefined);
  }
  if (args.includes("--stdio")) {
    void startStdIoServer();
  }
}

try {
  const invokedDirectly = import.meta.url === `file://${process.argv[1] ?? ""}`;
  if (invokedDirectly) {
    void main().catch((err: unknown) => {
      const msg = err instanceof Error ? err.stack ?? err.message : String(err);
      console.error(msg);
      process.exit(1);
    });
  }
} catch {
  // noop for environments without process
}


