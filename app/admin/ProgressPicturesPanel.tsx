import {
  getClient,
  getPhotoCadence,
  getPhotoPeriodNote,
  listPhotoPeriods,
  listPhotoSlots,
  listPhotoUploads,
  photoPeriodTitle,
} from "../lib/queries";
import AutosaveNote from "./AutosaveNote";
import PhotoAngleRail from "./PhotoAngleRail";
import PhotoCadenceSelect from "./PhotoCadenceSelect";
import PhotoPeriodRow from "./PhotoPeriodRow";
import PhotoCompareView from "./PhotoCompareView";

// Progress pictures for one client: how often a fresh sheet opens, which
// angles it asks for, and every set taken so far as one expandable row per
// date, newest first, with the coach's notes on each.
export default function ProgressPicturesPanel({ clientId }: { clientId: number }) {
  const slots = listPhotoSlots(clientId);
  const slotIds = slots.map((s) => s.id);
  const uploads = listPhotoUploads(slotIds);
  const periods = listPhotoPeriods(slotIds);
  const cadence = getPhotoCadence(clientId);
  const clientName = getClient(clientId)?.name ?? "the client";
  // eslint-disable-next-line react-hooks/purity -- a server component render is the intended clock here
  const renderedAt = Date.now();

  const photoFor = (slotId: number, period: string) =>
    uploads.find((u) => u.slot_id === slotId && u.period === period)?.file_path ?? null;

  return (
    <div className="pp">
      <div className="ms-topbar">
        <span className="ms-topbar-live">
          <span className="ms-live-dot" aria-hidden="true" />
          Live in {clientName}&rsquo;s app
        </span>
        <AutosaveNote renderedAt={renderedAt} savedText="Up to date" idleText="Up to date" idleAsSaved />
      </div>

      <section className="ms-section">
        <div className="ms-head">
          <h3 className="ad-microlabel">Angles</h3>
          <span className="cid">
            <span className="cid-label">New set opens</span>
            <PhotoCadenceSelect clientId={clientId} cadence={cadence} />
          </span>
        </div>
        <p className="ad-field-note" style={{ margin: "0 0 10px" }}>
          One square per shot you want. The client sees the same squares, empty, each time a new set opens, and fills
          them from their camera or photo library.
        </p>
        <PhotoAngleRail clientId={clientId} slots={slots} />
      </section>

      {slots.length >= 1 && periods.length >= 2 && (
        <section className="ms-section">
          <PhotoCompareView
            periodsData={[...periods].reverse().map((period) => ({
              period,
              label: photoPeriodTitle(period, cadence),
              photos: slots.map((slot) => ({ slotId: slot.id, label: slot.label, src: photoFor(slot.id, period) })),
            }))}
          />
        </section>
      )}

      <section className="ms-section">
        <div className="ms-head">
          <h3 className="ad-microlabel">Sets</h3>
          <span className="cg-count">
            {periods.length} {periods.length === 1 ? "set" : "sets"}
          </span>
        </div>
        {slots.length === 0 ? (
          <p className="ad-panel-empty">Add an angle first. The client&rsquo;s photo sheet is built from them.</p>
        ) : periods.length === 0 ? (
          <p className="ad-panel-empty">Nothing uploaded yet. Sets appear here the moment the client submits a photo.</p>
        ) : (
          <div className="photo-gallery">
            {periods.map((period) => {
              const photos = slots.map((slot) => ({ slotId: slot.id, label: slot.label, src: photoFor(slot.id, period) }));
              const uploadedCount = photos.filter((p) => p.src).length;
              return (
                <PhotoPeriodRow
                  key={period}
                  clientId={clientId}
                  period={period}
                  title={photoPeriodTitle(period, cadence)}
                  subtitle={`${uploadedCount} of ${slots.length} photos`}
                  photos={photos}
                  note={getPhotoPeriodNote(clientId, period)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
