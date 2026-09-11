"use client";

import { setMeetingStatusAction } from "../lib/actions";

export type MeetingStatus = "scheduled" | "completed" | "no-show" | "cancelled";

export default function MeetingStatusSelect({ meetingId, status }: { meetingId: number; status: MeetingStatus }) {
  return (
    <form action={setMeetingStatusAction}>
      <input type="hidden" name="id" value={meetingId} />
      <select name="status" defaultValue={status} onChange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Meeting status">
        <option value="scheduled">Scheduled</option>
        <option value="completed">Completed</option>
        <option value="no-show">No-show</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </form>
  );
}
