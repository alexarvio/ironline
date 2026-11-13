// The client app's bottom tab is remembered as "{client}:{tab}" (13 Nov, Alex: a new account opened on Training, the
// tab the phone remembered from the account signed in before), in sessionStorage and the ironline_tab cookie. Only the
// signed-in client's own is read back, by the server (page.tsx) and the app (AppShell) alike.
export function ownTab(raw: string | null | undefined, clientId: number | null): string | null {
  if (!raw || clientId == null) return null;
  let v = raw;
  if (v.includes("%")) {
    try {
      v = decodeURIComponent(v);
    } catch {
      return null;
    }
  }
  const at = v.indexOf(":");
  return at > 0 && v.slice(0, at) === String(clientId) ? v.slice(at + 1) || null : null;
}
