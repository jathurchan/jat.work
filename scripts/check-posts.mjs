#!/usr/bin/env node
// Pre-publish blog validation: content/blog/*.{md,mdx} + content/series.yaml.
//
//   npm run check:posts
//
// Also runs automatically before `npm run build` (prebuild), so a broken post
// fails the deploy instead of shipping. Errors exit 1; warnings just print.
//
// Mirrors the zod schema in src/content.config.ts (title/pubDate/blurb/tags/
// draft) and adds the editorial checks the schema can't express: leftover
// template placeholders, series wiring, dead internal links, unbalanced code
// fences. Topics come from src/config/site.yaml's `filters`, the same source
// the site renders from, so a new topic added there is accepted here too.

import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BLOG_DIR = path.join(ROOT, 'content/blog');
const SERIES_FILE = path.join(ROOT, 'content/series.yaml');
const SITE_FILE = path.join(ROOT, 'src/config/site.yaml');
const PUBLIC_DIR = path.join(ROOT, 'public');

// Keys the content schema knows. Anything else in a post's frontmatter is a
// typo that zod would silently strip (e.g. `Draft: true` would NOT hide the
// post) — so an unknown key is an error here.
const KNOWN_KEYS = new Set(['title', 'pubDate', 'blurb', 'tags', 'draft']);

// Placeholders written by scripts/new-post.mjs — publishing them is a mistake.
const PLACEHOLDER_BLURB = 'One sentence shown under the title on the feed card.';
const PLACEHOLDER_BODY = 'Open with a short paragraph that frames the problem.';

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push({ file, msg });
const warn = (file, msg) => warnings.push({ file, msg });

/** Split a markdown file into { fm, body } or null when no frontmatter block. */
function splitFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { fm: m[1], body: m[2] } : null;
}

// ---- allowed topics, from the same YAML the site renders from -------------
const site = yamlLoad(await readFile(SITE_FILE, 'utf8'));
const TOPICS = new Set((site.filters ?? []).map((f) => f.id).filter((id) => id !== 'all'));

// ---- load every post -------------------------------------------------------
const files = (await readdir(BLOG_DIR)).filter(
  (f) => /\.(md|mdx)$/.test(f) && !f.startsWith('_'),
);
const posts = new Map(); // slug -> { file, data, body, draft }

for (const file of files.sort()) {
  const slug = file.replace(/\.(md|mdx)$/, '');
  const raw = await readFile(path.join(BLOG_DIR, file), 'utf8');

  if (!/^[a-z0-9-]+$/.test(slug)) {
    err(file, `filename must be a clean slug (a-z, 0-9, "-"); it becomes the URL /blog/${slug}`);
  }
  const lower = slug.toLowerCase();
  for (const other of posts.keys()) {
    if (other.toLowerCase() === lower) err(file, `slug collides with ${other}`);
  }

  const parts = splitFrontmatter(raw);
  if (!parts) {
    err(file, 'missing frontmatter block (--- ... ---)');
    continue;
  }

  let data;
  try {
    data = yamlLoad(parts.fm) ?? {};
  } catch (e) {
    err(file, `frontmatter is not valid YAML: ${e.reason ?? e.message}`);
    continue;
  }

  for (const key of Object.keys(data)) {
    if (!KNOWN_KEYS.has(key)) err(file, `unknown frontmatter key "${key}" (typo? schema knows: ${[...KNOWN_KEYS].join(', ')})`);
  }

  // title
  if (typeof data.title !== 'string' || !data.title.trim()) {
    err(file, 'missing title');
  } else if (data.title.length > 70) {
    warn(file, `title is ${data.title.length} chars — long for cards/OG images (aim ≤ 70)`);
  }

  // pubDate (js-yaml parses bare YYYY-MM-DD into a Date already)
  const date = data.pubDate instanceof Date ? data.pubDate : new Date(data.pubDate);
  if (!data.pubDate || Number.isNaN(date.valueOf())) {
    err(file, `pubDate "${data.pubDate ?? ''}" is not a valid date (want YYYY-MM-DD)`);
  } else if (date.valueOf() > Date.now() + 24 * 3600 * 1000) {
    warn(file, `pubDate ${date.toISOString().slice(0, 10)} is in the future — it will still publish (no scheduling)`);
  }

  // blurb
  if (typeof data.blurb !== 'string' || !data.blurb.trim()) {
    err(file, 'missing blurb (shown on the feed card and as the meta description)');
  } else if (data.blurb.trim() === PLACEHOLDER_BLURB) {
    err(file, 'blurb is still the new:post placeholder');
  } else if (data.blurb.length > 180) {
    warn(file, `blurb is ${data.blurb.length} chars — long for a card/meta description (aim ≤ 180)`);
  }

  // tags
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      err(file, 'tags must be a list, e.g. tags: [systems]');
    } else {
      for (const t of data.tags) {
        if (!TOPICS.has(t)) err(file, `unknown tag "${t}" (topics in site.yaml filters: ${[...TOPICS].join(', ')})`);
      }
      if (data.tags.length === 0) warn(file, 'no tags — the card renders without a topic colour/filter');
    }
  } else {
    warn(file, 'no tags — the card renders without a topic colour/filter');
  }

  // draft
  if (data.draft !== undefined && typeof data.draft !== 'boolean') {
    err(file, `draft must be true/false, got "${data.draft}"`);
  }

  // body
  const body = parts.body.trim();
  if (!body) err(file, 'body is empty');
  if (body.includes(PLACEHOLDER_BODY)) warn(file, 'body still contains new:post template text');
  const fences = (body.match(/^```/gm) ?? []).length;
  if (fences % 2 !== 0) err(file, 'unbalanced ``` code fences');

  posts.set(slug, { file, data, body, draft: data.draft === true });
}

// ---- cross-post checks: internal links + local images ---------------------
for (const [slug, p] of posts) {
  // /blog/<slug> links must point at an existing, published post.
  for (const m of p.body.matchAll(/\]\(\/blog\/([a-z0-9-]+)[)#?]/g)) {
    const target = m[1];
    if (!posts.has(target)) err(p.file, `links to /blog/${target}, which doesn't exist`);
    else if (posts.get(target).draft) warn(p.file, `links to /blog/${target}, which is a draft (404s until published)`);
  }
  // Local images must exist under public/.
  for (const m of p.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const src = m[1].split(/[?#]/)[0];
    if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) continue;
    if (!src.startsWith('/')) {
      warn(p.file, `image "${src}" is a relative path — use a /public path like /images/...`);
      continue;
    }
    try {
      await access(path.join(PUBLIC_DIR, src));
    } catch {
      err(p.file, `image ${src} not found under public/`);
    }
  }
  if (p.draft) warn(p.file, 'draft — hidden from feed, RSS and sitemap');
  void slug;
}

// ---- series.yaml -----------------------------------------------------------
let seriesDefs = [];
try {
  const rawSeries = yamlLoad(await readFile(SERIES_FILE, 'utf8'));
  seriesDefs = rawSeries?.series ?? [];
  if (!Array.isArray(seriesDefs)) {
    err('series.yaml', 'expected a top-level `series:` list');
    seriesDefs = [];
  }
} catch (e) {
  err('series.yaml', `cannot read/parse: ${e.reason ?? e.message}`);
}

const seen = new Map(); // part slug -> series id (a post can belong to one series)
for (const s of seriesDefs) {
  const label = `series.yaml (${s?.id ?? '?'})`;
  for (const field of ['id', 'name', 'topic', 'blurb']) {
    if (typeof s?.[field] !== 'string' || !s[field].trim()) err(label, `missing ${field}`);
  }
  if (s?.topic && !TOPICS.has(s.topic)) err(label, `unknown topic "${s.topic}"`);
  if (!Array.isArray(s?.parts) || s.parts.length === 0) {
    err(label, 'needs a non-empty `parts` list of blog slugs');
    continue;
  }
  for (const part of s.parts) {
    if (seen.has(part)) err(label, `part ${part} already listed in series "${seen.get(part)}"`);
    seen.set(part, s.id);
    const post = posts.get(part);
    if (!post) err(label, `part ${part} has no matching file content/blog/${part}.md`);
    else if (post.draft) warn(label, `part ${part} is a draft — the feed skips it and part numbering shifts`);
  }
}

// ---- report ----------------------------------------------------------------
const rel = (f) => (f.includes('.yaml') ? `content/${f.split(' ')[0]}` : `content/blog/${f}`);
for (const w of warnings) console.log(`\x1b[33m⚠ ${rel(w.file)}\x1b[0m  ${w.msg}`);
for (const e of errors) console.log(`\x1b[31m✗ ${rel(e.file)}\x1b[0m  ${e.msg}`);

const published = [...posts.values()].filter((p) => !p.draft).length;
const drafts = posts.size - published;
const summary = `${posts.size} post${posts.size === 1 ? '' : 's'} (${published} published${drafts ? `, ${drafts} draft` : ''}), ${seriesDefs.length} series`;

if (errors.length) {
  console.log(`\n\x1b[31m✗ ${summary} — ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.\x1b[0m`);
  process.exit(1);
}
console.log(`\x1b[32m✓ ${summary} — all good${warnings.length ? ` (${warnings.length} warning${warnings.length === 1 ? '' : 's'})` : ''}.\x1b[0m`);
