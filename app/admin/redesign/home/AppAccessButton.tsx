"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { LockIcon } from "../../../components/icons";
import { newTempPassword } from "../../NewClientDialog";
import { clientAccessAction, setClientTempPasswordAction, type ClientAccess } from "../../../lib/access-actions";

// App access, a button on the client's Home. A new client has no login: the
// coach builds their plan first, then gives them access here when it is
// ready. Later the same place shows the email they sign in with, whether
// they chose their own password, and sets a new temporary one when they
// can't get in. Passwords are stored scrambled, so the one given can't be
// read back; a new one is shown here once, to copy or email.
export default function AppAccessButton({
  clientId,
  firstName,
  initial,
}: {
  clientId: number;
  firstName: string;
  /** Read with the page, so the button shows at once with no round trip. */ initial: ClientAccess | null;
}) {
  const [access, setAccess] = useState<ClientAccess | null>(initial);
  const [shown, setShown] = useState(false);
  const [editing, setEditing] = useState(false);
  const [password, setPasswordText] = useState("");
  const [email, setEmail] = useState("");
  const [send, setSend] = useState(false);
  const [given, setGiven] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  // Keyed on the client by its parent, so a new client is a fresh mount with its own initial.

  if (!access) return null;
  const hasLogin = !!access.email;

  const edit = () => {
    setPasswordText(newTempPassword());
    // The card's address: the one email a client has (a login follows it).
    setEmail(access.cardEmail ?? access.email ?? "");
    setSend(access.mailReady);
    setError("");
    setEditing(true);
  };
  const open = () => {
    setGiven(null);
    setShown(true);
    // No login yet: the dialog is only for making one.
    if (!hasLogin && !access.codes) edit();
    else setEditing(false);
  };
  const save = () =>
    start(async () => {
      const r = await setClientTempPasswordAction(clientId, password, { email, send });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEditing(false);
      setGiven(password);
      setAccess(await clientAccessAction(clientId));
      if (send && !r.emailed) toast.error("Couldn't send the email", { description: `Give ${firstName} the password yourself.` });
      else toast.success(hasLogin ? "New password set" : `${firstName} can sign in`, { description: r.emailed ? `Emailed to ${firstName}.` : undefined });
    });
  const copy = (text: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied"),
      () => toast.error("Couldn't copy"),
    );

  return (
    <>
      {/* A white pill with an icon, as the header's others (design rules 9b). */}
      <button type="button" className="trn-pill" onClick={open}>
        <LockIcon /> {hasLogin ? "App access" : "Give app access"}
      </button>
      <Dialog open={shown} onOpenChange={(o) => !o && setShown(false)}>
        {shown && (
          <DialogContent
            className="dlh rh-access"
            // Nothing to type yet: focus on the card itself, so no ring on ✕ and Tab goes on inside (a field that is there takes it through autoFocus).
            onOpenAutoFocus={(e) => {
              if (editing) return;
              e.preventDefault();
              (e.currentTarget as HTMLElement).focus({ preventScroll: true });
            }}
          >
            <div className="dlh-head">
              <DialogTitle className="dlh-title">App access</DialogTitle>
              <DialogClose className="dlh-x" aria-label="Close">
                ✕
              </DialogClose>
            </div>
            <DialogDescription className="sr-only">How {firstName} signs in to the app</DialogDescription>
            {/* The facts, label and value, a row each. */}
            {(hasLogin || !editing) && (
              <dl className="rh-facts">
                <div>
                  <dt>Signs in as</dt>
                  <dd className={hasLogin ? "" : "none"}>{access.email ?? "No login yet"}</dd>
                </div>
                {hasLogin && (
                  <div>
                    <dt>{access.codes ? "Signs in with" : "Password"}</dt>
                    <dd className={access.signedUp && !access.codes ? "good" : ""}>{access.codes ? "An email code" : access.signedUp ? "Their own" : "Temporary, not changed yet"}</dd>
                  </div>
                )}
                {given && (
                  <div>
                    <dt>Temporary password</dt>
                    <dd className="rh-access-given">
                      <code>{given}</code>
                      <button
                        type="button"
                        className="rh-textact"
                        onClick={() =>
                          copy(`Email: ${access.email}
Password: ${given}`)
                        }
                      >
                        Copy
                      </button>
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {editing && (
              <>
                {/* No login yet: the email it is made for (it goes on the card too, as the login's address). */}
                {!hasLogin && (
                  <label className="rh-field">
                    <span className="dlh-label">Email</span>
                    <input className="dlh-line" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email" autoFocus={!email} />
                  </label>
                )}
                {/* The password on a clean line, the dice at its end to roll another. */}
                <label className="rh-field">
                  <span className="dlh-label">Temporary password</span>
                  <span className="rh-access-pw">
                    <input className="dlh-line" value={password} onChange={(e) => setPasswordText(e.target.value)} minLength={8} spellCheck={false} autoComplete="off" />
                    <button type="button" className="rh-access-roll" onClick={() => setPasswordText(newTempPassword())} aria-label="Another password" title="Another">
                      <DiceIcon />
                    </button>
                  </span>
                </label>
                {access.mailReady && (
                  <button type="button" className="dlh-ack" role="checkbox" aria-checked={send} onClick={() => setSend((x) => !x)}>
                    <span className={`dlh-box ink${send ? " on" : ""}`} aria-hidden="true">
                      {send ? "✓" : ""}
                    </span>
                    Email it to {firstName}
                  </button>
                )}
                {error && <p className="dlh-error">{error}</p>}
              </>
            )}

            {editing ? (
              <div className="dlh-foot">
                {hasLogin ? (
                  <button type="button" className="dlh-cancel" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                ) : (
                  <DialogClose className="dlh-cancel">Cancel</DialogClose>
                )}
                <button type="button" className="dlh-go" onClick={save} disabled={busy || password.length < 8 || (!hasLogin && !email.trim())}>
                  {busy ? "Saving…" : hasLogin ? "Set password" : "Give access"}
                </button>
              </div>
            ) : (
              hasLogin &&
              !access.codes && (
                <div className="dlh-foot">
                  <button type="button" className="dlh-go" onClick={edit}>
                    New password
                  </button>
                </div>
              )
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function DiceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
