import { Fragment, type ReactNode } from "react";

// Facts in a row parted by a short drawn upright bar, never a middle dot (docs/DESIGN-RULES.md §6; 23 Oct, Alex:
// "Set 3 | Extra"). Empty parts drop out, so no bar is left over; a screen reader hears a comma.
export function Bars({ parts }: { parts: (ReactNode | null | false | undefined)[] }) {
  const shown = parts.filter((p) => p != null && p !== false && p !== "");
  return (
    <>
      {shown.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              <i className="cl-sep" aria-hidden="true" />
              <span className="sr-only">, </span>
            </>
          )}
          {p}
        </Fragment>
      ))}
    </>
  );
}
