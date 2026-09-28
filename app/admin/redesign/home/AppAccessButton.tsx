"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { LockIcon } from "../../../components/icons";
import { newTempPassword } from "../../NewClientDialog";
import { clientAccessAction, setClientTempPasswordAction, type ClientAccess } from "../../../lib/access-actions";

// App access, a button on the client's Home. A new client has no login: the
// coach builds their plan first, then gives them access here when it is
// ready. Later the same place shows the email they sign in with, whether
// they chose their own password, and sets a new temporary one when they
// can't get in. Passwords are stored scrambled, so the one given can't be
// read back; a new one is shown here once, to copy or email.
export default function AppAccessButton({ clientId, firstName, initial }: { clientId: number; firstName: string; /** Read with the page, so the button shows at once with no round trip. */ initial: ClientAccess | null }) {
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
    setEmail(access.cardEmail ?? "");
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
      () => toast.error("Couldn't copy")
    );

  return (
    <>
      <button type="button" className="rd-btn" onClick={open}>
        <LockIcon /> {hasLogin ? "App access" : "Give app access"}
      </button>
      <Dialog open={shown} onOpenChange={(o) => !o && setShown(false)}>
        {shown && (
          <DialogContent className="rd-dlg rh-dlg">
            <DialogHeader>
              <DialogTitle>App access</DialogTitle>
              <DialogDescription hidden>How {firstName} signs in to the app.</DialogDescription>
            </DialogHeader>
            <div className="rh-dlg-body">
              <section className="rd-session open rn-card rh-info">
                <div className="rn-card-head">
                  <h2>{firstName}</h2>
                  {hasLogin && !editing && !access.codes && (
                    <button type="button" className="rd-ex-btn rh-edit" onClick={edit}>
                      New password
                    </button>
                  )}
                </div>
                <dl className="rh-info-rows">
                  <div className="rh-info-row">
                    <dt>Signs in as</dt>
                    <dd className={hasLogin ? "" : "empty"}>{access.email ?? "No login yet"}</dd>
                  </div>
                  {hasLogin && (
                    <div className="rh-info-row">
                      <dt>{access.codes ? "Signs in with" : "Password"}</dt>
                      <dd className={access.signedUp ? "good" : ""}>{access.codes ? "An email code" : access.signedUp ? "Their own" : "Temporary, not changed yet"}</dd>
                    </div>
                  )}
                  {given && (
                    <div className="rh-info-row">
                      <dt>Temporary password</dt>
                      <dd className="rh-access-given">
                        <code>{given}</code>
                        <button type="button" className="rd-ex-btn rh-edit" onClick={() => copy(`Email: ${access.email}\nPassword: ${given}`)}>
                          Copy
                        </button>
                      </dd>
                    </div>
                  )}
                </dl>

                {editing && (
                  <div className="rh-note-edit rh-access-edit">
                    {/* The redesign's fields (rd-field). No Cancel: a click
                        outside the dialog closes it. The dice inside the
                        password box rolls another; the button sits on its row. */}
                    {!hasLogin && (
                      <label className="rd-field">
                        Email
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email" autoFocus={!email} />
                      </label>
                    )}
                    <div className="rh-access-row">
                      <label className="rd-field rh-access-pw">
                        Temporary password
                        <span className="rh-access-pw-box">
                          <input value={password} onChange={(e) => setPasswordText(e.target.value)} minLength={8} spellCheck={false} autoComplete="off" />
                          <button type="button" className="rh-access-roll" onClick={() => setPasswordText(newTempPassword())} aria-label="Another password" title="Another">
                            <DiceIcon />
                          </button>
                        </span>
                      </label>
                      <button type="button" className="rd-btn primary rh-access-go" onClick={save} disabled={busy || password.length < 8 || (!hasLogin && !email.trim())}>
                        {busy ? "Saving…" : hasLogin ? "Set password" : "Give access"}
                      </button>
                    </div>
                    {access.mailReady && (
                      <label className="rh-access-check">
                        <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} /> Email it to {firstName}
                      </label>
                    )}
                    {error && <p className="rh-access-error">{error}</p>}
                  </div>
                )}
              </section>
            </div>
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
