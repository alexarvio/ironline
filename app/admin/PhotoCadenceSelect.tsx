"use client";

import { setPhotoCadenceAction } from "../lib/actions";

// Kept local (not imported from ../lib/queries) so this client component's
// bundle doesn't pull in queries.ts's server-only fs/path dependencies.
type PhotoCadence = "weekly" | "biweekly" | "monthly";

const PHOTO_CADENCE_LABELS: Record<PhotoCadence, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};

const OPTIONS: PhotoCadence[] = ["weekly", "biweekly", "monthly"];

// Auto-submits on change, same pattern as the invoice status dropdown — no
// separate "Save" button needed for a single setting like this.
export default function PhotoCadenceSelect({
  clientId,
  cadence,
}: {
  clientId: number;
  cadence: PhotoCadence;
}) {
  return (
    <form action={setPhotoCadenceAction} className="add-invoice-form" style={{ paddingTop: 0, borderTop: "none" }}>
      <input type="hidden" name="clientId" value={clientId} />
      <select
        name="cadence"
        defaultValue={cadence}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {OPTIONS.map((c) => (
          <option key={c} value={c}>
            {PHOTO_CADENCE_LABELS[c]}
          </option>
        ))}
      </select>
    </form>
  );
}
