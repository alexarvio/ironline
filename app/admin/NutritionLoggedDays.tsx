"use client";

import { useState, useTransition } from "react";
import type { LoggedDay, LoggedDaysView, LoggedMeal } from "../lib/queries";
import { CameraIcon, ChevronDownIcon, ChevronLeftIcon } from "../components/icons";
import { pageWindow } from "../lib/pager";
import MessageAboutButton, { useMessageWho } from "./MessageAbout";
import { editMealCommentAction, removeMealCommentAction, sendChatMessageAction } from "../lib/actions";

// What the client actually ate, day by day, inside the phase on screen.
// Read-only: the log is the client's, and a coach quietly editing it would
// leave them looking at figures they never typed.
//
// Every total here is reduced from the day's own foods, so opening a day can
// never disprove the line that was closed.

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const ON_TARGET = 200;
// Days to a page: the newest twenty, then the next twenty.
const PAGE = 20;
// As the client's message link reads it ("Thu 17 Sep").
const diaryDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export default function NutritionLoggedDays({ view }: { view: LoggedDaysView }) {
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // The client's picture of one meal, opened from the camera on its row.
  // Held by day and meal, not by value, so a comment just sent shows under it.
  const [shotAt, setShot] = useState<{ date: string; meal: string } | null>(null);
  const shotMeal = shotAt ? (view.days.find((d) => d.date === shotAt.date)?.meals.find((m) => m.id === shotAt.meal) ?? null) : null;
  const shot =
    shotAt && shotMeal?.photo
      ? {
          src: shotMeal.photo,
          label: shotMeal.label,
          date: shotAt.date,
          meal: shotMeal,
        }
      : null;
  const pages = Math.max(1, Math.ceil(view.days.length / PAGE));
  const at = Math.min(page, pages);
  const from = (at - 1) * PAGE;
  const days = view.days.slice(from, from + PAGE);
  const go = (n: number) => {
    setPage(n);
    setOpen(null);
  };
  const proteinTarget = view.days.find((d) => d.proteinTarget != null)?.proteinTarget ?? null;
  const proteinShort = proteinTarget != null && view.avgProtein != null && view.avgProtein < proteinTarget - 20;

  const stats: {
    label: string;
    value: string;
    unit: string;
    warn?: boolean;
  }[] = [
    {
      label: "Days logged",
      value: String(view.days.length),
      unit: `of ${view.windowDays} in this phase`,
      warn: view.days.length < view.windowDays * 0.6,
    },
    {
      label: "Average intake",
      value: view.avgKcal != null ? n(view.avgKcal) : "–",
      unit: "kcal a day",
    },
    {
      label: "On target",
      value: view.judged ? `${view.onTarget} of ${view.judged}` : "–",
      unit: `within ±${ON_TARGET} kcal`,
      warn: view.judged > 0 && view.onTarget < view.judged / 2,
    },
    {
      label: "Average protein",
      value: view.avgProtein != null ? String(view.avgProtein) : "–",
      unit: proteinTarget ? `g a day · target ${proteinTarget}` : "g a day",
      warn: proteinShort,
    },
  ];

  return (
    <>
      <div className="nl-stats">
        {stats.map((s) => (
          <div key={s.label} className="nl-stat">
            <span className="nl-stat-label">{s.label}</span>
            <span className={`nl-stat-value${s.warn ? " warn" : ""}`}>{s.value}</span>
            <span className="nl-stat-unit">{s.unit}</span>
          </div>
        ))}
      </div>

      {view.days.length === 0 ? (
        <p className="nl-empty">Nothing logged in this phase yet.</p>
      ) : (
        <>
          <div className="nl-head nl-cols">
            <span aria-hidden="true" />
            <span>Date</span>
            <span>Logged</span>
            <span>Day</span>
            <span>Vs target</span>
            <span>Protein · carbs · fat</span>
          </div>
          {days.map((d) => (
            <DayRow key={d.date} day={d} open={open === d.date} onToggle={() => setOpen((x) => (x === d.date ? null : d.date))} onShot={setShot} />
          ))}
          {shot && (
            <div className="nl-shot-scrim" role="presentation" onClick={() => setShot(null)}>
              <div className="nl-shot" role="dialog" aria-modal="true" aria-label={`${shot.label}, ${fmtDay(shot.date)}`} onClick={(e) => e.stopPropagation()}>
                <div className="nl-shot-head">
                  <span>
                    {shot.label} · {fmtDay(shot.date)}
                  </span>
                  <button type="button" className="nl-shot-x" onClick={() => setShot(null)} aria-label="Close">
                    ×
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
                <img src={shot.src} alt={`${shot.label} on ${fmtDay(shot.date)}`} />
                <MealCommentBox date={shot.date} meal={shot.meal} />
              </div>
            </div>
          )}
          <div className="nl-foot">
            <span className="pg-count">
              {pages > 1 ? `${from + 1}–${from + days.length} of ${view.days.length}` : view.days.length} logged {view.days.length === 1 ? "day" : "days"} in this phase
            </span>
            {pages > 1 && (
              <nav className="pg" aria-label="Logged day pages">
                <button type="button" className="pg-step chev" onClick={() => go(at - 1)} disabled={at === 1} aria-label="Newer">
                  <ChevronLeftIcon />
                </button>
                <span className="pg-nums">
                  {pageWindow(at, pages).map((n, i) =>
                    n === "gap" ? (
                      <span key={`gap${i}`} className="pg-gap" aria-hidden="true">
                        …
                      </span>
                    ) : (
                      <button key={n} type="button" className={`pg-num${n === at ? " on" : ""}`} aria-current={n === at ? "page" : undefined} onClick={() => go(n)}>
                        {n}
                      </button>
                    ),
                  )}
                </span>
                <button type="button" className="pg-step chev next" onClick={() => go(at + 1)} disabled={at === pages} aria-label="Older">
                  <ChevronLeftIcon />
                </button>
              </nav>
            )}
          </div>
        </>
      )}
    </>
  );
}

function DayRow({ day, open, onToggle, onShot }: { day: LoggedDay; open: boolean; onToggle: () => void; onShot: (s: { date: string; meal: string }) => void }) {
  const diff = day.target != null ? day.kcal - day.target : null;
  const onTarget = diff != null && Math.abs(diff) <= ON_TARGET;
  const total = day.protein * 4 + day.carbs * 4 + day.fat * 9 || 1;
  const share = (g: number, per: number) => `${(((g * per) / total) * 100).toFixed(1)}%`;

  return (
    <div className={`nl-day${open ? " open" : ""}`}>
      <button type="button" className="nl-row nl-cols" onClick={onToggle} aria-expanded={open}>
        <span className={`nl-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
        <span className="nl-date">{fmtDay(day.date)}</span>
        <span className="nl-kcal">{n(day.kcal)}</span>
        <span>
          <span className={`nl-daytag ${day.isTraining ? "training" : "rest"}`}>{day.isTraining ? "Training" : "Rest"}</span>
        </span>
        <span className={`nl-vs${diff == null ? "" : onTarget ? " good" : " warn"}`}>{diff == null ? "No target" : onTarget ? "On target" : `${n(Math.abs(diff))} kcal ${diff > 0 ? "over" : "under"}`}</span>
        <span className="nl-macros">
          <span className="nl-split" aria-hidden="true">
            <i className="p" style={{ width: share(day.protein, 4) }} />
            <i className="c" style={{ width: share(day.carbs, 4) }} />
            <i className="f" style={{ width: share(day.fat, 9) }} />
          </span>
          <span className="nl-gram">
            {day.protein} · {day.carbs} · {day.fat} g
          </span>
        </span>
      </button>

      {open && (
        <div className="nl-meals">
          {day.meals.map((m) => (
            <div key={m.id} className="nl-meal">
              <div className="nl-meal-head nl-meal-cols">
                <span className="nl-meal-name">{m.label}</span>
                <span className="nl-meal-kcal">{n(m.kcal)} kcal</span>
                <span className="nl-p">{m.protein} g</span>
                <span className="nl-c">{m.carbs} g</span>
                <span className="nl-f">{m.fat} g</span>
                {/* The camera only where there is a picture: an empty cell
                    otherwise, so every row's macros stay in one column. */}
                {m.photo ? (
                  <button type="button" className="nl-shot-btn" onClick={() => onShot({ date: day.date, meal: m.id })} title={`${m.label}, photographed`} aria-label={`See the picture of ${m.label}`}>
                    <CameraIcon />
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
              </div>
              {m.foods.map((food, i) => (
                <div key={i} className="nl-food nl-meal-cols">
                  <span className="nl-food-name">
                    {food.name}
                    <small>{food.quantity}</small>
                  </span>
                  <span className="nl-food-kcal">{n(food.kcal)}</span>
                  <span>{food.protein}</span>
                  <span>{food.carbs}</span>
                  <span>{food.fat}</span>
                  <span aria-hidden="true" />
                </div>
              ))}
              {m.comments.map((c) => (
                <p key={c.id} className="nl-said">
                  <b>You · {c.when}</b>
                  {c.text}
                </p>
              ))}
            </div>
          ))}
          {day.note && (
            <div className="nl-note">
              <span className="nw-label">Client note</span>
              <p>{day.note}</p>
            </div>
          )}
          <div className="ma-row">
            <MessageAboutButton
              target={{
                link: { kind: "food", date: day.date },
                area: "Nutrition",
                label: `Food diary · ${diaryDay(day.date)}`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// The coach's word on one meal, under its picture. It goes out as a message
// linked to the meal: the client is notified, taps through to the meal, and
// finds the comment under it in their diary.
function MealCommentBox({ date, meal }: { date: string; meal: LoggedMeal }) {
  const who = useMessageWho();
  const [text, setText] = useState("");
  const [busy, run] = useTransition();
  const [asking, setAsking] = useState(false);
  // The sent comment, open for rewording; null while it is just shown.
  const [draft, setDraft] = useState<string | null>(null);
  if (!who) return null;
  const ready = text.trim().length > 0 && !busy;
  const send = () => {
    if (!ready) return;
    const fd = new FormData();
    fd.set("clientId", String(who.clientId));
    fd.set("text", text.trim());
    fd.set("link", JSON.stringify({ kind: "food", date, meal: meal.id }));
    run(async () => {
      await sendChatMessageAction(fd);
      setText("");
    });
  };
  // One comment a meal: once it is sent it is the comment, and the box goes.
  const said = meal.comments[0];
  if (said && draft != null) {
    const changed = draft.trim().length > 0 && draft.trim() !== said.text;
    const save = () => {
      if (!changed || busy) return;
      run(async () => {
        await editMealCommentAction(who.clientId, said.id, draft.trim());
        setDraft(null);
      });
    };
    return (
      <div className="nl-say">
        <textarea
          rows={4}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            if (e.key === "Escape") setDraft(null);
          }}
          maxLength={1000}
          aria-label={`Edit your comment on ${meal.label}`}
          disabled={busy}
        />
        <div className="nl-say-foot">
          <span className="nl-say-hint">Changes it in {who.firstName}&rsquo;s app. No new notification.</span>
          <span className="nl-say-ask">
            <button type="button" className="quiet" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={!changed || busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </span>
        </div>
      </div>
    );
  }
  if (said) {
    return (
      <div className="nl-say">
        <p className="nl-said">
          <b>You · {said.when}</b>
          {said.text}
        </p>
        <div className="nl-say-foot">
          <span className="nl-say-hint">{asking ? `Remove it? It goes from ${who.firstName}'s app too.` : `${who.firstName} sees this under the meal.`}</span>
          {asking ? (
            <span className="nl-say-ask">
              <button type="button" className="quiet" onClick={() => setAsking(false)} disabled={busy}>
                Keep
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await removeMealCommentAction(who.clientId, said.id);
                    setAsking(false);
                  })
                }
              >
                {busy ? "Removing…" : "Remove"}
              </button>
            </span>
          ) : (
            <span className="nl-say-ask">
              <button type="button" className="quiet" onClick={() => setAsking(true)}>
                Remove
              </button>
              <button type="button" className="quiet" onClick={() => setDraft(said.text)}>
                Edit
              </button>
            </span>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="nl-say">
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
        maxLength={1000}
        placeholder={`Comment on ${who.firstName}'s ${meal.label.toLowerCase()}…`}
        aria-label={`Comment on ${meal.label}`}
        disabled={busy}
      />
      <div className="nl-say-foot">
        <span className="nl-say-hint">{who.firstName} gets a notification and sees it under this meal. Ctrl + Enter sends.</span>
        <button type="button" onClick={send} disabled={!ready}>
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
