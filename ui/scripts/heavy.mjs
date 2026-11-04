// Which built files live in radica-assets (see src/heavyAssets.ts): shared by the split script and vite's URL rewrite,
// so the app never asks radica-assets for a file it was not published with.
export const HEAVY_WASM = /^assets\/(ModeratorWeb|ghostkey|river|river_room_contract)-[^/]*\.wasm$/;
export const isHeavy = (rel) => /^(moderation|gifs|translate)\//.test(rel) || HEAVY_WASM.test(rel);
