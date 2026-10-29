// Easter egg: roots grow along the edges of the boxes on screen for a few seconds, then wither.

type Box = { x: number; y: number; w: number; h: number };

/** The point `t` px along the box outline (clockwise from the top-left corner) and the outward normal there. */
function along(b: Box, t: number): [number, number, number, number] {
  const per = 2 * (b.w + b.h);
  t = ((t % per) + per) % per;
  if (t < b.w) return [b.x + t, b.y, 0, -1];
  t -= b.w;
  if (t < b.h) return [b.x + b.w, b.y + t, 1, 0];
  t -= b.h;
  if (t < b.w) return [b.x + b.w - t, b.y + b.h, 0, 1];
  t -= b.w;
  return [b.x, b.y + b.h - t, -1, 0];
}

const f = (n: number) => n.toFixed(1);

/** Path data for the roots of one box: two wavy roots hugging its outline, each braided with a thinner one and
 *  sprouting short rootlets. */
export function rootPaths(b: Box, rnd: () => number = Math.random): { d: string; width: number; delay: number }[] {
  const per = 2 * (b.w + b.h);
  const out: { d: string; width: number; delay: number }[] = [];
  const a = rnd() * per;
  for (const [start, width, lenK] of [[a, 2.5, 1], [a + 8, 1.2, 0.8], [a + per / 2, 2.5, 1], [a + per / 2 + 8, 1.2, 0.8]]) {
    const len = per * (0.3 + rnd() * 0.25) * lenK;
    const phase = rnd() * 6;
    const pts: string[] = [];
    let nextBranch = 20 + rnd() * 40;
    for (let s = 0; s <= len; s += 6) {
      const [x, y, nx, ny] = along(b, start + s);
      const off = 3 * Math.sin(s / 23 + phase) + 1.2 * Math.sin(s / 7 + phase * 2) + (rnd() - 0.5); // wanders, never straight
      pts.push(`${f(x + nx * off)} ${f(y + ny * off)}`);
      if (s >= nextBranch && s < len - 20) {
        nextBranch = s + 25 + rnd() * 45;
        const side = rnd() < 0.7 ? 1 : -1; // mostly outward, sometimes over the box
        const l = 10 + rnd() * 22;
        const [tx, ty] = [-ny, nx]; // along the edge
        const bend = (rnd() - 0.5) * l;
        out.push({
          d: `M${f(x)} ${f(y)} Q${f(x + nx * side * l * 0.6 + tx * bend)} ${f(y + ny * side * l * 0.6 + ty * bend)} ${f(x + nx * side * l + tx * bend * 0.4)} ${f(y + ny * side * l + ty * bend * 0.4)}`,
          width: 1,
          delay: (s / len) * 2.2,
        });
      }
    }
    out.push({ d: `M${pts.join(" L")}`, width, delay: width < 2 ? 0.4 : 0 });
  }
  return out;
}

const BOXES = ".gram-card, .sidebar-card, .composer-card, .rail, .modal-overlay[style*='flex'] .modal-card";
let current: SVGSVGElement | null = null;

/** Grow roots over the visible boxes; they fade after a few seconds, or as soon as the page scrolls. */
export function growRoots(ms = 7000): void {
  current?.remove();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "roots-fx");
  svg.setAttribute("aria-hidden", "true");
  let html = "";
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(BOXES))) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.bottom < 0 || r.top > innerHeight) continue;
    for (const p of rootPaths({ x: r.left, y: r.top, w: r.width, h: r.height }))
      html += `<path d="${p.d}" pathLength="1" stroke-width="${p.width}" style="animation-delay:${f(p.delay)}s"/>`;
  }
  svg.innerHTML = html;
  document.body.appendChild(svg);
  current = svg;
  const wither = () => {
    removeEventListener("scroll", wither, true);
    svg.classList.add("withering");
    setTimeout(() => svg.remove(), 1500);
    if (current === svg) current = null;
  };
  addEventListener("scroll", wither, { capture: true, passive: true });
  setTimeout(wither, ms);
}
