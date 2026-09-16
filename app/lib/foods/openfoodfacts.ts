// Open Food Facts: the open database of packaged products, by name or
// barcode. Asked only when the client presses "Search packaged products"
// (their text search allows about ten queries a minute for everyone), and
// everything that comes back is kept in the store (off_foods), so a product
// found once is instant after that and works without them.
// https://openfoodfacts.github.io/openfoodfacts-server/api/
export type OffProduct = {
  /** The barcode. */
  code: string;
  name: string;
  brand: string | null;
  /** "500 g", "1 l"; what the pack holds. */
  quantity: string | null;
  /** Per 100 g. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_label: string | null;
  serving_grams: number | null;
};

const UA = "Ironline/1.0 (coaching app; https://ironline-production-e741.up.railway.app)";
const TIMEOUT_MS = 7000;
const FIELDS = "code,product_name,product_name_en,brands,quantity,nutriments,serving_size,serving_quantity";

type RawProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string | string[];
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
};

const num = (v: number | string | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

function parse(p: RawProduct): OffProduct | null {
  const code = String(p.code ?? "").trim();
  const name = String(p.product_name_en || p.product_name || "").trim();
  if (!code || !name) return null;
  const n = p.nutriments ?? {};
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal == null) {
    const kj = num(n["energy_100g"]) ?? num(n["energy-kj_100g"]);
    if (kj != null) kcal = kj / 4.184;
  }
  const protein = num(n["proteins_100g"]);
  const carbs = num(n["carbohydrates_100g"]);
  const fat = num(n["fat_100g"]);
  if (kcal == null || protein == null || carbs == null || fat == null) return null;
  if (kcal < 0 || kcal > 950 || protein > 100 || carbs > 100 || fat > 100) return null;
  // The newer search service lists brands; the older one joins them with commas.
  const brand = (Array.isArray(p.brands) ? String(p.brands[0] ?? "") : String(p.brands ?? "").split(",")[0]).trim();
  const servingGrams = num(p.serving_quantity);
  const servingLabel = String(p.serving_size ?? "").trim();
  return {
    code,
    name: name.slice(0, 120),
    brand: brand ? brand.slice(0, 60) : null,
    quantity: String(p.quantity ?? "").trim().slice(0, 30) || null,
    kcal: Math.round(kcal),
    protein: r1(protein),
    carbs: r1(carbs),
    fat: r1(fat),
    serving_label: servingGrams && servingLabel ? servingLabel.slice(0, 40) : null,
    serving_grams: servingGrams && servingLabel ? r1(servingGrams) : null,
  };
}

async function get(url: string): Promise<unknown> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Open Food Facts answered ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Products matching a name. The newer search service first (fast, ranks
 * well); the older one when it does not answer. Throws when neither does.
 */
export async function searchOpenFoodFacts(query: string, limit = 20): Promise<OffProduct[]> {
  const q = query.trim().slice(0, 80);
  if (!q) return [];
  let raw: RawProduct[];
  try {
    const data = (await get(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=${limit}&fields=${FIELDS}`)) as { hits?: RawProduct[] };
    raw = data.hits ?? [];
  } catch {
    const data = (await get(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${limit}&sort_by=unique_scans_n&fields=${FIELDS}`,
    )) as { products?: RawProduct[] };
    raw = data.products ?? [];
  }
  return raw.map(parse).filter((p): p is OffProduct => !!p);
}

/** One product by barcode; null when unknown. Throws when the service does not answer. */
export async function lookupOpenFoodFacts(barcode: string): Promise<OffProduct | null> {
  const code = barcode.replace(/\D/g, "");
  if (!code) return null;
  const data = (await get(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`)) as { status?: number; product?: RawProduct };
  return data.status === 1 && data.product ? parse(data.product) : null;
}
