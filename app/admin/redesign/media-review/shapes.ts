// The drawing on a coach's form review (12 Oct): pen, arrow, line and circle,
// kept in the media's own coordinates so a drawing stays pinned to the
// picture whatever size the modal is. One path string per shape serves both
// the SVG layer on screen and the canvas the recording is composed on
// (Path2D takes the same string), so what is recorded is what was drawn.

export type Tool = "pen" | "arrow" | "line" | "circle";
export type Pt = [number, number];
/** size: how big it is drawn, 1 the default; thickness and arrowhead scale with it (12 Oct). */
export type Shape = { tool: Tool; color: string; pts: Pt[]; size?: number };
/** Small, medium, large. */
export const SIZES = [
  { id: 0.6, name: "Small", dot: 5 },
  { id: 1, name: "Medium", dot: 8 },
  { id: 1.5, name: "Large", dot: 12 },
] as const;

/** Sizes scale with the media's long edge (12 Oct): a wide screen recording and a tall phone clip get the same weight of line. The width alone made a landscape video's lines three times too thick. */
export const unitFor = (w: number, h: number) => Math.max(0.5, Math.max(w, h) / 700);
export const STROKE = 4;
export const UNDERLAY = 7;
export const UNDERLAY_COLOR = "rgba(0,0,0,.35)";
const HEAD = 15;
const HEAD_ANGLE = 0.5;

/** Ramer–Douglas–Peucker: fewer points, the same line. */
export function simplify(pts: Pt[], tolerance: number): Pt[] {
  if (pts.length < 3) return pts;
  const dist = (p: Pt, a: Pt, b: Pt) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
  };
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let far = -1;
    let at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = dist(pts[k], pts[i], pts[j]);
      if (d > far) {
        far = d;
        at = k;
      }
    }
    if (far > tolerance && at > 0) {
      keep[at] = true;
      stack.push([i, at], [at, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

const f = (n: number) => Math.round(n * 10) / 10;

/** The SVG path data for a shape, which Path2D reads too. */
export function pathOf(s: Shape, unit: number): string {
  const p = s.pts;
  if (p.length === 0) return "";
  const [x0, y0] = p[0];
  const [x1, y1] = p[p.length - 1];
  if (s.tool === "pen") {
    if (p.length === 1) return `M${f(x0)} ${f(y0)}l0.01 0`;
    // A smooth line through the points: each corner rounded by a quadratic to the next midpoint.
    let d = `M${f(x0)} ${f(y0)}`;
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2;
      const my = (p[i][1] + p[i + 1][1]) / 2;
      d += `Q${f(p[i][0])} ${f(p[i][1])} ${f(mx)} ${f(my)}`;
    }
    return d + `L${f(x1)} ${f(y1)}`;
  }
  if (s.tool === "line") return `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`;
  if (s.tool === "arrow") {
    const a = Math.atan2(y1 - y0, x1 - x0);
    const h = HEAD * unit * Math.max(0.8, s.size ?? 1);
    const l = [x1 - h * Math.cos(a - HEAD_ANGLE), y1 - h * Math.sin(a - HEAD_ANGLE)];
    const r = [x1 - h * Math.cos(a + HEAD_ANGLE), y1 - h * Math.sin(a + HEAD_ANGLE)];
    return `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}M${f(l[0])} ${f(l[1])}L${f(x1)} ${f(y1)}L${f(r[0])} ${f(r[1])}`;
  }
  // Circle: the ellipse that fills the drag's box.
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.max(0.5, Math.abs(x1 - x0) / 2);
  const ry = Math.max(0.5, Math.abs(y1 - y0) / 2);
  return `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}`;
}

/** Big enough to keep: a pen of more than three points, anything else dragged six units. Else a stray tap. */
export function worthKeeping(s: Shape, unit: number): boolean {
  if (s.tool === "pen") return s.pts.length > 3;
  const [a, b] = [s.pts[0], s.pts[s.pts.length - 1]];
  return Math.hypot(b[0] - a[0], b[1] - a[1]) > 6 * unit;
}

/** Draws shapes on a canvas whose pixels are `scale` times the media's units: the underlay, then the colour. */
export function paintShapes(ctx: CanvasRenderingContext2D, shapes: Shape[], unit: number, scale: number) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of shapes) {
    const path = new Path2D(pathOf(s, unit));
    ctx.strokeStyle = UNDERLAY_COLOR;
    ctx.lineWidth = UNDERLAY * unit * (s.size ?? 1);
    ctx.stroke(path);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = STROKE * unit * (s.size ?? 1);
    ctx.stroke(path);
  }
  ctx.restore();
}
