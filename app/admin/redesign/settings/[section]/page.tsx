import { notFound } from "next/navigation";
import { requireCoach } from "../../../../lib/auth";
import { getCoachSettings } from "../../../../lib/queries";
import { LEGAL } from "../../../../lib/legal";
import { loadRail } from "../../loaders";
import RedesignRail from "../../RedesignRail";
import { SETTINGS, type SettingsKey } from "../../settingsNav";
import { AccountSettings, BusinessSettings, InvoicingSettings, PrivacySettings } from "../SettingsForms";
import "../../../../components/ui/ui.css";
import "../../training/draft.css";
import "../../rail.css";
import "../settings.css";

// Settings in the redesign, opened from the coach at the foot of the rail:
// one page per section. Profile is its own page (/admin/redesign/profile);
// the rest are here.
//   /admin/redesign/settings/account | business | invoicing | privacy
export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ section: string }> }) {
  const coach = await requireCoach();
  const { section } = await params;
  const meta = SETTINGS.find((s) => s.key === section && s.key !== "profile");
  if (!meta) notFound();
  const settings = getCoachSettings(coach.id);

  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} settings={section as SettingsKey} />
      <div className="rd-page">
        <div className="rst">
          <header className="rst-head">
            <span className="rst-eyebrow">Settings</span>
            <h1 className="rst-title">{meta.label}</h1>
          </header>
          {section === "account" && <AccountSettings email={coach.email} />}
          {section === "business" && <BusinessSettings key={JSON.stringify(settings.business ?? {})} initial={settings.business ?? {}} />}
          {section === "invoicing" && <InvoicingSettings key={JSON.stringify(settings.invoicing ?? {})} initial={settings.invoicing ?? {}} business={settings.business ?? {}} />}
          {section === "privacy" && <PrivacySettings company={LEGAL.company} country={LEGAL.country} contactEmail={LEGAL.contactEmail} updated={LEGAL.updated} />}
        </div>
      </div>
    </div>
  );
}
