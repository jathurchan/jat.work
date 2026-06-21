import { defineCollection, z } from 'astro:content';

// The blog. Every entry is a Markdown/MDX file in src/content/blog/ and renders
// to an internal post page at /blog/<slug>. Posts are articles on one of three
// topics: cloud computing, distributed systems, or AI.
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    /** Publish date (YYYY-MM-DD). Orders the feed and is shown on the card. */
    pubDate: z.coerce.date(),
    blurb: z.string(),
    /** Topic(s). The first one sets the card's colour and category label. */
    tags: z.array(z.enum(['cloud', 'systems', 'ai'])).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
