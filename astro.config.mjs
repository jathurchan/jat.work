// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import yaml from '@rollup/plugin-yaml';

// https://astro.build/config
export default defineConfig({
  site: 'https://jat.work',
  // Serve readable, indented HTML: "View Source" is this site's origin story,
  // so the source should be worth viewing. Gzip/brotli on the wire absorbs
  // almost all of the whitespace cost.
  compressHTML: false,
  integrations: [
    mdx(),
    // Drop only the exact /raftlock redirect stub — it's a meta-refresh to
    // /#raftlock, not a real page. Anchored to the end so it never catches the
    // real /blog/raftlock-* posts.
    sitemap({ filter: (page) => !/\/raftlock\/?$/.test(page) }),
  ],
  vite: {
    plugins: [yaml()],
  },
  redirects: {
    '/raftlock': '/#raftlock'
  }
});