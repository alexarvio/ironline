"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "../../../components/ui/toast";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { PlusIcon } from "../../../components/icons";
import { SepJoin } from "../Sep";
import { dayMonth } from "../../../lib/dayMonth";
import { ConfirmDialog } from "../training/TrainingDraft";
import { addCoach, approveSignUp, declineSignUp, removeCoach, resetCoachPassword, type CoachOutcome } from "./actions";
import type { SupportInboxRow } from "../../../lib/support";
import SupportInbox from "./SupportInbox";

// The owner's Coaches (22 Oct, Alex: the old /admin?view=coaches in the new style, root "rd trn rls rco"): Training's
// bare header with Add coach as a white pill; the sign-ups waiting to be let in, the coaches' Support threads
// (SupportInbox, 23 Oct), then every coach account, each a row
// in one hairline card: the name semi-bold, the email grey, the clients, when one of them last logged something, the
// password as a state pill, and the owner's actions in words on hover (Remove and Decline ask first). Add coach and
// Reset password are .dlh pop-ups on clean lines. Never any client's name or data. Ink, never navy; 500 and 600.

export type CoachRow = { id: number; email: string; name: string; clients: number; lastActivity: string | null; mustChangePassword: boolean; owner: boolean };
export type SignUpRow = { id: number; email: string; name: string; business: string | null; at: string };

// The server's own check (createCoachAction), so Add waits for what it would accept.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN = 8;
const ERROR: Record<string, string> = {
  invalid: "That didn't go through.",
  taken: "That email already has an account.",
  hasclients: "That coach still has clients.",
  self: "Not your own account.",
  failed: "Not saved. Try again.",
};
const said = (code: string | null) => ERROR[code ?? ""] ?? ERROR.failed;

/** An action's answer, or "failed" when it never came (no connection). */
async function settle(p: Promise<CoachOutcome>): Promise<CoachOutcome> {
  try {
    return (await p) ?? { ok: null, error: "failed" };
  } catch {
    return { ok: null, error: "failed" };
  }
}

const accountGrid = { gridTemplateColumns: "minmax(0, 1fr) 64px 132px 104px 196px", columnGap: 16 } as const;
const waitGrid = { gridTemplateColumns: "minmax(0, 1fr) 196px", columnGap: 16 } as const;

export default function CoachesDraft({ accounts, waiting, support }: { accounts: CoachRow[]; waiting: SignUpRow[]; /** The coaches' Support threads, newest first (SupportInbox). */ support: SupportInboxRow[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [busy, setBusy] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<CoachRow | null>(null);
  const [removing, setRemoving] = useState<CoachRow | null>(null);
  const [declining, setDeclining] = useState<SignUpRow | null>(null);

  // A row's action: faded while it goes, then the page read again and the outcome in a toast.
  const act = (id: number, call: () => Promise<CoachOutcome>, done: string) => {
    setBusy(id);
    start(async () => {
      const r = await settle(call());
      setBusy(null);
      if (r.ok) {
        router.refresh();
        toast.success(done);
      } else toast.error(said(r.error));
    });
  };

  return (
    <div className="rd trn rls rco">
      {/* ---- Header: Training's, bare (no fact line, so no room kept for one). */}
      <header className="trn-head bare">
        <div className="trn-head-main">
          <div className="trn-name-row">
            <h1 className="trn-name">Coaches</h1>
          </div>
        </div>
        <div className="trn-head-actions">
          <button type="button" className="trn-pill" onClick={() => setAdding(true)}>
            <PlusIcon /> Add coach
          </button>
        </div>
      </header>

      {/* ---- Who signed up themselves and waits to be let in. */}
      {waiting.length > 0 && (
        <section className="rls-section">
          <div className="trn-weekhead">
            <div>
              <h2>Waiting for approval</h2>
            </div>
          </div>
          <div className="rls-card rco-card">
            {waiting.map((u) => (
              <div key={u.id} className={`rls-row rco-row${busy === u.id ? " busy" : ""}`}>
                <div className="rls-row-main" style={waitGrid}>
                  <span className="rls-name">
                    <b>{u.name}</b>
                    <small>
                      <SepJoin parts={[u.business, u.email, `signed up ${dayMonth(u.at)}`]} />
                    </small>
                  </span>
                  <span className="rco-acts">
                    <button type="button" className="rco-act danger" disabled={busy === u.id} onClick={() => setDeclining(u)}>
                      Decline
                    </button>
                    <button type="button" className="rco-act ink" disabled={busy === u.id} onClick={() => act(u.id, () => approveSignUp(u.id), `${u.name} approved`)}>
                      Approve
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- What the coaches wrote from Settings' Support: a coach a row, a thread opening under it. */}
      <SupportInbox initial={support} />

      {/* ---- Every coach account, oldest first. */}
      <section className="rls-section">
        <div className="trn-weekhead">
          <div>
            <h2>Accounts</h2>
          </div>
        </div>
        <div className="rls-card rco-card">
          {accounts.length === 0 ? (
            <p className="rls-none">None yet</p>
          ) : (
            <>
              <div className="rls-cols rco-cols" style={accountGrid} aria-hidden="true">
                <span>Coach</span>
                <span>Clients</span>
                <span>Client activity</span>
                <span>Password</span>
                <span />
              </div>
              {accounts.map((c) => {
                // "9/11 · 14:05" from the server: the day, and its time faint after it.
                const [day, time] = (c.lastActivity ?? "").split(" · ");
                return (
                  <div key={c.id} className={`rls-row rco-row${busy === c.id ? " busy" : ""}`}>
                    <div className="rls-row-main" style={accountGrid}>
                      <span className="rls-name">
                        <b>{c.name}</b>
                        <small>
                          <SepJoin parts={[c.email !== c.name && c.email, c.owner && "You"]} />
                        </small>
                      </span>
                      <span className="rco-num">{c.clients}</span>
                      <span className={`rco-when${day ? "" : " none"}`}>
                        {day || "–"}
                        {time && <small>{time}</small>}
                      </span>
                      <span>
                        <span className={`trn-state rco-state${c.mustChangePassword ? "" : " good"}`}>{c.mustChangePassword ? "Temporary" : "Set"}</span>
                      </span>
                      <span className="rco-acts">
                        {/* The owner's own account isn't changed here. */}
                        {!c.owner && (
                          <>
                            <button type="button" className="rco-act" disabled={busy === c.id} onClick={() => setResetting(c)}>
                              Reset password
                            </button>
                            {c.clients === 0 ? (
                              <button type="button" className="rco-act danger" disabled={busy === c.id} onClick={() => setRemoving(c)}>
                                Remove
                              </button>
                            ) : (
                              <span className="rco-act off" title="A coach with clients can't be removed">
                                Remove
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>

      <Dialog open={adding} onOpenChange={setAdding}>
        {adding && (
          <AddCoachDialog
            onDone={(email) => {
              setAdding(false);
              router.refresh();
              toast.success(`${email} added`);
            }}
          />
        )}
      </Dialog>

      <Dialog open={resetting != null} onOpenChange={(o) => !o && setResetting(null)}>
        {resetting && (
          <ResetPasswordDialog
            coach={resetting}
            onDone={() => {
              setResetting(null);
              router.refresh();
              toast.success("Temporary password set");
            }}
          />
        )}
      </Dialog>

      <Dialog open={removing != null} onOpenChange={(o) => !o && setRemoving(null)}>
        {removing && (
          <ConfirmDialog
            title={`Remove ${removing.name}?`}
            description="This permanently deletes the coach's account. It can't be undone."
            confirm="Remove"
            danger
            onConfirm={() => {
              const c = removing;
              setRemoving(null);
              act(c.id, () => removeCoach(c.id), `${c.name} removed`);
            }}
          />
        )}
      </Dialog>

      <Dialog open={declining != null} onOpenChange={(o) => !o && setDeclining(null)}>
        {declining && (
          <ConfirmDialog
            title={`Decline ${declining.name}?`}
            description="This permanently deletes their sign-up. It can't be undone."
            confirm="Decline"
            danger
            onConfirm={() => {
              const u = declining;
              setDeclining(null);
              act(u.id, () => declineSignUp(u.id), `${u.name} declined`);
            }}
          />
        )}
      </Dialog>

      <Toaster />
    </div>
  );
}

// ---- Add coach: the .dlh card (design rules 4), the email and a temporary password on clean lines.
function AddCoachDialog({ onDone }: { onDone: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const clean = email.trim().toLowerCase();
  const ready = EMAIL.test(clean) && password.length >= MIN && !busy;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    start(async () => {
      const r = await settle(addCoach(clean, password));
      if (r.ok) onDone(clean);
      else setError(said(r.error));
    });
  };
  return (
    <DialogContent className="dlh rco-dlg" aria-describedby={undefined}>
      <form className="rco-form" onSubmit={submit}>
        <div className="dlh-head">
          <DialogTitle className="dlh-title">Add a coach</DialogTitle>
          <DialogClose className="dlh-x" aria-label="Close">
            ✕
          </DialogClose>
        </div>
        <label className="rco-field">
          <span className="dlh-label">Email</span>
          <input
            className="dlh-line"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            autoComplete="off"
            autoFocus
            required
          />
        </label>
        <label className="rco-field">
          <span className="dlh-label">Temporary password</span>
          <input className="dlh-line" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={MIN} autoComplete="new-password" required />
        </label>
        {error && (
          <p className="dlh-error" role="alert">
            {error}
          </p>
        )}
        <div className="dlh-foot">
          <DialogClose className="dlh-cancel">Cancel</DialogClose>
          <button type="submit" className="dlh-go" disabled={!ready}>
            Add
          </button>
        </div>
      </form>
    </DialogContent>
  );
}

// ---- Reset password: a new temporary one (they choose their own at their next sign-in).
function ResetPasswordDialog({ coach, onDone }: { coach: CoachRow; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const ready = password.length >= MIN && !busy;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    start(async () => {
      const r = await settle(resetCoachPassword(coach.id, password));
      if (r.ok) onDone();
      else setError(said(r.error));
    });
  };
  return (
    <DialogContent className="dlh rco-dlg">
      <form className="rco-form" onSubmit={submit}>
        <div className="dlh-head">
          <DialogTitle className="dlh-title">Reset password</DialogTitle>
          <DialogClose className="dlh-x" aria-label="Close">
            ✕
          </DialogClose>
        </div>
        <DialogDescription className="dlh-what">{coach.email}</DialogDescription>
        <label className="rco-field">
          <span className="dlh-label">Temporary password</span>
          <input
            className="dlh-line"
            name="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            minLength={MIN}
            autoComplete="new-password"
            autoFocus
            required
            aria-label={`New temporary password for ${coach.email}`}
          />
        </label>
        {error && (
          <p className="dlh-error" role="alert">
            {error}
          </p>
        )}
        <div className="dlh-foot">
          <DialogClose className="dlh-cancel">Cancel</DialogClose>
          <button type="submit" className="dlh-go" disabled={!ready}>
            Set
          </button>
        </div>
      </form>
    </DialogContent>
  );
}
