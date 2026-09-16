import catalogJson from "./catalog.json";
import commonJson from "./common.json";

// The shared food catalog: generic foods from USDA FoodData Central
// (Foundation Foods and SR Legacy), built into catalog.json by
// scripts/build-food-catalog.mjs. On top of it, common.json (from
// scripts/build-common-foods.mjs) names the everyday foods a client
// actually types, "White rice, cooked", each pointing at its catalog row;
// a search shows those first under their plain names and folds the
// catalog's long tail away. Loaded once per server; searched here. A
// client's own foods live in the store (custom_foods) and are searched
// alongside in queries.ts.
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

// The everyday foods, under their plain names, pointing at catalog rows.
const COMMON = (commonJson as { name: string; id: string }[])
  .map((c) => {
    const food = BY_ID.get(c.id);
    return food ? { food: { ...food, name: c.name, category: food.name }, name: c.name.toLowerCase(), tokens: tokens(c.name) } : null;
  })
  .filter((c): c is NonNullable<typeof c> => !!c);

// Some categories are rarely what a client means by "banana"; they are
// listed after everything else that matches.
const LATE = new Set(["Baby Foods", "Restaurant Foods", "Fast Foods", "Meals, Entrees, and Side Dishes", "American Indian/Alaska Native Foods"]);

export function getCatalogFood(id: string): CatalogFood | null {
  return BY_ID.get(id) ?? null;
}

// Every query word must start some word of the name. Lower is better: the
// name that starts with the query, then names where the words come early,
// then the shorter name.
function score(row: { name: string; tokens: string[] }, q: string[]): number | null {
  let score = 0;
  for (const w of q) {
    const at = row.tokens.findIndex((t) => t.startsWith(w));
    if (at < 0) return null;
    score += at * 4 + (row.tokens[at] === w ? 0 : 1);
  }
  if (row.name.startsWith(q.join(" "))) score -= 12;
  else if (row.name.startsWith(q[0])) score -= 6;
  return score + row.tokens.length * 0.5;
}

/**
 * `common`: the everyday foods that match, plain names, in order. `more`:
 * everything else in the catalog that matches, the seldom-meant categories
 * last, without the rows the common list already stands for.
 */
export function searchCatalog(query: string, limit = 40): { common: CatalogFood[]; more: CatalogFood[] } {
  const q = tokens(query);
  if (q.length === 0) return { common: [], more: [] };
  const rank = <T extends { name: string; tokens: string[]; food: CatalogFood }>(rows: T[], late: boolean) => {
    const scored: { food: CatalogFood; score: number }[] = [];
    for (const row of rows) {
      const s = score(row, q);
      if (s == null) continue;
      scored.push({ food: row.food, score: s + (late && LATE.has(row.food.category) ? 40 : 0) });
    }
    scored.sort((a, b) => a.score - b.score || a.food.name.localeCompare(b.food.name));
    return scored.map((s) => s.food);
  };
  const common = rank(COMMON, false);
  const taken = new Set(common.map((f) => f.id));
  let more = rank(INDEX, true).filter((f) => !taken.has(f.id));
  // "Roasted potatoes" matches two frozen rows in full; the client still
  // wants the potatoes. When the full match is thin, rows matching most of
  // the words follow it, best first.
  if (q.length > 1 && common.length + more.length < 8) {
    const seen = new Set([...taken, ...more.map((f) => f.id)]);
    const partial: { food: CatalogFood; hits: number; score: number }[] = [];
    for (const row of INDEX) {
      if (seen.has(row.food.id)) continue;
      let hits = 0;
      let sc = 0;
      for (const w of q) {
        const at = row.tokens.findIndex((t) => t.startsWith(w));
        if (at >= 0) {
          hits++;
          sc += at * 4;
        }
      }
      if (hits === 0) continue;
      partial.push({ food: row.food, hits, score: sc + row.tokens.length * 0.5 + (LATE.has(row.food.category) ? 40 : 0) });
    }
    partial.sort((a, b) => b.hits - a.hits || a.score - b.score || a.food.name.localeCompare(b.food.name));
    more = [...more, ...partial.map((p) => p.food)];
  }
  return { common: common.slice(0, limit), more: more.slice(0, limit) };
}
