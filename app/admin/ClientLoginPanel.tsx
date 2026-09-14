import {
  createClientLoginAction,
  removeClientLoginAction,
  resetClientPasswordAction,
} from "../lib/auth-actions";
import { getUserForClient } from "../lib/auth";

// Where the coach hands a client their way in, inside the panel's App access
// section. A Client record can exist without a login (the coach may be
// tracking someone who never opens the app), so this is deliberately a
// separate, optional step rather than part of client creation. The section
// starts closed: resetting or removing someone's access should take a
// deliberate click to reach.
export default function ClientLoginPanel({
  clientId,
  name,
  ok,
  error,
}: {
  clientId: number;
  name: string;
  ok?: string;
  error?: string;
}) {
  const user = getUserForClient(clientId);
  const resetFormId = `client-reset-${clientId}`;

  return (
    <div className="ad-access">
      {ok === "1" && <p className="client-login-flash ok">Login created. Give {name} the email and password.</p>}
      {ok === "reset" && <p className="client-login-flash ok">Password reset. They&rsquo;ll be asked to choose a new one.</p>}
      {ok === "removed" && <p className="client-login-flash ok">Login removed.</p>}
      {error === "exists" && <p className="client-login-flash err">This client already has a login.</p>}
      {error === "taken" && <p className="client-login-flash err">That email is already in use.</p>}
      {error === "invalid" && <p className="client-login-flash err">Need an email and a password of at least 8 characters.</p>}

      {user ? (
        <>
          <div className="ad-rows">
            <div className="ad-row">
              <span className="ad-row-label">Signs in as</span>
              <span className="ad-row-value">{user.email}</span>
            </div>
          </div>
          {user.must_change_password && <p className="ad-access-explain">Hasn&rsquo;t set their own password yet.</p>}
          {/* The input belongs to the reset form; its button sits in the row
              below beside Remove access, which is a form of its own. */}
          <form id={resetFormId} action={resetClientPasswordAction} className="ad-access-form">
            <input type="hidden" name="clientId" value={clientId} />
            <input className="ad-access-input" name="password" type="text" placeholder="New temporary password" minLength={8} required />
          </form>
          <div className="ad-access-actions">
            <button type="submit" form={resetFormId} className="ad-access-primary">
              Reset password
            </button>
            <form action={removeClientLoginAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <button type="submit" className="ad-access-secondary">
                Remove access
              </button>
            </form>
          </div>
        </>
      ) : (
        <>
          <div className="ad-rows">
            <div className="ad-row">
              <span className="ad-row-label">Signs in as</span>
              <span className="ad-row-none">No login yet</span>
            </div>
          </div>
          <form action={createClientLoginAction} className="ad-access-form">
            <input type="hidden" name="clientId" value={clientId} />
            <input className="ad-access-input" name="email" type="email" placeholder="Their email" required />
            <input className="ad-access-input" name="password" type="text" placeholder="Temporary password" minLength={8} required />
            <div className="ad-access-actions">
              <button type="submit" className="ad-access-primary">
                Create login
              </button>
            </div>
          </form>
        </>
      )}
      <p className="ad-access-explain">
        They&rsquo;ll be asked to choose their own password the first time they sign in, so the one you type here is
        only ever temporary.
      </p>
    </div>
  );
}
