// The home page's Open Graph card, generated at build time.
//
// The generic astro-og-canvas text card (og/[...route].ts) is right for posts —
// title + blurb is what a post *is* — but the home page's identity is the hero,
// so its card is drawn by hand to mirror it: "Hi, I'm Jat." over the intro.json
// window, traffic lights and all, closing on the "$ open jat.work" chip.
// Everything is sourced from site.yaml + the newest post, so the card can never
// drift from the live hero.
//
// Rendered with satori (layout + text-as-paths, so no font machinery needed
// downstream) and rasterised to PNG by sharp. Runs once per build.
import type { APIRoute } from 'astro';
import satori from 'satori';
import sharp from 'sharp';
import { intro } from '../../lib/site';
import { getPosts } from '../../lib/posts';

const WIDTH = 1200;
const HEIGHT = 630;

// Dark palette from 01-base.css — the card matches the dark hero (and the
// existing post cards) so shares look the same regardless of the viewer theme.
const C = {
  paper: '#121214',
  ink: '#e4e4e7',
  sub: '#a1a1aa',
  faint: '#84848f',
  line: 'rgba(255, 255, 255, 0.08)',
  glass: 'rgba(255, 255, 255, 0.045)',
  blue: '#60a5fa',
  green: '#4ade80',
  red: '#fb7185',
  yellow: '#facc15',
};

// Pillar colours arrive from site.yaml as CSS custom properties; the canvas
// has no cascade, so map them to the dark-palette hex values.
const varColor: Record<string, string> = {
  'var(--g-blue)': C.blue,
  'var(--g-green)': C.green,
  'var(--g-red)': C.red,
  'var(--g-yellow)': C.yellow,
};

// Same fontsource TTFs the post-card route loads (satori can't read the
// site's woff2 files). Fetched once per build.
const FONTS = [
  { name: 'Outfit', weight: 800 as const, url: 'https://api.fontsource.org/v1/fonts/outfit/latin-800-normal.ttf' },
  { name: 'JetBrains Mono', weight: 400 as const, url: 'https://api.fontsource.org/v1/fonts/jetbrains-mono/latin-400-normal.ttf' },
  { name: 'JetBrains Mono', weight: 500 as const, url: 'https://api.fontsource.org/v1/fonts/jetbrains-mono/latin-500-normal.ttf' },
];

/** Tiny hyperscript for satori's React-element shape. */
function h(type: string, style: Record<string, unknown>, ...children: unknown[]) {
  return {
    type,
    props: { style, children: children.length <= 1 ? children[0] : children },
  };
}

/** Mono text span; `pre` keeps satori from collapsing meaningful spaces. */
const t = (text: string, style: Record<string, unknown> = {}) =>
  h('span', { whiteSpace: 'pre', ...style }, text);

const ellipsize = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s);

export const GET: APIRoute = async () => {
  const fonts = await Promise.all(
    FONTS.map(async (f) => ({
      name: f.name,
      weight: f.weight,
      style: 'normal' as const,
      data: await fetch(f.url).then((r) => {
        if (!r.ok) throw new Error(`Failed to load font ${f.url}: ${r.status}`);
        return r.arrayBuffer();
      }),
    })),
  );

  // The manifest rows, exactly as the hero states them.
  const company = intro.company ?? '';
  const rolePrefix = company ? intro.role.split(company)[0] : intro.role;
  const latest = (await getPosts())[0] ?? null;

  const mono = 'JetBrains Mono';
  const rowStyle = { display: 'flex', alignItems: 'baseline' };
  const key = (name: string) => t(`  "${name}"`, { color: C.faint });
  const colon = t(': ', { color: C.faint });

  const windowRows = [
    // {
    h('div', rowStyle, t('{', { color: C.faint })),
    // "role": "Software Engineer & SRE at Google",
    h(
      'div',
      rowStyle,
      key('role'),
      colon,
      t(`"${rolePrefix.trim()} `),
      t(company, { color: C.blue, fontWeight: 500 }),
      t('",'),
    ),
    // "focus": ["cloud computing", "distributed systems", "AI"],
    h(
      'div',
      rowStyle,
      key('focus'),
      colon,
      t('['),
      ...intro.pillars.flatMap((p, i) => [
        t('"'),
        t(p.label, { color: varColor[p.color] ?? C.ink, fontWeight: 500 }),
        t('"'),
        ...(i < intro.pillars.length - 1 ? [t(', ', { color: C.faint })] : []),
      ]),
      t('],'),
    ),
    // "latest": "…newest post…" — live by construction, like the hero.
    ...(latest
      ? [
          h(
            'div',
            rowStyle,
            key('latest'),
            colon,
            t(`"${ellipsize(latest.data.title, 42)}"`),
          ),
        ]
      : []),
    // }
    h('div', rowStyle, t('}', { color: C.faint })),
  ];

  const trafficLight = (color: string) =>
    h('div', { width: 15, height: 15, borderRadius: '50%', backgroundColor: color });

  const card = h(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 34,
      backgroundColor: C.paper,
      // The post cards' treatment — an accent-tinted glow from the top,
      // grounding into charcoal — with the site's blue.
      backgroundImage: 'linear-gradient(180deg, #182a3f 0%, #121214 62%)',
      fontFamily: mono,
    },
    // ── "Hi, I'm  Jat." ──
    h(
      'div',
      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 },
      t("Hi, I'm", {
        fontSize: 27,
        fontWeight: 500,
        letterSpacing: '0.05em',
        color: C.sub,
      }),
      h(
        'div',
        {
          display: 'flex',
          fontFamily: 'Outfit',
          fontWeight: 800,
          fontSize: 148,
          lineHeight: 0.92,
          letterSpacing: '-0.045em',
          color: '#f4f4f5',
        },
        t('Jat'),
        t('.', { color: C.blue }),
      ),
    ),
    // ── the intro.json window ──
    h(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        border: `1px solid rgba(255, 255, 255, 0.10)`,
        backgroundColor: C.glass,
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
      },
      // title bar: traffic lights + filename
      h(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          padding: '13px 18px',
          gap: 10,
          borderBottom: `1px solid ${C.line}`,
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
        },
        trafficLight('#ff5f56'),
        trafficLight('#ffbd2e'),
        trafficLight('#27c93f'),
        h(
          'div',
          { display: 'flex', flex: 1, justifyContent: 'center' },
          t('intro.json', { fontSize: 19, color: C.sub }),
        ),
        // spacer mirroring the lights, so the filename sits truly centred
        h('div', { width: 65, height: 1 }),
      ),
      // body: the manifest
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 28px 24px',
          gap: 15,
          fontSize: 21,
          color: C.ink,
        },
        ...windowRows,
      ),
    ),
    // ── "$ open jat.work" — the hero's terminal chip, repointed at the site ──
    h(
      'div',
      {
        display: 'flex',
        alignItems: 'baseline',
        padding: '11px 24px',
        borderRadius: 999,
        border: '1px solid rgba(255, 255, 255, 0.14)',
        fontSize: 21,
        fontWeight: 500,
        letterSpacing: '0.02em',
      },
      t('$ ', { color: C.green }),
      t(`open ${new URL(import.meta.env.SITE ?? 'https://jat.work').hostname}`, { color: C.sub }),
    ),
  );

  const svg = await satori(card as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts,
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
