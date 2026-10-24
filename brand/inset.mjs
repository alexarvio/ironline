// The part of a polygon further than r from its outline: what is left of a
// shape once a round-joined stroke of width 2r in the background colour is
// painted over it. Convex corners stay sharp; a corner turning inward gets a
// round notch of radius r. Returns { d, pts } (an SVG path and its corner
// points), or null when the stroke covers the whole shape.
export function inset(poly, r) {
  const n = poly.length;
  const area = poly.reduce((s, [x, y], i) => { const [u, v] = poly[(i + 1) % n]; return s + x * v - u * y; }, 0);
  const sgn = Math.sign(area);
  const lines = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
    const nx = (-dy / len) * sgn, ny = (dx / len) * sgn; // inward normal
    return { p: [p[0] + nx * r, p[1] + ny * r], d: [dx, dy], n: [nx, ny] };
  });
  const meet = (a, b) => {
    const den = a.d[0] * b.d[1] - a.d[1] * b.d[0];
    const t = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / den;
    return [a.p[0] + a.d[0] * t, a.p[1] + a.d[1] * t];
  };
  const f = (v) => +v.toFixed(2);
  const pts = [];
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n], next = lines[i], v = poly[i];
    const turn = prev.d[0] * next.d[1] - prev.d[1] * next.d[0];
    if (Math.sign(turn) === sgn) {
      const m = meet(prev, next);
      pts.push(m);
      d += `${d ? "L" : "M"}${f(m[0])},${f(m[1])}`;
    } else {
      // Inward corner: an arc of radius r round the corner point.
      const a = [v[0] + prev.n[0] * r, v[1] + prev.n[1] * r];
      const b = [v[0] + next.n[0] * r, v[1] + next.n[1] * r];
      pts.push(a, b);
      const sweep = sgn > 0 ? 0 : 1;
      d += `${d ? "L" : "M"}${f(a[0])},${f(a[1])}A${f(r)},${f(r)} 0 0 ${sweep} ${f(b[0])},${f(b[1])}`;
    }
  }
  // A shape thinner than the stroke turns inside out: its sides run backwards.
  if (n === 3) {
    for (let i = 0; i < 3; i++) {
      const a = pts[i], b = pts[(i + 1) % 3], e = lines[i].d;
      if ((b[0] - a[0]) * e[0] + (b[1] - a[1]) * e[1] <= 0) return null;
    }
  }
  return { d: d + "Z", pts };
}
