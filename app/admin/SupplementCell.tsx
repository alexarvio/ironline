"use client";

import { updateSupplementRowAction } from "../lib/actions";

// One cell of the supplements sheet. Saves on blur, like every other field in
// the workstation — there is no sheet-wide save button to forget.
export default function SupplementCell({
  clientId,
  rowId,
  field,
  value,
  placeholder,
}: {
  clientId: number;
  rowId: number;
  field: "name" | "quantity" | "timing" | "notes";
  value: string;
  placeholder?: string;
}) {
  return (
    <form action={updateSupplementRowAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="rowId" value={rowId} />
      <input type="hidden" name="field" value={field} />
      <input
        name="value"
        type="text"
        defaultValue={value}
        placeholder={placeholder}
        aria-label={field}
        onBlur={(e) => {
          // Only post when it actually changed; otherwise tabbing across a
          // row fires four pointless writes to the store.
          if (e.currentTarget.value !== value) e.currentTarget.form?.requestSubmit();
        }}
      />
    </form>
  );
}
