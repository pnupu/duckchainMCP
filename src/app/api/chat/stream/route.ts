import { env } from "@/env";
import { McpClient } from "@/server/mcpClient";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: Msg[] };
    const last = messages[messages.length - 1]?.content ?? "";

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const enqueue = (text: string) => controller.enqueue(encoder.encode(text));

        try {
          const mcp = new McpClient();
          await mcp.start();

          // Decide tool based on prefix
          let raw = "";
          if (last.startsWith("/search ")) {
            const q = last.slice(8).trim();
            raw = await mcp.callTool<string>("docs.search", { query: q, k: 3 });
          } else if (last.startsWith("/tx ")) {
            const tx = last.slice(4).trim();
            raw = await mcp.callTool<string>("chain.txLookup", { txHash: tx, chain: "mainnet" });
          } else {
            raw = await mcp.callTool<string>("docs.search", { query: last, k: 3 });
          }

          await mcp.stop();

          // Stream summarization via OpenAI if available; otherwise, stream raw
          if (env.OPENAI_API_KEY) {
            try {
              const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  Authorization: `Bearer ${env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                  model: "gpt-4o-mini",
                  stream: true,
                  temperature: 0.2,
                  messages: [
                    { role: "system", content: "Summarize concisely for a developer. Keep citations as-is." },
                    { role: "user", content: raw },
                  ],
                }),
              });

              if (res.ok && res.body) {
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                 
                while (true) {
                  const { value, done } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  const parts = buffer.split("\n\n");
                  buffer = parts.pop() ?? "";
                  for (const part of parts) {
                    const line = part.trim();
                    if (!line.startsWith("data:")) continue;
                    const data = line.slice(5).trim();
                    if (data === "[DONE]") continue;
                    try {
                      const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
                      const delta = json.choices?.[0]?.delta?.content ?? "";
                      if (delta) enqueue(delta);
                    } catch {
                      // ignore malformed SSE chunk
                    }
                  }
                }
              } else {
                enqueue(raw);
              }
            } catch {
              enqueue(raw);
            }
          } else {
            enqueue(raw);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(encoder.encode(`Error: ${msg}`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
}


