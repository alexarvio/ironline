"use client";

import type { ReactNode } from "react";
import { DialogDescription } from "../../components/ui/dialog";

// A confirm pop-up's parts (11 Nov, Alex: A of docs/boards/popup-anatomy-mockup.html). Four parts, top to bottom: the
// title (the action and the thing, as a question), one or two plain sentences saying only what isn't obvious (what goes
// with it, what stays), an optional choice in its own soft grey well, and the action: Cancel in words and the verb alone
// as a pill (Delete or Remove a red pill, `dlh-danger`; anything else the ink one, `dlh-go`). Styles in training/trn.css.

/** The explanation: one or two plain sentences, who does what. */
export function ConfirmText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <DialogDescription {...(id ? { id } : {})} className="dlh-text">
      {children}
    </DialogDescription>
  );
}

/** The optional choice, in its grey well: what ticking it adds, with its facts grey under it. */
export function ConfirmChoice({ checked, onChange, title, sub, id }: { checked: boolean; onChange: (v: boolean) => void; title: ReactNode; sub?: ReactNode; id?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} id={id} className="dlh-choice" onClick={() => onChange(!checked)}>
      <span className={`dlh-box ink${checked ? " on" : ""}`} aria-hidden="true">
        {checked ? "✓" : ""}
      </span>
      <span className="dlh-choice-words">
        <span className="dlh-choice-t">{title}</span>
        {sub && <span className="dlh-choice-s">{sub}</span>}
      </span>
    </button>
  );
}
