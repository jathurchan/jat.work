import { trackTeardown } from './lifecycle';

export function initMagnetic() {
  const magnets = document.querySelectorAll<HTMLElement>('[data-magnetic]');
  
  magnets.forEach(el => {
    el.style.transform = '';
  });
  
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const handlers = new Map<HTMLElement, { move: (e: MouseEvent) => void, leave: () => void }>();

  magnets.forEach(el => {
    let frame = 0;
    const handleMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      if (frame) return; // rAF-throttle: one transform write per frame
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = el.getBoundingClientRect();
        const dx = x - rect.left - rect.width / 2;
        const dy = y - rect.top - rect.height / 2;
        // translate3d keeps it on the same GPU layer as the element's glass, so
        // the pull doesn't shear backdrop-filter on Safari.
        el.style.transform = `translate3d(${dx * 0.2}px, ${dy * 0.2}px, 0)`;
      });
    };

    const handleLeave = () => {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      el.style.transform = 'translate3d(0, 0, 0)';
    };

    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    
    handlers.set(el, { move: handleMove, leave: handleLeave });
  });

  trackTeardown(() => {
    magnets.forEach(el => {
      const h = handlers.get(el);
      if (h) {
        el.removeEventListener('mousemove', h.move);
        el.removeEventListener('mouseleave', h.leave);
      }
    });
  });
}
