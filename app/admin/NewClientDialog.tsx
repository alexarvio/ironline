"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { checkLoginEmailAction, createClientWithLoginAction } from "../lib/actions";
import { ageFrom, DEFAULT_DIAL, GenderPills, InfoRow, PhoneInput, Suffixed } from "./InfoRow";

// New client: the Member info card, the same rows (InfoRow) the coach edits
// later. No login yet: the coach builds the client's plan first, then gives
// them access from their Home (App access) when it is ready for them.
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

export default function NewClientDialog({ onClose }: { onClose: () => void; inviteReady?: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  // The address the uniqueness check last answered for, and its answer.
  const [checked, setChecked] = useState<{ email: string; taken: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const email = draft.email.trim().toLowerCase();
  const emailTaken = !!checked && checked.email === email && checked.taken;
  const checkEmail = async () => {
    if (!EMAIL_RE.test(email)) return;
    const { taken } = await checkLoginEmailAction(email);
    setChecked({ email, taken });
  };
  // The email can wait: it is asked for again when access is given.
  const missing = [!draft.firstName.trim() && "first name", !draft.lastName.trim() && "last name"].filter(Boolean) as string[];
  const emailBad = !!email && !EMAIL_RE.test(email);
  const ready = missing.length === 0 && !emailBad && !emailTaken;
  const name = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim();
  const age = ageFrom(draft.birthdate);

  const create = () =>
    start(async () => {
      setError(null);
      const res = await createClientWithLoginAction({ ...draft, password: "", invite: false });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.push(`/admin/redesign/home?client=${res.clientId}`);
    });

  const status = (() => {
    if (error) return { text: error, bad: true };
    if (missing.length) return { text: `Still needed: ${missing.join(", ")}`, bad: true };
    if (emailBad) return { text: "That email doesn't look right", bad: true };
    if (emailTaken) return { text: "That email already has an account", bad: true };
    if (saving) return { text: "Creating…", bad: false };
    return { text: `${name} can't sign in yet: give them access from their Home when you're ready`, bad: false };
  })();

  return createPortal(
    <div className="nc-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nc-dialog" role="dialog" aria-modal="true" aria-label="New client">
        <header className="nc-head">
          <div>
            <div className="nc-title">New client</div>
          </div>
          <button type="button" className="cc-dialog-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="nc-body">
          <div className="nc-grid">
            <InfoRow label="First name">
              <input className="nc-input" value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Alex" autoFocus autoComplete="off" maxLength={40} />
            </InfoRow>
            <InfoRow label="Last name">
              <input className="nc-input" value={draft.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Arvio" autoComplete="off" maxLength={40} />
            </InfoRow>
            <InfoRow label="Birthdate" aside={age != null ? `${age} years old` : null}>
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
            <InfoRow label="Email" full bad={emailTaken || (emailBad && !!draft.email)}>
              <input
                className="nc-input"
                type="email"
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
                onBlur={() => void checkEmail()}
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
        </div>

        <footer className="nc-foot">
          <span className={`nc-status${status.bad ? " bad" : ""}`}>{status.text}</span>
          <button type="button" className="pl-text-btn nc-btn nc-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="pl-primary nc-btn" onClick={create} disabled={!ready || saving}>
            Create client
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
