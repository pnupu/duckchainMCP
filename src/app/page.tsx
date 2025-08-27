"use client";
import { useEffect, useRef, useState } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - react-markdown types not set up in this project
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! Ask me about DuckChain. Try the examples below." },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-zinc-950 px-6 py-10">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-nobg.png" alt="Duck Dev Copilot" className="h-10 w-10" />
          <h1 className="text-3xl font-semibold text-zinc-100">Duck Dev Copilot</h1>
        </div>
        <p className="text-sm text-zinc-400">MCP-powered tools for DuckChain development. Use the examples or ask freely.</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <button className="rounded bg-zinc-800 px-3 py-1 text-zinc-100 hover:bg-zinc-700" onClick={() => setInput("/search DuckChain testnet faucet")}>Example: /search</button>
        <button className="rounded bg-zinc-800 px-3 py-1 text-zinc-100 hover:bg-zinc-700" onClick={() => setInput("/tx 0x16cbda8ef1b89fbe5744ff73d1359ada7b7a48332077d0301012e00169893807")}>Example: /tx</button>
        <button className="rounded bg-zinc-800 px-3 py-1 text-zinc-100 hover:bg-zinc-700" onClick={() => setInput("What is DuckChain gas price on mainnet?")}>Example: ask</button>
      </div>

      <div ref={scrollRef} className="min-h-[320px] max-h-[70vh] overflow-y-auto rounded border border-zinc-800 bg-zinc-900 p-3 space-y-2 text-zinc-100">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-words rounded border p-3 text-sm ${m.role === "assistant" ? "bg-zinc-800 border-zinc-700" : "bg-zinc-900 border-zinc-800"}`}
          >
            <div className={`mb-2 text-xs font-semibold ${m.role === "assistant" ? "text-sky-400" : "text-zinc-400"}`}>
              {m.role === "user" ? "You" : "Assistant"}
            </div>
            {m.role === "assistant" ? (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    a: (props) => (
                      <a
                        {...props}
                        className="text-sky-400 underline hover:text-sky-300"
                        target="_blank"
                        rel="noreferrer"
                      />
                    ),
                    code: ({ className, children, ...props }) => (
                      <code className={`rounded bg-zinc-800 px-1 py-0.5 text-zinc-100 ${className ?? ""}`} {...props}>
                        {children}
                      </code>
                    ),
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-zinc-200">{m.content}</div>
            )}
          </div>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text || isStreaming) return;
          const history = [...messages, { role: "user", content: text } as Msg];
          setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
          setInput("");
          setIsStreaming(true);
          try {
            const res = await fetch("/api/chat/stream", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ messages: history }),
            });
            if (!res.ok || !res.body) {
              setMessages((m) => {
                const copy = [...m];
                const lastIndex = copy.length - 1;
                const last = copy[lastIndex];
                if (last && last.role === "assistant") {
                  copy[lastIndex] = { role: "assistant", content: "Failed to stream response." };
                }
                return copy;
              });
              return;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
             
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              if (!chunk) continue;
              setMessages((m) => {
                const copy = [...m];
                const lastIndex = copy.length - 1;
                const last = copy[lastIndex];
                if (last && last.role === "assistant") {
                  copy[lastIndex] = { role: "assistant", content: last.content + chunk };
                }
                return copy;
              });
            }
          } catch (err) {
            setMessages((m) => {
              const copy = [...m];
              const lastIndex = copy.length - 1;
              const last = copy[lastIndex];
              if (last && last.role === "assistant") {
                const msg = err instanceof Error ? err.message : "Unknown error";
                copy[lastIndex] = { role: "assistant", content: `Error: ${msg}` };
              }
              return copy;
            });
          } finally {
            setIsStreaming(false);
          }
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message, or use /search query or /tx <hash>"
          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
        />
        <button disabled={isStreaming} className="rounded bg-zinc-800 px-4 py-2 text-zinc-100 hover:bg-zinc-700 disabled:opacity-50">
          {isStreaming ? "Sending..." : "Send"}
        </button>
      </form>
    </main>
  );
}
