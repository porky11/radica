export const REFRESH_EVERY_MS = 60_000;
/** A contract we are subscribed to is pushed to us when it changes: reread it only as a safety net this often. */
export const LIVE_RECHECK_MS = 10 * 60_000;

/**
 * Whether to fetch a contract again. `liveAge`: ms since the last successful fetch on this connection (null when
 * there was none, or the socket dropped since, which drops the node's subscriptions). `unsent`: I hold changes the
 * network has not taken yet; a fetch is also what retries them.
 */
export function shouldFetch(o: { force: boolean; sinceLast: number; liveAge: number | null; unsent: boolean }): boolean {
  if (o.force) return true;
  if (o.sinceLast < REFRESH_EVERY_MS) return false;
  if (!o.unsent && o.liveAge !== null && o.liveAge < LIVE_RECHECK_MS) return false;
  return true;
}
