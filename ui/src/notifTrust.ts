/**
 * Activity notifications come from an inbox anyone can write to, so a stranger (or a script) can fill it. Those from people
 * I trust stay as they are; the rest go under "Others": listed, but they neither light the bell nor the tab title.
 */
export function splitNotifs<T>(list: T[], known: (n: T) => boolean): { main: T[]; others: T[] } {
  const main: T[] = [];
  const others: T[] = [];
  for (const n of list) (known(n) ? main : others).push(n);
  return { main, others };
}
