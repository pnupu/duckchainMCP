import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { getEmbedding, getEmbeddings } from "@/server/rag/embeddings";
import { ensureStore, readDocs, writeDocs, topK, type RagDoc } from "@/server/rag/store";

export const ragRouter = createTRPCRouter({
  ingest: publicProcedure
    .input(
      z.object({
        docs: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            url: z.string().url().optional(),
            content: z.string().min(1),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      await ensureStore();
      const existing = await readDocs();
      const contents = input.docs.map((d) => d.content);
      const embeddings = await getEmbeddings(contents);
      const newDocs: RagDoc[] = input.docs.map((d, i) => ({ ...d, embedding: embeddings[i] ?? [] }));
      const merged = [...existing.filter((e) => !newDocs.some((n) => n.id === e.id)), ...newDocs];
      await writeDocs(merged);
      return { added: newDocs.length, total: merged.length };
    }),

  search: publicProcedure
    .input(z.object({ query: z.string().min(1), k: z.number().min(1).max(10).default(5) }))
    .mutation(async ({ input }) => {
      const embedding = await getEmbedding(input.query);
      const docs = await readDocs();
      const results = topK(embedding, docs, input.k).map(({ doc, score }) => ({
        id: doc.id,
        title: doc.title,
        url: doc.url,
        snippet: doc.content.slice(0, 400),
        score,
      }));
      return { results };
    }),
});


