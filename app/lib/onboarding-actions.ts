"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCoach } from "./auth";
import { getData, persist } from "./db";
import { countryOf } from "./countries";
import { COACH_PROFILE_LIMITS as LIMIT } from "./coachProfileView";
import { getCoachProfile, saveCoachProfile } from "./queries";

// The welcome steps a new coach goes through once the owner lets them in
// (/welcome): who they are, their business, then off to add a client. Each
// step saves as it goes, so leaving halfway keeps what was filled in; the
// last one clears the mark that sends them here (users.onboarding).

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Step 1: name (required), what they coach, specialties. The photo saves on its own (uploadCoachPhotoAction). */
export async function saveWelcomeAboutAction(input: { name: string; title: string; specialties: string[] }): Promise<{ ok: boolean; error?: string }> {
  const coach = await requireCoach();
  const name = clip(input.name, LIMIT.displayName);
  if (!name) return { ok: false, error: "Add your name to carry on." };
  const specialties = [...new Set((input.specialties ?? []).map((s) => clip(s, 40)).filter(Boolean))].slice(0, LIMIT.specialties);
  const p = getCoachProfile(coach.id);
  // Everything else on the profile stays as it is.
  saveCoachProfile(coach.id, {
    displayName: name,
    title: clip(input.title, LIMIT.title),
    headline: p?.headline ?? "",
    location: p?.location ?? "",
    languages: p?.languages ?? "",
    yearsCoaching: p?.years_coaching ?? null,
    intro: p?.intro ?? "",
    bio: p?.bio ?? "",
    quote: p?.quote ?? "",
    specialties,
    studies: p?.studies ?? [],
    experience: p?.experience ?? [],
    outside: p?.outside ?? "",
    replyNote: p?.reply_note ?? "",
  });
  revalidatePath("/welcome");
  return { ok: true };
}

/** Step 2: business name, country (sets currency and tax on invoices), time zone (new meetings start in it). */
export async function saveWelcomeBusinessAction(input: { business: string; countryCode: string; timezone: string }): Promise<{ ok: boolean }> {
  const coach = await requireCoach();
  const user = getData().users.find((u) => u.id === coach.id && u.role === "coach");
  if (!user) return { ok: false };
  const code = countryOf(input.countryCode).code;
  const business = { ...(user.coach_settings?.business ?? {}) };
  const name = clip(input.business, 120);
  if (name) business.business_name = name;
  if (code) business.country_code = code;
  let timezone = clip(input.timezone, 64);
  try {
    if (timezone) new Intl.DateTimeFormat("en-GB", { timeZone: timezone });
  } catch {
    timezone = "";
  }
  user.coach_settings = { ...(user.coach_settings ?? {}), business, ...(timezone ? { timezone } : {}) };
  persist();
  return { ok: true };
}

/** Done: off to add the first client, a short tour of the coach side, or just to look around. */
export async function finishWelcomeAction(next: "client" | "tour" | "look") {
  const coach = await requireCoach();
  const user = getData().users.find((u) => u.id === coach.id);
  if (user?.onboarding) {
    delete user.onboarding;
    persist();
  }
  redirect(next === "client" ? "/admin/redesign/home?add=1" : next === "tour" ? "/admin/redesign/home?tour=1" : "/admin/redesign/home");
}
