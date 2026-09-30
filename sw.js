// Service worker: guarda la app para usarla sin conexión y permite actualizarla.
// Para publicar una actualización basta con subir los cambios a la rama main:
// el despliegue sustituye __BUILD__ por el commit y el móvil detecta la nueva versión.
// Sube VERSION cuando quieras que el número visible cambie (p. ej. 1.1.0).
const VERSION = '1.0.0';
const BUILD = '__BUILD__';
const CACHE = `contador-dinero-${VERSION}-${BUILD}`;

const ARCHIVOS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' evita coger archivos viejos de la caché HTTP
  e.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(ARCHIVOS.map((url) => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves
      .filter((k) => k.startsWith('contador-dinero-') && k !== CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  const tipo = e.data && e.data.tipo;
  if (tipo === 'SKIP_WAITING') self.skipWaiting();
  if (tipo === 'VERSION' && e.ports[0]) {
    const build = BUILD.startsWith('__') ? '' : ` (${BUILD})`;
    e.ports[0].postMessage({ version: VERSION + build });
  }
});

self.addEventListener('fetch', (e) => {
  const peticion = e.request;
  if (peticion.method !== 'GET' || new URL(peticion.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(peticion, { ignoreSearch: true });
    if (guardada) return guardada;
    try {
      return await fetch(peticion);
    } catch (error) {
      if (peticion.mode === 'navigate') return cache.match('./');
      throw error;
    }
  })());
});
