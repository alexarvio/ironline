// The device's half of a save taken once (lib/once.ts): a fresh key the moment Add is tapped, sent with that save and
// with it again if the signal drops and it goes again. A new tap is a new key, so adding a thing twice on purpose still
// adds it twice. No server imports here.

export function newOnceKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
