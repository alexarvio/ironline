"use client";

import { forwardRef, useRef } from "react";
import type { CheckInMetric } from "./CheckInScreen";

// One line of the check-in "ledger": no box, just the metric on the page.
// The coach's name for it in small capitals (green once filled), the last
// reading under it ("Yesterday 2.5 L · tap to copy", which copies it in), a
// big number on the right with its unit, and a hairline under the lot. A
// 1–N scale has round buttons under the line instead of a number; tapping
// the chosen one again clears it.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayNum = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86400000;

/** Steps and the like are whole numbers; their hint gets a thousands separator. */
export const isWholeMetric = (m: CheckInMetric) => !!m.scaleMax || /step/i.test(`${m.name} ${m.unit}`);

// "Yesterday", "Tue", or "14 Sep": how long ago the last reading was.
function whenLabel(period: string, today: string, weekly: boolean) {
  const d = dayNum(today) - dayNum(period);
  const dm = `${Number(period.slice(8, 10))} ${MONTHS[Number(period.slice(5, 7)) - 1]}`;
  if (weekly) return dm;
  if (d === 1) return "Yesterday";
  if (d > 1 && d < 7) return DAYS[new Date(`${period}T12:00:00Z`).getUTCDay()];
  return dm;
}

export function lastText(m: CheckInMetric) {
  if (!m.last) return "";
  const v = m.last.value;
  if (m.scaleMax) return `${v} of ${m.scaleMax}`;
  const n = isWholeMetric(m) ? Math.round(v).toLocaleString("en-US") : String(v);
  return `${n}${m.unit ? ` ${m.unit}` : ""}`;
}

type Props = {
  metric: CheckInMetric;
  value: string;
  today: string;
  weekly: boolean;
  /** The last typed line: Enter closes the keyboard rather than moving on. */
  lastTyped: boolean;
  onChange: (v: string) => void;
  onNext: () => void;
};

const CheckInLine = forwardRef<HTMLInputElement, Props>(function CheckInLine({ metric: m, value, today, weekly, lastTyped, onChange, onNext }, ref) {
  const own = useRef<HTMLInputElement | null>(null);
  const setRef = (el: HTMLInputElement | null) => {
    own.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  const filled = value.length > 0;
  const whole = isWholeMetric(m);
  const hintId = `ci-hint-${m.id}-${weekly ? "w" : "d"}`;
  const copy = () => onChange(whole ? String(Math.round(m.last!.value)) : String(m.last!.value));
  const when = m.last ? whenLabel(m.last.period, today, weekly) : "";

  return (
    <div
      className={`ci-line${filled ? " filled" : ""}${m.scaleMax ? " scale" : ""}`}
      onClick={(e) => {
        // Anywhere on a typed line (but its hint) puts the cursor in it.
        if (m.scaleMax || (e.target as HTMLElement).closest(".ci-hint, input")) return;
        own.current?.focus();
      }}
    >
      <div className="ci-line-head">
        <div className="ci-line-meta">
          <span className="ci-label">{m.name}</span>
          {m.last &&
            (filled ? (
              <span id={hintId} className="ci-hint">
                {when} {lastText(m)}
              </span>
            ) : (
              <button type="button" id={hintId} className="ci-hint" onClick={copy} aria-label={`Copy ${when.toLowerCase() === "yesterday" ? "yesterday's" : "the last"} value, ${lastText(m)}`}>
                {when} {lastText(m)} · tap to copy
              </button>
            ))}
        </div>
        {!m.scaleMax && (
          <div className="ci-value">
            <input
              ref={setRef}
              className="ci-num"
              type="text"
              inputMode={whole ? "numeric" : "decimal"}
              enterKeyHint={lastTyped ? "done" : "next"}
              autoComplete="off"
              placeholder="—"
              value={value}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => onChange(cleanNumeric(e.target.value, whole))}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (lastTyped) e.currentTarget.blur();
                else onNext();
              }}
              aria-label={`${m.name}${m.unit ? ` in ${m.unit}` : ""}`}
              aria-describedby={m.last ? hintId : undefined}
            />
            <span className="ci-unit">{m.unit}</span>
          </div>
        )}
      </div>
      {m.scaleMax && (
        <div
          className="ci-scale-row"
          role="radiogroup"
          aria-label={m.name}
          onKeyDown={(e) => {
            // Arrow keys move the choice along the scale.
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const cur = Number(value) || 0;
            const next = Math.min(m.scaleMax!, Math.max(1, cur + (e.key === "ArrowRight" ? 1 : -1)));
            onChange(String(next));
            (e.currentTarget.children[next - 1] as HTMLElement | undefined)?.focus();
          }}
        >
          {Array.from({ length: m.scaleMax }, (_, i) => {
            const n = String(i + 1);
            const on = value === n;
            return (
              <button key={n} type="button" role="radio" aria-checked={on} tabIndex={on || (!value && i === 0) ? 0 : -1} className={`ci-scale-btn${on ? " on" : ""}`} onClick={() => onChange(on ? "" : n)}>
                {n}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default CheckInLine;

// Plain text with a decimal keypad rather than type="number": a Finnish (or
// most European) keypad offers a comma, which a number input rejects. The
// comma becomes a dot; anything else non-numeric is dropped as it's typed,
// and two decimals is the most any reading takes (2.25 L, 84.4 kg).
export function cleanNumeric(raw: string, wholeOnly: boolean) {
  let out = "";
  let seenDot = false;
  let decimals = 0;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      if (seenDot && decimals >= 2) continue;
      if (seenDot) decimals += 1;
      out += ch;
    } else if ((ch === "." || ch === ",") && !wholeOnly && !seenDot) {
      out += ".";
      seenDot = true;
    }
  }
  return out;
}
