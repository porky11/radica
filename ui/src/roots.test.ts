import test from "node:test";
import assert from "node:assert/strict";
import { rootsSvg } from "./roots.ts";

test("roots: one root and node per person, fresh ones pulse, names escaped and cut, capped", () => {
  const svg = rootsSvg([
    { pk: "aa", name: "Ivvor", fresh: true },
    { pk: "bb", name: "<b>HostFat</b>", fresh: false },
    { pk: "cc", name: "Coniareconio", fresh: false },
  ]);
  assert.equal(svg.match(/class="root-line/g)?.length, 3);
  assert.equal(svg.match(/class="root-pulse"/g)?.length, 1);
  assert.match(svg, /data-author="aa"[^>]*aria-label="Ivvor, posted lately"/);
  assert.ok(!svg.includes("<b>"), "names are escaped");
  assert.match(svg, />Coniarecon…</);
  assert.equal(rootsSvg([]), "");
  const many = Array.from({ length: 20 }, (_, i) => ({ pk: `p${i}`, name: `P${i}`, fresh: false }));
  assert.equal(rootsSvg(many).match(/class="root-node/g)?.length, 12);
});
