// Splits ui/dist into the two Freenet web containers (see src/heavyAssets.ts):
//   node scripts/split-freenet-dist.mjs app     -> ui/dist-app: the app without the heavy files
//   node scripts/split-freenet-dist.mjs assets  -> ui/dist-assets: only the heavy files (radica-assets)
// The heavy files' fingerprint is saved by "assets" and checked by "app", so an app that needs heavy files the
// published radica-assets lacks (e.g. after a moderator upgrade) is never published.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ui = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(ui, "dist");
const cfgPath = path.join(ui, "freenet-assets.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
export const isHeavy = (rel) => /^(moderation|gifs|translate)\//.test(rel) || /^assets\/ModeratorWeb-[^/]*\.wasm$/.test(rel);

const files = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p, base) : [path.relative(base, p).split(path.sep).join("/")];
  });

function copy(rels, out) {
  fs.rmSync(out, { recursive: true, force: true });
  for (const rel of rels) {
    fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    fs.copyFileSync(path.join(dist, rel), path.join(out, rel));
  }
}

const mode = process.argv[2];
if (!fs.existsSync(dist)) throw new Error("ui/dist missing: build first");
const all = files(dist).sort();
const heavy = all.filter(isHeavy);
const hash = createHash("sha256");
for (const rel of heavy) hash.update(rel + "\0").update(fs.readFileSync(path.join(dist, rel)));
const fingerprint = hash.digest("hex");

if (mode === "assets") {
  copy(heavy, path.join(ui, "dist-assets"));
  fs.writeFileSync(path.join(ui, "dist-assets", "index.html"), "<!doctype html><meta charset=utf-8><title>Radica assets</title><p>Files used by Radica.</p>\n");
  fs.writeFileSync(cfgPath, JSON.stringify({ ...cfg, fingerprint }, null, 2) + "\n");
  console.log(`radica-assets: ${heavy.length} files in ui/dist-assets (fingerprint saved to ui/freenet-assets.json)`);
} else if (mode === "app") {
  if (!cfg.key) {
    copy(all, path.join(ui, "dist-app"));
    console.log("No radica-assets key in ui/freenet-assets.json: publishing the app with every file.");
  } else {
    if (cfg.fingerprint !== fingerprint) {
      console.error("The heavy files changed since radica-assets was last published. Run first: npm run freenet:assets:update");
      process.exit(1);
    }
    copy(all.filter((rel) => !isHeavy(rel)), path.join(ui, "dist-app"));
    console.log(`App: ${all.length - heavy.length} files in ui/dist-app; ${heavy.length} heavy files load from radica-assets.`);
  }
} else {
  console.error("usage: split-freenet-dist.mjs app|assets");
  process.exit(2);
}
