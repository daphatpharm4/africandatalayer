import { flushSync } from 'react-dom';

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    finished: Promise<void>;
  };
};

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function runViewTransition(update: () => void): Promise<void> {
  const doc = document as ViewTransitionDocument;
  if (typeof document === 'undefined' || !doc.startViewTransition || prefersReducedMotion()) {
    update();
    return Promise.resolve();
  }

  try {
    return doc
      .startViewTransition(() => {
        flushSync(update);
      })
      .finished.catch(() => undefined);
  } catch {
    update();
    return Promise.resolve();
  }
}
