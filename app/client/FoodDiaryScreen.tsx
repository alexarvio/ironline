"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeftIcon, PlusIcon, SearchIcon } from "../components/icons";
import { addCustomFoodAction, addFoodEntryAction, removeFoodEntryAction, searchFoodsAction, updateFoodEntryAction } from "../lib/actions";

// The client's food diary for today, opened from the ring on Nutrition: what
// is left of the day's calories and macros at the top, then the four meals.
// Add food opens a sheet: search the catalog (the client's own foods first),
// pick one, say how much (a serving or grams), and it lands in the meal. A
// row opens the same sheet to change the amount or take it out. Every
// change is saved as it happens; the day's kcal is mirrored into the calorie
// log the coach reads.
export type FoodMeal = "breakfast" | "lunch" | "dinner" | "snacks";
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
  meals: { id: FoodMeal; label: string; kcal: number; entries: FoodEntryView[] }[];
  recent: FoodOptionView[];
};

const HUE = { protein: "#334EAC", carbs: "#D99A2B", fat: "#2E8B7A" } as const;
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const g = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
const amountLabel = (e: { grams: number; serving: string | null }) => (e.serving ? `${e.serving} · ${g(e.grams)} g` : `${g(e.grams)} g`);

type Sheet =
  | { kind: "search"; meal: FoodMeal }
  | { kind: "amount"; meal: FoodMeal; food: FoodOptionView; entry?: FoodEntryView }
  | { kind: "custom"; meal: FoodMeal };

export default function FoodDiaryScreen({ clientId, diary, onBack }: { clientId: number; diary: FoodDiaryProps; onBack: () => void }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const { target, eaten } = diary;
  const left = target ? target.kcal - eaten.kcal : null;
  const pct = target && target.kcal > 0 ? Math.min(1, eaten.kcal / target.kcal) : 0;

  return (
    <div className="fd-screen">
      <header className="cn-header">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">Food diary</h1>
          <span className="fd-header-sub">{diary.dateLabel}</span>
        </div>
        <span className="cn-icon-spacer" aria-hidden="true" />
      </header>

      <main className="fd-body">
        {/* What is left of the day. */}
        <section className="nd-card fd-summary">
          <div className="fd-summary-top">
            <div className="fd-summary-main">
              <span className={`fd-summary-figure${left != null && left < 0 ? " over" : ""}`}>{left == null ? n(eaten.kcal) : n(Math.abs(left))}</span>
              <span className="fd-summary-label">{left == null ? "kcal eaten" : left < 0 ? "kcal over" : "kcal left"}</span>
            </div>
            {target && (
              <div className="fd-summary-side">
                <span>
                  <b>{n(eaten.kcal)}</b> eaten
                </span>
                <span>
                  <b>{n(target.kcal)}</b> target
                </span>
              </div>
            )}
          </div>
          {target && (
            <div className="fd-bar" aria-hidden="true">
              <span className={`fd-bar-fill${left != null && left < 0 ? " over" : ""}`} style={{ width: `${pct * 100}%` }} />
            </div>
          )}
          <div className="fd-macros">
            {(["protein", "carbs", "fat"] as const).map((m) => {
              const goal = target?.[m] ?? null;
              const share = goal && goal > 0 ? Math.min(1, eaten[m] / goal) : 0;
              return (
                <div key={m} className="fd-macro">
                  <span className="fd-macro-name">{m === "protein" ? "Protein" : m === "carbs" ? "Carbs" : "Fat"}</span>
                  <span className="fd-macro-figure">
                    <b>{g(eaten[m])}</b>
                    {goal != null && <small> / {n(goal)} g</small>}
                    {goal == null && <small> g</small>}
                  </span>
                  {goal != null && (
                    <span className="fd-macro-bar" aria-hidden="true">
                      <span style={{ width: `${share * 100}%`, background: HUE[m] }} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {diary.meals.map((meal) => (
          <section key={meal.id} className="nd-card fd-meal">
            <div className="fd-meal-head">
              <h2 className="fd-meal-title">{meal.label}</h2>
              {meal.entries.length > 0 && <span className="fd-meal-kcal">{n(meal.kcal)} kcal</span>}
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
                    food: { id: e.food_id, name: e.name, hint: "", kcal: (e.kcal / e.grams) * 100, protein: (e.protein / e.grams) * 100, carbs: (e.carbs / e.grams) * 100, fat: (e.fat / e.grams) * 100, servings: [] },
                  })
                }
              >
                <span className="fd-row-main">
                  <span className="fd-row-name">{e.name}</span>
                  <span className="fd-row-amount">{amountLabel(e)}</span>
                </span>
                <span className="fd-row-kcal">{n(e.kcal)}</span>
              </button>
            ))}
            <button type="button" className="fd-add" onClick={() => setSheet({ kind: "search", meal: meal.id })}>
              <PlusIcon />
              Add food
            </button>
          </section>
        ))}
      </main>

      {sheet && (
        <div className="fd-scrim" role="presentation" onClick={() => setSheet(null)}>
          <div className="fd-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {sheet.kind === "search" ? (
              <SearchSheet
                clientId={clientId}
                meal={sheet.meal}
                mealLabel={diary.meals.find((m) => m.id === sheet.meal)?.label ?? ""}
                recent={diary.recent}
                onPick={(food) => setSheet({ kind: "amount", meal: sheet.meal, food })}
                onCustom={() => setSheet({ kind: "custom", meal: sheet.meal })}
                onClose={() => setSheet(null)}
              />
            ) : sheet.kind === "amount" ? (
              <AmountSheet
                clientId={clientId}
                date={diary.date}
                meal={sheet.meal}
                mealLabel={diary.meals.find((m) => m.id === sheet.meal)?.label ?? ""}
                food={sheet.food}
                entry={sheet.entry}
                onDone={() => setSheet(null)}
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

// ---- Search ---------------------------------------------------------------

function SearchSheet({
  clientId,
  mealLabel,
  recent,
  onPick,
  onCustom,
  onClose,
}: {
  clientId: number;
  meal: FoodMeal;
  mealLabel: string;
  recent: FoodOptionView[];
  onPick: (food: FoodOptionView) => void;
  onCustom: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodOptionView[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);
  // Search a beat after the last keystroke; the latest query wins.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    let live = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const rows = await searchFoodsAction(clientId, q);
      if (!live) return;
      setResults(rows);
      setSearching(false);
    }, 220);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, clientId]);

  const list = results ?? recent;
  const showingRecent = results == null && recent.length > 0;
  return (
    <>
      <div className="fd-sheet-head">
        <span className="fd-sheet-title">Add to {mealLabel}</span>
        <button type="button" className="fd-sheet-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <label className="fd-search">
        <SearchIcon />
        <input
          ref={inputRef}
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
        {results != null && results.length === 0 && !searching && <p className="fd-empty">Nothing called “{query.trim()}”.</p>}
        {results == null && recent.length === 0 && query.trim().length < 2 && <p className="fd-empty">Type what you ate: “chicken breast”, “oats”, “banana”.</p>}
      </div>
      <button type="button" className="fd-link" onClick={onCustom}>
        Can’t find it? Add your own food
      </button>
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
  const servingLabel = serving && servingGrams ? `${count === 1 ? "" : `${count} × `}${serving}` : null;
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
        <div className="fd-servings" role="radiogroup" aria-label="Serving">
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
          <input type="text" value={form.name} onChange={set("name")} placeholder="Mum’s lasagne" maxLength={80} autoFocus />
        </label>
        <label className="fd-field">
          <span>kcal</span>
          <input type="text" inputMode="decimal" value={form.kcal} onChange={set("kcal")} placeholder="0" />
        </label>
        <label className="fd-field">
          <span>Protein g</span>
          <input type="text" inputMode="decimal" value={form.protein} onChange={set("protein")} placeholder="0" />
        </label>
        <label className="fd-field">
          <span>Carbs g</span>
          <input type="text" inputMode="decimal" value={form.carbs} onChange={set("carbs")} placeholder="0" />
        </label>
        <label className="fd-field">
          <span>Fat g</span>
          <input type="text" inputMode="decimal" value={form.fat} onChange={set("fat")} placeholder="0" />
        </label>
        <label className="fd-field">
          <span>Serving (optional)</span>
          <input type="text" value={form.servingLabel} onChange={set("servingLabel")} placeholder="1 portion" maxLength={40} />
        </label>
        <label className="fd-field">
          <span>Serving grams</span>
          <input type="text" inputMode="decimal" value={form.servingGrams} onChange={set("servingGrams")} placeholder="250" />
        </label>
      </div>
      <button type="button" className="fd-primary" onClick={submit} disabled={!ok}>
        {pending ? "Saving…" : "Save and add"}
      </button>
    </>
  );
}
