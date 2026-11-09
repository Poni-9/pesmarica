// Pesmarica: service worker, da aplikacija deluje brez interneta.
const CACHE = 'pesmarica-v17';
const STATIC = 'pesmarica-static'; // pisave in knjižnice: ostanejo med posodobitvami
const CORE = ['./', './index.html', './manifest.webmanifest', './pdf.min.js', './pdf.worker.min.js', './pdf-lib.min.js', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== STATIC).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// omrežje z omejenim časom: ob slabi povezavi se aplikacija odpre iz predpomnilnika in ne obvisi
const timed = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); no(e); }); });
const fromCache = async req => (await caches.match(req)) || (await caches.match('./index.html'));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); } return r; });
    e.respondWith(timed(net, 3500).catch(() => caches.match('./index.html').then(hit => hit || net)));
    e.waitUntil(net.catch(() => {}));
    return;
  }
  if (url.origin === location.origin && url.pathname.endsWith('notes-enc.json')) {
    e.respondWith(timed(fetch(req), 6000).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => caches.match(req)));
    return;
  }
  const google = url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com');
  if (url.origin === location.origin || google) {
    e.respondWith(caches.match(req).then(hit => hit || timed(fetch(req), google ? 4000 : 20000).then(r => {
      if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(google ? STATIC : CACHE).then(c => c.put(req, copy)); }
      return r;
    })));
  }
});
