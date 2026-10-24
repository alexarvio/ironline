// Builds app/lib/foods/foods.json, the catalog the app searches, from the USDA rows in app/lib/foods/catalog.json
// (24 Oct, Alex: "clean it up"):
//
//   node scripts/clean-food-catalog.mjs
//
// Three passes, all here so a rebuild repeats them:
//   1. Names people type: "Chicken, broilers or fryers, breast, meat only, cooked, roasted" → "Chicken breast, skinless,
//      roasted". Noise words go, a broad head word joins its part ("Cheese, cottage" → "Cottage cheese"), the cooking
//      words shorten.
//   2. Portions in metric: no oz, lb, quart or cubic inch, no "yield from…" notes; a liquid keeps its density (`ml`,
//      grams a millilitre) so the diary offers ml and l, and its cups go; every portion reads "1 slice", "1 large".
//   3. The long tail hidden: brands (Open Food Facts has them), baby food, fast food chains, restaurants, imports,
//      dry mixes, and the near twins (with salt, other grades and trims) that clean to the same name as a better row.
// A hidden row is kept, flagged, so a food a client already logged still opens; only the search leaves it out.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "..", "app", "lib", "foods");
const raw = JSON.parse(fs.readFileSync(path.join(dir, "catalog.json"), "utf8"));

const ML_PER_FL_OZ = 29.5735295625;
const ML_PER_CUP = 236.5882365;

// ---------- 3. what hides ----------
const HIDDEN_CATEGORIES = new Set(["Baby Foods", "Fast Foods", "Restaurant Foods", "American Indian/Alaska Native Foods"]);
const HIDE_WORDS = [
  /\bbabyfood\b/i, /\binfant\b/i, /\bformula\b/i, /\btoddler/i, /\bchild\b/i,
  /\bcommodity\b/i, /\bschool\b/i, /\bindustrial\b/i, /\binstitutional\b/i, /\bfood ?service\b/i,
  /\bimported\b/i, /\bnew zealand\b/i, /\baustralian\b/i,
  /\bdry mix\b/i, /\bunprepared\b/i, /\bnot reconstituted\b/i,
  /\bshortening\b/i, /\bmargarine-like\b/i,
  // Parts and animals few clients eat.
  /\b(spleen|brain|brains|thymus|lungs?|pancreas|stomach|feet|jowl|carcass|chitterlings|ears|mechanically deboned|separable fat|composite|giblets|capons|stewing|roasting|neck|back)\b/i,
  /\b(beaver|squirrel|moose|muskrat|opossum|raccoon|bear|caribou|seal|whale|walrus|antelope|beefalo|elk)\b/i,
  // Ham's water-added cuts and the like: the plain ham stays.
  /\bwater added\b|\bwater product\b|\bnatural juices\b|\bunheated\b/i,
];
// A shop or brand in ordinary letters: "Andrea's, Gluten Free…", "Udi's", "Martha White's".
const OWNED = /^[^,]*'s\b|^(Pepperidge Farm|Glutino|Martha White|Kraft|Kellogg|Nabisco|General Mills|Pillsbury|Mission|Sara Lee|Hormel|Oscar Mayer|Campbell|Heinz|Kashi|Arnold|Thomas)\b/i;
// The meats come in hundreds of cuts; a cut said in more than four parts is a butcher's, not a client's.
const MEAT_CATEGORIES = new Set(["Beef Products", "Pork Products", "Lamb, Veal, and Game Products"]);
// A brand is spelled in capitals: QUAKER, CHOBANI, KFC.
const BRAND = /\b[A-Z][A-Z'&.-]{2,}\b/;
const NOT_BRAND = new Set(["NFS", "USDA", "UHT", "DHA", "ARA", "II"]);
const hasBrand = (name) => (name.match(/\b[A-Z][A-Z'&.-]{2,}\b/g) ?? []).some((w) => !NOT_BRAND.has(w));

// Near twins: a row whose clean name another row also gets, ranked so the one a client means wins.
function preference(name) {
  const n = name.toLowerCase();
  let p = 0;
  if (/\bwith salt\b/.test(n)) p += 4;
  if (/\bchoice\b/.test(n)) p += 1;
  if (/\bselect\b/.test(n)) p += 2;
  if (/\bprime\b/.test(n)) p += 3;
  if (/trimmed to 1\/8"/.test(n)) p += 1;
  if (/trimmed to 1\/4"/.test(n)) p += 2;
  if (/separable lean and fat/.test(n)) p += 2;
  if (/\bwith added solution\b|\benhanced\b/.test(n)) p += 2;
  if (/\breduced sodium\b|\blow sodium\b/.test(n)) p += 1;
  return p * 1000 + name.length;
}

// ---------- 1. names ----------
// Parts that say nothing a client needs.
const DROP_PARTS = [
  /^broilers? or fryers$/, /^prepackaged$/, /^prepackaged or deli$/, /^mature seeds$/, /^all commercial varieties$/, /^all varieties$/, /^year round average$/,
  /^retail parts$/, /^fresh$/, /^nfs$/, /^without salt$/, /^without added salt$/, /^no salt added$/, /^with salt$/,
  /^salt not added in processing$/, /^salt added in processing$/, /^enriched$/, /^unenriched$/, /^fluid$/,
  /^with added vitamin/, /^without added vitamin/, /^with added ascorbic acid$/, /^without added ascorbic acid$/,
  /^all grades$/, /^choice$/, /^select$/, /^prime$/, /^trimmed to .*fat$/, /^boneless$/, /^drained$/, /^heated$/,
  /^variety meats and by-products$/, /^separable lean and fat$/, /^with added solution$/, /^enhanced$/,
  /^includes skin$/, /^regular$/, /^all types$/, /^flesh$/, /^as purchased$/, /^ready-to-serve$/, /^ready to serve$/,
  /^table$/, /^all$/, /^commercially prepared$/, /^prepared from recipe$/, /^made with .* oil$/,
];
// A broad head the part after it is a kind of: "Cheese, cottage" → "Cottage cheese".
const SWAP_HEADS = new Set(["cheese", "beans", "rice", "bread", "oil", "yogurt", "lettuce", "cabbage", "crackers", "cookies", "muffins", "cake", "pie", "soup", "sauce", "mushrooms", "squash", "salad dressing", "sugars", "syrups", "wheat flour", "flour", "pasta", "noodles", "rolls", "buns", "tortillas", "vinegar", "mustard", "gravy", "jams and preserves", "peppers", "onions", "lentils", "peas"]);
// A head that only files the food: "Fish, salmon" → "Salmon".
const DROP_HEADS = new Set(["fish", "nuts", "seeds", "spices", "crustaceans", "mollusks", "beverages", "beverage", "alcoholic beverage", "alcoholic beverages", "snacks", "candies", "cereals ready-to-eat", "cereals", "game meat", "tomato products", "vegetables", "fruit", "frozen novelties"]);
// Meats whose next part is the cut: "Chicken, breast" → "Chicken breast".
const MEATS = new Set(["chicken", "turkey", "beef", "pork", "lamb", "veal", "duck", "goose", "bison", "venison", "rabbit", "ham"]);
const NOT_A_KIND = /^(raw|cooked|canned|frozen|dried|dry|fresh|plain|regular|whole|fluid|unsweetened|sweetened|low fat|lowfat|nonfat|fat free|light|reduced fat|organic|prepared|homemade|commercial|mixed species|all|other|imitation|baked|boiled|roasted|fried)$/;
const COOK = ["roasted", "boiled", "broiled", "braised", "fried", "grilled", "stewed", "simmered", "baked", "steamed", "microwaved", "pan-fried", "pan-broiled", "pan-browned", "scrambled", "poached", "hard-boiled", "sauteed", "smoked", "rotisserie"];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function cleanName(name, category) {
  let s = name
    // Notes in brackets: "(includes foods for USDA's…)", "(garbanzo beans, bengal gram)".
    .replace(/\s*\([^()]*\)/g, "")
    .replace(/\s*--\s*/g, ", ")
    .replace(/(\d+)% lean meat \/ \d+% fat/i, "$1% lean")
    .replace(/,\s*,/g, ",");
  let parts = s.split(/\s*[,;]\s*/).map((p) => p.trim()).filter(Boolean);
  const poultry = category === "Poultry Products";
  // Cooking words: "cooked, roasted" → "roasted"; "cooked, dry heat" → "cooked".
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const lp = p.toLowerCase();
    if (DROP_PARTS.some((r) => r.test(lp))) continue;
    if (lp === "cooked" && COOK.includes((parts[i + 1] ?? "").toLowerCase())) continue;
    if (lp === "dry heat" || lp === "moist heat") continue;
    if (lp === "separable lean only") {
      out.push("lean");
      continue;
    }
    if (lp === "meat only") {
      out.push(poultry ? "skinless" : "meat only");
      continue;
    }
    if (lp === "meat and skin" || lp === "flesh and skin") {
      out.push("with skin");
      continue;
    }
    if (lp === "boneless, skinless") {
      out.push("skinless");
      continue;
    }
    out.push(p);
  }
  parts = out.length ? out : parts;
  // Two words that say one thing: "boneless" went, "skinless" stays once.
  parts = parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i);

  let head = parts[0];
  const lh = head.toLowerCase();
  const next = parts[1];
  if (DROP_HEADS.has(lh) && next) {
    parts = parts.slice(1);
    head = parts[0];
  } else if (MEATS.has(lh) && next && !NOT_A_KIND.test(next.toLowerCase()) && next.split(" ").length <= 3 && !/\d/.test(next)) {
    const ln = next.toLowerCase();
    parts = [ln === "ground" ? `Ground ${lh}` : `${head} ${ln}`, ...parts.slice(2)];
  } else if (SWAP_HEADS.has(lh) && next && !NOT_A_KIND.test(next.toLowerCase()) && next.split(" ").length <= 2 && !/\d/.test(next)) {
    // "Oil, olive" → "Olive oil", "Beans, black" → "Black beans"; a sugar or a syrup said once ("Granulated sugar"), and
    // a kind that already names it kept as it is ("Cake, snack cakes" → "Snack cakes").
    const word = { sugars: "sugar", syrups: "syrup", "jams and preserves": "jam" }[lh] ?? lh;
    const stem = word.replace(/s$/, "");
    parts = [next.toLowerCase().split(" ").pop().startsWith(stem) ? next : `${next} ${word}`, ...parts.slice(2)];
  }
  return cap(parts.join(", ").replace(/\s+/g, " ").trim());
}

// ---------- 2. portions ----------
const IMPERIAL = /^(\d+(\.\d+)?\s*)?(oz|ounce|lb|pound|fl oz|quart|pint|gallon|cubic inch)\b/i;
const CUPS = /^(\d+(\.\d+)?\s*)?(cup|c)\b/i;

// A liquid is weighed by the fluid ounce, or by the cup when it pours: a cup of chicken chunks is no density.
const POURS = /\b(milk|juice|drink|beverage|soda|cola|water|tea|coffee|kefir|buttermilk|cream|oil|syrup|soup|broth|stock|smoothie|shake|wine|beer|liqueur|vinegar|sauce|dressing|nectar|lemonade)\b/i;
function densityOf(servings, name, category) {
  const floz = servings.find(([l]) => /^fl oz\b/i.test(l));
  if (floz) return floz[1] / ML_PER_FL_OZ;
  if (category !== "Beverages" && !POURS.test(name)) return null;
  if (/\b(powder|dry|dried|condensed|frozen concentrate|solids)\b/i.test(name)) return null;
  const cup = servings.find(([l]) => /^cup$/i.test(l));
  return cup ? cup[1] / ML_PER_CUP : null;
}

// "pieces" → "piece", "slices" → "slice", for a portion said once.
const ONE = (w) => w.replace(/(ch|sh|ss|x)es$/i, "$1").replace(/kies$/i, "kie").replace(/ies$/i, "y").replace(/(?<![su])s$/i, "");

/** A portion as "1 slice" and its grams for one, or null when it says nothing (oz, lb, a "unit" of a pound's yield). */
function cleanPortion(label, grams) {
  let l = label
    .replace(/\s*\([^()]*\)/g, "")
    .replace(/,?\s*(excluding|without|with) refuse.*$/i, "")
    .replace(/,?\s*yields?( from.*)?$/i, "")
    .replace(/,?\s*bone( and skin)? removed$/i, "")
    .replace(/,?\s*(cooked|raw|edible portion)$/i, "")
    .replace(/\bNLEA serving\b/i, "serving")
    // A size in inches: "small 2-3/4 in. dia., 5/8 in. thick." → "small".
    .replace(/,?\s+\d[\d\-\/.]*\s*(in\.|in\b|inch|")[^]*$/i, "")
    .replace(/\btablespoons?\b/i, "tbsp")
    .replace(/\bteaspoons?\b/i, "tsp")
    .replace(/\s+/g, " ")
    .replace(/[\s,.;:]+$/, "")
    .trim();
  // A portion named after a brand ("1 cookie Pepperidge Farm Chocolate Chunk") says more than a client needs.
  if (/[A-Z]/.test(l.slice(1))) return null;
  if (!l || IMPERIAL.test(l) || /^(\d+(\.\d+)?\s*)?unit\b/i.test(l) || /^(\d+(\.\d+)?\s*)?(ml|g|grams?|l|liter|litre)$/i.test(l)) return null;
  if (/^(serving|package|container|can|jar|bottle|packet)\b.*\d/i.test(l)) l = l.replace(/\s*\d.*$/, "");
  // "0.5 breast" (86 g) → "1 breast" (172 g); "4 pieces" (62 g) → "1 piece" (15.5 g). Cups and spoons keep their count.
  const m = /^(\d+(?:\.\d+)?|\d+\/\d+)\s+(.+)$/.exec(l);
  if (m && !CUPS.test(m[2]) && !/^(tbsp|tsp|tablespoons?|teaspoons?)\b/i.test(m[2])) {
    const nr = m[1].includes("/") ? Number(m[1].split("/")[0]) / Number(m[1].split("/")[1]) : Number(m[1]);
    if (nr > 0 && nr !== 1) {
      const [w, ...rest] = m[2].split(" ");
      return [`1 ${[ONE(w), ...rest].join(" ")}`, grams / nr];
    }
    return [l, grams];
  }
  if (/^[a-z]/i.test(l)) l = `1 ${l}`;
  return [l, grams];
}

function cleanServings(servings, liquid) {
  const out = [];
  for (const [label, grams] of servings) {
    if (!(grams > 0)) continue;
    const c = cleanPortion(label, grams);
    if (!c) continue;
    const [l, g] = c;
    if (liquid && CUPS.test(l)) continue;
    if (out.some(([x]) => x.toLowerCase() === l.toLowerCase())) continue;
    out.push([l, Math.round(g * 10) / 10]);
  }
  // Cups only when nothing else measures it: a slice, a piece or a spoon reads better in Europe.
  const solid = out.filter(([l]) => !CUPS.test(l.replace(/^1 /, "")));
  return (solid.length ? solid : out).slice(0, 4);
}

// ---------- build ----------
const rows = raw.map((f) => {
  const ml = densityOf(f.servings, f.name, f.category);
  const name = cleanName(f.name, f.category);
  const hidden =
    HIDDEN_CATEGORIES.has(f.category) ||
    HIDE_WORDS.some((r) => r.test(f.name)) ||
    hasBrand(f.name) ||
    OWNED.test(f.name) ||
    // A record with its carbs and fat missing (24 Oct: "Blackberries, raw" read 6 kcal a 100 g).
    (f.carbs === 0 && f.fat === 0 && /Fruits|Vegetables/.test(f.category)) ||
    (MEAT_CATEGORIES.has(f.category) && name.split(",").length > 4);
  return {
    id: f.id,
    name,
    category: f.category,
    kcal: f.kcal,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    servings: cleanServings(f.servings, ml != null),
    ...(ml != null ? { ml: Math.round(ml * 1000) / 1000 } : {}),
    ...(hidden ? { hidden: true } : {}),
    _pref: preference(f.name),
    _usda: f.name,
  };
});

// Near twins: the best row of each clean name stays, the others hide.
const best = new Map();
for (const r of rows) {
  if (r.hidden) continue;
  const k = r.name.toLowerCase();
  const b = best.get(k);
  if (!b || r._pref < b._pref) best.set(k, r);
}
for (const r of rows) if (!r.hidden && best.get(r.name.toLowerCase()) !== r) r.hidden = true;
// Frozen vegetables and fruit weigh the same as fresh: the frozen row hides when the fresh one says it.
const unfrozen = (n) => n.toLowerCase().replace(/, frozen\b/g, "");
const fresh = new Set(rows.filter((r) => !r.hidden && !/, frozen\b/i.test(r.name)).map((r) => unfrozen(r.name)));
for (const r of rows) if (!r.hidden && /, frozen\b/i.test(r.name) && fresh.has(unfrozen(r.name))) r.hidden = true;
// Tins that differ only in their syrup, their liquid or their salt: one of them stands for all.
const TIN = /,\s*(extra heavy|heavy|light|extra light) syrup( pack)?|,\s*(juice|water) pack|,\s*(solids and liquids|drained solids|regular pack|no salt added|low sodium|reduced sodium|without salt added)/gi;
const tinKey = (n) => n.toLowerCase().replace(TIN, "");
const tins = new Map();
for (const r of rows) {
  if (r.hidden || !TIN.test(r.name)) continue;
  TIN.lastIndex = 0;
  const k = tinKey(r.name);
  const b = tins.get(k);
  // Juice or water pack, drained, no salt added: what a client counting weighs.
  const score = (x) => (/syrup/i.test(x.name) ? 2 : 0) + (/solids and liquids/i.test(x.name) ? 1 : 0) + x.name.length / 1000;
  if (!b || score(r) < score(b)) {
    if (b) b.hidden = true;
    tins.set(k, r);
  } else r.hidden = true;
}
// A name of more than four parts is a lab's, not a client's ("Corn, sweet, white, canned, whole kernel, regular pack…").
for (const r of rows) if (!r.hidden && r.name.split(",").length > 4) r.hidden = true;

const shown = rows.filter((r) => !r.hidden);
const out = rows.map(({ _pref, _usda, ...r }) => r);
fs.writeFileSync(path.join(dir, "foods.json"), JSON.stringify(out));

if (process.argv.includes("--sample")) {
  const want = process.argv[process.argv.indexOf("--sample") + 1];
  for (const r of rows.filter((x) => !x.hidden && (!want || x._usda.toLowerCase().includes(want.toLowerCase()))).slice(0, 60))
    console.log(`${r._usda}\n   → ${r.name}   ${r.servings.map(([l, g]) => `${l} (${g} g)`).join(" · ")}${r.ml ? `  ml×${r.ml}` : ""}`);
}
const byCat = {};
for (const r of shown) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
console.log(Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${n} ${c}`).join("\n"));
console.log(`${shown.length} shown of ${rows.length} → app/lib/foods/foods.json`);
