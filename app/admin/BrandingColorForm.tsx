"use client";

import { useState } from "react";
import { saveBrandingColorsAction } from "../lib/actions";
import { DEFAULT_BRAND_FRAME, DEFAULT_BRAND_PRIMARY } from "../lib/branding";

// Deliberately just two colors (not the full internal palette) — the coach
// picks a primary accent (buttons/links/highlights throughout) and a frame
// color (the phone-mockup bezel behind the client app), rather than being
// able to recolor semantic colors like the "unpaid invoice" or "conflict"
// warning tones, which would risk unreadable combinations for a cosmetic ask.
export default function BrandingColorForm({
  colorPrimary,
  colorFrame,
}: {
  colorPrimary: string | null;
  colorFrame: string | null;
}) {
  const [primary, setPrimary] = useState(colorPrimary ?? DEFAULT_BRAND_PRIMARY);
  const [frame, setFrame] = useState(colorFrame ?? DEFAULT_BRAND_FRAME);

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

      <div className="branding-color-field">
        <div className="branding-color-label">
          <div>App frame color</div>
          <div className="empty-note">Background behind the client app&rsquo;s phone mockup</div>
        </div>
        <div className="branding-color-input-row">
          <input
            type="color"
            name="colorFrame"
            value={frame}
            onChange={(e) => setFrame(e.target.value)}
            className="branding-color-swatch"
          />
          <input
            type="text"
            value={frame}
            onChange={(e) => setFrame(e.target.value)}
            className="branding-color-hex"
            spellCheck={false}
          />
          <button type="button" className="btn secondary btn-sm" onClick={() => setFrame(DEFAULT_BRAND_FRAME)}>
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
