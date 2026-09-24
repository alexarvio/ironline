// Ironline's service worker: shows push notifications while the app is
// closed, and opens the app when one is tapped. Nothing else: no caching,
// so the app behaves exactly as it does without it. See app/lib/push.ts.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "Ironline", {
      body: message.body || "",
      icon: "/icon.png",
      badge: "/icon.png",
      tag: message.tag || undefined,
      data: { url: message.url || "/client" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/client", self.location.origin).href;
  event.waitUntil(
    (async () => {
      // Bring an open Ironline window forward rather than opening another.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
