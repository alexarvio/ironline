import { getBranding } from "../lib/queries";
import BrandingLogoUpload from "./BrandingLogoUpload";
import BrandingColorForm from "./BrandingColorForm";

export default function BrandingPanel() {
  const branding = getBranding();

  return (
    <div>
      <p className="empty-note" style={{ marginBottom: 18 }}>
        Your logo and brand colors show up in both your admin top bar and the client app header —
        so it feels like your own app, not a generic tool.
      </p>

      <div className="nutrition-table-wrap builder-card">
        <h3 className="builder-pill-heading">Logo</h3>
        <BrandingLogoUpload currentSrc={branding.logo_path} />
      </div>

      <div className="nutrition-table-wrap builder-card">
        <h3 className="builder-pill-heading">Brand colors</h3>
        <BrandingColorForm colorPrimary={branding.color_primary} />
      </div>
    </div>
  );
}
