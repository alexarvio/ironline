"use client";

import { ReactNode, useEffect, useState } from "react";
import { ChevronDownIcon } from "../components/icons";

// One block of the Measurements tab: a strip that says what is inside, and a
// chevron that folds it away. What a coach keeps folded is theirs, so it is
// remembered for them rather than for the client they are looking at.
export default function MeasurementsBlock({ id, title, hint, children }: { id: string; title: string; hint: string; children: ReactNode }) {
  const key = `ironline.measurements.block.${id}`;
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(key) === "0") setOpen(false);
    } catch {}
  }, [key]);
  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem(key, v ? "0" : "1");
      } catch {}
      return !v;
    });

  return (
    <section className="mx-block">
      <button type="button" className="mx-block-head" onClick={toggle} aria-expanded={open}>
        <span className="ad-microlabel">{title}</span>
        <span className="mx-block-hint">{hint}</span>
        <span className={`mx-block-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {open && <div className="mx-block-body">{children}</div>}
    </section>
  );
}
