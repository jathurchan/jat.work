// Hero "Surprise me" — an I'm-feeling-lucky roulette.
//
// Hovering (or focusing) spins the wheel and settles on exactly ONE random
// section: the symbol slot-machines through the sections — each in its own icon
// and brand colour — decelerating to a stop, and the button takes on that
// section's colour. Clicking flies you straight there (no waiting on a spin).
// Move away without clicking and come back, and it rerolls a different one.
// There's no circle: the colour lives in the symbol, the label, and the glow.
// Reduced motion settles instantly.
import { trackTeardown } from './lifecycle';
import { sectionIcons } from '../lib/icons';

interface Destination {
  /** Target section id on the home page. */
  id: string;
  /** Engaging, on-brand label shown when the wheel lands here. */
  label: string;
  /** Brand colour the button adopts on landing — cycles the four Google hues. */
  color: string;
}

// The full site, in engaging language. Labels are kept short and similar in
// length so the fixed-width reel never resizes the button as it cycles.
const DESTINATIONS: Destination[] = [
  { id: 'featured', label: 'My project', color: 'var(--g-blue)' },
  { id: 'toolkit', label: 'My toolkit', color: 'var(--g-green)' },
  { id: 'experience', label: 'My journey', color: 'var(--g-yellow)' },
  { id: 'writing', label: 'My writing', color: 'var(--g-red)' },
];
const IDLE_LABEL = 'Explore';

// Quick but legible: ~1s total. Early ticks blur past (you're not meant to read
// them); the deceleration stretches the last couple so the wheel visibly slows,
// and the final pick locks static — always readable once it settles.
const SPIN_TICKS = 7; // slots that flick past before it settles
const MIN_TICK = 42; // fastest tick (ms) at the start of the spin
const MAX_TICK = 205; // slowest tick (ms) as the wheel comes to rest
const ARRIVE_MS = 1250; // how long the destination glow lingers (ms)

// Colourful idle glyph — a sparkle drawn with a four-hue gradient (the same
// Google palette the site runs on). With the conic dot gone, the symbol is what
// carries the colour at rest.
const SPARKLE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="url(#jw-spark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<defs><linearGradient id="jw-spark" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">' +
  '<stop offset="0" stop-color="var(--g-blue)"/><stop offset="0.4" stop-color="var(--g-green)"/>' +
  '<stop offset="0.72" stop-color="var(--g-yellow)"/><stop offset="1" stop-color="var(--g-red)"/>' +
  '</linearGradient></defs>' +
  '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/></svg>';
const iconSvg = (id: string) =>
  sectionIcons[id]
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${sectionIcons[id]}</svg>`
    : '';

// Gentle, short slide so rapid ticks read as smooth motion rather than a jump.
const FLIP: Keyframe[] = [
  { transform: 'translateY(46%)', opacity: 0 },
  { transform: 'translateY(0)', opacity: 1 },
];
const FLIP_OPTS: KeyframeAnimationOptions = { duration: 160, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };

type Mode = 'idle' | 'rolling' | 'locked';

export function initSurprise() {
  const btn = document.querySelector<HTMLButtonElement>('[data-surprise]');
  const reel = btn?.querySelector<HTMLElement>('.surprise-reel');
  const labelEl = btn?.querySelector<HTMLElement>('[data-surprise-label]');
  const icoEl = btn?.querySelector<HTMLElement>('[data-surprise-ico]');
  if (!btn || !reel || !labelEl || !icoEl) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let mode: Mode = 'idle';
  let target: Destination | null = null; // the one section this hover landed on
  let i = Math.floor(Math.random() * DESTINATIONS.length);

  let arriveTimer = 0;
  const spinTimers = new Set<number>();
  const clearSpin = () => {
    spinTimers.forEach((t) => clearTimeout(t));
    spinTimers.clear();
  };
  const clearArrive = () => {
    if (arriveTimer) { clearTimeout(arriveTimer); arriveTimer = 0; }
  };

  const pick = () => DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)];
  const flip = () => {
    if (!reduce) reel.animate(FLIP, FLIP_OPTS);
  };
  const showDestination = (d: Destination) => {
    icoEl.innerHTML = iconSvg(d.id);
    labelEl.textContent = d.label;
    btn.style.setProperty('--c', d.color);
  };
  const showIdle = () => {
    icoEl.innerHTML = SPARKLE;
    labelEl.textContent = IDLE_LABEL;
    btn.style.removeProperty('--c');
  };
  const step = () => {
    i = (i + 1) % DESTINATIONS.length;
    showDestination(DESTINATIONS[i]);
    flip();
  };

  const travel = (dest: Destination) => {
    const el = document.getElementById(dest.id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (reduce) return;
    el.style.setProperty('--surprise-c', dest.color);
    el.classList.add('is-surprise-target');
    window.setTimeout(() => {
      el.classList.remove('is-surprise-target');
      el.style.removeProperty('--surprise-c');
    }, ARRIVE_MS);
  };

  const land = () => {
    if (!target) return;
    mode = 'locked';
    i = DESTINATIONS.indexOf(target);
    showDestination(target);
    flip();
    btn.classList.remove('is-rolling');
    btn.classList.add('is-locked');
  };

  // One roll → settles on exactly one destination (`target`). The pick is fixed
  // up front, so a click any time during the spin travels there immediately.
  const roll = () => {
    if (mode !== 'idle') return;
    target = pick();
    if (reduce) {
      land();
      return;
    }
    mode = 'rolling';
    btn.classList.add('is-rolling');
    let elapsed = 0;
    for (let k = 0; k < SPIN_TICKS; k++) {
      const p = k / (SPIN_TICKS - 1);
      const ease = 1 - Math.pow(1 - p, 2.1);
      elapsed += MIN_TICK + (MAX_TICK - MIN_TICK) * ease;
      const isLast = k === SPIN_TICKS - 1;
      const t = window.setTimeout(() => {
        spinTimers.delete(t);
        if (isLast) land();
        else step();
      }, elapsed);
      spinTimers.add(t);
    }
  };

  const reset = () => {
    if (mode === 'idle') return;
    clearSpin();
    clearArrive();
    mode = 'idle';
    target = null;
    btn.classList.remove('is-rolling', 'is-locked');
    showIdle();
  };

  const go = () => {
    // Hover already chose one (settled, or still settling) → travel instantly.
    if (target) {
      travel(target);
      return;
    }
    // No hover yet (touch tap, or a fast first click before the spin starts):
    // pick now, snap it onto the button, and fly almost immediately — so a click
    // always works from the very start and never waits on a spin.
    clearSpin();
    const dest = pick();
    target = dest;
    mode = 'locked';
    i = DESTINATIONS.indexOf(dest);
    showDestination(dest);
    flip();
    btn.classList.remove('is-rolling');
    btn.classList.add('is-locked');
    if (reduce) {
      travel(dest);
      return;
    }
    arriveTimer = window.setTimeout(() => travel(dest), 170);
  };

  btn.addEventListener('pointerenter', roll);
  btn.addEventListener('focus', roll);
  btn.addEventListener('pointerleave', reset);
  btn.addEventListener('blur', reset);
  btn.addEventListener('click', go);

  showIdle(); // seed the colourful sparkle at rest

  // Element listeners die with the swapped-out button on View Transitions, but
  // any in-flight timers would leak — clear them on teardown.
  trackTeardown(() => {
    clearSpin();
    clearArrive();
  });
}
