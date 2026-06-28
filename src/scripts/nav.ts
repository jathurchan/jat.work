// Header section nav: disclosure menu + scroll-spy.
import { bindGlobal } from './lifecycle';

/* ----------------------------------------------------------------------- *
 * Header scroll state: toggles the glassmorphic background on scroll.
 * ----------------------------------------------------------------------- */
export function initHeaderScroll() {
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

  update();

  bindGlobal(window, 'scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

/* ----------------------------------------------------------------------- *
 * Section nav scroll-spy: marks the section crossing the viewport's middle
 * as aria-current so the header reflects where you are on the page.
 * ----------------------------------------------------------------------- */
export function initSectionNav() {
  const menu = document.querySelector<HTMLElement>('[data-section-menu]');
  if (!menu) return;
  const btn = menu.querySelector<HTMLButtonElement>('.section-menu-btn');
  const list = menu.querySelector<HTMLElement>('.section-menu-list');
  const labelEl = menu.querySelector<HTMLElement>('[data-current-label]');
  const items = Array.from(menu.querySelectorAll<HTMLAnchorElement>('.section-menu-item'));
  if (!btn || !list || items.length === 0) return;

  const sections = items
    .map((i) => document.getElementById(i.dataset.spy || ''))
    .filter((s): s is HTMLElement => Boolean(s));
  if (sections.length === 0) return;

  // --- disclosure open/close ---
  const open = () => {
    btn.setAttribute('aria-expanded', 'true');
    list.hidden = false;
  };
  const close = () => {
    btn.setAttribute('aria-expanded', 'false');
    list.hidden = true;
  };
  // btn/items live in the swapped header DOM, so element listeners are fine
  // (replaced wholesale on navigation); only document-level ones need teardown.
  btn.addEventListener('click', () => (btn.getAttribute('aria-expanded') === 'true' ? close() : open()));
  items.forEach((it) => it.addEventListener('click', close));

  bindGlobal(document, 'click', (e) => {
    if (!menu.contains(e.target as Node)) close();
  });
  bindGlobal(document, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
      close();
      btn.focus();
    }
  });

  // --- scroll-spy ---
  // The current section is the last one whose top has scrolled past a reference
  // line near the top of the viewport. This is monotonic, so it never flickers
  // in the gaps between sections (the previous centre-line observer did). Above
  // the first section — i.e. in the hero — nothing is current, so the button
  // stays a neutral "Go to" prompt instead of mislabelling the hero.
  const DEFAULT_LABEL = 'Go to';
  // sort by document position so "last passed" is well-defined
  const ordered = sections.slice().sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );

  let currentId: string | null = null;
  // Stays false through the initial compute() so a deep-link hash (e.g. someone
  // opening /#experience) isn't stripped before the page has scrolled into it.
  // Once true, the spy keeps the hash in step with the section in view.
  let spyStarted = false;
  const iconEl = menu.querySelector<SVGElement>('.wayfinder-icon');
  const DEFAULT_ICON_HTML = '<circle cx="12" cy="12" r="8" class="wayfinder-ring"></circle><circle cx="12" cy="12" r="2.5" class="wayfinder-dot" fill="currentColor"></circle>';

  const render = (id: string | null) => {
    if (id === currentId) return;
    currentId = id;
    if (id) {
      menu.classList.remove('is-default');
      const active = items.find((it) => it.dataset.spy === id);
      items.forEach((it) =>
        it === active ? it.setAttribute('aria-current', 'true') : it.removeAttribute('aria-current'),
      );
      if (labelEl && active) labelEl.textContent = active.textContent?.trim() || '';
      if (iconEl && active) {
        const activeSvg = active.querySelector('svg');
        if (activeSvg) iconEl.innerHTML = activeSvg.innerHTML;
      }
    } else {
      menu.classList.add('is-default');
      items.forEach((it) => it.removeAttribute('aria-current'));
      if (labelEl) labelEl.textContent = DEFAULT_LABEL;
      if (iconEl) iconEl.innerHTML = DEFAULT_ICON_HTML;
    }

    // Keep the URL in step with the section you're actually viewing, so a reload
    // returns you here instead of to the last section you clicked. replaceState
    // doesn't add history entries or trigger a scroll/hashchange. We leave the
    // hash alone while the RaftLock demo owns it (#raftlock), and skip the very
    // first pass so a deep-link hash survives load (see spyStarted above).
    if (spyStarted && location.hash !== '#raftlock') {
      const target = id ? `#${id}` : '';
      if (location.hash !== target) {
        // Crucially, carry the existing state through instead of passing null.
        // Astro's View Transitions router stamps each entry with
        // { index, scrollX, scrollY }; nulling it out strips the `index` the
        // back button uses to tell "came from the site" apart from a deep link,
        // and wipes the scroll position Astro restores when you navigate back.
        // That's what broke "Back" from post pages once URL/section syncing
        // landed — keep the state, only swap the hash.
        const url = id ? `#${id}` : location.pathname + location.search;
        history.replaceState(history.state, '', url);
      }
    }
  };

  const compute = () => {
    const refLine = window.innerHeight * 0.3;
    let id: string | null = null;
    for (const s of ordered) {
      if (s.getBoundingClientRect().top <= refLine) id = s.id;
      else break;
    }
    
    // When the user reaches the absolute bottom (the footer), revert the button
    // back to the neutral "Go to" prompt rather than pinning the last section.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 20) {
      id = null;
    }
    
    render(id);
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      compute();
      ticking = false;
    });
  };
  bindGlobal(window, 'scroll', onScroll, { passive: true });
  bindGlobal(window, 'resize', onScroll);
  compute(); // initial state — runs with spyStarted false so it won't touch the URL
  spyStarted = true;
}
