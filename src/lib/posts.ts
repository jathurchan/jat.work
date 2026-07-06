// Single source of truth for the blog: loading posts, grouping them into series,
// and locating a post within its series. Both the home feed (Feed.astro) and the
// post pages (Post.astro, rss.xml) read through here so the two never drift —
// reorder a series in site.yaml and the feed, the in-post series rail, the
// prev/next links, and the RSS feed all follow in lockstep.
import { getCollection, type CollectionEntry } from 'astro:content';
import { series as seriesDefs } from './site';

export type Post = CollectionEntry<'blog'>;

/** Every published (non-draft) post, newest first. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export interface SeriesInfo {
  id: string;
  name: string;
  topic: string;
  blurb: string;
  /** Resolved entries, in the reading order declared in site.yaml. */
  parts: Post[];
}

/** Resolve the series defined in site.yaml against the live post set. A series
 *  with no published parts is dropped, so half-written series never show. */
export function buildSeries(posts: Post[]): SeriesInfo[] {
  // Entry ids are the slugified filenames (Content Layer glob loader), so the
  // plain slugs in site.yaml's series `parts` key straight into them.
  const bySlug = new Map<string, Post>(posts.map((e) => [e.id, e]));
  return (seriesDefs ?? [])
    .map((s) => ({
      id: s.id,
      name: s.name,
      topic: s.topic,
      blurb: s.blurb,
      parts: s.parts
        .map((slug) => bySlug.get(slug))
        .filter((e): e is Post => Boolean(e)),
    }))
    .filter((g) => g.parts.length > 0);
}

export interface SeriesContext {
  series: SeriesInfo;
  /** 0-based position of this post within its series. */
  index: number;
  /** 1-based position, for display ("Part 2 of 6"). */
  number: number;
  total: number;
  prev: Post | null;
  next: Post | null;
}

/** The series a post belongs to, plus its position and neighbours — or null for
 *  a standalone post. */
export function seriesContextFor(slug: string, allSeries: SeriesInfo[]): SeriesContext | null {
  for (const series of allSeries) {
    const index = series.parts.findIndex((p) => p.id === slug);
    if (index === -1) continue;
    return {
      series,
      index,
      number: index + 1,
      total: series.parts.length,
      prev: index > 0 ? series.parts[index - 1] : null,
      next: index < series.parts.length - 1 ? series.parts[index + 1] : null,
    };
  }
  return null;
}

/** Reading-time estimate in minutes from raw markdown (~200 wpm), min 1. */
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Strip the repeated series prefix ("RaftLock:", "Inside RaftLock:") from a part
 *  title so it reads cleanly inside a series list or prev/next card. */
export function partLabel(title: string): string {
  const s = title.replace(/^(inside\s+)?[\w.-]+:\s*/i, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
