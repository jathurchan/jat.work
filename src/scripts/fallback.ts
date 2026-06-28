import { trackTeardown } from './lifecycle';

export function initScrollFallback() {
  if (CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
    return; // Browser has native support, do nothing.
  }

  const elements = document.querySelectorAll<HTMLElement>('.lab-card, .route-card, .route-node-disc');
  if (elements.length === 0) return;

  const io = new IntersectionObserver(
    (entries) => {
      let delay = 0;
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const target = e.target as HTMLElement;
          target.style.animationDelay = `${delay}s`;
          target.classList.add('is-inview-fallback');
          io.unobserve(target);
          delay += 0.1; // Stagger simultaneous entries in fallback
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -5% 0px' }
  );

  elements.forEach((el) => io.observe(el));
  trackTeardown(() => io.disconnect());
}
