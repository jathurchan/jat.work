// Reading-progress ring for blog posts.
//
// Fills as the *article* scrolls past and reaches 100% the instant the end of
// the post meets the bottom of the viewport — deliberately ignoring the footer
// below it, so the ring reflects "how much of the post is left", not "how far
// down the page". Self-contained: it manages its own teardown so it re-binds
// cleanly across Astro View Transitions without depending on the home entry.

let cleanup: (() => void) | null = null;

function initReadingProgress() {
  cleanup?.();
  cleanup = null;

  const ring = document.querySelector<SVGElement>('.ring-fill');
  const article = document.querySelector<HTMLElement>('.post-article');
  if (!ring || !article) return; // not a post page

  const update = () => {
    // Start: top of the article at the top of the viewport.
    // End:   bottom of the article at the bottom of the viewport (post fully read).
    const start = article.offsetTop;
    const end = start + article.offsetHeight - window.innerHeight;
    const span = end - start;
    const p = span > 0 ? (window.scrollY - start) / span : 1;
    ring.style.setProperty('--read-progress', String(Math.min(1, Math.max(0, p))));
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();

  cleanup = () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}

document.addEventListener('astro:page-load', initReadingProgress);

// Mark this file as a module so its top-level `cleanup` is module-scoped rather
// than a global (which would collide with toc.ts's same-named guard).
export {};
