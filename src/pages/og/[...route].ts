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
const theme: Record<string, [number, number, number]> = {
  cloud: [96, 165, 250],   // Soft Azure
  systems: [74, 222, 128], // Pastel Emerald
  ai: [251, 113, 133],     // Pastel Ruby
  career: [250, 204, 21],  // Soft Amber
  site: [96, 165, 250],    // Soft Azure
};

export const { getStaticPaths, GET } = await OGImageRoute({
  pages: {
    site: sitePage,
    ...Object.fromEntries(posts.map((p) => [p.id, p.data])),
  },
  getImageOptions: (_path, page) => {
    const accent = theme[page.tags?.[0]] ?? theme.site;
    const bgDark: [number, number, number] = [18, 18, 20]; // --paper in dark mode (approx #121214)
    const bgTint: [number, number, number] = [
      Math.round(accent[0] * 0.25),
      Math.round(accent[1] * 0.25),
      Math.round(accent[2] * 0.25),
    ];

    return {
      title: page.title,
      description: page.blurb,
      logo: {
        path: './public/favicon.svg',
        size: [72],
      },
      // Glow comes from the top down, grounding the card in darkness
      bgGradient: [bgTint, bgDark],
      border: {
        color: accent,
        width: 16,
        side: 'inline-start',
      },
      padding: 80,
      font: {
        title: {
          color: [228, 228, 231], // --ink dark mode
          size: 76,
          weight: 'ExtraBold', // corresponds to 800
          lineHeight: 1.15,
          families: ['Outfit', 'Inter'],
        },
        description: {
          color: [161, 161, 170], // --sub dark mode
          size: 32,
          lineHeight: 1.5,
          families: ['JetBrains Mono', 'Inter'],
        },
      },
      fonts: [
        'https://api.fontsource.org/v1/fonts/inter/latin-400-normal.ttf',
        'https://api.fontsource.org/v1/fonts/outfit/latin-800-normal.ttf',
        'https://api.fontsource.org/v1/fonts/jetbrains-mono/latin-500-normal.ttf',
      ],
    };
  },
});
