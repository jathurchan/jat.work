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
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const h = rect.width / 2;
      const v = rect.height / 2;
      
      const x = e.clientX - rect.left - h;
      const y = e.clientY - rect.top - v;
      
      el.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
    };
    
    const handleLeave = () => {
      el.style.transform = `translate(0px, 0px)`;
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
