"use client";

import { removeClientAvatarAction, uploadClientAvatarAction } from "../lib/actions";

// The client's profile picture. Tap the circle to choose a photo; it uploads
// on the spot and shows up for the coach straight away. Falls back to the
// initial until one is set.
export default function AvatarUpload({
  clientId,
  name,
  avatarPath,
}: {
  clientId: number;
  name: string;
  avatarPath: string | null;
}) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <div className="av-row">
      <form action={uploadClientAvatarAction}>
        <input type="hidden" name="clientId" value={clientId} />
        <label className="av-tile" title={avatarPath ? "Change photo" : "Add a photo"}>
          {avatarPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded file
            <img src={avatarPath} alt="" className="av-img" />
          ) : (
            <span className="av-initial" aria-hidden="true">
              {initial}
            </span>
          )}
          <span className="av-badge" aria-hidden="true">
            +
          </span>
          <input
            type="file"
            name="file"
            accept="image/*"
            className="photo-upload-input"
            aria-label="Choose a profile photo"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          />
        </label>
      </form>
      <div className="av-text">
        <div className="av-title">{avatarPath ? "Profile photo" : "Add a profile photo"}</div>
        <div className="av-sub">Your coach sees it next to your name.</div>
        {avatarPath && (
          <form action={removeClientAvatarAction}>
            <input type="hidden" name="clientId" value={clientId} />
            <button type="submit" className="av-remove">
              Remove
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
