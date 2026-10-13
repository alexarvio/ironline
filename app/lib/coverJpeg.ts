// Cut a picture to the Home card's 3:4 (900×1200) in the browser, so what
// goes up is small and already the right shape. The coach's phase dialog and
// the client's own card pictures (12 Oct) both send this.
export async function coverJpeg(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const W = 900, H = 1200;
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
