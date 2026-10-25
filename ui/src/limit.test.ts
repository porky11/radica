import test from "node:test";
import assert from "node:assert/strict";
import { limiter } from "./limit.ts";

test("limit: never more than max at once, all finish, a failure frees its slot", async () => {
  const run = limiter(3);
  let now = 0;
  let peak = 0;
  const task = (i: number) =>
    run(async () => {
      peak = Math.max(peak, ++now);
      await new Promise((r) => setTimeout(r, 5));
      now--;
      if (i === 4) throw new Error("boom");
      return i;
    });
  const out = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => task(i)));
  assert.equal(peak, 3);
  assert.equal(out.filter((o) => o.status === "fulfilled").length, 19);
  assert.equal(out[4].status, "rejected");
});
