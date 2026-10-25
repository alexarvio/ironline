// The weight line's curve (25 Oct, Alex: option B of docs/boards/weight-line-mockup.html): smooth, through every
// reading, never past one. A monotone cubic (Fritsch–Carlson): each reading keeps its place, a stretch between two
// readings bends only within their two values, a flat stretch stays flat, so the hover ring always sits on the line.
// Home's Weight card and the client's Progress chart draw with it.

type Pt = { x: number; y: number };

/** Each stretch's curve, from reading i to reading i+1, as an SVG "C …" command (the path is at reading i already). */
export function monotoneSegments(pts: Pt[]): string[] {
  const n = pts.length;
  if (n < 2) return [];
  const f = (v: number) => (Math.round(v * 100) / 100).toString();
  if (n === 2) return [`L${f(pts[1].x)} ${f(pts[1].y)}`];
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x || 1e-6;
    slope[i] = (pts[i + 1].y - pts[i].y) / dx[i];
  }
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    // A peak, a dip or a flat: no slope there, so the curve turns on the reading itself.
    if (slope[i - 1] * slope[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  const out: string[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    out.push(`C${f(pts[i].x + h)} ${f(pts[i].y + m[i] * h)} ${f(pts[i + 1].x - h)} ${f(pts[i + 1].y - m[i + 1] * h)} ${f(pts[i + 1].x)} ${f(pts[i + 1].y)}`);
  }
  return out;
}

/** The whole line as one path. */
export function monotonePath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  const start = `M${Math.round(pts[0].x * 100) / 100} ${Math.round(pts[0].y * 100) / 100}`;
  return start + monotoneSegments(pts).join("");
}
