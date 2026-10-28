/** Runs at most `max` calls of the returned function at once; the rest wait their turn, in order. */
export function limiter(max: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let free = max;
  const waiting: (() => void)[] = [];
  return async (fn) => {
    if (free > 0) free--;
    else await new Promise<void>((r) => waiting.push(r));
    try {
      return await fn();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else free++;
    }
  };
}

/** Let the browser handle input and paint before the next chunk of work: an await on a ready promise does not. */
export const yieldToMain = (): Promise<void> =>
  (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler?.yield?.() ?? new Promise((r) => setTimeout(r, 0));
