import { addPhotoSlotAction } from "../lib/actions";
import {
  getPhotoCadence,
  getPhotoPeriodNote,
  listPhotoPeriods,
  listPhotoSlots,
  listPhotoUploads,
  photoPeriodIndex,
} from "../lib/queries";
import PhotoSlotRow from "./PhotoSlotRow";
import PhotoCadenceSelect from "./PhotoCadenceSelect";
import PhotoPeriodRow from "./PhotoPeriodRow";

const PERIOD_UNIT = {
  weekly: "Week",
  biweekly: "Check-in",
  monthly: "Month",
} as const;

export default function ProgressPicturesPanel({ clientId }: { clientId: number }) {
  const slots = listPhotoSlots(clientId);
  const uploads = listPhotoUploads(slots.map((s) => s.id));
  const periods = listPhotoPeriods(slots.map((s) => s.id));
  const periodIndex = photoPeriodIndex(slots.map((s) => s.id));
  const cadence = getPhotoCadence(clientId);

  const photoFor = (slotId: number, period: string) =>
    uploads.find((u) => u.slot_id === slotId && u.period === period)?.file_path ?? null;

  return (
    <div>
      <p className="empty-note" style={{ marginBottom: 18 }}>
        Define the angles you want from this client — name each one whatever makes sense
        (Front, Back, Side, Profile 1, as many as you like), and how often they should get a
        fresh, empty sheet to fill in. On their end, the client taps a box to shoot or upload a
        photo for each angle.
      </p>

      <div className="nutrition-table-wrap builder-card">
        <h3 className="builder-pill-heading">Photo slots</h3>

        <div style={{ marginBottom: 14 }}>
          <label className="empty-note" style={{ display: "block", marginBottom: 6 }}>
            How often should the client get a new sheet?
          </label>
          <PhotoCadenceSelect clientId={clientId} cadence={cadence} />
        </div>

        <form action={addPhotoSlotAction} className="add-invoice-form add-metric-form">
          <input type="hidden" name="clientId" value={clientId} />
          <input name="label" type="text" placeholder="Slot name (e.g. Front, Side, Profile 1)" required />
          <button className="btn" type="submit">
            Add slot
          </button>
        </form>
        {slots.length > 0 && (
          <div className="invoice-list" style={{ marginTop: 14 }}>
            {slots.map((slot) => (
              <PhotoSlotRow key={slot.id} slot={slot} />
            ))}
          </div>
        )}
      </div>

      {slots.length === 0 ? (
        <p className="empty-note">No photo slots defined yet — add one above.</p>
      ) : periods.length === 0 ? (
        <p className="empty-note">
          Slots are set up — nothing uploaded yet. Photos will appear here automatically as
          soon as the client submits one.
        </p>
      ) : (
        <div className="photo-gallery">
          {periods.map((period) => {
            const photos = slots.map((slot) => ({
              slotId: slot.id,
              label: slot.label,
              src: photoFor(slot.id, period),
            }));
            const uploadedCount = photos.filter((p) => p.src).length;
            return (
              <PhotoPeriodRow
                key={period}
                clientId={clientId}
                period={period}
                title={`${PERIOD_UNIT[cadence]} ${periodIndex[period] ?? "?"}`}
                subtitle={`${uploadedCount}/${slots.length} photos uploaded · ${period}`}
                photos={photos}
                note={getPhotoPeriodNote(clientId, period)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
