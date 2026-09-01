/*
 * Pluclair's service worker.
 *
 * Deliberately narrow. This app is behind a login and every page is
 * personalised, so caching HTML would risk showing one account's figures to
 * another on a shared device. Nothing that could contain a user's data is ever
 * written to the cache.
 *
 * What it does instead:
 *   - keeps the static build assets, so a reload with no signal still boots;
 *   - answers a failed navigation with an offline page rather than the
 *     browser's error, so the app can explain itself;
 *   - stays out of the way of every API and server-action request, which must
 *     always hit the network or fail honestly so the outbox can hold them.
 */

const VERSION = "pluclair-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Build output is content-hashed, so it can be cached forever and safely. */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is ever cacheable. A POST is a server action or a mutation and
  // must reach the network so a failure is visible to the outbox.
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Navigations go to the network every time — a personalised page must never
  // be served from a shared cache — and fall back to the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (hit) =>
            hit ??
            new Response("Offline", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            }),
        ),
      ),
    );
  }
});

/* ---------------------------------------------------------------- push --- */

/*
 * Notifications arrive as an encrypted payload the browser hands to us here.
 * Everything is defensive: a malformed payload must still produce a
 * notification, because the alternative on some browsers is a generic
 * "This site has been updated in the background" that the user cannot act on.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Pluclair";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Collapses repeats of the same subject rather than stacking them.
    tag: data.key || "pluclair",
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/dashboard",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Reuse an open tab where possible — opening a third Pluclair window
        // every time a notification is tapped is its own annoyance.
        for (const client of clients) {
          if (client.url === target && "focus" in client) {
            return client.focus();
          }
        }
        for (const client of clients) {
          if ("navigate" in client && "focus" in client) {
            return client.navigate(target).then((c) => c && c.focus());
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
