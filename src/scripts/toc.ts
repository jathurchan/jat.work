// Table-of-contents scroll-spy for blog posts.
//
// Highlights the entry in the sticky "On this page" rail for the section you're
// currently reading — the last heading whose top has scrolled past a reference
// line near the top of the viewport (monotonic, so it never flickers in the gap
// between two headings). Self-contained: manages its own teardown so it re-binds
// cleanly across Astro View Transitions.

let cleanup: (() => void) | null = null;

function initToc() {
  cleanup?.();
  cleanup = null;

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'));
  if (links.length === 0) return; // not a post page, or no TOC

  // Pair each link with its heading, in document order.
  const targets = links
    .map((link) => {
      const id = link.dataset.tocLink || '';
      const heading = document.getElementById(id);
      return heading ? { link, heading } : null;
    })
    .filter((t): t is { link: HTMLAnchorElement; heading: HTMLElement } => Boolean(t));
  if (targets.length === 0) return;

  let activeLink: HTMLAnchorElement | null = null;
  const setActive = (link: HTMLAnchorElement | null) => {
    if (link === activeLink) return;
    activeLink?.removeAttribute('aria-current');
    if (link) link.setAttribute('aria-current', 'true');
    activeLink = link;
  };

  const compute = () => {
    const refLine = window.innerHeight * 0.25;
    let current = targets[0].link;
    for (const t of targets) {
      if (t.heading.getBoundingClientRect().top <= refLine) current = t.link;
      else break;
    }
    // At the very bottom of the page, pin the last entry so finishing the post
    // lands the highlight on its final section rather than mid-way up.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      current = targets[targets.length - 1].link;
    }
    setActive(current);
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

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  compute();

  cleanup = () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}

document.addEventListener('astro:page-load', initToc);

// Mark this file as a module so its top-level `cleanup` is module-scoped rather
// than a global (which would collide with reading.ts's same-named guard).
export {};
