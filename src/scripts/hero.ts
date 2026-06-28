// Hero niceties: the name collapse and the toolkit scroll-reveal.
import { trackTeardown } from './lifecycle';

/* ----------------------------------------------------------------------- *
 * Hero name: "Jathurchan" collapses to "Jat." — trailing letters shrink to
 * zero width (right to left) and the period glides left to follow them.
 * ----------------------------------------------------------------------- */
export function initName() {
  const wrap = document.getElementById('hero-name');
  if (!wrap) return;
  const drops = Array.from(wrap.querySelectorAll<HTMLElement>('.nm-drop'));
  if (!drops.length) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    // No animation: jump straight to the short name.
    drops.forEach((d) => {
      d.style.transition = 'none';
      d.style.width = '0';
      d.style.opacity = '0';
    });
    return;
  }

  // Pin each letter's natural width so the collapse animates from a real value.
  drops.forEach((d) => {
    d.style.width = `${d.getBoundingClientRect().width}px`;
  });

  // Collapse right to left after the name has risen in; overlapping steps keep
  // the dot moving continuously.
  const start = 1100;
  const step = 95;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      drops
        .slice()
        .reverse()
        .forEach((d, i) => {
          window.setTimeout(() => d.classList.add('drop-gone'), start + i * step);
        });
    }),
  );
}

export function initToolkitPulse() {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.toolkit-cat'));
  if (cards.length === 0) return;

  // Each card lights up in its accent colour as it scrolls into view, and stays
  // lit — so the colourful state happens on scroll, no hover needed.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          (e.target as HTMLElement).classList.add('is-inview');
          io.unobserve(e.target); // one-way reveal
        }
      }
    },
    { threshold: 0.45, rootMargin: '0px 0px -8% 0px' },
  );
  cards.forEach((c) => io.observe(c));
  trackTeardown(() => io.disconnect());
}

export function initName3D() {
  const name = document.getElementById('hero-name');
  const heroSection = document.querySelector('.hero');
  if (!name || !heroSection) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;

  let frame = 0;
  const onMove = (e: Event) => {
    const ev = e as MouseEvent;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const rect = name.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      
      const maxDistX = window.innerWidth / 2;
      const maxDistY = window.innerHeight / 2;
      
      let dx = (ev.clientX - cx) / maxDistX;
      let dy = (ev.clientY - cy) / maxDistY;
      
      dx = Math.max(-1, Math.min(1, dx));
      dy = Math.max(-1, Math.min(1, dy));

      const rotX = dy * -14; 
      const rotY = dx * 14;

      const shadowX = dx * -30;
      const shadowY = Math.max(0, dy * -20) + 4; // keep shadow mostly pulling down
      
      name.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.04, 1.04, 1.04)`;
      name.style.textShadow = `${shadowX}px ${shadowY}px 32px color-mix(in srgb, var(--frame) 90%, transparent)`;
    });
  };

  const onLeave = () => {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    name.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    name.style.textShadow = `0 4px 24px color-mix(in srgb, var(--frame) 80%, transparent)`;
  };

  heroSection.addEventListener('mousemove', onMove);
  heroSection.addEventListener('mouseleave', onLeave);
  
  trackTeardown(() => {
    heroSection.removeEventListener('mousemove', onMove);
    heroSection.removeEventListener('mouseleave', onLeave);
    if (frame) cancelAnimationFrame(frame);
  });
}
