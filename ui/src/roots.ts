// "Your roots": you at the center, a root to each person you follow. A root that posted lately pulses.
const escape = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cut = (t: string) => (t.length > 11 ? t.slice(0, 10) + "…" : t);

export interface Root {
  pk: string;
  name: string;
  fresh: boolean; // posted lately
}

/** The graph as an SVG string (empty when there is nobody to draw). At most `max` roots; the caller says how many more. */
export function rootsSvg(roots: Root[], max = 12): string {
  const shown = roots.slice(0, max);
  if (!shown.length) return "";
  const [cx, cy, rx, ry] = [160, 130, 112, 92];
  const lines: string[] = [];
  const nodes: string[] = [];
  shown.forEach((r, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / shown.length;
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * Math.sin(a);
    // bend each root a little sideways, so they read as roots and not spokes
    const qx = (cx + x) / 2 + (y - cy) * 0.18;
    const qy = (cy + y) / 2 - (x - cx) * 0.18;
    const f = r.fresh ? " fresh" : "";
    lines.push(`<path class="root-line${f}" d="M${cx} ${cy} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}"></path>`);
    const cos = Math.cos(a);
    const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
    const lx = x + cos * 13;
    const ly = y + Math.sin(a) * 15 + 4;
    nodes.push(
      `<g class="root-node${f}" data-author="${escape(r.pk)}" tabindex="0" role="button" aria-label="${escape(r.name)}${r.fresh ? ", posted lately" : ""}">` +
        (r.fresh ? `<circle class="root-pulse" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8"></circle>` : "") +
        `<circle class="root-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7"></circle>` +
        `<text class="root-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}">${escape(cut(r.name))}</text></g>`
    );
  });
  return (
    `<svg class="roots-svg" viewBox="0 0 320 260" role="group" aria-label="Your roots: the people you follow">` +
    lines.join("") +
    `<circle class="root-center" cx="${cx}" cy="${cy}" r="17"></circle><text class="root-center-label" x="${cx}" y="${cy + 4}" text-anchor="middle">You</text>` +
    nodes.join("") +
    `</svg>`
  );
}
