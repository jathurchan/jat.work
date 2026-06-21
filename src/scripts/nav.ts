// Header section nav: disclosure menu + scroll-spy.
import { bindGlobal } from './lifecycle';

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
  compute(); // initial state
}
