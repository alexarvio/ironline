import { Fragment, type ReactNode } from "react";

// Two facts on one line are parted by a drawn upright bar, never a dot (21 Oct, Alex). Styles: `.rd-sep` in training/draft.css.
export function Sep() {
  // Drawn, not typed; a screen reader hears a comma so the facts on either side don't run together.
  return (
    <span className="rd-sep">
      <span className="sr-only">, </span>
    </span>
  );
}

/** The parts that are there, a bar between each: `[a, b && c, d]` reads a | c | d. Empty parts (null, false, "") drop out, so no bar is left over. */
export function SepJoin({ parts }: { parts: ReactNode[] }) {
  const shown = parts.filter((p) => p != null && p !== false && p !== true && p !== "");
  return (
    <>
      {shown.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <Sep />}
          {p}
        </Fragment>
      ))}
    </>
  );
}
