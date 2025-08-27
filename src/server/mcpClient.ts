import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { type CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "node:child_process";
import { once } from "node:events";

type ToolCall = { name: string; arguments: unknown };

export class McpClient {
  private child?: ReturnType<typeof spawn>;
  private ready = false;

  async start(): Promise<void> {
    if (this.ready) return;
    // Spawn MCP server in stdio mode
    this.child = spawn("node", ["packages/mcp-server/dist/index.js", "--stdio"], { stdio: ["pipe", "pipe", "inherit"] });
    await new Promise((resolve) => setTimeout(resolve, 200));
    this.ready = true;
  }

  async stop(): Promise<void> {
    this.child?.kill();
    this.ready = false;
  }

  async listTools(): Promise<string[]> {
    const res = await this.rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    return (res?.result?.tools ?? []).map((t: any) => t.name as string);
  }

  async callTool<T = unknown>(name: string, args: unknown): Promise<T> {
    const res = await this.rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } });
    const content = res?.result?.content?.[0]?.text ?? res?.result?.content?.[0]?.content ?? "";
    return content as T;
  }

  private async rpc(payload: any): Promise<any> {
    if (!this.child) throw new Error("MCP client not started");
    const proc = this.child;
    const data = JSON.stringify(payload) + "\n";
    proc.stdin?.write(data);
    const line = await readLine(proc);
    return JSON.parse(line);
  }
}

async function readLine(proc: ReturnType<typeof spawn>): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let buf = "";
    proc.stdout?.on("data", (chunk) => {
      buf += chunk.toString();
      const idx = buf.indexOf("\n");
      if (idx !== -1) {
        const line = buf.slice(0, idx);
        resolve(line);
      }
    });
    proc.on("error", reject);
  });
}


