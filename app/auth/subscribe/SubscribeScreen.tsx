"use client";

import { useState, useTransition } from "react";
import { AuthShell } from "../../login/SignInScreens";
import { startSubscriptionAction } from "../../lib/billingActions";

// The subscribe screen (28 Oct, Alex), in the sign-in screens' voice (docs/DESIGN-RULES.md §9, `.au-card`): the
// title, Monthly | Yearly as the capsule (its pill slides, SlidePills), the price big with what it is per, the trial in
// a grey line, the ink pill to Stripe, Sign out in words.

type Price = { amount: number; currency: string; interval: string } | null;

const money = (p: NonNullable<Price>) => new Intl.NumberFormat("en-GB", { style: "currency", currency: p.currency, maximumFractionDigits: p.amount % 1 ? 2 : 0 }).format(p.amount);

export default function SubscribeScreen({ month, year, trialDays }: { month: Price; year: Price; trialDays: number }) {
  const [interval, setPicked] = useState<"month" | "year">("month");
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const price = interval === "year" ? year : month;
  // Yearly against twelve months, when both are known.
  const saves = month && year && year.currency === month.currency && month.amount * 12 > year.amount ? Math.round((1 - year.amount / (month.amount * 12)) * 100) : 0;
  const go = () =>
    start(async () => {
      const r = await startSubscriptionAction(interval);
      if (r.url) window.location.href = r.url;
      else setError(r.error ?? "Stripe did not answer. Try again.");
    });
  return (
    <AuthShell>
      <h1 className="auth-title">{trialDays ? `Start your ${trialDays}-day trial` : "Choose your plan"}</h1>
      <div className="au-plan">
        <div className="au-plan-cap" role="radiogroup" aria-label="Billed">
          {(["month", "year"] as const).map((i) => (
            <button key={i} type="button" role="radio" aria-checked={interval === i} className={interval === i ? "on" : undefined} onClick={() => setPicked(i)}>
              {i === "month" ? "Monthly" : "Yearly"}
              {i === "year" && saves > 0 && <small>−{saves}%</small>}
            </button>
          ))}
        </div>
        <div className="au-plan-price">
          {price ? (
            <>
              <b>{money(price)}</b>
              <span>a {interval === "year" ? "year" : "month"}</span>
            </>
          ) : (
            <span>Price on the next page</span>
          )}
        </div>
        {trialDays > 0 && <p className="au-plan-trial">Free for {trialDays} days, then billed {interval === "year" ? "yearly" : "monthly"}. Cancel any time.</p>}
      </div>
      {error && <p className="auth-error au-error">{error}</p>}
      <button type="button" className="btn auth-submit" onClick={go} disabled={busy}>
        {busy ? "Opening Stripe…" : "Continue"}
      </button>
      <p className="auth-note">
        <a href="/auth/signout">Sign out</a>
      </p>
    </AuthShell>
  );
}
