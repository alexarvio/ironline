"use client";

import { useState, useTransition } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { disconnectLoginAction, signOutDeviceAction, signOutOtherDevicesAction } from "../../../lib/accountActions";
import { logoutAction } from "../../../lib/auth-actions";
import type { AccountSecurity, SignedInDevice } from "../../../lib/accountSecurity";
import { dayMonth } from "../../../lib/dayMonth";
import { AccountEmail, Section } from "./SettingsForms";

// Settings, Account & security with the sign-in through Clerk (27 Oct, Alex: mockup B; "only email, and that's it"):
// Sign-in (the email, changed in place, then each login linked to it: Google connected or Connect, Apple Soon while its
// button is off) and Devices (where the account is signed in, this one first with Sign out, the others each with
// Sign out, and Sign out everywhere else in the head). Each acts at once (lib/accountActions.ts), none on the Save bar.
// Two-step sign-in is left out: Clerk asks a paid plan for it.

const APPLE_ON = process.env.NEXT_PUBLIC_APPLE_SIGNIN !== "off";
const RETURN = "/admin/redesign/settings#account";

/** "Active now", "2 h ago", "3 days ago", else 9/10. */
function lastSeen(at: number): string {
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 5) return "Active now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} day${d === 1 ? "" : "s"} ago` : dayMonth(new Date(at));
}

export default function ClerkAccount({ email, security }: { email: string; security: AccountSecurity | null }) {
  const [busy, start] = useTransition();
  const [gone, setGone] = useState<string[]>([]);
  const { user } = useUser();
  const google = security?.logins.find((l) => l.provider === "google") ?? null;
  const apple = security?.logins.find((l) => l.provider === "apple") ?? null;
  const devices = (security?.devices ?? []).filter((d) => !gone.includes(d.id));
  const others = devices.filter((d) => !d.current);

  const act = (run: () => Promise<{ ok: boolean; error?: string }>, done: string, after?: () => void) =>
    start(async () => {
      const r = await run().catch(() => ({ ok: false, error: "Check your connection and try again." }));
      if (!r.ok) return void toast.error(r.error ?? "Didn't work");
      after?.();
      toast.success(done);
    });

  // Google linked from here: Clerk's own page, then back to this section.
  const connect = (strategy: "oauth_google" | "oauth_apple") =>
    start(async () => {
      try {
        const account = await user?.createExternalAccount({ strategy, redirectUrl: `${window.location.origin}${RETURN}` });
        const to = account?.verification?.externalVerificationRedirectURL;
        if (to) window.location.assign(to.toString());
        else toast.error("Couldn't start it. Try again.");
      } catch (e) {
        const said = (e as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
        toast.error(said?.longMessage ?? said?.message ?? "Couldn't start it. Try again.");
      }
    });

  const loginRow = (name: string, linked: { id: string; email: string } | null, can: boolean, strategy: "oauth_google" | "oauth_apple") => (
    <div className="rst-row">
      <span className="rst-row-main">
        <b>{name}</b>
        {linked?.email && <small>{linked.email}</small>}
      </span>
      {linked ? (
        <>
          <span className="trn-state good rst-state">Connected</span>
          <button type="button" className="rst-danger" disabled={busy} onClick={() => act(() => disconnectLoginAction(linked.id), `${name} disconnected`)}>
            Disconnect
          </button>
        </>
      ) : can ? (
        <button type="button" className="rst-act" disabled={busy || !user} onClick={() => connect(strategy)}>
          Connect
        </button>
      ) : (
        <span className="trn-state rst-state">Soon</span>
      )}
    </div>
  );

  const deviceRow = (d: SignedInDevice) => (
    <div className="rst-row" key={d.id}>
      <span className="rst-row-main">
        <b>{d.device}</b>
        <small>{[d.browser, d.place, d.current ? null : lastSeen(d.lastActive)].filter(Boolean).join(" | ")}</small>
      </span>
      {d.current ? (
        <>
          <span className="trn-state good rst-state">This device</span>
          <button type="button" className="rst-act" onClick={() => logoutAction()}>
            Sign out
          </button>
        </>
      ) : (
        <button type="button" className="rst-act" disabled={busy} onClick={() => act(() => signOutDeviceAction(d.id), "Signed out", () => setGone((g) => [...g, d.id]))}>
          Sign out
        </button>
      )}
    </div>
  );

  return (
    <>
      <Section title="Sign-in">
        <div className="rls-card rst-card">
          <AccountEmail email={email} bare />
          {security && (
            <div className="rst-rows rst-rows-after">
              {loginRow("Google", google, true, "oauth_google")}
              {loginRow("Apple", apple, APPLE_ON, "oauth_apple")}
            </div>
          )}
        </div>
      </Section>
      {security ? (
        <Section
          title="Devices"
          fact={String(devices.length)}
          actions={
            others.length > 0 ? (
              <button type="button" className="trn-pill rst-pill" disabled={busy} onClick={() => act(signOutOtherDevicesAction, "Signed out everywhere else", () => setGone((g) => [...g, ...others.map((d) => d.id)]))}>
                Sign out everywhere else
              </button>
            ) : undefined
          }
        >
          <div className="rls-card rst-card">
            <div className="rst-rows">{devices.map(deviceRow)}</div>
          </div>
        </Section>
      ) : (
        <Section
          title="This device"
          actions={
            <button type="button" className="trn-pill rst-pill" onClick={() => logoutAction()}>
              Sign out
            </button>
          }
        />
      )}
    </>
  );
}
