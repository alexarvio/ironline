import { AccountIcon, BuildingIcon, LockIcon, ReceiptIcon, ShieldIcon } from "../../components/icons";

// Settings' pages, in the rail's order. A plain module, so the settings page
// (a server component) and the rail (a client one) read the same list.
export const SETTINGS = [
  { key: "profile", label: "Profile", href: "/admin/redesign/profile", Icon: AccountIcon },
  { key: "account", label: "Account & security", href: "/admin/redesign/settings/account", Icon: LockIcon },
  { key: "business", label: "Business details", href: "/admin/redesign/settings/business", Icon: BuildingIcon },
  { key: "invoicing", label: "Invoicing & payments", href: "/admin/redesign/settings/invoicing", Icon: ReceiptIcon },
  { key: "privacy", label: "Privacy & legal", href: "/admin/redesign/settings/privacy", Icon: ShieldIcon },
] as const;
export type SettingsKey = (typeof SETTINGS)[number]["key"];
