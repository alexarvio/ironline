"use client";

import { uploadProgressPhotoAction } from "../lib/actions";

export default function PhotoUploadBox({
  clientId,
  slotId,
  label,
  currentSrc,
}: {
  clientId: number;
  slotId: number;
  label: string;
  currentSrc: string | null;
}) {
  return (
    <form action={uploadProgressPhotoAction} className="photo-upload-box">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="slotId" value={slotId} />
      <label className="photo-upload-tile">
        {currentSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentSrc} alt={label} className="photo-thumb-img" />
        ) : (
          <span className="photo-upload-plus">+</span>
        )}
        <input
          type="file"
          name="file"
          accept="image/*"
          capture="environment"
          className="photo-upload-input"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
      </label>
      <div className="photo-thumb-label">{label}</div>
    </form>
  );
}
