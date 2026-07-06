// Ambient "consensus" teaser canvas + the interactive RaftLock demo
// (5-node cluster: leader election, lock, crashes, guided tour, sandbox).
import { bindGlobal, trackTeardown } from './lifecycle';
import { makeNodes, fitCanvas, nodeXY, drawCluster, QUORUM, type DrawOpts } from './cluster';

/**
 * Push a history entry for the fullscreen demo WITHOUT clobbering Astro's View
 * Transitions state.
 *
 * Astro stamps every entry it controls with `{ index, scrollX, scrollY }` and —
 * crucially — its router *ignores any popstate whose `history.state` is null*
 * (see astro/dist/transitions/router.js `onPopState`). This used to push `null`,
 * so any later Back into one of these entries left the previous page's DOM
 * frozen on screen: open the demo, navigate to a post, hit Back, and you'd land
 * on the post's markup under the home URL — the "white screen / wrong page on
 * Back" bug. Carrying the current state through keeps every entry a valid Astro
 * navigation target, so the router swaps correctly. (nav.ts solves the same
 * footgun for the scroll-spy's replaceState.)
 */
function pushStateKeepingAstro(url: string) {
  const state = history.state ?? { index: 0, scrollX: 0, scrollY: 0 };
  history.pushState(state, '', url);
}

/* ----------------------------------------------------------------------- *
 * Ambient teaser canvas
 * ----------------------------------------------------------------------- */
export function initTeaser() {
  const canvas = document.getElementById('jw-cluster') as HTMLCanvasElement | null;
  if (!canvas) return;
  const nodes = makeNodes();
  let dims = fitCanvas(canvas);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const drawStatic = () =>
    drawCluster(dims.ctx, dims.w, dims.h, nodes, 0, { r: 13, heartbeats: false });

  const resize = () => {
    dims = fitCanvas(canvas);
    if (reduce) drawStatic();
  };
  bindGlobal(window, 'resize', resize);

  if (reduce) {
    drawStatic();
    // Restoring from the back/forward cache can leave the canvas backing store
    // blank; re-fit and redraw the static frame.
    bindGlobal(window, 'pageshow', (e) => {
      if ((e as PageTransitionEvent).persisted) resize();
    });
    return;
  }

  let raf = 0;
  let onscreen = true;
  const loop = (t: number) => {
    drawCluster(dims.ctx, dims.w, dims.h, nodes, t, { r: 13, heartbeats: true });
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  start();
  trackTeardown(stop); // stop the loop when the page is swapped out

  // pause when offscreen
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      onscreen = e.isIntersecting;
      if (onscreen) start();
      else stop();
    }
  });
  io.observe(canvas);
  trackTeardown(() => io.disconnect());

  // bfcache restore (browser back/forward): the backing store may come back
  // blank and the rAF loop may not auto-resume. The stale `raf` id is still
  // truthy, so force a clean stop+start (cancelling a stale id is harmless)
  // rather than relying on the !raf guard, which would otherwise refuse to
  // restart and leave a garbled/frozen frame.
  bindGlobal(window, 'pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) {
      resize();
      if (onscreen) {
        stop();
        start();
      }
    }
  });
}

/* ----------------------------------------------------------------------- *
 * Interactive RaftLock demo
 * ----------------------------------------------------------------------- */
export function initDemo() {
  const canvasEl = document.getElementById('jw-democanvas') as HTMLCanvasElement | null;
  if (!canvasEl) return;
  // The null check doesn't flow into the hoisted function declarations below
  // (nodeAt, syncNodeOverlay), so hand them an already-non-null binding.
  const canvas = canvasEl;

  const termEl = document.getElementById('jw-term')!;
  const healthEl = document.getElementById('jw-health')!;
  const lockLabel = document.getElementById('jw-locklabel')!;
  const lockBtn = document.getElementById('jw-lockbtn') as HTMLButtonElement;
  const crashBtn = document.getElementById('jw-crashbtn') as HTMLButtonElement;
  const reviveBtn = document.getElementById('jw-revivebtn') as HTMLButtonElement | null;
  const clusterBox = document.getElementById('jw-clusterbox')!;

  enum DemoMode { TOUR, SANDBOX }
  let currentMode = DemoMode.TOUR;

  interface TourStep {
    text: string;
    duration: number; // in ms
    run?: () => void;
  }
  let tourSteps: TourStep[] = [];
  let tourStep = -1; // -1 = inactive

  let nodes = makeNodes();
  let term = 1;
  let lockHeld = false;
  let dims = fitCanvas(canvas);
  let raf = 0;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const alive = () => nodes.filter((n) => n.state !== 'crashed');
  const hasQuorum = () => alive().length >= QUORUM;
  const leader = () => nodes.find((n) => n.state === 'leader');

  function log(msg: string, tone: 'info' | 'ok' | 'warn' | 'accent' | 'comment' = 'info') {
    if (tone === 'comment') return; // Do not show comments as toasts
    const toast = document.getElementById('jw-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    if ((toast as any)._timeout) clearTimeout((toast as any)._timeout);
    (toast as any)._timeout = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function logCommentBlock(title: string, body: string) {
    // We removed logCommentBlock console output in favour of the sleek UI tour bar
  }

  /** Elect a new leader if there is a quorum and no current leader. */
  function ensureLeader(reason: string) {
    if (leader()) return;
    if (!hasQuorum()) {
      log(`no quorum — ${alive().length}/5 alive, election stalls`, 'warn');
      return;
    }
    term += 1;
    // prefer the lowest-id alive follower (deterministic, like a real election winner)
    const candidate = nodes.find((n) => n.state === 'follower');
    if (candidate) {
      candidate.state = 'leader';
      log(`election: node ${candidate.id} wins term ${term} (${reason})`, 'accent');
      if (lockHeld) log(`lock "deploy" preserved across failover`, 'ok');
    }
  }

  function setLock(held: boolean) {
    lockHeld = held;
    lockLabel.textContent = held ? 'HELD' : 'FREE';
    lockLabel.style.color = held ? '#ea4335' : '#0f9d58';
    lockBtn.textContent = held ? 'Release lock' : 'Acquire lock';
  }

  function refresh() {
    const a = alive().length;
    termEl.textContent = String(term);
    healthEl.textContent = `${a} / 5 healthy`;
    healthEl.style.color = hasQuorum() ? 'var(--ok)' : 'var(--pop)';
    clusterBox.style.boxShadow = hasQuorum()
      ? 'none'
      : '0 0 0 2px color-mix(in srgb, var(--pop) 45%, transparent)';
    lockBtn.disabled = !hasQuorum() || !leader();
    crashBtn.disabled = !leader();
    if (reviveBtn) reviveBtn.disabled = alive().length === 5;

    // Update accessibility attributes on node buttons
    nodes.forEach((n) => {
      const btn = document.querySelector(`.accessible-node-btn[data-node-id="${n.id}"]`);
      if (btn) {
        const typeLabel = n.state === 'leader' ? 'Leader' : n.state === 'follower' ? 'Follower' : 'Crashed';
        const actionLabel = n.state === 'crashed' ? 'revive' : 'crash';
        btn.setAttribute('aria-label', `Node ${n.id} (${typeLabel}). Press to ${actionLabel}.`);
      }
    });

    syncNodeOverlay();
    if (reduce) {
      drawCluster(dims.ctx, dims.w, dims.h, nodes, 0, drawOpts(false));
    }
  }

  function crashNode(id: number) {
    const n = nodes[id];
    if (n.state === 'crashed') return;
    const wasLeader = n.state === 'leader';
    n.state = 'crashed';
    log(`node ${id} crashed${wasLeader ? ' (was leader)' : ''}`, 'warn');
    if (wasLeader) ensureLeader(`node ${id} down`);
    if (!hasQuorum()) {
      log(`cluster lost majority — lock unavailable until recovery`, 'warn');
    }
    refresh();
  }

  function reviveNode(id: number) {
    const n = nodes[id];
    if (n.state !== 'crashed') return;
    n.state = 'follower';
    log(`node ${id} recovered, rejoins as follower`, 'ok');
    ensureLeader(`node ${id} back`);
    refresh();
  }

  function toggleNode(id: number) {
    if (nodes[id].state === 'crashed') reviveNode(id);
    else crashNode(id);
  }

  const NODE_R = 16;

  // canvas interaction: click a node to crash/revive
  function nodeAt(clientX: number, clientY: number): number | null {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (const n of nodes) {
      const { x: nx, y: ny } = nodeXY(n, dims.w, dims.h, nodes.length, NODE_R);
      if (Math.hypot(nx - x, ny - y) <= NODE_R + 10) return n.id;
    }
    return null;
  }

  /** Keep the invisible keyboard hit-targets aligned with the drawn nodes. */
  function syncNodeOverlay() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    nodes.forEach((n) => {
      const btn = document.querySelector<HTMLElement>(
        `.accessible-node-btn[data-node-id="${n.id}"]`,
      );
      if (!btn) return;
      const { x, y } = nodeXY(n, dims.w, dims.h, nodes.length, NODE_R);
      btn.style.left = `${(x / dims.w) * 100}%`;
      btn.style.top = `${(y / dims.h) * 100}%`;
    });
  }

  canvas.addEventListener('click', (e) => {
    const id = nodeAt(e.clientX, e.clientY);
    if (id != null) {
      pauseForUserInteraction();
      toggleNode(id);
    }
  });

  // actions
  function doLock() {
    if (!leader() || !hasQuorum()) {
      log('cannot reach lock service — no leader', 'warn');
      return;
    }
    if (!lockHeld) {
      setLock(true);
      log(`client acquired lock "deploy" via leader (term ${term})`, 'ok');
    } else {
      setLock(false);
      log('client released lock "deploy"', 'info');
    }
    refresh();
  }

  function doCrashLeader() {
    const l = leader();
    if (l) crashNode(l.id);
  }

  function doReviveRandom() {
    const crashedNodes = nodes.filter((n) => n.state === 'crashed');
    if (crashedNodes.length > 0) {
      const target = crashedNodes[Math.floor(Math.random() * crashedNodes.length)];
      reviveNode(target.id);
    }
  }

  function reset() {
    nodes = makeNodes();
    term = 1;
    setLock(false);
    log('cluster reset — 5 nodes, fresh term', 'info');
    refresh();
  }

  /* ---- guided tour ---------------------------------------------------- */
  const tourbar = document.getElementById('jw-tourbar');
  let tourTimer: number | null = null;
  let tourStartTime = 0;
  let tourDuration = 0;
  let tourPaused = false;
  let tourProgressRaf = 0;

  const stepTitles = [
    'Initial Cluster State',
    'Lock Acquisition',
    'Leader Crash Failure',
    'Leader Election & Failover',
    'Loss of Quorum',
    'Node Revival',
    'Cluster Reset'
  ];

  tourSteps = [
    {
      text: 'Five servers form the cluster. One is elected leader (L) — it answers requests; the others follow. The shared lock is currently FREE.',
      duration: 6500,
      run: () => {
        reset();
      }
    },
    {
      text: 'A client asks the leader for the "deploy" lock. The leader only grants it once a majority of servers agree — so the whole cluster shares one source of truth.',
      duration: 7500,
      run: () => {
        if (!lockHeld) doLock();
      }
    },
    {
      text: 'Now the leader crashes. In a naive system the lock would be stuck forever. Watch what Raft does instead.',
      duration: 6500,
      run: () => {
        doCrashLeader();
      }
    },
    {
      text: 'The survivors notice the silence and elect a new leader automatically — and the "deploy" lock is preserved across the failover. No human paged.',
      duration: 7500
    },
    {
      text: 'Resilience has a limit. Crash two more servers and only 2 of 5 remain — no majority. Raft refuses to grant the lock rather than risk two owners.',
      duration: 8000,
      run: () => {
        let crashes = 0;
        nodes.forEach((n) => {
          if (n.state !== 'crashed' && n.state !== 'leader' && crashes < 2) {
            crashNode(n.id);
            crashes++;
          }
        });
      }
    },
    {
      text: 'Bring one server back. A majority returns, a leader is elected, and the lock service heals itself — no data lost.',
      duration: 7500,
      run: () => {
        const crashed = nodes.find(n => n.state === 'crashed');
        if (crashed) reviveNode(crashed.id);
      }
    },
    {
      text: "That's RaftLock: a lock that survives crashes. Resetting — now try the Chaos Sandbox and break it yourself.",
      duration: 6000,
      run: () => {
        reset();
      }
    }
  ];

  function animateProgress() {
    if (tourPaused || tourStep < 0) return;
    const elapsed = Date.now() - tourStartTime;
    const percent = Math.min((elapsed / tourDuration) * 100, 100);
    const progressEl = document.getElementById('tour-progress-bar');
    if (progressEl) {
      progressEl.style.width = `${percent}%`;
    }
    if (elapsed < tourDuration) {
      tourProgressRaf = requestAnimationFrame(animateProgress);
    }
  }

  function renderTour() {
    if (!tourbar) return;
    if (tourStep < 0) {
      tourbar.style.display = 'none';
      return;
    }
    const step = tourSteps[tourStep];
    tourbar.style.display = 'flex';
    
    // Update step indicator
    const stepIndicator = document.getElementById('jw-tour-step-indicator')!;
    if (stepIndicator) {
      stepIndicator.textContent = `Tour · Step ${tourStep + 1}/${tourSteps.length}`;
    }
    
    // Update instruction text
    const instructionText = document.getElementById('jw-tour-text')!;
    if (instructionText) {
      instructionText.textContent = step.text;
    }
    
    // Update buttons disabled status
    const prevBtn = document.getElementById('jw-tour-prev') as HTMLButtonElement;
    if (prevBtn) prevBtn.disabled = tourStep === 0;
    
    // Update Play/Pause toggle button UI
    const toggleBtn = document.getElementById('jw-tour-toggle');
    if (toggleBtn) {
      const pauseIcon = toggleBtn.querySelector('.icon-pause') as HTMLElement | null;
      const playIcon = toggleBtn.querySelector('.icon-play') as HTMLElement | null;
      toggleBtn.classList.toggle('active', !tourPaused);
      if (tourPaused) {
        if (pauseIcon) pauseIcon.style.display = 'none';
        if (playIcon) playIcon.style.display = 'block';
        toggleBtn.setAttribute('aria-label', 'Resume tour');
      } else {
        if (pauseIcon) pauseIcon.style.display = 'block';
        if (playIcon) playIcon.style.display = 'none';
        toggleBtn.setAttribute('aria-label', 'Pause tour');
      }
    }
  }

  function goToTourStep(i: number) {
    if (tourTimer) clearTimeout(tourTimer);
    if (tourProgressRaf) cancelAnimationFrame(tourProgressRaf);

    tourStep = i;
    const step = tourSteps[i];
    tourDuration = step.duration;
    tourStartTime = Date.now();
    tourPaused = false;

    logCommentBlock(stepTitles[i], step.text);
    if (step.run) step.run();
    renderTour();
    
    if (i < tourSteps.length - 1) {
      tourTimer = window.setTimeout(() => {
        if (!tourPaused) goToTourStep(i + 1);
      }, tourDuration);
    } else {
      tourTimer = window.setTimeout(() => {
        if (!tourPaused) switchMode(DemoMode.SANDBOX);
      }, tourDuration);
    }

    animateProgress();
  }

  function toggleTourPlay() {
    if (tourPaused) {
      tourPaused = false;
      const elapsed = Date.now() - tourStartTime;
      const remaining = tourDuration - elapsed;
      if (remaining > 0) {
        tourTimer = window.setTimeout(() => {
          if (tourStep < tourSteps.length - 1) {
            goToTourStep(tourStep + 1);
          } else {
            switchMode(DemoMode.SANDBOX);
          }
        }, remaining);
        animateProgress();
      } else {
        if (tourStep < tourSteps.length - 1) {
          goToTourStep(tourStep + 1);
        } else {
          switchMode(DemoMode.SANDBOX);
        }
      }
    } else {
      tourPaused = true;
      if (tourTimer) clearTimeout(tourTimer);
      if (tourProgressRaf) cancelAnimationFrame(tourProgressRaf);
      tourDuration = tourDuration - (Date.now() - tourStartTime);
      tourStartTime = Date.now() - (tourSteps[tourStep].duration - tourDuration);
    }
    renderTour();
    const elapsed = Date.now() - tourStartTime;
    const percent = Math.min((elapsed / tourSteps[tourStep].duration) * 100, 100);
    const progressEl = document.getElementById('tour-progress-bar');
    if (progressEl) progressEl.style.width = `${percent}%`;
  }

  function startTour() {
    const consoleSec = document.getElementById('featured');
    if (consoleSec) consoleSec.classList.add('tour-active');
    reset();
    log('// >>> STARTING GUIDED TOUR — AUTOPLAY ACTIVE <<<', 'comment');
    goToTourStep(0);
  }

  function endTour() {
    if (tourTimer) clearTimeout(tourTimer);
    if (tourProgressRaf) cancelAnimationFrame(tourProgressRaf);
    tourStep = -1;
    renderTour();
    const consoleSec = document.getElementById('featured');
    if (consoleSec) consoleSec.classList.remove('tour-active');
    log('// >>> TOUR EXITED — UNLOCKED SANDBOX PLAYGROUND <<<', 'comment');
  }

  /** Resume the guided tour, or start it from the top if it isn't running. */
  function playTour() {
    if (tourStep < 0) {
      goToTourStep(0);
    } else if (tourPaused) {
      toggleTourPlay();
    }
  }

  /** Freeze tour autoplay (e.g. when the overlay closes) without resetting it. */
  function pauseTour() {
    if (tourStep >= 0 && !tourPaused) toggleTourPlay();
  }

  /** A manual click on the cluster drops out of the guided tour into sandbox. */
  function pauseForUserInteraction() {
    ensureSandboxMode('manual interaction');
  }

  function switchMode(newMode: DemoMode) {
    if (currentMode === newMode && newMode === DemoMode.TOUR && tourStep >= 0) return; // already in tour
    currentMode = newMode;
    
    const tourBtn = document.querySelector('[data-demo-mode="tour"]');
    const sandboxBtn = document.querySelector('[data-demo-mode="sandbox"]');
    const tourBar = document.getElementById('jw-tourbar');
    const sandboxBar = document.getElementById('jw-sandboxbar');
    
    if (newMode === DemoMode.TOUR) {
      tourBtn?.classList.add('active');
      tourBtn?.setAttribute('aria-selected', 'true');
      sandboxBtn?.classList.remove('active');
      sandboxBtn?.setAttribute('aria-selected', 'false');
      if (tourBar) tourBar.style.display = 'flex';
      if (sandboxBar) sandboxBar.style.display = 'none';
      startTour();
    } else {
      sandboxBtn?.classList.add('active');
      sandboxBtn?.setAttribute('aria-selected', 'true');
      tourBtn?.classList.remove('active');
      tourBtn?.setAttribute('aria-selected', 'false');
      if (tourBar) tourBar.style.display = 'none';
      if (sandboxBar) sandboxBar.style.display = 'flex';
      endTour();
    }
  }

  function ensureSandboxMode(actionName: string) {
    if (currentMode === DemoMode.TOUR) {
      switchMode(DemoMode.SANDBOX);
      log(`Manual interaction detected: switched to Sandbox (${actionName})`, 'warn');
    }
  }

  // Keyboard shortcuts event listener
  bindGlobal(window, 'keydown', (e) => {
    const overlay = document.getElementById('raftlock-overlay');
    const overlayOpen = !!overlay?.classList.contains('is-open');
    const consoleEl = document.getElementById('featured');

    // Active when the fullscreen demo is open, or when the inline hero demo is
    // focused / hovered.
    const inScope =
      overlayOpen ||
      (!!consoleEl &&
        (consoleEl.contains(document.activeElement) || consoleEl.matches(':hover')));
    if (!inScope) return;

    // Esc closes the fullscreen overlay.
    if (overlayOpen && e.code === 'Escape') {
      e.preventDefault();
      (document.querySelector('[data-raft-act="close-fullscreen"]') as HTMLElement | null)?.click();
      return;
    }

    if (currentMode === DemoMode.TOUR && tourStep >= 0) {
      if (e.code === 'Space') {
        e.preventDefault();
        toggleTourPlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (tourStep === tourSteps.length - 1) switchMode(DemoMode.SANDBOX);
        else goToTourStep(tourStep + 1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (tourStep > 0) goToTourStep(tourStep - 1);
      }
    }
    if (e.code === 'KeyT') {
      e.preventDefault();
      switchMode(currentMode === DemoMode.TOUR ? DemoMode.SANDBOX : DemoMode.TOUR);
    }
  });

  const drawOpts = (heartbeats: boolean): DrawOpts => ({
    r: NODE_R,
    heartbeats,
    labels: dims.w >= 380,
    lockHeld,
  });

  // render loop
  const loop = (t: number) => {
    drawCluster(dims.ctx, dims.w, dims.h, nodes, t, drawOpts(true));
    raf = requestAnimationFrame(loop);
  };

  const resize = () => {
    dims = fitCanvas(canvas);
    syncNodeOverlay();
    if (reduce) {
      drawCluster(dims.ctx, dims.w, dims.h, nodes, 0, drawOpts(false));
    }
  };
  bindGlobal(window, 'resize', resize);
  // stop the demo loop when this page instance is swapped out
  trackTeardown(() => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });

  // The stage flexes as the dock/topbar reflow; keep the canvas backing store
  // and node hit-targets in sync whenever its box changes.
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => resize());
    ro.observe(clusterBox);
    trackTeardown(() => ro.disconnect());
  }

  // Initialize nodes log on load
  log('cluster online — node 0 elected leader, term 1', 'accent');

  // Pause when offscreen optimization
  if (!reduce) {
    raf = requestAnimationFrame(loop);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !raf) raf = requestAnimationFrame(loop);
        else if (!e.isIntersecting && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }
    });
    io.observe(canvas);
    trackTeardown(() => io.disconnect());
  } else {
    drawCluster(dims.ctx, dims.w, dims.h, nodes, 0, drawOpts(false));
  }

  // bfcache restore (browser back/forward): re-fit and redraw so the demo
  // canvas doesn't return blank or frozen. Only restart the loop while the
  // overlay is actually visible (offsetParent is null when it's closed).
  bindGlobal(window, 'pageshow', (e) => {
    if (!(e as PageTransitionEvent).persisted) return;
    resize();
    if (!reduce) {
      // Force a clean restart while the overlay is visible — the stale `raf`
      // id stays truthy across a bfcache restore, so a plain !raf check would
      // wrongly skip it (offsetParent is null while the overlay is closed).
      if (canvas.offsetParent !== null) {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    } else {
      drawCluster(dims.ctx, dims.w, dims.h, nodes, 0, drawOpts(false));
    }
  });

  // Keyboard node buttons interaction
  document.querySelectorAll('.accessible-node-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idStr = btn.getAttribute('data-node-id');
      if (idStr != null) {
        const id = parseInt(idStr, 10);
        ensureSandboxMode(`node ${id} crash/revive`);
        toggleNode(id);
      }
    });
  });

  // Handle goto-console scroll interactions
  bindGlobal(document, 'click', (e) => {
    const trigger = (e.target as HTMLElement).closest('[data-goto-console]') as HTMLElement | null;
    if (!trigger) return;
    e.preventDefault();
    const consoleSec = document.getElementById('featured');
    if (consoleSec) {
      consoleSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash highlight border
      clusterBox.classList.add('highlight-flash');
      setTimeout(() => {
        clusterBox.classList.remove('highlight-flash');
      }, 3000);
      // Focus lock button
      setTimeout(() => {
        lockBtn.focus();
      }, 800);
    }
  });

  // wire up every [data-raft-act] trigger on the page
  bindGlobal(document, 'click', (e) => {
    const trigger = (e.target as HTMLElement).closest('[data-raft-act]') as HTMLElement | null;
    if (!trigger) return;
    const act = trigger.getAttribute('data-raft-act');
    
    if (act === 'open-fullscreen') {
      const overlay = document.getElementById('raftlock-overlay');
      if (overlay) {
        if (window.location.hash !== '#raftlock') {
          pushStateKeepingAstro('#raftlock');
        }
        overlay.classList.add('is-open');
        document.body.classList.add('raftlock-open');
        
        // Parse launch mode
        const launchMode = trigger.getAttribute('data-raft-launch-mode');
        
        // Give the browser a frame to layout the display: flex before resizing
        requestAnimationFrame(() => {
          resize();
          
          if (launchMode === 'sandbox') {
            reset(); // start the playground from a clean 5/5 cluster
            switchMode(DemoMode.SANDBOX);
          } else {
            switchMode(DemoMode.TOUR);
            if (tourStep === -1) {
              playTour();
            }
          }
        });
      }
      return;
    }
    
    if (act === 'close-fullscreen') {
      const overlay = document.getElementById('raftlock-overlay');
      if (overlay) {
        if (window.location.hash === '#raftlock') {
          pushStateKeepingAstro(window.location.pathname + window.location.search);
        }
        overlay.classList.remove('is-open');
        document.body.classList.remove('raftlock-open');
        pauseTour();
      }
      return;
    }

    if (act === 'lock') {
      ensureSandboxMode('lock toggle');
      doLock();
    } else if (act === 'crash') {
      ensureSandboxMode('crash leader');
      doCrashLeader();
    } else if (act === 'revive') {
      ensureSandboxMode('revive node');
      doReviveRandom();
    } else if (act === 'reset') {
      ensureSandboxMode('reset');
      reset();
    } else if (act === 'tour-toggle') {
      toggleTourPlay();
    } else if (act === 'tour-next') {
      if (tourStep === tourSteps.length - 1) switchMode(DemoMode.SANDBOX);
      else goToTourStep(tourStep + 1);
    } else if (act === 'tour-prev') {
      if (tourStep > 0) goToTourStep(tourStep - 1);
    }
  });

  // wire up mode switcher clicks
  bindGlobal(document, 'click', (e) => {
    const trigger = (e.target as HTMLElement).closest('[data-demo-mode]') as HTMLElement | null;
    if (!trigger) return;
    const modeStr = trigger.getAttribute('data-demo-mode');
    if (modeStr === 'tour') {
      switchMode(DemoMode.TOUR);
    } else if (modeStr === 'sandbox') {
      switchMode(DemoMode.SANDBOX);
    }
  });

  setLock(false);
  refresh();

  // Start guided tour as default on boot
  const autostart = window.setTimeout(() => {
    switchMode(DemoMode.TOUR);
  }, 800);

  // On page swap, stop the tour's timer/loop and the autostart so this demo
  // instance leaves nothing running in the background.
  trackTeardown(() => {
    clearTimeout(autostart);
    if (tourTimer) clearTimeout(tourTimer);
    if (tourProgressRaf) cancelAnimationFrame(tourProgressRaf);
  });
}
