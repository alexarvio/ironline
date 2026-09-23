import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "../../lib/auth-actions";
import { getSessionUser } from "../../lib/auth";
import { getClient } from "../../lib/queries";

// Signed in as one kind of account, asked for the other side's door. A coach
// who has been testing as a client lands here when they open /admin, rather
// than being bounced to the client app with no way back: they see who the
// browser is signed in as, and can sign out to sign in as themselves.
export default async function SwitchAccountPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.must_change_password) redirect("/login/change-password");
  const { to } = await searchParams;
  const want = to === "client" ? "client" : "coach";
  // Already the right kind: nothing to switch.
  if (user.role === want) redirect(want === "coach" ? "/admin" : "/client");

  const who = user.role === "client" && user.client_id != null ? getClient(user.client_id)?.name ?? user.email : user.email;
  const here = user.role === "coach" ? "/admin" : "/client";

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Image src="/brand/logo.png" alt="" width={19} height={32} priority />
          Ironline
        </div>
        <h1 className="auth-title">{want === "coach" ? "The coach side" : "The client app"}</h1>
        <p className="auth-note auth-note-top">
          This browser is signed in as <b>{who}</b>, {user.role === "client" ? "a client" : "a coach"}. The {want === "coach" ? "coach side" : "client app"} needs a {want} account.
        </p>
        <form action={logoutAction} className="auth-form">
          <button className="btn auth-submit" type="submit">
            Sign out, then sign in as a {want}
          </button>
        </form>
        <p className="auth-note">
          Or <Link href={here}>stay signed in as {who}</Link>.
        </p>
      </div>
    </div>
  );
}
