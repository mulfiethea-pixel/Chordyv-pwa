// ===== Chordyv Service Worker (PRODUCTION) =====
// Scope: /Chordyv-pwa/

const SW_VERSION = new URL(location).searchParams.get("v") || "prod-1";
const CACHE_NAME = `cv-cache-${SW_VERSION}`;
const BASE = "/Chordyv-pwa/";                   // production base
const PRECACHE = [
  `${BASE}index.html`,
  `${BASE}normalize.html`,
];

// ===== Install: pre-cache halaman kritikal =====
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE.map(async (u) => {
      try {
        const res = await fetch(u, { cache: "no-store" });
        await c.put(u, res.clone());
      } catch (_) { /* best-effort */ }
    }));
    self.skipWaiting();
  })());
});

// ===== Activate: bersihkan cache lama & klaim kontrol =====
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ===== Fetch =====
// - HTML: network-first (agar update langsung kebaca), fallback ke cache / SPA shell
// - Non-HTML (JS/CSS/img/font/etc): stale-while-revalidate
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  const accept = req.headers.get("accept") || "";
  const isHTML = accept.includes("text/html");

  // Batasi hanya path production
  if (!url.pathname.startsWith(BASE)) return;

  if (isHTML) {
    e.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, net.clone());
        return net.clone();
      } catch {
        // Fallback: exact match → index.html cached (SPA shell) → 503
        const cache = await caches.open(CACHE_NAME);
        const exact = await cache.match(req);
        if (exact) return exact;
        const shell = await cache.match(`${BASE}index.html`);
        return shell || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Asset: stale-while-revalidate
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const fetchAndUpdate = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (cached) {
      // Kembalikan cepat dari cache, update di belakang layar
      fetchAndUpdate; // fire & forget
      return cached;
    }
    const fresh = await fetchAndUpdate;
    return fresh ? fresh.clone() : new Response("", { status: 504 });
  })());
});

// ===== Messaging (opsional untuk debug versi) =====
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CHECK_READY") {
    event.source.postMessage({ type: "READY_OK", version: SW_VERSION, scope: BASE });
  }
});