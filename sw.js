/* Service worker: la app funciona sin internet y guarda en caché las imágenes de ejercicios.
   Sube el número de versión cada vez que publiques cambios para forzar la actualización. */
const VERSION = 'gymlog-v1.0.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'data/exercises.js', 'data/seed-history.js',
  'js/core/utils.js', 'js/core/db.js', 'js/core/store.js', 'js/core/ui.js',
  'js/modules/exercises.js', 'js/modules/templates.js', 'js/modules/workout.js', 'js/modules/history.js',
  'js/modules/progress.js', 'js/modules/tools.js', 'js/modules/settings.js', 'js/app.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];
const IMG_CACHE = 'gymlog-img';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== IMG_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Imágenes externas: caché primero
  if (url.origin !== location.origin) {
    if (e.request.destination === 'image') {
      e.respondWith(caches.open(IMG_CACHE).then(async c => {
        const hit = await c.match(e.request); if (hit) return hit;
        try { const res = await fetch(e.request); if (res.ok || res.type === 'opaque') c.put(e.request, res.clone()); return res; }
        catch { return new Response('', { status: 404 }); }
      }));
    }
    return;
  }
  // App: responde al instante desde caché (rápido aunque haya mala señal en el gym)
  // y actualiza la caché en segundo plano; los cambios se ven al siguiente arranque.
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || c.match('index.html');
  }));
});
