"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDownIcon, ChevronLeftIcon, PlusIcon, SearchIcon } from "../components/icons";
import {
  addCustomFoodAction,
  addFoodEntryAction,
  addFoodMealAction,
  addSavedMealAction,
  copyFoodMealAction,
  deleteSavedMealAction,
  saveMealAction,
  getFoodDiaryAction,
  removeFoodEntryAction,
  pushFoodDayAction,
  removeFoodMealAction,
  reorderFoodMealsAction,
  searchFoodsAction,
  setFoodDayTypeAction,
  updateFoodEntryAction,
} from "../lib/actions";
import { useTween } from "./NutritionTargetsCard";

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
  group?: "own" | "common" | "more";
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
  meals: { id: FoodMeal; label: string; own: boolean; kcal: number; protein: number; carbs: number; fat: number; entries: FoodEntryView[] }[];
  recent: FoodOptionView[];
  saved: { id: number; name: string; kcal: number; count: number; names: string[] }[];
  previous: { date: string; dateLabel: string; meal: FoodMeal; mealLabel: string; kcal: number; names: string[] }[];
  /** Dates in the last month with anything logged, for the dots on the week strip. */
  loggedDays: string[];
};

const HUE = { protein: "#334EAC", carbs: "#D99A2B", fat: "#2E8B7A" } as const;
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const g = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
const G_PER_OZ = 28.349523125;
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
  const [namingMeal, setNamingMeal] = useState(false);
  // Which meal is being saved under a name.
  const [savingMeal, setSavingMeal] = useState<FoodMeal | null>(null);
  // Arranging: each meal shows up / down arrows; the order is saved as it changes.
  const [arranging, setArranging] = useState(false);
  const move = (id: FoodMeal, by: -1 | 1) => {
    const ids = diary.meals.map((m) => m.id);
    const i = ids.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setDiary({ ...diary, meals: ids.map((x) => diary.meals.find((m) => m.id === x)!) });
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("order", ids.join(","));
    startLoad(async () => {
      await reorderFoodMealsAction(fd);
    });
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
              <h1 className="fdi-date">{diary.dateLabel}</h1>
            </div>
            <div className="fdi-week">
              <button type="button" className="fdi-week-arrow" onClick={() => goTo(addDays(date, -1))} disabled={date <= floor} aria-label="Previous day">
                <ChevronLeftIcon />
              </button>
              {week.map((d, i) => {
                const future = d > today;
                const tooFar = d < floor;
                const on = d === date;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`fdi-day${on ? " on" : ""}${future || tooFar ? " off" : ""}`}
                    onClick={() => goTo(d)}
                    disabled={future || tooFar}
                    aria-pressed={on}
                    aria-label={d === today ? "Today" : d}
                  >
                    <span className="fdi-day-letter">{WEEKDAY[i]}</span>
                    <span className="fdi-day-num">{Number(d.slice(8))}</span>
                    <span className={`fdi-day-dot${on ? " on" : logged.has(d) ? " logged" : ""}`} aria-hidden="true" />
                  </button>
                );
              })}
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
              <div className={`fdi-push${same ? " done" : ""}`}>
                <span className="fdi-push-text">
                  {total === 0 ? (
                    "Nothing logged yet"
                  ) : same ? (
                    <>
                      <b>{n(total)} kcal</b> logged for {diary.dateLabel.toLowerCase()}
                    </>
                  ) : logged != null ? (
                    <>
                      <b>{n(total)} kcal</b> eaten · {n(logged)} logged
                    </>
                  ) : (
                    <>
                      <b>{n(total)} kcal</b> eaten {diary.dateLabel === "Today" ? "today" : diary.dateLabel}
                    </>
                  )}
                </span>
                {total > 0 && !same && (
                  <button type="button" className="fdi-push-btn" onClick={push} disabled={loading}>
                    {logged != null ? "Update log" : "Log calories"}
                  </button>
                )}
                {same && <span className="fdi-push-tick" aria-hidden="true">✓</span>}
              </div>
            );
          })()}

          <div className="nd-body fdi-list">
            <section className="fdi-meals">
              {diary.meals.map((meal) => {
                const open = panel?.meal === meal.id ? panel : null;
                return (
                  <div key={meal.id} className={`fdi-meal${open ? " open" : ""}`}>
                    <div className="fdi-meal-head">
                      <div className="fdi-meal-titles">
                        <span className="fdi-meal-title">{meal.label}</span>
                        <span className="fdi-meal-sub">{meal.entries.length === 0 ? "Nothing logged yet" : `${meal.entries.length} item${meal.entries.length === 1 ? "" : "s"}`}</span>
                      </div>
                      {arranging ? (
                        <span className="fdi-arrange">
                          <button type="button" className="fdi-arrange-btn up" onClick={() => move(meal.id, -1)} disabled={diary.meals[0]?.id === meal.id} aria-label={`Move ${meal.label} up`}>
                            <ChevronDownIcon />
                          </button>
                          <button type="button" className="fdi-arrange-btn" onClick={() => move(meal.id, 1)} disabled={diary.meals[diary.meals.length - 1]?.id === meal.id} aria-label={`Move ${meal.label} down`}>
                            <ChevronDownIcon />
                          </button>
                        </span>
                      ) : meal.entries.length > 0 ? (
                        <button type="button" className="fdi-meal-save" onClick={() => setSavingMeal(savingMeal === meal.id ? null : meal.id)}>
                          Save meal
                        </button>
                      ) : meal.own ? (
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
                          Remove
                        </button>
                      ) : null}
                    </div>
                    {meal.entries.length > 0 && (
                      <div className="fdi-per meal" aria-label={`${meal.label}: ${n(meal.kcal)} kcal`}>
                        <span className="fdi-per-cell">
                          <b>{n(meal.kcal)}</b>
                          <small>calories</small>
                        </span>
                        <span className="fdi-per-cell" style={{ color: HUE.protein }}>
                          <b>{g(meal.protein)}<i>g</i></b>
                          <small>protein</small>
                        </span>
                        <span className="fdi-per-cell" style={{ color: HUE.carbs }}>
                          <b>{g(meal.carbs)}<i>g</i></b>
                          <small>carbs</small>
                        </span>
                        <span className="fdi-per-cell" style={{ color: HUE.fat }}>
                          <b>{g(meal.fat)}<i>g</i></b>
                          <small>fat</small>
                        </span>
                      </div>
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
                    {meal.entries.map((e) =>
                      open?.kind === "amount" && open.entry?.id === e.id ? (
                        <AmountPanel
                          key={e.id}
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
                      ) : (
                        <button
                          key={e.id}
                          type="button"
                          className="fdi-row"
                          onClick={() =>
                            setPanel({
                              kind: "amount",
                              meal: meal.id,
                              entry: e,
                              food: { id: e.food_id, name: e.name, hint: "", group: "more", kcal: (e.kcal / e.grams) * 100, protein: (e.protein / e.grams) * 100, carbs: (e.carbs / e.grams) * 100, fat: (e.fat / e.grams) * 100, servings: [] },
                            })
                          }
                        >
                          <span className="fdi-row-main">
                            <span className="fdi-row-name">{e.name}</span>
                            <span className="fdi-row-amount">{amountLabel(e)}</span>
                          </span>
                          <span className="fdi-row-kcal">{n(e.kcal)} kcal</span>
                        </button>
                      ),
                    )}
                    {open?.kind === "search" ? (
                      <SearchPanel
                        clientId={clientId}
                        date={date}
                        meal={meal.id}
                        mealLabel={meal.label}
                        recent={diary.recent}
                        saved={diary.saved}
                        previous={diary.previous}
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
                    ) : (
                      <button type="button" className="fdi-add" onClick={() => setPanel({ kind: "search", meal: meal.id })}>
                        <span className="fdi-add-plus" aria-hidden="true">
                          <PlusIcon />
                        </span>
                        Add food
                      </button>
                    )}
                  </div>
                );
              })}
            </section>

            <div className="fdi-meal-tools">
              <button type="button" className="fdi-add-meal" onClick={() => setNamingMeal(true)}>
                <PlusIcon />
                Add a meal
              </button>
              <button type="button" className={`fdi-arrange-toggle${arranging ? " on" : ""}`} onClick={() => setArranging((a) => !a)}>
                {arranging ? "Done" : "Rearrange"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {namingMeal && (
        <NewMealDialog
          onCancel={() => setNamingMeal(false)}
          onAdd={(name) => {
            const fd = new FormData();
            fd.set("clientId", String(clientId));
            fd.set("name", name);
            setNamingMeal(false);
            startLoad(async () => {
              await addFoodMealAction(fd);
              const next = await getFoodDiaryAction(clientId, date);
              if (next) setDiary(next);
            });
          }}
        />
      )}
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
  return (
    <div className="nd-macro">
      <span className="nd-macro-bar" style={{ background: HUE[id] }} aria-hidden="true" />
      <div className="nd-macro-body">
        <div className="nd-macro-grams">
          {g(figure)}
          <small>g</small>
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

// ---- Naming a new meal -------------------------------------------------------

function NewMealDialog({ onCancel, onAdd }: { onCancel: () => void; onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);
  const clean = name.trim();
  return (
    <div className="fdi-dialog-scrim" role="presentation" onClick={onCancel}>
      <form
        className="fdi-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fdi-new-meal-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (clean) onAdd(clean);
        }}
      >
        <div>
          <div className="fdi-eyebrow">New meal</div>
          <h2 id="fdi-new-meal-title" className="fdi-dialog-title">
            Name this meal
          </h2>
        </div>
        <input
          ref={inputRef}
          id="fdi-new-meal-name"
          className="fdi-dialog-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pre-workout"
          maxLength={30}
          autoComplete="off"
          aria-label="Meal name"
        />
        <div className="fdi-dialog-actions">
          <button type="button" className="fdi-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="fdi-primary" disabled={!clean}>
            Add meal
          </button>
        </div>
      </form>
    </div>
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
  previous,
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
  previous: FoodDiaryProps["previous"];
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
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);
  const q = query.trim();
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
  const copy = (p: FoodDiaryProps["previous"][number]) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("fromDate", p.date);
    fd.set("fromMeal", p.meal);
    fd.set("toDate", date);
    fd.set("toMeal", meal);
    startCopy(async () => {
      await copyFoodMealAction(fd);
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
      {(previous.length > 0 || saved.length > 0) && (
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
          <label className="fdi-search">
            <SearchIcon />
            <input ref={inputRef} id={`fdi-search-${meal}`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What did you eat?" autoComplete="off" aria-label="Search foods" />
          </label>
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
            {results == null && recent.length === 0 && !active && <p className="fdi-empty">Try “chicken breast”, “oats”, “banana”.</p>}
          </div>
          <button type="button" className="fdi-link" onClick={onCustom}>
            Can’t find it? Add your own food
          </button>
        </>
      ) : (
        <div className="fdi-results">
          {saved.length > 0 && <span className="fdi-results-label">Saved meals</span>}
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
              <button type="button" className="fdi-result-x" onClick={() => forget(s)} disabled={copying} aria-label={`Delete saved meal ${s.name}`}>
                ×
              </button>
            </div>
          ))}
          {previous.length > 0 && <span className="fdi-results-label">Other days</span>}
          {previous.map((p) => (
            <button key={`${p.date}|${p.meal}`} type="button" className="fdi-result" onClick={() => copy(p)} disabled={copying}>
              <span className="fdi-result-main">
                <span className="fdi-result-name">
                  {p.dateLabel} · {p.mealLabel}
                </span>
                <span className="fdi-result-hint">{p.names.join(", ")}</span>
              </span>
              <span className="fdi-result-kcal">
                {n(p.kcal)} <small>calories</small>
              </span>
            </button>
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
  // A number and a unit. The unit list is grams, ounces, and the food's own
  // portions ("cup", "large"), each worth so many grams; what is saved is
  // number × unit, in grams, with the unit's name when it is a portion.
  const units: { id: string; label: string; grams: number; portion: boolean }[] = [
    { id: "g", label: "g", grams: 1, portion: false },
    { id: "oz", label: "oz", grams: G_PER_OZ, portion: false },
    ...food.servings.map(([label, grams]) => ({ id: `p:${label}`, label, grams, portion: true })),
  ];
  const startUnit = entry
    ? units.find((u) => u.portion && entry.serving?.endsWith(u.label))?.id ?? "g"
    : food.servings.length
    ? `p:${food.servings[0][0]}`
    : "g";
  const [unitId, setUnitId] = useState(startUnit);
  const unit = units.find((u) => u.id === unitId) ?? units[0];
  const startAmount = entry ? (unit.portion ? entry.grams / unit.grams : entry.grams) : unit.portion ? 1 : 100;
  const [amountText, setAmountText] = useState(g(startAmount));
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.select(), 50);
    return () => clearTimeout(t);
  }, []);

  const amount = Number(amountText.replace(",", ".")) || 0;
  const grams = amount * unit.grams;
  const k = grams / 100;
  const preview = { kcal: food.kcal * k, protein: food.protein * k, carbs: food.carbs * k, fat: food.fat * k };
  const servingLabel = unit.portion ? `${amount === 1 ? "" : `${g(amount)} × `}${unit.label}` : unit.id === "oz" ? `${g(amount)} oz` : null;
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
      <div className="fdi-panel-head">
        <span className="fdi-eyebrow">{entry ? "Change amount" : `Add to ${mealLabel}`}</span>
        <button type="button" className="fdi-panel-cancel" onClick={onCancel}>
          {entry ? "Cancel" : "Back"}
        </button>
      </div>
      <div className="fdi-food">
        <span className="fdi-food-name">{food.name}</span>
        <span className="fdi-field-label">Per 100 g</span>
        <div className="fdi-per">
          <span className="fdi-per-cell">
            <b>{n(food.kcal)}</b>
            <small>kcal</small>
          </span>
          <span className="fdi-per-cell" style={{ color: HUE.protein }}>
            <b>{g(food.protein)}<i>g</i></b>
            <small>protein</small>
          </span>
          <span className="fdi-per-cell" style={{ color: HUE.carbs }}>
            <b>{g(food.carbs)}<i>g</i></b>
            <small>carbs</small>
          </span>
          <span className="fdi-per-cell" style={{ color: HUE.fat }}>
            <b>{g(food.fat)}<i>g</i></b>
            <small>fat</small>
          </span>
        </div>
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
        <label className="fdi-unit">
          <span className="fdi-field-label">Unit</span>
          <select id={`fdi-unit-${meal}-${entry?.id ?? "new"}`} value={unitId} onChange={(e) => changeUnit(e.target.value)} aria-label="Unit">
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.portion ? `${u.label} (${g(u.grams)} g)` : u.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="fdi-preview">
        <span className="fdi-preview-kcal">
          <b>{n(preview.kcal)}</b> kcal
        </span>
        <span className="fdi-preview-macros">
          P {g(preview.protein)} · C {g(preview.carbs)} · F {g(preview.fat)}
          {unit.id !== "g" && grams > 0 ? ` · ${g(grams)} g` : ""}
        </span>
      </div>

      <div className="fdi-panel-actions">
        {entry && (
          <button type="button" className="fdi-remove" onClick={remove} disabled={pending}>
            Remove
          </button>
        )}
        <button type="button" className="fdi-primary" onClick={save} disabled={!ok}>
          {pending ? "Saving…" : entry ? "Save" : `Add to ${mealLabel}`}
        </button>
      </div>
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
