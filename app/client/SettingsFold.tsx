"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ChevronRightIcon } from "../components/icons";
import "./gyms.css";

// One section open at a time (10 Nov, Alex): opening one folds the one before. The sections sit in different components,
// so which is open is kept here.
let openTitle: string | null = null;
const listeners = new Set<() => void>();
const setOpenTitle = (title: string | null) => {
  openTitle = title;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

// A Settings section, one row until pressed (9 Nov, Alex; every section since 10 Nov, the title in the sections' caps): the shared fold, its chevron turning as every row's.
// What is in it can be given as a function, to fold itself shut (Your details' Cancel and Save).
export default function SettingsFold({ title, children }: { title: string; children: ReactNode | ((close: () => void) => ReactNode) }) {
  const open = useSyncExternalStore(subscribe, () => openTitle, () => null) === title;
  // Leaving Settings shuts it, so it opens with every section folded.
  useEffect(
    () => () => {
      if (openTitle === title) setOpenTitle(null);
    },
    [title]
  );
  const close = () => {
    if (openTitle === title) setOpenTitle(null);
  };
  return (
    <section className="home-dark-section st-fold">
      <button type="button" className="st-fold-head" aria-expanded={open} onClick={() => setOpenTitle(open ? null : title)}>
        <span className="home-dark-section-title">{title}</span>
        <span className={`st-fold-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronRightIcon />
        </span>
      </button>
      <div className={`so-fold${open ? " open" : ""}`} aria-hidden={!open} inert={!open}>
        <div className="so-fold-in">
          <div className="st-fold-body">{typeof children === "function" ? children(close) : children}</div>
        </div>
      </div>
    </section>
  );
}
