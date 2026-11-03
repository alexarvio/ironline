import RingEdge from "./RingEdge";

// The one done check (3 Nov, Alex: 2 of docs/boards/drawn-several-ways-mockup.html), drawn as the Supplements one: the
// check in a thin ring, both vectors, green #2f7a3f at full strength, a 1.5px ring and a 1.6px line, no fill. Sized to
// its place, the ring and the check both even so the check sits on whole pixels (22 → 12, 32 → 14, 36 → 16). Training's
// done session, the session overview's done exercise and cardio, the workout's done set, the food diary's day logged.
// The colour is `color` (a warm-up's amber says it on `.done-check`); `--ring: none` on it leaves the check alone (an
// extra set's dashed edge). A new done check takes this one.
const ICON: Record<number, number> = { 22: 12, 24: 12, 28: 14, 32: 14, 36: 16 };

export default function DoneCheck({ size = 22, className, label }: { size?: number; className?: string; /** Read out; without it the check is hidden from screen readers. */ label?: string }) {
  const icon = ICON[size] ?? Math.max(10, Math.round((size * 0.42) / 2) * 2 - (size % 2));
  return (
    <span className={className ? `done-check ${className}` : "done-check"} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg className="done-check-tick" viewBox="0 0 24 24" fill="none" style={{ width: icon, height: icon }} aria-hidden="true" focusable="false">
        <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <RingEdge size={size} stroke={1.5} />
    </span>
  );
}
