MCP Server Developer Experience (DX) — Idea Backlog

- Quickstart & Scaffolding
  - One-command init: `npx create-mcp-server` with TypeScript/Python/Go templates
  - Example servers: tool-only, resource-only, mixed, streaming, auth-required
  - Dockerfile + devcontainer + Makefile preset; hot-reload dev script

- Local Dev & Testing
  - Interactive Playground: invoke tools/resources, view request/response timeline
  - Contract tests from MCP schema; record/replay fixtures; deterministic mocks
  - “Stub mode” server for offline development

- SDK Ergonomics
  - Strongly-typed SDKs (TS/Python), decorators for tools/resources, input validation
  - Built-in streaming, cancellation, retries, timeouts, backpressure helpers
  - Middleware hooks: auth, logging, caching, rate limiting

- Observability & Debugging
  - Inspector UI: live sessions, spans, structured logs, diff between runs
  - OpenTelemetry tracing; correlation IDs; flamegraphs; request sampling
  - Error taxonomy and actionable diagnostics

- CI/CD & Deployment
  - GitHub Action: build, test, schema publish, canary/prod deploy
  - Serverless adapters (AWS Lambda/API Gateway), container recipe (ECS/Fargate)
  - Health/readiness endpoints; semantic versioning and backward-compat checks

- Security & Governance
  - Pluggable auth: API keys, OAuth, HMAC, SIWE; per-tool RBAC
  - Secrets management (AWS Secrets Manager), audit logs, PII redaction
  - Quotas/rate limits; usage metering hooks

- Registry & Discovery
  - MCP registry: searchable catalog of servers/tools with schemas and examples
  - Local discovery via manifest; remote fetching and compatibility checks

- Editor Integrations (Cursor/VS Code)
  - Code actions: generate tool/resource stubs from schema, inline test runner
  - Trace viewer panel; “Replay last run” and snapshot diff

- Documentation & Recipes
  - Minimal quickstart (<10 min), cookbook patterns, troubleshooting guides
  - End-to-end sample: agent + MCP server + persistence + deployment

- Performance Toolkit
  - Load-gen CLI for MCP; concurrency patterns; caching strategies
  - Connection pooling, streaming chunk size tuning, circuit breakers

DuckChain Web3 DX — MCP Server Plan (Idea Phase)

- Objectives
  - Make DuckChain development effortless in-editor: search docs, explain errors, and inspect chain state.
  - Provide quick access to faucet and basic on-chain actions without leaving the IDE.
  - Enable optional hosted analytics to identify documentation gaps and prioritize improvements.

- Core MCP Tools (API Surface)
  - `docs.search(query)` → returns relevant docs with snippets, scores, and citations
  - `docs.ask(question, context?)` → RAG answer with citations; supports code/error context
  - `errors.explain(input)` → parse stack traces, EVM reverts, RPC errors; outputs causes, fixes, and links
  - `chain.txLookup(txHash, chain)` → status, events/logs, decoded inputs/outputs, trace (if available)
  - `chain.addressInspect(address)` → balances, tokens, nonce, recent txs; network-aware
  - `chain.contractIntrospect(address|abi)` → read ABI, methods, known interfaces; detect proxies
  - `faucet.request(address, amount?)` → requests test tokens; rate-limited and network-gated

- Docs Intelligence
  - Pipeline: crawl official DuckChain docs, guides, and examples → chunk → embed → store.
  - RAG: query re-writing using code/error context; rank with hybrid (BM25 + embeddings).
  - Responses include citations to exact sections; support “open in browser” deep-links.
  - Feedback loop: thumbs up/down and “not found” categories feed analytics.

- Error Intelligence
  - Parsers for Hardhat/Foundry/ViEM/Ethers errors; decode EVM revert data and nested calls.
  - Map common signatures to remedies and docs; suggest concrete next actions.
  - Optional “reproduce minimal case” hints and links to playground templates.

- Chain Access
  - Integrate DuckChain RPC endpoints; optionally read from explorer/indexer APIs for speed.
  - Decode logs via known ABIs; auto-fetch verified ABIs from explorer when available.
  - Inline summaries: gas used, touched contracts, event highlights, failure hotspots.

- Faucet Experience
  - Simple command: “Request Duck test tokens” with current address; shows quota and ETA.
  - Anti-abuse: GitHub/OAuth proof or signed message + captcha; per-address/IP throttles.
  - Optional $DUCK-based priority tiers for higher developer quotas.

Network Strategy

- Testnet-only for all write actions (deploy, faucet, tx generation).
- Mainnet read-only supported via explicit `chain` parameter in tools (e.g., `chain.txLookup(txHash, "mainnet")`).
- Keep editor convenience to add networks (Chainlist payload), but no mainnet faucet.

Chain enum and examples

- Chain values: "testnet" | "mainnet".
- Example calls:
  - `chain.txLookup("0xabc...", "testnet")`
  - `chain.txLookup("0xmainnetTx...", "mainnet")`
  - `faucet.request("0xdevAddress")` (implicit testnet)

- Local vs Hosted MCP Strategy
  - Local (default): best privacy, offline dev, lowest latency; no external logs unless opted-in.
  - Hosted (optional): enables analytics—query gaps, failing tasks, missing docs, latency heatmaps.
  - Hybrid: local server with telemetry plugin that uploads anonymized aggregates to hosted backend.
  - Migration path: identical API surface for both; flip via env var or settings toggle.

- Privacy & Telemetry
  - Opt-in. Redact addresses/private data by default. Show exactly what’s sent.
  - Collect only aggregates: query types, unmatched intents, error classes, doc section CTR.
  - Export data portability (JSON) and delete-on-request controls.

- AWS + DuckChain Alignment
  - Hosted: API Gateway + Lambda for MCP endpoints; OpenSearch for hybrid search; S3 for corpora.
  - CloudWatch/X-Ray for metrics/traces; Secrets Manager for credentials.
  - Optional Bedrock KB or self-managed embedding (e.g., `text-embedding-3-large`).

- MVP Scope (Hackathon)
  - Implement 3 tools end-to-end: `docs.search`, `errors.explain`, `faucet.request`.
  - Add `chain.txLookup` basic: status, gas, event names.
  - Provide Cursor/VS Code commands: “Search DuckChain Docs”, “Explain Error”, “Request Faucet”, “View Tx”.
  - Ship local MCP server (Node/TS) with minimal UI panel for responses + citations.
  - Optional: deploy hosted mirror to AWS for telemetry demo (opt-in).

- Success Criteria
  - <10 minutes onboarding to first successful faucet + tx inspection.
  - 90%+ top-3 precision for doc queries tested with a seed set.
  - Actionable analytics report listing top 10 missing/ambiguous doc topics.

- Stretch Goals
  - Address inspector with token balances and approvals; proxy detection.
  - Contract playground: call read methods from ABI, generate code snippets.
  - “Docs Gapbot”: automatic GitHub issues/PR stubs for doc improvements based on analytics.

Judging Criteria Fit — DuckChain Web3 DX MCP

- Innovation & Creativity (25%)
  - AI-native docs and error intelligence integrated in-editor via MCP, beyond simple chat.
  - Chain-aware assistance: tx introspection, ABI/proxy detection, explorer deep links.
  - Embrace Duck identity: playful responses, $DUCK-tipped helper flows, faucet coaching.

- Technical Feasibility & User Experience (35%)
  - Feasible MVP: local MCP server in Node/TS; optional hosted mirror on AWS.
  - EVM-compatible RPC already supported by DuckChain; explorers available for linkage.
  - UX: single-command actions (“Explain Error”, “Request Faucet”, “View Tx”) with citations.

- DuckChain Ecosystem Fit (20%)
  - Duck Identity: lighthearted tone and mascots in UI copy; Telegram-native faucet path.
  - Duck Token Utility: optional $DUCK-gated developer quotas, tips, and priority features.

- Sustainability & Business Model (15%)
  - Hosted analytics for docs gap analysis (opt-in), sold B2B to DuckChain ecosystem teams.
  - Roadmap to SDK parity (TS/Python/Go) and registry; enterprises can host privately.

DuckChain Docs Integration Audit (from `duckchain.md`)

- Confirmed Endpoints & Tooling
  - RPC (Mainnet/Testnet): documented URLs; chain IDs 5545 (mainnet), 202105 (testnet).
  - Explorers: mainnet `scan.duckchain.io`; testnet `testnet-scan.duckchain.io` and OKX/OKLink.
  - Faucet: Telegram bot `Duckchain_Testnet_Faucet_bot` (24h limit, ~0.1 TON/claim).
  - Wallets: EVM compatible; MetaMask setup documented; Chainlist entries present.
  - Dev stacks: Hardhat/Foundry workflows with `.env` use of RPC URLs and private keys.
  - API docs: reference to `api.duckchain.io` noted for future integration.

- Immediate Integration Opportunities
  - Pre-bundle network constants (RPC, chain ID, Explorer) for chain-param tools; provide Chainlist payload for easy add-network.
  - `faucet.request` guides user to Telegram bot, tracks cooldowns, verifies credit receipt.
  - `chain.txLookup` returns explorer deep links and decodes events using verified ABIs.
  - Hardhat/Foundry recipes: generate `hardhat.config.ts`/Foundry commands from MCP prompts.
  - MetaMask helper: auto-provide Chainlist payload and one-click add-network JSON.

- Near-term Add-ons
  - Address inspector: balances, approvals, token list; proxy detection hints.
  - Contract introspection: fetch verified ABI from explorer; detect upgrade patterns.
  - Docs RAG: prioritize sections covering RPC, faucet rules, explorer usage, MetaMask.

- Open Questions / Assumptions
  - Is there an official explorer or indexer API for enriched tx/receipt/logs?
  - Is there a programmatic faucet API beyond the Telegram bot? If not, we’ll guide UX.
  - Preferred auth pattern for hosted MCP (API key, SIWE, OAuth)? Any rate limits?
  - Confirm `api.duckchain.io` endpoints and quotas for public developer use.

Hosted vs Self-Hosted Strategy

- Decision Drivers
  - Data sensitivity (error logs, addresses), latency needs, offline dev, team size.
  - Feature needs (analytics, team sharing), ops maturity (secrets, scaling), cost.

- Self-Hosted (Local/On-Prem)
  - Pros: maximum privacy, zero external dependency, best for regulated teams.
  - Cons: no centralized analytics by default, devs must manage updates and ops.
  - Fit: solo/hackathon, enterprises with strict data policies, air-gapped setups.

- Hosted (Managed Cloud)
  - Pros: instant onboarding, shared team history, analytics for docs gap insights.
  - Cons: telemetry concerns if misconfigured; dependency on vendor uptime.
  - Fit: small/medium teams wanting insights and collaboration with minimal ops.

- Hybrid (Recommended)
  - Local-first server; optional telemetry plugin sends anonymized aggregates.
  - Admin policy controls: redaction rules, sampling rate, off-switch per-namespace.
  - Same API across modes; env var or settings toggles hosting mode.

- Governance & Privacy
  - Explicit consent UX; viewable payloads; data export and deletion.
  - PI/Key redaction defaults; allow-list destinations; rotate tokens automatically.

ChainGPT Integration Hooks (from `chaingpt.md`)

- Use Cases
  - Smart-Contract Generator and Auditor for code scaffolding and preflight checks.
  - Web3 AI Chatbot for generalized Q&A fallback when docs lack answers.
  - AgenticOS for social/devrel automations (not MVP-critical but complementary).

- Access Model
  - APIs and SDKs available; plan for API key configuration and per-tool quotas.
  - Consider embedding Solidity LLM for on-device/codebase context generation.

Hackathon Win Strategy (Scope & Demo)

- Product: Duck Dev Copilot (MCP + Cursor/VS Code extension)
  - MVP tools: `docs.search`, `errors.explain`, `chain.txLookup`, `faucet.request`.
  - Differentiators: decoded reverts with code-fix suggestions + doc citations; tx heatmap; Duck branding; on-chain MCP manifest registry PoC.
  - Hosting: Hybrid default—local-first with optional opt-in telemetry to a lightweight hosted endpoint.

- Demo Script (5–7 min)
  1. Add network (auto Chainlist payload) → request faucet → confirm balance via RPC.
  2. Trigger revert → run `errors.explain` → apply suggested fix snippet.
  3. Deploy simple contract → `chain.txLookup` → show events, costs, explorer deep link.
  4. Show analytics: top missing doc queries + one suggested doc PR stub.
  - Optional: mainnet read-only—paste a mainnet tx hash with `chain=mainnet` to show parity.

- Success Metrics (live)
  - First-token time < 2 minutes; docs top-3 precision ≥ 90% on seed set; faucet success with cooldown guidance; one actionable docs-gap report.

7-Day Implementation Plan

- Day 1 — Foundations
  - Repo scaffold: MCP server (Node/TS), basic extension UI panel, mono/bi-repo setup.
  - Define network constants; accept `chain` param in chain tools (no switch required).
  - Write seed doc ingester and embedding store (local JSON/SQLite for dev).

- Day 2 — Docs Search + Panel
  - Implement `docs.search` with hybrid retrieval (BM25 + embeddings) and citations.
  - Extension: search panel with open-in-browser + copy snippet.
  - Seed evaluation set and measure top-3 precision.

- Day 3 — Error Intelligence
  - Implement `errors.explain`: parse Hardhat/Foundry/Ethers errors; decode reverts.
  - Map common errors to DuckChain docs; generate fix suggestions (optionally via ChainGPT Auditor/Generator API).
  - Extension: inline “Apply fix” code action where applicable.

- Day 4 — Chain Access
  - Implement `chain.txLookup`: status, gas, events, explorer links; ABI fetch from explorer if available.
  - Extension: tx viewer with event highlights and quick filters.

- Day 5 — Faucet + Polishing
  - Implement `faucet.request` UX guiding Telegram bot cooldown and verifying credit on RPC.
  - One-click add-network (Chainlist payload) + Hardhat/Foundry config generator.
  - Stabilize RAG prompts and precision; add loading/error states.

- Day 6 — Hybrid Telemetry + Analytics
  - Opt-in telemetry plugin: anonymized aggregates (query types, unmatched intents, error classes).
  - Hosted microservice on AWS (API Gateway + Lambda + OpenSearch) for basic analytics.
  - Generate “docs gaps” report and PR stub examples.

- Day 7 — Demo + Submission
  - Record 5–7 min demo; finalize README and submission form.
  - Smoke test end-to-end flows; produce performance numbers and seed-set accuracy.
  - Prepare backup local demo (no hosted dependency).

Locking the MVP

- Included: `docs.search`, `errors.explain`, `chain.txLookup(chain param)`, `faucet.request`.
- Excluded (stretch): `addressInspect`, `contractIntrospect`, registry PoC (only if time allows).

Technology Decisions

- Languages & Frameworks
  - TypeScript end-to-end.
  - MCP server: Node.js + TypeScript.
  - Frontend: T3 stack (Next.js + tRPC + Tailwind + Prisma optional), focusing on a minimal demo UI and a VS Code/Cursor extension panel.

- DuckChain Integration
  - viem (EVM): RPC calls to DuckChain Testnet/Mainnet via configured RPC URLs; Chain enum drives selection.
  - Explorer links: compose URLs for `scan.duckchain.io` and `testnet-scan.duckchain.io`.
  - Wallet ops: MetaMask add-network via Chainlist payload; no mainnet faucet.

- ChainGPT Integration
  - Use Smart Contract Auditor/Generator API for error-fix suggestions (behind an API key).
  - Use Web3 AI Chatbot API as fallback Q&A when docs search has low confidence.
  - Keep keys in local `.env`; optional hosted mode reads from AWS Secrets Manager.

- Retrieval & AI
  - RAG store: local SQLite/JSON for hackathon; embeddings via OpenAI-compatible endpoint or Bedrock substitute if needed.
  - Ranking: hybrid BM25 + vector; citations required.
  - Prompt templates tuned for dev errors, DuckChain context, and short actionable outputs.

- Telemetry (optional, opt-in)
  - API Gateway + Lambda + OpenSearch for aggregates; anonymized payloads.
  - Client-side redaction and sampling; toggle via env.


