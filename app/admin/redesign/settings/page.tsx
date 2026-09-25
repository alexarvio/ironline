import { redirect } from "next/navigation";

// Settings opens on the first of its own pages.
export default function SettingsIndex() {
  redirect("/admin/redesign/settings/account");
}
