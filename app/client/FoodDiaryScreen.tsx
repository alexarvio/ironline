"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { BookmarkIcon, ChevronDownIcon, ChevronLeftIcon, PlusIcon, SearchIcon, TrashIcon } from "../components/icons";
import {
  addCustomFoodAction,
  addFoodEntryAction,
  addFoodMealAction,
  addSavedDayAction,
  addSavedMealAction,
  deleteSavedDayAction,
  saveDayAction,
  copyFoodDayAction,
  deleteSavedMealAction,
  saveMealAction,
  getFoodDiaryAction,
  lookupBarcodeAction,
  searchPackagedAction,
  removeFoodEntryAction,
  pushFoodDayAction,
  removeFoodMealAction,
  renameFoodMealAction,
  reorderFoodMealsAction,
  searchFoodsAction,
  setFoodDayTypeAction,
  updateFoodEntryAction,
} from "../lib/actions";
import { useTween } from "./NutritionTargetsCard";
import BarcodeScanner from "./BarcodeScanner";

// The client's food diary, opened from the ring on Nutrition. On the client
// page model: the top bar (a back arrow in place of the burger) floating
// over a banner with the day, a week strip and the Training day / Rest day
// choice that decides the targets; the Nutrition card's rings pulled up over
// the banner, filling as the day is eaten with the kcal left inside; then
// the meals in one card. A day at a time: the strip, its arrows or a
// sideways swipe move a day, never past today; other days are read through
// the action, and the day is re-read after every change. Add food opens
// inside the meal: a search box with the matches under it, then the amount
// (a serving, or grams or ounces), then Add. A row opens the same amount
// panel to change it or take it out. Meals can be added beside the four
// standard ones, in a dialog. The day's kcal is mirrored into the calorie
// log the coach reads.
export type FoodMeal = string;
export type FoodEntryView = {
  id: number;
  meal: FoodMeal;
  food_id: string;
  name: string;
  grams: number;
  serving: string | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type FoodOptionView = {
  id: string;
  name: string;
  hint: string;
  group?: "own" | "packaged" | "common" | "more";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  servings: [string, number][];
};
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };
export type FoodDiaryProps = {
  date: string;
  dateLabel: string;
  target: Macros | null;
  eaten: Macros;
  dayType: "training" | "rest";
  loggedKcal: number | null;
  meals: { id: FoodMeal; label: string; own: boolean; kcal: number; protein: number; carbs: number; fat: number; entries: FoodEntryView[]; savedAs: string | null }[];
  recent: FoodOptionView[];
  saved: { id: number; name: string; kcal: number; count: number; names: string[] }[];
  savedDays: { id: number; name: string; kcal: number; count: number; dayType: "training" | "rest" | null }[];
  savedDayAs: string | null;
  savedDayId: number | null;
  previous: { date: string; dateLabel: string; meal: FoodMeal; mealLabel: string; kcal: number; names: string[] }[];
  /** Dates in the last month with anything logged, for the dots on the week strip. */
  loggedDays: string[];
};

const HUE = { protein: "#334EAC", carbs: "#D99A2B", fat: "#2E8B7A" } as const;
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const g = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
const G_PER_OZ = 28.349523125;
const ML_PER_FL_OZ = 29.5735295625;
const ML_PER_CUP = 236.5882365;
const amountLabel = (e: { grams: number; serving: string | null }) => (e.serving ? `${e.serving} · ${g(e.grams)} g` : `${g(e.grams)} g`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return iso(d);
};
// Monday to Sunday around a date.
const weekOf = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  const back = (d.getDay() + 6) % 7;
  const monday = addDays(date, -back);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};
const WEEKDAY = ["M", "T", "W", "T", "F", "S", "S"];
// How far back the diary goes.
const DAYS_BACK = 30;

// What is open inside a meal.
type Panel =
  | { kind: "search"; meal: FoodMeal }
  | { kind: "amount"; meal: FoodMeal; food: FoodOptionView; entry?: FoodEntryView }
  | { kind: "custom"; meal: FoodMeal };

export default function FoodDiaryScreen({ clientId, diary: initial, onBack }: { clientId: number; diary: FoodDiaryProps; onBack: () => void }) {
  // The day showing. Today arrives with the page; other days, and today
  // again after a change, are read through the action.
  const today = initial.date;
  const floor = addDays(today, -DAYS_BACK);
  const [diary, setDiary] = useState<FoodDiaryProps>(initial);
  const [date, setDate] = useState(initial.date);
  const [loading, startLoad] = useTransition();
  const load = (d: string) =>
    startLoad(async () => {
      const next = await getFoodDiaryAction(clientId, d);
      if (next) setDiary(next);
    });
  const goTo = (d: string) => {
    if (d > today || d < floor || d === date) return;
    setDate(d);
    setPanel(null);
    load(d);
  };
  const reload = () => load(date);
  const [panel, setPanel] = useState<Panel | null>(null);
  // A meal added just now: it appears at once with its name as a box to type into.
  const [namingId, setNamingId] = useState<FoodMeal | null>(null);
  const addMealNow = () => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("name", "New meal");
    fd.set("date", date);
    startLoad(async () => {
      const id = await addFoodMealAction(fd);
      const next = await getFoodDiaryAction(clientId, date);
      if (next) setDiary(next);
      if (id) setNamingId(id);
    });
  };
  // Leaving the name box: an empty or untouched name means the meal was not wanted.
  const finishNaming = (id: FoodMeal, name: string) => {
    setNamingId(null);
    const clean = name.trim();
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("meal", id);
    if (!clean || clean === "New meal") {
      startLoad(async () => {
        await removeFoodMealAction(fd);
        const next = await getFoodDiaryAction(clientId, date);
        if (next) setDiary(next);
      });
      return;
    }
    fd.set("name", clean);
    setDiary({ ...diary, meals: diary.meals.map((m) => (m.id === id ? { ...m, label: clean } : m)) });
    startLoad(async () => {
      await renameFoodMealAction(fd);
    });
  };
  // Naming the day to save it.
  const [namingDay, setNamingDay] = useState(false);
  // The row whose bin was tapped: it becomes the question until answered.
  const [askRemove, setAskRemove] = useState<number | null>(null);
  // The saved day whose × was tapped, likewise.
  const [askForgetDay, setAskForgetDay] = useState<number | null>(null);
  // The Copy a day card, folded until opened.
  const [copyOpen, setCopyOpen] = useState(false);
  const forgetHold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeRow = (id: number) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", String(id));
    setAskRemove(null);
    if (panel?.kind === "amount" && panel.entry?.id === id) setPanel(null);
    startLoad(async () => {
      await removeFoodEntryAction(fd);
      const next = await getFoodDiaryAction(clientId, date);
      if (next) setDiary(next);
    });
  };
  // Which meal is being saved under a name.
  const [savingMeal, setSavingMeal] = useState<FoodMeal | null>(null);
  // Meals fold shut to their name and figures, so a long day stays short.
  // They start folded; a meal added just now opens, since it is about to be filled.
  const [folded, setFolded] = useState<Set<FoodMeal>>(() => new Set(initial.meals.map((m) => m.id)));
  const toggleFold = (id: FoodMeal) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Rearranging: press and hold a meal's name and it lifts; drag it up or
  // down and the others slide out of its way; let go and the order is saved.
  // A short tap on the name folds the meal instead.
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; height: number } | null>(null);
  const mealRefs = useRef<Map<FoodMeal, HTMLDivElement>>(new Map());
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number; index: number; el: HTMLElement; pointerId: number } | null>(null);
  const dragging = useRef<{ from: number; to: number; startY: number; mids: number[] } | null>(null);
  const holdStart = (e: React.PointerEvent<HTMLElement>, index: number) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    const timer = setTimeout(() => {
      hold.current = null;
      el.setPointerCapture(pointerId);
      const rects = diary.meals.map((m) => mealRefs.current.get(m.id)?.getBoundingClientRect());
      dragging.current = { from: index, to: index, startY: e.clientY, mids: rects.map((r) => (r ? r.top + r.height / 2 : 0)) };
      if (navigator.vibrate) navigator.vibrate(10);
      setDrag({ from: index, to: index, dy: 0, height: rects[index]?.height ?? 60 });
    }, 320);
    hold.current = { timer, x: e.clientX, y: e.clientY, index, el, pointerId };
  };
  const holdMove = (e: React.PointerEvent<HTMLElement>) => {
    const h = hold.current;
    if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 14) {
      clearTimeout(h.timer);
      hold.current = null;
    }
    const d = dragging.current;
    if (!d) return;
    e.preventDefault();
    const dy = e.clientY - d.startY;
    const centre = d.mids[d.from] + dy;
    let to = d.from;
    if (dy < 0) {
      const i = d.mids.findIndex((m, idx) => idx < d.from && centre < m);
      if (i >= 0) to = i;
    } else if (dy > 0) {
      for (let i = d.mids.length - 1; i > d.from; i--) {
        if (centre > d.mids[i]) {
          to = i;
          break;
        }
      }
    }
    d.to = to;
    setDrag((prev) => (prev ? { ...prev, dy, to } : prev));
  };
  const holdEnd = (e: React.PointerEvent<HTMLElement>) => {
    const h = hold.current;
    if (h) {
      clearTimeout(h.timer);
      hold.current = null;
    }
    const d = dragging.current;
    if (!d) return;
    dragging.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    setDrag(null);
    if (d.to !== d.from) {
      const ids = diary.meals.map((m) => m.id);
      const [moved] = ids.splice(d.from, 1);
      ids.splice(d.to, 0, moved);
      setDiary({ ...diary, meals: ids.map((x) => diary.meals.find((m) => m.id === x)!) });
      const fd = new FormData();
      fd.set("clientId", String(clientId));
      fd.set("date", date);
      fd.set("order", ids.join(","));
      startLoad(async () => {
        await reorderFoodMealsAction(fd);
      });
    }
  };
  // Where each meal sits while one is being dragged.
  const shiftFor = (index: number): string | undefined => {
    if (!drag) return undefined;
    if (index === drag.from) return `translateY(${drag.dy}px)`;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return `translateY(-${drag.height}px)`;
    if (drag.to < drag.from && index >= drag.to && index < drag.from) return `translateY(${drag.height}px)`;
    return undefined;
  };
  // The top bar is see-through over the banner until the page scrolls.
  const [scrolled, setScrolled] = useState(false);

  // A sideways swipe on the page steps a day: left for the next, right for the one before.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onSwipeEnd = (x: number, y: number) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    goTo(addDays(date, dx > 0 ? -1 : 1));
  };

  const chooseDay = (dayType: "training" | "rest") => {
    if (dayType === diary.dayType) return;
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("date", date);
    fd.set("dayType", dayType);
    startLoad(async () => {
      await setFoodDayTypeAction(fd);
      const next = await getFoodDiaryAction(clientId, date);
      if (next) setDiary(next);
    });
  };

  const logged = new Set(diary.loggedDays);
  const week = weekOf(date);
  // The strip slides under the finger, a week at a time: three weeks sit
  // side by side and the middle one shows; let go past a third of the way and
  // it glides to the neighbour, then the day moves to the same weekday there.
  const weeks = [weekOf(addDays(date, -7)), week, weekOf(addDays(date, 7))];
  const canPrev = week[0] > floor;
  const canNext = week[6] < today;
  const [slide, setSlide] = useState<{ x: number; animate: boolean }>({ x: 0, animate: false });
  const stripRef = useRef<HTMLDivElement>(null);
  const stripDrag = useRef<{ x: number; y: number; width: number; on: boolean } | null>(null);
  const stripDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stripDrag.current = { x: e.clientX, y: e.clientY, width: e.currentTarget.getBoundingClientRect().width, on: false };
  };
  const stripMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = stripDrag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.on) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      d.on = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Past the ends it only gives a little, so it reads as the end.
    const give = (dx > 0 && !canPrev) || (dx < 0 && !canNext) ? 0.25 : 1;
    setSlide({ x: dx * give, animate: false });
  };
  const stripUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = stripDrag.current;
    stripDrag.current = null;
    if (!d || !d.on) return;
    e.stopPropagation();
    const dx = e.clientX - d.x;
    const dir = dx > d.width / 3 && canPrev ? -1 : dx < -d.width / 3 && canNext ? 1 : 0;
    if (dir === 0) return setSlide({ x: 0, animate: true });
    setSlide({ x: -dir * d.width, animate: true });
    const target = dir < 0 ? addDays(date, -7) : addDays(date, 7);
    const landing = target > today ? today : target < floor ? floor : target;
    window.setTimeout(() => {
      setSlide({ x: 0, animate: false });
      goTo(landing);
    }, 260);
  };
  // The banner: the day in big ("Today", "Monday"), the date under it.
  const dayDate = new Date(`${date}T00:00:00`);
  const weekday = dayDate.toLocaleDateString("en-GB", { weekday: "long" });
  const relative = diary.dateLabel === "Today" || diary.dateLabel === "Yesterday" ? diary.dateLabel : null;
  const dayTitle = relative ?? weekday;
  const daySub = `${relative ? `${weekday}, ` : ""}${dayDate.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;
  const dayWord = relative ? relative.toLowerCase() : weekday;

  return (
    <div className="fdi-screen app-layer-main">
      <header className={`app-header dark overlay${scrolled ? "" : " clear"}`}>
        <button type="button" className="app-header-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <span className="app-header-brand">Ironline</span>
        <div className="app-header-actions">
          <span className="app-header-icon-btn fdi-bar-spacer" aria-hidden="true" />
        </div>
      </header>

      <main
        className={`app-content dark${loading ? " fdi-loading" : ""}`}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
        onPointerDown={(e) => {
          swipeStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => onSwipeEnd(e.clientX, e.clientY)}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        <div className="fdi-page">
          <header className="nd-banner fdi-banner">
            <div className="fdi-banner-titles">
              <div className="fdi-eyebrow">Food diary</div>
              <h1 className="fdi-date">{dayTitle}</h1>
              <span className="fdi-date-sub">{daySub}</span>
            </div>
            <div className="fdi-week">
              <button type="button" className="fdi-week-arrow" onClick={() => goTo(addDays(date, -1))} disabled={date <= floor} aria-label="Previous day">
                <ChevronLeftIcon />
              </button>
              <div
                ref={stripRef}
                className="fdi-week-view"
                onPointerDown={stripDown}
                onPointerMove={stripMove}
                onPointerUp={stripUp}
                onPointerCancel={() => {
                  stripDrag.current = null;
                  setSlide({ x: 0, animate: true });
                }}
              >
                <div className="fdi-week-track" style={{ transform: `translateX(calc(-100% / 3 + ${slide.x}px))`, transition: slide.animate ? "transform 0.26s cubic-bezier(0.22, 1, 0.36, 1)" : "none" }}>
                  {weeks.map((w, wi) => (
                    <div key={w[0]} className="fdi-week-days" aria-hidden={wi !== 1}>
                      {w.map((d, i) => {
                        const future = d > today;
                        const tooFar = d < floor;
                        const on = d === date;
                        return (
                          <button
                            key={d}
                            type="button"
                            className={`fdi-day${on ? " on" : ""}${future || tooFar ? " off" : ""}`}
                            onClick={() => {
                              if (stripDrag.current?.on) return;
                              goTo(d);
                            }}
                            disabled={future || tooFar}
                            tabIndex={wi === 1 ? 0 : -1}
                            aria-pressed={on}
                            aria-label={d === today ? "Today" : d}
                          >
                            <span className="fdi-day-letter">{WEEKDAY[i]}</span>
                            <span className="fdi-day-num">{Number(d.slice(8))}</span>
                            <span className={`fdi-day-dot${on ? " on" : logged.has(d) ? " logged" : ""}`} aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" className="fdi-week-arrow next" onClick={() => goTo(addDays(date, 1))} disabled={date >= today} aria-label="Next day">
                <ChevronLeftIcon />
              </button>
            </div>
            {/* Which targets the day counts down from. */}
            <div className="nd-tabs fdi-tabs" role="tablist" aria-label="Day type">
              {(["training", "rest"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={diary.dayType === t} className={`nd-tab${diary.dayType === t ? " on" : ""}`} onClick={() => chooseDay(t)}>
                  {t === "training" ? "Training day" : "Rest day"}
                </button>
              ))}
            </div>
          </header>

          <Targets target={diary.target} eaten={diary.eaten} />
          {/* Pushing the day's calories into the log the coach reads: the
              client decides when the day is done, today or later. */}
          {(() => {
            const total = Math.round(diary.eaten.kcal);
            const logged = diary.loggedKcal;
            const same = logged != null && logged === total;
            const push = () => {
              const fd = new FormData();
              fd.set("clientId", String(clientId));
              fd.set("date", date);
              startLoad(async () => {
                await pushFoodDayAction(fd);
                const next = await getFoodDiaryAction(clientId, date);
                if (next) setDiary(next);
              });
            };
            return (
              <>
              <div className={`fdi-push${same ? " done" : ""}`}>
                <span className="fdi-push-text">
                  {total === 0 ? (
                    "Nothing logged yet"
                  ) : same ? (
                    <>
                      <b>{n(total)} kcal</b> logged for {dayWord}
                    </>
                  ) : logged != null ? (
                    <>
                      <b>{n(total)} kcal</b> eaten · {n(logged)} logged
                    </>
                  ) : (
                    <>
                      <b>{n(total)} kcal</b> eaten {relative ? dayWord : `on ${weekday}`}
                    </>
                  )}
                </span>
                {total > 0 && !same && (
                  <button type="button" className="fdi-push-btn" onClick={push} disabled={loading}>
                    {logged != null ? "Update log" : "Log calories"}
                  </button>
                )}
                {same && <span className="fdi-push-tick" aria-hidden="true">✓</span>}
                {/* Keeping the whole day to log again: outline to save, filled once it is. */}
                {total > 0 &&
                  (diary.savedDayAs && diary.savedDayId != null ? (
                    <button
                      type="button"
                      className="fdi-push-mark saved"
                      title={`Saved as ${diary.savedDayAs} · tap to unsave`}
                      aria-label={`Saved as ${diary.savedDayAs}. Unsave`}
                      disabled={loading}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("clientId", String(clientId));
                        fd.set("id", String(diary.savedDayId));
                        startLoad(async () => {
                          await deleteSavedDayAction(fd);
                          const next = await getFoodDiaryAction(clientId, date);
                          if (next) setDiary(next);
                        });
                      }}
                    >
                      <BookmarkIcon filled />
                    </button>
                  ) : (
                    <button type="button" className="fdi-push-mark" onClick={() => setNamingDay(true)} disabled={loading} aria-label="Save this day to log again">
                      <BookmarkIcon />
                    </button>
                  ))}
              </div>
              {/* Naming the day to save it: a row that folds out under the strip. */}
              <div className={`fdi-fold fdi-push-fold${namingDay ? "" : " folding"}`} aria-hidden={!namingDay}>
                <div className="fdi-fold-inner">
                  <div className="fdi-push-name-row">
                    {namingDay && (
                      <form
                        className="fdi-push-name"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
                          if (!name) return;
                          const fd = new FormData();
                          fd.set("clientId", String(clientId));
                          fd.set("date", date);
                          fd.set("name", name);
                          setNamingDay(false);
                          startLoad(async () => {
                            await saveDayAction(fd);
                            const next = await getFoodDiaryAction(clientId, date);
                            if (next) setDiary(next);
                          });
                        }}
                      >
                        <input
                          id="fdi-save-day-name"
                          name="name"
                          type="text"
                          placeholder="Name this day"
                          maxLength={40}
                          autoComplete="off"
                          autoFocus
                          aria-label="Name for the saved day"
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setNamingDay(false);
                          }}
                          onBlur={(e) => {
                            if (!e.currentTarget.value.trim() && !e.relatedTarget) setNamingDay(false);
                          }}
                        />
                        <button type="submit" className="fdi-push-btn">
                          Save
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
              </>
            );
          })()}

          <div className="nd-body fdi-list">
            {/* An empty day: one card, folded, holding the days that can be copied
                onto it: the last day with food, and the days the client saved. */}
            {(() => {
              if (diary.eaten.kcal > 0 || diary.meals.some((m) => m.entries.length > 0)) return null;
              const last = diary.previous.reduce<string | null>((best, p) => (p.date < date && (!best || p.date > best) ? p.date : best), null);
              const label = last ? (diary.previous.find((p) => p.date === last)?.dateLabel ?? last) : null;
              const kcal = last ? diary.previous.filter((p) => p.date === last).reduce((sum, p) => sum + p.kcal, 0) : 0;
              if (!last && diary.savedDays.length === 0) return null;
              const after = async () => {
                const next = await getFoodDiaryAction(clientId, date);
                if (next) {
                  setDiary(next);
                  setFolded(new Set());
                }
              };
              const copyLast = () => {
                if (!last) return;
                const fd = new FormData();
                fd.set("clientId", String(clientId));
                fd.set("fromDate", last);
                fd.set("toDate", date);
                startLoad(async () => {
                  await copyFoodDayAction(fd);
                  await after();
                });
              };
              const use = (id: number) => {
                const fd = new FormData();
                fd.set("clientId", String(clientId));
                fd.set("id", String(id));
                fd.set("date", date);
                startLoad(async () => {
                  await addSavedDayAction(fd);
                  await after();
                });
              };
              const forget = (id: number) => {
                const fd = new FormData();
                fd.set("clientId", String(clientId));
                fd.set("id", String(id));
                setAskForgetDay(null);
                startLoad(async () => {
                  await deleteSavedDayAction(fd);
                  const next = await getFoodDiaryAction(clientId, date);
                  if (next) setDiary(next);
                });
              };
              // Holding a saved day's row asks to forget it.
              const holdRow = (id: number) => ({
                onPointerDown: () => {
                  forgetHold.current = setTimeout(() => {
                    forgetHold.current = null;
                    if (navigator.vibrate) navigator.vibrate(10);
                    setAskForgetDay(id);
                  }, 450);
                },
                onPointerUp: () => {
                  if (forgetHold.current) clearTimeout(forgetHold.current);
                  forgetHold.current = null;
                },
                onPointerCancel: () => {
                  if (forgetHold.current) clearTimeout(forgetHold.current);
                  forgetHold.current = null;
                },
                onPointerMove: () => {
                  if (forgetHold.current) clearTimeout(forgetHold.current);
                  forgetHold.current = null;
                },
                onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
              });
              return (
                <section className="fdi-copy">
                  <button type="button" className="fdi-copy-head" onClick={() => setCopyOpen((o) => !o)} aria-expanded={copyOpen}>
                    <span className="fdi-copy-title">Saved days</span>
                    <span className={`fdi-copy-chev${copyOpen ? " up" : ""}`} aria-hidden="true">
                      <ChevronDownIcon />
                    </span>
                  </button>
                  <div className={`fdi-fold${copyOpen ? "" : " folding"}`}>
                    <div className="fdi-fold-inner">
                      {last && (
                        <div className="fdi-copy-row">
                          <span className="fdi-copy-main">
                            <span className="fdi-copy-name">{label === "Yesterday" ? "Yesterday" : label}</span>
                            <span className="fdi-copy-sub">{n(kcal)} kcal</span>
                          </span>
                          <button type="button" className="fdi-copy-use" onClick={copyLast} disabled={loading}>
                            Use
                          </button>
                        </div>
                      )}
                      {diary.savedDays.map((d) => (
                        <div key={d.id} className={`fdi-copy-row${askForgetDay === d.id ? " asking" : ""}`} {...holdRow(d.id)}>
                          <span className="fdi-copy-main">
                            <span className="fdi-copy-name">{d.name}</span>
                            <span className="fdi-copy-sub">{n(d.kcal)} kcal</span>
                          </span>
                          {askForgetDay === d.id ? (
                            <span className="fdi-row-ask">
                              <button type="button" className="fdi-confirm-keep" onClick={() => setAskForgetDay(null)} autoFocus>
                                Keep
                              </button>
                              <button type="button" className="fdi-confirm-remove" onClick={() => forget(d.id)} disabled={loading}>
                                Forget
                              </button>
                            </span>
                          ) : (
                            <button type="button" className="fdi-copy-use" onClick={() => use(d.id)} disabled={loading}>
                              Use
                            </button>
                          )}
                        </div>
                      ))}
                      {diary.savedDays.length > 0 && <p className="fdi-copy-foot">Hold a saved day to forget it</p>}
                    </div>
                  </div>
                </section>
              );
            })()}
            <section className="fdi-meals">
              {diary.meals.map((meal, index) => {
                const open = panel?.meal === meal.id ? panel : null;
                return (
                  <div
                    key={meal.id}
                    ref={(el) => {
                      if (el) mealRefs.current.set(meal.id, el);
                      else mealRefs.current.delete(meal.id);
                    }}
                    className={`fdi-meal${open ? " open" : ""}${drag?.from === index ? " lifted" : ""}${drag ? " shifting" : ""}`}
                    style={{ transform: shiftFor(index) }}
                  >
                    <div className="fdi-meal-head">
                      <span
                        className="fdi-meal-handle"
                        onPointerDown={(e) => holdStart(e, index)}
                        onPointerMove={holdMove}
                        onPointerUp={holdEnd}
                        onPointerCancel={holdEnd}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {namingId === meal.id ? (
                          <input
                            id={`fdi-meal-name-${meal.id}`}
                            className="fdi-meal-name-box"
                            type="text"
                            defaultValue=""
                            placeholder="Name the meal"
                            maxLength={30}
                            autoComplete="off"
                            autoFocus
                            aria-label="Meal name"
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") {
                                e.currentTarget.value = "";
                                e.currentTarget.blur();
                              }
                            }}
                            onBlur={(e) => finishNaming(meal.id, e.currentTarget.value)}
                            onFocus={(e) => {
                              const el = e.currentTarget;
                              setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
                            }}
                          />
                        ) : (
                          <span className="fdi-meal-title">{meal.label}</span>
                        )}
                      </span>
                      {(meal.entries.length > 0 || meal.own) && (
                        <button type="button" className={`fdi-meal-chev${folded.has(meal.id) ? "" : " up"}`} onClick={() => toggleFold(meal.id)} aria-expanded={!folded.has(meal.id)} aria-label={folded.has(meal.id) ? `Open ${meal.label}` : `Fold ${meal.label}`}>
                          <ChevronDownIcon />
                        </button>
                      )}
                      <span className="fdi-meal-spacer" />
                      {meal.entries.length > 0 &&
                        (meal.savedAs ? (
                          <span className="fdi-icon-btn saved" title={`Saved as ${meal.savedAs}`} aria-label={`Saved as ${meal.savedAs}`} role="img">
                            <BookmarkIcon filled />
                          </span>
                        ) : (
                          <button type="button" className="fdi-icon-btn" onClick={() => setSavingMeal(savingMeal === meal.id ? null : meal.id)} aria-label={`Save ${meal.label} to add again`}>
                            <BookmarkIcon />
                          </button>
                        ))}
                      {!open && (
                        <button
                          type="button"
                          className="fdi-icon-btn"
                          onClick={() => {
                            setFolded((prev) => {
                              const next = new Set(prev);
                              next.delete(meal.id);
                              return next;
                            });
                            setPanel({ kind: "search", meal: meal.id });
                          }}
                          aria-label={`Add food to ${meal.label}`}
                        >
                          <PlusIcon />
                        </button>
                      )}
                    </div>
                    {meal.entries.length > 0 && (
                      <Facts className="fdi-per meal" label={`${meal.label}: ${n(meal.kcal)} kcal`} kcal={meal.kcal} protein={meal.protein} carbs={meal.carbs} fat={meal.fat} />
                    )}
                    {savingMeal === meal.id && (
                      <form
                        className="fdi-panel fdi-save"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
                          if (!name) return;
                          const fd = new FormData();
                          fd.set("clientId", String(clientId));
                          fd.set("date", date);
                          fd.set("meal", meal.id);
                          fd.set("name", name);
                          setSavingMeal(null);
                          startLoad(async () => {
                            await saveMealAction(fd);
                            const next = await getFoodDiaryAction(clientId, date);
                            if (next) setDiary(next);
                          });
                        }}
                      >
                        <div className="fdi-panel-head">
                          <span className="fdi-eyebrow">Save this meal to add again</span>
                          <button type="button" className="fdi-panel-cancel" onClick={() => setSavingMeal(null)}>
                            Cancel
                          </button>
                        </div>
                        <input name="name" className="fdi-dialog-input" type="text" defaultValue={`My ${meal.label.toLowerCase()}`} maxLength={40} autoFocus aria-label="Name for the saved meal" />
                        <button type="submit" className="fdi-primary">
                          Save meal
                        </button>
                      </form>
                    )}
                    <div className={`fdi-fold${folded.has(meal.id) ? " folding" : ""}`}>
                    <div className="fdi-fold-inner">
                    {meal.own && meal.entries.length === 0 && !open && (
                      <div className="fdi-meal-empty">
                        <p className="fdi-meal-empty-note">Nothing here yet. Tap + to add a food.</p>
                        <button
                          type="button"
                          className="fdi-meal-remove"
                          onClick={() => {
                            const fd = new FormData();
                            fd.set("clientId", String(clientId));
                            fd.set("meal", meal.id);
                            startLoad(async () => {
                              await removeFoodMealAction(fd);
                              const next = await getFoodDiaryAction(clientId, date);
                              if (next) setDiary(next);
                            });
                          }}
                        >
                          Remove this meal
                        </button>
                      </div>
                    )}
                    {meal.entries.map((e) => {
                      const selected = open?.kind === "amount" && open.entry?.id === e.id;
                      return (
                        <div key={e.id} className={`fdi-row-wrap${selected ? " selected" : ""}`}>
                        <button
                          type="button"
                          className={`fdi-row${selected ? " selected" : ""}`}
                          onClick={() =>
                            selected ? setPanel(null) : setPanel({
                              kind: "amount",
                              meal: meal.id,
                              entry: e,
                              food: { id: e.food_id, name: e.name, hint: "", group: "more", kcal: (e.kcal / e.grams) * 100, protein: (e.protein / e.grams) * 100, carbs: (e.carbs / e.grams) * 100, fat: (e.fat / e.grams) * 100, servings: [] },
                            })
                          }
                        >
                          <span className="fdi-row-main">
                            <span className="fdi-row-name">{e.name}</span>
                            <span className="fdi-row-amount">
                              {amountLabel(e)} · {n(e.kcal)} kcal
                            </span>
                          </span>
                        </button>
                        {askRemove === e.id ? (
                          <span className="fdi-row-ask">
                            <button type="button" className="fdi-confirm-keep" onClick={() => setAskRemove(null)} autoFocus>
                              Keep
                            </button>
                            <button type="button" className="fdi-confirm-remove" onClick={() => removeRow(e.id)} disabled={loading}>
                              Remove
                            </button>
                          </span>
                        ) : (
                          <button type="button" className="fdi-row-bin" onClick={() => setAskRemove(e.id)} aria-label={`Remove ${e.name}`}>
                            <TrashIcon />
                          </button>
                        )}
                        {selected && open?.kind === "amount" && (
                          <AmountPanel
                            clientId={clientId}
                            date={date}
                            meal={meal.id}
                            mealLabel={meal.label}
                            food={open.food}
                            entry={e}
                            onDone={() => {
                              setPanel(null);
                              reload();
                            }}
                            onCancel={() => setPanel(null)}
                          />
                        )}
                        </div>
                      );
                    })}
                    {open?.kind === "search" ? (
                      <SearchPanel
                        clientId={clientId}
                        date={date}
                        meal={meal.id}
                        mealLabel={meal.label}
                        recent={diary.recent}
                        saved={diary.saved}
                        onPick={(food) => setPanel({ kind: "amount", meal: meal.id, food })}
                        onCustom={() => setPanel({ kind: "custom", meal: meal.id })}
                        onCopied={() => {
                          setPanel(null);
                          reload();
                        }}
                        onCancel={() => setPanel(null)}
                      />
                    ) : open?.kind === "amount" && !open.entry ? (
                      <AmountPanel
                        clientId={clientId}
                        date={date}
                        meal={meal.id}
                        mealLabel={meal.label}
                        food={open.food}
                        onDone={() => {
                          setPanel(null);
                          reload();
                        }}
                        onCancel={() => setPanel({ kind: "search", meal: meal.id })}
                      />
                    ) : open?.kind === "custom" ? (
                      <CustomFoodPanel clientId={clientId} onCancel={() => setPanel({ kind: "search", meal: meal.id })} onCreated={(food) => setPanel({ kind: "amount", meal: meal.id, food })} />
                    ) : null}
                    </div>
                    </div>
                  </div>
                );
              })}
            </section>

            <button type="button" className="fdi-add-meal" onClick={addMealNow} disabled={loading || namingId != null}>
              <PlusIcon />
              Add a meal
            </button>
            <p className="fdi-meals-hint">Hold a meal&rsquo;s name to move it.</p>
          </div>
        </div>
      </main>

    </div>
  );
}

// ---- The targets card -------------------------------------------------------
// The Nutrition card's rings, one per macro, filling as the day is eaten;
// the kcal left counting down inside them; the three macros beside them
// with what is eaten of the target. Figures run to their new values.

const SIZE = 150;
const STROKE = 6;
const RING_R = { protein: 70, carbs: 61, fat: 52 } as const;
const MACROS = ["protein", "carbs", "fat"] as const;
const NAME = { protein: "Protein", carbs: "Carbs", fat: "Fat" } as const;

function Targets({ target, eaten }: { target: Macros | null; eaten: Macros }) {
  const left = target ? Math.max(0, target.kcal - eaten.kcal) : null;
  const over = target ? Math.max(0, eaten.kcal - target.kcal) : 0;
  const figure = useTween(left == null ? eaten.kcal : over > 0 ? over : left);
  return (
    <section className="nd-card fdi-targets">
      <div className="nd-cal-row">
        <div className="nd-ring" role="img" aria-label={left == null ? `${n(eaten.kcal)} kcal eaten` : over > 0 ? `${n(over)} kcal over` : `${n(left)} kcal left`}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              {MACROS.map((m) => (
                <Ring key={m} id={m} share={target && target[m] > 0 ? Math.min(1, eaten[m] / target[m]) : 0} />
              ))}
            </g>
          </svg>
          <div className="nd-ring-center">
            <span className="nd-ring-kcal">{n(figure)}</span>
            <span className="nd-ring-label">{left == null ? "kcal eaten" : over > 0 ? "kcal over" : "kcal left"}</span>
          </div>
        </div>
        <div className="nd-macros">
          {MACROS.map((m) => (
            <MacroRow key={m} id={m} eaten={eaten[m]} goal={target?.[m] ?? null} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Ring({ id, share }: { id: (typeof MACROS)[number]; share: number }) {
  const r = RING_R[id];
  const circumference = 2 * Math.PI * r;
  const length = useTween(share * circumference);
  return (
    <g>
      <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke="#e6ecf3" strokeWidth={STROKE} />
      <circle className="nd-ring-arc" cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke={HUE[id]} strokeWidth={STROKE} strokeLinecap="butt" style={{ strokeDasharray: `${length} ${circumference}`, strokeOpacity: length > 0 ? 1 : 0 }} />
    </g>
  );
}

function MacroRow({ id, eaten, goal }: { id: (typeof MACROS)[number]; eaten: number; goal: number | null }) {
  const figure = useTween(eaten);
  // The target reached: the figure takes the macro's colour and a tick draws
  // itself beside it. The figure keeps counting past it.
  const met = goal != null && goal > 0 && eaten >= goal - 0.05;
  return (
    <div className="nd-macro">
      <span className="nd-macro-bar" style={{ background: HUE[id] }} aria-hidden="true" />
      <div className="nd-macro-body">
        <div className={`nd-macro-grams${met ? " met" : ""}`} style={met ? { color: HUE[id] } : undefined}>
          {g(figure)}
          <small>g</small>
          {met && (
            <svg className="fdi-tick" viewBox="0 0 16 16" aria-label="Target reached" role="img">
              <path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div className="nd-macro-name">
          {NAME[id]}
          {goal != null && (
            <>
              {" · "}
              <span className="nd-macro-of">of {n(goal)} g</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Four figures: calories, protein, carbs, fat -----------------------------
// For a food per 100 g and for a meal; the figures run to their new values.

function Facts({ className, label, kcal, protein, carbs, fat }: { className: string; label: string; kcal: number; protein: number; carbs: number; fat: number }) {
  return (
    <div className={className} role="group" aria-label={label}>
      <FactTile name="calories" value={kcal} format={n} />
      <FactTile name="protein" value={protein} format={g} unit="g" color={HUE.protein} />
      <FactTile name="carbs" value={carbs} format={g} unit="g" color={HUE.carbs} />
      <FactTile name="fat" value={fat} format={g} unit="g" color={HUE.fat} />
    </div>
  );
}

function FactTile({ name, value, format, unit, color }: { name: string; value: number; format: (v: number) => string; unit?: string; color?: string }) {
  const shown = useTween(value);
  return (
    <span className="fdi-per-cell" style={color ? { color } : undefined}>
      <b>
        {format(shown)}
        {unit && <i>{unit}</i>}
      </b>
      <small>{name}</small>
    </span>
  );
}

// ---- Inside a meal: search, or copy a meal -----------------------------------

function SearchPanel({
  clientId,
  date,
  meal,
  mealLabel,
  recent,
  saved,
  onPick,
  onCustom,
  onCopied,
  onCancel,
}: {
  clientId: number;
  date: string;
  meal: FoodMeal;
  mealLabel: string;
  recent: FoodOptionView[];
  saved: FoodDiaryProps["saved"];
  onPick: (food: FoodOptionView) => void;
  onCustom: () => void;
  onCopied: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"search" | "copy">("search");
  const [query, setQuery] = useState("");
  // The last answer, with the query it answers; anything else is stale.
  const [answer, setAnswer] = useState<{ q: string; rows: FoodOptionView[] } | null>(null);
  // Which query the long tail was opened for.
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [copying, startCopy] = useTransition();
  // The saved meal whose × was tapped: it asks before it forgets.
  const [askForget, setAskForget] = useState<number | null>(null);
  // Packaged products from Open Food Facts, asked for on request: the answer
  // and the query it answers.
  const [packaged, setPackaged] = useState<{ q: string; rows: FoodOptionView[]; error?: string } | null>(null);
  const [fetching, startFetch] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);
  const q = query.trim();
  const searchPackaged = () =>
    startFetch(async () => {
      const res = await searchPackagedAction(clientId, q);
      setPackaged({ q, ...res });
    });
  const onCode = (code: string) => {
    setScanning(false);
    setScanNote(null);
    startFetch(async () => {
      const res = await lookupBarcodeAction(clientId, code);
      if (res.food) onPick(res.food);
      else setScanNote(res.error ?? `Barcode ${code} is not in Open Food Facts yet. Search by name, or add it as your own food.`);
    });
  };
  const active = q.length >= 2;
  // Search a beat after the last keystroke; the latest query wins.
  useEffect(() => {
    if (!active) return;
    let live = true;
    const t = setTimeout(async () => {
      const rows = await searchFoodsAction(clientId, q);
      if (live) setAnswer({ q, rows });
    }, 220);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, active, clientId]);

  const results = active && answer?.q === q ? answer.rows : null;
  const searching = active && results == null;
  const showMore = moreFor === q;
  const showingRecent = results == null && recent.length > 0;
  // The client's own and the everyday foods are the list; the catalog's long
  // tail sits behind a count, unless it is all there is.
  const front = (results ?? recent).filter((f) => results == null || f.group !== "more");
  const tail = results?.filter((f) => f.group === "more") ?? [];
  const list = front.length === 0 || showMore ? [...front, ...tail] : front;

  const addSaved = (s: FoodDiaryProps["saved"][number]) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", String(s.id));
    fd.set("date", date);
    fd.set("meal", meal);
    startCopy(async () => {
      await addSavedMealAction(fd);
      onCopied();
    });
  };
  const forget = (s: FoodDiaryProps["saved"][number]) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", String(s.id));
    startCopy(async () => {
      await deleteSavedMealAction(fd);
      onCopied();
    });
  };

  return (
    <div className="fdi-panel">
      <div className="fdi-panel-head">
        <span className="fdi-eyebrow">Add to {mealLabel}</span>
        <button type="button" className="fdi-panel-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {scanning && <BarcodeScanner onCode={onCode} onClose={() => setScanning(false)} />}
      {saved.length > 0 && (
        <div className="fdi-modes" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "search"} className={`fdi-mode${mode === "search" ? " on" : ""}`} onClick={() => setMode("search")}>
            Search
          </button>
          <button type="button" role="tab" aria-selected={mode === "copy"} className={`fdi-mode${mode === "copy" ? " on" : ""}`} onClick={() => setMode("copy")}>
            Copy a meal
          </button>
        </div>
      )}
      {mode === "search" ? (
        <>
          <div className="fdi-search-row">
            <label className="fdi-search">
              <SearchIcon />
              <input ref={inputRef} id={`fdi-search-${meal}`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What did you eat?" autoComplete="off" aria-label="Search foods" />
            </label>
            <button type="button" className="fdi-scan-btn" onClick={() => setScanning(true)} aria-label="Scan a barcode" disabled={fetching}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
                <path d="M8 8v8M11 8v8M14 8v8M16.5 8v8" />
              </svg>
            </button>
          </div>
          {scanNote && <p className="fdi-empty">{scanNote}</p>}
          <div className="fdi-results">
            {showingRecent && <span className="fdi-results-label">Recent</span>}
            {list.map((f) => (
              <button key={f.id} type="button" className="fdi-result" onClick={() => onPick(f)}>
                <span className="fdi-result-main">
                  <span className="fdi-result-name">{f.name}</span>
                  <span className="fdi-result-hint">{f.hint || " "}</span>
                </span>
                <span className="fdi-result-kcal">
                  {n(f.kcal)} <small>kcal / 100 g</small>
                </span>
              </button>
            ))}
            {front.length > 0 && tail.length > 0 && !showMore && (
              <button type="button" className="fdi-more" onClick={() => setMoreFor(q)}>
                Show {tail.length} more from the catalogue
              </button>
            )}
            {results != null && results.length === 0 && !searching && <p className="fdi-empty">Nothing called “{q}”.</p>}
            {active && packaged?.q === q && (
              <>
                <span className="fdi-results-label">Packaged products</span>
                {packaged.rows.map((f) => (
                  <button key={f.id} type="button" className="fdi-result" onClick={() => onPick(f)}>
                    <span className="fdi-result-main">
                      <span className="fdi-result-name">{f.name}</span>
                      <span className="fdi-result-hint">{f.hint}</span>
                    </span>
                    <span className="fdi-result-kcal">
                      {n(f.kcal)} <small>kcal / 100 g</small>
                    </span>
                  </button>
                ))}
                {packaged.error && <p className="fdi-empty">{packaged.error}</p>}
                {!packaged.error && packaged.rows.length === 0 && <p className="fdi-empty">No packaged product called “{q}” on Open Food Facts.</p>}
              </>
            )}
            {active && !searching && packaged?.q !== q && (
              <button type="button" className="fdi-more" onClick={searchPackaged} disabled={fetching}>
                {fetching ? "Asking Open Food Facts…" : "Search packaged products"}
              </button>
            )}
            {results == null && recent.length === 0 && !active && <p className="fdi-empty">Try “chicken breast”, “oats”, “banana”.</p>}
          </div>
          <button type="button" className="fdi-link" onClick={onCustom}>
            Can’t find it? Add your own food
          </button>
        </>
      ) : (
        <div className="fdi-results">
          <p className="fdi-hint">A meal you saved, the same foods and amounts, into {mealLabel}.</p>
          {saved.map((s) => (
            <div key={`s${s.id}`} className="fdi-result-row">
              <button type="button" className="fdi-result" onClick={() => addSaved(s)} disabled={copying}>
                <span className="fdi-result-main">
                  <span className="fdi-result-name">{s.name}</span>
                  <span className="fdi-result-hint">{s.names.join(", ")}</span>
                </span>
                <span className="fdi-result-kcal">
                  {n(s.kcal)} <small>kcal</small>
                </span>
              </button>
              {askForget === s.id ? (
                <span className="fdi-row-ask">
                  <button type="button" className="fdi-confirm-keep" onClick={() => setAskForget(null)} autoFocus>
                    Keep
                  </button>
                  <button type="button" className="fdi-confirm-remove" onClick={() => { setAskForget(null); forget(s); }} disabled={copying}>
                    Forget
                  </button>
                </span>
              ) : (
                <button type="button" className="fdi-result-x" onClick={() => setAskForget(s.id)} disabled={copying} aria-label={`Forget saved meal ${s.name}`}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Inside a meal: how much -------------------------------------------------

function AmountPanel({
  clientId,
  date,
  meal,
  mealLabel,
  food,
  entry,
  onDone,
  onCancel,
}: {
  clientId: number;
  date: string;
  meal: FoodMeal;
  mealLabel: string;
  food: FoodOptionView;
  entry?: FoodEntryView;
  onDone: () => void;
  onCancel: () => void;
}) {
  // A number and a unit. The unit list is grams, ounces, ml and l for a
  // liquid, and the food's own portions ("cup", "large"), each worth so many
  // grams; what is saved is number × unit, in grams, with the unit's name
  // when it is not grams. A liquid is a food the catalog weighs by the fluid
  // ounce (or a plain cup), which gives its density; the client's own foods
  // are taken as water.
  const liquid = food.servings.find(([label]) => /^fl oz\b/i.test(label)) ?? food.servings.find(([label]) => /^cup$/i.test(label));
  const density = liquid ? liquid[1] / (/^fl oz/i.test(liquid[0]) ? ML_PER_FL_OZ : ML_PER_CUP) : food.group === "own" ? 1 : null;
  const units: { id: string; label: string; grams: number; portion: boolean }[] = [
    { id: "g", label: "g", grams: 1, portion: false },
    { id: "oz", label: "oz", grams: G_PER_OZ, portion: false },
    ...(density ? [{ id: "ml", label: "ml", grams: density, portion: false }, { id: "l", label: "l", grams: density * 1000, portion: false }] : []),
    ...food.servings.map(([label, grams]) => ({ id: `p:${label}`, label, grams, portion: true })),
  ];
  // A row opened again comes back in the unit it was entered in; a liquid
  // starts in ml, anything with a portion in its first portion.
  const startUnit = entry
    ? units.find((u) => u.portion && entry.serving?.endsWith(u.label))?.id ?? units.find((u) => !u.portion && u.id !== "g" && entry.serving?.endsWith(` ${u.label}`))?.id ?? "g"
    : liquid && /^fl oz/i.test(liquid[0])
    ? "ml"
    : food.servings.length
    ? `p:${food.servings[0][0]}`
    : "g";
  const [unitId, setUnitId] = useState(startUnit);
  const unit = units.find((u) => u.id === unitId) ?? units[0];
  const startAmount = entry ? entry.grams / unit.grams : unit.portion ? 1 : unit.id === "ml" ? 250 : 100;
  const [amountText, setAmountText] = useState(g(startAmount));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.select(), 50);
    return () => clearTimeout(t);
  }, []);

  const amount = Number(amountText.replace(",", ".")) || 0;
  const grams = amount * unit.grams;
  const servingLabel = unit.portion ? `${amount === 1 ? "" : `${g(amount)} × `}${unit.label}` : unit.id !== "g" ? `${g(amount)} ${unit.label}` : null;
  const ok = grams > 0 && grams <= 5000 && !pending;
  // Changing the unit keeps the weight: 100 g becomes 3.5 oz, a cup becomes its grams.
  const changeUnit = (id: string) => {
    const next = units.find((u) => u.id === id);
    if (!next) return;
    setUnitId(id);
    if (grams > 0) setAmountText(g(grams / next.grams));
  };

  const save = () => {
    if (!ok) return;
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("grams", String(Math.round(grams * 10) / 10));
    fd.set("serving", servingLabel ?? "");
    start(async () => {
      if (entry) {
        fd.set("id", String(entry.id));
        await updateFoodEntryAction(fd);
      } else {
        fd.set("date", date);
        fd.set("meal", meal);
        fd.set("foodId", food.id);
        await addFoodEntryAction(fd);
      }
      onDone();
    });
  };
  const remove = () => {
    if (!entry) return;
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", String(entry.id));
    start(async () => {
      await removeFoodEntryAction(fd);
      onDone();
    });
  };

  return (
    <div className="fdi-panel">
      {/* Under a row the row already says what this is; only a new food needs the head and name. */}
      {!entry && (
        <div className="fdi-panel-head">
          <span className="fdi-eyebrow">Add to {mealLabel}</span>
          <button type="button" className="fdi-panel-cancel" onClick={onCancel}>
            Back
          </button>
        </div>
      )}
      <div className="fdi-food">
        {!entry && <span className="fdi-food-name">{food.name}</span>}
        <span className="fdi-field-label">Per 100 g</span>
        <Facts className="fdi-per" label={`Per 100 g: ${n(food.kcal)} kcal`} kcal={food.kcal} protein={food.protein} carbs={food.carbs} fat={food.fat} />
      </div>

      <div className="fdi-amount-row">
        <label className="fdi-amount">
          <span className="fdi-field-label">Amount</span>
          <input
            ref={inputRef}
            id={`fdi-amount-${meal}-${entry?.id ?? "new"}`}
            type="text"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="0"
            aria-label="Amount"
          />
        </label>
        <div className="fdi-unit">
          <span className="fdi-field-label">Unit</span>
          <UnitPicker
            id={`fdi-unit-${meal}-${entry?.id ?? "new"}`}
            value={unitId}
            options={units.map((u) => ({ id: u.id, label: u.portion ? `${u.label} (${g(u.grams)} g)` : u.label }))}
            onChange={changeUnit}
          />
        </div>
      </div>

      {/* Removing is asked in place: the Save row becomes the question. */}
      {confirmRemove ? (
        <div className="fdi-confirm" role="group" aria-label={`Remove from ${mealLabel}?`}>
          <span className="fdi-confirm-text">Remove?</span>
          <button type="button" className="fdi-confirm-keep" onClick={() => setConfirmRemove(false)} autoFocus>
            Keep
          </button>
          <button type="button" className="fdi-confirm-remove" onClick={remove} disabled={pending}>
            {pending ? "Removing…" : "Remove"}
          </button>
        </div>
      ) : (
        <div className="fdi-panel-actions">
          <button type="button" className="fdi-primary" onClick={save} disabled={!ok}>
            {pending ? "Saving…" : entry ? "Save" : `Add to ${mealLabel}`}
          </button>

        </div>
      )}
    </div>
  );
}

// ---- A dropdown of our own -----------------------------------------------------
// A button showing the choice; a list under it when opened; closes on a
// pick, a tap outside, or Escape.

function UnitPicker({ id, value, options, onChange }: { id: string; value: string; options: { id: string; label: string }[]; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  // The list floats over the page (the meal clips what hangs out of it),
  // under the button, or above it when the screen ends too soon.
  const [place, setPlace] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (wrap.current && !wrap.current.contains(t) && menuRef.current && !menuRef.current.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onMove = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("scroll", onMove, true);
    };
  }, [open]);
  const toggle = () => {
    if (open) return setOpen(false);
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const need = Math.min(options.length, 6) * 40 + 12;
    const below = window.innerHeight - r.bottom;
    setPlace(below >= need + 8 ? { top: r.bottom + 6, left: r.left, width: r.width } : { bottom: window.innerHeight - r.top + 6, left: r.left, width: r.width });
    setOpen(true);
  };
  const current = options.find((o) => o.id === value) ?? options[0];
  return (
    <div className={`fdi-pick${open ? " open" : ""}`} ref={wrap}>
      <button type="button" id={id} className="fdi-pick-btn" onClick={toggle} aria-haspopup="listbox" aria-expanded={open}>
        <span className="fdi-pick-label">{current?.label}</span>
        <ChevronDownIcon />
      </button>
      {open &&
        place &&
        createPortal(
        <ul ref={menuRef} className="fdi-pick-menu" role="listbox" aria-labelledby={id} style={{ top: place.top, bottom: place.bottom, left: place.left, width: place.width }}>
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                className={`fdi-pick-item${o.id === value ? " on" : ""}`}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
        )}
    </div>
  );
}

// ---- Inside a meal: a food of the client's own ------------------------------

function CustomFoodPanel({ clientId, onCancel, onCreated }: { clientId: number; onCancel: () => void; onCreated: (food: FoodOptionView) => void }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "", servingLabel: "", servingGrams: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const ok = form.name.trim() !== "" && form.kcal.trim() !== "" && !pending;
  const submit = () => {
    if (!ok) return;
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    for (const [k, v] of Object.entries(form)) fd.set(k, v);
    start(async () => {
      const id = await addCustomFoodAction(fd);
      if (!id) return;
      const num = (s: string) => Number(s.replace(",", ".")) || 0;
      const sg = num(form.servingGrams);
      onCreated({
        id,
        name: form.name.trim(),
        hint: "Your food",
        group: "own",
        kcal: num(form.kcal),
        protein: num(form.protein),
        carbs: num(form.carbs),
        fat: num(form.fat),
        servings: form.servingLabel.trim() && sg > 0 ? [[form.servingLabel.trim(), sg]] : [],
      });
    });
  };
  return (
    <div className="fdi-panel">
      <div className="fdi-panel-head">
        <span className="fdi-eyebrow">Your own food</span>
        <button type="button" className="fdi-panel-cancel" onClick={onCancel}>
          Back
        </button>
      </div>
      <p className="fdi-hint">Per 100 g, off the label. Only you can find it.</p>
      <div className="fdi-form">
        <label className="fdi-field wide">
          <span>Name</span>
          <input id="fdi-custom-name" type="text" value={form.name} onChange={set("name")} placeholder="Mum’s lasagne" maxLength={80} autoFocus />
        </label>
        <label className="fdi-field">
          <span>kcal</span>
          <input id="fdi-custom-kcal" type="text" inputMode="decimal" value={form.kcal} onChange={set("kcal")} placeholder="0" />
        </label>
        <label className="fdi-field">
          <span>Protein g</span>
          <input id="fdi-custom-protein" type="text" inputMode="decimal" value={form.protein} onChange={set("protein")} placeholder="0" />
        </label>
        <label className="fdi-field">
          <span>Carbs g</span>
          <input id="fdi-custom-carbs" type="text" inputMode="decimal" value={form.carbs} onChange={set("carbs")} placeholder="0" />
        </label>
        <label className="fdi-field">
          <span>Fat g</span>
          <input id="fdi-custom-fat" type="text" inputMode="decimal" value={form.fat} onChange={set("fat")} placeholder="0" />
        </label>
        <label className="fdi-field">
          <span>Serving (optional)</span>
          <input id="fdi-custom-serving" type="text" value={form.servingLabel} onChange={set("servingLabel")} placeholder="1 portion" maxLength={40} />
        </label>
        <label className="fdi-field">
          <span>Serving grams</span>
          <input id="fdi-custom-serving-grams" type="text" inputMode="decimal" value={form.servingGrams} onChange={set("servingGrams")} placeholder="250" />
        </label>
      </div>
      <button type="button" className="fdi-primary" onClick={submit} disabled={!ok}>
        {pending ? "Saving…" : "Save and add"}
      </button>
    </div>
  );
}
