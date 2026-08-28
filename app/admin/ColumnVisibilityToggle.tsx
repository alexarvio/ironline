"use client";

import { setTrainingColumnVisibleAction } from "../lib/actions";

export default function ColumnVisibilityToggle({ id, visible }: { id: number; visible: boolean }) {
  return (
    <form
      action={setTrainingColumnVisibleAction}
      onChange={(e) => e.currentTarget.requestSubmit()}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="visible" value={(!visible).toString()} />
      <label className="column-visible-toggle">
        <input type="checkbox" defaultChecked={visible} readOnly />
        {visible ? "Shown" : "Hidden"}
      </label>
    </form>
  );
}
