import { addWeekSheetAction, removeWeekAction } from "../lib/actions";
import ConfirmDeleteButton from "./ConfirmDeleteButton";

// Sits next to the week pills. Just one action — duplicate the latest week
// forward as a new draft — instead of the old three-item dropdown (deploy /
// duplicate-as-draft / blank), which buried "duplicate" (by far the common
// case, continuing the same routine) behind a menu alongside two other
// things that sounded similar but weren't. Starting a brand new blank week
// lives separately, at the bottom of the page — see the "Start something
// new" section in ProgramBuilder — since that's a different intent
// (a new program, not a continuation) and doesn't need to compete for
// attention here.
export default function WeekActionsMenu({
  clientId,
  latestWeek,
  activeWeek,
  canDeleteActiveWeek,
  weekLinkBase,
}: {
  clientId: number;
  latestWeek: number;
  activeWeek: number;
  canDeleteActiveWeek: boolean;
  weekLinkBase: string;
}) {
  return (
    <div className="week-actions-row">
      <form action={addWeekSheetAction}>
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="fromWeek" value={latestWeek} />
        <input type="hidden" name="weekLinkBase" value={weekLinkBase} />
        <button
          className="btn secondary"
          type="submit"
          title={`Copies week ${latestWeek}'s day labels and exercises into a new draft week ${latestWeek + 1}`}
        >
          Duplicate week {latestWeek}
        </button>
      </form>
      {canDeleteActiveWeek && (
        <ConfirmDeleteButton
          action={removeWeekAction}
          hiddenFields={{ clientId, week: activeWeek, weekLinkBase }}
          label={`Delete draft week ${activeWeek}`}
        />
      )}
    </div>
  );
}
