// The supplements a coach picks from under + Item on Nutrition (21 Oct, Alex):
// the usual ones with a usual dose and time, in the groups the dropdown
// browses. A pick fills the row; the coach changes any of it there. Their own
// go in by name from the same dropdown.

export type SupplementPreset = { name: string; quantity: string; timing: string };
export type SupplementGroup = { id: string; label: string; items: SupplementPreset[] };

export const SUPPLEMENT_PRESETS: SupplementGroup[] = [
  {
    id: "performance",
    label: "Performance",
    items: [
      { name: "Creatine monohydrate", quantity: "5 g", timing: "Any time" },
      { name: "Caffeine", quantity: "200 mg", timing: "Before training" },
      { name: "Beta-alanine", quantity: "3.2 g", timing: "With a meal" },
      { name: "Citrulline malate", quantity: "6 g", timing: "Before training" },
      { name: "Electrolytes", quantity: "1 serving", timing: "During training" },
    ],
  },
  {
    id: "protein",
    label: "Protein",
    items: [
      { name: "Whey protein", quantity: "30 g", timing: "After training" },
      { name: "Casein protein", quantity: "30 g", timing: "Before bed" },
      { name: "Plant protein", quantity: "30 g", timing: "After training" },
    ],
  },
  {
    id: "health",
    label: "Health",
    items: [
      { name: "Vitamin D3", quantity: "2000 IU", timing: "With breakfast" },
      { name: "Omega-3 fish oil", quantity: "2 g", timing: "With a meal" },
      { name: "Multivitamin", quantity: "1 tablet", timing: "With breakfast" },
      { name: "Zinc", quantity: "15 mg", timing: "With a meal" },
      { name: "Vitamin C", quantity: "500 mg", timing: "With breakfast" },
    ],
  },
  {
    id: "sleep",
    label: "Sleep and recovery",
    items: [
      { name: "Magnesium glycinate", quantity: "300 mg", timing: "Before bed" },
      { name: "Glycine", quantity: "3 g", timing: "Before bed" },
      { name: "Ashwagandha", quantity: "600 mg", timing: "Evening" },
    ],
  },
  {
    id: "digestion",
    label: "Digestion",
    items: [
      { name: "Psyllium husk", quantity: "5 g", timing: "With water" },
      { name: "Probiotic", quantity: "1 capsule", timing: "With breakfast" },
    ],
  },
];
