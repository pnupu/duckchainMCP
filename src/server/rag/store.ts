import fs from "node:fs/promises";
import path from "node:path";
import { cosineSimilarity } from "./embeddings";

export type RagDoc = {
  id: string;
  title: string;
  url?: string;
  content: string;
  embedding: number[];
};

const DATA_DIR = path.join(process.cwd(), ".rag");
const DATA_FILE = path.join(DATA_DIR, "duckchain-docs.json");

export async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf-8");
  }
}

export async function readDocs(): Promise<RagDoc[]> {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const data = JSON.parse(raw) as RagDoc[];
  return data;
}

export async function writeDocs(docs: RagDoc[]): Promise<void> {
  await ensureStore();
  await fs.writeFile(DATA_FILE, JSON.stringify(docs, null, 2), "utf-8");
}

export function topK(queryEmbedding: number[], docs: RagDoc[], k = 5): Array<{ doc: RagDoc; score: number }> {
  const ranked = docs.map((doc) => ({ doc, score: cosineSimilarity(queryEmbedding, doc.embedding) }));
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, k);
}


