// Re-init lifecycle for Astro View Transitions.
//
// With <ClientRouter />, navigation swaps the DOM without re-running the
// entry module, so canvases/filters/observers would come back dead after
// returning from a post. Every listener/observer/loop that lives on a
// *persistent* target (window, document) — or that must be disconnected — is
// registered here and torn down before the next boot so re-init never stacks
// duplicates.
let teardowns: Array<() => void> = [];

export function bindGlobal<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  handler: (e: WindowEventMap[K]) => void,
  opts?: boolean | AddEventListenerOptions,
): void;
export function bindGlobal<K extends keyof DocumentEventMap>(
  target: Document,
  type: K,
  handler: (e: DocumentEventMap[K]) => void,
  opts?: boolean | AddEventListenerOptions,
): void;
export function bindGlobal(
  target: EventTarget,
  type: string,
  handler: EventListenerOrEventListenerObject,
  opts?: boolean | AddEventListenerOptions,
): void;
export function bindGlobal(
  target: EventTarget,
  type: string,
  handler: EventListenerOrEventListenerObject,
  opts?: boolean | AddEventListenerOptions,
) {
  target.addEventListener(type, handler, opts);
  teardowns.push(() => target.removeEventListener(type, handler, opts));
}

export function trackTeardown(fn: () => void) {
  teardowns.push(fn);
}

export function runTeardowns() {
  for (const fn of teardowns) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  teardowns = [];
}
