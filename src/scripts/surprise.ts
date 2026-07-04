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
// Touch only: how long the wheel rests on its final pick before flying there, so
// the landed section is clearly readable and never mistaken for the prior tick.
const LAND_SETTLE_MS = 470;

// Idle glyph: a shuffle mark in the resting accent — it names the mechanic
// (random jump) instead of decorating. (Was a rainbow-gradient sparkle.)
const SPARKLE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>';
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
  // Touch devices have no hover, so the roulette never got to *show* its pick —
  // a tap just teleported you to a random section. On coarse pointers we drive
  // the wheel from the tap instead (see the bindings at the foot of this fn).
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  let mode: Mode = 'idle';
  let target: Destination | null = null; // the one section this hover landed on
  let i = Math.floor(Math.random() * DESTINATIONS.length);
  // Touch only: when set, the wheel travels to its pick the moment it lands.
  let travelOnLand = false;

  let arriveTimer = 0;
  let idleResetTimer = 0;
  const spinTimers = new Set<number>();
  const clearSpin = () => {
    spinTimers.forEach((t) => clearTimeout(t));
    spinTimers.clear();
  };
  const clearArrive = () => {
    if (arriveTimer) { clearTimeout(arriveTimer); arriveTimer = 0; }
  };
  const clearIdleReset = () => {
    if (idleResetTimer) { clearTimeout(idleResetTimer); idleResetTimer = 0; }
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
    const dest = target;
    mode = 'locked';
    i = DESTINATIONS.indexOf(dest);
    showDestination(dest);
    flip();
    btn.classList.remove('is-rolling');
    btn.classList.add('is-locked');
    // Touch: hold on the landed pick for a beat so it visibly *settles* and can
    // be read, THEN glide there (and afterwards reset to the idle "Explore"
    // prompt so the next tap rolls a fresh one). Travelling on the same frame the
    // label updates made the scroll begin before the eye registered the final
    // pick, so the previous — longer-held — tick looked like the choice. That was
    // the apparent off-by-one on mobile.
    if (travelOnLand) {
      travelOnLand = false;
      clearArrive();
      arriveTimer = window.setTimeout(() => {
        travel(dest);
        clearIdleReset();
        idleResetTimer = window.setTimeout(reset, ARRIVE_MS);
      }, LAND_SETTLE_MS);
    }
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
    // Mouse path: the reel is *live*. A click commits to the section showing on
    // the button right now — snapping the spin to a stop there — so you always
    // land where you looked, even mid-spin. (roll()'s up-front pick is merely
    // where the reel comes to rest on its own if you hover and never click.)
    clearSpin();
    // The section currently painted on the button: DESTINATIONS[i] once a roll
    // has begun (every tick leaves `i` on what's shown); otherwise — a click with
    // no prior hover — pick one now so the button always does something.
    const dest = mode === 'idle' ? pick() : DESTINATIONS[i];
    target = dest;
    i = DESTINATIONS.indexOf(dest);
    mode = 'locked';
    showDestination(dest);
    flip();
    btn.classList.remove('is-rolling');
    btn.classList.add('is-locked');
    if (reduce) {
      travel(dest);
      return;
    }
    // A brief lock-in beat so the caught section visibly commits (colour + scale)
    // before the page glides to it.
    clearArrive();
    arriveTimer = window.setTimeout(() => travel(dest), 150);
  };

  if (coarse) {
    // Touch: a tap spins the wheel and travels once it lands, so you actually
    // see which section "I'm feeling lucky" chose on the way there. A second tap
    // mid-spin skips ahead and goes immediately; tapping a settled pick re-visits
    // it. Hover/focus rolls are skipped — there's no hover, and `focus` fires on
    // tap, which would start a spin the click then cut short.
    btn.addEventListener('click', () => {
      if (mode === 'idle') {
        clearIdleReset();
        travelOnLand = true;
        roll(); // reduced-motion lands synchronously and travels at once
      } else if (mode === 'rolling') {
        clearSpin();
        travelOnLand = true;
        land();
      } else if (target) {
        // Already settled (or settling): go now, cancelling the pending
        // auto-travel so we don't scroll twice.
        clearArrive();
        travel(target);
        clearIdleReset();
        idleResetTimer = window.setTimeout(reset, ARRIVE_MS);
      }
    });
  } else {
    btn.addEventListener('pointerenter', roll);
    btn.addEventListener('focus', roll);
    btn.addEventListener('pointerleave', reset);
    btn.addEventListener('blur', reset);
    btn.addEventListener('click', go);
  }

  showIdle(); // seed the colourful sparkle at rest

  // Element listeners die with the swapped-out button on View Transitions, but
  // any in-flight timers would leak — clear them on teardown.
  trackTeardown(() => {
    clearSpin();
    clearArrive();
    clearIdleReset();
  });
}
