// A picture at the size it is drawn (23 Oct, Alex: "the profile pics load by
// chunks"). Faces and card pictures were each the original upload, often a
// phone photo of several MB; "/uploads/…?w=96" answers with a small WebP made
// once and kept by the browser (lib/storage.ts smallCopy). Client-safe: no
// server imports.
//   96    a face, drawn at 48 px at most
//   480   a thumbnail up to ~160 px (a gym's badge, a card picture in a sheet)
//   1080  a card or banner across the screen
export type PicWidth = 96 | 480 | 1080;

/** `src` at width `w` when it is an uploaded picture ("/uploads/….jpg|jpeg|png|webp"); anything else as it is. */
export function pic<T extends string | null | undefined>(src: T, w: PicWidth): T {
  if (!src || !src.startsWith("/uploads/")) return src;
  const at = src.indexOf("?");
  const file = at < 0 ? src : src.slice(0, at);
  if (!/\.(jpe?g|png|webp)$/i.test(file)) return src;
  const query = at < 0 ? "" : src.slice(at + 1);
  if (/(^|&)(w|stream|poster)=/.test(query)) return src;
  return `${src}${at < 0 ? "?" : "&"}w=${w}` as T;
}
