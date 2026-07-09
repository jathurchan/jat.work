import { bindGlobal, trackTeardown } from './lifecycle';

// First boot of the session owns the hero's entrance cascade; later boots
// (View Transitions re-inits) only wait a beat (see init()).
let firstFluidBoot = true;

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
  phase: number;
}

/* ---------------------------------------------------------------------------
 * Page-wide ambient backdrop.
 *
 * A viewport-fixed canvas of soft, drifting colour orbs that sits behind the
 * whole document (not just the hero) — so the page never "cuts" from a colourful
 * top to a flat-white bottom, and the frosted-glass surfaces above finally have
 * real colour to blur. Heavy CSS blur turns the orbs into gentle colour fields;
 * this only simulates their slow motion + pointer/scroll reaction.
 * ------------------------------------------------------------------------- */
class FluidSimulation {
  private canvas: HTMLCanvasElement;
  // Definite-assignment: the constructor early-returns when the canvas is
  // missing, and no method runs without one.
  private ctx!: CanvasRenderingContext2D;
  private orbs: Orb[] = [];
  private mouse = { x: -9999, y: -9999, active: false };
  private animationFrame = 0;
  private colors: string[] = [];
  private scrollVelocity = 0;
  private lastScrollY = 0;
  private running = false;
  private reduceMotion = false;
  // Last viewport width we sized the canvas for. iOS Safari fires `resize` on
  // every URL-bar slide (height changes, width doesn't); we use this to ignore
  // those so the blurred backdrop isn't cleared and re-rasterised mid-scroll.
  private lastVw = 0;
  private resizeTimer = 0;
  // Cap the backdrop's pixel density: it's blurred to a haze, so full retina
  // resolution is wasted work. 1.5 keeps it crisp enough and cheap.
  private dpr = 1;
  private vw = 0;
  private vh = 0;
  // Mobile / touch devices pay a heavy price for this layer: a viewport-fixed
  // canvas repainting every frame *under* a big CSS blur forces Safari to
  // re-rasterise the whole blurred field every frame. Rather than stop painting
  // during scroll (which made the fixed, blurred — and therefore compositor-
  // promoted — layer get evicted and vanish mid-scroll on iOS, then snap back),
  // we keep painting continuously but make each frame cheap: a low-resolution
  // backing store that CSS upscales (a free, natural softening) plus a capped
  // frame rate. A layer that is always painted is never dropped.
  private isMobile = false;
  private isCoarse = false;
  // Frame cadence (ms between renders). The drift is slow enough that a resting
  // ~20fps is indistinguishable from 60 while cutting the full-viewport blur
  // re-rasterisation — and every glass surface's backdrop-filter re-sample above
  // this always-changing backdrop — to a third of the naive per-frame cost. A
  // fine pointer pushing the orbs wants more temporal resolution, so pointer
  // motion briefly lifts the loop to activeInterval, then it eases back to rest.
  private idleInterval = 1000 / 20;
  private activeInterval = 1000 / 30;
  private pointerBoostUntil = 0;
  private lastFrameTime = 0;
  private isScrolling = false;
  private scrollTimer = 0;
  // Desktop only: while scrolled past the hero the drift loop is parked. The
  // last frame stays painted (never cleared), so the colour field is still under
  // every glass surface below — it simply stops re-blurring while you read the
  // sections that don't need a live aurora behind them.
  private belowHero = false;

  constructor() {
    this.canvas = document.getElementById('fluid-canvas') as HTMLCanvasElement;
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
    this.lastScrollY = window.scrollY;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isCoarse = window.matchMedia('(pointer: coarse)').matches;
    this.isMobile = window.innerWidth < 768 || this.isCoarse;
    // The canvas sits under a huge CSS blur, so backing-store resolution is
    // invisible: render at 1× everywhere (0.6× on touch, where the CSS upscale
    // also softens) and let the blur eat the difference — retina density here
    // was pure waste.
    this.dpr = this.isCoarse ? 0.6 : 1;
    // (Frame cadence — resting ~20fps, pointer-boosted to ~30fps, and the
    // desktop park while below the hero — is configured on the fields above.)

    const css = getComputedStyle(document.documentElement);
    const blue = css.getPropertyValue('--g-blue').trim() || '#4285F4';
    const red = css.getPropertyValue('--g-red').trim() || '#EA4335';
    const yellow = css.getPropertyValue('--g-yellow').trim() || '#FBBC05';
    const green = css.getPropertyValue('--g-green').trim() || '#34A853';
    // Weighted toward the brand blue/green, with red/yellow as occasional accents.
    this.colors = [blue, green, blue, green, blue, red, green, yellow];

    this.resize = this.resize.bind(this);
    this.onViewportChange = this.onViewportChange.bind(this);
    this.animate = this.animate.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleVisibility = this.handleVisibility.bind(this);

    this.init();
  }

  private init() {
    this.lastVw = window.innerWidth;
    this.resize();
    this.createOrbs();

    bindGlobal(window, 'resize', this.onViewportChange);
    bindGlobal(window, 'scroll', this.handleScroll, { passive: true });
    bindGlobal(document, 'visibilitychange', this.handleVisibility);
    // The orb-push reaction needs a hovering cursor; on touch there isn't one,
    // and the listener would only add work, so skip it on coarse pointers.
    if (!this.reduceMotion && !this.isCoarse) {
      bindGlobal(window, 'pointermove', this.handlePointerMove, { passive: true });
      bindGlobal(window, 'pointerleave', this.handlePointerLeave);
    }

    trackTeardown(() => this.stop());

    // Seed the desktop park state from the initial scroll position: a boot that
    // lands already below the hero (a reload while scrolled down, or an anchor
    // deep-link) should stay parked until the reader scrolls back up, rather
    // than run an unseen aurora until the first scroll event flips the flag.
    if (!this.isCoarse && !this.reduceMotion && window.scrollY > window.innerHeight * 1.15) {
      this.belowHero = true;
    }

    if (this.reduceMotion) {
      // Honour reduced-motion: paint one static frame and stop.
      this.renderFrame(1);
    } else {
      // Paint one static frame now so the colour field sits under the glass
      // immediately, but hold the drift loop until the hero's load cascade
      // (reveals, JSON type-in, name collapse — all done by ~1.7s) has
      // played: a full-viewport canvas repainting under blur(72px) — and
      // every backdrop-filter surface re-sampling it — competes with the
      // entrance animations for the GPU and made the intro stutter. The orbs
      // drift slowly; nobody can tell they start late.
      this.renderFrame(1);
      const delay = firstFluidBoot ? 1800 : 400;
      firstFluidBoot = false;
      // Skip the initial start when parked below the hero; a scroll back up
      // (handleScroll) will start it at the right moment.
      const startTimer = window.setTimeout(() => {
        if (!this.belowHero) this.start();
      }, delay);
      trackTeardown(() => window.clearTimeout(startTimer));
    }
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.lastScrollY = window.scrollY;
    this.lastFrameTime = performance.now();
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  private stop() {
    this.running = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = 0;
    }
  }

  /**
   * iOS Safari fires a stream of `resize` events as its URL/toolbar slides in
   * and out during a scroll or a pull-to-refresh rubber-band — the width never
   * moves, only the height. Re-sizing the canvas on each of those clears its
   * backing store and forces the heavy CSS blur to re-rasterise the whole field,
   * which reads as the background flickering / jumping (the bug). The layer is a
   * soft, CSS-stretched colour haze, so a few pixels of height change needs no
   * redraw at all. On touch devices we therefore ignore height-only changes and
   * act only on a real width change (an orientation flip); a short debounce
   * coalesces the burst on every platform.
   */
  private onViewportChange() {
    const w = window.innerWidth;
    if (this.isCoarse && w === this.lastVw) return;
    this.lastVw = w;
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(this.resize, 150);
  }

  private handleVisibility() {
    if (document.hidden) {
      this.stop();
    } else if (!this.reduceMotion && !this.belowHero) {
      // Don't wake a loop the scroll position has parked (desktop, below hero).
      this.start();
    }
  }

  private resize() {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    // setTransform (not scale) so repeated resizes don't compound the DPR.
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.reduceMotion) this.renderFrame(1);
  }

  private createOrbs() {
    const isMobile = this.isMobile;
    // Fewer, larger orbs: broad overlapping colour fields read as one soft
    // gradient wash (premium), where many small orbs read as a lava lamp.
    const numOrbs = isMobile ? 6 : 9;
    this.orbs = [];

    for (let i = 0; i < numOrbs; i++) {
      const r = Math.random() * 240 + (isMobile ? 180 : 260);
      this.orbs.push({
        x: Math.random() * this.vw,
        y: Math.random() * this.vh,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        radius: r,
        baseRadius: r,
        color: this.colors[i % this.colors.length],
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private handlePointerMove(e: PointerEvent) {
    // Canvas is viewport-fixed, so client coordinates map directly (no scrollY).
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.mouse.active = true;
    // Lift the loop to its faster cadence for a beat so the cursor-push reaction
    // stays crisp; it settles back to the resting rate once the pointer rests.
    this.pointerBoostUntil = performance.now() + 1200;
  }

  private handlePointerLeave() {
    this.mouse.active = false;
  }

  private handleScroll() {
    const current = window.scrollY;
    this.scrollVelocity = current - this.lastScrollY;
    this.lastScrollY = current;

    // Desktop: park the drift loop once the hero has fully receded, and wake it
    // just before the hero scrolls back into view. Hysteresis (1.15vh to park,
    // 0.9vh to wake) keeps a scroll hovering near the boundary from toggling the
    // loop every event. Touch is deliberately excluded: a fixed, blurred (and so
    // compositor-promoted) layer that stops repainting is the exact thing iOS
    // evicts mid-scroll, so there we keep painting continuously.
    if (!this.isCoarse && !this.reduceMotion) {
      const vh = window.innerHeight;
      if (!this.belowHero && current > vh * 1.15) {
        this.belowHero = true;
        this.stop();
      } else if (this.belowHero && current < vh * 0.9) {
        this.belowHero = false;
        if (!document.hidden) this.start();
      }
    }

    this.isScrolling = true;
    if (this.scrollTimer) window.clearTimeout(this.scrollTimer);
    this.scrollTimer = window.setTimeout(() => {
      this.isScrolling = false;
    }, 150);
  }

  /** Draw one frame. `motion` 0..1 scales the per-tick movement (0 = frozen). */
  private renderFrame(motion: number) {
    const { ctx, vw, vh } = this;
    ctx.clearRect(0, 0, vw, vh);

    this.scrollVelocity *= 0.9;
    const stretch = Math.min(1.35, 1 + Math.abs(this.scrollVelocity) * 0.003);

    for (const orb of this.orbs) {
      orb.x += orb.vx * motion;
      orb.y += orb.vy * motion;
      orb.phase += 0.006 * motion;
      orb.radius = orb.baseRadius + Math.sin(orb.phase) * 26;

      if (this.mouse.active && motion > 0) {
        const dx = this.mouse.x - orb.x;
        const dy = this.mouse.y - orb.y;
        const dist = Math.hypot(dx, dy) || 1;
        const maxDist = 340;
        if (dist < maxDist) {
          const force = (maxDist - dist) / maxDist;
          orb.x -= (dx / dist) * force * 1.8;
          orb.y -= (dy / dist) * force * 1.8;
        }
      }

      // Gentle wrap-around bounce within the viewport.
      if (orb.x < -orb.radius) orb.vx = Math.abs(orb.vx);
      if (orb.x > vw + orb.radius) orb.vx = -Math.abs(orb.vx);
      if (orb.y < -orb.radius) orb.vy = Math.abs(orb.vy);
      if (orb.y > vh + orb.radius) orb.vy = -Math.abs(orb.vy);

      const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
      const c = orb.color;
      if (c.startsWith('#')) {
        const r = parseInt(c.slice(1, 3), 16);
        const g = parseInt(c.slice(3, 5), 16);
        const b = parseInt(c.slice(5, 7), 16);
        // Slightly deeper core with a longer falloff — richer colour without
        // raising the overall field opacity (that goes muddy fast). Softened
        // further to compensate for reduced CSS blur.
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.45)`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.15)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      } else {
        gradient.addColorStop(0, c);
        gradient.addColorStop(1, 'transparent');
      }

      ctx.save();
      ctx.translate(orb.x, orb.y);
      ctx.scale(1 / stretch, stretch);
      ctx.translate(-orb.x, -orb.y);
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();
    }
  }

  private animate(now: number) {
    if (!this.running) return;
    this.animationFrame = requestAnimationFrame(this.animate);

    if (this.isScrolling) {
      this.lastFrameTime = now;
      return;
    }

    // Rest at the idle cadence; a recent pointer move lifts it to the active one
    // so the cursor-push reaction stays crisp. Scale `motion` by elapsed real
    // time so the drift speed is identical at either rate (and at an uncapped
    // 60fps run); clamp it so a dropped frame can't make the orbs jump.
    const interval = now < this.pointerBoostUntil ? this.activeInterval : this.idleInterval;
    const elapsed = now - this.lastFrameTime;
    if (elapsed < interval) return;
    this.lastFrameTime = now - (elapsed % interval);
    this.renderFrame(Math.min(elapsed / 16.67, 3));
  }
}

export function initFluid() {
  new FluidSimulation();
}
