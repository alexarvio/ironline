import {
  createClientLoginAction,
  removeClientLoginAction,
  resetClientPasswordAction,
} from "../lib/auth-actions";
import { getUserForClient } from "../lib/auth";

// Where the coach hands a client their way in. A Client record can exist
// without a login (the coach may be tracking someone who never opens the
// app), so this is deliberately a separate, optional step rather than part
// of client creation.
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

  return (
    <div className="client-login-box">
      <h4>App access</h4>

      {ok === "1" && <p className="client-login-flash ok">Login created. Give {name} the email and password.</p>}
      {ok === "reset" && (
        <p className="client-login-flash ok">Password reset. They&rsquo;ll be asked to choose a new one.</p>
      )}
      {ok === "removed" && <p className="client-login-flash ok">Login removed.</p>}
      {error === "exists" && <p className="client-login-flash err">This client already has a login.</p>}
      {error === "taken" && <p className="client-login-flash err">That email is already in use.</p>}
      {error === "invalid" && (
        <p className="client-login-flash err">Need an email and a password of at least 8 characters.</p>
      )}

      {user ? (
        <>
          <div className="client-login-status">
            Signs in as <span className="client-login-email">{user.email}</span>
            {user.must_change_password && " (hasn't set their own password yet)"}
          </div>
          <form action={resetClientPasswordAction} className="client-login-form">
            <input type="hidden" name="clientId" value={clientId} />
            <input
              name="password"
              type="text"
              placeholder="New temporary password"
              minLength={8}
              required
            />
            <button className="btn secondary btn-sm" type="submit">
              Reset password
            </button>
          </form>
          <form action={removeClientLoginAction} style={{ marginTop: 8 }}>
            <input type="hidden" name="clientId" value={clientId} />
            <button className="btn secondary btn-sm" type="submit">
              Remove access
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="client-login-status">
            No login yet. {name} can&rsquo;t open the app. Set one up and pass it on however you like.
          </div>
          <form action={createClientLoginAction} className="client-login-form">
            <input type="hidden" name="clientId" value={clientId} />
            <input name="email" type="email" placeholder="Their email" required />
            <input name="password" type="text" placeholder="Temporary password" minLength={8} required />
            <button className="btn btn-sm" type="submit">
              Create login
            </button>
          </form>
        </>
      )}
      <p className="client-login-status" style={{ marginTop: 10, marginBottom: 0 }}>
        They&rsquo;ll be asked to choose their own password the first time they sign in, so the one
        you type here is only ever temporary.
      </p>
    </div>
  );
}
