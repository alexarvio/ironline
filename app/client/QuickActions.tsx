"use client";

import { useNavigateTab, useOpenCheckIn, useOpenFood, useOpenPhotos } from "./CheckInContext";
import type { PhaseFoodToday, PhaseNextSession } from "./PhaseCards";

// Home's "Quick actions": what is still to do today, each a row with a small
// white button that goes straight there (the phase cards' action rows, one
// card). Done things drop out; with nothing left it says so. The background
// is one of the stock photos, blurred to a wash, a different one each day.

const BACKGROUNDS = ["/img/lifestyle-head.jpg", "/img/session-head.jpg", "/img/nutrition-head.jpg"];

type Action = { key: string; label: string; name: string; button: string; onClick: () => void };

export default function QuickActions({
  today,
  checkInCount,
  nextSession,
  trainedToday,
  food,
  picsDue,
}: {
  /** yyyy-mm-dd, for the day's background. */
  today: string;
  checkInCount: { done: number; total: number } | null;
  nextSession: PhaseNextSession;
  /** A session was ended today: training is done for the day. */
  trainedToday: boolean;
  food: PhaseFoodToday;
  picsDue: boolean;
}) {
  const openCheckIn = useOpenCheckIn();
  const openFood = useOpenFood();
  const openPhotos = useOpenPhotos();
  const goToTab = useNavigateTab();
  const kcal = (v: number) => Math.round(v).toLocaleString("en-US");

  const actions: Action[] = [];
  if (checkInCount && checkInCount.done < checkInCount.total && openCheckIn) {
    actions.push({
      key: "checkin",
      label: "Check-in",
      name: checkInCount.done > 0 ? `${checkInCount.done} of ${checkInCount.total} logged` : "Today's check-in",
      button: "Check in",
      onClick: () => openCheckIn("daily"),
    });
  }
  // A session begun and not ended is always there; otherwise the next one, until one is done today.
  if (nextSession && (nextSession.live || !trainedToday)) {
    actions.push({
      key: "training",
      label: nextSession.live ? "In progress" : "Training",
      name: nextSession.name,
      button: nextSession.live ? "Resume" : "Start",
      onClick: () => goToTab?.("training", nextSession.dayId),
    });
  }
  // Food is done once every meal has something in it, or the day's target is (nearly) reached.
  if (food) {
    const allMeals = !!food.mealsTotal && (food.mealsLogged ?? 0) >= food.mealsTotal;
    const nearTarget = !!food.target && food.eaten >= food.target * 0.9;
    if (!allMeals && !nearTarget) {
      actions.push({
        key: "food",
        label: "Food diary",
        name: food.eaten > 0 ? (food.target ? `${kcal(food.eaten)} of ${kcal(food.target)} kcal` : `${kcal(food.eaten)} kcal so far`) : "Nothing logged yet",
        button: "Log",
        onClick: () => (openFood ? openFood() : goToTab?.("nutrition")),
      });
    }
  }
  if (picsDue && openPhotos) {
    actions.push({ key: "photos", label: "Progress pictures", name: "Due today", button: "Add", onClick: () => openPhotos() });
  }

  const dayOfYear = Math.floor((Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10))) - Date.UTC(Number(today.slice(0, 4)), 0, 1)) / 86400000);
  const bg = BACKGROUNDS[dayOfYear % BACKGROUNDS.length];

  return (
    <section className="qa" aria-label="Quick actions">
      {/* eslint-disable-next-line @next/next/no-img-element -- a public file, blurred by CSS */}
      <img className="qa-bg" src={bg} alt="" aria-hidden="true" draggable={false} />
      <span className="qa-scrim" aria-hidden="true" />
      <div className="qa-panel">
        <div className="qa-head">
          <span className="qa-title">Quick actions</span>
          {actions.length > 0 && <span className="qa-count">{actions.length} left</span>}
        </div>
        {actions.length ? (
          actions.map((a) => (
            <div key={a.key} className="qa-row">
              <span className="qa-text">
                <span className="qa-label">{a.label}</span>
                <span className="qa-name">{a.name}</span>
              </span>
              <button type="button" className="qa-btn" onClick={a.onClick}>
                {a.button}
              </button>
            </div>
          ))
        ) : (
          <div className="qa-row qa-done">
            <span className="qa-text">
              <span className="qa-label">Today</span>
              <span className="qa-name">All completed</span>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
