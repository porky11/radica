// On-device post translation with Bergamot (Mozilla's Firefox Translations engine, WebAssembly). The engine lives in
// radica-assets; the models (~22 MB per direction) live in one web container per language, radica-lang-<code>, holding
// <code>→en and en→<code> (other pairs go through English). Nothing is downloaded until someone presses Translate.
// Off the gateway (dev server) they come from ui/translation-models; shortcut: Electron has none, ship them if it needs it.
import { heavyUrl } from "./heavyAssets.ts";

declare const __RADICA_LANG_KEYS__: Record<string, string>;

export const LANGS: Record<string, string> = { en: "English", it: "Italiano", es: "Español", de: "Deutsch", fr: "Français", pt: "Português" };

// Words frequent in one language and rare in the others (shared ones like "que", "la", "con" left out)
const STOP: Record<string, string[]> = {
  en: "the and is are you that this with have not was but what".split(" "),
  it: "che non per sono della gli anche questo più ho sei perché nel alla".split(" "),
  es: "el los las por pero más muy está también hay porque del yo".split(" "),
  de: "der die und das ist nicht ich ein eine mit auch auf sie".split(" "),
  fr: "les et est des une pas pour dans sur avec je ce vous".split(" "),
  pt: "não os em é você está muito uma isso mas foi também".split(" "),
};

/** The post's language among LANGS, or null when it is too short or unclear to tell. */
export function detectLang(text: string): string | null {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const scores = Object.entries(STOP).map(([lang, stop]) => [lang, words.filter((w) => stop.includes(w)).length] as const);
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] >= 2 && scores[0][1] > scores[1][1] ? scores[0][0] : null;
}

const LANG_KEYS: Record<string, string> = typeof __RADICA_LANG_KEYS__ === "object" ? __RADICA_LANG_KEYS__ : {};
const gateway = () => (typeof location === "undefined" ? null : /^(.*\/contract\/web\/)[^/]+\//.exec(location.href)?.[1] ?? null);

/** Languages we can translate between here: on the gateway, English plus those with a published radica-lang. */
export function availableLangs(): string[] {
  return gateway() ? ["en", ...Object.keys(LANG_KEYS).filter((l) => LANG_KEYS[l] && LANGS[l])] : Object.keys(LANGS);
}

/** The reader's language, when we can translate into it; otherwise English. */
export function readerLang(): string {
  const l = (typeof navigator === "undefined" ? "en" : navigator.language || "en").slice(0, 2).toLowerCase();
  return availableLangs().includes(l) ? l : "en";
}

/** Whether to offer Translate on a post: its language is known, available, and not the reader's. */
export function translatableFrom(text: string): string | null {
  const from = detectLang(text);
  return from && from !== readerLang() && availableLangs().includes(from) ? from : null;
}

type Registry = { from: string; to: string; files: Record<string, { name: string; expectedSha256Hash: string }> }[];

/**
 * Model list with absolute file URLs: on the gateway from each radica-lang container; elsewhere from the models
 * downloaded into ui/translation-models (served by the dev server; Mozilla's bucket allows no browser downloads).
 */
async function loadRegistry(): Promise<Registry> {
  const gw = gateway();
  const langs = availableLangs().filter((l) => l !== "en");
  const sources = langs.map((l) => (gw ? `${gw}${LANG_KEYS[l]}/` : new URL(`translation-models/${l}/`, document.baseURI).href));
  const out: Registry = [];
  for (const base of sources) {
    // a language not downloaded/published is skipped (the dev server answers it with the app's page)
    const res = await fetch(`${base}registry.json`, { credentials: "omit" }).catch(() => null);
    const reg: Record<string, Registry[number]["files"]> | null = res?.ok ? await res.json().catch(() => null) : null;
    if (!reg) continue;
    for (const [pair, files] of Object.entries(reg)) {
      const [from, to] = [pair.slice(0, 2), pair.slice(2, 4)];
      if (!LANGS[from] || !LANGS[to]) continue;
      const abs = Object.fromEntries(Object.entries(files).map(([part, f]) => [part, { ...f, name: `${base}${pair}/${f.name}` }]));
      out.push({ from, to, files: abs });
    }
  }
  if (!out.length) throw new Error(gw ? "no translation models published" : "no models here: run node ui/scripts/fetch-translation-models.mjs <lang>");
  return out;
}

let translator: Promise<{ translate: (r: { from: string; to: string; text: string; html: boolean }) => Promise<{ target: { text: string } }> }> | null = null;

function getTranslator() {
  return (translator ??= (async () => {
    const { BatchTranslator, TranslatorBacking } = await import("@browsermt/bergamot-translator/translator.js");
    // The app runs in an opaque-origin iframe: a worker must come from a blob: URL, which then loads the engine by
    // absolute URL (vite.config.ts rewrites the worker to read self.__bergamotBase).
    const base = new URL(heavyUrl("translate/"), document.baseURI).href;
    const boot = URL.createObjectURL(new Blob([`self.__bergamotBase=${JSON.stringify(base)};importScripts(self.__bergamotBase+"translator-worker.js");`], { type: "text/javascript" }));
    class RadicaBacking extends TranslatorBacking {
      loadModelRegistery() {
        return loadRegistry();
      }
      loadWorker() {
        const Real = globalThis.Worker;
        globalThis.Worker = class extends Real {
          constructor() {
            super(boot);
          }
        };
        try {
          return super.loadWorker(); // creates its Worker synchronously, before its first await
        } finally {
          globalThis.Worker = Real;
        }
      }
    }
    const options = { pivotLanguage: "en", downloadTimeout: 0 };
    return new BatchTranslator(options, new RadicaBacking(options));
  })().catch((err) => {
    translator = null;
    throw err;
  }));
}

/** Plain text translated on this device; the first use downloads the engine and the models it needs. */
export async function translateText(text: string, from: string, to: string): Promise<string> {
  const t = await getTranslator();
  return (await t.translate({ from, to, text, html: false })).target.text;
}
