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
