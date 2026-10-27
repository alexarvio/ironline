// A circle's outline drawn as a vector (27 Oct, Alex: "fatter on one side"). An inset shadow or a border on a circle
// whose size or spot lands on a half pixel comes out thicker on one side on iOS; a circle in an SVG is drawn evenly.
// The same fix as the workout's set badge (`.lw-badge-ring`) and Home's To focus on rings.
//
// The parent is the circle: position relative (or absolute), its size whole pixels. It says the ring's colour with
// `--ring` (no `--ring`, no ring), so a state rule that changed its inset shadow now changes `--ring`. `size` is the
// parent's size in px and `stroke` the ring's width; `inset` moves the ring in from the edge (a ring inside a ring).
// A parent that grows keeps the stroke's width (`.ring-edge`).
export default function RingEdge({ size, stroke = 1, inset = 0, className }: { size: number; stroke?: number; inset?: number; className?: string }) {
  const c = size / 2;
  return (
    <svg className={className ? `ring-edge ${className}` : "ring-edge"} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <circle cx={c} cy={c} r={c - inset - stroke / 2} strokeWidth={stroke} />
    </svg>
  );
}
