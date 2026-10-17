// Cut a picture to the Home card's 3:4 (900×1200) in the browser, so what
// goes up is small and already the right shape. The coach's phase dialog and
// the client's own card pictures (12 Oct) both send this. A gym's badge picture asks for a square.
export async function coverJpeg(file: File, W = 900, H = 1200): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvas.getContext("2d")!.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    return await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A photo kept whole, only made smaller (17 Oct): the longest edge at most
// `max` px, a JPEG at 0.85. Progress pictures went up as the camera's
// originals (several MB, ~4000px), so they were slow to send and slow to show.
// Re-encoding also drops the EXIF block, the location with it. null: the
// browser could not read it, and the caller sends the original.
export async function fitJpeg(file: File, max = 1600): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
