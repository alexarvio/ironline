"use client";

import { removeBrandingLogoAction, uploadBrandingLogoAction } from "../lib/actions";

// Choose a file and it uploads on the spot; the tile shows the current logo.
export default function BrandingLogoUpload({ currentSrc }: { currentSrc: string | null }) {
  return (
    <div className="branding-logo-row">
      <form action={uploadBrandingLogoAction}>
        <label className="branding-logo-tile" title="Choose a logo">
          {currentSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- dynamic upload path
            <img src={currentSrc} alt="Logo" className="branding-logo-img" />
          ) : (
            <span className="photo-upload-plus">+</span>
          )}
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="photo-upload-input"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          />
        </label>
      </form>
      <div className="branding-logo-info">
        <p className="br-note" style={{ margin: 0 }}>
          {currentSrc ? "Click the tile to replace it." : "No logo yet. The Ironline mark shows until you add one."}
        </p>
        {currentSrc && (
          <form action={removeBrandingLogoAction}>
            <button type="submit" className="ad-btn-secondary" style={{ marginTop: 8 }}>
              Remove logo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
