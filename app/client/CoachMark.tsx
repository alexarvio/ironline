"use client";

import { useCoachIdentity } from "./CheckInContext";

// The coach's small round picture, put in front of anything they wrote:
// the message card on Home, each bubble in their feed, a note on an
// exercise, the instructions on a progress sheet. Their initial until they
// have set a picture. Reads the coach from context so the server component
// in between needs no prop.
export default function CoachMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const coach = useCoachIdentity();
  const initial = (coach?.name ?? "C").trim().charAt(0).toUpperCase() || "C";
  return (
    <span className={`coach-mark ${size}`} aria-hidden="true">
      {coach?.photoPath ? (
        // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
        <img src={coach.photoPath} alt="" />
      ) : (
        initial
      )}
    </span>
  );
}
