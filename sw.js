// Ambil versi dari query param (?v=...)
const VERSION = new URL(location).searchParams.get('v') || 'dev';
const CACHE_NAME = `cv-cache-${VERSION}`;

// Pasang event install
self.addEventListener("install", (e) => {
  self.skipWaiting(); // biar SW baru langsung aktif
});

// Hapus cache lama saat activate
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Strategi fetch
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const accept = req.headers.get("accept") || "";
  const isHTML = accept.includes("text/html");

  if (isHTML) {
    // Untuk dokumen HTML → network-first (biar update langsung kebaca)
    e.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, net.clone());
        return net;
      } catch {
        return await caches.match(req) || new Response("Offline", { status: 503 });
      }
    })());
  } else {
    // Untuk asset lain → cache-first, update di belakang
    e.respondWith((async () => {
      const cached = await caches.match(req);
      const fetcher = fetch(req).then(res => {
        caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fetcher;
    })());
  }
});