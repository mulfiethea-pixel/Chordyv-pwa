const CACHE = 'chordyv-cache-v3';
const ASSETS = [
  './', './index.html', './splash.html', './manifest.webmanifest',
  './icons/chordyv-icon-bar-192-padded.png', './icons/chordyv-icon-bar-512-padded.png',
  './images/chordyv-splash.png', './privacy.html', './terms.html'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const accept = e.request.headers.get('accept') || '';
  const wantsHTML = accept.includes('text/html');
  e.respondWith(
    wantsHTML
      ? fetch(e.request).then(r=>{ caches.open(CACHE).then(c=>c.put(e.request, r.clone())); return r; })
          .catch(()=>caches.match(e.request).then(r=> r || caches.match('./index.html')))
      : caches.match(e.request).then(r=> r || fetch(e.request).then(n=>{
          caches.open(CACHE).then(c=>c.put(e.request, n.clone())); return n;
        }).catch(()=>r))
  );
});