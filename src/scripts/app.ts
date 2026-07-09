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
import './header'; // self-binding header scroll state (shared with post pages)
import './landing'; // instant cross-page landings (shared with post pages)
import { runTeardowns, bindGlobal } from './lifecycle';
import { initTeaser, initDemo } from './demo';
import { initFilters } from './feed';
import { initSectionNav } from './nav';
import { initRouteProgress } from './route';
import { initName, initToolkitPulse, initManifest } from './hero';
import { initSurprise } from './surprise';
import { initMagnetic } from './magnetic';
import { initSpotlight } from './spotlight';
import { initScrollFallback } from './fallback';
import { initFluid } from './fluid';

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
// Cold boot starts at the top — but only when no anchor is asked for. This
// module can also be evaluated for the first time mid-navigation (a session
// that began on a post page loads the home entry while returning to
// /#writing); an unconditional reset would hijack that landing back to the
// top — smoothly, past every reveal — and strand the visitor at the hero.
if (!location.hash) window.scrollTo(0, 0);

// This module survives View Transitions navigations, so any boot after the
// first one is a *return* — the visitor has already seen the hero's intro
// cascade. `is-vt-return` on <html> lets CSS (03-hero.css, FluidBackground)
// and hero.ts land on the settled hero instantly instead of replaying the
// 1.7s choreography like a toll booth. Set before the inits so they can read
// it; re-set every navigation because the swap replaces <html>'s attributes.
let coldBoot = true;

function boot() {
  document.documentElement.classList.toggle('is-vt-return', !coldBoot);
  coldBoot = false;
  initFluid();
  initName();
  initManifest();
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
