import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const projects = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    order: z.number(),
    // Short tag on the tile, e.g. "solo" or "co-built".
    badge: z.string(),
    stack: z.array(z.string()),
    repo: z.string().optional(),
    // Path under /public (e.g. /demos/trading.mp4) or a URL. Empty shows a placeholder.
    demo: z.string().optional(),
    // Keys into public/status.json → projects.<slug>.<key>
    metrics: z.array(z.object({ key: z.string(), label: z.string(), unit: z.string().optional() })),
    diagram: z.array(z.object({ label: z.string(), note: z.string().optional() })),
  }),
});

export const collections = { projects };
