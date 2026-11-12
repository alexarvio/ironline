"use client";

import { ChevronRightIcon } from "../components/icons";
import { useOpenCoach } from "./CheckInContext";
import { pic } from "../lib/pic";

// Your coach, the first thing in Settings (12 Nov, Alex: "kind of like its own pill where I can click on it"): their face,
// their name and title, a tap opening their profile. The white hairline pill, as Saved days' and Supplements'.
export default function CoachRow({ name, title, photoPath }: { name: string; title: string; photoPath: string | null }) {
  const openCoach = useOpenCoach();
  if (!openCoach) return null;
  return (
    <button type="button" className="st-coach" onClick={() => openCoach()}>
      <span className="st-coach-face" aria-hidden="true">
        {photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
          <img src={pic(photoPath, 96)} alt="" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      <span className="st-coach-body">
        <span className="st-coach-name">{name}</span>
        {title && <span className="st-coach-title">{title}</span>}
      </span>
      <ChevronRightIcon />
    </button>
  );
}
