// The image filter (its wasm, LiteRT runtime and model) and the stock GIFs are ~75 MB that almost never change. On
// Freenet they live in a second web container (radica-assets, see scripts/split-freenet-dist.mjs), so a Radica update
// re-uploads only the app. Elsewhere (dev server, Electron, a build without an assets key) they ship with the app.
declare const __RADICA_ASSETS_KEY__: string;

const KEY = typeof __RADICA_ASSETS_KEY__ === "string" ? __RADICA_ASSETS_KEY__ : "";
const GATEWAY_APP = /^(.*\/contract\/web\/)[^/]+\//;

/** URL of a heavy file, given by its path in the app ("moderation/…", "./gifs/…"); other URLs come back unchanged. */
export const heavyUrl = (path: string): string => heavyUrlFor(path, KEY, typeof location === "undefined" ? "" : location.href);

export function heavyUrlFor(path: string, key: string, pageUrl: string): string {
  const m = key ? GATEWAY_APP.exec(pageUrl) : null;
  if (!m || !/^(\.?\/)?(moderation|gifs|assets)\//.test(path)) return path;
  return `${m[1]}${key}/${path.replace(/^\.?\//, "")}`;
}

// vite.config.ts points the filter's wasm (bundled by the package itself) here
(globalThis as { __radicaHeavyUrl?: typeof heavyUrl }).__radicaHeavyUrl = heavyUrl;
