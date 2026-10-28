import { isOwner, requireCoach } from "../../../lib/auth";
import { clerkOn } from "../../../lib/clerk";
import { getCoachProfileView, getCoachSettings, listCoachAccounts } from "../../../lib/queries";
import { getData } from "../../../lib/db";
import { COUNTRIES, countryOf } from "../../../lib/countries";
import { LEGAL } from "../../../lib/legal";
import { paymentsState, refreshCoachStripe, type PaymentsState } from "../../../lib/payments";
import { dayMonth } from "../../../lib/dayMonth";
import { loadSupportSection } from "../../../lib/support";
import { startTiming } from "../../../lib/timing";
import { loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import { AccountSettings, BusinessSettings, InvoicingSettings, LogoSettings, PrivacySettings } from "./SettingsForms";
import SupportSection from "./SupportSection";
import { DataSettings, NotificationsSettings, PreferencesSettings } from "./MoreSettings";
import { loadAccountSecurity } from "../../../lib/accountSecurity";
import ProfileEditor from "../profile/ProfileEditor";
import SettingsBoard, { type SettingsSection } from "./SettingsBoard";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../training/trn.css";
import "../measurements/measurements.css";
import "../rail.css";
import "./settings.css";
import "../profile/profile.css";

// Settings in the redesign, opened from the coach at the foot of the rail: the sections listed on the left, each with
// one fact, and the one picked on the right (27 Oct, Alex: mockup B; SettingsBoard). The rail keeps its own look here. Profile (the form and the client's view beside it; the
// owner opens any coach's with ?coachId=), Account & security, Business details, Invoicing & payments, Privacy &
// legal, and for a coach (not the owner) Support. One bar at the foot saves every section changed (SaveHost). #<key>
// opens a section, and the rail's Settings rows open theirs. The old addresses redirect here (settings/[section],
// /admin/redesign/profile).
//   /admin/redesign/settings#profile | account | business | invoicing | privacy | support
export const dynamic = "force-dynamic";

/** When Stripe was last asked about a coach's unfinished account (the page's own memory, per server). */
const stripeAsked = new Map<number, number>();
const STRIPE_ASK_MS = 60_000;

/** Where a coach's Stripe account stands: asked of Stripe when just back from it, and while unfinished once a minute
    at most (every save draws this page again); else what is known. */
async function stripeState(coachId: number, back: boolean): Promise<PaymentsState> {
  const known = paymentsState(coachId);
  const now = Date.now();
  if (!back && (known.status !== "pending" || now - (stripeAsked.get(coachId) ?? 0) < STRIPE_ASK_MS)) return known;
  stripeAsked.set(coachId, now);
  return refreshCoachStripe(coachId);
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** "25 September 2026" (lib/legal.ts) as the admin writes a date, 25/9 (dayMonth); as it is when it won't read. */
function legalDate(words: string): string {
  const m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(words.trim());
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  return m && month >= 0 ? dayMonth(new Date(Number(m[3]), month, Number(m[1]))) : words;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ coachId?: string; stripe?: string }> }) {
  // Each loader timed (app/lib/timing.ts, /api/timing): measuring only, the props are what they were.
  const t = startTiming("settings");
  const coach = await t.time("auth", () => requireCoach());
  const params = await searchParams;

  // Profile: the coach's own, or for the owner any coach's (?coachId=).
  const owner = isOwner(coach);
  const asked = Number(params.coachId);
  const coachId = owner && Number.isInteger(asked) && asked > 0 && t.time("profileView", () => getCoachProfileView(asked)) ? asked : coach.id;
  const profile = t.time("profileView", () => getCoachProfileView(coachId));
  const coaches = owner ? t.time("coachAccounts", () => listCoachAccounts().map((c) => ({ id: c.id, email: c.email }))) : [];
  // Your details: the account basics, beside the public profile.
  const contact = t.time("coachSettings", () => getCoachSettings(coachId)).contact ?? {};
  const details = {
    email: getData().users.find((u) => u.id === coachId)?.email ?? "",
    phoneCode: contact.phone_code ?? "",
    phone: contact.phone ?? "",
    address: contact.address ?? "",
    postcode: contact.postcode ?? "",
    city: contact.city ?? "",
    countryCode: contact.country_code ?? "",
  };
  const countries = COUNTRIES.map((c) => ({ code: c.code, name: c.name }));

  // Back from Stripe (?stripe=back, which the page then drops from its address), or still unfinished.
  const payments = await t.time("stripe", () => stripeState(coach.id, !!params.stripe));
  const settings = t.time("coachSettings", () => getCoachSettings(coach.id));
  const business = settings.business ?? {};
  const invoicing = settings.invoicing ?? {};
  const support = t.time("support", () => loadSupportSection(coach));
  // Account & security's logins and devices, from Clerk (27 Oct); null with Clerk off or not answering.
  const security = await t.time("security", () => loadAccountSecurity());
  const notify = settings.notify ?? {};
  const units = settings.units === "lbs" ? "lbs" : "kg";
  const timezone = settings.timezone || process.env.TZ || "Europe/Amsterdam";
  const clientCount = getData().clients.filter((cl) => cl.coach_id === coach.id).length;

  // The list's quiet fact under each name (27 Oct, Alex: mockup B), parts joined by the drawn bar's words.
  const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" | ") || null;
  const land = business.country_code ? countryOf(business.country_code) : null;
  const facts = {
    profile: profile ? (profile.published ? "Published" : "Not published") : null,
    business: join([business.business_name, land?.name ?? business.country]) ?? "Not set",
    invoicing: join([invoicing.currency ?? land?.currency ?? "EUR", invoicing.vat_rate != null ? `${invoicing.vat_rate}% ${land?.tax ?? "tax"}` : null, payments.status === "active" ? "Stripe" : null]),
    privacy: `Policy updated ${legalDate(LEGAL.updated)}`,
    account: join([coach.email, security?.logins.some((l) => l.provider === "google") ? "Google" : null]),
    notifications: join([notify.chat === false && notify.video === false ? "Phone off" : "Phone on", notify.quiet ? `quiet ${notify.quietFrom ?? "22:00"}–${notify.quietTo ?? "07:00"}` : null]),
    preferences: join([units, timezone]),
    data: "Export",
  };

  // In the rail's order, a section a line (its label from settingsNav's SETTINGS unless given; no body, left out).
  const sections: SettingsSection[] = [
    {
      key: "profile",
      // The owner on another coach's: whose it is.
      label: profile && coachId !== coach.id ? `${profile.displayName}'s profile` : undefined,
      fact: facts.profile,
      tag: profile && <span className={`trn-state${profile.published ? " good" : ""}`}>{profile.published ? "Published" : "Not published"}</span>,
      body: profile ? <ProfileEditor key={coachId} profile={profile} coaches={coaches} details={details} countries={countries} /> : <p className="rpf-empty">No coach profile</p>,
    },
    { key: "account", fact: facts.account, body: <AccountSettings email={coach.email} passwordless={clerkOn()} security={security} /> },
    {
      key: "business",
      fact: facts.business,
      body: (
        <>
          <LogoSettings mark={settings.brand?.mark ?? null} />
          <BusinessSettings key={JSON.stringify(business)} initial={business} />
        </>
      ),
    },
    // Keyed on the business's country too: a new one there brings its own defaults here.
    { key: "invoicing", fact: facts.invoicing, body: <InvoicingSettings key={JSON.stringify([invoicing, business.country_code ?? null, business.country ?? null])} initial={invoicing} business={business} payments={payments} /> },
    { key: "notifications", fact: facts.notifications, body: <NotificationsSettings key={JSON.stringify(notify)} initial={notify} /> },
    { key: "preferences", fact: facts.preferences, body: <PreferencesSettings key={`${units}|${timezone}`} units={units} timezone={timezone} /> },
    { key: "data", fact: facts.data, body: <DataSettings clients={clientCount} /> },
    { key: "privacy", fact: facts.privacy, body: <PrivacySettings company={LEGAL.company} country={LEGAL.country} contactEmail={LEGAL.contactEmail} updated={legalDate(LEGAL.updated)} /> },
    // A coach's thread with the company; the owner answers from Coaches and has none (null leaves it out).
    { key: "support", label: "Support", body: support && <SupportSection {...support} /> },
  ];

  return t.end(
    <div className="rd-frame">
      <RedesignRail rail={t.time("rail", () => loadRail(coach))} clientId={0} />
      <div className="rd-page">
        <SettingsBoard className="rd trn rls rst rpf" sections={sections} />
      </div>
    </div>
  );
}
