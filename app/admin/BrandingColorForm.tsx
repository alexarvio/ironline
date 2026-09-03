"use client";

import { useEffect, useState } from "react";
import { saveBrandingColorAction } from "../lib/actions";
import { brandCssVars, DEFAULT_BRAND_PRIMARY, HEX_COLOR_RE } from "../lib/branding";

// One colour. Dragging the picker previews it live across the whole page
// (the tokens are set on <html> as you go); Save makes it permanent for
// both apps, Reset goes back to the design's own blue.
export default function BrandingColorForm({ colorPrimary }: { colorPrimary: string | null }) {
  const [primary, setPrimary] = useState(colorPrimary ?? DEFAULT_BRAND_PRIMARY);

  // Live preview: apply the same variables the layout would inject.
  useEffect(() => {
    if (!HEX_COLOR_RE.test(primary)) return;
    const root = document.documentElement;
    brandCssVars(primary)
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((decl) => {
        const [name, value] = decl.split(":").map((s) => s.trim());
        root.style.setProperty(name, value);
      });
  }, [primary]);

  return (
    <form action={saveBrandingColorAction} className="branding-color-form">
      <div className="branding-color-input-row">
        <input
          type="color"
          name="colorPrimary"
          value={HEX_COLOR_RE.test(primary) ? primary : DEFAULT_BRAND_PRIMARY}
          onChange={(e) => setPrimary(e.target.value)}
          className="branding-color-swatch"
          aria-label="Accent colour"
        />
        <input
          type="text"
          value={primary}
          onChange={(e) => setPrimary(e.target.value)}
          className="branding-color-hex"
          spellCheck={false}
          aria-label="Accent colour as hex"
        />
        <button type="button" className="ad-btn-secondary" onClick={() => setPrimary(DEFAULT_BRAND_PRIMARY)}>
          Reset
        </button>
        <button className="ad-btn-primary" type="submit" disabled={!HEX_COLOR_RE.test(primary)}>
          Save colour
        </button>
      </div>
      <div className="br-preview" aria-hidden="true">
        <span className="br-preview-btn">Button</span>
        <span className="br-preview-pill">Pill</span>
        <span className="br-preview-text">Link text</span>
      </div>
    </form>
  );
}
