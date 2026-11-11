"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import AddMealSheet, { CopyMealDialog, DeleteMealDialog } from "./AddMealSheet";
import { createPortal, flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { NorCoachLogo } from "../components/NorCoachLogo";
import { BookmarkIcon, CameraIcon, ChevronDownIcon, ChevronLeftIcon, CopyIcon, MoreIcon, PlusIcon, SearchIcon } from "../components/icons";
import { newOnceKey } from "../lib/onceKey";
import {
  addCustomFoodAction,
  addFoodEntryAction,
  updateSavedMealFromSlotAction,
  addFoodMealAction,
  addSavedDayAction,
  addSavedMealAction,
  addSavedMealCardAction,
  deleteSavedDayAction,
  createSavedMealCardAction,
  createSavedDayAction,
  renameSavedDayAction,
  changeSavedDayCardAction,
  uploadSavedDayPictureAction,
  changeSavedMealFoodAction,
  renameSavedMealAction,
  uploadSavedMealPictureAction,
  removeSavedMealPictureAction,
  saveDayAction,
  deleteSavedMealAction,
  saveMealAction,
  getFoodDiaryAction,
  lookupBarcodeAction,
  searchPackagedAction,
  removeFoodEntryAction,
  removeFoodMealAction,
  removeMealPhotoAction,
  uploadMealPhotoAction,
  renameFoodMealAction,
  reorderFoodMealsAction,
  searchFoodsAction,
  setFoodDayTypeAction,
  updateFoodEntryAction,
} from "../lib/actions";
import { useTween } from "./NutritionTargetsCard";
import BarcodeScanner from "./BarcodeScanner";
import PictureCycle from "./PictureCycle";
import { landOn } from "../lib/landOn";
import { dayWords, weekdayWords } from "../lib/clientDates";
import { Bars } from "./Bars";
import CoachSays from "./CoachSays";
import { pic } from "../lib/pic";
import "./food-cards.css";

// The client's food diary, opened from the ring on Nutrition. On the client
// page model: the top bar (a back arrow in place of the burger) floating
// over a banner with the day, a week strip and the Training day / Rest day
// choice that decides the targets; the Nutrition card's rings pulled up over
// the banner, filling as the day is eaten with the kcal left inside; then
// the meals, a photo card each with its foods folding out under it. A day at a time: the strip, its arrows or a
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
  /** A liquid's grams a millilitre, so ml and l are offered. */
  ml?: number;
  /** On Recent: the amount and unit it was last logged at, which a tap adds again. */
  last?: { grams: number; serving: string | null };
};
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

/** A day's own meal asked before it goes (11 Nov, Alex: A of docs/boards/popup-anatomy-mockup.html): what goes with it,
 * and that a saved meal it wears stays; nothing when it is empty. */
function deleteMealText(m: FoodDiaryProps["meals"][number]): string | null {
  const foods = m.entries.length > 0;
  const goes = foods && m.photo ? "Its foods and the day’s photo are deleted with it." : foods ? "Its foods are deleted with it." : m.photo ? "The day’s photo is deleted with it." : null;
  const stays = m.savedMealId != null ? "The saved meal stays." : null;
  return [goes, stays].filter(Boolean).join(" ") || null;
}

// ---- At once (17 Oct): an add, an edit or a remove shows before the server answers.
const r1 =(n: number) => Math.round(n * 10) / 10;
type MacroKey = "kcal" | "protein" | "carbs" | "fat";
/** The day with its meal and day totals worked out again from the rows. */
function retotal(d: FoodDiaryProps): FoodDiaryProps {
  const meals = d.meals.map((m) => {
    const tot = (k: MacroKey) => r1(m.entries.reduce((s, e) => s + e[k], 0));
    return { ...m, kcal: Math.round(tot("kcal")), protein: tot("protein"), carbs: tot("carbs"), fat: tot("fat") };
  });
  const all = meals.flatMap((m) => m.entries);
  const sum = (k: MacroKey) => r1(all.reduce((s, e) => s + e[k], 0));
  return { ...d, meals, eaten: { kcal: sum("kcal"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat") } };
}
/** A row's macros from the food's per-100 g values. */
const rowOf = (food: FoodOptionView, grams: number) => {
  const k = grams / 100;
  return { kcal: r1(food.kcal * k), protein: r1(food.protein * k), carbs: r1(food.carbs * k), fat: r1(food.fat * k) };
};
type SavedItem = { food_id: string; name: string; grams: number; serving: string | null; kcal: number; protein: number; carbs: number; fat: number };
export type FoodDiaryProps = {
  date: string;
  dateLabel: string;
  target: Macros | null;
  /** Both days' targets, so the switch is instant (4 Nov, Alex). */
  targets?: { training: Macros | null; rest: Macros | null };
  eaten: Macros;
  dayType: "training" | "rest";
  loggedKcal: number | null;
  meals: { id: FoodMeal; label: string; own: boolean; kcal: number; protein: number; carbs: number; fat: number; entries: FoodEntryView[]; savedAs: string | null; /** The saved meal that filled this slot, while it still holds that meal. */ savedMealId: number | null; /** It holds other foods than the saved meal now does: Update {name} is offered. */ savedDiffers?: boolean; photo: string | null; /** What the card shows: the saved meal's picture, else that day's photo. */ picture: string | null; /** That picture's tiny preview, there at once. */ thumb: string | null; comments: { id: number; text: string; when: string }[] }[];
  recent: FoodOptionView[];
  saved: { id: number; name: string; kcal: number; protein: number; carbs: number; fat: number; picture: string | null; thumb: string | null; count: number; names: string[]; items: SavedItem[] }[];
  savedDays: { id: number; name: string; kcal: number; count: number; dayType: "training" | "rest" | null; picture: string | null; thumb: string | null; cards: { key: string; name: string; picture: string | null; thumb: string | null; items: SavedItem[] }[] }[];
  savedDayAs: string | null;
  savedDayId: number | null;
  previous: { date: string; dateLabel: string; meal: FoodMeal; mealLabel: string; kcal: number; names: string[] }[];
  /** Dates in the last month with anything logged, for the dots on the week strip. */
  loggedDays: string[];
};

// The shared macro palette (--macro-* in globals.css), spelt out because
// these are SVG presentation attributes, where var() does not resolve.
const HUE = { protein: "#334EAC", carbs: "#D99A2B", fat: "#2E8B7A" } as const;
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const g = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
const G_PER_OZ = 28.349523125;
const ML_PER_FL_OZ = 29.5735295625;
const ML_PER_CUP = 236.5882365;
/** A row's amount, its parts for Bars: the portion when there is one, then the grams. */
/** Under a food on a meal's line (11 Nov, Alex: A of docs/boards/meal-foods-mockup.html): its amount, the portion with
 * its grams after it, then its own protein, carbs and fat as the card writes the meal's ("i need to be able to see a
 * macros breakdown item by item"). */
const foodFacts = (e: { grams: number; serving: string | null; protein: number; carbs: number; fat: number }) => [
  e.serving ? `${e.serving} (${g(e.grams)} g)` : `${g(e.grams)} g`,
  <span key="m" className="fdc-row-macros">
    <span>P {n(e.protein)}</span>
    <span>C {n(e.carbs)}</span>
    <span>F {n(e.fat)}</span>
  </span>,
];
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
// The room between two meal cards (.fdc-meals).
const CARD_GAP = 10;
/** A card wears the saved meal's name while it is one (9 Nov, Alex); its own label comes back when it stops being. */
const cardTitle = (m: FoodDiaryProps["meals"][number]) => (m.savedMealId != null && m.savedAs ? m.savedAs : m.label);

// What is open inside a meal.
type Panel =
  | { kind: "search"; meal: FoodMeal }
  | { kind: "amount"; meal: FoodMeal; food: FoodOptionView; entry?: FoodEntryView }
  | { kind: "custom"; meal: FoodMeal };

export default function FoodDiaryScreen({
  clientId,
  diary: initial,
  pictures = [],
  initialDate = null,
  initialMeal = null,
  onBack,
}: {
  clientId: number;
  diary: FoodDiaryProps;
  /** The pictures set for Nutrition (17 Oct), taking turns behind the banner as they do there; none, the banner's own photo. */
  pictures?: string[];
  /** A coach message linked this day: open on it rather than today. */
  initialDate?: string | null;
  /** … and the coach commented on this meal of it: open and show it. */
  initialMeal?: string | null;
  onBack: () => void;
}) {
  // The day showing. Today arrives with the page; other days, and today
  // again after a change, are read through the action.
  const today = initial.date;
  // A coach's link to an older day reaches back to it (24 Oct, Alex: it opened today instead).
  const floor = initialDate && initialDate < addDays(today, -DAYS_BACK) && initialDate > addDays(today, -366) ? initialDate : addDays(today, -DAYS_BACK);
  const [diary, setDiary] = useState<FoodDiaryProps>(initial);
  // The diary's actions no longer refresh the whole client page (17 Oct), so once
  // something has changed here, leaving refreshes it: Home's and Nutrition's totals
  // catch up then, in one go, instead of on every add.
  const router = useRouter();
  const changed = useRef(false);
  const firstDiary = useRef(true);
  useEffect(() => {
    if (firstDiary.current) firstDiary.current = false;
    else changed.current = true;
  }, [diary]);
  useEffect(
    () => () => {
      if (changed.current) router.refresh();
    },
    [router]
  );
  const [date, setDate] = useState(initial.date);
  // A newer read of the page (the coach's phone preview reads again after a save): today's diary follows it.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    if (date === initial.date) setDiary(initial);
  }
  const [loading, startLoad] = useTransition();
  // `opening`: a day being moved to, not one re-read after a change (see releaseEmptyRestDay).
  const load = (d: string, opening = false) =>
    startLoad(async () => {
      const next = await getFoodDiaryAction(clientId, d, opening);
      if (next) setDiary(next);
    });
  const goTo = (d: string) => {
    if (d > today || d < floor || d === date) return;
    setDate(d);
    setPanel(null);
    load(d, true);
  };
  const reload = () => load(date);
  // Opening on a day left on Rest with nothing logged under it: it is a training day again.
  useEffect(() => {
    if (initial.dayType === "rest" && initial.meals.every((m) => m.entries.length === 0)) load(initial.date, true);
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Opened from a coach message's link to a day: read that day once, and
  // switch to it when it has come, so the screen never shows today's meals
  // under that day's name.
  useEffect(() => {
    if (!initialDate || initialDate === initial.date || initialDate > today || initialDate < floor) return;
    startLoad(async () => {
      const next = await getFoodDiaryAction(clientId, initialDate, true);
      if (!next) return;
      setDiary(next);
      setDate(initialDate);
    });
    // Once, on open: later days are the client's to move between.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mealRefs = useRef<Map<FoodMeal, HTMLDivElement>>(new Map());
  const [panel, setPanel] = useState<Panel | null>(null);
  // Closing a panel takes a few hundred pixels out of the page above the
  // thumb, and the browser would leave the scroll where it was, so the meal
  // jumps. The meal's top is noted before, and the scroll moved by the
  // difference after, so it stays put.
  const anchor = useRef<{ id: FoodMeal; top: number } | null>(null);
  const holdMeal = (id: FoodMeal) => {
    const el = mealRefs.current.get(id);
    if (el) anchor.current = { id, top: el.getBoundingClientRect().top };
  };
  const closePanel = () => {
    if (panel) holdMeal(panel.meal);
    setPanel(null);
  };
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    const el = mealRefs.current.get(a.id);
    const scroller = el?.closest<HTMLElement>(".app-content");
    if (el && scroller) {
      const bar = parseFloat(getComputedStyle(scroller.parentElement ?? scroller).getPropertyValue("--topbar-h")) || 0;
      const top = scroller.getBoundingClientRect().top + bar;
      if (a.top < top) {
        // The head of the meal had gone above the top bar: bring it to just under it.
        scroller.scrollTop += el.getBoundingClientRect().top - top - 8;
      } else {
        const delta = el.getBoundingClientRect().top - a.top;
        if (Math.abs(delta) > 1) scroller.scrollTop += delta;
      }
    }
    anchor.current = null;
  });
  // A meal added just now: it appears at once with its name as a box to type into.
  const [namingId, setNamingId] = useState<FoodMeal | null>(null);
  // iOS only opens the keyboard for a focus made during the tap itself, and
  // the name box appears after the server has made the meal. So the tap
  // focuses an unseen input, which holds the keyboard open until the name
  // box mounts and takes the focus over (autoFocus).
  const keyboardHold = useRef<HTMLInputElement | null>(null);
  const releaseKeyboardHold = () => {
    keyboardHold.current?.remove();
    keyboardHold.current = null;
  };
  // The meal shows the moment + is tapped (17 Oct, Alex: it waited on two round
  // trips and felt slow): a stand-in row under a temporary id, its name box
  // mounted during the tap so iOS opens the keyboard for it; the server's id
  // replaces the stand-in when it comes. Naming before then waits for that id.
  const pendingMeal = useRef<{ temp: FoodMeal; id: Promise<FoodMeal | null> } | null>(null);
  const realId = async (id: FoodMeal) => (pendingMeal.current?.temp === id ? await pendingMeal.current.id : id);
  const addMealNow = () => {
    releaseKeyboardHold();
    const temp: FoodMeal = `new-${Date.now()}`;
    setDiary((d) => ({ ...d, meals: [{ id: temp, label: "New meal", own: true, kcal: 0, protein: 0, carbs: 0, fat: 0, entries: [], savedAs: null, savedMealId: null, photo: null, picture: null, thumb: null, comments: [] }, ...d.meals] }));
    setNamingId(temp);
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("name", "New meal");
    fd.set("date", date);
    // Its one-time key, made as + is tapped (6 Nov): sent again once the signal is back, it makes one meal.
    fd.set("onceKey", newOnceKey());
    const id = addFoodMealAction(fd).catch(() => null);
    pendingMeal.current = { temp, id };
    void id.then((real) => {
      if (pendingMeal.current?.temp === temp) pendingMeal.current = null;
      if (!real) {
        setDiary((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== temp) }));
        setNamingId((n) => (n === temp ? null : n));
        return;
      }
      setDiary((d) => ({ ...d, meals: d.meals.map((m) => (m.id === temp ? { ...m, id: real } : m)) }));
      setNamingId((n) => (n === temp ? real : n));
    });
  };
  // Add a meal (10 Nov, Alex): New meal or Copy a meal, first.
  const [addingMeal, setAddingMeal] = useState(false);
  const [copyFailed, setCopyFailed] = useState<number | null>(null);
  const copyMealCard = (id: number) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", String(id));
    fd.set("date", date);
    // Its one-time key: sent again once the signal is back, the card goes in once.
    fd.set("onceKey", newOnceKey());
    setCopyFailed(null);
    startLoad(async () => {
      try {
        await addSavedMealCardAction(fd);
      } catch {
        // No signal: what is open stays and says so, never the error page.
        setCopyFailed(id);
        return;
      }
      const next = await getFoodDiaryAction(clientId, date).catch(() => null);
      if (next) {
        setDiary((d) => (d.date === date ? next : d));
        setPanel(null);
        setFolded(new Set(next.meals.map((m) => m.id)));
      }
      setAddingMeal(false);
      setSavedScreen(null);
    });
  };
  // Leaving the name box: an empty or untouched name means the meal was not wanted.
  const finishNaming = (id: FoodMeal, name: string) => {
    setNamingId(null);
    const clean = name.trim();
    if (!clean || clean === "New meal") {
      setDiary((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== id) }));
      void realId(id).then((real) => {
        if (!real) return;
        const fd = new FormData();
        fd.set("clientId", String(clientId));
        fd.set("meal", real);
        // The server's id may land after the row went: drop it again.
        setDiary((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== real) }));
        return removeFoodMealAction(fd);
      });
      return;
    }
    setDiary((d) => ({ ...d, meals: d.meals.map((m) => (m.id === id ? { ...m, label: clean } : m)) }));
    void realId(id).then((real) => {
      if (!real) return;
      const fd = new FormData();
      fd.set("clientId", String(clientId));
      fd.set("meal", real);
      fd.set("name", clean);
      return renameFoodMealAction(fd);
    });
  };
  // A meal of the client's own has a ⋯ (3 Nov, Alex: option B of docs/boards/own-meal-mockup.html): Rename, and Remove
  // while it holds nothing. Renaming is the name box again, holding the name; left blank or unchanged, it stays.
  const [mealMenu, setMealMenu] = useState<FoodMeal | null>(null);
  const [renamingId, setRenamingId] = useState<FoodMeal | null>(null);
  const finishRename = (id: FoodMeal, was: string, name: string) => {
    setRenamingId(null);
    const clean = name.trim();
    if (!clean || clean === was) return;
    setDiary((d) => ({ ...d, meals: d.meals.map((m) => (m.id === id ? { ...m, label: clean } : m)) }));
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("meal", id);
    fd.set("name", clean);
    void renameFoodMealAction(fd);
  };
  // Delete in a meal's ⋯ asks in a pop-up first (10 Nov, Alex): it takes what is in the meal with it.
  const [askDeleteMeal, setAskDeleteMeal] = useState<FoodMeal | null>(null);
  const [mealFailed, setMealFailed] = useState<FoodMeal | null>(null);
  const removeMeal = (id: FoodMeal) => {
    setMealMenu(null);
    setAskDeleteMeal(null);
    setPanel((p) => (p?.meal === id ? null : p));
    setMealFailed(null);
    const before = diary;
    setDiary((d) => retotal({ ...d, meals: d.meals.filter((m) => m.id !== id) }));
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("meal", id);
    fd.set("date", date);
    startLoad(async () => {
      try {
        await removeFoodMealAction(fd);
      } catch {
        // No signal: the card comes back and says so, never the error page.
        setDiary((d) => (d.date === date ? before : d));
        setMealFailed(id);
        return;
      }
      const next = await getFoodDiaryAction(clientId, date).catch(() => null);
      if (next) setDiary(next);
    });
  };
  // Naming the day to save it.
  // A typed figure's Edit: the strip becomes the box again.
  // The row whose bin was tapped: it becomes the question until answered.
  // The saved day whose × was tapped, likewise.
  // Save this day, on the Saved days screen: the pill turned into its name box.
  const [namingDay, setNamingDay] = useState(false);
  // Saved days or Saved meals, the screen to pick from (10 Nov, Alex).
  const [savedScreen, setSavedScreen] = useState<"days" | "meals" | null>(null);
  const savedRow = useRef<HTMLDivElement>(null);
  const [savedHost, setSavedHost] = useState<HTMLElement | null>(null);
  const openSaved = (which: "days" | "meals") => {
    setSavedHost(savedRow.current?.closest(".app-layer")?.parentElement ?? null);
    setSavedScreen(which);
  };
  // A saved day's own screen, over the list (10 Nov, Alex): `new` until it has its name, and what it deploys from.
  const [openDay, setOpenDay] = useState<number | "new" | null>(null);
  const [deployFrom, setDeployFrom] = useState<DayDeploy | null>(null);
  const [dayFailed, setDayFailed] = useState<number | null>(null);
  const [forgetFailed, setForgetFailed] = useState<number | null>(null);
  // Which opening of Create a day a create belongs to: a late answer never turns a newer, unnamed screen into the old day.
  const newDayOpening = useRef(0);
  const rereadDiary = async () => {
    const next = await getFoodDiaryAction(clientId, date);
    if (next) setDiary((d) => (d.date === date ? next : d));
  };
  useEffect(() => {
    if (typeof openDay === "number" && !diary.savedDays.some((d) => d.id === openDay)) setOpenDay(null);
  }, [openDay, diary.savedDays]);
  const createDay = async (name: string) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("name", name);
    fd.set("onceKey", newOnceKey());
    const opening = newDayOpening.current;
    const id = await createSavedDayAction(fd);
    if (id == null) return false;
    await rereadDiary().catch(() => {});
    if (newDayOpening.current === opening) setOpenDay((o) => (o === "new" ? id : o));
    return true;
  };
  // The diary out of reach of the keyboard and a screen reader while its screen is over it, as a gym's page does.
  const savedOpen = !!savedScreen;
  useEffect(() => {
    const layer = savedRow.current?.closest<HTMLElement>(".app-layer");
    if (!layer || !savedOpen) return;
    layer.inert = true;
    return () => {
      layer.inert = false;
    };
  }, [savedOpen]);
  // The row goes at once; the server's day replaces the guess when it comes.
  const applyLocal = (fn: (d: FoodDiaryProps) => FoodDiaryProps) => setDiary((d) => retotal(fn(d)));
  const settle = (forDate: string, next: FoodDiaryProps | null) => {
    if (next && next.date === forDate) setDiary((d) => (d.date === forDate ? next : d));
    else if (!next) reload();
  };
  // Update {name} (11 Nov, Alex): the saved meal becomes what this meal holds today. A retry reuses its one-time key.
  const [updateFailed, setUpdateFailed] = useState<FoodMeal | null>(null);
  const updateKeys = useRef(new Map<string, string>());
  const updateSaved = (mealId: FoodMeal) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("date", date);
    fd.set("meal", mealId);
    const k = `${date}|${mealId}`;
    const key = updateKeys.current.get(k) ?? newOnceKey();
    updateKeys.current.set(k, key);
    fd.set("onceKey", key);
    setUpdateFailed(null);
    const forDate = date;
    startLoad(async () => {
      try {
        await updateSavedMealFromSlotAction(fd);
      } catch {
        setUpdateFailed(mealId);
        return;
      }
      updateKeys.current.delete(k);
      const next = await getFoodDiaryAction(clientId, forDate).catch(() => null);
      if (next) setDiary((d) => (d.date === forDate ? next : d));
    });
  };
  // A Recent food tapped (11 Nov, Alex): on the meal at once at its last amount and unit, as Add would put it there.
  const quickAdd = (mealId: FoodMeal, food: FoodOptionView, grams: number, serving: string | null) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("grams", String(grams));
    fd.set("serving", serving ?? "");
    fd.set("date", date);
    fd.set("meal", mealId);
    fd.set("foodId", food.id);
    // Its one-time key, made as it is tapped: sent again once the signal is back, the food goes in once.
    fd.set("onceKey", newOnceKey());
    const temp: FoodEntryView = { id: -Date.now(), meal: mealId, food_id: food.id, name: food.name, grams, serving, ...rowOf(food, grams) };
    holdMeal(mealId);
    applyLocal((d) => ({ ...d, meals: d.meals.map((m) => (m.id === mealId ? { ...m, entries: [...m.entries, temp] } : m)) }));
    setPanel(null);
    const forDate = date;
    void addFoodEntryAction(fd).then((next) => settle(forDate, next), () => settle(forDate, null));
  };
  const removeRow = (id: number) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", String(id));
    fd.set("date", date);
    const meal = diary.meals.find((m) => m.entries.some((e) => e.id === id))?.id;
    if (meal) holdMeal(meal);
    if (panel?.kind === "amount" && panel.entry?.id === id) setPanel(null);
    applyLocal((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m, entries: m.entries.filter((e) => e.id !== id) })) }));
    const forDate = date;
    void removeFoodEntryAction(fd).then((next) => settle(forDate, next), () => reload());
  };
  // Which meal is being saved under a name.
  const [savingMeal, setSavingMeal] = useState<FoodMeal | null>(null);
  // The meal whose picture is on screen, full width, with Replace and Remove.
  const [photoOf, setPhotoOf] = useState<FoodMeal | null>(null);
  const shownPhoto = photoOf ? diary.meals.find((m) => m.id === photoOf) ?? null : null;

  // One picture per meal: sending another simply replaces it. While it goes, the card's camera says so; once in, the
  // picture is the card (9 Nov, Alex); a failed upload says so under the card.
  const [photoBusy, setPhotoBusy] = useState<FoodMeal | null>(null);
  const [photoFailed, setPhotoFailed] = useState<FoodMeal | null>(null);
  // One hidden picker for every meal's camera and Replace, opened by a plain button (4 Nov, Alex: two taps on the
  // camera), as the app's other photo buttons do; it remembers which meal asked.
  const photoInput = useRef<HTMLInputElement>(null);
  const photoFor = useRef<FoodMeal | null>(null);
  const pickPhotoFor = (meal: FoodMeal) => {
    photoFor.current = meal;
    photoInput.current?.click();
  };
  // The photo just picked (10 Nov, Alex: as fast as the chat): on the card at once from the phone's own copy while it goes
  // up, then behind the server's until that is in, so the card never goes blank.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const pickedUrls = useRef<string[]>([]);
  useEffect(() => () => pickedUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const pickedOf = (meal: FoodMeal) => picked[`${date}|${meal}`] ?? null;
  const sendPhoto = (meal: FoodMeal, file: File) => {
    const local = URL.createObjectURL(file);
    pickedUrls.current.push(local);
    const slot = `${date}|${meal}`;
    setPicked((p) => ({ ...p, [slot]: local }));
    const forget = () => setPicked((p) => (p[slot] === local ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== slot)) : p));
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("date", date);
    fd.set("meal", meal);
    fd.set("file", file);
    setPhotoBusy(meal);
    setPhotoFailed(null);
    startLoad(async () => {
      try {
        await uploadMealPhotoAction(fd);
        const next = await getFoodDiaryAction(clientId, date);
        if (next) setDiary(next);
        if (!next?.meals.find((m) => m.id === meal)?.picture) {
          setPhotoFailed(meal);
          forget();
        }
      } catch {
        setPhotoFailed(meal);
        forget();
      } finally {
        setPhotoBusy(null);
      }
    });
  };

  // A linked card's Remove reaches every day that saved meal is added, so the sheet asks first, in place.
  const [askDropPhoto, setAskDropPhoto] = useState(false);
  const closePhoto = () => {
    setPhotoOf(null);
    setAskDropPhoto(false);
  };
  const dropPhoto = (meal: FoodMeal) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("date", date);
    fd.set("meal", meal);
    closePhoto();
    startLoad(async () => {
      await removeMealPhotoAction(fd);
      const next = await getFoodDiaryAction(clientId, date);
      if (next) setDiary(next);
    });
  };
  // Meals fold shut to their name and figures, so a long day stays short.
  // They start folded; a meal added just now opens, since it is about to be filled.
  const [folded, setFolded] = useState<Set<FoodMeal>>(() => new Set(initial.meals.map((m) => m.id).filter((id) => id !== initialMeal)));
  // Another day: every meal shut (11 Nov, Alex: "I went to a previous day and this was unfolded"). The folds are kept by meal,
  // and a day's own meals have ids of their own, so none of them was in the set and they all came in open.
  const [foldedDay, setFoldedDay] = useState(diary.date);
  if (foldedDay !== diary.date) {
    setFoldedDay(diary.date);
    setFolded(new Set(diary.meals.map((m) => m.id)));
  }
  // The meal a coach's comment led here for, brought into view once its day
  // is the one showing.
  const shownLinked = useRef(false);
  useEffect(() => {
    if (!initialMeal || shownLinked.current || diary.date !== (initialDate ?? initial.date)) return;
    const el = mealRefs.current.get(initialMeal);
    if (!el) return;
    shownLinked.current = true;
    // Brought to the middle and lit (24 Oct, Alex: a link lands on its thing).
    landOn(el);
  }, [diary, initialMeal, initialDate, initial.date]);
  const openOnly = (id: FoodMeal) => setFolded(new Set(diary.meals.map((m) => m.id).filter((x) => x !== id)));
  const toggleFold = (id: FoodMeal) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // A tap anywhere on a meal's card opens its foods (9 Nov, Alex); the camera, the +, the ⋯ and the name box keep their
  // own taps. A meal with nothing in it does not open; one showing its search closes it, folding with it. A custom food,
  // an amount or Save meal's name being typed under the card stays: they keep their own Cancel, and a tap only drops the keyboard.
  const draggedAt = useRef(0);
  const tapCard = (e: React.MouseEvent, meal: FoodDiaryProps["meals"][number]) => {
    if ((e.target as Element).closest(".fdc-tools, .fdc-more, input")) return;
    // The click a drag's release leaves behind is not a tap.
    if (draggedAt.current && e.timeStamp - draggedAt.current < 400) return;
    if (namingId === meal.id || renamingId === meal.id) return;
    if (savingMeal === meal.id || (panel?.meal === meal.id && panel.kind !== "search")) {
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    if (panel?.meal === meal.id) {
      closePanel();
      setFolded((prev) => new Set(prev).add(meal.id));
      return;
    }
    if (meal.entries.length === 0) return;
    if (!folded.has(meal.id)) return toggleFold(meal.id);
    // One meal open at a time (10 Nov, Alex): the one before folds away as this one opens, on the shared fold.
    if (panel?.kind === "search") closePanel();
    openOnly(meal.id);
  };
  // Rearranging: press and hold a meal's name and it lifts; drag it up or
  // down and the others slide out of its way; let go and the order is saved.
  // A short tap on the name folds the meal instead.
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; height: number } | null>(null);
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
      // The others make room for the card and the space after it.
      setDrag({ from: index, to: index, dy: 0, height: (rects[index]?.height ?? 60) + CARD_GAP });
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
    draggedAt.current = e.timeStamp;
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
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2.5) return;
    goTo(addDays(date, dx > 0 ? -1 : 1));
  };

  // Training day | Rest day switches at once (4 Nov, Alex: "it takes maybe 1 to 2 seconds"): the day type and its
  // targets change on the phone the moment it is tapped, from both days' targets the diary carries, and the choice
  // saves behind it; a failed save puts the day back as it was.
  const chooseDay = (dayType: "training" | "rest") => {
    if (dayType === diary.dayType) return;
    const was = { dayType: diary.dayType, target: diary.target };
    setDiary((d) => ({ ...d, dayType, target: d.targets ? d.targets[dayType] : d.target }));
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("date", date);
    fd.set("dayType", dayType);
    void (async () => {
      try {
        await setFoodDayTypeAction(fd);
        // Without both targets on hand (an older copy of the page), read the day for its targets.
        if (!diary.targets) {
          const next = await getFoodDiaryAction(clientId, date);
          if (next) setDiary(next);
        }
      } catch {
        setDiary((d) => (d.date === date ? { ...d, ...was } : d));
      }
    })();
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
  const weekday = weekdayWords(date);
  const relative = diary.dateLabel === "Today" || diary.dateLabel === "Yesterday" ? diary.dateLabel : null;
  const dayTitle = relative ?? weekday;
  const daySub = `${relative ? `${weekday} ` : ""}${dayWords(date, { long: true })}`;

  return (
    <div className="fdi-screen app-layer-main">
      {/* White over the photo banner until the page scrolls, as on Nutrition. */}
      <header className={`app-header dark overlay${scrolled ? "" : " clear on-dark"}`}>
        <button type="button" className="app-header-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <NorCoachLogo className="app-header-brand" word />
        <div className="app-header-actions">
          <span className="app-header-icon-btn fdi-bar-spacer" aria-hidden="true" />
        </div>
      </header>

      <main className={`app-content dark${loading ? " fdi-loading" : ""}`} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so picking the same file twice still fires.
            e.target.value = "";
            const meal = photoFor.current;
            photoFor.current = null;
            if (file && meal) sendPhoto(meal, file);
          }}
        />
        <div className="fdi-page">
          {/* A clear sideways swipe on the banner or the rings steps a day; the meals below scroll only. */}
          <div
            className="fdi-swipe-zone"
            onPointerDown={(e) => {
              swipeStart.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={(e) => onSwipeEnd(e.clientX, e.clientY)}
            onPointerCancel={() => {
              swipeStart.current = null;
            }}
          >
          {/* Nutrition's banner, part for part (4 Nov, Alex: going from Nutrition to here the picture and the header
              jumped): its height, its eyebrow and title (.nd-phase), Training day | Rest day at its foot. */}
          <header className="nd-banner nd-photo fdi-banner">
            {pictures.length > 0 && <PictureCycle pictures={pictures} className="tr-banner-pic" />}
            <div className="nd-phase">
              <div className="nd-phase-titles">
                <div className="nd-kicker">Food diary</div>
                <h1 className="nd-phase-name">{dayTitle}</h1>
                <div className="fdi-date-sub">{daySub}</div>
              </div>
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
                            className={`fdi-day${on ? " on" : ""}${d === today ? " today" : ""}${future || tooFar ? " off" : ""}`}
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
            <div className="nd-tabs nd-daycap" data-slide role="tablist" aria-label="Day type">
              {(["training", "rest"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={diary.dayType === t} className={`nd-tab${diary.dayType === t ? " on" : ""}`} onClick={() => chooseDay(t)}>
                  {t === "training" ? "Training day" : "Rest day"}
                </button>
              ))}
            </div>
          </header>

          </div>
          {/* A figure typed in with no food behind it counts as eaten on the rings. */}
          <Targets
            onRing={onBack}
            target={diary.target}
            eaten={diary.eaten.kcal === 0 && diary.loggedKcal != null ? { ...diary.eaten, kcal: diary.loggedKcal } : diary.eaten}
            dayType={diary.dayType}
            onDayType={chooseDay}
          />
          <div className="nd-body fdi-list">
            {/* One card, folded, holding the days that can be copied onto this
                one: the last day with food, and the days the client saved.
                There on every day since 5 Oct, empty or not (a day used adds
                its food to what is there), and with nothing saved it says so. */}
            {(() => {
              const after = async () => {
                const next = await getFoodDiaryAction(clientId, date);
                if (next) {
                  // Only if the diary is still on that day: Back works while it saves.
                  setDiary((d) => (d.date === date ? next : d));
                  // Every card of the day in sight (10 Nov, Alex): back on the diary with each card shut, as one open at a time
                  // would have them; it used to open some and not others.
                  setSavedScreen(null);
                  setNamingDay(false);
                  setOpenDay(null);
                  setPanel(null);
                  setFolded(new Set(next.meals.map((m) => m.id)));
                }
              };
              const use = (id: number) => {
                const fd = new FormData();
                fd.set("clientId", String(clientId));
                fd.set("id", String(id));
                fd.set("date", date);
                // Its one-time key (6 Nov): sent again once the signal is back, the saved day goes in once.
                fd.set("onceKey", newOnceKey());
                setDayFailed(null);
                startLoad(async () => {
                  try {
                    await addSavedDayAction(fd);
                  } catch {
                    // No signal: what is open stays and says so, never the error page.
                    setDayFailed(id);
                    return;
                  }
                  await after();
                });
              };
              const forget = (id: number) => {
                const fd = new FormData();
                fd.set("clientId", String(clientId));
                fd.set("id", String(id));
                setForgetFailed(null);
                startLoad(async () => {
                  try {
                    await deleteSavedDayAction(fd);
                  } catch {
                    // No signal: the day stays listed and says so, never the error page.
                    setForgetFailed(id);
                    return;
                  }
                  const next = await getFoodDiaryAction(clientId, date).catch(() => null);
                  if (next) setDiary(next);
                });
              };
              return (
                <>
                  {/* Saved days and Saved meals side by side, each its own screen to pick from (10 Nov, Alex). */}
                  <div ref={savedRow} className="fdi-saved-row">
                    <button type="button" className="fdi-saved-pill" onClick={() => openSaved("days")}>
                      <BookmarkIcon />
                      <span>Saved days</span>
                      <ChevronDownIcon />
                    </button>
                    <button type="button" className="fdi-saved-pill" onClick={() => openSaved("meals")}>
                      <BookmarkIcon />
                      <span>Saved meals</span>
                      <ChevronDownIcon />
                    </button>
                  </div>
                  {savedScreen && savedHost && createPortal(
                    <>
                    <div className="app-layer app-layer-push cn-screen fdi-saved-screen" inert={savedScreen === "days" && openDay != null}>
                      <header className="cn-header">
                        <button
                          type="button"
                          className="cn-icon-btn"
                          onClick={() => {
                            setSavedScreen(null);
                            setNamingDay(false);
                          }}
                          aria-label="Back"
                        >
                          <ChevronLeftIcon />
                        </button>
                        <div className="cn-header-titles">
                          <h1 className="cn-title">{savedScreen === "days" ? "Saved days" : "Saved meals"}</h1>
                        </div>
                        <span className="cn-icon-spacer" aria-hidden="true" />
                      </header>
                      <main className="cn-body">
                        {savedScreen === "meals" ? (
                          <>
                            {(
                              <SavedMealList
                                clientId={clientId}
                                date={date}
                                saved={diary.saved}
                                recent={diary.recent}
                                busy={loading}
                                onChange={(fn) => setDiary((d) => ({ ...d, saved: fn(d.saved) }))}
                                refresh={async () => {
                                  const next = await getFoodDiaryAction(clientId, date);
                                  if (next) setDiary((d) => (d.date === date ? next : d));
                                }}
                                onUse={copyMealCard}
                                useFailed={copyFailed}
                              />
                            )}
                          </>
                        ) : (
                          <>
                            {/* Save this day (10 Nov, Alex): at the top of the list it lands in. No Today or Yesterday row (11 Nov, Alex: "what is the use"): a saved day is its card below. */}
                            {namingDay && !diary.savedDayAs && diary.meals.some((m) => m.entries.length > 0) ? (
                                <form
                                  className="fdi-saved-name fdi-saved-this"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
                                    if (!name) return;
                                    const fd = new FormData();
                                    fd.set("clientId", String(clientId));
                                    fd.set("date", date);
                                    fd.set("name", name);
                                    // Its one-time key (6 Nov): sent again once the signal is back, it saves the day once.
                                    fd.set("onceKey", newOnceKey());
                                    setNamingDay(false);
                                    startLoad(async () => {
                                      await saveDayAction(fd);
                                      const next = await getFoodDiaryAction(clientId, date);
                                      if (next) setDiary((d) => (d.date === date ? next : d));
                                    });
                                  }}
                                >
                                  <input
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
                                  <button type="submit">Save</button>
                                </form>
                            ) : (
                              <div className="fdi-saved-row fdi-saved-this">
                                {!diary.savedDayAs && diary.meals.some((m) => m.entries.length > 0) && (
                                  <button type="button" className="fdi-saved-pill" onClick={() => setNamingDay(true)} disabled={loading}>
                                    <BookmarkIcon />
                                    <span>Save this day</span>
                                  </button>
                                )}
                                <button type="button" className="fdi-saved-pill" onClick={(e) => {
                                    newDayOpening.current++;
                                    setDeployFrom({ top: e.currentTarget.getBoundingClientRect().top, el: null });
                                    setOpenDay("new");
                                  }} disabled={loading}>
                                  <PlusIcon />
                                  <span>Create a day</span>
                                </button>
                              </div>
                            )}
                            {forgetFailed != null && diary.savedDays.some((d) => d.id === forgetFailed) && (
                              <p className="fdi-photo-failed" role="alert">
                                Not deleted. Try again
                              </p>
                            )}
                            <SavedDayList
                              clientId={clientId}
                              date={date}
                              days={diary.savedDays}
                              onDays={(fn) => setDiary((d) => ({ ...d, savedDays: fn(d.savedDays) }))}
                              refresh={rereadDiary}
                              onOpen={(id, el) => {
                                setDeployFrom({ top: el.getBoundingClientRect().top, el });
                                setOpenDay(id);
                              }}
                            />
                          </>
                        )}
                      </main>
                    </div>
                    {savedScreen === "days" && (openDay === "new" || diary.savedDays.some((d) => d.id === openDay)) && (
                      <SavedDayScreen
                        clientId={clientId}
                        date={date}
                        day={openDay === "new" ? null : diary.savedDays.find((d) => d.id === openDay) ?? null}
                        recent={diary.recent}
                        busy={loading}
                        useFailed={openDay !== "new" && dayFailed === openDay}
                        from={deployFrom}
                        onCreate={createDay}
                        onDay={(id, fn) => setDiary((d) => ({ ...d, savedDays: d.savedDays.map((x) => (x.id === id ? fn(x) : x)) }))}
                        refresh={rereadDiary}
                        onBack={() => {
                          setOpenDay(null);
                          setDayFailed(null);
                        }}
                        onUse={use}
                        onDelete={(id) => {
                          setOpenDay(null);
                          forget(id);
                        }}
                      />
                    )}
                    </>,
                    savedHost
                  )}
                </>
              );
            })()}
            {/* A photo card a meal (9 Nov, Alex: option A of docs/boards/meal-cards-mockup.html), its foods folding out under
                it, flat on the page. */}
            <section className="fdi-meals fdc-meals">
              {diary.meals.map((meal, index) => {
                const open = panel?.meal === meal.id ? panel : null;
                const naming = namingId === meal.id || renamingId === meal.id;
                const filled = meal.entries.length > 0;
                const title = cardTitle(meal);
                // Its foods, or the + panel of an empty meal, which has no chevron but needs somewhere to open.
                const unfolded = !!open || (filled && !folded.has(meal.id));
                const savedFoot = !open && savingMeal !== meal.id && filled;
                // The card's + and the + ring at the end of its line: the search under the foods, a second tap shutting it.
                const addFood = () => {
                  if (savingMeal === meal.id || (open && open.kind !== "search")) return;
                  if (open?.kind === "search") return closePanel();
                  openOnly(meal.id);
                  setPanel({ kind: "search", meal: meal.id });
                };
                return (
                  <div
                    key={meal.id}
                    ref={(el) => {
                      if (el) mealRefs.current.set(meal.id, el);
                      else mealRefs.current.delete(meal.id);
                    }}
                    className={`fdi-meal fdc-meal${open ? " open" : ""}${drag?.from === index ? " lifted" : ""}${drag ? " shifting" : ""}`}
                    style={{ transform: shiftFor(index) }}
                  >
                    <div className={`fdc-card${meal.picture || (photoBusy === meal.id && pickedOf(meal.id)) ? "" : " bare"}${filled ? "" : " shut"}`} onClick={(e) => tapCard(e, meal)}>
                      {/* The picture, else the plain texture of the shade under it: never a photo of food that isn't this meal. */}
                      <div className="fdc-bg" aria-hidden="true">
                        {/* eslint-disable-next-line @next/next/no-img-element -- the client’s own upload */}
                        {photoBusy === meal.id && pickedOf(meal.id) ? (
                          // eslint-disable-next-line @next/next/no-img-element -- the phone's own copy, just picked
                          <img src={pickedOf(meal.id)!} alt="" draggable={false} />
                        ) : (
                          meal.picture && <CardPicture src={pic(meal.picture, 1080)} under={pickedOf(meal.id) ?? meal.thumb} />
                        )}
                      </div>
                      {/* A meal being named is its name box alone (3 Nov, Alex: "only show the icons once the name has been
                          saved"); left blank, it goes. */}
                      {!naming && (
                        <>
                          {/* Rename, and Remove while it holds nothing. On the left so the camera and + stay in one place on
                              every card. While it is a saved meal the card wears that name, but Rename stays: it is the
                              name the coach reads, and the card's own again once the link ends. */}
                          {meal.own && (
                            <span className="fdi-meal-more-wrap fdc-more">
                              <button type="button" className="fdc-tool" onClick={() => setMealMenu(mealMenu === meal.id ? null : meal.id)} aria-expanded={mealMenu === meal.id} aria-label={`More for ${title}`}>
                                <MoreIcon />
                              </button>
                              {mealMenu === meal.id && (
                                <>
                                  <button type="button" className="fdi-meal-menu-scrim" aria-label="Close" onClick={() => setMealMenu(null)} />
                                  <span className="fdi-meal-menu" role="menu">
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setMealMenu(null);
                                        setRenamingId(meal.id);
                                      }}
                                    >
                                      Rename
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="danger"
                                      onClick={() => {
                                        setMealMenu(null);
                                        setAskDeleteMeal(meal.id);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </span>
                                </>
                              )}
                            </span>
                          )}
                          <span className="fdc-tools">
                            {/* The camera: with a picture, the sheet (Replace, Remove); without, a plain button opening the
                                one hidden picker (4 Nov, Alex: one tap to the phone's own picker). */}
                            {photoBusy === meal.id ? (
                              <span className="fdc-tool fdi-photo-busy" role="status" aria-label={`Adding the picture of ${title}`}>
                                <CameraIcon />
                              </span>
                            ) : (
                              <button type="button" className="fdc-tool" onClick={() => (meal.picture ? setPhotoOf(meal.id) : pickPhotoFor(meal.id))} aria-label={meal.picture ? `See your picture of ${title}` : `Add a picture of ${title}`}>
                                <CameraIcon />
                              </button>
                            )}
                            <button
                              type="button"
                              className="fdc-tool"
                              onClick={addFood}
                              aria-label={`Add food to ${title}`}
                            >
                              <PlusIcon />
                            </button>
                          </span>
                        </>
                      )}
                      <div className="fdc-name">
                        <span
                          className={`fdc-handle${naming ? " naming" : ""}`}
                          onPointerDown={(e) => holdStart(e, index)}
                          onPointerMove={holdMove}
                          onPointerUp={holdEnd}
                          onPointerCancel={holdEnd}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          {naming ? (
                            <input
                              id={`fdi-meal-name-${meal.id}`}
                              className="fdi-meal-name-box fdc-name-box"
                              type="text"
                              defaultValue={renamingId === meal.id ? meal.label : ""}
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
                              onBlur={(e) => (renamingId === meal.id ? finishRename(meal.id, meal.label, e.currentTarget.value) : finishNaming(meal.id, e.currentTarget.value))}
                              onFocus={(e) => {
                                const el = e.currentTarget;
                                releaseKeyboardHold();
                                setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
                              }}
                            />
                          ) : (
                            <span className="fdc-title">{title}</span>
                          )}
                        </span>
                        {/* The one control a keyboard or a reader needs; its click reaches the card's. */}
                        {filled && !naming && (
                          <button type="button" className={`fdi-meal-chev fdc-chev${unfolded ? " up" : ""}`} aria-expanded={unfolded} aria-label={unfolded ? `Fold ${title}` : `Open ${title}`}>
                            <ChevronDownIcon />
                          </button>
                        )}
                      </div>
                      {!naming && <CardFigures meal={meal} title={title} />}
                    </div>
                    {photoFailed === meal.id && (
                      <p className="fdi-photo-failed" role="alert">
                        Picture not added. Try again
                      </p>
                    )}
                    {mealFailed === meal.id && (
                      <p className="fdi-photo-failed" role="alert">
                        Not deleted. Try again
                      </p>
                    )}
                    <div className={`so-fold fdc-fold${unfolded ? " open" : ""}`} aria-hidden={!unfolded} inert={!unfolded}>
                    <div className="so-fold-in">
                    <div className="fdc-foods">
                    {/* On a line from the card (11 Nov, Alex: A of docs/boards/meal-foods-mockup.html), each food a dot on it. */}
                    {meal.entries.length > 0 && (
                    <div className="fdc-spine">
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
                              <Bars parts={foodFacts(e)} />
                            </span>
                          </span>
                          <span className="fdc-row-kcal">{n(e.kcal)} kcal</span>
                        </button>
                        {selected && open?.kind === "amount" && (
                          <AmountPanel
                            clientId={clientId}
                            date={date}
                            meal={meal.id}
                            mealLabel={title}
                            food={open.food}
                            entry={e}
                            apply={applyLocal}
                            settle={settle}
                            onRemove={() => removeRow(e.id)}
                            onDone={closePanel}
                            onCancel={closePanel}
                          />
                        )}
                        </div>
                      );
                    })}
                    <SpineAdd
                      label={`Add food to ${title}`}
                      on={open?.kind === "search"}
                      onClick={addFood}
                      action={
                        // In words on the ring's row: Save meal, or on a saved meal with a food added that day, Update {name},
                        // which makes the saved meal what this day holds (11 Nov, Alex). A linked card says nothing more.
                        savedFoot && !meal.savedAs ? (
                          <button type="button" className="fdc-save" onClick={() => setSavingMeal(meal.id)}>
                            Save meal
                          </button>
                        ) : savedFoot && meal.savedMealId != null && meal.savedDiffers ? (
                          <>
                            {/* Both (11 Nov): kept as a saved meal of its own, or the saved meal made this. */}
                            <button type="button" className="fdc-save" onClick={() => setSavingMeal(meal.id)}>
                              Save meal
                            </button>
                            <button type="button" className="fdc-save fdc-update" onClick={() => updateSaved(meal.id)} disabled={loading}>
                              Update {meal.savedAs}
                            </button>
                          </>
                        ) : null
                      }
                    />
                    </div>
                    )}
                    {updateFailed === meal.id && (
                      <p className="fdi-photo-failed" role="alert">
                        Not updated. Try again
                      </p>
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
                          // Its one-time key (6 Nov): sent again once the signal is back, it saves the meal once.
                          fd.set("onceKey", newOnceKey());
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
                    {open?.kind === "search" ? (
                      <SearchPanel
                        clientId={clientId}
                        date={date}
                        meal={meal.id}
                        mealLabel={title}
                        recent={diary.recent}
                        onQuickAdd={(food, grams, serving) => quickAdd(meal.id, food, grams, serving)}
                        // Copy a meal only while the meal is empty (11 Nov, Alex): with food in it, its search alone.
                        saved={filled ? NO_SAVED : diary.saved.filter((s) => s.count > 0)}
                        onPick={(food) => {
                          holdMeal(meal.id);
                          setPanel({ kind: "amount", meal: meal.id, food });
                        }}
                        onCustom={() => {
                          holdMeal(meal.id);
                          setPanel({ kind: "custom", meal: meal.id });
                        }}
                        onCopied={() => {
                          closePanel();
                          reload();
                        }}
                        onCancel={closePanel}
                      />
                    ) : open?.kind === "amount" && !open.entry ? (
                      <AmountPanel
                        clientId={clientId}
                        date={date}
                        meal={meal.id}
                        mealLabel={title}
                        food={open.food}
                        apply={applyLocal}
                        settle={settle}
                        onDone={closePanel}
                        onCancel={() => {
                          holdMeal(meal.id);
                          setPanel({ kind: "search", meal: meal.id });
                        }}
                      />
                    ) : open?.kind === "custom" ? (
                      <CustomFoodPanel clientId={clientId} onCancel={() => setPanel({ kind: "search", meal: meal.id })} onCreated={(food) => setPanel({ kind: "amount", meal: meal.id, food })} />
                    ) : null}
                    </div>
                    </div>
                    </div>
                    {meal.comments.length > 0 && (
                      <div className="fdi-coach-said">
                        <CoachSays label="From your coach">
                          {meal.comments.map((c) => (
                            <p key={c.id}>
                              {c.text}
                              <small>{c.when}</small>
                            </p>
                          ))}
                        </CoachSays>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            <button type="button" className="fdi-add-meal fdc-add" onClick={() => setAddingMeal(true)} disabled={namingId != null}>
              <PlusIcon />
              Add a meal
            </button>
          </div>
        </div>
      </main>

      {askDeleteMeal != null && diary.meals.some((m) => m.id === askDeleteMeal) && (
        <DeleteMealDialog name={cardTitle(diary.meals.find((m) => m.id === askDeleteMeal)!)} text={deleteMealText(diary.meals.find((m) => m.id === askDeleteMeal)!)} onCancel={() => setAskDeleteMeal(null)} onDelete={() => removeMeal(askDeleteMeal)} />
      )}
      {addingMeal && (
        <AddMealSheet
          saved={diary.saved.filter((s) => s.count > 0)}
          busy={loading}
          picture={(p) => pic(p, 1080)}
          onNew={() => {
            setAddingMeal(false);
            addMealNow();
          }}
          onCopy={copyMealCard}
          failed={copyFailed != null}
          onClose={() => setAddingMeal(false)}
        />
      )}
      {shownPhoto?.picture && (
        <div className="fdi-photo-scrim" role="presentation" onClick={closePhoto}>
          <div className="fdi-photo-sheet" role="dialog" aria-modal="true" aria-label={`Your picture of ${cardTitle(shownPhoto)}`} onClick={(e) => e.stopPropagation()}>
            {/* The shared sheet voice (3 Nov, Alex: the audit): the meal's name at 600 and the round ✕, the picture, then
                Replace as the white hairline pill and Remove in red words. No hint line. */}
            <div className="fdi-sheet-head">
              <span />
              <span className="fdi-sheet-title">{cardTitle(shownPhoto)}</span>
              <button type="button" className="fdi-sheet-x" onClick={closePhoto} aria-label="Close">
                ×
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- the client’s own upload */}
            <img className="fdi-photo-shot" src={shownPhoto.picture} alt={`Your picture of ${cardTitle(shownPhoto)}`} />
            {askDropPhoto ? (
              <div className="fdi-photo-actions fdc-photo-ask">
                <span className="fdc-photo-ask-q">Remove picture?</span>
                <span className="fdc-photo-ask-do">
                  <button type="button" className="fdc-photo-cancel" onClick={() => setAskDropPhoto(false)}>
                    Cancel
                  </button>
                  <button type="button" className="fdi-photo-remove" onClick={() => dropPhoto(shownPhoto.id)}>
                    Remove
                  </button>
                </span>
              </div>
            ) : (
              <div className="fdi-photo-actions">
                <button type="button" className="fdi-photo-replace" onClick={() => pickPhotoFor(shownPhoto.id)}>
                  Replace
                </button>
                <button type="button" className="fdi-photo-remove" onClick={() => (shownPhoto.savedMealId != null ? setAskDropPhoto(true) : dropPhoto(shownPhoto.id))}>
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
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

function Targets({ target, eaten, dayType, onDayType, onRing }: { target: Macros | null; eaten: Macros; dayType: "training" | "rest"; onDayType: (t: "training" | "rest") => void; /** The ring again goes back to Nutrition (11 Nov, Alex), as the ring there opened the diary. */ onRing: () => void }) {
  // A sideways swipe on the rings switches the kind of day, as on Nutrition:
  // left for a rest day, right for a training day. The rings and figures run
  // to the new targets.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  // A finger that moved was a swipe, not a tap on the ring.
  const swiped = useRef(false);
  const swipeEnd = (x: number, y: number) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    swiped.current = Math.hypot(dx, dy) > 10;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    onDayType(dx > 0 ? "training" : "rest");
  };
  const left = target ? Math.max(0, target.kcal - eaten.kcal) : null;
  const over = target ? Math.max(0, eaten.kcal - target.kcal) : 0;
  const figure = useTween(left == null ? eaten.kcal : over > 0 ? over : left);
  return (
    <section
      className="nd-card fdi-targets"
      onPointerDown={(e) => {
        swipe.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => swipeEnd(e.clientX, e.clientY)}
      onPointerCancel={() => {
        swipe.current = null;
      }}
    >
      <div className="nd-cal-row">
        <button type="button" className="nd-ring" onClick={() => !swiped.current && onRing()} aria-label={`${left == null ? `${n(eaten.kcal)} kcal eaten` : over > 0 ? `${n(over)} kcal over` : `${n(left)} kcal left`}. Back to Nutrition`}>
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
        </button>
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
      <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke="#E0F2F1" strokeWidth={STROKE} />
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
          <Bars parts={[NAME[id], goal != null && <span className="nd-macro-of">of {n(goal)} g</span>]} />
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

// On a meal's card: the kcal, then protein, carbs and fat small (9 Nov, Alex). They run to their new values.
/** A card's picture over its preview (10 Nov, Alex: as the chat's): the preview is on the data, there before the picture. */
function CardPicture({ src, under }: { src: string; under: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element -- the client’s own upload
  return <img src={src} alt="" draggable={false} decoding="async" style={under ? { backgroundImage: `url(${under})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />;
}

function CardFigures({ meal, title }: { meal: FoodDiaryProps["meals"][number]; title: string }) {
  const kcal = useTween(meal.kcal);
  const protein = useTween(meal.protein);
  const carbs = useTween(meal.carbs);
  const fat = useTween(meal.fat);
  if (meal.entries.length === 0) return <div className="fdc-figs none">Nothing logged</div>;
  return (
    <div className="fdc-figs" role="group" aria-label={`${title}: ${n(meal.kcal)} kcal`}>
      <b>{n(kcal)} kcal</b>
      <span>P {n(protein)}</span>
      <span>C {n(carbs)}</span>
      <span>F {n(fat)}</span>
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
  onPick,
  onQuickAdd,
  onCustom,
  onCopied,
  onCancel,
}: {
  clientId: number;
  date: string;
  meal: FoodMeal;
  mealLabel: string;
  recent: FoodOptionView[];
  /** A Recent food tapped: added at once, at the amount and unit it was last logged at. */
  onQuickAdd?: (food: FoodOptionView, grams: number, serving: string | null) => void;
  saved: FoodDiaryProps["saved"];
  onPick: (food: FoodOptionView) => void;
  onCustom: () => void;
  onCopied: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  // Copy a meal (11 Nov, Alex): the saved meals pop-up, and the meal whose copy didn't go.
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyKeys = useRef(new Map<number, string>());
  // The last answer, with the query it answers; anything else is stale.
  const [answer, setAnswer] = useState<{ q: string; rows: FoodOptionView[] } | null>(null);
  // Which query the long tail was opened for.
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [copying, startCopy] = useTransition();
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
  // The client's own and the everyday foods are the list; the catalog's long
  // tail sits behind a count, unless it is all there is.
  // Before a word is typed, Recent: four at most, the latest first (11 Nov, Alex: "add recent again").
  // Only while the box is empty: never in the moment a typed search is on its way, where a tap would add at once.
  const showingRecent = q === "" && recent.length > 0;
  const front = showingRecent ? recent.slice(0, 4) : (results ?? []).filter((f) => f.group !== "more");
  const tail = results?.filter((f) => f.group === "more") ?? [];
  const list = front.length === 0 || showMore ? [...front, ...tail] : front;

  const addSaved = (id: number) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", String(id));
    fd.set("date", date);
    fd.set("meal", meal);
    // Its one-time key (6 Nov): a try again after a failure sends the same one, so a copy the server did write while its
    // answer was lost never goes in twice.
    const key = copyKeys.current.get(id) ?? newOnceKey();
    copyKeys.current.set(id, key);
    fd.set("onceKey", key);
    setCopyFailed(false);
    startCopy(async () => {
      try {
        await addSavedMealAction(fd);
      } catch {
        // No signal: the pop-up stays and says so, never the error page.
        setCopyFailed(true);
        return;
      }
      copyKeys.current.delete(id);
      setCopyOpen(false);
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
          {/* Copy a meal (11 Nov, Alex): the saved meals as their cards, in a pop-up; no list, words or × here. */}
          {saved.length > 0 && (
            <button type="button" className="fdi-saved-pill fdi-copy-pill" onClick={() => { setCopyFailed(false); setCopyOpen(true); }}>
              <CopyIcon />
              <span>Copy a meal</span>
              <ChevronDownIcon />
            </button>
          )}
          {copyOpen && (
            <CopyMealDialog saved={saved} busy={copying} picture={(p) => pic(p, 1080)} onCopy={addSaved} failed={copyFailed} onClose={() => setCopyOpen(false)} />
          )}
          {scanNote && <p className="fdi-empty">{scanNote}</p>}
          <div className="fdi-results">
            {showingRecent && <span className="fdi-results-label">Recent</span>}
            {list.map((f) => {
              // A Recent food goes in with one tap at its last amount and unit (11 Nov, Alex: "if I added 60 g then it adds
              // 60 g"); a different amount is a tap on it on the meal's line after.
              const again = showingRecent && f.last && onQuickAdd ? f.last : null;
              return (
                <button key={f.id} type="button" className="fdi-result" onClick={() => (again ? onQuickAdd!(f, again.grams, again.serving) : onPick(f))}>
                  <span className="fdi-result-main">
                    <span className="fdi-result-name">{f.name}</span>
                    <span className="fdi-result-hint">{again ? (again.serving ? `${again.serving} (${g(again.grams)} g)` : `${g(again.grams)} g`) : f.hint || " "}</span>
                  </span>
                  <span className="fdi-result-kcal">
                    {again ? (
                      <>
                        {n((f.kcal * again.grams) / 100)} <small>kcal</small>
                      </>
                    ) : (
                      <>
                        {n(f.kcal)} <small>kcal / 100 g</small>
                      </>
                    )}
                  </span>
                </button>
              );
            })}
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
          </div>
          <button type="button" className="fdi-link" onClick={onCustom}>
            Can’t find it? Add your own food
          </button>
        </>
    </div>
  );
}

// ---- Inside a meal: how much -------------------------------------------------

// ---- Saved meals and saved days (10 Nov, Alex: "exactly like they are inside the days"): the day's card, editable ------

const NO_SAVED: FoodDiaryProps["saved"] = [];
const NO_FOODS: FoodOptionView[] = [];
/** The key that means a day's own picture rather than one of its cards'. */
const DAY_COVER = "@cover";
type SavedMealRow = FoodDiaryProps["saved"][number];
type SavedDayRow = FoodDiaryProps["savedDays"][number];
type EditCard = { key: string; name: string; picture: string | null; thumb: string | null; /** Shown when it has no picture of its own. */ fallback?: { picture: string; thumb: string | null }; items: SavedItem[]; /** A saved day in the list: how many cards it holds, drawn as that many in its stack. */ stack?: number };
/** The edges drawn behind a saved day's card: one for each card past the first (11 Nov, Alex: "a stack of two"), a stack of three at most ("if there is more than 3 we show 3"). */
const STACK_EDGES = 2;
const stackEdges = (meals: number | undefined) => Math.min(STACK_EDGES, Math.max(0, (meals ?? 1) - 1));
const EDGE_TONES = ["#6d7680", "#aeb6bf", "#cfd5dc", "#e1e5eb"];
type CardPanel = { key: string; kind: "search" | "custom" } | { key: string; kind: "amount"; food: FoodOptionView; index?: number };
type CardActions = {
  /** The new card's key, null when it wasn't saved. */
  create: (name: string) => Promise<string | null>;
  rename: (c: EditCard, name: string) => Promise<boolean>;
  addFood: (c: EditCard, foodId: string, grams: number, serving: string | null, onceKey: string) => Promise<boolean>;
  changeFood: (c: EditCard, index: number, foodId: string, grams: number, serving: string | null) => Promise<boolean>;
  removeFood: (c: EditCard, index: number, foodId: string, onceKey: string) => Promise<boolean>;
  remove: (c: EditCard) => Promise<boolean>;
  upload: (c: EditCard, file: File) => Promise<boolean>;
  dropPicture: (c: EditCard) => Promise<boolean>;
};
/** A card still on its way to the server: its key is made here, and it has no tools until it has a real one. */
const isTempCard = (key: string) => key.startsWith("-");

function EditableMealCards({
  clientId,
  date,
  cards,
  recent,
  locked = false,
  addAt,
  renderAdd,
  stacked = false,
  onOpen,
  onReorder,
  onCards,
  refresh,
  actions,
  foot,
  deleteText,
}: {
  /** Delete's one sentence on what stays, in its pop-up. */
  deleteText?: string;
  /** A saved day in the list: two edges drawn behind the card. */
  stacked?: boolean;
  /** Hold a card's name and drag, as on a day. */
  onReorder?: (keys: string[]) => Promise<boolean>;
  /** A tap opens something else rather than folding the card's foods. */
  onOpen?: (c: EditCard, el: HTMLElement) => void;
  clientId: number;
  date: string;
  cards: EditCard[];
  recent: FoodOptionView[];
  /** A day not named yet: the cards are there, their tools come with the name. */
  locked?: boolean;
  addAt: "top" | "bottom";
  /** With `input`, the title box to draw in the very same room as the button. */
  renderAdd: (start: () => void, input: ReactNode | null) => ReactNode;
  onCards: (fn: (list: EditCard[]) => EditCard[]) => void;
  refresh: () => Promise<void>;
  actions: CardActions;
  /** Under a card's foods, in words. */
  foot?: (c: EditCard) => ReactNode;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [panel, setPanel] = useState<CardPanel | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);
  const [askDelete, setAskDelete] = useState<string | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const unsettled = useRef(new Map<string, { row: EditCard | null; at: number; count: number; bad: boolean }>());
  const [photoOf, setPhotoOf] = useState<string | null>(null);
  const [askDropPhoto, setAskDropPhoto] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<string[]>([]);
  const [photoFailed, setPhotoFailed] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const pickedUrls = useRef<string[]>([]);
  useEffect(() => () => pickedUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const photoInput = useRef<HTMLInputElement>(null);
  const photoFor = useRef<EditCard | null>(null);
  const noApply = () => {};
  const list = useRef<HTMLElement>(null);
  const cardEls = useRef(new Map<string, HTMLDivElement>());

  // Hold the name to move the card, as on a day: the others slide out of its way, let go and the order is saved.
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; height: number } | null>(null);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const dragging = useRef<{ from: number; to: number; startY: number; mids: number[] } | null>(null);
  const draggedAt = useRef(0);
  const holdStart = (e: React.PointerEvent<HTMLElement>, index: number) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Not while a new card is on its way: its order can't be sent until it has its key.
    if (cards.some((c) => isTempCard(c.key))) return;
    const el = e.currentTarget;
    const { pointerId, clientX: x, clientY: y } = e;
    const timer = setTimeout(() => {
      hold.current = null;
      el.setPointerCapture(pointerId);
      const rects = cards.map((c) => cardEls.current.get(c.key)?.getBoundingClientRect());
      dragging.current = { from: index, to: index, startY: y, mids: rects.map((r) => (r ? r.top + r.height / 2 : 0)) };
      if (navigator.vibrate) navigator.vibrate(10);
      setDrag({ from: index, to: index, dy: 0, height: (rects[index]?.height ?? 132) + CARD_GAP });
    }, 320);
    hold.current = { timer, x, y };
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
    if (hold.current) {
      clearTimeout(hold.current.timer);
      hold.current = null;
    }
    const d = dragging.current;
    if (!d) return;
    dragging.current = null;
    draggedAt.current = e.timeStamp;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    setDrag(null);
    if (d.to === d.from || !onReorder) return;
    const order = cards.map((c) => c.key);
    const next = [...cards];
    const [moved] = next.splice(d.from, 1);
    next.splice(d.to, 0, moved);
    onCards(() => next);
    setFailed((f) => f.filter((x) => x !== moved.key));
    onReorder(next.map((c) => c.key))
      .catch(() => false)
      .then((ok) => {
        if (!ok) {
          // The order alone goes back: a name or a food changed meanwhile stays.
          onCards((all) => [...all].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)));
          setFailed((f) => [...f, moved.key]);
        }
        return refresh().catch(() => {});
      });
  };
  const shiftFor = (index: number): string | undefined => {
    if (!drag) return undefined;
    if (index === drag.from) return `translateY(${drag.dy}px)`;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return `translateY(-${drag.height}px)`;
    if (drag.to < drag.from && index >= drag.to && index < drag.from) return `translateY(${drag.height}px)`;
    return undefined;
  };

  // What is on screen changes at once. Refused or with no signal, that card alone goes back to how it stood before its
  // first change still on its way, and says so.
  const send = (key: string, run: () => Promise<boolean>) => {
    setFailed((f) => f.filter((x) => x !== key));
    const mine = unsettled.current.get(key);
    if (mine) mine.count++;
    else {
      const at = cards.findIndex((x) => x.key === key);
      unsettled.current.set(key, { row: cards[at] ?? null, at, count: 1, bad: false });
    }
    const settle = (ok: boolean) => {
      const entry = unsettled.current.get(key);
      if (!entry) return;
      entry.count--;
      if (!ok) entry.bad = true;
      if (entry.count > 0) return;
      unsettled.current.delete(key);
      if (!entry.bad) return;
      setFailed((f) => [...f, key]);
      const row = entry.row;
      if (row) {
        onCards((list) => {
          const rest = list.filter((x) => x.key !== key);
          const at = Math.min(entry.at, rest.length);
          return [...rest.slice(0, at), row, ...rest.slice(at)];
        });
      }
    };
    run()
      .catch(() => false)
      .then((ok) => {
        settle(ok);
        return refresh().catch(() => {});
      });
  };
  const setItems = (key: string, items: SavedItem[]) => onCards((list) => list.map((x) => (x.key === key ? { ...x, items } : x)));

  const finishCreate = (value: string) => {
    setCreating(false);
    const clean = value.trim();
    if (!clean) return;
    const temp = `-${Date.now()}`;
    setCreateFailed(false);
    const card: EditCard = { key: temp, name: clean, picture: null, thumb: null, items: [] };
    // Always on top (10 Nov, Alex), brought into view when the button that added it is at the foot.
    onCards((all) => [card, ...all]);
    if (addAt === "bottom") list.current?.closest(".cn-body")?.scrollTo({ top: 0, behavior: "smooth" });
    actions
      .create(clean)
      .catch(() => null)
      .then((key) => {
        if (key) onCards((list) => list.map((x) => (x.key === temp ? { ...x, key } : x)));
        else {
          onCards((list) => list.filter((x) => x.key !== temp));
          setCreateFailed(true);
        }
        return refresh().catch(() => {});
      });
  };
  const addFood = (c: EditCard, food: FoodOptionView, grams: number, serving: string | null) => {
    setItems(c.key, [...c.items, { food_id: food.id, name: food.name, grams, serving, ...rowOf(food, grams) }]);
    const onceKey = newOnceKey();
    send(c.key, () => actions.addFood(c, food.id, grams, serving, onceKey));
  };
  const changeFood = (c: EditCard, index: number, grams: number, serving: string | null) => {
    const item = c.items[index];
    if (!item || !(item.grams > 0)) return;
    const k = grams / item.grams;
    setItems(c.key, c.items.map((x, i) => (i === index ? { ...x, grams, serving, kcal: r1(x.kcal * k), protein: r1(x.protein * k), carbs: r1(x.carbs * k), fat: r1(x.fat * k) } : x)));
    send(c.key, () => actions.changeFood(c, index, item.food_id, grams, serving));
  };
  const removeFood = (c: EditCard, index: number) => {
    const item = c.items[index];
    if (!item) return;
    setPanel(null);
    setItems(c.key, c.items.filter((_, i) => i !== index));
    const onceKey = newOnceKey();
    send(c.key, () => actions.removeFood(c, index, item.food_id, onceKey));
  };
  const finishRename = (c: EditCard, value: string) => {
    setRenaming(null);
    const clean = value.trim();
    if (!clean || clean === c.name) return;
    onCards((list) => list.map((x) => (x.key === c.key ? { ...x, name: clean } : x)));
    send(c.key, () => actions.rename(c, clean));
  };
  const removeCard = (c: EditCard) => {
    setAskDelete(null);
    setPanel(null);
    setOpenKey((o) => (o === c.key ? null : o));
    onCards((list) => list.filter((x) => x.key !== c.key));
    send(c.key, () => actions.remove(c));
  };
  const pickPhotoFor = (c: EditCard) => {
    photoFor.current = c;
    photoInput.current?.click();
  };
  const closePhoto = () => {
    setPhotoOf(null);
    setAskDropPhoto(false);
  };
  const sendPhoto = (c: EditCard, file: File) => {
    const local = URL.createObjectURL(file);
    pickedUrls.current.push(local);
    setPicked((p) => ({ ...p, [c.key]: local }));
    const forget = () => setPicked((p) => (p[c.key] === local ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== c.key)) : p));
    setPhotoBusy((b) => [...b, c.key]);
    setPhotoFailed(null);
    closePhoto();
    actions
      .upload(c, file)
      .then(async (ok) => {
        if (!ok) {
          setPhotoFailed(c.key);
          forget();
        }
        await refresh().catch(() => {});
      })
      .catch(() => {
        setPhotoFailed(c.key);
        forget();
      })
      .finally(() => setPhotoBusy((b) => b.filter((x) => x !== c.key)));
  };
  const dropPhoto = (c: EditCard) => {
    closePhoto();
    setPicked((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== c.key)));
    onCards((list) => list.map((x) => (x.key === c.key ? { ...x, picture: null, thumb: null } : x)));
    send(c.key, () => actions.dropPicture(c));
  };

  // A tap anywhere on the card opens its foods, one card at a time, as the day's cards; one with nothing in it doesn't open.
  const tapCard = (e: React.MouseEvent, c: EditCard) => {
    if ((e.target as Element).closest(".fdc-tools, .fdc-more, input")) return;
    if (renaming === c.key || locked || isTempCard(c.key)) return;
    // The click a drag's release leaves behind is not a tap.
    if (draggedAt.current && e.timeStamp - draggedAt.current < 400) return;
    if (onOpen) return onOpen(c, e.currentTarget as HTMLElement);
    if (panel?.key === c.key && panel.kind !== "search") {
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    if (panel?.key === c.key) {
      setPanel(null);
      setOpenKey(null);
      return;
    }
    if (c.items.length === 0) return;
    setPanel(null);
    setOpenKey((o) => (o === c.key ? null : c.key));
  };
  const tapPlus = (c: EditCard) => {
    if (panel?.key === c.key && panel.kind !== "search") return;
    if (panel?.key === c.key) return setPanel(null);
    setOpenKey(c.key);
    setPanel({ key: c.key, kind: "search" });
  };

  const shown = photoOf != null ? cards.find((c) => c.key === photoOf) ?? null : null;
  const deleting = askDelete != null ? cards.find((c) => c.key === askDelete) ?? null : null;
  // The title first, in the button's own room so nothing moves (10 Nov, Alex: "whenever I press that button, the size changes"); left blank, it goes.
  const addOrName = renderAdd(
    () => setCreating(true),
    creating ? (
      <input
        className="fdi-title-input"
        type="text"
        placeholder="Name this meal"
        maxLength={40}
        autoComplete="off"
        autoFocus
        aria-label="Meal name"
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = "";
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => finishCreate(e.currentTarget.value)}
      />
    ) : null
  );
  return (
    <>
      {addAt === "top" && addOrName}
      {createFailed && (
        <p className="fdi-photo-failed" role="alert">
          Not saved. Try again
        </p>
      )}
      <section ref={list} className="fdi-meals fdc-meals">
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            const c = photoFor.current;
            photoFor.current = null;
            if (file && c) sendPhoto(c, file);
          }}
        />
        {cards.map((c, index) => {
          const naming = renaming === c.key;
          const here = panel?.key === c.key ? panel : null;
          const filled = c.items.length > 0;
          const unfolded = openKey === c.key && (filled || here != null);
          const local = picked[c.key] ?? null;
          const busy = photoBusy.includes(c.key);
          const tools = !naming && !locked && !isTempCard(c.key);
          const tot = (k: MacroKey) => Math.round(c.items.reduce((t, i) => t + i[k], 0));
          const shownPicture = c.picture ?? c.fallback?.picture ?? null;
          return (
            <div
              key={c.key}
              ref={(el) => {
                if (el) cardEls.current.set(c.key, el);
                else cardEls.current.delete(c.key);
              }}
              className={`fdi-meal fdc-meal${unfolded ? " open" : ""}${stacked ? " fdi-stack" : ""}${drag?.from === index ? " lifted" : ""}${drag ? " shifting" : ""}`}
              style={{ transform: shiftFor(index), ...(stacked ? { paddingTop: stackEdges(c.stack) * 6 } : {}) }}
              data-edges={stacked ? stackEdges(c.stack) : undefined}
            >
              {stacked &&
                Array.from({ length: stackEdges(c.stack) }, (_, k) => (
                  // The nearest edge darkest, each one further back 6px higher and 12px narrower a side.
                  <span key={k} className="fdi-stack-edge" aria-hidden="true" style={{ top: (stackEdges(c.stack) - 1 - k) * 6, left: (k + 1) * 12, right: (k + 1) * 12, background: EDGE_TONES[k] }} />
                ))}
              <div className={`fdc-card${shownPicture || (busy && local) ? "" : " bare"}${filled || onOpen ? "" : " shut"}`} onClick={(e) => tapCard(e, c)}>
                <div className="fdc-bg" aria-hidden="true">
                  {busy && local ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the phone's own copy, just picked
                    <img src={local} alt="" draggable={false} />
                  ) : (
                    shownPicture && <CardPicture src={pic(shownPicture, 1080)} under={local ?? (c.picture ? c.thumb : c.fallback?.thumb ?? null)} />
                  )}
                </div>
                {tools && (
                  <>
                    <span className="fdi-meal-more-wrap fdc-more">
                      <button type="button" className="fdc-tool" onClick={() => setMenu(menu === c.key ? null : c.key)} aria-expanded={menu === c.key} aria-label={`More for ${c.name}`}>
                        <MoreIcon />
                      </button>
                      {menu === c.key && (
                        <>
                          <button type="button" className="fdi-meal-menu-scrim" aria-label="Close" onClick={() => setMenu(null)} />
                          <span className="fdi-meal-menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenu(null);
                                setRenaming(c.key);
                              }}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="danger"
                              onClick={() => {
                                setMenu(null);
                                setAskDelete(c.key);
                              }}
                            >
                              Delete
                            </button>
                          </span>
                        </>
                      )}
                    </span>
                    <span className="fdc-tools">
                      {busy ? (
                        <span className="fdc-tool fdi-photo-busy" role="status" aria-label={`Adding the picture of ${c.name}`}>
                          <CameraIcon />
                        </span>
                      ) : (
                        <button type="button" className="fdc-tool" onClick={() => (c.picture ? setPhotoOf(c.key) : pickPhotoFor(c))} aria-label={c.picture ? `See your picture of ${c.name}` : `Add a picture of ${c.name}`}>
                          <CameraIcon />
                        </button>
                      )}
                      {!onOpen && (
                        <button type="button" className="fdc-tool" onClick={() => tapPlus(c)} aria-label={`Add food to ${c.name}`}>
                          <PlusIcon />
                        </button>
                      )}
                    </span>
                  </>
                )}
                <div className="fdc-name">
                  {naming ? (
                    <span className="fdc-handle naming">
                      <input
                        className="fdi-meal-name-box fdc-name-box"
                        type="text"
                        defaultValue={c.name}
                        placeholder="Name the meal"
                        maxLength={40}
                        autoComplete="off"
                        autoFocus
                        aria-label="Meal name"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") {
                            e.currentTarget.value = "";
                            e.currentTarget.blur();
                          }
                        }}
                        onBlur={(e) => finishRename(c, e.currentTarget.value)}
                      />
                    </span>
                  ) : onReorder && tools ? (
                    <span className="fdc-handle" onPointerDown={(e) => holdStart(e, index)} onPointerMove={holdMove} onPointerUp={holdEnd} onPointerCancel={holdEnd} onContextMenu={(e) => e.preventDefault()}>
                      <span className="fdc-title">{c.name}</span>
                    </span>
                  ) : (
                    <span className="fdc-title">{c.name}</span>
                  )}
                  {(filled || onOpen) && !naming && (
                    <button type="button" className={`fdi-meal-chev fdc-chev${unfolded ? " up" : ""}`} aria-expanded={unfolded} aria-label={unfolded ? `Fold ${c.name}` : `Open ${c.name}`}>
                      <ChevronDownIcon />
                    </button>
                  )}
                </div>
                {!naming &&
                  (filled ? (
                    <div className="fdc-figs" role="group" aria-label={`${c.name}: ${n(tot("kcal"))} kcal`}>
                      <b>{n(tot("kcal"))} kcal</b>
                      <span>P {n(tot("protein"))}</span>
                      <span>C {n(tot("carbs"))}</span>
                      <span>F {n(tot("fat"))}</span>
                    </div>
                  ) : (
                    <div className="fdc-figs none">Nothing logged</div>
                  ))}
              </div>
              {photoFailed === c.key && (
                <p className="fdi-photo-failed" role="alert">
                  Picture not added. Try again
                </p>
              )}
              {failed.includes(c.key) && (
                <p className="fdi-photo-failed" role="alert">
                  Not saved. Try again
                </p>
              )}
              <div className={`so-fold fdc-fold${unfolded ? " open" : ""}`} aria-hidden={!unfolded} inert={!unfolded}>
                <div className="so-fold-in">
                  <div className="fdc-foods">
                    {c.items.length > 0 && (
                    <div className="fdc-spine">
                    {c.items.map((it, i) => {
                      const selected = here?.kind === "amount" && here.index === i;
                      const per100 = (v: number) => (it.grams > 0 ? (v / it.grams) * 100 : 0);
                      const food: FoodOptionView = { id: it.food_id, name: it.name, hint: "", group: "more", kcal: per100(it.kcal), protein: per100(it.protein), carbs: per100(it.carbs), fat: per100(it.fat), servings: [] };
                      return (
                        <div key={`${i}:${it.food_id}`} className={`fdi-row-wrap${selected ? " selected" : ""}`}>
                          <button type="button" className={`fdi-row${selected ? " selected" : ""}`} onClick={() => setPanel(selected ? null : { key: c.key, kind: "amount", food, index: i })}>
                            <span className="fdi-row-main">
                              <span className="fdi-row-name">{it.name}</span>
                              <span className="fdi-row-amount">
                                <Bars parts={foodFacts(it)} />
                              </span>
                            </span>
                            <span className="fdc-row-kcal">{n(it.kcal)} kcal</span>
                          </button>
                          {selected && here?.kind === "amount" && (
                            <AmountPanel
                              clientId={clientId}
                              date={date}
                              meal={`saved-${c.key}`}
                              mealLabel={c.name}
                              food={here.food}
                              entry={{ ...it, id: i, meal: `saved-${c.key}` }}
                              apply={noApply}
                              settle={noApply}
                              onDraft={(grams, serving) => changeFood(c, i, grams, serving)}
                              onRemove={() => removeFood(c, i)}
                              onDone={() => setPanel(null)}
                              onCancel={() => setPanel(null)}
                            />
                          )}
                        </div>
                      );
                    })}
                    {!onOpen && <SpineAdd label={`Add food to ${c.name}`} on={here?.kind === "search"} onClick={() => tapPlus(c)} action={here ? null : foot?.(c)} />}
                    </div>
                    )}
                    {here?.kind === "search" ? (
                      <SearchPanel
                        clientId={clientId}
                        date={date}
                        meal={`saved-${c.key}`}
                        mealLabel={c.name}
                        recent={recent}
                        onQuickAdd={(food, grams, serving) => {
                          addFood(c, food, grams, serving);
                          setPanel(null);
                        }}
                        saved={NO_SAVED}
                        onPick={(food) => setPanel({ key: c.key, kind: "amount", food })}
                        onCustom={() => setPanel({ key: c.key, kind: "custom" })}
                        onCopied={() => setPanel(null)}
                        onCancel={() => setPanel(null)}
                      />
                    ) : here?.kind === "amount" && here.index == null ? (
                      <AmountPanel
                        clientId={clientId}
                        date={date}
                        meal={`saved-${c.key}`}
                        mealLabel={c.name}
                        food={here.food}
                        apply={noApply}
                        settle={noApply}
                        onDraft={(grams, serving) => addFood(c, here.food, grams, serving)}
                        onDone={() => setPanel(null)}
                        onCancel={() => setPanel({ key: c.key, kind: "search" })}
                      />
                    ) : here?.kind === "custom" ? (
                      <CustomFoodPanel clientId={clientId} onCancel={() => setPanel({ key: c.key, kind: "search" })} onCreated={(food) => setPanel({ key: c.key, kind: "amount", food })} />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {deleting && <DeleteMealDialog name={deleting.name} text={deleteText} onCancel={() => setAskDelete(null)} onDelete={() => removeCard(deleting)} />}
        {shown?.picture && (
          <div className="fdi-photo-scrim" role="presentation" onClick={closePhoto}>
            <div className="fdi-photo-sheet" role="dialog" aria-modal="true" aria-label={`Your picture of ${shown.name}`} onClick={(e) => e.stopPropagation()}>
              <div className="fdi-sheet-head">
                <span />
                <span className="fdi-sheet-title">{shown.name}</span>
                <button type="button" className="fdi-sheet-x" onClick={closePhoto} aria-label="Close">
                  ×
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- the client’s own upload */}
              <img className="fdi-photo-shot" src={shown.picture} alt={`Your picture of ${shown.name}`} />
              {askDropPhoto ? (
                <div className="fdi-photo-actions fdc-photo-ask">
                  <span className="fdc-photo-ask-q">Remove picture?</span>
                  <span className="fdc-photo-ask-do">
                    <button type="button" className="fdc-photo-cancel" onClick={() => setAskDropPhoto(false)}>
                      Cancel
                    </button>
                    <button type="button" className="fdi-photo-remove" onClick={() => dropPhoto(shown)}>
                      Remove
                    </button>
                  </span>
                </div>
              ) : (
                <div className="fdi-photo-actions">
                  <button type="button" className="fdi-photo-replace" onClick={() => pickPhotoFor(shown)}>
                    Replace
                  </button>
                  <button type="button" className="fdi-photo-remove" onClick={() => setAskDropPhoto(true)}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      {addAt === "bottom" && addOrName}
    </>
  );
}

/** A saved meal with its foods changed: the figures on its row follow. */
function withItems(s: SavedMealRow, items: SavedItem[]): SavedMealRow {
  const tot = (k: MacroKey) => Math.round(items.reduce((t, i) => t + i[k], 0));
  return { ...s, items, count: items.length, names: [...new Set(items.map((i) => i.name))], kcal: tot("kcal"), protein: tot("protein"), carbs: tot("carbs"), fat: tot("fat") };
}
const cardOfSaved = (s: SavedMealRow): EditCard => ({ key: String(s.id), name: s.name, picture: s.picture, thumb: s.thumb, items: s.items });

function SavedMealList({
  clientId,
  date,
  saved,
  recent,
  busy,
  onChange,
  refresh,
  onUse,
  useFailed,
}: {
  clientId: number;
  date: string;
  saved: FoodDiaryProps["saved"];
  recent: FoodOptionView[];
  busy: boolean;
  onChange: (fn: (list: FoodDiaryProps["saved"]) => FoodDiaryProps["saved"]) => void;
  refresh: () => Promise<void>;
  onUse: (id: number) => void;
  useFailed: number | null;
}) {
  const form = (c: EditCard) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", c.key);
    return fd;
  };
  const food = (c: EditCard, op: string, foodId: string, extra: Record<string, string>) => {
    const fd = form(c);
    fd.set("op", op);
    fd.set("foodId", foodId);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    return changeSavedMealFoodAction(fd);
  };
  const actions: CardActions = {
    create: async (name) => {
      const fd = new FormData();
      fd.set("clientId", String(clientId));
      fd.set("name", name);
      fd.set("onceKey", newOnceKey());
      const id = await createSavedMealCardAction(fd);
      return id != null ? String(id) : null;
    },
    rename: (c, name) => {
      const fd = form(c);
      fd.set("name", name);
      return renameSavedMealAction(fd);
    },
    addFood: (c, foodId, grams, serving, onceKey) => food(c, "add", foodId, { grams: String(grams), serving: serving ?? "", onceKey }),
    changeFood: (c, index, foodId, grams, serving) => food(c, "update", foodId, { index: String(index), grams: String(grams), serving: serving ?? "" }),
    removeFood: (c, index, foodId, onceKey) => food(c, "remove", foodId, { index: String(index), onceKey }),
    remove: async (c) => {
      await deleteSavedMealAction(form(c));
      return true;
    },
    upload: (c, file) => {
      const fd = form(c);
      fd.set("file", file);
      return uploadSavedMealPictureAction(fd);
    },
    dropPicture: (c) => removeSavedMealPictureAction(form(c)),
  };
  return (
    <EditableMealCards
      clientId={clientId}
      date={date}
      cards={saved.map(cardOfSaved)}
      deleteText="What you logged with it stays in your diary."
      recent={recent}
      addAt="top"
      renderAdd={(start, input) =>
        input ? (
          <div className="fdi-saved-pill fdi-saved-this fdi-saved-wide typing">
            <PlusIcon />
            {input}
          </div>
        ) : (
          <button type="button" className="fdi-saved-pill fdi-saved-this fdi-saved-wide" onClick={start}>
            <PlusIcon />
            <span>Create a meal</span>
          </button>
        )
      }
      onCards={(fn) =>
        onChange((list) =>
          fn(list.map(cardOfSaved)).map((c) => {
            const old = list.find((x) => String(x.id) === c.key);
            const base: SavedMealRow = old ?? { id: Number(c.key), name: c.name, kcal: 0, protein: 0, carbs: 0, fat: 0, picture: null, thumb: null, count: 0, names: [], items: [] };
            return withItems({ ...base, id: Number(c.key), name: c.name, picture: c.picture, thumb: c.thumb }, c.items);
          })
        )
      }
      refresh={refresh}
      actions={actions}
      foot={(c) =>
        c.items.length > 0 && (
          <>
            {useFailed === Number(c.key) && <span className="fdi-make-failed">Not added. Try again</span>}
            <button type="button" className="fdc-save" onClick={() => onUse(Number(c.key))} disabled={busy}>
              Use
            </button>
          </>
        )
      }
    />
  );
}

const cardOfSavedDay = (d: SavedDayRow): EditCard => {
  const first = d.cards.find((c) => c.picture);
  return { key: String(d.id), name: d.name, picture: d.picture, thumb: d.thumb, fallback: first?.picture ? { picture: first.picture, thumb: first.thumb } : undefined, items: d.cards.flatMap((c) => c.items), stack: d.cards.length };
};
type DayDeploy = { top: number; el: HTMLElement | null };

// Saved days as cards (10 Nov, Alex: A of docs/boards/saved-cards-mockup.html): the meal card with two edges behind it, so a
// day reads as a day at a glance, its picture and ⋯ as a card's; a tap deploys the day.
function SavedDayList({
  clientId,
  date,
  days,
  onDays,
  refresh,
  onOpen,
}: {
  clientId: number;
  date: string;
  days: FoodDiaryProps["savedDays"];
  onDays: (fn: (list: FoodDiaryProps["savedDays"]) => FoodDiaryProps["savedDays"]) => void;
  refresh: () => Promise<void>;
  onOpen: (id: number, el: HTMLElement) => void;
}) {
  // A row put back after a refused delete: the list no longer holds it by then.
  const known = useRef(new Map<string, SavedDayRow>());
  for (const d of days) known.current.set(String(d.id), d);
  const form = (c: EditCard) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", c.key);
    return fd;
  };
  const no = async () => false;
  const actions: CardActions = {
    create: async () => null,
    addFood: no,
    changeFood: no,
    removeFood: no,
    rename: (c, name) => {
      const fd = form(c);
      fd.set("name", name);
      return renameSavedDayAction(fd);
    },
    remove: async (c) => {
      await deleteSavedDayAction(form(c));
      return true;
    },
    upload: (c, file) => {
      const fd = form(c);
      fd.set("key", DAY_COVER);
      fd.set("file", file);
      return uploadSavedDayPictureAction(fd);
    },
    dropPicture: (c) => {
      const fd = form(c);
      fd.set("key", DAY_COVER);
      fd.set("op", "picture-remove");
      return changeSavedDayCardAction(fd);
    },
  };
  return (
    <EditableMealCards
      clientId={clientId}
      date={date}
      cards={days.map(cardOfSavedDay)}
      deleteText="What you logged with it stays in your diary."
      recent={NO_FOODS}
      addAt="top"
      renderAdd={() => null}
      stacked
      onOpen={(c, el) => onOpen(Number(c.key), el)}
      onCards={(fn) =>
        onDays((list) =>
          fn(list.map(cardOfSavedDay)).flatMap((c) => {
            const old = list.find((x) => String(x.id) === c.key) ?? known.current.get(c.key);
            return old ? [{ ...old, name: c.name, picture: c.picture, thumb: c.thumb }] : [];
          })
        )
      }
      refresh={refresh}
      actions={actions}
    />
  );
}

const DEFAULT_DAY_CARDS: EditCard[] = [
  { key: "breakfast", name: "Breakfast", picture: null, thumb: null, items: [] },
  { key: "lunch", name: "Lunch", picture: null, thumb: null, items: [] },
  { key: "dinner", name: "Dinner", picture: null, thumb: null, items: [] },
  { key: "snacks", name: "Snacks", picture: null, thumb: null, items: [] },
];
// A soft start: with an ease-out the far cards jumped 50px a frame at first, which reads as lag.
const DAY_EASE = "cubic-bezier(.32, 0, .16, 1)";

// Inside a day (10 Nov, Alex: A of docs/boards/saved-cards-mockup.html): its name as the page's title, Rename and Delete in
// the ⋯ at the top. A tap on its card deploys it (10 Nov, Alex: "bum bum bum, they expand"): the cards come out from behind
// the card that was pressed, one after another, down to their places, while the rest of the list goes.
function SavedDayScreen({
  clientId,
  date,
  day,
  recent,
  busy,
  useFailed,
  from,
  onCreate,
  onDay,
  refresh,
  onBack,
  onUse,
  onDelete,
}: {
  clientId: number;
  date: string;
  /** Null: not named yet. */
  day: SavedDayRow | null;
  recent: FoodOptionView[];
  busy: boolean;
  useFailed: boolean;
  /** Where it deploys from: the card or pill that was pressed. */
  from: DayDeploy | null;
  /** False when it wasn't saved. */
  onCreate: (name: string) => Promise<boolean>;
  onDay: (id: number, fn: (d: SavedDayRow) => SavedDayRow) => void;
  refresh: () => Promise<void>;
  onBack: () => void;
  onUse: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [name, setName] = useState(day?.name ?? "");
  const [nameFailed, setNameFailed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [menu, setMenu] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const making = useRef(false);
  const id = day?.id ?? null;
  const root = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const [deploying, setDeploying] = useState(!!from);

  /** The pressed card over everything, fading as the day's come out of it (or back into it). */
  const ghostOf = (layer: HTMLElement, el: HTMLElement) => {
    const box = el.getBoundingClientRect();
    const at = layer.getBoundingClientRect();
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.inert = true;
    Object.assign(ghost.style, { position: "absolute", top: `${box.top - at.top}px`, left: `${box.left - at.left}px`, width: `${box.width}px`, height: `${box.height}px`, margin: "0", zIndex: "40", pointerEvents: "none" });
    layer.append(ghost);
    return ghost;
  };
  const stillMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dayCards = () => [...(root.current?.querySelectorAll<HTMLElement>(".fdc-meal") ?? [])];
  /** Where a card starts from, or folds back to: behind the pressed one, as its edges are drawn. */
  const behind = (el: HTMLElement, i: number, top: number) => {
    const box = el.getBoundingClientRect();
    // Into the edges the pressed card draws (one a card past the first); from Create a day, two.
    const edges = from?.el ? Number(from.el.closest<HTMLElement>(".fdi-stack")?.dataset.edges ?? 0) : 2;
    const level = Math.min(i, edges);
    return `translateY(${top - box.top - level * 6}px) scale(${1 - (level * 24) / box.width})`;
  };

  useLayoutEffect(() => {
    const layer = root.current;
    if (!layer || !from || stillMotion()) {
      setDeploying(false);
      return;
    }
    const cards = dayCards();
    const running: Animation[] = [];
    const rest = (el: HTMLElement) => {
      el.style.zIndex = "";
      el.style.willChange = "";
    };
    // Measured first, every card at its own place: an animation already holding a card would skew the next one's figures.
    const starts = cards.map((el, i) => behind(el, i, from.top));
    cards.forEach((el, i) => {
      el.style.zIndex = String(cards.length - i);
      el.style.willChange = "transform";
      const start = { transform: starts[i], ...(from.el ? {} : { opacity: 0 }) };
      const end = { transform: "none", ...(from.el ? {} : { opacity: 1 }) };
      const move = el.animate([start, end], { duration: 640, delay: 60 + i * 70, easing: DAY_EASE, fill: "backwards" });
      move.onfinish = () => rest(el);
      running.push(move);
    });
    let ghost: HTMLElement | null = null;
    if (from.el) {
      const shown = ghostOf(layer, from.el);
      ghost = shown;
      shown.style.willChange = "opacity";
      const fade = shown.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 110, easing: "ease", fill: "both" });
      fade.onfinish = () => shown.remove();
      running.push(fade);
    }
    const done = setTimeout(() => setDeploying(false), 1300);
    // Undone whole, so an effect run twice (React's strict mode, in development) starts from the cards' true places.
    return () => {
      clearTimeout(done);
      running.forEach((a) => a.cancel());
      cards.forEach(rest);
      ghost?.remove();
    };
    // Once, as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back folds the cards away into the card they came from.
  const leave = () => {
    const layer = root.current;
    // Now, not after: a name still typed makes a card on top, and it has to be there when the cards are measured.
    const body = layer?.querySelector<HTMLElement>(".cn-body");
    const scrolledTo = body?.scrollTop ?? 0;
    flushSync(() => (document.activeElement as HTMLElement | null)?.blur?.());
    body?.scrollTo({ top: scrolledTo, behavior: "instant" });
    if (leaving.current) return;
    if (!layer || !from || stillMotion() || !from.el?.isConnected) return onBack();
    leaving.current = true;
    const cards = dayCards();
    const now = cards.map((el) => getComputedStyle(el).transform);
    cards.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    // Each card runs its whole way before anything goes (10 Nov, Alex: "they don't really collapse all the way through").
    const stagger = 45;
    const run = 360;
    const whole = (cards.length - 1) * stagger + run;
    cards.forEach((el, i) => {
      el.style.zIndex = String(cards.length - i);
      el.style.willChange = "transform";
      el.animate([{ transform: now[i] }, { transform: behind(el, i, from.top) }], { duration: run, delay: (cards.length - 1 - i) * stagger, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "both" });
    });
    const ghost = ghostOf(layer, from.el);
    ghost.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, delay: whole - 140, easing: "ease", fill: "both" });
    cover.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay: whole - 60, easing: "ease", fill: "forwards" });
    for (const part of layer.querySelectorAll<HTMLElement>(".cn-header, .fdi-day-head, .fdi-add-meal, .fdi-day-foot, .fdc-fold")) part.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease", fill: "forwards" });
    setTimeout(onBack, whole + 110);
  };

  const commitName = () => {
    const clean = name.trim();
    if (id == null) {
      if (!clean || making.current) return;
      making.current = true;
      setNameFailed(false);
      onCreate(clean)
        .catch(() => false)
        .then((ok) => {
          making.current = false;
          if (!ok) setNameFailed(true);
        });
      return;
    }
    setRenaming(false);
    if (!clean) {
      setName(day?.name ?? "");
      return;
    }
    if (clean === day?.name) return;
    const before = day?.name ?? "";
    onDay(id, (d) => ({ ...d, name: clean }));
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", String(id));
    fd.set("name", clean);
    setNameFailed(false);
    renameSavedDayAction(fd)
      .catch(() => false)
      .then((ok) => {
        if (!ok) {
          setNameFailed(true);
          setName(before);
          onDay(id, (d) => (d.name === clean ? { ...d, name: before } : d));
        }
        return refresh().catch(() => {});
      });
  };
  const change = (c: EditCard | null, op: string, extra: Record<string, string>) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", String(id));
    fd.set("key", c ? c.key : (extra.key ?? ""));
    fd.set("op", op);
    for (const [k, v] of Object.entries(extra)) if (k !== "key") fd.set(k, v);
    return changeSavedDayCardAction(fd);
  };
  const actions: CardActions = {
    create: async (cardName) => {
      const key = `c:${Date.now()}`;
      const ok = await change(null, "card-add", { key, name: cardName, onceKey: newOnceKey() });
      return ok ? key : null;
    },
    rename: (c, cardName) => change(c, "card-rename", { name: cardName }),
    addFood: (c, foodId, grams, serving, onceKey) => change(c, "food-add", { foodId, grams: String(grams), serving: serving ?? "", onceKey }),
    changeFood: (c, index, foodId, grams, serving) => change(c, "food-update", { index: String(index), foodId, grams: String(grams), serving: serving ?? "" }),
    removeFood: (c, index, foodId, onceKey) => change(c, "food-remove", { index: String(index), foodId, onceKey }),
    remove: (c) => change(c, "card-remove", {}),
    upload: (c, file) => {
      const fd = new FormData();
      fd.set("clientId", String(clientId));
      fd.set("id", String(id));
      fd.set("key", c.key);
      fd.set("file", file);
      return uploadSavedDayPictureAction(fd);
    },
    dropPicture: (c) => change(c, "picture-remove", {}),
  };
  const cards = day?.cards ?? DEFAULT_DAY_CARDS;
  const all = cards.flatMap((c) => c.items);
  const sum = (k: MacroKey) => Math.round(all.reduce((t, i) => t + i[k], 0));
  const typing = id == null || renaming;
  return (
    <div ref={root} className={`app-layer app-layer-push cn-screen fdi-saved-screen fdi-dayscreen${deploying ? " deploy" : ""}`}>
      <div ref={cover} className="fdi-day-cover" aria-hidden="true" />
      <header className="cn-header">
        <button type="button" className="cn-icon-btn" onClick={leave} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">{id == null ? "Create a day" : "Saved day"}</h1>
        </div>
        {id == null ? (
          <span className="cn-icon-spacer" aria-hidden="true" />
        ) : (
          <span className="fdi-day-more">
            <button type="button" className="cn-icon-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label={`More for ${day?.name ?? "this day"}`}>
              <MoreIcon />
            </button>
            {menu && (
              <>
                <button type="button" className="fdi-meal-menu-scrim" aria-label="Close" onClick={() => setMenu(false)} />
                <span className="fdi-meal-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      setRenaming(true);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={() => {
                      setMenu(false);
                      setAskDelete(true);
                    }}
                  >
                    Delete
                  </button>
                </span>
              </>
            )}
          </span>
        )}
      </header>
      <main className="cn-body">
        <div className="fdi-day-head">
          <div className="fdi-day-eyebrow">Day</div>
          {typing ? (
            <input
              className="fdi-day-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="Name this day"
              maxLength={40}
              autoComplete="off"
              autoFocus
              aria-label="Name of the day"
            />
          ) : (
            <h2 className="fdi-day-title">{day?.name}</h2>
          )}
          <div className="fdi-day-facts">{all.length > 0 && <Bars parts={[`${n(sum("kcal"))} kcal`, `P ${n(sum("protein"))}`, `C ${n(sum("carbs"))}`, `F ${n(sum("fat"))}`]} />}</div>
          {nameFailed && (
            <p className="fdi-photo-failed" role="alert">
              Not saved. Try again
            </p>
          )}
        </div>
        <EditableMealCards
          clientId={clientId}
          date={date}
          cards={cards}
          recent={recent}
          locked={id == null}
          addAt="bottom"
          onReorder={(keys) => change(null, "card-order", { key: "@order", order: keys.join(",") })}
          renderAdd={(start, input) =>
            id != null &&
            (input ? (
              <div className="fdi-add-meal fdc-add typing">{input}</div>
            ) : (
              <button type="button" className="fdi-add-meal fdc-add" onClick={start}>
                <PlusIcon />
                Add a meal
              </button>
            ))
          }
          onCards={(fn) => {
            if (id != null)
              onDay(id, (d) => {
                const next = fn(d.cards);
                const items = next.flatMap((c) => c.items);
                return { ...d, cards: next.map(({ key, name: cardName, picture, thumb, items: foods }) => ({ key, name: cardName, picture, thumb, items: foods })), count: items.length, kcal: Math.round(items.reduce((t, i) => t + i.kcal, 0)) };
              });
          }}
          refresh={refresh}
          actions={actions}
        />
        {id != null && all.length > 0 && (
          <div className="fdi-day-foot">
            {useFailed && <p className="fdi-photo-failed" role="alert">Not added. Try again</p>}
            <button type="button" className="fdi-day-use" onClick={() => onUse(id)} disabled={busy}>
              Use
            </button>
          </div>
        )}
      </main>
      {askDelete && day && (
        <DeleteMealDialog
          name={day.name}
          text="What you logged with it stays in your diary."
          onCancel={() => setAskDelete(false)}
          onDelete={() => {
            setAskDelete(false);
            onDelete(day.id);
          }}
        />
      )}
    </div>
  );
}

/** The end of a meal's line (11 Nov, Alex: "the hairline keeps going to a second dot with a plus sign and we add items
 * from there too"): a ring with a +, on the line under the last food, adding as the card's + does; ink while its search
 * is open, as anything on is. */
function SpineAdd({ label, on, onClick, action }: { label: string; on: boolean; onClick: () => void; /** The meal's one action in words, on the right of the ring's row (Save meal, Update {name}, Use). */ action?: ReactNode }) {
  return (
    <div className="fdc-spine-add">
      {action && <div className="fdc-spine-act">{action}</div>}
      <button type="button" className={`fdc-spine-plus${on ? " on" : ""}`} onClick={onClick} aria-label={label} aria-pressed={on}>
        <span className="fdc-spine-ring" aria-hidden="true">
          <PlusIcon />
        </span>
      </button>
    </div>
  );
}

function AmountPanel({
  clientId,
  date,
  meal,
  mealLabel,
  food,
  entry,
  apply,
  settle,
  onDraft,
  onRemove,
  onDone,
  onCancel,
}: {
  /** Creating a meal or a day: the food is kept by the screen, nothing is logged. */
  onDraft?: (grams: number, serving: string | null) => void;
  /** Takes the food off: the screen's own remove, so a saved card or the day keeps its place. */
  onRemove?: () => void;
  clientId: number;
  date: string;
  meal: FoodMeal;
  mealLabel: string;
  food: FoodOptionView;
  entry?: FoodEntryView;
  /** Shows the change on the day at once. */
  apply: (fn: (d: FoodDiaryProps) => FoodDiaryProps) => void;
  /** Puts the server's day in place of the guess. */
  settle: (forDate: string, next: FoodDiaryProps | null) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  // A number and a unit. The unit list is grams, ml and l for a liquid, and
  // the food's own portions ("1 slice", "1 large"), each worth so many grams;
  // what is saved is number × unit, in grams, with the unit's name when it is
  // not grams. No ounces (24 Oct, Alex: metric). A liquid's density comes with
  // the catalog food (`ml`); a packaged one is weighed by the fluid ounce (or a
  // plain cup); the client's own foods are taken as water.
  const liquid = food.servings.find(([label]) => /^fl oz\b/i.test(label)) ?? food.servings.find(([label]) => /^cup$/i.test(label));
  const density = food.ml ?? (liquid ? liquid[1] / (/^fl oz/i.test(liquid[0]) ? ML_PER_FL_OZ : ML_PER_CUP) : food.group === "own" ? 1 : null);
  const units: { id: string; label: string; grams: number; portion: boolean }[] = [
    { id: "g", label: "g", grams: 1, portion: false },
    // A row logged in ounces before they went still opens in them.
    ...(entry?.serving?.endsWith(" oz") ? [{ id: "oz", label: "oz", grams: G_PER_OZ, portion: false }] : []),
    ...(density ? [{ id: "ml", label: "ml", grams: density, portion: false }, { id: "l", label: "l", grams: density * 1000, portion: false }] : []),
    ...food.servings.map(([label, grams]) => ({ id: `p:${label}`, label, grams, portion: true })),
  ];
  // A row opened again comes back in the unit it was entered in; anything new
  // starts in g, the list's first (24 Oct, Alex: it opened on 3 oz (85 g)).
  const startUnit = entry
    ? units.find((u) => u.portion && (entry.serving?.endsWith(u.label) || entry.serving?.endsWith(` × ${u.label.replace(/^1 /, "")}`)))?.id ?? units.find((u) => !u.portion && u.id !== "g" && entry.serving?.endsWith(` ${u.label}`))?.id ?? "g"
    : "g";
  const [unitId, setUnitId] = useState(startUnit);
  const unit = units.find((u) => u.id === unitId) ?? units[0];
  const startAmount = entry ? entry.grams / unit.grams : unit.portion ? 1 : unit.id === "ml" ? 250 : 100;
  const [amountText, setAmountText] = useState(g(startAmount));
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Saves no longer wait on the server, so nothing is pending here.
  const pending = false;
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.select();
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const amount = Number(amountText.replace(",", ".")) || 0;
  const grams = amount * unit.grams;
  // A portion said once reads "1 slice"; twice, "2 × slice" (its "1 " goes).
  const servingLabel = unit.portion ? (amount === 1 ? unit.label : `${g(amount)} × ${unit.label.replace(/^1 /, "")}`) : unit.id !== "g" ? `${g(amount)} ${unit.label}` : null;
  const ok = grams > 0 && grams <= 5000 && !pending;
  // Changing the unit keeps the weight: 100 g becomes 3.5 oz, a cup becomes its grams.
  const changeUnit = (id: string) => {
    const next = units.find((u) => u.id === id);
    if (!next) return;
    setUnitId(id);
    if (grams > 0) setAmountText(g(grams / next.grams));
  };

  // The panel closes and the row shows at once (17 Oct); the server's day replaces the guess when it comes.
  const save = () => {
    if (!ok) return;
    const g1 = Math.round(grams * 10) / 10;
    if (onDraft) {
      onDraft(g1, servingLabel);
      onDone();
      return;
    }
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("grams", String(g1));
    fd.set("serving", servingLabel ?? "");
    fd.set("date", date);
    const macros = rowOf(food, g1);
    if (entry) {
      fd.set("id", String(entry.id));
      apply((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m, entries: m.entries.map((e) => (e.id === entry.id ? { ...e, grams: g1, serving: servingLabel, ...macros } : e)) })) }));
      onDone();
      void updateFoodEntryAction(fd).then((next) => settle(date, next), () => settle(date, null));
    } else {
      fd.set("meal", meal);
      fd.set("foodId", food.id);
      // Its one-time key, made as Add is tapped (6 Nov): sent again once the signal is back, the food goes in once.
      fd.set("onceKey", newOnceKey());
      const temp: FoodEntryView = { id: -Date.now(), meal, food_id: food.id, name: food.name, grams: g1, serving: servingLabel, ...macros };
      apply((d) => ({ ...d, meals: d.meals.map((m) => (m.id === meal ? { ...m, entries: [...m.entries, temp] } : m)) }));
      onDone();
      void addFoodEntryAction(fd).then((next) => settle(date, next), () => settle(date, null));
    }
  };
  const remove = () => {
    if (!entry) return;
    if (onRemove) {
      onRemove();
      onDone();
      return;
    }
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("id", String(entry.id));
    fd.set("date", date);
    apply((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m, entries: m.entries.filter((e) => e.id !== entry.id) })) }));
    onDone();
    void removeFoodEntryAction(fd).then((next) => settle(date, next), () => settle(date, null));
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
          {/* A food on the list has no bin of its own (11 Nov, Alex: A of docs/boards/meal-foods-mockup.html): Remove
              is here, in red words, asking in place. */}
          {entry && (
            <button type="button" className="fdi-panel-remove" onClick={() => setConfirmRemove(true)}>
              Remove
            </button>
          )}
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
    // Its one-time key, made as Add is tapped (6 Nov): sent again once the signal is back, it makes one food.
    fd.set("onceKey", newOnceKey());
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
