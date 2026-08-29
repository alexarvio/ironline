"use client";

import { removeBrandingLogoAction, uploadBrandingLogoAction } from "../lib/actions";

// Same auto-submit-on-choose pattern as PhotoUploadBox, minus the
// clientId/slotId (branding is a single app-wide logo, not per-client).
export default function BrandingLogoUpload({ currentSrc }: { currentSrc: string | null }) {
  return (
    <div className="branding-logo-row">
      <form action={uploadBrandingLogoAction}>
        <label className="branding-logo-tile">
          {currentSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentSrc} alt="Logo" className="branding-logo-img" />
          ) : (
            <span className="photo-upload-plus">+</span>
          )}
          <input
            type="file"
            name="file"
            accept="image/*"
            className="photo-upload-input"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          />
        </label>
      </form>
      <div className="branding-logo-info">
        <p className="empty-note" style={{ margin: 0 }}>
          {currentSrc
            ? "Shown in the client app header and your admin top bar."
            : "No logo uploaded yet — the app shows the plain “Ironline” wordmark until you add one."}
        </p>
        {currentSrc && (
          <form action={removeBrandingLogoAction}>
            <button type="submit" className="btn secondary btn-sm" style={{ marginTop: 8 }}>
              Remove logo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
