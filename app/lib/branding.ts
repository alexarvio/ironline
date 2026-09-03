// Brand colour helpers. Kept free of fs/path imports so client components
// (the colour picker's live preview) can import them.

// Matches --accent in globals.css, so "no brand colour set" looks exactly
// like the design.
export const DEFAULT_BRAND_PRIMARY = "#2f5d8f";

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

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

// Text ON TOP of an accent fill: ink or white, whichever reads better. A
// pale brand colour (lime, pastel yellow) gets ink; the default navy, white.
export function pickForegroundColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const luminance = relativeLuminance(...rgb);
  const withInk = contrastRatio(luminance, relativeLuminance(0x14, 0x17, 0x1c));
  const withWhite = contrastRatio(luminance, 1);
  return withInk >= withWhite ? "#14171c" : "#ffffff";
}

// The accent used AS text, icon or line colour on the app's light surfaces.
// Darkened toward black, hue preserved, only as far as needed to reach
// WCAG AA small-text contrast (4.5:1) against white. A dark brand colour
// passes as-is.
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

// A pale wash of the accent for pills, tints and icon circles.
export function pickTint(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#e6ecf3";
  const [r, g, b] = rgb;
  return rgbToHex(r + (255 - r) * 0.86, g + (255 - g) * 0.86, b + (255 - b) * 0.86);
}

// Everything the root layout injects for one brand colour. Both the coach
// workstation and the client app share these tokens, so one choice moves
// both, with contrast handled here rather than left to the coach.
export function brandCssVars(primary: string): string {
  const accent = HEX_COLOR_RE.test(primary) ? primary : DEFAULT_BRAND_PRIMARY;
  const fg = pickForegroundColor(accent);
  const ink = pickTextSafeColor(accent);
  const tint = pickTint(accent);
  return [
    `--accent: ${accent};`,
    `--accent-fg: ${fg};`,
    `--accent-ink: ${ink};`,
    `--accent-tint: ${tint};`,
    `--fp-accent: ${ink};`,
    `--fp-accent-fg: ${pickForegroundColor(ink)};`,
    `--fp-accent-tint: ${tint};`,
  ].join(" ");
}
