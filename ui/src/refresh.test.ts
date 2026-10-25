import test from "node:test";
import assert from "node:assert/strict";
import { shouldFetch, REFRESH_EVERY_MS, LIVE_RECHECK_MS } from "./refresh.ts";

const base = { force: false, sinceLast: 5 * REFRESH_EVERY_MS, liveAge: 5 * REFRESH_EVERY_MS, unsent: false };

test("refresh: a subscribed contract is not reread until the safety recheck", () => {
  assert.equal(shouldFetch(base), false);
  assert.equal(shouldFetch({ ...base, liveAge: LIVE_RECHECK_MS + 1 }), true);
});

test("refresh: a forced fetch, unsent changes, or no live subscription always fetch (after the 1 min throttle)", () => {
  assert.equal(shouldFetch({ ...base, force: true, sinceLast: 0 }), true); // a change notification
  assert.equal(shouldFetch({ ...base, unsent: true }), true);
  assert.equal(shouldFetch({ ...base, liveAge: null }), true); // never fetched, or the socket dropped
  assert.equal(shouldFetch({ ...base, liveAge: null, sinceLast: 1000 }), false); // still throttled
});
