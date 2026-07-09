// /apple-touch-icon.png — the home-screen icon iOS probes for at the site
// root (Android/Chrome uses it too via the <link> in Base.astro). Without it,
// "Add to Home Screen" falls back to a page screenshot.
//
// The artwork is the favicon's JAT monogram, but on a full-bleed tile: iOS
// rounds the corners itself, so the favicon's inset squircle would render as a
// tile-within-a-tile. PNG also can't carry the SVG's prefers-color-scheme
// trick, so the tile commits to the dark charcoal — same call as the OG cards.
// Rasterised by sharp at build time (the letters are paths, so no font
// machinery is involved).
import type { APIRoute } from 'astro';
import sharp from 'sharp';

const SIZE = 180;

// Gradients + letter paths copied verbatim from public/favicon.svg; the group
// transform nudges the letters (drawn for the favicon's inset tile) to the
// optical centre of the full-bleed square.
const svg = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="blue" x1="0.1" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#5B9CFF"/>
      <stop offset="1" stop-color="#1A5FE0"/>
    </linearGradient>
    <linearGradient id="redYellow" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0" stop-color="#EA4335"/>
      <stop offset="0.55" stop-color="#F6722A"/>
      <stop offset="1" stop-color="#FBBC05"/>
    </linearGradient>
    <linearGradient id="green" x1="0.4" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#46C764"/>
      <stop offset="1" stop-color="#0F8A3C"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#0E0E12"/>
  <g transform="translate(-42 -15)">
    <path fill="url(#green)" d="M300 152 L474 152 L474 208 L416 208 L416 392 L358 392 L358 208 L300 208 Z"/>
    <path fill="none" stroke="url(#blue)" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"
      d="M290 152 L290 320 Q290 390 222 390 Q156 390 150 322"/>
    <path fill="url(#redYellow)" d="M138 392 L256 150 L374 392 L318 392 L256 234 L194 392 Z"/>
  </g>
</svg>`;

export const GET: APIRoute = async () => {
  const png = await sharp(Buffer.from(svg)).resize(SIZE, SIZE).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
