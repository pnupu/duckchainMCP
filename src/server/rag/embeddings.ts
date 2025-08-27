import { env } from "@/env";

const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

export async function getEmbedding(input: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input,
      model: OPENAI_EMBEDDING_MODEL,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI embeddings error: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }>; usage?: unknown };
  return json.data[0]?.embedding ?? [];
}

export async function getEmbeddings(inputs: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: inputs,
      model: OPENAI_EMBEDDING_MODEL,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI embeddings error: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }>; usage?: unknown };
  return json.data.map((d) => d.embedding ?? []);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let an = 0;
  let bn = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i]! * b[i]!;
    an += a[i]! * a[i]!;
    bn += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(an) * Math.sqrt(bn) || 1;
  return dot / denom;
}


