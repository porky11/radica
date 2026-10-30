// FreePolls polls linked in posts: the poll and its results, read from the network by the poll's contract id.
// FreePolls (github.com/scobru/freepolls) keeps a poll as JSON in one contract: the owner's signed schema and every
// signed response; the contract checks both, so here the state is only parsed (defensively: it comes from the network).

const ID = "[1-9A-HJ-NP-Za-km-z]{20,60}";
// a poll route, "#/f/<poll id>.<parameters, hex>", anywhere in a caption (an invite link "/i/<secret>" is not read)
const LINK_RE = new RegExp(`#\\/f\\/(${ID})\\.[0-9a-f]{96,}`);

export interface FpQuestion { text: string; kind: string; options: string[]; counts: number[]; answered: number }
export interface FpPoll { title: string; invite: boolean; responses: number; questions: FpQuestion[] }

/** The poll id of the first FreePolls link in a caption. */
export const freepollsLink = (caption: string): string | null => LINK_RE.exec(caption)?.[1] ?? null;

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

/** A poll contract's state as a tally: per option, how many answered it (`avail`: how many said yes). */
export function parsePoll(state: Uint8Array): FpPoll | null {
  try {
    const st = JSON.parse(new TextDecoder().decode(state));
    const schema = JSON.parse(st.schema_json);
    if (!Array.isArray(schema.questions)) return null;
    const answers = Object.values(st.responses ?? {}).flatMap((r) => {
      try {
        const a = JSON.parse((r as { answers_json: string }).answers_json);
        return a && typeof a === "object" ? [a] : [];
      } catch {
        return [];
      }
    });
    const questions = schema.questions.slice(0, 50).map((q: { id?: unknown; kind?: unknown; text?: unknown; options?: unknown }) => {
      const options = Array.isArray(q.options) ? q.options.slice(0, 50).map((o) => str(o)) : [];
      const counts = options.map(() => 0);
      let answered = 0;
      for (const a of answers) {
        const v = a[str(q.id)];
        if (v === undefined) continue;
        answered++;
        if (q.kind === "single" && typeof v === "number" && v in counts) counts[v]++;
        if (q.kind === "multi" && Array.isArray(v)) new Set(v).forEach((i) => typeof i === "number" && i in counts && counts[i]++);
        if (q.kind === "avail" && Array.isArray(v)) v.forEach((x, i) => x === 1 && i in counts && counts[i]++);
      }
      return { text: str(q.text, 500), kind: str(q.kind), options, counts, answered };
    });
    return { title: str(schema.title), invite: Array.isArray(schema.allowed), responses: answers.length, questions };
  } catch {
    return null;
  }
}

/** The placeholder in a post: the same html every draw (the feed reuses unchanged cards), filled in by `fillFreepolls`. */
export const freepollsCard = (caption: string): string => {
  const id = freepollsLink(caption);
  return id ? `<div class="fp-card" data-poll="${id}"><span class="fp-note">▤ FreePolls</span></div>` : "";
};

type Fetch = (instance: string) => Promise<Uint8Array | null>;
// shortcut: results as of the first read this session, upgrade to a subscription if people ask for live counts
const polls = new Map<string, Promise<FpPoll | null>>();
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const bars = (q: FpQuestion) => {
  const max = Math.max(1, q.kind === "avail" ? Math.max(...q.counts) : q.answered);
  const best = q.kind === "avail" && q.counts.some((c) => c > 0) ? q.counts.indexOf(Math.max(...q.counts)) : -1;
  return q.options
    .map((o, i) => `<li${i === best ? ' class="fp-best"' : ""}><span class="fp-bar" style="width:${Math.round((q.counts[i] / max) * 100)}%"></span><span>${esc(o)}</span><b>${q.counts[i]}</b></li>`)
    .join("");
};

/** Fill the FreePolls placeholders under `root` that are not filled yet: title, questions and results. */
export function fillFreepolls(root: ParentNode, get: Fetch): void {
  root.querySelectorAll<HTMLElement>(".fp-card:not([data-state])").forEach((card) => {
    card.dataset.state = "loading";
    const id = card.dataset.poll!;
    let p = polls.get(id);
    if (!p) polls.set(id, (p = get(id).then((s) => (s ? parsePoll(s) : null)).catch(() => null)));
    void p.then((poll) => {
      if (!poll) return void ((card.dataset.state = "missing"), (card.innerHTML = `<span class="fp-note">▤ FreePolls: poll not found on the network</span>`));
      card.dataset.state = "ready";
      const qs = poll.questions
        .map((q) => `<div class="fp-q"><b>${esc(q.text)}</b>${q.kind === "text" ? `<small>${q.answered} written answers</small>` : `<ul>${bars(q)}</ul>`}</div>`)
        .join("");
      card.innerHTML = `<div class="fp-head"><b>▤ ${esc(poll.title || "Poll")}</b><small>${poll.responses} ${poll.responses === 1 ? "response" : "responses"}${poll.invite ? " · invite only" : ""} · vote with the link above</small></div>${qs}`;
    });
  });
}
