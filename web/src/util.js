// Formato, ubicación, cámara, compresión de imágenes y recordatorios.
const p2 = (n) => String(n).padStart(2, '0');
export const hoyISO = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const ahoraISO = (d = new Date()) => `${hoyISO(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return hoyISO(d); };
export const pesos = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-CO');
export const horas = (min) => { const m = Math.max(0, Math.round(min || 0)); return `${Math.floor(m / 60)} h ${p2(m % 60)} min`; };
export const horasDec = (h) => (Math.round((h || 0) * 10) / 10).toLocaleString('es-CO') + ' h';
const may = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const fechaLarga = (iso) => may(new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }));
export const fechaCorta = (iso) => iso ? may(new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })) : '';
// Para documentos que se imprimen o firman: siempre con año ("10 de marzo de 2025")
export const fechaDoc = (iso) => iso ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
export const saludo = (d = new Date()) => { const h = d.getHours(); return h >= 5 && h < 12 ? 'Buenos días' : h >= 12 && h < 19 ? 'Buenas tardes' : 'Buenas noches'; };
export const fechaHora = (iso) => iso ? `${fechaCorta(iso)}, ${iso.slice(11, 16)}` : '';
export const aMin = (hhmm) => { if (!hhmm) return null; const [h, m] = hhmm.split(':'); return +h * 60 + +m; };
export const TIPOS = ['entrada', 'sal_alm', 'ent_alm', 'salida'];
export const NOMBRE_TIPO = { entrada: 'Entrada', sal_alm: 'Salida a almuerzo', ent_alm: 'Regreso de almuerzo', salida: 'Salida' };
export const CORTO_TIPO = { entrada: 'Entrada', sal_alm: 'Almuerzo', ent_alm: 'Regreso', salida: 'Salida' };
export const idNuevo = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()).replace(/-/g, '').slice(0, 24);

/* ---------- Ubicación: obligatoria para marcar ---------- */
export class ErrorPermiso extends Error { constructor(que, msg, bloqueado) { super(msg); this.que = que; this.bloqueado = bloqueado; } }
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
export const comoPermitir = (que) => /iphone|ipad/i.test(navigator.userAgent) ? `En el iPhone: Ajustes → Privacidad → ${que === 'Cámara' ? 'Cámara' : 'Localización'} → Safari → Permitir.`
  : instalada() ? `Mantén presionado el ícono de la aplicación → Información → Permisos → ${que} → Permitir.` : `Toca el candado junto a la dirección de la página → Permisos → ${que} → Permitir.`;
function pedirPosicion(precisa, ms, edad) { return new Promise((ok, mal) => navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, prec: Math.round(p.coords.accuracy) }), mal, { enableHighAccuracy: precisa, timeout: ms, maximumAge: edad ?? (precisa ? 0 : 60000) })); }
export async function ubicar() {
  if (!navigator.geolocation) throw new ErrorPermiso('gps', 'Este dispositivo no permite obtener la ubicación.', true);
  try { return await pedirPosicion(true, 15000); }
  catch (e) {
    if (e.code === 1) throw new ErrorPermiso('gps', 'La ubicación está bloqueada y sin ella no se puede marcar. ' + comoPermitir('Ubicación'), true);
    try { return await pedirPosicion(false, 10000); } // bajo techo el GPS preciso falla: segundo intento con la red
    catch (x) { if (x.code === 1) throw new ErrorPermiso('gps', 'La ubicación está bloqueada y sin ella no se puede marcar. ' + comoPermitir('Ubicación'), true); }
    // GPS en frío (celular recién encendido o sin datos): espera más y acepta una ubicación de hasta 5 minutos
    try { return await pedirPosicion(false, 30000, 300000); }
    catch (x) { throw new ErrorPermiso('gps', 'No se pudo obtener tu ubicación. Activa el GPS del celular, acércate a una ventana o sal a un lugar despejado e intenta de nuevo.', false); }
  }
}
export function distancia(a, b, c, d) {
  const R = 6371000, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, q = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q)));
}

/* ---------- Compresión de imágenes en el celular (antes de enviar) ---------- */
export function comprimir(fuente, maxLado = 640, calidad = 0.6) {
  const w = fuente.videoWidth || fuente.naturalWidth || fuente.width, h = fuente.videoHeight || fuente.naturalHeight || fuente.height;
  const esc = Math.min(1, maxLado / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.round(w * esc); c.height = Math.round(h * esc);
  c.getContext('2d').drawImage(fuente, 0, 0, c.width, c.height);
  let q = calidad, url = c.toDataURL('image/jpeg', q);
  while (url.length > 180000 && q > 0.3) { q -= 0.1; url = c.toDataURL('image/jpeg', q); } // tope ≈ 130 kB
  return url;
}
export function comprimirArchivo(archivo, maxLado = 1100, calidad = 0.6) {
  return new Promise((ok, mal) => {
    const img = new Image(), u = URL.createObjectURL(archivo);
    img.onload = () => { URL.revokeObjectURL(u); ok(comprimir(img, maxLado, calidad)); };
    img.onerror = () => { URL.revokeObjectURL(u); mal(new Error('No se pudo leer la imagen.')); };
    img.src = u;
  });
}

/* ---------- Recordatorios locales (5 min antes de entrar, 5 min después de salir, igual en almuerzo) ---------- */
let relojes = [];
export const notificacionesActivas = () => 'Notification' in window && Notification.permission === 'granted';
export async function pedirNotificaciones() { if (!('Notification' in window)) return 'no-disponible'; return Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission; }
async function notificar(titulo, cuerpo) {
  try { const reg = await navigator.serviceWorker?.getRegistration(); const o = { body: cuerpo, icon: './icono-192.png', badge: './icono-192.png', tag: 'jornada', renotify: true, vibrate: [200, 100, 200] };
    if (reg) await reg.showNotification(titulo, o); else new Notification(titulo, o); } catch { /* sin permiso */ }
}
export function programarRecordatorios(hoy, minutos = 5) {
  relojes.forEach(clearTimeout); relojes = [];
  if (!hoy || !hoy.horario || !notificacionesActivas() || hoy.fecha !== hoyISO()) return;
  const h = hoy.horario, m = hoy.marcas || {}, ahora = new Date(), minAhora = ahora.getHours() * 60 + ahora.getMinutes() + ahora.getSeconds() / 60;
  [['entrada', aMin(h.e) - minutos, 'Tu jornada empieza en ' + minutos + ' minutos. Marca tu entrada al llegar.'],
   ['sal_alm', aMin(h.ai) === null ? null : aMin(h.ai) + minutos, 'Recuerda marcar tu salida a almuerzo.'],
   ['ent_alm', aMin(h.af) === null ? null : aMin(h.af) - minutos, 'El almuerzo termina en ' + minutos + ' minutos. Marca tu regreso.'],
   ['salida', aMin(h.s) + minutos, 'Tu jornada terminó. No olvides marcar la salida.']
  ].forEach(([tipo, t, texto]) => {
    if (t === null || m[tipo] || t <= minAhora || (tipo !== 'entrada' && m.salida)) return;
    relojes.push(setTimeout(() => notificar(NOMBRE_TIPO[tipo], texto), (t - minAhora) * 60000));
  });
}

// El color de la empresa se usa en la tarjeta del reloj, la cabecera y los botones con letra blanca encima.
// Si es claro (gris, verde pastel, amarillo…) se oscurece en el mismo tono hasta que el blanco se lea bien (contraste 7:1).
export function colorLegible(hex) {
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const contraste = () => 1.05 / (0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) + 0.05);
  for (let i = 0; i < 40 && contraste() < 7; i++) [r, g, b] = [r, g, b].map((x) => Math.round(x * 0.92));
  return [r, g, b];
}
