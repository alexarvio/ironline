"use client";

import { useState, type ReactNode } from "react";
import { ChevronRightIcon } from "../components/icons";
import "./gyms.css";

// A Settings section that is one row until pressed (9 Nov, Alex): the shared fold, its chevron turning as every row's.
export default function SettingsFold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="home-dark-section st-fold">
      <button type="button" className="st-fold-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="home-dark-row-title">{title}</span>
        <span className={`st-fold-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronRightIcon />
        </span>
      </button>
      <div className={`so-fold${open ? " open" : ""}`} aria-hidden={!open} inert={!open}>
        <div className="so-fold-in">{children}</div>
      </div>
    </section>
  );
}
