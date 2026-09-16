import catalogJson from "./catalog.json";

// The shared food catalog: generic foods from USDA FoodData Central
// (Foundation Foods and SR Legacy), built into catalog.json by
// scripts/build-food-catalog.mjs. Loaded once per server; searched here.
// A client's own foods live in the store (custom_foods) and are searched
// alongside these in queries.ts.
export type CatalogFood = {
  /** "usda:171077" */
  id: string;
  name: string;
  category: string;
  /** Per 100 g. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Household portions: [label, grams]. */
  servings: [string, number][];
};

const CATALOG = catalogJson as CatalogFood[];
const BY_ID = new Map(CATALOG.map((f) => [f.id, f]));

// Search terms, lowercased and split; a row is indexed by its own tokens.
const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
const INDEX = CATALOG.map((f) => ({ food: f, name: f.name.toLowerCase(), tokens: tokens(f.name) }));

// Some categories are rarely what a client means by "banana"; they are
// listed after everything else that matches.
const LATE = new Set(["Baby Foods", "Restaurant Foods", "Fast Foods", "Meals, Entrees, and Side Dishes", "American Indian/Alaska Native Foods"]);

export function getCatalogFood(id: string): CatalogFood | null {
  return BY_ID.get(id) ?? null;
}

/**
 * Every query word must start some word of the name. Ranked: the name that
 * starts with the query, then names where the words come early, then the
 * shorter name; the seldom-meant categories last.
 */
export function searchCatalog(query: string, limit = 30): CatalogFood[] {
  const q = tokens(query);
  if (q.length === 0) return [];
  const scored: { food: CatalogFood; score: number }[] = [];
  for (const row of INDEX) {
    let score = 0;
    let ok = true;
    for (const w of q) {
      const at = row.tokens.findIndex((t) => t.startsWith(w));
      if (at < 0) {
        ok = false;
        break;
      }
      score += at * 4 + (row.tokens[at] === w ? 0 : 1);
    }
    if (!ok) continue;
    if (row.name.startsWith(q.join(" "))) score -= 12;
    else if (row.name.startsWith(q[0])) score -= 6;
    score += row.tokens.length * 0.5;
    if (LATE.has(row.food.category)) score += 40;
    scored.push({ food: row.food, score });
  }
  scored.sort((a, b) => a.score - b.score || a.food.name.localeCompare(b.food.name));
  return scored.slice(0, limit).map((s) => s.food);
}
