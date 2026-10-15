// A gym's colour (13 Oct): picked when the client adds the gym, kept on the
// gym, and read by the picker's rows, its tint, the Start button's dot and
// the workout header's chip. Six keys; a gym from before colours is navy.

export type GymColorKey = "navy" | "indigo" | "teal" | "rust" | "sand" | "slate";
export type GymKind = "gym" | "home" | "hotel";

export const GYM_COLORS: Record<GymColorKey, { hex: string; rgb: string; label: string }> = {
  navy: { hex: "#1d3466", rgb: "29,52,102", label: "Navy" },
  indigo: { hex: "#3a3390", rgb: "58,51,144", label: "Indigo" },
  teal: { hex: "#1d7a70", rgb: "29,122,112", label: "Teal" },
  rust: { hex: "#b8471f", rgb: "184,71,31", label: "Rust" },
  sand: { hex: "#a8761f", rgb: "168,118,31", label: "Sand" },
  slate: { hex: "#5b6472", rgb: "91,100,114", label: "Slate" },
};

export const GYM_COLOR_KEYS = Object.keys(GYM_COLORS) as GymColorKey[];
export const GYM_KINDS: { key: GymKind; label: string }[] = [
  { key: "gym", label: "Gym" },
  { key: "home", label: "Home" },
  { key: "hotel", label: "Hotel" },
];

export const isGymColor = (v: unknown): v is GymColorKey => typeof v === "string" && v in GYM_COLORS;
export const isGymKind = (v: unknown): v is GymKind => v === "gym" || v === "home" || v === "hotel";

/** The colour on a gym, navy for one from before colours. */
export const gymColor = (key: string | null | undefined) => GYM_COLORS[isGymColor(key) ? key : "navy"];

/** "Trainmore" → "T", "Muscle Factory" → "MF": the first letter of up to two words. "?" for nothing. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((w) => w[0]!.toUpperCase()).join("") || "?";
}

/** The first colour none of the client's gyms has yet, in this order; indigo again when all six are taken. */
export function nextFreeColor(gyms: { color?: string | null }[]): GymColorKey {
  const used = new Set(gyms.map((g) => g.color ?? "navy"));
  const order: GymColorKey[] = ["indigo", "rust", "sand", "slate", "navy", "teal"];
  return order.find((c) => !used.has(c)) ?? "indigo";
}
