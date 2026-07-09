// Hero niceties: the name collapse, the intro.json window controls, and the
// toolkit scroll-reveal.
import { trackTeardown } from './lifecycle';

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
  // Read every width first, then write — interleaving read/write here forced a
  // layout flush per letter (a small but real stall on the first paint of the
  // hero, the one place load jank is most visible).
  const dropWidths = drops.map((d) => d.getBoundingClientRect().width);
  drops.forEach((d, i) => {
    d.style.width = `${dropWidths[i]}px`;
  });

  let timers: number[] = [];
  const clearTimers = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  };

  // Return visit (View Transitions — is-vt-return set by app.ts): the reader
  // has seen the show. Land on the settled short name at once — transitions
  // muted for the jump, restored a frame later so the hover signature still
  // unfolds normally.
  const isReturn = document.documentElement.classList.contains('is-vt-return');

  // Collapse right to left as the name's rise lands (the reveal spring has
  // visually settled by ~950ms), so the whole intro reads as one gesture.
  const start = 950;
  const step = 95;
  if (isReturn) {
    drops.forEach((d) => {
      d.style.transition = 'none';
      d.classList.add('drop-gone');
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        drops.forEach((d) => {
          d.style.transition = '';
        });
      }),
    );
  } else {
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
  }

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
    // Arm only after the intro collapse has fully played out (immediately on
    // a return visit — the name is already settled).
    const settled = isReturn ? 0 : start + drops.length * step + 500;
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

/* ----------------------------------------------------------------------- *
 * intro.json window controls. The traffic lights are real: green expands the
 * file with the rows kept out of the first impression (education, based_in,
 * contact, links), yellow rolls the window up to its title bar, red closes it
 * into a "$ open intro.json" chip. Each state change FLIPs the wrapper's
 * outer size so the window morphs between its natural sizes instead of
 * snapping.
 * (The former scroll parallax + cursor text-shadow lived here; both wrote
 * style per frame against blurred/filtered layers and were the hero's main
 * jank source. The recede is now a compositor-side CSS scroll animation.)
 * ----------------------------------------------------------------------- */
export function initManifest() {
  const wrap = document.querySelector<HTMLElement>('.hero-manifest-wrapper');
  if (!wrap) return;
  const btnClose = wrap.querySelector<HTMLButtonElement>('.mac-close');
  const btnMin = wrap.querySelector<HTMLButtonElement>('.mac-min');
  const btnMax = wrap.querySelector<HTMLButtonElement>('.mac-max');
  const reopen = wrap.querySelector<HTMLButtonElement>('.manifest-reopen');
  const header = wrap.querySelector<HTMLElement>('.manifest-header');
  const body = wrap.querySelector<HTMLElement>('.hero-manifest');
  if (!btnClose || !btnMin || !reopen || !header || !body) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Once the load cascade has played, freeze the row reveals so hiding and
  // re-showing the body (minimize, close) can't replay the intro stagger.
  // Return visits (is-vt-return) skip the cascade entirely, so settle now.
  let settleTimer = 0;
  if (document.documentElement.classList.contains('is-vt-return')) {
    wrap.classList.add('is-settled');
  } else {
    settleTimer = window.setTimeout(() => wrap.classList.add('is-settled'), 1700);
  }

  let resizeTimer = 0;
  const morph = (change: () => void) => {
    wrap.classList.add('is-settled');
    if (reduce) {
      change();
      return;
    }
    window.clearTimeout(resizeTimer);
    // Fractional rects, not offsetWidth/Height: those round to integers, and
    // pinning the wrapper even half a pixel under its natural width used to
    // make the longest JSON row wrap for the duration of the morph.
    const from = wrap.getBoundingClientRect();
    change();
    // Measure the natural target size with any in-flight pin cleared, then
    // pin the old size, flush, and transition to the new one (.is-resizing
    // carries the width/height transition).
    wrap.classList.remove('is-resizing');
    wrap.style.width = '';
    wrap.style.height = '';
    body.style.width = '';
    const to = wrap.getBoundingClientRect();
    if (Math.abs(from.width - to.width) < 0.5 && Math.abs(from.height - to.height) < 0.5) return;
    // Belt to the fractional-pin braces: freeze the body at its natural final
    // width for the ride, so no in-between wrapper width can ever reflow the
    // rows — the moving frame clips fixed content, the way a real window
    // restore reveals a laid-out document.
    if (getComputedStyle(body).display !== 'none') {
      body.style.width = `${body.getBoundingClientRect().width}px`;
    }
    wrap.style.width = `${from.width}px`;
    wrap.style.height = `${from.height}px`;
    void wrap.offsetHeight;
    wrap.classList.add('is-resizing');
    wrap.style.width = `${to.width}px`;
    wrap.style.height = `${to.height}px`;
    resizeTimer = window.setTimeout(() => {
      wrap.classList.remove('is-resizing');
      wrap.style.width = '';
      wrap.style.height = '';
      body.style.width = '';
    }, 500);
  };

  const sync = () => {
    btnMin.setAttribute('aria-expanded', String(!wrap.classList.contains('is-min')));
    btnMax?.setAttribute('aria-expanded', String(wrap.classList.contains('is-expanded')));
  };

  btnMax?.addEventListener('click', () => {
    morph(() => {
      // Zoom restores a rolled-up window before growing it.
      if (wrap.classList.contains('is-min')) {
        wrap.classList.remove('is-min');
        wrap.classList.add('is-expanded');
      } else {
        wrap.classList.toggle('is-expanded');
      }
    });
    sync();
  });

  btnMin.addEventListener('click', () => {
    morph(() => wrap.classList.toggle('is-min'));
    sync();
  });

  // The folded title bar is its own affordance: clicking anywhere on it (bar
  // the dots, which keep their own jobs) unfolds the file.
  header.addEventListener('click', (e) => {
    if (!wrap.classList.contains('is-min')) return;
    if ((e.target as HTMLElement).closest('.mac-dot')) return;
    morph(() => wrap.classList.remove('is-min'));
    sync();
  });

  btnClose.addEventListener('click', () => {
    // Closing discards the window's state: a reopened file always starts back
    // at the compact three rows, not wherever the lights left it.
    morph(() => {
      wrap.classList.add('is-closed');
      wrap.classList.remove('is-replaying', 'is-expanded', 'is-min');
    });
    sync();
    reopen.focus({ preventScroll: true });
  });

  let replayTimer = 0;
  reopen.addEventListener('click', () => {
    // Reopening re-reads the file: the rows retype in a quick cascade
    // (.is-replaying — the load cascade's long delays wait for the name
    // collapse; a reopen shouldn't).
    morph(() => {
      wrap.classList.remove('is-closed');
      if (!reduce) wrap.classList.add('is-replaying');
    });
    sync();
    if (!reduce) {
      window.clearTimeout(replayTimer);
      replayTimer = window.setTimeout(() => wrap.classList.remove('is-replaying'), 1000);
    }
    btnClose.focus({ preventScroll: true });
  });

  trackTeardown(() => {
    window.clearTimeout(settleTimer);
    window.clearTimeout(resizeTimer);
    window.clearTimeout(replayTimer);
  });
}
