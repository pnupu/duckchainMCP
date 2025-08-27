const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

if (!OPENAI_API_KEY) {
  // Don't throw immediately so that non-embedding commands (like --help) still work
  console.warn("[mcp-server] OPENAI_API_KEY is not set. Embedding features will fail until provided.");
}

export async function getEmbedding(input: string): Promise<number[]> {
  assertKey();
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input, model: OPENAI_EMBEDDING_MODEL }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI embeddings error: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }>; usage?: unknown };
  return json.data[0]?.embedding ?? [];
}

export async function getEmbeddings(inputs: string[]): Promise<number[][]> {
  assertKey();
  const MAX_BATCH = 100;
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += MAX_BATCH) {
    const slice = inputs.slice(i, i + MAX_BATCH);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: slice, model: OPENAI_EMBEDDING_MODEL }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI embeddings error: ${res.status} ${text}`);
    }
    const json = (await res.json()) as { data: Array<{ embedding: number[] }>; usage?: unknown };
    for (const d of json.data) out.push(d.embedding ?? []);
  }
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let an = 0;
  let bn = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    an += a[i]! * a[i]!;
    bn += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(an) * Math.sqrt(bn) || 1;
  return dot / denom;
}

function assertKey() {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for embeddings");
}


