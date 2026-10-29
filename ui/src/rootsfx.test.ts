import test from "node:test";
import assert from "node:assert/strict";
import { rootPaths } from "./rootsfx.ts";

test("roots: two main roots per box, rootlets start on its outline, all points finite", () => {
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const box = { x: 10, y: 20, w: 300, h: 120 };
  const paths = rootPaths(box, rnd);
  assert.equal(paths.filter((p) => p.width > 1).length, 4, "two roots, each braided with a thinner one");
  assert.ok(paths.some((p) => p.width === 1), "some rootlets");
  for (const p of paths) {
    const nums = p.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    assert.ok(nums.every(Number.isFinite));
    // every point stays near the box (roots hug it, rootlets reach at most ~32px out)
    for (let i = 0; i < nums.length; i += 2) {
      assert.ok(nums[i] > box.x - 40 && nums[i] < box.x + box.w + 40, `x ${nums[i]}`);
      assert.ok(nums[i + 1] > box.y - 40 && nums[i + 1] < box.y + box.h + 40, `y ${nums[i + 1]}`);
    }
  }
});
