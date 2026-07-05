// Hero niceties: the name collapse and the toolkit scroll-reveal.
import { trackTeardown, bindGlobal } from './lifecycle';

/* ----------------------------------------------------------------------- *
 * Hero name: "Jathurchan" collapses to "Jat." — trailing letters shrink to
 * zero width (right to left) and the period glides left to follow them.
 * Once settled, the short name becomes a signature hover: pointing at it
 * unfolds the full name again, leaving folds it back.
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

  let timers: number[] = [];
  const clearTimers = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  };

  // Collapse right to left as the name's rise lands (the reveal spring has
  // visually settled by ~950ms), so the whole intro reads as one gesture.
  const start = 950;
  const step = 95;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      drops
        .slice()
        .reverse()
        .forEach((d, i) => {
          timers.push(window.setTimeout(() => d.classList.add('drop-gone'), start + i * step));
        });
    }),
  );

  // The hover signature. Unfold reads left to right (the letters return in
  // reading order); fold mirrors the original collapse. Not decoration — it
  // answers "Jat who?". Fine pointers only; touch keeps the short name.
  const unfoldStep = 40;
  const unfold = () => {
    clearTimers();
    drops.forEach((d, i) =>
      timers.push(window.setTimeout(() => d.classList.remove('drop-gone'), i * unfoldStep)),
    );
  };
  const fold = () => {
    clearTimers();
    drops
      .slice()
      .reverse()
      .forEach((d, i) =>
        timers.push(window.setTimeout(() => d.classList.add('drop-gone'), i * unfoldStep)),
      );
  };

  let hoverArm = 0;
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    // Arm only after the intro collapse has fully played out.
    const settled = start + drops.length * step + 500;
    hoverArm = window.setTimeout(() => {
      wrap.addEventListener('mouseenter', unfold);
      wrap.addEventListener('mouseleave', fold);
    }, settled);
  }

  trackTeardown(() => {
    clearTimers();
    if (hoverArm) window.clearTimeout(hoverArm);
    wrap.removeEventListener('mouseenter', unfold);
    wrap.removeEventListener('mouseleave', fold);
  });
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

export function initHeroParallax() {
  const heroInner = document.querySelector<HTMLElement>('.hero-cinematic-header');
  if (!heroInner) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;

  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const y = window.scrollY;
        // Parallax translate down at 30% speed of scroll, fade out by 400px
        const yPos = y * 0.3;
        const opacity = Math.max(0, 1 - y / 400);
        heroInner.style.transform = `translate3d(0, ${yPos}px, 0)`;
        heroInner.style.opacity = opacity.toString();
        ticking = false;
      });
      ticking = true;
    }
  };

  bindGlobal(window, 'scroll', onScroll, { passive: true });
}

