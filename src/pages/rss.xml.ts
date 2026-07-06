import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { meta, topicLabel } from '../lib/site';
import { getPosts } from '../lib/posts';

// /rss.xml — the writing feed. Posts come through the same getPosts() helper as
// the home feed and the post pages, so the RSS feed always matches what's
// published (newest first, drafts excluded). Linked from <head> on every page
// and from the footer.
export async function GET(context: APIContext) {
  const posts = await getPosts();
  const site = context.site ?? new URL('https://jat.work');

  return rss({
    title: 'Jathurchan Selvakumar — Writing',
    description: meta.description,
    site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.blurb,
      link: `/blog/${post.id}/`,
      categories: (post.data.tags ?? []).map((t) => topicLabel[t] ?? t),
    })),
    customData: '<language>en-us</language>',
  });
}
