/* Coach-level metric templates (not tied to any client) — sourced from the
   real "Week Tracker" spreadsheet the coach already uses (Stress, Nutrition,
   Training, General Wellbeing, Optional). These show up in the Weekly
   Tracker's "Apply a saved template…" dropdown so the coach can add the
   whole set to any client in one click instead of retyping ~24 metrics by
   hand — see the metric_template_categories/items comment in app/lib/db.ts.

   All rated 1-10 on the client's dropdown; unit is "/10" so it renders the
   same way the existing seeded "Stress /5" metric does elsewhere.

   Idempotent: skips any category name that already exists for that
   frequency, so this is safe to run again (e.g. after adding a new
   category here later) without duplicating what's already there.

   Run with: npx tsx scripts/seed-metric-templates.ts
*/
import {
  listMetricTemplateCategories,
  addMetricTemplateCategory,
  addMetricTemplateItem,
  listClients,
  applyMetricTemplateToClient,
  listMetricDefinitions,
  setMetricEntry,
  weekStart,
  localDateStr,
} from "../app/lib/queries";

const today = new Date();
function daysAgo(n: number) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

const TEMPLATES: Array<{ category: string; items: string[] }> = [
  {
    category: "Stress",
    items: [
      "Stress factors of the last week",
      "Work",
      "Private",
      "Social",
      "Stress factors getting in the way of your goals",
      "Managing stress",
    ],
  },
  {
    category: "Nutrition",
    items: [
      "Consistency of meal timing",
      "Quality of nutrition",
      "Bloatedness",
      "Stool",
      "Enjoyment of eating",
      "Cravings",
      "Hunger",
    ],
  },
  {
    category: "Training",
    items: ["Enjoyment of training", "Recovery", "Adherence to programme", "Fatigue during training"],
  },
  {
    category: "General Wellbeing",
    items: [
      "Happiness",
      "Development",
      "Contribution to goals",
      "Motivation",
      "Habit development",
      "Self satisfaction during the week",
    ],
  },
  {
    category: "Optional",
    items: ["Menstruation"],
  },
];

const existing = new Set(listMetricTemplateCategories("weekly").map((t) => t.name));
const newlyAddedIds = new Map<string, number>();

TEMPLATES.forEach(({ category, items }) => {
  if (existing.has(category)) {
    console.log(`Skipping "${category}" — template already exists.`);
    return;
  }
  const id = addMetricTemplateCategory(category, "weekly");
  items.forEach((item) => addMetricTemplateItem(id, item, "/10"));
  newlyAddedIds.set(category, id);
  console.log(`Added template "${category}" with ${items.length} metrics.`);
});

// Demo: apply Stress + General Wellbeing to Alex with a few weeks of sample
// ratings, so the coach sees the "avg" badge working the first time they
// open the Weekly Tracker instead of an empty template with nothing logged.
const alex = listClients().find((c) => c.name === "Alex");
if (alex) {
  ["Stress", "General Wellbeing"].forEach((category) => {
    const templateId = newlyAddedIds.get(category);
    if (templateId == null) return; // already existed from a prior run — leave it alone
    applyMetricTemplateToClient(alex.id, templateId);
    const defs = listMetricDefinitions(alex.id, "weekly").filter((d) => d.category === category);
    const weeksBack = [4, 3, 2, 1];
    defs.forEach((def, di) => {
      weeksBack.forEach((wb, wi) => {
        const base = category === "Stress" ? 4 : 7; // lower stress score = better, higher wellbeing = better
        const drift = category === "Stress" ? -wi : wi; // trending down / up over time
        const value = Math.max(1, Math.min(10, base + drift + ((di + wi) % 3)));
        setMetricEntry(def.id, weekStart(daysAgo(wb * 7)), value);
      });
    });
    console.log(`Applied "${category}" to Alex with 4 weeks of sample ratings.`);
  });
}

console.log("Done.");
