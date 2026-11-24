/* Service worker de HAKATIMER: funciona sin conexión */
const CACHE = 'hakatimer-v28';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/timer.js', 'js/exercises.js', 'js/store.js', 'js/audio.js', 'js/led.js', 'js/share.js', 'js/shareui.js', 'js/app.js',
  'fonts/barlow-condensed-latin-600-normal.woff2', 'fonts/barlow-condensed-latin-700-normal.woff2',
  'fonts/barlow-condensed-latin-700-italic.woff2', 'fonts/barlow-condensed-latin-800-italic.woff2',
  'icons/gym-logo.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'audio/cuenta-atras.mp3', 'audio/mitad-tiempo.mp3', 'audio/well-done.mp3', 'audio/ultima-ronda.mp3', 'audio/ultimo-minuto.mp3', 'audio/diez-segundos.mp3', 'audio/descanso.mp3', 'audio/go.mp3'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Primero la red (para que las versiones nuevas lleguen siempre); sin conexión, la copia guardada
  e.respondWith(fetch(e.request).then(res => {
    if (res && res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request)));
});
