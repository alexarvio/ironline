// The eight colours a category can wear, shared by the Plan's events and the
// Calendar: a wash for the bar, an ink for its words, a line for its edge.
// A plain module, so a server page can colour with it too.
export const PALETTE: { id: string; tint: string; ink: string; line: string }[] = [
  { id: "blue", tint: "#e3f0fb", ink: "#1d5a94", line: "#9cc3e6" },
  { id: "orange", tint: "#fdf3ee", ink: "#b3471d", line: "#e5b39a" },
  { id: "purple", tint: "#f1e9fb", ink: "#5a3d9a", line: "#c9b5ea" },
  { id: "navy", tint: "#e6ecf3", ink: "#1e3a6e", line: "#b8c6d9" },
  { id: "green", tint: "#dff3ea", ink: "#1b7a4b", line: "#9fd3bb" },
  { id: "amber", tint: "#fff3dc", ink: "#8a5a12", line: "#e7cf9a" },
  { id: "rose", tint: "#fbe9ee", ink: "#9b2c4a", line: "#e7a9b8" },
  { id: "teal", tint: "#e0f2f2", ink: "#146b6b", line: "#9dd0d0" },
];
export const paletteOf = (id: string) => PALETTE.find((p) => p.id === id) ?? PALETTE[0];
/** No category: grey. */
export const NO_CATEGORY = { tint: "#eceff3", ink: "#5b6474", line: "#c3c9d2" };

export type Category = { id: string; label: string; color: string; custom: boolean };

/** A Calendar entry's colours: its category's, else blue for a client's call and grey for the coach's own. */
export function entryColors(cats: Category[], category: string | null | undefined, withClient: boolean) {
  const c = category ? cats.find((x) => x.id === category) : null;
  if (c) return paletteOf(c.color);
  return withClient ? paletteOf("blue") : NO_CATEGORY;
}
