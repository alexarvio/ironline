"use client";

import { ArrowRightIcon } from "../components/icons";
import { useOpenCoach } from "./CheckInContext";

// The client's coach at the top of the Account tab: photo (or initial), name
// and title. Tapping it opens the coach's profile as a pushed layer.
export default function CoachRow({ name, title, photoPath }: { name: string; title: string; photoPath: string | null }) {
  const openCoach = useOpenCoach();
  return (
    <button type="button" className="cpf-row" onClick={() => openCoach?.()}>
      <span className="cpf-row-avatar" aria-hidden="true">
        {photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
          <img src={photoPath} alt="" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      <span className="home-dark-row-body">
        <span className="home-dark-row-title">{name}</span>
        <span className="home-dark-row-detail">{title || "Your coach"}</span>
      </span>
      <ArrowRightIcon />
    </button>
  );
}
