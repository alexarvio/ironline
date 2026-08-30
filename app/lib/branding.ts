// Default brand colors — match the current hardcoded values in globals.css
// (--accent and .phone-frame's background) so "no branding set" looks
// identical to today. Kept in their own file (no fs/path imports) so client
// components can import it without pulling in server-only code from
// queries.ts/db.ts.
export const DEFAULT_BRAND_PRIMARY = "#2f6485";
export const DEFAULT_BRAND_FRAME = "#2b2d24";

// The client app's dark surface (see .app-screen / --fp-surface). Accent
// colors shown on it are measured against this, not white.
export const CLIENT_DARK_SURFACE = "#0e0e0c";

// Default accent for the client app when a coach hasn't set a brand color —
// Full Potential's lime, i.e. exactly how the dark screens already look.
export const DEFAULT_CLIENT_ACCENT = "#d6ff3f";

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(l1: number, l2: number): number {
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// Picks whichever of "our dark ink" or white has better WCAG contrast against
// a given accent color — so a light accent (lime green, pale yellow, ...)
// gets dark text/icons instead of the white that reads fine on the default
// dark-blue accent but disappears on anything bright. Falls back to white
// (today's hardcoded behavior) if the hex is somehow malformed.
export function pickForegroundColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const luminance = relativeLuminance(...rgb);
  const withInk = contrastRatio(luminance, relativeLuminance(0x14, 0x17, 0x1c)); // --ink
  const withWhite = contrastRatio(luminance, 1);
  return withInk >= withWhite ? "#14171c" : "#ffffff";
}

// Picks a version of `hex` that reads clearly as small text/icons/borders on
// the app's light surfaces (white cards, --paper-raised, the pale accent
// tints behind pills) — a bright accent like lime is fine as a button FILL
// (pickForegroundColor handles the text on top of that), but unreadable as
// the text/icon color itself against something light. Darkens the accent
// toward black in steps, preserving its hue/saturation, until it clears the
// WCAG AA small-text contrast ratio (4.5:1) against white. A dark accent
// (the default) already passes and comes back unchanged.
// The dark-surface counterpart to pickTextSafeColor: the client app is a
// near-black screen, so a coach's brand color has to be LIGHTENED (not
// darkened) to stay readable as the accent on it — a dark navy brand would
// otherwise disappear into the background. Lightens toward white in steps,
// preserving hue, until it clears WCAG AA small-text contrast (4.5:1)
// against the app's dark surface. A bright accent (lime, the default)
// already passes and comes back unchanged.
export function pickAccentOnDark(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return DEFAULT_CLIENT_ACCENT;
  const surface = hexToRgb(CLIENT_DARK_SURFACE);
  const surfaceLuminance = surface ? relativeLuminance(...surface) : 0;
  if (contrastRatio(relativeLuminance(...rgb), surfaceLuminance) >= 4.5) return hex;
  const [r, g, b] = rgb;
  for (let amount = 0.1; amount <= 0.9; amount += 0.1) {
    const mixed: [number, number, number] = [
      r + (255 - r) * amount,
      g + (255 - g) * amount,
      b + (255 - b) * amount,
    ];
    if (contrastRatio(relativeLuminance(...mixed), surfaceLuminance) >= 4.5) return rgbToHex(...mixed);
  }
  return "#ffffff";
}

export function pickTextSafeColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#14171c";
  if (contrastRatio(relativeLuminance(...rgb), 1) >= 4.5) return hex;
  const [r, g, b] = rgb;
  for (let amount = 0.1; amount <= 0.9; amount += 0.1) {
    const mixed: [number, number, number] = [r * (1 - amount), g * (1 - amount), b * (1 - amount)];
    if (contrastRatio(relativeLuminance(...mixed), 1) >= 4.5) return rgbToHex(...mixed);
  }
  return "#14171c";
}
