// Minimal Web Push service worker. Registered from lib/push/subscribe.ts.
// Two responsibilities only: show an incoming push as a notification, and
// open the right URL when the user taps it.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "PartnerBet", body: event.data.text() };
  }

  const title = payload.title || "PartnerBet";
  const options = {
    body: payload.body || "",
    icon: "/icon",
    badge: "/icon",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
