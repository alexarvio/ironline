import { redirect } from "next/navigation";
import { clerkOn } from "../lib/clerk";
import { getSessionUser, getUserForClient } from "../lib/auth";
import { readInviteToken } from "../lib/inviteToken";
import { getClient, getCoachProfile } from "../lib/queries";
import { InviteFlow } from "../login/ClerkFlows";

// Where a client's invite link lands (Clerk sends the email). Clerk adds
// __clerk_ticket to the address; ?c= is ours, signed, and says who it is
// for, so the screen can greet them and show their coach.
//   /invite?c=12.ab34…&__clerk_ticket=…
export const dynamic = "force-dynamic";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ c?: string; __clerk_ticket?: string }> }) {
  if (!clerkOn()) redirect("/login");
  if (await getSessionUser()) redirect("/auth/continue");
  const params = await searchParams;
  const clientId = readInviteToken(params.c);
  const client = clientId != null ? getClient(clientId) : null;
  const coach = client?.coach_id != null ? getCoachProfile(client.coach_id) : null;
  return (
    <InviteFlow
      ticket={params.__clerk_ticket ?? null}
      firstName={client?.name?.split(" ")[0] || "Hi"}
      email={client ? (getUserForClient(client.id)?.email ?? null) : null}
      coachName={coach?.display_name?.trim() || "Your coach"}
      coachPhoto={coach?.avatar_path ?? null}
    />
  );
}
