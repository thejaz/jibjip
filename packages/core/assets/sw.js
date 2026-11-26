// A build owns one immutable, integrity-checked shell. The browser's waiting
// lifecycle keeps open windows on the same release until they have all closed.
const CACHE = "jibjip-__JIBJIP_CACHE_VERSION__";
const APP_SHELL = /* __JIBJIP_PRECACHE_MANIFEST__ */ [];
const SHELL_PATHS = new Set(APP_SHELL.map((entry) => entry.url));

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      await cache.addAll(APP_SHELL.map(({ url, integrity }) => new Request(url, {
        integrity, cache: "reload", credentials: "same-origin", redirect: "error",
      })));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
  // Deliberately no skipWaiting: an open form must never be replaced by an update.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => /^jibjip-[a-f0-9]{12,64}$/.test(key) && key !== CACHE)
    .map((key) => caches.delete(key)))));
  // No clients.claim: an uncontrolled first visit keeps its original resources.
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const navigation = request.mode === "navigate";
  const path = navigation
    ? (url.pathname === "/app" || url.pathname.startsWith("/app/") ? "/app/" : url.pathname === "/about" || url.pathname.startsWith("/about/") ? "/about/" : url.pathname === "/" || url.pathname === "/index.html" ? "/" : null)
    : url.pathname;
  if (!path || !SHELL_PATHS.has(path)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Ignore only URL queries on allowlisted shell files (language/artwork/launcher hints).
    // Never replace this release's HTML with newer network HTML under an old worker.
    const cached = await cache.match(path);
    if (cached) return cached;
    // Recover an individually evicted file only if it still matches this release.
    const entry = APP_SHELL.find((item) => item.url === path);
    try {
      const response = await fetch(new Request(path, {
        integrity: entry.integrity, cache: "reload", credentials: "same-origin", redirect: "error",
      }));
      if (!response.ok) throw new Error("Offline file unavailable");
      await cache.put(path, response.clone());
      return response;
    } catch {
      return new Response("This offline file is unavailable. Reconnect and reopen JIBJIP.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  })());
});
