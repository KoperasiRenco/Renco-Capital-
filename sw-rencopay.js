/* Service worker RencoPay — scope: ./RencoPay.html (terpisah dari sw.js Koperasi).
   Network-first untuk halaman & data (Supabase tidak pernah di-cache); cache hanya cadangan offline untuk halaman/aset sendiri. */
var CACHE = 'rencopay-v1';
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('rencopay-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // Supabase & CDN: langsung ke jaringan
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) { var c = res.clone(); caches.open(CACHE).then(function (ch) { ch.put(req, c); }).catch(function () {}); }
    return res;
  }).catch(function () { return caches.match(req); }));
});
