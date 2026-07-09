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
  // Dev-only, but its floating dock sits over the page's own bottom-of-screen
  // content when testing layouts on a phone — and this site is checked on
  // real devices constantly. Nothing here uses its audits.
  devToolbar: { enabled: false },
  integrations: [
    mdx(),
    // Drop only the exact redirect stubs — they're meta-refreshes to home-page
    // anchors, not real pages. Matched against the whole pathname so the
    // pattern can never catch a real post like /blog/raftlock-*.
    sitemap({
      filter: (page) => !/^\/(raftlock|writing|blog|contact)\/?$/.test(new URL(page).pathname),
    }),
  ],
  vite: {
    plugins: [yaml()],
  },
  redirects: {
    '/raftlock': '/#raftlock',
    '/writing': '/#writing',
    // Posts live under /blog/<slug>, so people trim shared URLs to /blog and
    // expect the writing. /contact is the other URL strangers guess.
    '/blog': '/#writing',
    '/contact': '/#contact'
  }
});