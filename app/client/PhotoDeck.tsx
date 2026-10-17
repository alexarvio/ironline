"use client";

import { useRef, useState } from "react";

// A sheet's progress pictures as a swipe of big cards (17 Oct, Alex), like the
// phase cards on Home: one card per angle the coach asked for, in order, the
// next peeking in at the edge. A photo fills its card; an angle still empty
// is a card all the same, dashed, saying what goes there, so a swipe passes
// over the gaps too. The angle's number and name sit on the card, its state
// and action at the foot; a tap on the card does what the action says.

export type DeckItem = {
  key: number;
  label: string;
  src: string | null;
  /** "Ready", "Sending…", "Sent", "Not sent": the word at the foot, if any. */
  state?: string | null;
  tone?: "ready" | "sent" | "muted" | null;
  /** Sent to the coach: a lock on the card, the photo kept but no longer changed from here. */
  locked?: boolean;
  /** The action the card's tap does ("Add", "Change", "View"); none, the card does nothing. */
  action?: string | null;
};

export default function PhotoDeck({ items, onTap, disabled = false }: { items: DeckItem[]; onTap?: (index: number) => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const onScroll = () => {
    const el = ref.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    setActive(Math.min(items.length - 1, Math.round(el.scrollLeft / (card.offsetWidth + 12))));
  };
  return (
    <div className="ppd">
      <div ref={ref} className="ppd-scroller" onScroll={onScroll} role="list">
        {items.map((it, i) => {
          const can = !!it.action && !!onTap && !disabled;
          return (
            <div key={it.key} role="listitem" className={`ppd-card${it.src ? " in" : " empty"}${it.locked ? " locked" : ""}`}>
              <button type="button" className="ppd-tap" onClick={() => can && onTap?.(i)} disabled={!can} aria-label={`${i + 1}, ${it.label}${it.state ? `, ${it.state}` : ""}${it.action ? `. ${it.action}` : ""}`}>
                {it.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ppd-img" src={it.src} alt="" draggable={false} loading="lazy" decoding="async" />
                ) : (
                  <span className="ppd-empty" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H8l1.5-2.5h5L16 7h3.5A1.5 1.5 0 0 1 21 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" />
                      <circle cx="12" cy="13" r="3.4" />
                    </svg>
                    <span>No photo yet</span>
                  </span>
                )}
                <span className="ppd-chip" aria-hidden="true">
                  <b>{i + 1}</b>
                  {it.label}
                </span>
                {(it.state || it.action) && (
                  <span className="ppd-foot" aria-hidden="true">
                    {it.locked ? (
                      // Sent (17 Oct, Alex): a green tick alone, low on the right.
                      <svg className="ppd-check" viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    ) : (
                      it.state && <span className={`ppd-state${it.tone ? ` ${it.tone}` : ""}`}>{it.state}</span>
                    )}
                    {it.action && <span className="ppd-action">{it.action}</span>}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      {items.length > 1 && (
        <div className="ppd-dots" aria-hidden="true">
          {items.map((it, i) => (
            <span key={it.key} className={`ppd-dot${i === active ? " on" : ""}${it.src ? " in" : ""}`} />
          ))}
        </div>
      )}
    </div>
  );
}
