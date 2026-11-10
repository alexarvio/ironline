"use client";

import { useState, type ReactNode } from "react";
import { ChevronRightIcon } from "../components/icons";
import "./gyms.css";

// A Settings section, one row until pressed (9 Nov, Alex; every section since 10 Nov, the title in the sections' caps): the shared fold, its chevron turning as every row's.
// What is in it can be given as a function, to fold itself shut (Your details' Cancel and Save).
export default function SettingsFold({ title, children }: { title: string; children: ReactNode | ((close: () => void) => ReactNode) }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="home-dark-section st-fold">
      <button type="button" className="st-fold-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="home-dark-section-title">{title}</span>
        <span className={`st-fold-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronRightIcon />
        </span>
      </button>
      <div className={`so-fold${open ? " open" : ""}`} aria-hidden={!open} inert={!open}>
        <div className="so-fold-in">
          <div className="st-fold-body">{typeof children === "function" ? children(() => setOpen(false)) : children}</div>
        </div>
      </div>
    </section>
  );
}
