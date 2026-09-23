"use client";

import { useState } from "react";
import Link from "next/link";
import { Toaster } from "../../components/ui/toast";
import TrainingDraft, { type DraftProgram, type Library } from "./training/TrainingDraft";
import NutritionDraft, { type DraftNutrition } from "./nutrition/NutritionDraft";
import MeasurementsDraft, { type DraftMeasurements } from "./measurements/MeasurementsDraft";
import PicturesDraft, { type DraftPictures } from "./pictures/PicturesDraft";
import MeetingsDraft, { type DraftMeetings } from "./meetings/MeetingsDraft";
import PlanDraft, { type DraftPlan } from "./plan/PlanDraft";
import HomeDraft, { type DraftHome } from "./home/HomeDraft";
import MessagesDraft, { type DraftMessages } from "./messages/MessagesDraft";
import RedesignRail from "./RedesignRail";
import type { RailData } from "./loaders";

// The redesign drafts on one page: the rail on the left, and Training,
// Nutrition and Measurements all loaded on the right, one shown at a time.
// A switch is instant and keeps what was typed on the other tab; the
// address follows, so a refresh or a link lands on the tab it names.

const TABS = [
  { key: "home", label: "Home" },
  { key: "plan", label: "Plan" },
  { key: "training", label: "Training" },
  { key: "nutrition", label: "Nutrition" },
  { key: "measurements", label: "Measurements" },
  { key: "pictures", label: "Progress pictures" },
  { key: "meetings", label: "Meetings" },
  // Messages is always the last tab.
  { key: "messages", label: "Messages" },
] as const;
export type RedesignTab = (typeof TABS)[number]["key"];
// The tabs that save, and how the banner names them.
const REAL: Partial<Record<RedesignTab, string>> = { home: "Home of", messages: "Messages with", plan: "Plan of", training: "Training of", nutrition: "Nutrition of", measurements: "Measurements of", pictures: "Progress pictures of", meetings: "Meetings of" };

export type RedesignShellProps = {
  clientId: number;
  clientName: string;
  firstName: string;
  rail: RailData;
  initialTab: RedesignTab;
  home: DraftHome;
  training: { draft: DraftProgram | null; library: Library };
  nutrition: DraftNutrition;
  measurements: DraftMeasurements;
  pictures: DraftPictures;
  meetings: DraftMeetings;
  plan: DraftPlan;
  messages: DraftMessages;
};

export default function RedesignShell({ clientId, clientName, firstName, rail, initialTab, home, training, nutrition, measurements, pictures, meetings, plan, messages }: RedesignShellProps) {
  const [tab, setTab] = useState<RedesignTab>(initialTab);
  const show = (t: RedesignTab) => {
    setTab(t);
    // Keep the other tab's query (week, programme, phase) out of this one's address.
    window.history.replaceState(null, "", `/admin/redesign/${t}?client=${clientId}`);
  };
  const current = tab === "home" ? "Home on the client" : tab === "training" ? "Training builder on the programme" : tab === "nutrition" ? "Nutrition on the plan" : tab === "measurements" ? "Measurements on the check-ins" : tab === "pictures" ? "Progress pictures on the sheets" : tab === "meetings" ? "Meetings on the calendar" : tab === "messages" ? "Messages on what was sent" : "Plan on the phases and goals";
  return (
    <div className="rd-frame">
      <RedesignRail rail={rail} clientId={clientId} />
      <div className="rd-page">
        <nav className="rd-nav" aria-label="Redesign drafts">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={t.key === tab ? "on" : ""} aria-current={t.key === tab ? "page" : undefined} onClick={() => show(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
        <p className="rd-banner">
          {REAL[tab] ? (
            <>Redesign · {REAL[tab]} {clientName}. This tab is real: everything here saves.</>
          ) : (
            <>
              Redesign draft · {current} of {clientName}. Read-only: every action answers with a toast and saves nothing. Compare with <Link href={`/admin?client=${clientId}&tab=${tab}`}>the current one</Link>.
            </>
          )}
        </p>
        <div hidden={tab !== "home"}>
          <HomeDraft clientId={clientId} firstName={firstName} home={home} onOpenTab={(t) => show(t as RedesignTab)} />
        </div>
        <div hidden={tab !== "training"}>{training.draft ? <TrainingDraft key={`${training.draft.id}:${training.draft.weekIdx}`} clientId={clientId} firstName={firstName} program={training.draft} library={training.library} /> : <p className="rd-empty">This client has no programme yet.</p>}</div>
        <div hidden={tab !== "nutrition"}>
          <NutritionDraft key={nutrition.id} clientId={clientId} firstName={firstName} plan={nutrition} />
        </div>
        <div hidden={tab !== "measurements"}>
          <MeasurementsDraft key={measurements.id} clientId={clientId} firstName={firstName} plan={measurements} />
        </div>
        <div hidden={tab !== "pictures"}>
          <PicturesDraft clientId={clientId} firstName={firstName} plan={pictures} />
        </div>
        <div hidden={tab !== "meetings"}>
          <MeetingsDraft clientId={clientId} firstName={firstName} plan={meetings} />
        </div>
        <div hidden={tab !== "plan"}>
          <PlanDraft clientId={clientId} firstName={firstName} plan={plan} />
        </div>
        <div hidden={tab !== "messages"}>
          <MessagesDraft clientId={clientId} firstName={firstName} plan={messages} />
        </div>
      </div>
      <Toaster />
    </div>
  );
}
