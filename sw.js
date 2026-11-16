/* ═══════════════════════════════════════════════════════════════════════════
   KOPERASI RENCO — Service Worker
   • Halaman (index.html, ±7,5 MB): NETWORK-FIRST. Selalu minta versi terbaru ke server
     (revalidasi), jatuh ke cache bila offline / server tidak merespons dalam 4 dtk.
     Jadi setiap rilis (ubah <meta name="rc-build">) langsung terbaca tanpa menaikkan versi di sini.
   • Aset lokal (assets/*, manifest): stale-while-revalidate.
   • Pustaka CDN (cdnjs / jsDelivr / Google Fonts): disimpan agar tetap jalan offline.
   • TIDAK menyentuh: Supabase (REST & realtime), API berita/IP/geocoding, proxy, permintaan non-GET,
     permintaan Range, dan pengecekan versi "?_rcchk=" milik index.html (harus selalu ke jaringan).
   Naikkan VERSION hanya bila daftar PRECACHE berubah atau ingin memaksa cache aset dibuat ulang.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const VERSION = '20261116-v1';
const PREFIX = 'renco-';
const CACHE_PAGES = PREFIX + 'pages-' + VERSION;
const CACHE_STATIC = PREFIX + 'static-' + VERSION;
const CACHE_CDN = PREFIX + 'cdn-' + VERSION;
const CACHES_NOW = [CACHE_PAGES, CACHE_STATIC, CACHE_CDN];

const SCOPE = self.registration.scope;                       // mis. https://host/Renco-Capital-/
const INDEX_URL = new URL('index.html', SCOPE).href;
const NETWORK_TIMEOUT = 4000;                                // ms menunggu server sebelum pakai cache
const MAX_RUNTIME_ENTRIES = 80;

/* Aset lokal yang di-precache (yang tidak ada diabaikan, install tidak gagal) */
const PRECACHE = [
  'manifest.json',
  'manifest-rencopay.json',
  'assets/favicon-48.png',
  'assets/icon-192.png',
  'assets/icon-renco.png',
  'assets/apple-touch-icon.png',
  'assets/rencopay-192.png',
  'assets/logo-renco.jpg',
  'assets/logo-renco-capital.png',
  'assets/logo-renco-print.png'
];

/* Pustaka CDN yang dipakai index.html (di-precache agar PDF, QR, Lottie & Supabase jalan offline) */
const PRECACHE_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie_light.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

/* ── helper ─────────────────────────────────────────────────────────────── */
function isCacheable(res) {
  return res && res.ok && (res.type === 'basic' || res.type === 'cors');
}

async function trim(cacheName, max) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
  } catch (e) {}
}

function offlinePage() {
  const html = '<!doctype html><html lang="id"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Koperasi Renco — Offline</title>' +
    '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#0b3a19;color:#fff6d8;font-family:system-ui,sans-serif;text-align:center;padding:24px}' +
    'h1{font-size:20px;margin:0 0 8px}p{margin:0 0 18px;opacity:.85;font-size:14px}' +
    'button{background:#e4b93a;color:#0b3a19;border:0;border-radius:12px;padding:12px 22px;font-weight:700;font-size:15px}</style>' +
    '</head><body><div><h1>Tidak ada koneksi internet</h1>' +
    '<p>Aplikasi belum tersimpan di perangkat ini. Sambungkan internet lalu coba lagi.</p>' +
    '<button onclick="location.reload()">Coba Lagi</button></div></body></html>';
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

/* ── install ────────────────────────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const pages = await caches.open(CACHE_PAGES);
    const stat = await caches.open(CACHE_STATIC);
    const cdn = await caches.open(CACHE_CDN);

    /* index.html: ambil dari HTTP cache browser (halaman baru saja dimuat) → tanpa unduh ulang 7,5 MB,
       supaya aplikasi sudah bisa offline sejak kunjungan pertama. */
    const jobs = [
      fetch(INDEX_URL, { cache: 'force-cache' })
        .then((r) => (isCacheable(r) ? pages.put(INDEX_URL, r) : null))
        .catch(() => {})
    ];

    PRECACHE.forEach((p) => {
      const url = new URL(p, SCOPE).href;
      jobs.push(
        fetch(url, { cache: 'reload' })
          .then((r) => (isCacheable(r) ? stat.put(url, r) : null))
          .catch(() => {})
      );
    });

    PRECACHE_CDN.forEach((url) => {
      jobs.push(
        fetch(url, { mode: 'cors', credentials: 'omit' })
          .then((r) => (isCacheable(r) ? cdn.put(url, r) : null))
          .catch(() => {})
      );
    });

    await Promise.all(jobs);
    await self.skipWaiting();
  })());
});

/* ── activate: buang cache versi lama ───────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith(PREFIX) && !CACHES_NOW.includes(k))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* ── fetch ──────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;                       // audio/video: biarkan ke jaringan

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  /* pengecekan versi index.html harus selalu ke jaringan, jangan pernah dari cache */
  if (url.searchParams.has('_rcchk')) return;

  /* ── halaman utama ── */
  if (req.mode === 'navigate' && url.origin === location.origin) {
    const scopePath = new URL(SCOPE).pathname;
    if (url.pathname === scopePath || url.pathname === scopePath + 'index.html') {
      event.respondWith(handleNavigation(event));
    }
    return;
  }

  /* ── aset sendiri ── */
  if (url.origin === location.origin) {
    if (!url.pathname.startsWith(new URL(SCOPE).pathname)) return;
    if (url.pathname.endsWith('/sw.js')) return;
    event.respondWith(staleWhileRevalidate(event, CACHE_STATIC, req));
    return;
  }

  /* ── pustaka CDN & font; domain lain (Supabase, API, proxy, gambar luar) tidak disentuh ── */
  if (CDN_HOSTS.includes(url.hostname)) {
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'cdn.jsdelivr.net') {
      /* CSS font & jsDelivr tanpa versi pasti (mis. supabase-js@2) → boleh diperbarui diam-diam */
      event.respondWith(cdnFetch(event, url.href, true));
    } else {
      event.respondWith(cdnFetch(event, url.href, false));
    }
  }
});

/* Network-first dengan batas waktu; cache jadi cadangan. */
async function handleNavigation(event) {
  const cache = await caches.open(CACHE_PAGES);

  const network = fetch(INDEX_URL, { cache: 'no-cache' }).then((res) => {
    if (isCacheable(res)) {
      const copy = res.clone();
      event.waitUntil(cache.put(INDEX_URL, copy).catch(() => {}));
    }
    return res;
  });
  event.waitUntil(network.catch(() => {}));

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_TIMEOUT));

  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;                                   // server menjawab tepat waktu
    const cached = await cache.match(INDEX_URL);
    if (cached) return cached;                                 // server lambat → pakai salinan lokal
    return await network;                                      // tak ada cache → tunggu server
  } catch (e) {
    const cached = await cache.match(INDEX_URL);
    return cached || offlinePage();
  }
}

/* Cache dulu, perbarui di latar belakang. */
async function staleWhileRevalidate(event, cacheName, req) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req.url);
  const refresh = fetch(req)
    .then((res) => {
      if (isCacheable(res)) {
        cache.put(req.url, res.clone()).then(() => trim(cacheName, MAX_RUNTIME_ENTRIES)).catch(() => {});
      }
      return res;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const res = await refresh;
  return res || Response.error();
}

/* CDN: ambil dengan mode CORS agar bisa disimpan (respons "opaque" memakan kuota besar). */
async function cdnFetch(event, href, revalidate) {
  const cache = await caches.open(CACHE_CDN);
  const cached = await cache.match(href);

  const refresh = () =>
    fetch(href, { mode: 'cors', credentials: 'omit' })
      .then((res) => {
        if (isCacheable(res)) {
          cache.put(href, res.clone()).then(() => trim(CACHE_CDN, MAX_RUNTIME_ENTRIES)).catch(() => {});
        }
        return res;
      });

  if (cached) {
    if (revalidate) event.waitUntil(refresh().catch(() => {}));
    return cached;
  }
  try {
    return await refresh();
  } catch (e) {
    return Response.error();
  }
}

/* ── pesan dari halaman ─────────────────────────────────────────────────── */
self.addEventListener('message', (event) => {
  const d = event.data;
  if (!d) return;
  const type = typeof d === 'string' ? d : d.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'SW_VERSION', version: VERSION });
  if (type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIX)).map((k) => caches.delete(k)))));
  }
});
