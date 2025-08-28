# Duck Dev Copilot

MCP-powered tools for DuckChain development. This repo contains:

- Next.js app with a chat UI that streams responses
- Standalone MCP server (`@duck/mcp-server`) providing docs search, tx lookup, error explanations

## Prerequisites

- Node 20+
- PostgreSQL (for the scaffolded T3 DB; not required to try the chat)
- OpenAI API key (optional, for streaming summarization)

## Quick start

1. Install deps
   ```bash
   npm install
   ```
2. Environment
   - Create `.env` with at least:
     ```bash
     DATABASE_URL=postgres://user:pass@localhost:5432/db
     OPENAI_API_KEY=sk-... # optional
     ```
3. Start MCP server (stdio)
   ```bash
   npm run mcp:dev
   ```
4. Start web app
   ```bash
   npm run dev
   ```

Open http://localhost:3000 and use the examples or type queries. Responses stream as they are generated.

## Available MCP tools

- `docs.search` — local RAG over ingested markdown
- `chain.txLookup` — DuckChain mainnet transaction details (RPC fallback)
- `errors.explain` — classify error, suggest fixes, cite docs
- `explorer.latestTransactions` — mainnet latest tx feed

## Scripts

- `dev` — start Next.js
- `build` / `start` — build and run Next.js
- `mcp:dev` / `mcp:build` / `mcp:start` — develop/build/run MCP server
- `lint`, `typecheck`, `format:check` — quality

## Notes

- Dark theme is enabled globally; logo served from `/public/logo-nobg.png`.
- If `OPENAI_API_KEY` is not set, the chat streams raw tool output.
