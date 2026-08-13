const CACHE="harsha-supabase-pwa-v1";const ASSETS=["./","./index.html","./assets/styles.css","./assets/app.js","./assets/config.js","./manifest.json"];self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || "Harsha College Assistant";
  const options = {
    body: data.body || "You have a reminder.",
    tag: data.tag || "harsha-reminder",
    renotify: true,
    data: { url: data.url || "./index.html", reminderId: data.reminderId || null },
    icon: data.icon || "./icon-192.png",
    badge: data.badge || "./icon-192.png"
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || "./index.html";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target).catch(()=>{});
          return client.focus();
        }
      }
      return clients.openWindow ? clients.openWindow(target) : undefined;
    })
  );
});
