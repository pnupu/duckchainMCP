import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { env } from "@/env";
import { McpClient } from "@/server/mcpClient";

export const chatRouter = createTRPCRouter({
  send: publicProcedure
    .input(z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })) }))
    .mutation(async ({ input }) => {
      const last = input.messages[input.messages.length - 1]?.content ?? "";
      if (last.startsWith("/search ")) {
        const q = last.slice(8).trim();
        const mcp = new McpClient();
        await mcp.start();
        const raw = await mcp.callTool<string>("docs.search", { query: q, k: 3 });
        await mcp.stop();
        const summary = await summarize(`Query: ${q}\n\n${raw}`);
        return { content: summary } as const;
      }
      if (last.startsWith("/tx ")) {
        const tx = last.slice(4).trim();
        const mcp = new McpClient();
        await mcp.start();
        const raw = await mcp.callTool<string>("chain.txLookup", { txHash: tx, chain: "mainnet" });
        await mcp.stop();
        const md = formatTxMarkdownFromMcp(raw);
        return { content: md } as const;
      }
      const mcp = new McpClient();
      await mcp.start();
      // Simple planner: prefer docs.search by default
      const raw = await mcp.callTool<string>("docs.search", { query: last, k: 3 });
      await mcp.stop();
      const summary = await summarize(raw);
      return { content: summary } as const;
    }),
});

async function summarize(text: string): Promise<string> {
  if (!env.OPENAI_API_KEY) return text;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Summarize concisely for a developer. Keep citations as-is." },
          { role: "user", content: text },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) return text;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? text;
  } catch {
    return text;
  }
}

function formatTxMarkdownFromMcp(raw: string): string {
  try {
    const obj = JSON.parse(raw) as {
      chain?: string;
      txHash?: string;
      explorerUrl?: string;
      tx?: any;
      receipt?: any;
    };
    const h = obj.tx ?? {};
    const status = h.result ?? h.status ?? "";
    const block = h.block ?? h.blockNumber ?? "";
    const ts = h.timestamp ?? "";
    const from = h.from?.hash ?? h.from ?? "";
    const to = h.to?.hash ?? h.to ?? "";
    const value = h.value ?? "0";
    const gasUsed = h.gas_used ?? h.gasUsed ?? "";
    const gasPrice = h.gas_price ?? h.base_fee_per_gas ?? h.gasPrice ?? "";
    const fee = typeof h.fee?.value === "string" ? h.fee.value : "";
    const explorer = obj.explorerUrl ?? (obj.txHash ? `https://scan.duckchain.io/tx/${obj.txHash}` : "");
    return `**Transaction (mainnet)**\n\n- **Hash**: ${obj.txHash ?? ""}\n- **Status**: ${status}\n- **Block**: ${block}\n- **Timestamp**: ${ts}\n- **From**: ${from}\n- **To**: ${to}\n- **Value**: ${value}\n- **Gas Used**: ${gasUsed}\n- **Gas Price**: ${gasPrice}\n- **Fee**: ${fee}\n\n[View in Explorer](${explorer})`;
  } catch {
    // Fallback: render as code block
    return `**Transaction**\n\n\`\`\`json\n${raw}\n\`\`\``;
  }
}


