import fs from "node:fs/promises";
import path from "node:path";
import { getEmbeddings } from "./rag/embeddings";
import { readDocs, writeDocs, type RagDoc } from "./rag/store";

export async function ingestMarkdownDir(dir: string): Promise<{ added: number; total: number }> {
  const abs = path.resolve(dir);
  const entries = await fs.readdir(abs);
  const mdFiles = entries.filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
  const chunkedDocs: Array<{ id: string; title: string; url?: string; content: string }> = [];
  for (const file of mdFiles) {
    const p = path.join(abs, file);
    const content = await fs.readFile(p, "utf-8");
    const title = firstHeading(content) ?? file;
    const baseId = path.basename(file);
    const chunks = chunkText(content, 2000, 200); // ~2k chars with 200 char overlap
    chunks.forEach((chunk, idx) => {
      chunkedDocs.push({ id: `${baseId}#${idx}`, title, url: undefined, content: chunk });
    });
  }

  const embeddings = await getEmbeddings(chunkedDocs.map((d) => d.content));
  const toAdd: RagDoc[] = chunkedDocs.map((d, i) => ({ ...d, embedding: embeddings[i] ?? [] }));
  const existing = await readDocs();
  const merged = [...existing.filter((e) => !toAdd.some((n) => n.id === e.id)), ...toAdd];
  await writeDocs(merged);
  return { added: toAdd.length, total: merged.length };
}

function firstHeading(md: string): string | null {
  const lines = md.split(/\r?\n/);
  for (const l of lines) {
    const m = /^#\s+(.+)/.exec(l);
    if (m) return m[1]!.trim();
  }
  return null;
}

function chunkText(text: string, targetSize = 2000, overlap = 200): string[] {
  const paras = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const para of paras) {
    if ((current + "\n\n" + para).length > targetSize && current.length > 0) {
      chunks.push(current);
      const tail = current.slice(Math.max(0, current.length - overlap));
      current = tail + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}


