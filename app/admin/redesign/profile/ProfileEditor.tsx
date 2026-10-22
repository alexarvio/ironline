"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DragList from "../../../components/DragList";
import CoachProfileScreen from "../../../client/CoachProfileScreen";
import AvatarCropDialog from "../../AvatarCropDialog";
import { PlusIcon } from "../../../components/icons";
import ProfileDetails, { type ProfileDetailsData } from "./ProfileDetails";
import { publishCoachProfileAction, removeCoachPhotoAction, saveCoachProfileAction, uploadCoachPhotoAction } from "../../../lib/actions";
import { COACH_PROFILE_LIMITS as LIMIT, type CoachProfileView, type CoachRole, type CoachStudy } from "../../../lib/coachProfileView";
import { dayMonth } from "../../../lib/dayMonth";
import Picker from "../Picker";
import { Sep } from "../Sep";
import SaveBar from "../settings/SaveBar";

// The coach's profile editor in the redesign, on the admin rules (22 Oct; root "rd trn rls rst rpf", Settings' parts):
// Training's bare header with the state pill after the title, Your details | Public profile as the capsule, then the
// form's sections on the left (a title over one hairline card each, fields on clean lines) and the client's own
// profile screen in a phone on the right, fed from what is typed, so the coach sees exactly what their clients will.
// Text saves with Save (the bar at the foot follows the page); photos upload the moment they are dropped. Published
// decides whether clients get the full profile or only the minimal card. Same actions as the old editor
// (CoachProfileEditor).

type Fields = {
  displayName: string;
  title: string;
  headline: string;
  location: string;
  languages: string;
  years: string;
  intro: string;
  bio: string;
  quote: string;
  outside: string;
  replyNote: string;
};
type StudyRow = CoachStudy & { key: number };
type RoleRow = CoachRole & { key: number };

const snapshotOf = (fields: Fields, specialties: string[], studies: StudyRow[], experience: RoleRow[]) =>
  JSON.stringify({
    fields,
    specialties,
    studies: studies.map(({ title, place, year }) => ({ title, place, year })),
    experience: experience.map(({ years, role, place }) => ({ years, role, place })),
  });

function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return dayMonth(iso);
}

/** A section: its title (and one quiet fact) on the page, the content in one hairline card. */
function Section({ title, fact, children }: { title: string; fact?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rls-section">
      <div className="trn-weekhead">
        <div>
          <h2>{title}</h2>
          {fact != null && <span>{fact}</span>}
        </div>
      </div>
      <div className="rls-card rst-card">{children}</div>
    </section>
  );
}

export default function ProfileEditor({ profile, coaches, currentCoachId, details, countries }: { profile: CoachProfileView; coaches: { id: number; email: string }[]; currentCoachId: number; /** Your details: email, phone, address (the other tab). */ details: ProfileDetailsData; countries: { code: string; name: string }[] }) {
  const router = useRouter();
  const initialFields: Fields = {
    displayName: profile.published || profile.updatedAt ? profile.displayName : "",
    title: profile.title,
    headline: profile.headline,
    location: profile.location,
    languages: profile.languages,
    years: profile.yearsCoaching != null ? String(profile.yearsCoaching) : "",
    intro: profile.intro,
    bio: profile.bio,
    quote: profile.quote,
    outside: profile.outside,
    replyNote: profile.replyNote,
  };
  const [tab, setTab] = useState<"details" | "public">("details");
  const [fields, setFields] = useState<Fields>(initialFields);
  const [specialties, setSpecialties] = useState<string[]>(profile.specialties);
  const [chipDraft, setChipDraft] = useState("");
  const nextKey = useRef(1000);
  const [studies, setStudies] = useState<StudyRow[]>(() => profile.studies.map((s, i) => ({ ...s, key: i + 1 })));
  const [experience, setExperience] = useState<RoleRow[]>(() => profile.experience.map((r, i) => ({ ...r, key: i + 1 })));
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotOf(initialFields, profile.specialties, studies, experience));
  const [savedAt, setSavedAt] = useState<string | null>(profile.updatedAt);
  const [published, setPublished] = useState(profile.published);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const snapshot = snapshotOf(fields, specialties, studies, experience);
  const dirty = snapshot !== savedSnapshot;
  // What was last saved, for Cancel and the bar's count.
  const savedState = useRef({ fields: initialFields, specialties: profile.specialties, studies, experience });
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const changeCount =
    (Object.keys(fields) as (keyof Fields)[]).filter((k) => fields[k] !== savedState.current.fields[k]).length +
    (same(specialties, savedState.current.specialties) ? 0 : 1) +
    (same(studies, savedState.current.studies) ? 0 : 1) +
    (same(experience, savedState.current.experience) ? 0 : 1);
  const discard = () => {
    setFields(savedState.current.fields);
    setSpecialties(savedState.current.specialties);
    setStudies(savedState.current.studies);
    setExperience(savedState.current.experience);
    setError(null);
  };
  const set = (key: keyof Fields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));
  const parsedYears = fields.years.trim() === "" ? null : Number(fields.years);

  const writeProfile = async () => {
    const fd = new FormData();
    fd.set("coachId", String(profile.coachId));
    (Object.keys(fields) as (keyof Fields)[]).forEach((key) => {
      if (key !== "years") fd.set(key, fields[key]);
    });
    fd.set("yearsCoaching", fields.years);
    fd.set("specialties", JSON.stringify(specialties));
    fd.set("studies", JSON.stringify(studies.map(({ title, place, year }) => ({ title, place, year }))));
    fd.set("experience", JSON.stringify(experience.map(({ years, role, place }) => ({ years, role, place }))));
    await saveCoachProfileAction(fd);
    setSavedSnapshot(snapshot);
    savedState.current = { fields, specialties, studies, experience };
    setSavedAt(new Date().toISOString());
    // A cleared name takes the profile back to unpublished on the server.
    if (!fields.displayName.trim()) setPublished(false);
  };
  const save = () =>
    startSave(async () => {
      setError(null);
      await writeProfile();
    });
  const togglePublished = () =>
    startSave(async () => {
      setError(null);
      const next = !published;
      if (next && !fields.displayName.trim()) {
        setError("Add your display name before publishing.");
        return;
      }
      if (dirty) await writeProfile();
      const fd = new FormData();
      fd.set("coachId", String(profile.coachId));
      fd.set("published", next ? "1" : "0");
      const result = await publishCoachProfileAction(fd);
      if (result.ok) setPublished(next);
      else setError(result.error ?? "Could not publish.");
    });

  const addChip = () => {
    const value = chipDraft.trim().slice(0, 40);
    if (value && !specialties.includes(value) && specialties.length < LIMIT.specialties) setSpecialties((list) => [...list, value]);
    setChipDraft("");
  };

  // The client's screen, fed from the form: always the full profile here, so
  // it can be seen before publishing.
  const preview: CoachProfileView = {
    ...profile,
    published: true,
    displayName: fields.displayName.trim() || profile.displayName,
    title: fields.title,
    headline: fields.headline,
    location: fields.location,
    languages: fields.languages,
    yearsCoaching: parsedYears != null && Number.isFinite(parsedYears) && parsedYears >= 0 ? Math.round(parsedYears) : null,
    intro: fields.intro,
    bio: fields.bio,
    quote: fields.quote,
    outside: fields.outside,
    replyNote: fields.replyNote,
    specialties,
    studies: studies.filter((s) => s.title || s.place).map(({ title, place, year }) => ({ title, place, year })),
    experience: experience.filter((r) => r.role || r.place).map(({ years, role, place }) => ({ years, role, place })),
  };
  const ownProfile = profile.coachId === currentCoachId;

  return (
    <div className="rd trn rls rst rpf">
      {/* ---- Training's header, bare: the title and its state pill; whose profile (the owner) on the right. */}
      <header className="trn-head bare">
        <div className="trn-head-main">
          <span className="trn-eyebrow">Settings</span>
          <div className="trn-name-row">
            <h1 className="trn-name">{ownProfile ? "Your profile" : `${profile.displayName}'s profile`}</h1>
            <span className={`trn-state${published ? " good" : ""}`}>{published ? "Published" : "Not published"}</span>
          </div>
        </div>
        {coaches.length > 1 && (
          <div className="trn-head-actions">
            <Picker value={String(profile.coachId)} onChange={(v) => router.push(`/admin/redesign/profile?coachId=${v}`)} label="Whose profile" className="rpf-who" options={coaches.map((c) => ({ value: String(c.id), label: c.email }))} />
          </div>
        )}
      </header>

      {/* Two parts (26 Sep): the account basics, and the public profile, the write-up clients read (and, one day,
          people looking for a coach). Two short options: the capsule (design rules 5). */}
      <div className="rd-btn-group rpf-tabs" role="tablist" aria-label="Profile">
        {(["details", "public"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} data-state={tab === t ? "active" : "inactive"} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "details" ? "Your details" : "Public profile"}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <ProfileDetails coachId={profile.coachId} data={details} countries={countries} />
      ) : (
        <div className="rpf-cols">
          <div className="rpf-form">
            <Section title="Photos">
              <div className="rst-rows">
                <PhotoSlot coachId={profile.coachId} kind="avatar" label="Profile picture" fact="Up to 6 MB" path={profile.avatarPath} />
                <PhotoSlot coachId={profile.coachId} kind="hero" label="Hero photo" fact={<>Portrait, 1200 px tall or more<Sep />up to 6 MB</>} path={profile.heroPath} />
                <PhotoSlot coachId={profile.coachId} kind="candid" label="Candid photo" fact="Up to 6 MB" path={profile.candidPath} />
              </div>
            </Section>

            <Section title="About you">
              <div className="rst-grid">
                <TextField label="Display name" value={fields.displayName} onChange={set("displayName")} max={LIMIT.displayName} placeholder="Finlay Chedd" />
                <TextField label="Title" value={fields.title} onChange={set("title")} max={LIMIT.title} placeholder="Strength & nutrition coach" />
                <TextField label="Headline" value={fields.headline} onChange={set("headline")} max={LIMIT.headline} placeholder="Strength & nutrition coaching, one to one" wide />
                <TextField label="Location" value={fields.location} onChange={set("location")} max={LIMIT.location} placeholder="Tampere, Finland" />
                <TextField label="Languages" value={fields.languages} onChange={set("languages")} max={LIMIT.languages} placeholder="Finnish and English" />
                <TextField label="Years coaching" value={fields.years} onChange={(v) => set("years")(v.replace(/[^\d]/g, "").slice(0, 2))} placeholder="12" inputMode="numeric" />
                <TextField label="Reply note" value={fields.replyNote} onChange={set("replyNote")} max={LIMIT.replyNote} placeholder="Usually replies within a day" />
              </div>
            </Section>

            <Section title="Story">
              <div className="rst-grid">
                <TextField label="Intro" value={fields.intro} onChange={set("intro")} max={LIMIT.intro} multiline counted wide placeholder="The lead paragraph; its first letter becomes a drop cap." />
                <TextField label="Bio" value={fields.bio} onChange={set("bio")} max={LIMIT.bio} multiline counted wide />
                <TextField label="Quote" value={fields.quote} onChange={set("quote")} max={LIMIT.quote} counted wide placeholder="The plan that fits your week beats the perfect plan every time." />
                <TextField label="Outside the gym" value={fields.outside} onChange={set("outside")} max={LIMIT.outside} multiline counted wide placeholder="Two kids, a sourdough starter…" />
              </div>
            </Section>

            <Section title="Specialties" fact={`${specialties.length} of ${LIMIT.specialties}`}>
              <div className="rpf-chips">
                {specialties.map((s) => (
                  <span key={s} className="rpf-chip">
                    {s}
                    <button type="button" aria-label={`Remove ${s}`} onClick={() => setSpecialties((list) => list.filter((x) => x !== s))}>
                      ✕
                    </button>
                  </span>
                ))}
                {specialties.length < LIMIT.specialties && (
                  <input
                    className="rpf-chip-input"
                    value={chipDraft}
                    maxLength={40}
                    onChange={(e) => setChipDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addChip();
                      } else if (e.key === "Backspace" && !chipDraft && specialties.length) {
                        setSpecialties((list) => list.slice(0, -1));
                      }
                    }}
                    onBlur={addChip}
                    placeholder={specialties.length ? "Add another" : "Type one and press Enter"}
                    aria-label="Add a specialty"
                  />
                )}
              </div>
            </Section>

            <Section title="Studies">
              <div className="rpf-list">
                {studies.length > 0 && (
                  <DragList
                    className="rpf-rows"
                    onReorder={(ids) => setStudies((list) => ids.map((id) => list.find((r) => r.key === id)).filter((r): r is StudyRow => !!r))}
                    items={studies.map((s) => ({
                      id: s.key,
                      node: (
                        <div className="rpf-row">
                          <input className="rpf-in" value={s.title} maxLength={80} placeholder="MSc Sports science" aria-label="What was studied" onChange={(e) => setStudies((list) => list.map((r) => (r.key === s.key ? { ...r, title: e.target.value } : r)))} />
                          <input className="rpf-in" value={s.place} maxLength={80} placeholder="University of Jyväskylä" aria-label="Where" onChange={(e) => setStudies((list) => list.map((r) => (r.key === s.key ? { ...r, place: e.target.value } : r)))} />
                          <input className="rpf-in" value={s.year} maxLength={12} placeholder="2014" aria-label="Year" onChange={(e) => setStudies((list) => list.map((r) => (r.key === s.key ? { ...r, year: e.target.value } : r)))} />
                          <button type="button" className="rpf-x" aria-label="Remove this study" title="Remove" onClick={() => setStudies((list) => list.filter((r) => r.key !== s.key))}>
                            ✕
                          </button>
                        </div>
                      ),
                    }))}
                  />
                )}
                <button type="button" className="rls-add rpf-add" onClick={() => setStudies((list) => [...list, { title: "", place: "", year: "", key: nextKey.current++ }])}>
                  <PlusIcon /> Study
                </button>
              </div>
            </Section>

            <Section title="Experience">
              <div className="rpf-list">
                {experience.length > 0 && (
                  <DragList
                    className="rpf-rows"
                    onReorder={(ids) => setExperience((list) => ids.map((id) => list.find((r) => r.key === id)).filter((r): r is RoleRow => !!r))}
                    items={experience.map((r) => ({
                      id: r.key,
                      node: (
                        <div className="rpf-row exp">
                          <input className="rpf-in" value={r.years} maxLength={20} placeholder="2019 – now" aria-label="Years" onChange={(e) => setExperience((list) => list.map((x) => (x.key === r.key ? { ...x, years: e.target.value } : x)))} />
                          <input className="rpf-in" value={r.role} maxLength={80} placeholder="Head coach" aria-label="Role" onChange={(e) => setExperience((list) => list.map((x) => (x.key === r.key ? { ...x, role: e.target.value } : x)))} />
                          <input className="rpf-in" value={r.place} maxLength={80} placeholder="Full Potential Coaching" aria-label="Where" onChange={(e) => setExperience((list) => list.map((x) => (x.key === r.key ? { ...x, place: e.target.value } : x)))} />
                          <button type="button" className="rpf-x" aria-label="Remove this role" title="Remove" onClick={() => setExperience((list) => list.filter((x) => x.key !== r.key))}>
                            ✕
                          </button>
                        </div>
                      ),
                    }))}
                  />
                )}
                <button type="button" className="rls-add rpf-add" onClick={() => setExperience((list) => [{ years: "", role: "", place: "", key: nextKey.current++ }, ...list])}>
                  <PlusIcon /> Role
                </button>
              </div>
            </Section>

            {/* Changed: Cancel and Save at the foot, following the page as it scrolls. Saved: when, and the Published switch. */}
            {dirty ? (
              <SaveBar count={changeCount} busy={saving} onSave={save} onCancel={discard} problem={error} />
            ) : (
              <div className="rst-bar">
                <span className="rst-bar-text rpf-saved">
                  {savedAt ? (
                    <>
                      Saved<Sep />
                      {ago(savedAt, now)}
                    </>
                  ) : (
                    "Not saved yet"
                  )}
                </span>
                {error && <span className="rpf-error">{error}</span>}
                {/* On or off: the switch, ink while on. */}
                <button type="button" role="switch" aria-checked={published} className="rpf-pub" onClick={togglePublished} disabled={saving}>
                  Published
                  <span className="rpf-pub-sw" aria-hidden="true">
                    <i />
                  </span>
                </button>
              </div>
            )}
          </div>

          <aside className="rpf-preview" aria-label="What your clients see">
            <div className="cpe-phone">
              <CoachProfileScreen profile={preview} onBook={() => {}} />
            </div>
            {!published && <span className="rpf-preview-note">Clients see a minimal card</span>}
          </aside>
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  max,
  multiline = false,
  counted = false,
  wide = false,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  multiline?: boolean;
  counted?: boolean;
  wide?: boolean;
  placeholder?: string;
  inputMode?: "numeric";
}) {
  const id = useId();
  return (
    <div className={`rst-field${wide ? " wide" : ""}`}>
      <span className="rpf-label-row">
        <label className="dlh-label" htmlFor={id}>
          {label}
        </label>
        {counted && max != null && (
          <span className={`rpf-count${value.length >= max ? " full" : ""}`}>
            {value.length} / {max}
          </span>
        )}
      </span>
      {multiline ? (
        <textarea id={id} className="dlh-line rpf-text" rows={3} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="dlh-line" value={value} maxLength={max} placeholder={placeholder} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

// One photo: drop a file on it or click to pick; uploads straight away. The
// profile picture is framed in a dialog first.
function PhotoSlot({ coachId, kind, label, fact, path }: { coachId: number; kind: "hero" | "candid" | "avatar"; label: string; fact: React.ReactNode; path: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, start] = useTransition();
  const [framing, setFraming] = useState<File | null>(null);
  const send = (file: File) => {
    const fd = new FormData();
    fd.set("coachId", String(coachId));
    fd.set("kind", kind);
    fd.set("file", file);
    start(() => uploadCoachPhotoAction(fd));
  };
  const upload = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (kind === "avatar") setFraming(file);
    else send(file);
  };
  const remove = () => {
    const fd = new FormData();
    fd.set("coachId", String(coachId));
    fd.set("kind", kind);
    start(() => removeCoachPhotoAction(fd));
  };
  // A row, not a picture (26 Sep): the phone beside the form already shows
  // every photo, so here it is only its name, whether it is in, and the buttons.
  return (
    <div
      className={`rst-row rpf-photo${over ? " over" : ""}${busy ? " busy" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        upload(e.dataTransfer.files[0]);
      }}
    >
      <span className="rst-row-main">
        <b>{label}</b>
        <small>{fact}</small>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {path && (
        <button type="button" className="rst-danger rst-hover" onClick={remove} disabled={busy}>
          Remove
        </button>
      )}
      <span className={`trn-state rst-state${path && !busy ? " good" : ""}`}>{busy ? "Uploading…" : path ? "Uploaded" : "None yet"}</span>
      <button type="button" className="trn-btn rpf-up" onClick={() => inputRef.current?.click()} disabled={busy}>
        {path ? "Replace" : "Upload"}
      </button>
      {framing && (
        <AvatarCropDialog
          file={framing}
          onCancel={() => setFraming(null)}
          onUse={(cropped) => {
            setFraming(null);
            send(cropped);
          }}
        />
      )}
    </div>
  );
}
