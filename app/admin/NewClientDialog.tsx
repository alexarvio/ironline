"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { checkLoginEmailAction, createClientWithLoginAction } from "../lib/actions";
import { ageFrom, DEFAULT_DIAL, GenderPills, InfoRow, PhoneInput, Suffixed } from "./InfoRow";

// New client: the Member info card, the same rows (InfoRow) the coach edits
// later. No login yet: the coach builds the client's plan first, then gives
// them access from their Home (App access) when it is ready for them.
// With Clerk sign-in a second step still sends the invite link straight away.
//
// Nothing is written until the last button. Cancel, Escape or the × drop
// the lot. On success the dialog closes onto the new client's Home.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// No O/0 or I/1/l: a password read out on a call has to survive it.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  // 32 letters, so byte % 32 is unbiased.
  return `Iron-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

export type Draft = {
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
function useNewClientForm(start: Partial<Draft> | undefined, requireEmail: boolean) {
  const [draft, setDraft] = useState<Draft>({ ...EMPTY, ...start });
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
    // With Clerk the email is where the invite goes now; otherwise it can wait for App access.
    requireEmail && !email && "email",
  ].filter(Boolean) as string[];
  const emailBad = !!email && !EMAIL_RE.test(email);
  const step1Ok = missing.length === 0 && !emailBad && !emailTaken;
  const name = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim();
  return { draft, set, missing, emailBad, emailTaken, checkEmail, step1Ok, name, age: ageFrom(draft.birthdate) };
}

/** The onboarding board's copy: opens on a step with a draft filled in, and never creates anyone. */
export type NewClientPreview = { step: 1 | 2; draft?: Partial<Draft> };

export default function NewClientDialog({ onClose, preview = null, clerk = false }: { onClose: () => void; inviteReady?: boolean; preview?: NewClientPreview | null; /** Sign-in through Clerk: no password, the invite link goes straight away. */ clerk?: boolean }) {
  const router = useRouter();
  const form = useNewClientForm(preview?.draft, clerk);
  const { draft, set } = form;
  const [step, setStep] = useState<1 | 2>(clerk ? (preview?.step ?? 1) : 1);
  const [error, setError] = useState<string | null>(null);
  // Made, but the invite did not go.
  const [made, setMade] = useState<number | null>(null);
  const [saving, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = (id: number) => {
    onClose();
    router.push(`/admin/redesign/home?client=${id}`);
  };
  const create = () =>
    !preview &&
    start(async () => {
      setError(null);
      const res = await createClientWithLoginAction({ ...draft, password: "", invite: false });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.inviteFailed) setMade(res.clientId);
      else open(res.clientId);
    });

  const status = (() => {
    if (made != null) return { text: "Created, but the invite email didn't go out.", bad: true };
    if (error) return { text: error, bad: true };
    if (step === 1) {
      if (form.missing.length) return { text: `Still needed: ${form.missing.join(", ")}`, bad: true };
      if (form.emailBad) return { text: "That email doesn't look right", bad: true };
      if (form.emailTaken) return { text: "That email already has an account", bad: true };
      if (clerk) return { text: "Ready for step 2", bad: false };
    }
    if (!form.step1Ok) return { text: "Step 1 still needs a name and an email", bad: true };
    if (saving) return { text: "Creating…", bad: false };
    return { text: clerk ? `${form.name} will appear in your client list straight away` : `${form.name} can't sign in yet: give them access from their Home when you're ready`, bad: false };
  })();

  return createPortal(
    <div className="nc-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nc-dialog" role="dialog" aria-modal="true" aria-label="New client">
        <header className="nc-head">
          <div>
            <div className="nc-title">New client</div>
            {clerk && <div className="nc-sub">{step === 1 ? "Step 1 of 2 · who they are" : "Step 2 of 2 · how they get into the app"}</div>}
          </div>
          <button type="button" className="cc-dialog-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {/* Both steps can be clicked, so a coach can go back and correct
            something without losing what is typed. Step 2 once step 1 has
            what it needs. */}
        {clerk && (
          <div className="nc-steps" role="tablist">
            {[
              { n: 1 as const, name: "Member info", hint: "Name, birthdate, contact" },
              { n: 2 as const, name: "App access", hint: "Their invite link" },
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
        )}

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
                <b>{form.name || "They"}</b> get{form.name ? "s" : ""} an email with a link to join. They sign in with Apple, Google or a code sent to their email: no password to hand over.
              </p>
              <div className="nc-card">
                <span className="nc-icon" aria-hidden="true">
                  <MailIcon />
                </span>
                <span className="nc-card-main">
                  <span className="nc-label">Invite goes to</span>
                  {draft.email.trim() ? <b className="nc-card-value">{draft.email.trim().toLowerCase()}</b> : <span className="nc-card-empty">Add an email on step 1</span>}
                </span>
              </div>
            </div>
          )}
        </div>

        <footer className="nc-foot">
          <span className={`nc-status${status.bad ? " bad" : ""}`}>{status.text}</span>
          {made != null ? (
            <button type="button" className="pl-primary nc-btn" onClick={() => open(made)}>
              Open client
            </button>
          ) : step === 1 && clerk ? (
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
              <button type="button" className="pl-text-btn nc-btn nc-secondary" onClick={clerk ? () => setStep(1) : onClose} disabled={saving}>
                {clerk ? "Back" : "Cancel"}
              </button>
              <button type="button" className="pl-primary nc-btn" onClick={create} disabled={!form.step1Ok || saving}>
                {clerk ? "Create and invite" : "Create client"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body
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
