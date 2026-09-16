"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeftIcon, PlusIcon, SearchIcon } from "../components/icons";
import {
  addCustomFoodAction,
  addFoodEntryAction,
  addFoodMealAction,
  copyFoodMealAction,
  getFoodDiaryAction,
  removeFoodEntryAction,
  removeFoodMealAction,
  searchFoodsAction,
  updateFoodEntryAction,
} from "../lib/actions";
import { useTween } from "./NutritionTargetsCard";

// The client's food diary, opened from the ring on Nutrition. On the client
// page model: the top bar (a back arrow in place of the burger) floating
// over a banner with the day and a week strip, the targets card pulled up
// over the banner (the ring of what is left, the three macros, the day's
// standing), then the meals in one card. A day at a time: the strip, its
// arrows or a sideways swipe move a day, never past today; other days are
// read through the action, and the day is re-read after every change. Add
// food opens a sheet: search the catalog (the client's own foods first),
// pick one, say how much, or copy a whole meal from another day. A row
// opens the same sheet to change the amount or take it out. Meals can be
// added beside the four standard ones, in a dialog. The day's kcal is
// mirrored into the calorie log the coach reads.
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
  meals: { id: FoodMeal; label: string; own: boolean; kcal: number; entries: FoodEntryView[] }[];
  recent: FoodOptionView[];
  previous: { date: string; dateLabel: string; meal: FoodMeal; mealLabel: string; kcal: number; names: string[] }[];
  /** Dates in the last month with anything logged, for the dots on the week strip. */
  loggedDays: string[];
};

const HUE = { protein: "#334EAC", carbs: "#D99A2B", fat: "#2E8B7A" } as const;
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const g = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
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
const MEAL_IDEAS = ["Pre-workout", "Post-workout", "Second breakfast", "Late snack", "Shake"];

type Sheet =
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
    load(d);
  };
  const reload = () => load(date);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [namingMeal, setNamingMeal] = useState(false);
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

  const mealLabel = (id: FoodMeal) => diary.meals.find((m) => m.id === id)?.label ?? "";
  const logged = new Set(diary.loggedDays);
  const week = weekOf(date);

  return (
    <div className="fd-screen app-layer-main">
      <header className={`app-header dark overlay${scrolled ? "" : " clear"}`}>
        <button type="button" className="app-header-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <span className="app-header-brand">Ironline</span>
        <div className="app-header-actions">
          <span className="app-header-icon-btn fd-bar-spacer" aria-hidden="true" />
        </div>
      </header>

      <main
        className={`app-content dark${loading ? " fd-loading" : ""}`}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
        onPointerDown={(e) => {
          swipeStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => onSwipeEnd(e.clientX, e.clientY)}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        <div className="fd-page">
          <header className="nd-banner fd-banner">
            <div className="fd-banner-titles">
              <div className="fd-eyebrow">Food diary</div>
              <h1 className="fd-date">{diary.dateLabel}</h1>
            </div>
            <div className="fd-week">
              <button type="button" className="fd-week-arrow" onClick={() => goTo(addDays(date, -1))} disabled={date <= floor} aria-label="Previous day">
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
                    className={`fd-day${on ? " on" : ""}${future || tooFar ? " off" : ""}`}
                    onClick={() => goTo(d)}
                    disabled={future || tooFar}
                    aria-pressed={on}
                    aria-label={d === today ? "Today" : d}
                  >
                    <span className="fd-day-letter">{WEEKDAY[i]}</span>
                    <span className="fd-day-num">{Number(d.slice(8))}</span>
                    <span className={`fd-day-dot${on ? " on" : logged.has(d) ? " logged" : ""}`} aria-hidden="true" />
                  </button>
                );
              })}
              <button type="button" className="fd-week-arrow next" onClick={() => goTo(addDays(date, 1))} disabled={date >= today} aria-label="Next day">
                <ChevronLeftIcon />
              </button>
            </div>
          </header>

          <Targets target={diary.target} eaten={diary.eaten} />

          <div className="nd-body fd-list">
            <section className="fd-meals">
              {diary.meals.map((meal) => (
                <div key={meal.id} className="fd-meal">
                  <div className="fd-meal-head">
                    <div className="fd-meal-titles">
                      <span className="fd-meal-title">{meal.label}</span>
                      <span className="fd-meal-sub">{meal.entries.length === 0 ? "Nothing logged yet" : `${meal.entries.length} item${meal.entries.length === 1 ? "" : "s"}`}</span>
                    </div>
                    {meal.entries.length > 0 ? (
                      <span className="fd-pill">{n(meal.kcal)} kcal</span>
                    ) : meal.own ? (
                      <button
                        type="button"
                        className="fd-meal-remove"
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
                    ) : (
                      <span className="fd-pill empty">Empty</span>
                    )}
                  </div>
                  {meal.entries.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="fd-row"
                      onClick={() =>
                        setSheet({
                          kind: "amount",
                          meal: meal.id,
                          entry: e,
                          food: { id: e.food_id, name: e.name, hint: "", group: "more", kcal: (e.kcal / e.grams) * 100, protein: (e.protein / e.grams) * 100, carbs: (e.carbs / e.grams) * 100, fat: (e.fat / e.grams) * 100, servings: [] },
                        })
                      }
                    >
                      <span className="fd-row-main">
                        <span className="fd-row-name">{e.name}</span>
                        <span className="fd-row-amount">{amountLabel(e)}</span>
                      </span>
                      <span className="fd-row-kcal">{n(e.kcal)} kcal</span>
                    </button>
                  ))}
                  <button type="button" className="fd-add" onClick={() => setSheet({ kind: "search", meal: meal.id })}>
                    <span className="fd-add-plus" aria-hidden="true">
                      <PlusIcon />
                    </span>
                    Add food
                  </button>
                </div>
              ))}
            </section>

            <button type="button" className="fd-add-meal" onClick={() => setNamingMeal(true)}>
              <PlusIcon />
              Add a meal
            </button>
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

      {sheet && (
        <div className="fd-scrim" role="presentation" onClick={() => setSheet(null)}>
          <div className="fd-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {sheet.kind === "search" ? (
              <SearchSheet
                clientId={clientId}
                date={date}
                meal={sheet.meal}
                mealLabel={mealLabel(sheet.meal)}
                recent={diary.recent}
                previous={diary.previous}
                onPick={(food) => setSheet({ kind: "amount", meal: sheet.meal, food })}
                onCustom={() => setSheet({ kind: "custom", meal: sheet.meal })}
                onCopied={() => {
                  setSheet(null);
                  reload();
                }}
                onClose={() => setSheet(null)}
              />
            ) : sheet.kind === "amount" ? (
              <AmountSheet
                clientId={clientId}
                date={date}
                meal={sheet.meal}
                mealLabel={mealLabel(sheet.meal)}
                food={sheet.food}
                entry={sheet.entry}
                onDone={() => {
                  setSheet(null);
                  reload();
                }}
                onBack={sheet.entry ? undefined : () => setSheet({ kind: "search", meal: sheet.meal })}
              />
            ) : (
              <CustomFoodSheet
                clientId={clientId}
                onBack={() => setSheet({ kind: "search", meal: sheet.meal })}
                onCreated={(food) => setSheet({ kind: "amount", meal: sheet.meal, food })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- The targets card -------------------------------------------------------
// Pulled up over the banner: a ring that fills as the day is eaten with the
// kcal left counting inside it, the three macros beside it, and under a
// hairline how the day stands. Figures run to their new values.

const RING = 104;
const RING_R = 46;
const RING_STROKE = 8;

function Targets({ target, eaten }: { target: Macros | null; eaten: Macros }) {
  const left = target ? target.kcal - eaten.kcal : null;
  const share = target && target.kcal > 0 ? Math.min(1, eaten.kcal / target.kcal) : 0;
  const circumference = 2 * Math.PI * RING_R;
  const fill = useTween(share * circumference);
  const figure = useTween(left == null ? eaten.kcal : Math.max(0, left));
  const ratio = target && target.kcal > 0 ? eaten.kcal / target.kcal : 0;
  const standing =
    left == null
      ? null
      : left < 0
      ? { tone: "warn", text: `${n(-left)} over` }
      : ratio >= 0.9
      ? { tone: "good", text: "On target" }
      : { tone: "", text: `${n(left)} to go` };
  return (
    <section className="fd-targets">
      <div className="fd-targets-row">
        <div className="fd-ring" role="img" aria-label={left == null ? `${n(eaten.kcal)} kcal eaten` : left < 0 ? `${n(-left)} kcal over` : `${n(left)} kcal left`}>
          <svg viewBox={`0 0 ${RING} ${RING}`} aria-hidden="true">
            <g transform={`rotate(-90 ${RING / 2} ${RING / 2})`}>
              <circle cx={RING / 2} cy={RING / 2} r={RING_R} fill="none" stroke="#e6ecf3" strokeWidth={RING_STROKE} />
              <circle cx={RING / 2} cy={RING / 2} r={RING_R} fill="none" stroke="#1e3a6e" strokeWidth={RING_STROKE} strokeLinecap="round" strokeDasharray={`${fill} ${circumference}`} />
            </g>
          </svg>
          <div className="fd-ring-center">
            <span className="fd-ring-figure">{n(figure)}</span>
            <span className="fd-ring-label">{left == null ? "eaten" : "left"}</span>
          </div>
        </div>
        <div className="fd-macros">
          {(["protein", "carbs", "fat"] as const).map((m) => (
            <MacroLine key={m} id={m} eaten={eaten[m]} goal={target?.[m] ?? null} />
          ))}
        </div>
      </div>
      {target && standing && (
        <div className="fd-targets-foot">
          <span className="fd-targets-eaten">
            {n(eaten.kcal)} / {n(target.kcal)} kcal eaten
          </span>
          <span className={`fd-pill${standing.tone ? ` ${standing.tone}` : ""}`}>{standing.text}</span>
        </div>
      )}
    </section>
  );
}

function MacroLine({ id, eaten, goal }: { id: "protein" | "carbs" | "fat"; eaten: number; goal: number | null }) {
  const share = goal && goal > 0 ? Math.min(1, eaten / goal) : 0;
  const figure = useTween(eaten);
  return (
    <div className="fd-macro">
      <div className="fd-macro-line">
        <span className="fd-eyebrow">{id === "protein" ? "Protein" : id === "carbs" ? "Carbs" : "Fat"}</span>
        <span className="fd-macro-figure">
          {g(figure)}
          <small>{goal != null ? ` / ${n(goal)} g` : " g"}</small>
        </span>
      </div>
      <span className="fd-macro-bar" aria-hidden="true">
        <span style={{ width: `${share * 100}%`, background: HUE[id] }} />
      </span>
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
    <div className="fd-dialog-scrim" role="presentation" onClick={onCancel}>
      <form
        className="fd-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fd-new-meal-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (clean) onAdd(clean);
        }}
      >
        <div>
          <div className="fd-eyebrow">New meal</div>
          <h2 id="fd-new-meal-title" className="fd-dialog-title">
            Name this meal
          </h2>
        </div>
        <input
          ref={inputRef}
          id="fd-new-meal-name"
          className="fd-dialog-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pre-workout"
          maxLength={30}
          autoComplete="off"
          aria-label="Meal name"
        />
        <div className="fd-chips">
          {MEAL_IDEAS.map((idea) => (
            <button key={idea} type="button" className={`fd-chip${clean === idea ? " on" : ""}`} onClick={() => setName(idea)}>
              {idea}
            </button>
          ))}
        </div>
        <div className="fd-dialog-actions">
          <button type="button" className="fd-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="fd-primary" disabled={!clean}>
            Add meal
          </button>
        </div>
      </form>
    </div>
  );
}

// ---- Search, or copy a meal --------------------------------------------------

function SearchSheet({
  clientId,
  date,
  meal,
  mealLabel,
  recent,
  previous,
  onPick,
  onCustom,
  onCopied,
  onClose,
}: {
  clientId: number;
  date: string;
  meal: FoodMeal;
  mealLabel: string;
  recent: FoodOptionView[];
  previous: FoodDiaryProps["previous"];
  onPick: (food: FoodOptionView) => void;
  onCustom: () => void;
  onCopied: () => void;
  onClose: () => void;
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
    <>
      <div className="fd-sheet-head">
        <span />
        <span className="fd-sheet-title">Add to {mealLabel}</span>
        <button type="button" className="fd-sheet-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {previous.length > 0 && (
        <div className="fd-modes" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "search"} className={`fd-mode${mode === "search" ? " on" : ""}`} onClick={() => setMode("search")}>
            Search
          </button>
          <button type="button" role="tab" aria-selected={mode === "copy"} className={`fd-mode${mode === "copy" ? " on" : ""}`} onClick={() => setMode("copy")}>
            Copy a meal
          </button>
        </div>
      )}
      {mode === "search" ? (
        <>
          <label className="fd-search">
            <SearchIcon />
            <input
              ref={inputRef}
              id="fd-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods"
              autoComplete="off"
              aria-label="Search foods"
            />
          </label>
          <div className="fd-results">
            {showingRecent && <span className="fd-results-label">Recent</span>}
            {list.map((f) => (
              <button key={f.id} type="button" className="fd-result" onClick={() => onPick(f)}>
                <span className="fd-result-main">
                  <span className="fd-result-name">{f.name}</span>
                  <span className="fd-result-hint">{f.hint || " "}</span>
                </span>
                <span className="fd-result-kcal">
                  {n(f.kcal)} <small>kcal / 100 g</small>
                </span>
              </button>
            ))}
            {front.length > 0 && tail.length > 0 && !showMore && (
              <button type="button" className="fd-more" onClick={() => setMoreFor(q)}>
                Show {tail.length} more from the catalogue
              </button>
            )}
            {results != null && results.length === 0 && !searching && <p className="fd-empty">Nothing called “{q}”.</p>}
            {results == null && recent.length === 0 && !active && <p className="fd-empty">Type what you ate: “chicken breast”, “oats”, “banana”.</p>}
          </div>
          <button type="button" className="fd-link" onClick={onCustom}>
            Can’t find it? Add your own food
          </button>
        </>
      ) : (
        <div className="fd-results">
          <p className="fd-hint">A whole meal from another day, the same foods and amounts, into {mealLabel}.</p>
          {previous.map((p) => (
            <button key={`${p.date}|${p.meal}`} type="button" className="fd-result" onClick={() => copy(p)} disabled={copying}>
              <span className="fd-result-main">
                <span className="fd-result-name">
                  {p.dateLabel} · {p.mealLabel}
                </span>
                <span className="fd-result-hint">{p.names.join(", ")}</span>
              </span>
              <span className="fd-result-kcal">
                {n(p.kcal)} <small>kcal</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ---- Amount ---------------------------------------------------------------

function AmountSheet({
  clientId,
  date,
  meal,
  mealLabel,
  food,
  entry,
  onDone,
  onBack,
}: {
  clientId: number;
  date: string;
  meal: FoodMeal;
  mealLabel: string;
  food: FoodOptionView;
  entry?: FoodEntryView;
  onDone: () => void;
  onBack?: () => void;
}) {
  // A serving picked, or grams typed; the last touched wins.
  const [serving, setServing] = useState<string | null>(entry?.serving ?? (food.servings[0]?.[0] ?? null));
  const [count, setCount] = useState(1);
  const [gramsText, setGramsText] = useState(entry ? g(entry.grams) : food.servings[0] ? "" : "100");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!food.servings.length) setTimeout(() => inputRef.current?.select(), 50);
  }, [food.servings.length]);

  const servingGrams = serving ? food.servings.find((s) => s[0] === serving)?.[1] ?? null : null;
  const grams = serving && servingGrams ? servingGrams * count : Number(gramsText.replace(",", ".")) || 0;
  const k = grams / 100;
  const preview = { kcal: food.kcal * k, protein: food.protein * k, carbs: food.carbs * k, fat: food.fat * k };
  const servingLabel = serving && servingGrams ? `${count === 1 ? "" : `${g(count)} × `}${serving}` : null;
  const ok = grams > 0 && grams <= 5000 && !pending;

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
    <>
      <div className="fd-sheet-head">
        {onBack ? (
          <button type="button" className="fd-sheet-back" onClick={onBack} aria-label="Back to search">
            <ChevronLeftIcon />
          </button>
        ) : (
          <span />
        )}
        <span className="fd-sheet-title">{entry ? "Change amount" : `Add to ${mealLabel}`}</span>
        <button type="button" className="fd-sheet-x" onClick={onDone} aria-label="Close">
          ×
        </button>
      </div>
      <div className="fd-food">
        <span className="fd-food-name">{food.name}</span>
        <span className="fd-food-per">
          {n(food.kcal)} kcal · P {g(food.protein)} · C {g(food.carbs)} · F {g(food.fat)} per 100 g
        </span>
      </div>

      {food.servings.length > 0 && (
        <div className="fd-chips" role="radiogroup" aria-label="Serving">
          {food.servings.map(([label, grams]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={serving === label}
              className={`fd-chip${serving === label ? " on" : ""}`}
              onClick={() => {
                setServing(label);
                setGramsText("");
              }}
            >
              {label} <small>{g(grams)} g</small>
            </button>
          ))}
        </div>
      )}

      <div className="fd-amount-row">
        {serving && servingGrams ? (
          <div className="fd-count">
            <button type="button" onClick={() => setCount((c) => Math.max(0.5, c - 0.5))} aria-label="Less">
              −
            </button>
            <span>
              {g(count)} × {serving}
            </span>
            <button type="button" onClick={() => setCount((c) => Math.min(20, c + 0.5))} aria-label="More">
              +
            </button>
          </div>
        ) : null}
        <label className={`fd-grams${serving ? " secondary" : ""}`}>
          <input
            ref={inputRef}
            id="fd-grams-input"
            type="text"
            inputMode="decimal"
            value={gramsText}
            onFocus={() => {
              setServing(null);
              if (!gramsText) setGramsText(grams ? g(grams) : "100");
            }}
            onChange={(e) => setGramsText(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder={serving ? g(grams) : "0"}
            aria-label="Grams"
          />
          <span>g</span>
        </label>
      </div>

      <div className="fd-preview">
        <span className="fd-preview-kcal">
          <b>{n(preview.kcal)}</b> kcal
        </span>
        <span className="fd-preview-macros">
          P {g(preview.protein)} · C {g(preview.carbs)} · F {g(preview.fat)}
        </span>
      </div>

      <button type="button" className="fd-primary" onClick={save} disabled={!ok}>
        {pending ? "Saving…" : entry ? "Save" : `Add to ${mealLabel}`}
      </button>
      {entry && (
        <button type="button" className="fd-remove" onClick={remove} disabled={pending}>
          Remove from {mealLabel}
        </button>
      )}
    </>
  );
}

// ---- Custom food ----------------------------------------------------------

function CustomFoodSheet({ clientId, onBack, onCreated }: { clientId: number; onBack: () => void; onCreated: (food: FoodOptionView) => void }) {
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
    <>
      <div className="fd-sheet-head">
        <button type="button" className="fd-sheet-back" onClick={onBack} aria-label="Back to search">
          <ChevronLeftIcon />
        </button>
        <span className="fd-sheet-title">Your own food</span>
        <span />
      </div>
      <p className="fd-hint">Per 100 g, off the label. Only you can find it.</p>
      <div className="fd-form">
        <label className="fd-field wide">
          <span>Name</span>
          <input id="fd-custom-name" type="text" value={form.name} onChange={set("name")} placeholder="Mum’s lasagne" maxLength={80} autoFocus />
        </label>
        <label className="fd-field">
          <span>kcal</span>
          <input id="fd-custom-kcal" type="text" inputMode="decimal" value={form.kcal} onChange={set("kcal")} placeholder="0" />
        </label>
        <label className="fd-field">
          <span>Protein g</span>
          <input id="fd-custom-protein" type="text" inputMode="decimal" value={form.protein} onChange={set("protein")} placeholder="0" />
        </label>
        <label className="fd-field">
          <span>Carbs g</span>
          <input id="fd-custom-carbs" type="text" inputMode="decimal" value={form.carbs} onChange={set("carbs")} placeholder="0" />
        </label>
        <label className="fd-field">
          <span>Fat g</span>
          <input id="fd-custom-fat" type="text" inputMode="decimal" value={form.fat} onChange={set("fat")} placeholder="0" />
        </label>
        <label className="fd-field">
          <span>Serving (optional)</span>
          <input id="fd-custom-serving" type="text" value={form.servingLabel} onChange={set("servingLabel")} placeholder="1 portion" maxLength={40} />
        </label>
        <label className="fd-field">
          <span>Serving grams</span>
          <input id="fd-custom-serving-grams" type="text" inputMode="decimal" value={form.servingGrams} onChange={set("servingGrams")} placeholder="250" />
        </label>
      </div>
      <button type="button" className="fd-primary" onClick={submit} disabled={!ok}>
        {pending ? "Saving…" : "Save and add"}
      </button>
    </>
  );
}
