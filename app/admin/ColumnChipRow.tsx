"use client";

import {
  addTrainingColumnAction,
  removeCustomTrainingColumnAction,
  setBuiltinColumnVisibleAction,
  setTrainingColumnVisibleAction,
} from "../lib/actions";

// The coach composes the prescription columns. Eight builtins plus their own
// custom ones, capped at six on at once — past that the grid stops fitting a
// 1440 canvas beside the logged-sets panel, which is the column that matters
// most.
//
// Notes is deliberately absent: it is always rendered on every row, so it is
// neither toggleable nor counted here.
export type ColumnChoice = {
  id: number | null;
  key: string;
  label: string;
  kind: "builtin" | "custom";
  visible: boolean;
};

export default function ColumnChipRow({
  clientId,
  choices,
  max,
}: {
  clientId: number;
  choices: ColumnChoice[];
  max: number;
}) {
  const activeCount = choices.filter((c) => c.visible).length;
  const atCap = activeCount >= max;

  return (
    <div className="pb-cols-row">
      <span className="pb-cols-label">
        Columns ({activeCount} of {max})
      </span>

      {choices.map((c) => {
        // At the cap the remaining chips grey out rather than disappearing,
        // so the coach can see what they'd be choosing between.
        const disabled = !c.visible && atCap;
        return (
          <span key={c.key} className="pb-col-chip-wrap">
            <form
              action={c.kind === "custom" ? setTrainingColumnVisibleAction : setBuiltinColumnVisibleAction}
              className="pb-col-chip-form"
            >
              <input type="hidden" name="clientId" value={clientId} />
              {c.kind === "custom" ? (
                <input type="hidden" name="id" value={c.id ?? ""} />
              ) : (
                <input type="hidden" name="key" value={c.key} />
              )}
              <input type="hidden" name="visible" value={c.visible ? "false" : "true"} />
              <button
                type="submit"
                className={`pb-col-chip${c.visible ? " on" : ""}`}
                disabled={disabled}
                title={
                  disabled
                    ? `Switch one off first. ${max} columns is the maximum`
                    : c.visible
                    ? `Hide the ${c.label} column`
                    : `Show the ${c.label} column`
                }
              >
                {c.label}
              </button>
            </form>

            {c.kind === "custom" && c.id != null && (
              <form action={removeCustomTrainingColumnAction} className="pb-col-chip-x-form">
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="pb-col-chip-x" aria-label={`Remove the ${c.label} column`}>
                  ×
                </button>
              </form>
            )}
          </span>
        );
      })}

      <form action={addTrainingColumnAction} className="pb-col-add">
        <input type="hidden" name="clientId" value={clientId} />
        <input name="label" type="text" placeholder="Custom column" aria-label="New custom column" />
        <button type="submit" aria-label="Add custom column">
          +
        </button>
      </form>
    </div>
  );
}
