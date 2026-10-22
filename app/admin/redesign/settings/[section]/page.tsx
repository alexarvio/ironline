import { notFound } from "next/navigation";
import { requireCoach } from "../../../../lib/auth";
import { getCoachSettings } from "../../../../lib/queries";
import { LEGAL } from "../../../../lib/legal";
import { paymentsState, refreshCoachStripe } from "../../../../lib/payments";
import { dayMonth } from "../../../../lib/dayMonth";
import { loadRail } from "../../loaders";
import RedesignRail from "../../RedesignRail";
import { SETTINGS, type SettingsKey } from "../../settingsNav";
import { AccountSettings, BusinessSettings, InvoicingSettings, PrivacySettings } from "../SettingsForms";
import "../../../../components/ui/ui.css";
import "../../training/draft.css";
import "../../training/trn.css";
import "../../measurements/measurements.css";
import "../../rail.css";
import "../settings.css";

// Settings in the redesign, opened from the coach at the foot of the rail:
// one page per section, on the admin rules (22 Oct): Training's bare header,
// each section's title over one hairline card. Profile is its own page
// (/admin/redesign/profile); the rest are here.
//   /admin/redesign/settings/account | business | invoicing | privacy
export const dynamic = "force-dynamic";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** "25 September 2026" (lib/legal.ts) as the admin writes a date, 25/9 (dayMonth); as it is when it won't read. */
function legalDate(words: string): string {
  const m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(words.trim());
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  return m && month >= 0 ? dayMonth(new Date(Number(m[3]), month, Number(m[1]))) : words;
}

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ stripe?: string }> }) {
  const coach = await requireCoach();
  const { section } = await params;
  const { stripe } = await searchParams;
  const meta = SETTINGS.find((s) => s.key === section && s.key !== "profile");
  if (!meta) notFound();
  // Back from Stripe (?stripe=back), or still unfinished: ask Stripe where the account stands.
  const known = paymentsState(coach.id);
  const payments = section === "invoicing" && (stripe || known.status === "pending") ? await refreshCoachStripe(coach.id) : known;
  const settings = getCoachSettings(coach.id);

  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} settings={section as SettingsKey} />
      <div className="rd-page">
        <div className="rd trn rls rst">
          {/* Training's header, bare: no fact line, so no room kept for one. */}
          <header className="trn-head bare">
            <div className="trn-head-main">
              <span className="trn-eyebrow">Settings</span>
              <div className="trn-name-row">
                <h1 className="trn-name">{meta.label}</h1>
              </div>
            </div>
          </header>
          {section === "account" && <AccountSettings email={coach.email} />}
          {section === "business" && <BusinessSettings key={JSON.stringify(settings.business ?? {})} initial={settings.business ?? {}} />}
          {section === "invoicing" && <InvoicingSettings key={JSON.stringify(settings.invoicing ?? {})} initial={settings.invoicing ?? {}} business={settings.business ?? {}} payments={payments} />}
          {section === "privacy" && <PrivacySettings company={LEGAL.company} country={LEGAL.country} contactEmail={LEGAL.contactEmail} updated={legalDate(LEGAL.updated)} />}
        </div>
      </div>
    </div>
  );
}
