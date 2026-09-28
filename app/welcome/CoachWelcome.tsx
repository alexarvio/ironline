"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "../components/ui/basics";
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/form";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import TimezonePicker from "../admin/redesign/meetings/TimezonePicker";
import { uploadCoachPhotoAction } from "../lib/actions";
import { finishWelcomeAction, saveWelcomeAboutAction, saveWelcomeBusinessAction } from "../lib/onboarding-actions";
import { allTimezones, tzLabel } from "../lib/timezones";

// The welcome steps for a new coach (26 Sep), after the owner lets them in
// and before the coach side: about you, your business, and you're set.
// Built from the redesign's shadcn parts (ui/). Only the name is needed;
// the rest can wait and is all in Your profile and Settings later.

const IDEAS = ["Strength", "Fat loss", "Muscle gain", "Nutrition", "Powerlifting", "Bodybuilding", "Endurance", "Mobility", "Hybrid training", "Women's health", "Habits & lifestyle", "Sports performance"];
const MAX_SPECIALTIES = 3;

export type WelcomeData = {
  email: string;
  name: string;
  title: string;
  specialties: string[];
  avatarPath: string | null;
  business: string;
  countryCode: string;
  timezone: string | null;
  countries: { code: string; name: string; currency: string; tax: string; rate: number }[];
};

export default function CoachWelcome({ data }: { data: WelcomeData }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1.
  const [name, setName] = useState(data.name);
  const [title, setTitle] = useState(data.title);
  const [specialties, setSpecialties] = useState<string[]>(data.specialties.slice(0, MAX_SPECIALTIES));
  const [photo, setPhoto] = useState<string | null>(data.avatarPath);
  const fileInput = useRef<HTMLInputElement>(null);
  const toggle = (s: string, on: boolean) => setSpecialties((list) => (on ? (list.length < MAX_SPECIALTIES && !list.includes(s) ? [...list, s] : list) : list.filter((x) => x !== s)));
  const upload = (file: File) => {
    setPhoto(URL.createObjectURL(file));
    const fd = new FormData();
    fd.set("kind", "avatar");
    fd.set("file", file);
    start(async () => {
      await uploadCoachPhotoAction(fd);
      router.refresh();
    });
  };

  // Step 2. The time zone is the device's own (what the phone or computer is
  // set to): more exact than guessing from an IP address, and nothing is sent
  // anywhere to find it. Shown as a line; Change opens the full list.
  const [business, setBusiness] = useState(data.business);
  const [country, setCountry] = useState(data.countryCode);
  const [zones] = useState(() => allTimezones());
  const [tz, setTz] = useState(() => data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Amsterdam");
  const [changingTz, setChangingTz] = useState(false);
  const picked = data.countries.find((c) => c.code === country) ?? null;

  const saveAbout = () =>
    start(async () => {
      setError(null);
      const res = await saveWelcomeAboutAction({ name, title, specialties });
      if (!res.ok) return setError(res.error ?? "That didn't save. Try again.");
      setStep(2);
    });
  const saveBusiness = (skip = false) =>
    start(async () => {
      if (!skip) await saveWelcomeBusinessAction({ business, countryCode: country, timezone: tz });
      setStep(3);
    });
  const finish = (next: "client" | "tour" | "look") => start(() => finishWelcomeAction(next));

  const first = name.trim().split(" ")[0] || "coach";

  return (
    <div className="wl-page">
      <Card className="wl-card">
        <div className="wl-top">
          <div className="auth-brand">
            <Image src="/brand/logo.png" alt="" width={19} height={32} priority />
            Ironline
          </div>
          <span className="wl-count" aria-label={`Step ${step} of 3`}>
            {step}/3
          </span>
        </div>

        {step === 1 && (
          <form
            className="wl-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveAbout();
            }}
          >
            <h1 className="wl-title">About you</h1>
            <p className="wl-lead">This is how your clients see you in the app.</p>
            {error && <p className="wl-error">{error}</p>}
            <div className="wl-photo">
              <button type="button" className="wl-avatar" onClick={() => fileInput.current?.click()} aria-label="Add a profile photo">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the coach's own upload, or its preview
                  <img src={photo} alt="" />
                ) : (
                  <span>{(name.trim().charAt(0) || "?").toUpperCase()}</span>
                )}
              </button>
              <span className="wl-photo-text">
                <b>Profile photo</b>
                <Button type="button" variant="ghost" size="sm" className="wl-link" onClick={() => fileInput.current?.click()}>
                  {photo ? "Change" : "Add a photo"}
                </Button>
              </span>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) upload(f);
                }}
              />
            </div>
            <div className="wl-field">
              <Label htmlFor="wl-name">Your name</Label>
              <Input id="wl-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Finlay Chedd" maxLength={80} required />
            </div>
            <div className="wl-field">
              <Label htmlFor="wl-title">What you coach</Label>
              <Input id="wl-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Online strength coach" maxLength={80} />
            </div>
            <div className="wl-field">
              <Label>Specialties</Label>
              {/* Up to three, from a list: the rest grey out once three are picked. */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="wl-multi" aria-label="Specialties, up to three">
                  <span className={specialties.length ? "" : "wl-placeholder"}>{specialties.length ? specialties.join(", ") : "Pick up to 3"}</span>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="wl-multi-menu">
                  {IDEAS.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s}
                      checked={specialties.includes(s)}
                      disabled={!specialties.includes(s) && specialties.length >= MAX_SPECIALTIES}
                      onCheckedChange={(on) => toggle(s, on === true)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {s}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <small className="wl-hint">{specialties.length}/{MAX_SPECIALTIES} picked</small>
            </div>
            <Button type="submit" className="wl-primary" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : "Continue"}
            </Button>
          </form>
        )}

        {step === 2 && (
          <form
            className="wl-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveBusiness();
            }}
          >
            <h1 className="wl-title">Your business</h1>
            <p className="wl-lead">Your invoices use this: the currency and the tax come from your country.</p>
            <div className="wl-field">
              <Label htmlFor="wl-business">Business name</Label>
              <Input id="wl-business" value={business} onChange={(e) => setBusiness(e.target.value)} autoComplete="organization" placeholder="Full Potential Coaching" maxLength={120} />
            </div>
            <div className="wl-field">
              <Label>Country</Label>
              <Select value={country || undefined} onValueChange={setCountry}>
                <SelectTrigger className="wl-select" aria-label="Country">
                  <SelectValue placeholder="Choose your country" />
                </SelectTrigger>
                <SelectContent className="wl-select-menu">
                  {data.countries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {picked && (
                <small className="wl-hint">
                  Invoices in {picked.currency}
                  {picked.rate > 0 ? `, ${picked.tax} ${picked.rate}%` : ""}. You can change this later.
                </small>
              )}
            </div>
            <div className="wl-field">
              <Label>Time zone</Label>
              {changingTz ? (
                <TimezonePicker value={tz} zones={zones.includes(tz) ? zones : [tz, ...zones]} onChange={setTz} />
              ) : (
                <div className="wl-tz">
                  <span>
                    <b>{tzLabel(tz)}</b>
                    <small>From your device</small>
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="wl-link" onClick={() => setChangingTz(true)}>
                    Change
                  </Button>
                </div>
              )}
            </div>
            <Button type="submit" className="wl-primary" disabled={pending}>
              {pending ? "Saving…" : "Continue"}
            </Button>
            <div className="wl-row">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)} disabled={pending}>
                Back
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => saveBusiness(true)} disabled={pending}>
                Skip for now
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="wl-form">
            <h1 className="wl-title">You&rsquo;re set, {first}</h1>
            <Button type="button" className="wl-primary" onClick={() => finish("client")} disabled={pending}>
              Add your first client
            </Button>
            <Button type="button" variant="outline" className="wl-secondary" onClick={() => finish("tour")} disabled={pending}>
              Take a tour
            </Button>
            <Button type="button" variant="ghost" className="wl-tertiary" onClick={() => finish("look")} disabled={pending}>
              Look around first
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
