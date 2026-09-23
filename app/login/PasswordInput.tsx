"use client";

import { useState } from "react";
import { EyeIcon } from "../components/icons";

// A password field with an eye at its end: shown as dots until pressed, then
// as typed, so a long password can be checked before it is sent. The eye is
// crossed while the password is hidden and open while it shows.
export default function PasswordInput({ name, autoComplete, required = true, autoFocus = false, minLength }: { name: string; autoComplete: string; required?: boolean; autoFocus?: boolean; minLength?: number }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="auth-pass">
      <input name={name} type={shown ? "text" : "password"} autoComplete={autoComplete} required={required} autoFocus={autoFocus} minLength={minLength} />
      <button type="button" className="auth-pass-eye" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} title={shown ? "Hide password" : "Show password"}>
        <EyeIcon off={!shown} />
      </button>
    </span>
  );
}
