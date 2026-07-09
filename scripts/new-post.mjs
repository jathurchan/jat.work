#!/usr/bin/env node
// Scaffold a new blog post in content/blog/ (repo root).
//
// Usage:
//   npm run new:post -- "My post title"
//   npm run new:post -- "My post title" --tag systems
//   npm run new:post -- "Draft idea" --draft --slug my-custom-slug
//
// Flags:
//   --tag    cloud | systems | ai | career   (default: cloud)
//   --slug   <slug>     override the auto-generated slug
//   --draft             mark as draft (hidden from the feed)
//   --force             overwrite if the file already exists

import { writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BLOG_DIR = fileURLToPath(new URL('../content/blog/', import.meta.url));
const TAGS = new Set(['cloud', 'systems', 'ai', 'career']);

function parseArgs(argv) {
  const opts = { tag: 'cloud', draft: false, force: false };
  const words = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--draft') opts.draft = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--tag') opts.tag = argv[++i];
    else if (a === '--slug') opts.slug = argv[++i];
    else if (a.startsWith('--')) fail(`Unknown flag: ${a}`);
    else words.push(a);
  }
  opts.title = words.join(' ').trim();
  return opts;
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function fail(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  console.error('  Usage: npm run new:post -- "My post title" [--tag cloud|systems|ai|career] [--slug s] [--draft]');
  process.exit(1);
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.title) fail('A post title is required.');
if (!TAGS.has(opts.tag)) fail(`--tag must be one of: ${[...TAGS].join(', ')}`);

const slug = opts.slug ? slugify(opts.slug) : slugify(opts.title);
if (!slug) fail('Could not derive a slug from the title — pass --slug.');

const pubDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const filePath = path.join(BLOG_DIR, `${slug}.mdx`);

// Build frontmatter. The title is single-quoted (with '' escaping) — unquoted,
// a title like "RaftLock: the client" is invalid YAML (colon starts a mapping).
const fm = [
  '---',
  `title: '${opts.title.replace(/'/g, "''")}'`,
  `pubDate: ${pubDate}`,
  `tags: ['${opts.tag}']`,
  'blurb: One sentence shown under the title on the feed card.',
];
if (opts.draft) fm.push('draft: true');
fm.push('---', '');

const body = `Open with a short paragraph that frames the problem.

## First section

Body text supports **bold**, *italics*, \`inline code\`, and [links](https://jat.work).

\`\`\`go
// fenced code blocks get syntax highlighting
\`\`\`

Close with the takeaway you want the reader to remember.
`;

const contents = fm.join('\n') + body;

try {
  await access(filePath);
  if (!opts.force) fail(`${path.relative(process.cwd(), filePath)} already exists (use --force to overwrite).`);
} catch {
  /* doesn't exist — good */
}

await writeFile(filePath, contents, 'utf8');

const rel = path.relative(process.cwd(), filePath);
console.log(`\x1b[32m✓ Created ${rel}\x1b[0m`);
console.log(`  tag: ${opts.tag}${opts.draft ? '  (draft)' : ''}  → /blog/${slug}`);
console.log('  Next: edit the blurb and body, then `npm run dev`.');
