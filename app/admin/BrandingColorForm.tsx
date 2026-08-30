"use client";

import { useState } from "react";
import { saveBrandingColorsAction } from "../lib/actions";
import { DEFAULT_BRAND_PRIMARY } from "../lib/branding";

// Deliberately one color, not the full internal palette. The coach picks an
// accent (buttons/links/highlights throughout) and everything else is derived
// from it — semantic colors like the "unpaid invoice" or "conflict" warning
// tones stay fixed, since recoloring those risks unreadable combinations for
// what's a cosmetic ask. The client app's dark surface is fixed for the same
// reason: pickAccentOnDark measures the accent against it, so a moving
// background would take that contrast guarantee with it.
export default function BrandingColorForm({ colorPrimary }: { colorPrimary: string | null }) {
  const [primary, setPrimary] = useState(colorPrimary ?? DEFAULT_BRAND_PRIMARY);

  return (
    <form action={saveBrandingColorsAction} className="branding-color-form">
      <div className="branding-color-field">
        <div className="branding-color-label">
          <div>Primary accent</div>
          <div className="empty-note">
            Buttons, links, and highlights across the coach and client app. The client app&rsquo;s dark screens
            lighten it as needed so it stays readable on their near-black background.
          </div>
        </div>
        <div className="branding-color-input-row">
          <input
            type="color"
            name="colorPrimary"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            className="branding-color-swatch"
          />
          <input
            type="text"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            className="branding-color-hex"
            spellCheck={false}
          />
          <button type="button" className="btn secondary btn-sm" onClick={() => setPrimary(DEFAULT_BRAND_PRIMARY)}>
            Reset
          </button>
        </div>
      </div>

      <button className="btn" type="submit" style={{ marginTop: 4 }}>
        Save colors
      </button>
    </form>
  );
}
