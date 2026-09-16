"use client";

import { useState } from "react";
import { ArrowRightIcon } from "../components/icons";

// Delete account: a confirm step before anything, and the honest version of
// what happens next. There is no self-serve deletion yet — the coach removes
// the account and everything in it — so the row explains that rather than
// pretending to do it.
export default function DeleteAccountRow({ coachName }: { coachName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="settings-data-row warn st-delete-row" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="home-dark-row-title">Delete account</div>
        <ArrowRightIcon />
      </button>
      {open && (
        <div className="st-delete-panel" role="region" aria-label="Delete account">
          <p className="st-delete-text">
            This removes your account and everything in it: check-ins, photos, logs, notes. It can’t be undone.
          </p>
          <p className="st-delete-text">
            Deleting is done by {coachName}: ask on your next call or by email, and it’s gone within a day. Nothing is deleted from here.
          </p>
          <button type="button" className="st-delete-cancel" onClick={() => setOpen(false)}>
            Keep my account
          </button>
        </div>
      )}
    </>
  );
}
