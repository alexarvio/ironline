"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "../components/icons";
import { useRouter } from "next/navigation";
import { markSeenAction } from "../lib/actions";
import { pageWindow } from "../lib/pager";
import type { HomeAction, HomeEvent } from "../lib/queries";

const TAB_LABEL: Record<string, string> = {
  plan: "Plan",
  training: "Training",
  nutrition: "Nutrition",
  measurements: "Measurements",
  meetings: "Meetings",
  photos: "Progress pictures",
  messages: "Messages",
};
const TONE_LABEL: Record<HomeAction["tone"], string> = { urgent: "Urgent", due: "Due", note: "To read" };
const CATEGORY_LABEL: Record<string, string> = {
  training: "Training",
  nutrition: "Nutrition",
  measurements: "Measurements",
  notes: "Note",
  billing: "Invoice",
};

// Four kinds of thing happen to a client, and the activity is read one kind
// at a time. There is no "All": everything in one stream was a list nobody
// finished, and it is the list a coach is least likely to reach the bottom
// of — it sits under two other cards.
//
// Every source category has a home here, so nothing is unreachable: a note
// the client wrote on their programme is training, and an invoice is what a
// coach calls billing. Same four, same holdings, as the rail's Feed.
const FILTERS = [
  { id: "training", label: "Training", holds: ["training", "notes"] },
  { id: "nutrition", label: "Nutrition", holds: ["nutrition"] },
  { id: "measurements", label: "Measurements", holds: ["measurements"] },
  { id: "invoices", label: "Invoices", holds: ["billing"] },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

// One screenful, and then the next one.
const PAGE = 15;

// "Needs you" is off for now. Set this back to true to bring it back —
// nothing about how the actions are worked out has changed, and the rail's
// amber dot and the tab counts still read the same list. It was three rows
// of "they have not filled it in yet" sitting between the score that already
// says so and the activity that shows it.
const SHOW_NEEDS_YOU: boolean = false;

// The two cards down the middle of a client's Home: what needs the coach,
// then what the client has been doing. Activity is a history, not a
// notifications list: no "new" dots, counts or Mark all seen — the dots on
// the tabs are what say something new came in. A row opens the tab it is
// about. The filters are client-side, on what is already loaded.
export default function ClientHomeFeed({
  clientId,
  firstName,
  actions,
  events,
  eventTotal,
}: {
  clientId: number;
  firstName: string;
  actions: HomeAction[];
  events: HomeEvent[];
  eventTotal: number;
  /** No longer shown here: Activity is not a notifications list. */
  unseenCount?: number;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [filter, setFilter] = useState<FilterId>(FILTERS[0].id);
  const [page, setPage] = useState(1);
  const holds = FILTERS.find((f) => f.id === filter)!.holds as readonly string[];
  const matching = events.filter((e) => holds.includes(e.category));
  const pages = Math.max(1, Math.ceil(matching.length / PAGE));
  const at = Math.min(page, pages);
  const from = (at - 1) * PAGE;
  const shown = matching.slice(from, from + PAGE);
  // A new kind starts at its own beginning, not on page 3 of the last one.
  const pick = (id: FilterId) => {
    setFilter(id);
    setPage(1);
  };

  const open = (tab: string | null, seenIds: string[]) =>
    start(async () => {
      if (seenIds.length) await markSeenAction(clientId, { ids: seenIds });
      if (tab) router.push(`/admin?client=${clientId}&tab=${tab}`);
    });

  return (
    <>
      {SHOW_NEEDS_YOU && (
      <section className="ch-card">
        <div className={`ch-head${actions.length ? " warm" : ""}`}>
          <div className="ch-head-titles">
            <span className="ch-label">Needs you</span>
            <span className="ch-head-sub">
              {actions.length ? `${actions.length} open item${actions.length === 1 ? "" : "s"}` : `Nothing is waiting on you for ${firstName}`}
            </span>
          </div>
          {actions.length > 0 && (
            <Link href={`/admin?client=${clientId}&tab=messages`} className="ch-btn warm">
              Nudge client
            </Link>
          )}
        </div>
        {actions.length > 0 ? (
          <ul className="ch-list">
            {actions.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="ch-row"
                  disabled={busy || (!a.tab && !a.id.startsWith("read-"))}
                  onClick={() => open(a.tab, a.id.startsWith("read-") ? [a.id.slice(5)] : [])}
                >
                  <span className={`ch-tone ${a.tone}`}>{TONE_LABEL[a.tone]}</span>
                  <span className="ch-main">
                    <span className="ch-title">{a.title}</span>
                    <span className={`ch-detail${a.tone === "note" ? " quote" : ""}`}>{a.detail}</span>
                  </span>
                  {a.tab && <span className="ch-go">{TAB_LABEL[a.tab] ?? a.tab}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ch-empty">All clear.</p>
        )}
      </section>
      )}

      <section className="ch-card">
        <div className="ch-head tint">
          <div className="ch-head-titles">
            <span className="ch-label">Activity</span>
            <span className="ch-head-sub">What {firstName} has been doing</span>
          </div>
          <div className="ch-chips">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={`ch-chip${filter === f.id ? " on" : ""}`} onClick={() => pick(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {shown.length > 0 ? (
          <ul className="ch-list">
            {shown.map((e) => {
              return (
                <li key={e.id}>
                  <button type="button" className="ch-row ch-event" disabled={busy} onClick={() => open(e.tab, [])}>
                    <span className={`ch-cat ${e.category}`}>{CATEGORY_LABEL[e.category] ?? e.category}</span>
                    <span className="ch-main">
                      <span className="ch-title">{e.text.charAt(0).toUpperCase() + e.text.slice(1)}</span>
                      {e.note && <span className="ch-detail quote">{e.note}</span>}
                    </span>
                    <span className="ch-when">{e.when}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ch-empty">{events.length ? "Nothing of that kind yet." : "Nothing logged yet."}</p>
        )}
        <div className="ch-foot">
          <span className="ch-label">
            {matching.length === 0 ? `0 of ${eventTotal} events` : `${from + 1}–${from + shown.length} of ${matching.length}`}
          </span>

          {pages > 1 && (
            <nav className="pg" aria-label="Activity pages">
              <button type="button" className="pg-step chev" onClick={() => setPage(at - 1)} disabled={at === 1} aria-label="Newer">
                <ChevronLeftIcon />
              </button>
              <span className="pg-nums">
                {pageWindow(at, pages).map((n, i) =>
                  n === "gap" ? (
                    <span key={`gap${i}`} className="pg-gap" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      className={`pg-num${n === at ? " on" : ""}`}
                      aria-current={n === at ? "page" : undefined}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  )
                )}
              </span>
              <button type="button" className="pg-step chev next" onClick={() => setPage(at + 1)} disabled={at === pages} aria-label="Older">
                <ChevronLeftIcon />
              </button>
            </nav>
          )}

        </div>
      </section>
    </>
  );
}
