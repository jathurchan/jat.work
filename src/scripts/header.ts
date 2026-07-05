// Header scroll state: condenses the floating pill and firms up its glass once
// the page scrolls. Shared by every page that renders the header (home, posts,
// 404) — self-contained like reading.ts/toc.ts: it re-binds on astro:page-load
// with its own module-scoped cleanup, so it doesn't depend on the home entry
// (app.ts) and never double-binds across View Transitions.

let cleanup: (() => void) | null = null;

function initHeaderScroll() {
  cleanup?.();
  cleanup = null;

  const header = document.querySelector('.site-header');
  if (!header) return;

  let ticking = false;
  // Hysteresis: switch ON above 24px, OFF below 8px. A single threshold let the
  // class flip-flop when scrollY hovered right at the line (the condensing pill
  // changes layout height, which can nudge scrollY back across it) — that was
  // the jitter. The dead-band between 8 and 24 stops the oscillation.
  let scrolled = window.scrollY > 24;
  const update = () => {
    const y = window.scrollY;
    if (!scrolled && y > 24) {
      scrolled = true;
      header.classList.add('is-scrolled');
    } else if (scrolled && y < 8) {
      scrolled = false;
      header.classList.remove('is-scrolled');
    }
    ticking = false;
  };

  // Apply the initial state too (a deep link can land mid-page).
  if (scrolled) header.classList.add('is-scrolled');

  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  cleanup = () => window.removeEventListener('scroll', onScroll);
}

document.addEventListener('astro:page-load', initHeaderScroll);

// Mark this file as a module so its top-level `cleanup` stays module-scoped.
export {};
