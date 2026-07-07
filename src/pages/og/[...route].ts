// Open Graph images, generated at build time.
//   /og/site.png    the site-wide card (home + any page without its own)
//   /og/<slug>.png  one card per published post
// All in the site's own voice — paper background, ink title, coloured edge —
// and generated from site.yaml/frontmatter, so they can never drift from the
// live design the way a hand-made og-image.jpg did.
import { OGImageRoute } from 'astro-og-canvas';
import { getCollection } from 'astro:content';
import { profile, intro } from '../../lib/site';

const posts = await getCollection('blog', ({ data }) => !data.draft);

// The site card reuses the hero's own lines from site.yaml.
const sitePage = {
  title: profile.fullName,
  blurb: `${intro.role}. ${intro.bio}`,
  tags: ['site'],
};

// Topic → brand colour (light palette from 01-base.css), as RGB for the canvas.
const topicRGB: Record<string, [number, number, number]> = {
  cloud: [2, 132, 199], // --g-blue
  systems: [5, 150, 105], // --g-green
  ai: [225, 29, 72], // --g-red
  career: [217, 119, 6], // --g-yellow
  site: [2, 132, 199], // site accent
};

// astro-og-canvas ≥0.13: OGImageRoute is async and infers the route param from
// this file's name; the default slug turns each page key into `<key>.png`.
export const { getStaticPaths, GET } = await OGImageRoute({
  pages: {
    site: sitePage,
    ...Object.fromEntries(posts.map((p) => [p.id, p.data])),
  },
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.blurb,
    bgGradient: [[252, 252, 252]], // --paper
    border: {
      color: topicRGB[page.tags?.[0]] ?? [24, 24, 27],
      width: 12,
      side: 'block-end',
    },
    padding: 72,
    font: {
      title: {
        color: [24, 24, 27], // --ink
        size: 60,
        weight: 'Bold',
        lineHeight: 1.15,
        families: ['Inter'],
      },
      description: {
        color: [82, 82, 91], // --sub
        size: 28,
        lineHeight: 1.5,
        families: ['Inter'],
      },
    },
    fonts: [
      'https://api.fontsource.org/v1/fonts/inter/latin-400-normal.ttf',
      'https://api.fontsource.org/v1/fonts/inter/latin-700-normal.ttf',
    ],
  }),
});
