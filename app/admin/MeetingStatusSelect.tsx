"use client";

import { setMeetingStatusAction } from "../lib/actions";

export default function MeetingStatusSelect({
  meetingId,
  status,
}: {
  meetingId: number;
  status: "scheduled" | "completed" | "canceled";
}) {
  return (
    <form action={setMeetingStatusAction}>
      <input type="hidden" name="id" value={meetingId} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="scheduled">Scheduled</option>
        <option value="completed">Completed</option>
        <option value="canceled">Canceled</option>
      </select>
    </form>
  );
}
