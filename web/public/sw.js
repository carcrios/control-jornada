// Service worker: deja la aplicación instalable y usable sin señal desde la primera visita.
// La API (Apps Script) nunca se guarda en caché: las marcaciones sin señal las maneja la bandeja de salida de la app.
const VERSION = 'jornada-v1.7.0';
const BASE = ['./', './config.js', './manifest.webmanifest', './icono-192.png'];
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION); await c.addAll(BASE);
    // Guarda también los archivos de la aplicación que nombra la página (llevan huella en el nombre).
    try { const html = await (await fetch('./', { cache: 'no-store' })).text(); const urls = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]); await c.addAll(urls); } catch (x) { /* se guardarán al usarse */ }
  })());
});
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
async function precargar() { // vuelve a intentarlo al activar si en la instalación faltó señal
  const c = await caches.open(VERSION);
  try { const html = await (await fetch('./', { cache: 'no-store' })).text(); const urls = [...html.matchAll(/(?:src|href)="((?:\.\/|\/)?assets\/[^"]+)"/g)].map((m) => m[1]); for (const u of urls) if (!(await c.match(u))) await c.add(u); } catch (x) { /* se guardarán al usarse */ }
}
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()).then(precargar)); });
const conLimite = (req, ms) => new Promise((ok, mal) => { const t = setTimeout(() => mal(new Error('lento')), ms); fetch(req).then((r) => { clearTimeout(t); ok(r); }, (x) => { clearTimeout(t); mal(x); }); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  const esPagina = r.mode === 'navigate' || u.pathname.endsWith('/config.js');
  if (esPagina) { // red primero con límite de 3,5 s: con señal débil abre la copia guardada en vez de quedarse en blanco
    e.respondWith(conLimite(r, 3500).then((res) => { if (res.ok) { const c = res.clone(); caches.open(VERSION).then((k) => k.put(r, c)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match('./'))));
  } else { // archivos con huella en el nombre: caché primero
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(VERSION).then((k) => k.put(r, c)); } return res; })));
  }
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
