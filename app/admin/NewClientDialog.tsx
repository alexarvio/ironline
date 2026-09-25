"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkLoginEmailAction, createClientWithLoginAction } from "../lib/actions";
import { ageFrom, DEFAULT_DIAL, GenderPills, InfoRow, PhoneInput, Suffixed } from "./InfoRow";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";

// New client, in two steps: who they are, then how they get into the app.
// The first step is the Member info card, the same rows (InfoRow) the coach
// edits later; the second makes the client's login at the same time, so a
// coach no longer has to come back to create it.
//
// Nothing is written until the last button. Cancel, Escape, a click on the
// scrim or the × drop the lot. On success the dialog closes onto the new
// client's Home.
//
// This is the content of shadcn's Dialog (components/ui); the <Dialog> and
// the button that opens it are in ClientRoster. Radix holds focus inside
// while it is open and hands it back to New client when it closes.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// No O/0 or I/1/l: a password read out on a call has to survive it.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  // 32 letters, so byte % 32 is unbiased.
  return `Iron-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

type Draft = {
  firstName: string;
  lastName: string;
  birthdate: string;
  gender: string;
  heightCm: string;
  startingWeightKg: string;
  email: string;
  phoneCode: string;
  phone: string;
  address: string;
};

const EMPTY: Draft = { firstName: "", lastName: "", birthdate: "", gender: "", heightCm: "", startingWeightKg: "", email: "", phoneCode: DEFAULT_DIAL, phone: "", address: "" };

/** The draft, what is still missing, the age and the email check, in one place. */
function useNewClientForm() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [password, setPassword] = useState(newTempPassword);
  // The address the uniqueness check last answered for, and its answer.
  const [checked, setChecked] = useState<{ email: string; taken: boolean } | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const email = draft.email.trim().toLowerCase();
  const emailTaken = !!checked && checked.email === email && checked.taken;
  const checkEmail = async () => {
    if (!EMAIL_RE.test(email)) return;
    const { taken } = await checkLoginEmailAction(email);
    setChecked({ email, taken });
  };

  const missing = [
    !draft.firstName.trim() && "first name",
    !draft.lastName.trim() && "last name",
    !email && "email",
  ].filter(Boolean) as string[];
  const emailBad = !!email && !EMAIL_RE.test(email);
  const step1Ok = missing.length === 0 && !emailBad && !emailTaken;
  const name = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim();
  return { draft, set, password, setPassword, missing, emailBad, emailTaken, checkEmail, step1Ok, name, age: ageFrom(draft.birthdate) };
}

export default function NewClientDialog({ onClose, inviteReady }: { onClose: () => void; inviteReady: boolean }) {
  const router = useRouter();
  const form = useNewClientForm();
  const { draft, set } = form;
  const [step, setStep] = useState<1 | 2>(1);
  const [invite, setInvite] = useState(inviteReady);
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Made, but the invite did not go: the dialog stays so the coach can copy the login.
  const [made, setMade] = useState<number | null>(null);
  const [saving, start] = useTransition();

  const open = (id: number) => {
    onClose();
    router.push(`/admin?client=${id}&tab=home`);
  };
  const create = () =>
    start(async () => {
      setError(null);
      const res = await createClientWithLoginAction({ ...draft, password: form.password, invite: invite && inviteReady });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.inviteFailed) setMade(res.clientId);
      else open(res.clientId);
    });

  const passwordOk = form.password.trim().length >= 8;
  const ready = form.step1Ok && passwordOk;
  const willInvite = invite && inviteReady;

  const status = (() => {
    if (made != null) return { text: "Created, but the invite email didn't go out. Copy the login and send it yourself.", bad: true };
    if (error) return { text: error, bad: true };
    if (step === 1) {
      if (form.missing.length) return { text: `Still needed: ${form.missing.join(", ")}`, bad: true };
      if (form.emailBad) return { text: "That email doesn't look right", bad: true };
      if (form.emailTaken) return { text: "That email already has an account", bad: true };
      return { text: "Ready for step 2", bad: false };
    }
    if (!form.step1Ok) return { text: "Step 1 still needs a name and an email", bad: true };
    if (!passwordOk) return { text: "The password needs at least 8 characters", bad: true };
    if (saving) return { text: "Creating…", bad: false };
    return { text: `${form.name} will appear in your client list straight away`, bad: false };
  })();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(form.password);
      setCopiedFor(form.password);
    } catch {
      /* the password is on screen to select by hand */
    }
  };

  return (
    <DialogContent className="nc-dialog">
      <header className="nc-head">
        <div>
          <DialogTitle className="nc-title">New client</DialogTitle>
          <DialogDescription className="nc-sub">{step === 1 ? "Step 1 of 2 · who they are" : "Step 2 of 2 · how they get into the app"}</DialogDescription>
        </div>
        <DialogClose className="cc-dialog-x" aria-label="Close">
          ×
        </DialogClose>
      </header>

      {/* Both steps can be clicked, so a coach can go back and correct
          something without losing what is typed. Step 2 once step 1 has
          what it needs. */}
      <div className="nc-steps" role="tablist">
        {[
          { n: 1 as const, name: "Member info", hint: "Name, birthdate, contact" },
          { n: 2 as const, name: "App access", hint: "Email and first password" },
        ].map((t) => (
          <button
            key={t.n}
            type="button"
            role="tab"
            aria-selected={step === t.n}
            className={`nc-step${step === t.n ? " on" : ""}`}
            onClick={() => setStep(t.n)}
            disabled={t.n === 2 && !form.step1Ok}
          >
            <span className={`nc-step-n${step >= t.n ? " reached" : ""}`}>{t.n}</span>
            <span>
              <b>{t.name}</b>
              <small>{t.hint}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="nc-body">
        {step === 1 ? (
          <div className="nc-grid">
            <InfoRow label="First name">
              <input className="nc-input" value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Alex" autoFocus autoComplete="off" maxLength={40} />
            </InfoRow>
            <InfoRow label="Last name">
              <input className="nc-input" value={draft.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Arvio" autoComplete="off" maxLength={40} />
            </InfoRow>
            <InfoRow label="Birthdate" aside={form.age != null ? `${form.age} years old` : null}>
              <input className="nc-input" type="date" value={draft.birthdate} onChange={(e) => set("birthdate", e.target.value)} />
            </InfoRow>
            <InfoRow label="Gender" as="div">
              <GenderPills value={draft.gender} onChange={(v) => set("gender", v)} />
            </InfoRow>
            <InfoRow label="Height">
              <Suffixed unit="cm">
                <input className="nc-input" type="number" inputMode="decimal" min={0} value={draft.heightCm} onChange={(e) => set("heightCm", e.target.value)} placeholder="180" />
              </Suffixed>
            </InfoRow>
            <InfoRow label="Starting weight">
              <Suffixed unit="kg">
                <input className="nc-input" type="number" inputMode="decimal" min={0} step="0.1" value={draft.startingWeightKg} onChange={(e) => set("startingWeightKg", e.target.value)} placeholder="82.5" />
              </Suffixed>
            </InfoRow>
            <InfoRow label="Email" full bad={form.emailTaken || (form.emailBad && !!draft.email)}>
              <input
                className="nc-input"
                type="email"
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
                onBlur={() => void form.checkEmail()}
                placeholder="name@example.com"
                autoComplete="off"
              />
            </InfoRow>
            <InfoRow label="Phone" as="div">
              <PhoneInput code={draft.phoneCode} number={draft.phone} onCode={(v) => set("phoneCode", v)} onNumber={(v) => set("phone", v)} />
            </InfoRow>
            <InfoRow label="Address">
              <input className="nc-input" value={draft.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, city" autoComplete="off" />
            </InfoRow>
          </div>
        ) : (
          <div className="nc-access">
            <p className="nc-explain">
              <b>{form.name || "They"}</b> sign{form.name ? "s" : ""} in with the email above. The password below is temporary — the app asks them to set their own the first time they log in.
            </p>

            <div className="nc-card">
              <span className="nc-icon" aria-hidden="true">
                <MailIcon />
              </span>
              <span className="nc-card-main">
                <span className="nc-label">Login email</span>
                {draft.email.trim() ? <b className="nc-card-value">{draft.email.trim().toLowerCase()}</b> : <span className="nc-card-empty">Add an email on step 1</span>}
              </span>
              {draft.email.trim() && <span className="nc-same">Same as above</span>}
            </div>

            <div className="nc-card">
              <span className="nc-icon" aria-hidden="true">
                <KeyIcon />
              </span>
              <label className="nc-card-main">
                <span className="nc-label">Temporary password</span>
                <input className="nc-input nc-password" value={form.password} onChange={(e) => form.setPassword(e.target.value)} spellCheck={false} autoComplete="off" />
              </label>
              <button type="button" className="nc-mini" onClick={() => form.setPassword(newTempPassword())}>
                New
              </button>
              <button type="button" className={`nc-mini${copiedFor === form.password ? " copied" : ""}`} onClick={copy}>
                {copiedFor === form.password ? "Copied" : "Copy"}
              </button>
            </div>

            <label className={`nc-check${inviteReady ? "" : " off"}`}>
              <input type="checkbox" checked={willInvite} disabled={!inviteReady || made != null} onChange={(e) => setInvite(e.target.checked)} />
              <span>
                <b>Email the invite now</b>
                <small>
                  {inviteReady
                    ? "Sends the login and password to the client. They set their own password first time in."
                    : "Email isn't set up on this app yet, so give them the login yourself."}
                </small>
              </span>
            </label>
          </div>
        )}
      </div>

      <footer className="nc-foot">
        <span className={`nc-status${status.bad ? " bad" : ""}`}>{status.text}</span>
        {made != null ? (
          <button type="button" className="pl-primary nc-btn" onClick={() => open(made)}>
            Open client
          </button>
        ) : step === 1 ? (
          <>
            <button type="button" className="pl-text-btn nc-btn nc-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="pl-primary nc-btn" onClick={() => setStep(2)} disabled={!form.step1Ok}>
              Next
            </button>
          </>
        ) : (
          <>
            <button type="button" className="pl-text-btn nc-btn nc-secondary" onClick={() => setStep(1)} disabled={saving}>
              Back
            </button>
            <button type="button" className="pl-primary nc-btn" onClick={create} disabled={!ready || saving}>
              {willInvite ? "Create and invite" : "Create client"}
            </button>
          </>
        )}
      </footer>
    </DialogContent>
  );
}

function MailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.7-8.7M16 7l2.5 2.5M13.5 9.5 15.5 11.5" />
    </svg>
  );
}
