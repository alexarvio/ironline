// Builds app/lib/foods/catalog.json from USDA FoodData Central CSV exports:
//
//   node scripts/build-food-catalog.mjs <folder with the unzipped datasets>
//
// Reads every FoodData_Central_*_csv_* folder inside it (Foundation Foods and
// SR Legacy are what we use), keeps the generic foods, and writes one compact
// row per food: name, category, kcal / protein / carbs / fat per 100 g, and
// up to four household portions with their gram weights. Foundation wins
// over SR Legacy when both describe the same food. Public domain data:
// https://fdc.nal.usda.gov/download-datasets
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.argv[2];
if (!root) {
  console.error("usage: node scripts/build-food-catalog.mjs <folder>");
  process.exit(1);
}

// Nutrient ids in FoodData Central.
const KCAL = "1008";
const PROTEIN = "1003";
const CARBS = "1005";
const FAT = "1004";

function parseCsv(file) {
  const text = fs.readFileSync(file, "utf8");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const round1 = (n) => Math.round(n * 10) / 10;

function readDataset(dir, dataType) {
  const foods = parseCsv(path.join(dir, "food.csv")).filter((f) => f.data_type === dataType);
  const categories = new Map(parseCsv(path.join(dir, "food_category.csv")).map((c) => [c.id, c.description]));
  const units = new Map(parseCsv(path.join(dir, "measure_unit.csv")).map((u) => [u.id, u.name]));
  const wanted = new Set(foods.map((f) => f.fdc_id));

  const nutrients = new Map();
  for (const n of parseCsv(path.join(dir, "food_nutrient.csv"))) {
    if (!wanted.has(n.fdc_id)) continue;
    if (n.nutrient_id !== KCAL && n.nutrient_id !== PROTEIN && n.nutrient_id !== CARBS && n.nutrient_id !== FAT) continue;
    const m = nutrients.get(n.fdc_id) ?? {};
    m[n.nutrient_id] = Number(n.amount);
    nutrients.set(n.fdc_id, m);
  }

  const portions = new Map();
  for (const p of parseCsv(path.join(dir, "food_portion.csv"))) {
    if (!wanted.has(p.fdc_id)) continue;
    const grams = Number(p.gram_weight);
    if (!Number.isFinite(grams) || grams <= 0) continue;
    const amount = Number(p.amount);
    if (Number.isFinite(amount) && amount <= 0) continue;
    const amt = Number.isFinite(amount) && amount !== 1 ? String(+amount.toFixed(2)) : "";
    const unit = units.get(p.measure_unit_id);
    let label;
    if (unit && unit !== "undetermined") {
      label = `${amt ? `${amt} ` : ""}${unit}${p.modifier ? `, ${p.modifier}` : ""}`;
    } else {
      label = (p.portion_description || p.modifier || "").trim();
      if (amt && label) label = `${amt} ${label}`;
    }
    label = label.replace(/\s+/g, " ").trim();
    if (!label) continue;
    const list = portions.get(p.fdc_id) ?? [];
    if (list.length < 4 && !list.some((s) => s[0].toLowerCase() === label.toLowerCase())) list.push([label, round1(grams)]);
    portions.set(p.fdc_id, list);
  }

  const out = [];
  for (const f of foods) {
    const m = nutrients.get(f.fdc_id);
    if (!m) continue;
    const p = m[PROTEIN] ?? 0;
    const c = m[CARBS] ?? 0;
    const fat = m[FAT] ?? 0;
    // Energy is missing on some Foundation foods: Atwater 4/4/9.
    const kcal = m[KCAL] ?? p * 4 + c * 4 + fat * 9;
    if (!Number.isFinite(kcal)) continue;
    out.push({
      id: `usda:${f.fdc_id}`,
      name: tidyName(f.description),
      category: categories.get(f.food_category_id) ?? "",
      kcal: Math.round(kcal),
      protein: round1(p),
      carbs: round1(c),
      fat: round1(fat),
      servings: portions.get(f.fdc_id) ?? [],
    });
  }
  return out;
}

// The USDA descriptions are catalogue-speak; a few tidy-ups read better
// without changing the meaning.
function tidyName(s) {
  return s
    .replace(/\s+/g, " ")
    .replace(/, broilers or fryers/gi, "")
    .replace(/, NFS\b/gi, "")
    .replace(/\bNS as to\b[^,]*/gi, "")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*$/g, "")
    .trim();
}

const dirs = fs
  .readdirSync(root)
  .filter((d) => d.startsWith("FoodData_Central_") && fs.existsSync(path.join(root, d, "food.csv")))
  .map((d) => path.join(root, d));
if (dirs.length === 0) {
  console.error(`no FoodData_Central_* folders in ${root}`);
  process.exit(1);
}

const byName = new Map();
const add = (rows, priority) => {
  for (const r of rows) {
    const key = r.name.toLowerCase();
    const have = byName.get(key);
    if (!have || have.priority < priority) byName.set(key, { ...r, priority });
  }
};
for (const dir of dirs) {
  const name = path.basename(dir);
  if (name.includes("foundation")) {
    const rows = readDataset(dir, "foundation_food");
    console.log(`${name}: ${rows.length} foundation foods`);
    add(rows, 2);
  } else if (name.includes("sr_legacy")) {
    const rows = readDataset(dir, "sr_legacy_food");
    console.log(`${name}: ${rows.length} SR Legacy foods`);
    add(rows, 1);
  } else console.log(`${name}: skipped (not Foundation or SR Legacy)`);
}

const catalog = [...byName.values()]
  .map(({ priority: _p, ...r }) => r)
  .sort((a, b) => a.name.localeCompare(b.name));
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "app", "lib", "foods", "catalog.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(catalog));
console.log(`${catalog.length} foods → ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
