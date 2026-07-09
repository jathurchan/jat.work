import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// The blog. Every entry is a Markdown/MDX file in content/blog/ (repo root, so
// publishing a post never touches src/) and renders to an internal post page
// at /blog/<id>. Posts cover the three technical pillars (cloud computing,
// distributed systems, AI) plus career — the personal side: how I got Google,
// interviews, growth, hard-won lessons.
//
// Astro 5 Content Layer: the glob loader replaces the legacy `type: 'content'`
// collection. The [^_]* pattern keeps underscore-prefixed files (_template.mdx)
// out of the collection, matching the legacy behaviour.
const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './content/blog' }),
  schema: z.object({
    title: z.string(),
    /** Publish date (YYYY-MM-DD). Orders the feed and is shown on the card. */
    pubDate: z.coerce.date(),
    blurb: z.string(),
    /** Topic(s). The first one sets the card's colour and category label. */
    tags: z.array(z.enum(['cloud', 'systems', 'ai', 'career'])).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
