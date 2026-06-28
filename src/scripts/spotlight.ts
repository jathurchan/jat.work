// Cursor spotlight — a soft, brand-tinted highlight that follows the pointer
// across the site's glass cards. Each card exposes its pointer position as
// --mx/--my (percentages); the CSS paints a radial glow there (see the
// `[card]::after` rule in 01-base.css). Fine pointers only; off for touch and
// reduced-motion.
import { trackTeardown } from './lifecycle';

const SELECTOR = '.toolkit-cat, .route-card, .lab-card, .cluster-glass-container';

export function initSpotlight() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const cards = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
  if (cards.length === 0) return;

  let frame = 0;
  let pending: { el: HTMLElement; x: number; y: number } | null = null;

  const flush = () => {
    frame = 0;
    if (!pending) return;
    const { el, x, y } = pending;
    el.style.setProperty('--mx', `${x}%`);
    el.style.setProperty('--my', `${y}%`);
  };

  const onMove = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    pending = {
      el,
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    };
    if (!frame) frame = requestAnimationFrame(flush);
  };

  cards.forEach((c) => c.addEventListener('pointermove', onMove));

  trackTeardown(() => {
    if (frame) cancelAnimationFrame(frame);
    cards.forEach((c) => c.removeEventListener('pointermove', onMove));
  });
}
