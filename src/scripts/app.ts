// jat.work — client entry point.
//
// Wires the per-page modules and re-runs them on every Astro View Transitions
// page load (tearing the previous instance down first). The actual behaviour
// lives in focused modules:
//   lifecycle  re-init/teardown registry
//   cluster    canvas model + rendering (shared)
//   demo       ambient teaser + interactive RaftLock demo
//   feed       lab feed type filter
//   nav        header section nav + scroll-spy
//   route      career route line progress
//   hero       name collapse + toolkit reveal
import { runTeardowns, bindGlobal } from './lifecycle';
import { initTeaser, initDemo } from './demo';
import { initFilters } from './feed';
import { initSectionNav, initHeaderScroll } from './nav';
import { initRouteProgress } from './route';
import { initName, initToolkitPulse, initName3D, initHeroParallax, initPillarAuras } from './hero';
import { initSurprise } from './surprise';
import { initMagnetic } from './magnetic';
import { initSpotlight } from './spotlight';
import { initScrollFallback } from './fallback';
import { initCursor } from './cursor';
import { initFluid } from './fluid';

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

function boot() {
  initFluid();
  initHeaderScroll();
  initName();
  initName3D();
  initHeroParallax();
  initPillarAuras();
  initSurprise();
  initMagnetic();
  initSpotlight();
  initTeaser();
  initDemo();
  initFilters();
  initToolkitPulse();
  initSectionNav();
  initRouteProgress();
  initScrollFallback();

  // Handle deep-linking to the RaftLock demo
  if (window.location.hash === '#raftlock') {
    const launchBtn = document.querySelector('[data-raft-act="open-fullscreen"]') as HTMLButtonElement | null;
    if (launchBtn) {
      launchBtn.click();
    }
  }

  // Handle browser back/forward buttons
  bindGlobal(window, 'popstate', () => {
    const overlay = document.getElementById('raftlock-overlay');
    if (!overlay) return;

    if (window.location.hash === '#raftlock') {
      if (!overlay.classList.contains('is-open')) {
        const launchBtn = document.querySelector('[data-raft-act="open-fullscreen"]') as HTMLButtonElement | null;
        if (launchBtn) launchBtn.click();
      }
    } else {
      if (overlay.classList.contains('is-open')) {
        overlay.classList.remove('is-open');
        document.body.classList.remove('raftlock-open');
        // We can't call pauseTour() here directly since it's inside initDemo scope,
        // but simulating a click on the close button safely triggers the shutdown logic
        const closeBtn = document.querySelector('[data-raft-act="close-fullscreen"]') as HTMLButtonElement | null;
        if (closeBtn) {
          closeBtn.click();
        } else {
          overlay.classList.remove('is-open');
          document.body.classList.remove('raftlock-open');
        }
      }
    }
  });
}

// `astro:page-load` fires on the initial load and after every View Transitions
// navigation, so this re-initialises the hero canvas, filters and demo each time
// the page is swapped back in. Tear down the previous instance's global
// listeners/observers/loops first so nothing stacks up.
function start() {
  runTeardowns();
  boot();
}
document.addEventListener('astro:page-load', start);
