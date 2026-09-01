import { redirect } from "next/navigation";
import { getSessionUser } from "./lib/auth";

// There's no public landing page any more — everything behind the door is
// either the coach's CRM or one client's own app, so the root just routes
// whoever arrives to wherever they belong.
export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.must_change_password) redirect("/login/change-password");
  redirect(user.role === "coach" ? "/admin" : "/client");
}
