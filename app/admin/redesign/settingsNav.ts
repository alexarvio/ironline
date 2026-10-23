import { AccountIcon, BuildingIcon, ChatIcon, LockIcon, ReceiptIcon, ShieldIcon } from "../../components/icons";

// Settings is one page of folding sections, one open at a time (23 Oct, Alex); these are the rail's rows to them, in
// the page's order, each section's key its id and the address's #key (a row opens its section). A plain module, so
// the page (a server component) and the rail (a client one) read the same list. The old URLs
// (/admin/redesign/settings/<key>, /admin/redesign/profile) redirect to the section on the page.
export const SETTINGS_PATH = "/admin/redesign/settings";
export const SETTINGS = [
  { key: "profile", label: "Profile", href: `${SETTINGS_PATH}#profile`, Icon: AccountIcon },
  { key: "account", label: "Account & security", href: `${SETTINGS_PATH}#account`, Icon: LockIcon },
  { key: "business", label: "Business details", href: `${SETTINGS_PATH}#business`, Icon: BuildingIcon },
  { key: "invoicing", label: "Invoicing & payments", href: `${SETTINGS_PATH}#invoicing`, Icon: ReceiptIcon },
  { key: "privacy", label: "Privacy & legal", href: `${SETTINGS_PATH}#privacy`, Icon: ShieldIcon },
  // A coach's line to the company (lib/support.ts): coaches only.
  { key: "support", label: "Support", href: `${SETTINGS_PATH}#support`, Icon: ChatIcon },
] as const;
export type SettingsKey = (typeof SETTINGS)[number]["key"];

/** The rows an account sees: the owner answers Support from Coaches, so has no Support row (nor section). */
export const settingsFor = (owner: boolean) => SETTINGS.filter((s) => !(owner && s.key === "support"));

export const isSettingsKey = (k: string): k is SettingsKey => SETTINGS.some((s) => s.key === k);

/** The page at one section, with its query (?coachId, ?stripe) kept: `/admin/redesign/settings?stripe=back#invoicing`. */
export function settingsHref(key: SettingsKey, query: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => !!e[1])).toString();
  return `${SETTINGS_PATH}${q ? `?${q}` : ""}#${key}`;
}
