import { addPhotoSlotAction } from "../lib/actions";
import {
  getClient,
  getPhotoCadence,
  getPhotoInstructions,
  getPhotoPeriodNote,
  getPhotoStartDate,
  getWeightSeriesAll,
  listClientPhases,
  listPhotoPeriods,
  listPhotoSlots,
  listPhotoUploads,
  localDateStr,
  photoSheetFor,
  weekStart,
} from "../lib/queries";
import PhotoAngleChips from "./PhotoAngleChips";
import PhotoGallery, { type GallerySheet } from "./PhotoGallery";
import PhotoScheduleForm from "./PhotoScheduleForm";

const PERIOD_UNIT = { weekly: "Week", biweekly: "Check-in", monthly: "Month", sixweekly: "Block" } as const;
const PERIOD_SHORT = { weekly: "Wk", biweekly: "Check-in", monthly: "Month", sixweekly: "Block" } as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SUGGESTED_ANGLES = ["Front relaxed", "Back", "Side", "Legs", "Front flexed"];

// "14 Jun" from a calendar day (a sheet's opening date).
const dayMonth = (day: string) => {
  const d = new Date(`${day}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
// Upload and reminder stamps are ISO instants; read them in server-local time.
const stampDay = (iso: string) => dayMonth(localDateStr(new Date(iso)));
const stampDayTime = (iso: string) =>
  `${stampDay(iso)}, ${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

// Progress pictures for one client: when sheets arrive and which angles they
// ask for, then every sheet in one gallery. The client's name is already on
// the rail and the client card, so it is not repeated here.
export default function ProgressPicturesPanel({ clientId }: { clientId: number }) {
  const firstName = (getClient(clientId)?.name ?? "").trim().split(/\s+/)[0] || "the client";
  const cadence = getPhotoCadence(clientId);
  const startDate = getPhotoStartDate(clientId);
  const instructions = getPhotoInstructions(clientId) ?? "";

  const slots = listPhotoSlots(clientId);
  const active = slots.filter((s) => !s.paused);
  const slotIds = slots.map((s) => s.id);
  const uploads = listPhotoUploads(slotIds);
  const today = localDateStr();

  // The sheet open today, if any angle is being asked for and the first
  // sheet date has come.
  const live = active.length > 0 ? photoSheetFor(clientId, today) : null;
  const uploadedPeriods = listPhotoPeriods(slotIds); // newest first
  const periods =
    live && !uploadedPeriods.includes(live)
      ? [live, ...uploadedPeriods].sort((a, b) => (a < b ? 1 : -1))
      : uploadedPeriods;

  const uploadFor = (slotId: number, period: string) =>
    uploads.find((u) => u.slot_id === slotId && u.period === period) ?? null;

  // The weigh-in that fell inside a sheet: the last one from the day it
  // opened up to the day the next sheet opened (or today, for the newest).
  const weights = getWeightSeriesAll(clientId);
  const weightFor = (period: string, newer: string | undefined) => {
    const inside = weights.filter((w) => w.date >= period && (newer ? w.date < newer : w.date <= today));
    const last = inside[inside.length - 1];
    return last ? Math.round(last.value * 10) / 10 : null;
  };

  // The Plan tab's phase that covered the week a sheet opened in. Phases are
  // stored as whole weeks, Monday to Monday.
  const phases = listClientPhases(clientId);
  const phaseOn = (track: "nutrition" | "training", day: string) => {
    const week = weekStart(day);
    return phases.find((p) => p.track === track && p.start_week <= week && p.end_week >= week)?.name ?? null;
  };

  const sheets: GallerySheet[] = periods.map((period, i) => {
    const isLive = period === live;
    // A sheet shows the angles asked for plus any paused angle it already has.
    const cells = slots
      .filter((s) => !s.paused || uploadFor(s.id, period))
      .map((s) => {
        const u = uploadFor(s.id, period);
        return {
          slotId: s.id,
          label: s.label,
          src: u?.file_path ?? null,
          shot: u ? stampDayTime(u.uploaded_at) : null,
          shotDay: u ? stampDay(u.uploaded_at) : null,
        };
      });
    const inCount = cells.filter((c) => c.src).length;
    const number = periods.length - i;
    const note = getPhotoPeriodNote(clientId, period);
    return {
      period,
      title: `${PERIOD_UNIT[cadence]} ${number}`,
      short: `${PERIOD_SHORT[cadence]} ${number}`,
      live: isLive,
      complete: cells.length > 0 && inCount === cells.length,
      dateLabel: dayMonth(period),
      inCount,
      total: cells.length,
      cells,
      note: { shape: note.shape, strengths: note.strengths, improvements: note.improvements, next_steps: note.next_steps },
      savedLabel: note.saved_at ? stampDayTime(note.saved_at) : null,
      weight: weightFor(period, periods[i - 1]),
      phases: { nutrition: phaseOn("nutrition", period), training: phaseOn("training", period) },
    };
  });


  let gallery;
  if (slots.length === 0) {
    gallery = (
      <section className="pp-card pp-empty">
        <h3 className="pp-empty-title">Decide what you want to see, and how often</h3>
        <p className="pp-empty-text">
          An angle is one photo you ask {firstName} for on every sheet: front relaxed, back, side, whatever shows you
          the most. {firstName} fills each box from their camera, and the photos show up here as they land.
        </p>
        <div className="pp-suggest">
          {SUGGESTED_ANGLES.map((label) => (
            <form key={label} action={addPhotoSlotAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="label" value={label} />
              <button type="submit" className="pp-suggest-chip">
                + {label}
              </button>
            </form>
          ))}
        </div>
      </section>
    );
  } else if (sheets.length === 0) {
    gallery = (
      <section className="pp-card pp-empty">
        <h3 className="pp-empty-title">
          {active.length === 0
            ? "Every angle is paused"
            : startDate && today < startDate
            ? `The first sheet opens ${dayMonth(startDate)}`
            : "No sheets yet"}
        </h3>
        <p className="pp-empty-text">
          {active.length === 0
            ? "No sheet opens while nothing is asked for. Click an angle above to ask for it again."
            : `Photos land here the moment ${firstName} submits.`}
        </p>
      </section>
    );
  } else {
    gallery = <PhotoGallery clientId={clientId} firstName={firstName} sheets={sheets} />;
  }

  return (
    <div className="pp">
      {/* No title here: the tab strip above already says Progress pictures. */}
      <section className="pp-card pp-config">
        <PhotoScheduleForm
          clientId={clientId}
          firstName={firstName}
          startDate={startDate ?? ""}
          cadence={cadence}
          instructions={instructions}
        />

        <hr className="pp-hairline" />

        <div className="pp-label-row">
          <span className="pp-label">Angles you ask for</span>
          {slots.length > 0 && (
            <span className="pp-label-right">
              {active.length} of {slots.length} active · click one to pause it
            </span>
          )}
        </div>
        <div className="pp-chips">
          {slots.length > 0 && (
            <PhotoAngleChips
              clientId={clientId}
              slots={slots.map((s) => ({ id: s.id, label: s.label, paused: !!s.paused }))}
            />
          )}
          <form action={addPhotoSlotAction} className="pp-add">
            <input type="hidden" name="clientId" value={clientId} />
            <input name="label" type="text" className="pp-input" placeholder="Name an angle…" aria-label="New angle name" required />
            <button type="submit" className="pp-btn navy sm">
              Add
            </button>
          </form>
        </div>
      </section>

      {gallery}
    </div>
  );
}
