import { approveCoachAction, createCoachAction, declineCoachAction, removeCoachAction, resetCoachPasswordAction } from "../lib/auth-actions";
import { getData } from "../lib/db";
import { listCoachAccounts } from "../lib/queries";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";

// The owner's Coaches page: every coach account, how many clients each has
// and when one last logged something, and the three things the owner does
// with accounts. Never any client's name or data.

const OK: Record<string, string> = {
  added: "Coach added. Send them their email and the temporary password; they choose their own at first sign-in.",
  reset: "Temporary password set. They choose a new one at their next sign-in.",
  removed: "Coach removed.",
  approved: "Coach approved. They can sign in and start now.",
  declined: "Sign-up declined and removed.",
};
const ERROR: Record<string, string> = {
  invalid: "Enter a valid email and a password of at least 8 characters.",
  taken: "That email already has an account.",
  hasclients: "That coach still has clients, so the account can't be removed.",
  self: "Your own owner account can't be changed here.",
};

export default function CoachesPanel({ ownerId, ok, error }: { ownerId: number; ok?: string; error?: string }) {
  const coaches = listCoachAccounts();
  // Coaches who signed up themselves and wait for the owner (sign-in through Clerk).
  const waiting = getData().users.filter((u) => u.role === "coach" && u.pending);

  return (
    <div className="pl cp">
      <h1 className="fd-title">Coaches</h1>
      {ok && OK[ok] && (
        <p className="cp-note ok" role="status">
          {OK[ok]}
        </p>
      )}
      {error && ERROR[error] && (
        <p className="cp-note error" role="alert">
          {ERROR[error]}
        </p>
      )}

      {waiting.length > 0 && (
        <section className="pl-card au-waiting">
          <div className="pl-band">
            <div className="pl-band-left">
              <div className="pl-eyebrow">Waiting for approval</div>
            </div>
          </div>
          {waiting.map((u) => (
            <div key={u.id} className="au-approval">
              <span className="au-approval-main">
                <b>{u.pending!.name}</b>
                <small>
                  {[u.pending!.business, u.email, `signed up ${new Date(u.pending!.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`].filter(Boolean).join(" · ")}
                </small>
              </span>
              <form action={declineCoachAction}>
                <input type="hidden" name="coachId" value={u.id} />
                <button type="submit" className="au-btn">
                  Decline
                </button>
              </form>
              <form action={approveCoachAction}>
                <input type="hidden" name="coachId" value={u.id} />
                <button type="submit" className="au-btn primary">
                  Approve
                </button>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className="pl-card">
        <div className="pl-band">
          <div className="pl-band-left">
            <div className="pl-eyebrow">Coach accounts</div>
          </div>
          <div className="pl-band-right">
            <span className="pl-band-note">{coaches.length}</span>
          </div>
        </div>
        <div className="cp-table">
          <div className="cp-row cp-head">
            <span>Email</span>
            <span>Clients</span>
            <span>Last client activity</span>
            <span>Password</span>
            <span />
          </div>
          {coaches.map((c) => (
            <div key={c.id} className="cp-row">
              <span className="cp-email">
                {c.email}
                {c.id === ownerId && <span className="cp-tag">You · owner</span>}
              </span>
              <span className="cp-clients">{c.clients}</span>
              <span className="cp-when">{c.lastActivity ?? "—"}</span>
              <span className="cp-when">{c.mustChangePassword ? "Temporary" : "Set"}</span>
              <span className="cp-actions">
                {c.id !== ownerId && (
                  <>
                    <details className="cp-reset">
                      <summary>Reset password</summary>
                      <form action={resetCoachPasswordAction}>
                        <input type="hidden" name="coachId" value={c.id} />
                        <input name="password" type="password" minLength={8} required placeholder="New temporary password" autoComplete="new-password" aria-label={`New temporary password for ${c.email}`} />
                        <button type="submit" className="pl-primary">
                          Set
                        </button>
                      </form>
                    </details>
                    {c.clients === 0 ? (
                      <ConfirmDeleteButton action={removeCoachAction} hiddenFields={{ coachId: c.id }} label={`Remove coach ${c.email}`} text="Remove" textClassName="pl-text-btn danger" />
                    ) : (
                      <span className="cp-muted" title="A coach with clients can't be removed">
                        Remove
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="pl-card">
        <div className="pl-band">
          <div className="pl-band-left">
            <div className="pl-eyebrow">Add a coach</div>
          </div>
        </div>
        <form action={createCoachAction} className="cp-add">
          <label className="cp-field">
            <span>Email</span>
            <input name="email" type="email" required autoComplete="off" />
          </label>
          <label className="cp-field">
            <span>Temporary password</span>
            <input name="password" type="password" minLength={8} required autoComplete="new-password" />
          </label>
          <button type="submit" className="pl-primary">
            Add coach
          </button>
        </form>
        <p className="cp-hint">
          They sign in with this email and password and choose their own password straight away. They start with no
          clients and their own copy of the exercise library and check-in templates. You only ever see how many clients
          they have.
        </p>
      </section>
    </div>
  );
}
