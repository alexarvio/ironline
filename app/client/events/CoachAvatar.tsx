// The coach's face on what the coach set (9 Oct): the photo, else the
// initial on navy. 24px on cards, 22px on past rows.
export function CoachAvatar({ name, photoPath, size, ring }: { name: string; photoPath: string | null; size: number; ring: "card" | "row" }) {
  const initial = (name || "C").trim().charAt(0).toUpperCase();
  return (
    <span className={`ev-coach ${ring}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }} role="img" aria-label={`Set by ${name}`}>
      {photoPath ? <img src={photoPath} alt="" /> : initial}
    </span>
  );
}
