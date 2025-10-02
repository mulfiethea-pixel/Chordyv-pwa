// ===== ChordyV Service Worker =====

// Ambil versi dari query param pada start_url (?v=...)
const VERSION = new URL(location).searchParams.get("v") || "dev";
const CACHE_NAME = `cv-cache-${VERSION}`;

// Install: aktifkan cepat
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

// Activate: bersihkan cache lama + klaim kontrol
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Fetch strategy:
// - HTML: network-first (agar update langsung kebaca), fallback ke cache/offline
// - Non-HTML: cache-first, lalu update cache di belakang layar
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const accept = req.headers.get("accept") || "";
  const isHTML = accept.includes("text/html");

  if (isHTML) {
    e.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: "no-store" });
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, net.clone());   // simpan salinan
        } catch (_) {}
        return net.clone();                    // <-- penting: return clone juga
      } catch {
        const cached = await caches.match(req);
        return cached || new Response("Offline", { status: 503 });
      }
    })());
  } else {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) {
        // update di belakang layar, tetap kembalikan cached
        fetch(req).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
        }).catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(req);
        try {
          const c = await caches.open(CACHE_NAME);
          await c.put(req, res.clone());
        } catch (_) {}
        return res.clone();                    // <-- penting: return clone
      } catch {
        return new Response("", { status: 504 }); // silently fail untuk asset
      }
    })());
  }
});

// Komunikasi sederhana untuk cek siap/versi dari halaman
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CHECK_READY") {
    event.source.postMessage({ type: "READY_OK", version: VERSION });
  }
});