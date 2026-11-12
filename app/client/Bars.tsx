import { Fragment, type ReactNode } from "react";

// The one drawn bar, and a screen reader hears a comma. Bars draws it between facts; a line that has to keep a fact and
// its bar together (the workout's eyebrow, so the bar goes when the session's name does) draws it with `Bar`.
export function Bar() {
  return (
    <>
      <i className="cl-sep" aria-hidden="true" />
      <span className="sr-only">, </span>
    </>
  );
}

// Facts in a row parted by a short drawn upright bar, never a middle dot (docs/DESIGN-RULES.md §6; 23 Oct, Alex:
// "Set 3 | Extra"). Empty parts drop out, so no bar is left over; a screen reader hears a comma.
export function Bars({ parts }: { parts: (ReactNode | null | false | undefined)[] }) {
  const shown = parts.filter((p) => p != null && p !== false && p !== "");
  return (
    <>
      {shown.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <Bar />}
          {p}
        </Fragment>
      ))}
    </>
  );
}
