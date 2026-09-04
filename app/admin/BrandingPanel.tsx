import { getBranding } from "../lib/queries";
import { saveCoachNameAction } from "../lib/actions";
import BrandingLogoUpload from "./BrandingLogoUpload";
import BrandingColorForm from "./BrandingColorForm";

// The coach's own look: business name, logo, one accent colour. Applied to
// both the workstation and the client's phone app. Deliberately three
// things and no more: every extra knob multiplies the combinations that
// have to stay readable.
export default function BrandingPanel({ embedded = false }: { embedded?: boolean }) {
  const branding = getBranding();

  return (
    <div className={embedded ? "br-embedded" : "br"}>
      {!embedded && <h1 style={{ margin: 0 }}>Branding</h1>}
      {embedded && <h2 className="br-h2">Branding</h2>}

      <section className="br-card">
        <h3 className="ad-microlabel">Business name</h3>
        <p className="br-note">Shown beside your logo in the rail and in the client app header.</p>
        <form action={saveCoachNameAction} className="br-name-form">
          <input name="coachName" type="text" placeholder="e.g. Full Potential" defaultValue={branding.coach_name ?? ""} />
          <button className="ad-btn-primary" type="submit">
            Save name
          </button>
        </form>
      </section>

      <section className="br-card">
        <h3 className="ad-microlabel">Logo</h3>
        <p className="br-note">A square PNG or SVG works best. It shows in the admin panel, on the login page and inside the client app. The Ironline icon on the phone home screen stays as it is.</p>
        <BrandingLogoUpload currentSrc={branding.logo_path} />
      </section>

      <section className="br-card">
        <h3 className="ad-microlabel">Accent colour</h3>
        <p className="br-note">
          Buttons, toggles, highlights and chart lines across both apps. Text on top of it, and the colour used as
          text, are adjusted automatically so everything stays readable.
        </p>
        <BrandingColorForm colorPrimary={branding.color_primary} />
      </section>
    </div>
  );
}
