// Hero niceties: the name collapse and the toolkit scroll-reveal.
import { trackTeardown } from './lifecycle';

/* ----------------------------------------------------------------------- *
 * Hero name: "Jathurchan" collapses to "Jat." — trailing letters shrink to
 * zero width (right to left) and the period glides left to follow them.
 * ----------------------------------------------------------------------- */
export function initName() {
  const wrap = document.getElementById('hero-name');
  if (!wrap) return;
  const drops = Array.from(wrap.querySelectorAll<HTMLElement>('.nm-drop'));
  if (!drops.length) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    // No animation: jump straight to the short name.
    drops.forEach((d) => {
      d.style.transition = 'none';
      d.style.width = '0';
      d.style.opacity = '0';
    });
    return;
  }

  // Pin each letter's natural width so the collapse animates from a real value.
  drops.forEach((d) => {
    d.style.width = `${d.getBoundingClientRect().width}px`;
  });

  // Collapse right to left after the name has risen in; overlapping steps keep
  // the dot moving continuously.
  const start = 1100;
  const step = 95;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      drops
        .slice()
        .reverse()
        .forEach((d, i) => {
          window.setTimeout(() => d.classList.add('drop-gone'), start + i * step);
        });
    }),
  );
}

export function initToolkitPulse() {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.toolkit-cat'));
  if (cards.length === 0) return;

  // Each card lights up in its accent colour as it scrolls into view, and stays
  // lit — so the colourful state happens on scroll, no hover needed.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          (e.target as HTMLElement).classList.add('is-inview');
          io.unobserve(e.target); // one-way reveal
        }
      }
    },
    { threshold: 0.45, rootMargin: '0px 0px -8% 0px' },
  );
  cards.forEach((c) => io.observe(c));
  trackTeardown(() => io.disconnect());
}
