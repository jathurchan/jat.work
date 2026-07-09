// Cross-page landing: arrive on the target section already settled.
//
// The page uses CSS `scroll-behavior: smooth`, which is right for in-page
// anchor clicks but wrong for View Transitions navigations: Astro's router
// resets a swapped-in page to the top and then scrolls to the destination —
// the hash target (a post's "All parts →" → /#writing) or the saved position
// (browser back) — with a scroll that honours that CSS. The viewport then
// cruises the full page height, playing every scroll-driven reveal between
// the hero and the destination like a toll road.
//
// astro:after-swap fires synchronously after the router starts that scroll and
// before anything paints, so re-asserting the destination here with an instant
// jump cancels the cruise: the crossfade lands straight on the settled section,
// the same way the hero skips its intro on a return (is-vt-return).
//
// In-page anchor navigations (header "Go to" menu, the Explore roulette) never
// fire astro:after-swap — the router short-circuits before the swap pipeline —
// so their smooth glide is untouched.
document.addEventListener('astro:after-swap', () => {
  const state = history.state as { scrollX?: number; scrollY?: number } | null;
  if (state && (state.scrollX || state.scrollY)) {
    // Back/forward: pin the position Astro is restoring.
    window.scrollTo({ left: state.scrollX, top: state.scrollY, behavior: 'instant' });
  } else if (location.hash) {
    // Fresh navigation to an anchor. scrollIntoView honours the section's
    // scroll-margin-top, so the landing matches a native anchor jump.
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    target?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
});

// Mark this file as a module (matches header.ts / reading.ts convention).
export {};
