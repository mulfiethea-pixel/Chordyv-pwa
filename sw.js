// --- ChordyV Service Worker (v10 hardened) ---
// NOTE: Tidak perlu ubah index.html. Scope & path mengikuti /Chordyv-pwa/.
const CACHE = 'chordyv-cache-v10';

// File inti (ikuti daftar kamu agar konsisten)
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-1024-v3.png',
  './icon-512-v3.png',
  './privacy.html',
  './terms.html',
];

// ===== INSTALL: precache inti =====
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// ===== ACTIVATE: bersihkan cache lama + enable navigation preload =====
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));

    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    await self.clients.claim();
  })());
});

// ===== FETCH: GET only; HTML (navigate) → network-first; aset statik → cache-first =====
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Helper: klasifikasi request agar cache hanya menyimpan aset statik aman
  const dest = req.destination; // 'document' | 'script' | 'style' | 'image' | 'font' | ...
  const isStaticAsset = ['script', 'style', 'image', 'font'].includes(dest);
  const isAPIorJSON = /\/api\/|\.json(\?|$)/i.test(req.url);

  // 1) NAVIGASI DOKUMEN → online-first + navigation preload, fallback ke index.html
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        // Preload (kalau tersedia) umumnya lebih cepat di mobile
        const preload = await e.preloadResponse;
        if (preload) {
          if (sameOrigin) (await caches.open(CACHE)).put(req, preload.clone());
          return preload;
        }
        // Online-first
        const net = await fetch(req);
        if (sameOrigin && net && net.ok) (await caches.open(CACHE)).put(req, net.clone());
        return net;
      } catch {
        // Fallback: cache match → index.html (ignoreSearch) → root
        return (await caches.match(req)) ||
               (await caches.match('./index.html', { ignoreSearch: true })) ||
               (await caches.match('./')) ||
               Response.error();
      }
    })());
    return;
  }

  // 2) NON-HTML: hanya cache aset statik same-origin; hindari cache API/JSON
  const wantsHTML = (req.headers.get('accept') || '').includes('text/html');
  if (!wantsHTML) {
    // Jika ini API/JSON atau bukan aset statik → jangan cache (langsung network)
    if (isAPIorJSON || !isStaticAsset) {
      e.respondWith(fetch(req).catch(async () => {
        // Jika offline, balikan versi cache kalau ada
        const hit = await caches.match(req);
        return hit || Response.error();
      }));
      return;
    }

    // Aset statik → cache-first (same-origin saja yang disimpan)
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const net = await fetch(req);
        if (sameOrigin && net && net.ok) (await caches.open(CACHE)).put(req, net.clone());
        return net;
      } catch {
        // Offline & belum ada di cache
        const again = await caches.match(req);
        if (again) return again;
        return Response.error();
      }
    })());
    return;
  }

  // 3) Guard terakhir untuk HTML non-navigate (jarang terjadi)
  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      if (sameOrigin && net && net.ok) (await caches.open(CACHE)).put(req, net.clone());
      return net;
    } catch {
      return (await caches.match(req)) ||
             (await caches.match('./index.html', { ignoreSearch: true })) ||
             Response.error();
    }
  })());
});

// Optional: biar update SW instan kalau kamu kirim pesan 'SKIP_WAITING'
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});