"use client";

// Kept local (not imported from ../lib/queries) so this client component's
// bundle doesn't pull in queries.ts's server-only fs/path dependencies.
export type PhotoCadence = "weekly" | "biweekly" | "monthly" | "sixweekly";

const OPTIONS: { value: PhotoCadence; label: string }[] = [
  { value: "weekly", label: "Week" },
  { value: "biweekly", label: "Two weeks" },
  { value: "monthly", label: "Month" },
  { value: "sixweekly", label: "Six weeks" },
];

// How often a new sheet opens, as a segmented control. Controlled: the
// schedule form holds the choice until the coach presses Save.
export default function PhotoCadenceSelect({ value, onChange }: { value: PhotoCadence; onChange: (cadence: PhotoCadence) => void }) {
  return (
    <div className="pp-seg" role="radiogroup" aria-label="How often a new sheet opens">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`pp-seg-btn${value === o.value ? " active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
