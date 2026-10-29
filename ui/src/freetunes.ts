// FreeTunes releases linked in posts: read from the network by their contract id and played inside the post.
// FreeTunes (github.com/scobru/freetunes) keeps a release as JSON in one contract and each ~512 KB slice of MP3 (and
// the cover) in a chunk contract of its own; both are read here with nothing but their instance id.

const ID = "[1-9A-HJ-NP-Za-km-z]{20,60}";
// a release route, "#/r/<release id>.<parameters, hex>[/<track index>]", anywhere in a caption
const LINK_RE = new RegExp(`#\\/r\\/(${ID})\\.[0-9a-f]{96,}(?:\\/(\\d+))?`);
const ID_RE = new RegExp(`^${ID}$`);

export interface FtTrack { title: string; chunks: string[]; ms: number }
export interface FtRelease { title: string; artist: string; cover?: string; tracks: FtTrack[] }

/** The first FreeTunes link in a caption: the release and the track it points at (0 when none). */
export function freetunesLink(caption: string): { release: string; track: number } | null {
  const m = LINK_RE.exec(caption);
  return m ? { release: m[1], track: Number(m[2] ?? 0) } : null;
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

/** A release contract's state, checked: it comes from the network, so only well-formed addresses are kept. */
export function parseRelease(state: Uint8Array): FtRelease | null {
  try {
    const meta = JSON.parse(JSON.parse(new TextDecoder().decode(state)).meta_json);
    if (meta.deleted || !Array.isArray(meta.tracks)) return null;
    const tracks = meta.tracks.flatMap((t: { title?: unknown; chunks?: { a?: unknown; ms?: unknown }[] }) => {
      const chunks = Array.isArray(t?.chunks) ? t.chunks : [];
      if (!chunks.length || !chunks.every((c) => typeof c?.a === "string" && ID_RE.test(c.a))) return [];
      return [{ title: str(t.title) || "Untitled", chunks: chunks.map((c) => c.a as string), ms: chunks.reduce((s, c) => s + (Number(c.ms) || 0), 0) }];
    });
    const cover = str(meta.cover?.addr);
    return { title: str(meta.title), artist: str(meta.artist), cover: ID_RE.test(cover) ? cover : undefined, tracks };
  } catch {
    return null;
  }
}

export const fmtTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The placeholder in a post: the same html every draw (the feed reuses unchanged cards), filled in by `fillFreetunes`. */
export const freetunesCard = (caption: string): string => {
  const l = freetunesLink(caption);
  return l ? `<div class="ft-card" data-release="${l.release}" data-track="${l.track}"><span class="ft-note">♪ FreeTunes</span></div>` : "";
};

type Fetch = (instance: string) => Promise<Uint8Array | null>;
const releases = new Map<string, Promise<FtRelease | null>>();
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const once = (t: EventTarget, ev: string) => new Promise<void>((r) => t.addEventListener(ev, () => r(), { once: true }));

/** Fill the FreeTunes placeholders under `root` that are not filled yet: cover, titles and a play button. */
export function fillFreetunes(root: ParentNode, get: Fetch): void {
  root.querySelectorAll<HTMLElement>(".ft-card:not([data-state])").forEach((card) => {
    card.dataset.state = "loading";
    const id = card.dataset.release!;
    let p = releases.get(id);
    if (!p) releases.set(id, (p = get(id).then((s) => (s ? parseRelease(s) : null)).catch(() => null)));
    void p.then((rel) => {
      const t = rel?.tracks[Number(card.dataset.track)] ?? rel?.tracks[0];
      if (!rel || !t) return void ((card.dataset.state = "missing"), (card.innerHTML = `<span class="ft-note">♪ FreeTunes: release not found on the network</span>`));
      card.dataset.state = "ready";
      card.innerHTML = `<div class="ft-cover">♪</div><div class="ft-info"><b>${esc(t.title)}</b><small>${esc(rel.artist)}${rel.tracks.length > 1 ? ` · ${esc(rel.title)}` : ""}</small><small class="ft-status">${fmtTime(t.ms)}</small></div><button type="button" class="ft-play" aria-label="Play ${esc(t.title)}">▶</button><audio preload="none"></audio>`;
      if (rel.cover) void get(rel.cover).then((b) => {
        if (b) card.querySelector(".ft-cover")!.innerHTML = `<img alt="" src="${URL.createObjectURL(new Blob([b as BlobPart], { type: "image/jpeg" }))}" />`;
      }, () => {});
      const audio = card.querySelector("audio")!, btn = card.querySelector<HTMLButtonElement>(".ft-play")!, status = card.querySelector(".ft-status")!;
      let started = false;
      audio.onplay = () => {
        document.querySelectorAll<HTMLAudioElement>(".ft-card audio").forEach((a) => a !== audio && a.pause()); // one at a time
        btn.textContent = "❚❚";
      };
      audio.onpause = audio.onended = () => (btn.textContent = "▶");
      btn.onclick = () => {
        if (started) return void (audio.paused ? audio.play() : audio.pause());
        started = true;
        status.textContent = "Loading…";
        void stream(audio, t.chunks, get, (d, n) => (status.textContent = d < n ? `Loading ${d}/${n}` : fmtTime(t.ms))).catch(() => {
          started = false;
          status.textContent = "Could not load the track";
        });
      };
    });
  });
}

async function chunk(get: Fetch, id: string): Promise<Uint8Array> {
  const b = await get(id);
  if (!b) throw new Error("chunk not found");
  return b;
}

/** Play a track while its chunks arrive (each is a valid MP3 piece); without MediaSource for MP3, download it all first. */
async function stream(a: HTMLAudioElement, chunks: string[], get: Fetch, progress: (done: number, total: number) => void) {
  if (!("MediaSource" in window) || !MediaSource.isTypeSupported("audio/mpeg")) {
    const parts: Uint8Array[] = [];
    for (const c of chunks) parts.push(await chunk(get, c)), progress(parts.length, chunks.length);
    a.src = URL.createObjectURL(new Blob(parts as BlobPart[], { type: "audio/mpeg" }));
    return void (await a.play().catch(() => {}));
  }
  const ms = new MediaSource();
  a.src = URL.createObjectURL(ms);
  await once(ms, "sourceopen");
  const sb = ms.addSourceBuffer("audio/mpeg");
  let next = chunk(get, chunks[0]);
  for (let i = 0; i < chunks.length; i++) {
    const data = await next;
    if (i + 1 < chunks.length) next = chunk(get, chunks[i + 1]); // fetch the next while this one is appended
    const done = once(sb, "updateend");
    sb.appendBuffer(data as BufferSource);
    await done;
    if (i === 0) await a.play().catch(() => {});
    progress(i + 1, chunks.length);
  }
  if (ms.readyState === "open") ms.endOfStream();
}
