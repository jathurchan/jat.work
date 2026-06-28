// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import yaml from '@rollup/plugin-yaml';

// https://astro.build/config
export default defineConfig({
  site: 'https://jat.work',
  compressHTML: true,
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