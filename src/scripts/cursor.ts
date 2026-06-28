import { trackTeardown } from './lifecycle';

export function initCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cursor = document.getElementById('custom-cursor');
  if (!cursor) return;

  document.body.classList.add('has-custom-cursor');

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let cursorX = mouseX;
  let cursorY = mouseY;
  let isHovering = false;
  let frame = 0;

  const onMouseMove = (e: MouseEvent) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    const target = e.target as HTMLElement;
    const isInteractive = target.closest('a, button, [data-magnetic], input, textarea, select, .pillar, .lab-card, .route-card, .surprise');
    
    if (isInteractive && !isHovering) {
      isHovering = true;
      cursor.classList.add('is-hovering');
    } else if (!isInteractive && isHovering) {
      isHovering = false;
      cursor.classList.remove('is-hovering');
    }
  };

  const loop = () => {
    // Lerp for smooth trailing effect
    cursorX += (mouseX - cursorX) * 0.25;
    cursorY += (mouseY - cursorY) * 0.25;
    
    cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
    frame = requestAnimationFrame(loop);
  };

  window.addEventListener('mousemove', onMouseMove);
  frame = requestAnimationFrame(loop);

  trackTeardown(() => {
    window.removeEventListener('mousemove', onMouseMove);
    if (frame) cancelAnimationFrame(frame);
    document.body.classList.remove('has-custom-cursor');
  });
}
