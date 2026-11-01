/* مصحف الشهباء — يحفظ الموقع في الجهاز ليعمل دون إنترنت */
const SHELL_V = 'shahba-shell-0.2.0';
const PAGES = 'shahba-pages-v1';          // font packs never change: kept across versions
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'manifest.webmanifest', 'favicon.ico',
  'icons/eagle.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'fonts/Qomra-regular.ttf', 'fonts/Qomra-medium.ttf', 'fonts/Qomra-black.ttf', 'fonts/QCF_SurahHeader_COLOR-Regular.woff2',
  'data/pages.json', 'data/surahs.json', 'data/packs.json', 'data/glyphs.json', 'data/ayat.json'];

self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL_V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL_V && k !== PAGES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/fonts/pages/') || url.pathname.endsWith('/data/words.json')) {
    e.respondWith(caches.open(PAGES).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    }));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const cp = res.clone(); caches.open(SHELL_V).then(c => c.put('index.html', cp)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.open(SHELL_V).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
