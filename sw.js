const CACHE_NAME = 'smartfurniture-v3';
const RECURSOS = [
  './',
  './index.html',
  './manifest.json',
  './css/estilos.css',
  './js/core/constantes.js',
  './js/core/escala.js',
  './js/core/plantillas.js',
  './js/core/despiece.js',
  './js/core/corte.js',
  './js/core/calculos.js',
  './js/core/sistema.js',
  './js/ia/analizador.js',
  './js/ui/colores.js',
  './js/ui/planoCorte.js',
  './js/ui/visor3d.js',
  './js/ui/app.js',
  './vendor/three.module.min.js',
  './vendor/three.core.js',
  './vendor/OrbitControls.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(RECURSOS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(
    fetch(ev.request)
      .then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(ev.request, copia));
        return resp;
      })
      .catch(() => caches.match(ev.request)),
  );
});
