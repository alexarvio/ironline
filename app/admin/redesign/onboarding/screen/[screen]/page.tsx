import { notFound } from "next/navigation";
import { requireCoach } from "../../../../../lib/auth";
import { inviteEmail, mailConfigured } from "../../../../../lib/mail";
import { resetsAvailable } from "../../../../../lib/passwordReset";
import { ChangePasswordCard, LoginCard } from "../../../../../login/AuthCards";
import { ApprovalsScreen, CodeScreen, CoachDetailsScreen, CoachSignUpScreen, InviteEmailScreen, InviteWelcomeScreen, SignInScreen, WaitingScreen } from "../../../../../login/SignInScreens";
import CoachesPanel from "../../../../CoachesPanel";
import { loadRail } from "../../../loaders";
import DemoFrame, { DialogScreen } from "../../DemoFrame";
import "../../../training/draft.css";
import "../../onboarding.css";

// One step of an onboarding flow, drawn in the state it has on the day:
// signed out, a first password to choose, a dialog half filled in. Shown in
// a frame on the board, or full size from its Open link.
//   /admin/redesign/onboarding/screen/login
export const dynamic = "force-dynamic";

// A made-up client for the screens that need one typed in.
const SAMPLE = { firstName: "Sam", lastName: "Jansen", birthdate: "1994-03-12", gender: "Male", heightCm: "181", startingWeightKg: "84", email: "sam.jansen@example.com" };

export default async function OnboardingScreen({ params }: { params: Promise<{ screen: string }> }) {
  const coach = await requireCoach();
  const { screen } = await params;
  const rail = loadRail(coach);
  switch (screen) {
    case "login":
      return (
        <DemoFrame>
          <LoginCard canReset={resetsAvailable()} />
        </DemoFrame>
      );
    case "choose-password":
      return (
        <DemoFrame>
          <ChangePasswordCard />
        </DemoFrame>
      );
    case "coaches":
      return (
        <DemoFrame>
          <div className="ad-pad">
            <CoachesPanel ownerId={coach.id} />
          </div>
        </DemoFrame>
      );
    case "new-client-1":
      return (
        <div className="rd-page">
          <DialogScreen preview={{ step: 1 }} inviteReady={mailConfigured()} />
        </div>
      );
    case "new-client-1-filled":
      return (
        <div className="rd-page">
          <DialogScreen preview={{ step: 1, draft: SAMPLE }} inviteReady={mailConfigured()} />
        </div>
      );
    case "new-client-2":
      return (
        <div className="rd-page">
          <DialogScreen preview={{ step: 2, draft: SAMPLE }} inviteReady={mailConfigured()} />
        </div>
      );
    case "invite-email": {
      const mail = inviteEmail({ to: SAMPLE.email, firstName: SAMPLE.firstName, coachName: rail.coach.name, password: "Iron-K7M2QX", signInUrl: "https://ironline.app/login" });
      return (
        <DemoFrame>
          <div className="ob-mail">
            <div className="ob-mail-head">
              <span className="ob-mail-subject">{mail.subject}</span>
              <span className="ob-mail-from">{rail.coach.name} · via Ironline</span>
            </div>
            {/* The email exactly as sent; the words are ours (lib/mail.ts), with every value escaped there. */}
            <div className="ob-mail-body" dangerouslySetInnerHTML={{ __html: mail.html }} />
            {!mailConfigured() && <p className="ob-mail-off">Email isn&rsquo;t set up yet, so today the coach sends these details themselves.</p>}
          </div>
        </DemoFrame>
      );
    }
    // ---- After the switch to Clerk: no passwords.
    case "signin":
      return (
        <DemoFrame>
          <SignInScreen />
        </DemoFrame>
      );
    case "code-client":
      return (
        <DemoFrame>
          <CodeScreen email={SAMPLE.email} />
        </DemoFrame>
      );
    case "code-coach":
      return (
        <DemoFrame>
          <CodeScreen email="new.coach@example.com" />
        </DemoFrame>
      );
    case "coach-signup":
      return (
        <DemoFrame>
          <CoachSignUpScreen />
        </DemoFrame>
      );
    case "coach-details":
      return (
        <DemoFrame>
          <CoachDetailsScreen name="Robin de Vries" email="new.coach@example.com" />
        </DemoFrame>
      );
    case "waiting":
      return (
        <DemoFrame>
          <WaitingScreen name="Robin" />
        </DemoFrame>
      );
    case "approvals":
      return (
        <DemoFrame>
          <div className="rd-page">
            <ApprovalsScreen
              waiting={[
                { name: "Robin de Vries", business: "Strong Start Coaching", email: "new.coach@example.com", when: "today" },
                { name: "Maya Patel", business: "Maya Lifts", email: "maya@example.com", when: "yesterday" },
              ]}
            />
          </div>
        </DemoFrame>
      );
    case "invite-email-new":
      return (
        <DemoFrame>
          <InviteEmailScreen firstName={SAMPLE.firstName} coachName={rail.coach.name} email={SAMPLE.email} />
        </DemoFrame>
      );
    case "invite-welcome":
      return (
        <DemoFrame>
          <InviteWelcomeScreen firstName={SAMPLE.firstName} email={SAMPLE.email} coachName={rail.coach.name} coachPhoto={rail.coach.photoPath} />
        </DemoFrame>
      );
    default:
      notFound();
  }
}
