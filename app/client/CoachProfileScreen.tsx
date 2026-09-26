"use client";

import { useEffect, useRef, useState } from "react";
import { degreeOf, firstNameOf, type CoachProfileView } from "../lib/coachProfileView";
import { CalendarIcon, ChevronLeftIcon } from "../components/icons";

// The coach's profile as the client reads it, pushed over the Account tab,
// and the same component the coach sees in the admin's live preview. It
// scrolls inside itself: a tall photo that drifts and grows slightly as the
// page moves, the name over it, sticky section tabs that slide under the
// status bar, then Overview, Background and Outside the gym, with a booking
// dock pinned at the foot. Unpublished, it is a minimal card instead.
//
// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx).

const HERO = 478;
const STRIP = 50;
const TABS = 46;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];

type SectionId = "overview" | "background" | "outside";

export default function CoachProfileScreen({
  profile,
  onBack,
  onBook,
}: {
  profile: CoachProfileView;
  onBack?: () => void;
  onBook?: () => void;
}) {
  if (!profile.published) return <MinimalProfile profile={profile} onBack={onBack} />;
  return <FullProfile profile={profile} onBack={onBack} onBook={onBook} />;
}

function MinimalProfile({ profile, onBack }: { profile: CoachProfileView; onBack?: () => void }) {
  return (
    <div className="cpf cpf-minimal">
      {onBack && (
        <button type="button" className="cpf-back solid" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
      )}
      <div className="cpf-min-body">
        <span className="cpf-min-initial" aria-hidden="true">
          {profile.displayName.charAt(0).toUpperCase()}
        </span>
        <h1 className="cpf-min-name">{profile.displayName}</h1>
        <div className="cpf-min-sub">Your coach</div>
        {profile.email && (
          <a className="cpf-min-email" href={`mailto:${profile.email}`}>
            {profile.email}
          </a>
        )}
      </div>
    </div>
  );
}

function FullProfile({ profile, onBack, onBook }: { profile: CoachProfileView; onBack?: () => void; onBook?: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLElement>(null);
  const backgroundRef = useRef<HTMLElement>(null);
  const outsideRef = useRef<HTMLElement>(null);
  const frame = useRef(0);
  const [y, setY] = useState(0);
  const [active, setActive] = useState<SectionId>("overview");
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);

  const first = firstNameOf(profile.displayName);
  const degree = degreeOf(profile.studies);
  const hasBackground = profile.studies.length > 0 || profile.experience.length > 0;
  const hasOutside = !!profile.outside.trim();
  const sections: { id: SectionId; label: string }[] = [
    { id: "overview", label: "Overview" },
    ...(hasBackground ? [{ id: "background" as const, label: "Background" }] : []),
    ...(hasOutside ? [{ id: "outside" as const, label: "Outside the gym" }] : []),
  ];
  const refOf = (id: SectionId) => (id === "overview" ? overviewRef : id === "background" ? backgroundRef : outsideRef);

  // Saved is the client's own bookmark, kept on this phone.
  const saveKey = `ironline.coach.saved.${profile.coachId}`;
  useEffect(() => {
    try {
      setSaved(window.localStorage.getItem(saveKey) === "1");
    } catch {}
  }, [saveKey]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      const top = el.scrollTop;
      setY(top);
      // The section under a probe just below the tabs is the active one.
      const probe = top + 108;
      let current: SectionId = "overview";
      for (const s of sections) {
        const node = refOf(s.id).current;
        if (node && node.offsetTop <= probe) current = s.id;
      }
      setActive(current);
    });
  };
  const jump = (id: SectionId) => {
    const el = scrollRef.current;
    const node = refOf(id).current;
    if (el && node) el.scrollTo({ top: node.offsetTop - STRIP - TABS - 8, behavior: "smooth" });
  };

  const share = async () => {
    const text = `${profile.displayName}${profile.title ? ` · ${profile.title}` : ""}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: profile.displayName, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 1600);
    } catch {
      /* dismissed, or no clipboard */
    }
  };
  const toggleSaved = () => {
    const next = !saved;
    setSaved(next);
    try {
      if (next) window.localStorage.setItem(saveKey, "1");
      else window.localStorage.removeItem(saveKey);
    } catch {}
  };

  const tabPad = clamp(y - (HERO - STRIP), 0, STRIP);
  const pills = [
    profile.yearsCoaching != null ? { key: "years", tone: "blue", text: `${profile.yearsCoaching} year${profile.yearsCoaching === 1 ? "" : "s"} coaching` } : null,
    // No client count (26 Sep): how many clients a coach has is theirs to say, not a badge.
    degree ? { key: "degree", tone: "amber", text: degree } : null,
  ].filter((p): p is { key: string; tone: string; text: string } => !!p);
  const yearsWord =
    profile.yearsCoaching != null
      ? `${profile.yearsCoaching <= 20 ? WORDS[profile.yearsCoaching] : profile.yearsCoaching} year${profile.yearsCoaching === 1 ? "" : "s"} of it`
      : "Experience";

  return (
    <div className="cpf">
      <div className="cpf-statusbar" style={{ opacity: clamp((y - 340) / 60, 0, 1) }} aria-hidden="true" />
      {onBack && (
        <button type="button" className={`cpf-back${y > HERO - STRIP ? " solid" : ""}`} onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
      )}

      <div className="cpf-scroll" ref={scrollRef} onScroll={onScroll}>
        <header className="cpf-hero">
          {profile.heroPath ? (
            <div
              className="cpf-hero-img"
              style={{
                backgroundImage: `url("${profile.heroPath}")`,
                transform: `translateY(${y * 0.22}px) scale(${1 + clamp(y, 0, 412) * 0.00012})`,
              }}
            />
          ) : (
            <div className="cpf-hero-initial" aria-hidden="true">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="cpf-hero-fade bottom" aria-hidden="true" />
          <div className="cpf-hero-fade top" aria-hidden="true" />
          <div className="cpf-caption" style={{ opacity: clamp(1 - y / 190, 0, 1), transform: `translateY(${-0.16 * y}px)` }}>
            {profile.yearsCoaching != null && (
              <span className="cpf-years">
                <ClockIcon /> {profile.yearsCoaching} yrs
              </span>
            )}
            <h1 className="cpf-name">{profile.displayName}</h1>
          </div>
        </header>

        {sections.length > 1 && (
          // The padding lets the strip slide under the status bar; the matching
          // negative margin keeps the content under it from moving.
          <nav className="cpf-tabs" style={{ paddingTop: tabPad, marginBottom: -tabPad }} aria-label="Profile sections">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`cpf-tab${active === s.id ? " on" : ""}`}
                aria-current={active === s.id ? "true" : undefined}
                onClick={() => jump(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        )}

        <article className="cpf-article">
          <section ref={overviewRef} className="cpf-overview">
            {profile.headline && <h2 className="cpf-headline">{profile.headline}</h2>}
            <div className="cpf-meta">{["Your coach", profile.location, profile.languages].filter(Boolean).join(" · ")}</div>
            {pills.length > 0 && (
              <div className="cpf-pills">
                {pills.map((p) => (
                  <span key={p.key} className="cpf-pill">
                    <span className={`cpf-pill-badge ${p.tone}`} aria-hidden="true" />
                    {p.text}
                  </span>
                ))}
              </div>
            )}
            {(profile.intro || profile.bio) && <span className="cpf-rule" aria-hidden="true" />}
            {profile.intro && <p className="cpf-intro">{profile.intro}</p>}
            {profile.bio && <p className="cpf-bio">{profile.bio}</p>}
            {profile.quote && (
              <figure className="cpf-quote">
                <span className="cpf-quote-mark" aria-hidden="true">
                  ”
                </span>
                <blockquote>{profile.quote}</blockquote>
                <figcaption>How {first} coaches</figcaption>
              </figure>
            )}
            {profile.specialties.length > 0 && (
              <div className="cpf-works">
                <div className="cpf-label">Works most with</div>
                <div className="cpf-chips">
                  {profile.specialties.map((s) => (
                    <span key={s} className="cpf-chip">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {hasBackground && (
            <section ref={backgroundRef} className="cpf-section">
              {profile.studies.length > 0 && (
                <>
                  <h2 className="cpf-section-title">Where {first} studied</h2>
                  <div className="cpf-studies">
                    {profile.studies.map((s, i) => (
                      <div key={i} className="cpf-study">
                        <div>
                          <div className="cpf-study-title">{s.title}</div>
                          {s.place && <div className="cpf-study-place">{s.place}</div>}
                        </div>
                        {s.year && <span className="cpf-study-year">{s.year}</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {profile.experience.length > 0 && (
                <>
                  <h2 className="cpf-section-title">{yearsWord}</h2>
                  <ol className="cpf-timeline">
                    {profile.experience.map((r, i) => (
                      <li key={i} className={`cpf-step${i === 0 ? " first" : ""}`}>
                        <span className="cpf-step-dot" aria-hidden="true" />
                        {r.years && <div className="cpf-step-years">{r.years}</div>}
                        <div className="cpf-step-role">{r.role}</div>
                        {r.place && <div className="cpf-step-place">{r.place}</div>}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>
          )}

          {hasOutside && (
            <section ref={outsideRef} className="cpf-outside">
              <div className="cpf-label">Outside the gym</div>
              <div className="cpf-outside-row">
                {profile.candidPath && (
                  // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
                  <img className="cpf-candid" src={profile.candidPath} alt="" />
                )}
                <p className="cpf-outside-text">{profile.outside}</p>
              </div>
            </section>
          )}
        </article>
      </div>

      <div className="cpf-dock">
        <button type="button" className="cpf-book" onClick={onBook} disabled={!onBook}>
          <CalendarIcon />
          Book a call with {first}
        </button>
        {profile.replyNote && <div className="cpf-reply">{profile.replyNote}</div>}
        <div className="cpf-dock-row">
          <button type="button" className="cpf-dock-chip" onClick={share}>
            <ShareIcon />
            {shared ? "Copied" : "Share"}
          </button>
          <button type="button" className={`cpf-dock-chip${saved ? " on" : ""}`} onClick={toggleSaved} aria-pressed={saved}>
            <BookmarkIcon filled={saved} />
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  );
}
