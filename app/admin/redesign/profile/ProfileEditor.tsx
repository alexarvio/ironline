"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DragList from "../../../components/DragList";
import CoachProfileScreen from "../../../client/CoachProfileScreen";
import AvatarCropDialog from "../../AvatarCropDialog";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/basics";
import ProfileDetails, { type ProfileDetailsData } from "./ProfileDetails";
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from "../../../components/ui/form";
import { publishCoachProfileAction, removeCoachPhotoAction, saveCoachProfileAction, uploadCoachPhotoAction } from "../../../lib/actions";
import { COACH_PROFILE_LIMITS as LIMIT, type CoachProfileView, type CoachRole, type CoachStudy } from "../../../lib/coachProfileView";

// The coach's profile editor in the redesign: the form in cards on the left,
// the client's own profile screen in a phone on the right, fed from what is
// typed, so the coach sees exactly what their clients will. Text saves with
// Save (the bar at the foot follows the page); photos upload the moment they
// are dropped. Published decides whether clients get the full profile or
// only the minimal card. Same actions as the old editor (CoachProfileEditor).

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
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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
    <div className="rpf">
      <header className="rpf-head">
        <div>
          <h1 className="rpf-title">{ownProfile ? "Your profile" : `${profile.displayName}'s profile`}</h1>

        </div>
        <div className="rpf-head-right">
          <Badge className={`rpf-state${published ? " on" : ""}`}>{published ? "Published" : "Not published"}</Badge>
          {coaches.length > 1 && (
            <Select value={String(profile.coachId)} onValueChange={(v) => router.push(`/admin/redesign/profile?coachId=${v}`)}>
              <SelectTrigger className="rpf-select" aria-label="Whose profile">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {coaches.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </header>

      {/* Two parts (26 Sep): the account basics, and the public profile, the
          write-up clients read (and, one day, people looking for a coach). */}
      <Tabs defaultValue="details" className="rpf-tabs">
        <TabsList className="rpf-tablist">
          <TabsTrigger value="details">Your details</TabsTrigger>
          <TabsTrigger value="public">Public profile</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <ProfileDetails coachId={profile.coachId} data={details} countries={countries} />
        </TabsContent>
        <TabsContent value="public">
      <div className="rpf-cols">
        <div className="rpf-form">
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
              <CardDescription>They upload the moment you drop them</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rpf-photos">
                <PhotoSlot coachId={profile.coachId} kind="avatar" label="Profile picture" hint="Beside your notes and messages" path={profile.avatarPath} />
                <PhotoSlot coachId={profile.coachId} kind="hero" label="Hero photo" hint="Portrait, 1200 px tall or more" path={profile.heroPath} />
                <PhotoSlot coachId={profile.coachId} kind="candid" label="Candid photo" hint="For Outside the gym" path={profile.candidPath} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About you</CardTitle>
            </CardHeader>
            <CardContent className="rpf-fields">
              <div className="rpf-grid2">
                <TextField label="Display name" value={fields.displayName} onChange={set("displayName")} max={LIMIT.displayName} placeholder="Finlay Chedd" />
                <TextField label="Title" value={fields.title} onChange={set("title")} max={LIMIT.title} placeholder="Strength & nutrition coach" />
              </div>
              <TextField label="Headline" value={fields.headline} onChange={set("headline")} max={LIMIT.headline} placeholder="Strength & nutrition coaching, one to one" />
              <div className="rpf-grid2">
                <TextField label="Location" value={fields.location} onChange={set("location")} max={LIMIT.location} placeholder="Tampere, Finland" />
                <TextField label="Languages" value={fields.languages} onChange={set("languages")} max={LIMIT.languages} placeholder="Finnish and English" />
                <TextField label="Years coaching" value={fields.years} onChange={(v) => set("years")(v.replace(/[^\d]/g, "").slice(0, 2))} placeholder="12" inputMode="numeric" />
                <TextField label="Reply note" value={fields.replyNote} onChange={set("replyNote")} max={LIMIT.replyNote} placeholder="Usually replies within a day" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Story</CardTitle>
            </CardHeader>
            <CardContent className="rpf-fields">
              <TextField label="Intro" value={fields.intro} onChange={set("intro")} max={LIMIT.intro} multiline counted placeholder="The lead paragraph; its first letter becomes a drop cap." />
              <TextField label="Bio" value={fields.bio} onChange={set("bio")} max={LIMIT.bio} multiline counted />
              <TextField label="Quote" value={fields.quote} onChange={set("quote")} max={LIMIT.quote} counted placeholder="The plan that fits your week beats the perfect plan every time." />
              <TextField label="Outside the gym" value={fields.outside} onChange={set("outside")} max={LIMIT.outside} multiline counted placeholder="Two kids, a sourdough starter…" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Specialties</CardTitle>
              <CardDescription>
                {specialties.length} of {LIMIT.specialties}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rpf-chips">
                {specialties.map((s) => (
                  <Badge key={s} className="rpf-chip">
                    {s}
                    <button type="button" aria-label={`Remove ${s}`} onClick={() => setSpecialties((list) => list.filter((x) => x !== s))}>
                      ×
                    </button>
                  </Badge>
                ))}
                {specialties.length < LIMIT.specialties && (
                  <Input
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Studies</CardTitle>
              <CardDescription>Drag to reorder</CardDescription>
            </CardHeader>
            <CardContent className="rpf-list">
              {studies.length > 0 && (
                <DragList
                  className="rpf-rows"
                  onReorder={(ids) => setStudies((list) => ids.map((id) => list.find((r) => r.key === id)).filter((r): r is StudyRow => !!r))}
                  items={studies.map((s) => ({
                    id: s.key,
                    node: (
                      <div className="rpf-row">
                        <Input value={s.title} maxLength={80} placeholder="MSc Sports science" aria-label="What was studied" onChange={(e) => setStudies((list) => list.map((r) => (r.key === s.key ? { ...r, title: e.target.value } : r)))} />
                        <Input value={s.place} maxLength={80} placeholder="University of Jyväskylä" aria-label="Where" onChange={(e) => setStudies((list) => list.map((r) => (r.key === s.key ? { ...r, place: e.target.value } : r)))} />
                        <Input value={s.year} maxLength={12} placeholder="2014" aria-label="Year" onChange={(e) => setStudies((list) => list.map((r) => (r.key === s.key ? { ...r, year: e.target.value } : r)))} />
                        <Button variant="ghost" size="icon" aria-label="Remove this study" onClick={() => setStudies((list) => list.filter((r) => r.key !== s.key))}>
                          ×
                        </Button>
                      </div>
                    ),
                  }))}
                />
              )}
              <Button variant="outline" size="sm" className="rpf-add" onClick={() => setStudies((list) => [...list, { title: "", place: "", year: "", key: nextKey.current++ }])}>
                + Add a study
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Experience</CardTitle>
              <CardDescription>Newest first · drag to reorder</CardDescription>
            </CardHeader>
            <CardContent className="rpf-list">
              {experience.length > 0 && (
                <DragList
                  className="rpf-rows"
                  onReorder={(ids) => setExperience((list) => ids.map((id) => list.find((r) => r.key === id)).filter((r): r is RoleRow => !!r))}
                  items={experience.map((r) => ({
                    id: r.key,
                    node: (
                      <div className="rpf-row exp">
                        <Input value={r.years} maxLength={20} placeholder="2019 – now" aria-label="Years" onChange={(e) => setExperience((list) => list.map((x) => (x.key === r.key ? { ...x, years: e.target.value } : x)))} />
                        <Input value={r.role} maxLength={80} placeholder="Head coach" aria-label="Role" onChange={(e) => setExperience((list) => list.map((x) => (x.key === r.key ? { ...x, role: e.target.value } : x)))} />
                        <Input value={r.place} maxLength={80} placeholder="Full Potential Coaching" aria-label="Where" onChange={(e) => setExperience((list) => list.map((x) => (x.key === r.key ? { ...x, place: e.target.value } : x)))} />
                        <Button variant="ghost" size="icon" aria-label="Remove this role" onClick={() => setExperience((list) => list.filter((x) => x.key !== r.key))}>
                          ×
                        </Button>
                      </div>
                    ),
                  }))}
                />
              )}
              <Button variant="outline" size="sm" className="rpf-add" onClick={() => setExperience((list) => [{ years: "", role: "", place: "", key: nextKey.current++ }, ...list])}>
                + Add a role
              </Button>
            </CardContent>
          </Card>

          {/* Save and publish, following the page as it scrolls. */}
          <div className="rpf-bar">
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <span className={`rpf-saved${dirty ? " dirty" : ""}`}>{dirty ? "Unsaved changes" : savedAt ? `Saved · ${ago(savedAt, now)}` : "Not saved yet"}</span>
            {error && <span className="rpf-error">{error}</span>}
            <div className="rpf-publish">
              <Label htmlFor="rpf-published" className="rpf-publish-label">
                <b>{published ? "Published" : "Not published"}</b> · clients see it from their Account tab
              </Label>
              <Switch id="rpf-published" checked={published} onCheckedChange={togglePublished} disabled={saving} aria-label="Published" />
            </div>
          </div>
        </div>

        <aside className="rpf-preview" aria-label="What your clients see">
          <div className="cpe-phone">
            <CoachProfileScreen profile={preview} onBook={() => {}} />
          </div>
          <span className="rpf-preview-note">{published ? "Live for your clients" : "Clients see a minimal card until you publish"}</span>
        </aside>
      </div>
        </TabsContent>
      </Tabs>
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
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  multiline?: boolean;
  counted?: boolean;
  placeholder?: string;
  inputMode?: "numeric";
}) {
  const id = useId();
  return (
    <div className="rpf-field">
      <span className="rpf-label-row">
        <Label htmlFor={id}>{label}</Label>
        {counted && max != null && (
          <span className={`rpf-count${value.length >= max ? " full" : ""}`}>
            {value.length} / {max}
          </span>
        )}
      </span>
      {multiline ? (
        <Textarea id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} value={value} maxLength={max} placeholder={placeholder} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

// One photo: drop a file on it or click to pick; uploads straight away. The
// profile picture is framed in a dialog first.
function PhotoSlot({ coachId, kind, label, hint, path }: { coachId: number; kind: "hero" | "candid" | "avatar"; label: string; hint: string; path: string | null }) {
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
  return (
    <div className={`rpf-photo ${kind}`}>
      <Label>{label}</Label>
      <button
        type="button"
        className={`rpf-drop${over ? " over" : ""}${path ? " has" : ""}${busy ? " busy" : ""}`}
        style={path ? { backgroundImage: `url("${path}")` } : undefined}
        onClick={() => inputRef.current?.click()}
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
        aria-label={path ? `Replace the ${label.toLowerCase()}` : `Add a ${label.toLowerCase()}`}
      >
        {!path && <span className="rpf-drop-text">Drop a photo or click</span>}
      </button>
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
        <div className="rpf-photo-actions">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            Replace
          </Button>
          <Button variant="ghost" size="sm" className="rpf-danger" onClick={remove} disabled={busy}>
            Remove
          </Button>
        </div>
      )}
      <span className="rpf-hint">{hint} · up to 6 MB</span>
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
