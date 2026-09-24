"use client";

import { useActionState, useState } from "react";
import { deleteOwnAccountAction } from "../lib/auth-actions";
import { ArrowRightIcon } from "../components/icons";

// Delete account: the row opens a panel that says plainly what goes, then
// asks for the password and the word DELETE before anything happens. The
// deletion itself is lib/erase.ts; afterwards the client lands on the login
// page, signed out.
export default function DeleteAccountRow({ coachName }: { coachName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteOwnAccountAction, null);
  return (
    <>
      <button type="button" className="settings-data-row warn st-delete-row" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="home-dark-row-title">Delete account</div>
        <ArrowRightIcon />
      </button>
      {open && (
        <form className="st-delete-panel" action={action} aria-label="Delete account">
          <p className="st-delete-text">
            This deletes your account and everything in it straight away: check-ins, photos, videos, logs, messages and notes. It can’t be undone.
          </p>
          <p className="st-delete-text">
            {coachName} is told you left. Invoices are kept, with only your name on them, because the law requires it.
          </p>
          <label className="st-delete-field">
            <span>Your password</span>
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <label className="st-delete-field">
            <span>Type DELETE to confirm</span>
            <input type="text" name="confirm" autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
          </label>
          {state?.error && (
            <p className="st-delete-error" role="alert">
              {state.error}
            </p>
          )}
          <div className="st-delete-actions">
            <button type="button" className="st-delete-cancel" onClick={() => setOpen(false)} disabled={pending}>
              Keep my account
            </button>
            <button type="submit" className="st-delete-confirm" disabled={pending}>
              {pending ? "Deleting…" : "Delete everything"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
