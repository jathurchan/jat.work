// Career route: drives the spine line's fill height from scroll.
import { bindGlobal } from './lifecycle';

/* ----------------------------------------------------------------------- *
 * Career route: the spine line draws itself as the section scrolls past. A
 * CSS view() timeline is unreliable here because the spine is far taller than
 * the viewport (the progress freezes), so we drive the fill height directly
 * from scroll — the line tracks a reading point near the middle of the screen.
 * ----------------------------------------------------------------------- */
export function initRouteProgress() {
  const route = document.querySelector<HTMLElement>('.route');
  const spine = document.querySelector<HTMLElement>('.route-spine');
  const fill = document.querySelector<HTMLElement>('.route-spine-fill');
  if (!route || !spine || !fill) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    // Show the completed line rather than animating it.
    fill.style.setProperty('--spine-h', `${spine.clientHeight}px`);
    fill.style.setProperty('--route-progress', `${spine.clientHeight}px`);
    return;
  }

  // Each stop lights up — disc, ring, card — as the reading point passes its
  // node, and dims again when the next one takes over. Exactly one is active at
  // a time, so the highlight walks the path with you instead of waiting on hover.
  const stops = Array.from(route.querySelectorAll<HTMLElement>('.route-stop'));
  let activeIdx = -1;

  let ticking = false;
  const compute = () => {
    const spineH = spine.clientHeight;
    fill.style.setProperty('--spine-h', `${spineH}px`);

    const rect = spine.getBoundingClientRect();
    const readLine = window.innerHeight * 0.5; // "you are here" point on screen
    // How far the reading point has travelled down the spine, clamped to it.
    const drawn = Math.max(0, Math.min(spineH, readLine - rect.top));
    fill.style.setProperty('--route-progress', `${drawn}px`);
    // Fade the leading tip in once drawing starts and out once it completes.
    const tip = drawn > 2 && drawn < spineH - 2 ? 1 : 0;
    fill.style.setProperty('--route-tip', String(tip));

    // Active stop = the last one whose node has crossed the reading line.
    const mark = window.innerHeight * 0.55;
    let idx = -1;
    for (let i = 0; i < stops.length; i++) {
      const node = (stops[i].querySelector('.route-node') as HTMLElement) ?? stops[i];
      const r = node.getBoundingClientRect();
      if (r.top + r.height / 2 <= mark) idx = i;
    }
    if (idx !== activeIdx) {
      stops.forEach((s, i) => s.classList.toggle('is-active', i === idx));
      activeIdx = idx;
    }
  };

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
