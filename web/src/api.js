// Cliente de la API (Apps Script). Conexión por empresa, sesión persistente, bandeja de salida sin señal y reporte de errores.
export const VERSION = '1.8.0';
const CFG = window.CONFIG || {};
const FIJA = CFG.API_URL || '';                                   // una sola empresa: dirección escrita en config.js
const BASE = CFG.BASE_API || 'https://script.google.com/macros/s/'; // varias empresas: cada una entra con su enlace
const K = { token: 'cj.token', yo: 'cj.yo', salida: 'cj.salida', publico: 'cj.publico', api: 'cj.api', rech: 'cj.rechazadas', desfase: 'cj.desfase', disp: 'cj.dispositivo' };

export const guardado = {
  leer(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  poner(k, v) { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; /* almacenamiento lleno o bloqueado */ } }
};
export const sesion = {
  get token() { return guardado.leer(K.token, null); },
  set token(t) { guardado.poner(K.token, t); },
  get yo() { return guardado.leer(K.yo, null); },
  set yo(v) { guardado.poner(K.yo, v); },
  get publico() { return guardado.leer(K.publico, null); },
  set publico(v) { guardado.poner(K.publico, v); },
  // Al caducar la sesión NO se borran las marcaciones pendientes: se envían tras ingresar de nuevo.
  cerrar(todo) { [K.token, K.yo].concat(todo ? [K.salida, K.rech] : []).forEach((k) => guardado.poner(k, null)); if (todo) { try { bandeja.lista().forEach((m) => bandeja.quitar(m.id)); } catch { /* sin bandeja */ } } }
};

/* ---------- Conexión con la empresa ---------- */
const RE_ID = /^[A-Za-z0-9_-]{20,200}$/;
export const urlDeId = (id) => BASE + id + '/exec';
export function idDeTexto(t) { // acepta el código, el enlace de la aplicación o la dirección /exec
  t = String(t || '').trim(); const m = /\/s\/([A-Za-z0-9_-]{20,200})\//.exec(t) || /#\/c\/([A-Za-z0-9_-]{20,200})/.exec(t), id = m ? m[1] : t;
  return RE_ID.test(id) ? id : '';
}
export const conexion = {
  fija: !!FIJA,
  get id() { return FIJA ? '' : guardado.leer(K.api, ''); },
  get url() { return FIJA || (conexion.id ? urlDeId(conexion.id) : ''); },
  poner(id) { sesion.cerrar(true); guardado.poner(K.publico, null); guardado.poner(K.api, id); },
  enlace() { return location.origin + location.pathname + (conexion.id ? '#/c/' + conexion.id : ''); }
};
export const configurada = () => !!conexion.url;

// Traduce los errores técnicos de Google (cuotas, tiempos, servicios) a lenguaje claro
function claro(cod, m) {
  const t = String(m || '');
  if (/too many times|quota|cuota|Service invoked|Límite/i.test(t)) return 'Google está limitando las consultas de la empresa en este momento. Espera unos minutos e intenta de nuevo; si sigue, avisa al administrador.';
  if (/timed out|exceeded maximum execution|tiempo de ejecución/i.test(t)) return 'La operación tardó más de lo que Google permite. Intenta con un rango de fechas más corto.';
  if (/Lock|lock timeout|bloqueo/i.test(t) && cod !== 'OCUPADO') return 'Hay mucha gente marcando al mismo tiempo. Intenta de nuevo en unos segundos.';
  if (/^(Exception|TypeError|ReferenceError|Error):|undefined|null is not/i.test(t)) return 'Algo falló en el servidor de la empresa. Ya quedó registrado para revisarlo; intenta de nuevo en un momento.';
  return t;
}
export class ErrorApi extends Error { constructor(cod, msg) { super(msg); this.cod = cod; } }
const equipo = () => (navigator.userAgent || '').slice(0, 110);
let alCaducar = () => {};
export const alCaducarSesion = (f) => { alCaducar = f; };

export async function api(a, d = {}, { espera = 45000, url, reintentos = 3 } = {}) {
  const destino = url || conexion.url;
  if (!destino) throw new ErrorApi('CONFIG', 'Esta aplicación aún no está conectada con una empresa.');
  if (!navigator.onLine) throw new ErrorApi('RED', 'No hay señal en este momento. Intenta de nuevo cuando vuelva.');
  for (let intento = 0; intento <= reintentos; intento++) {
    const ctl = new AbortController(), reloj = setTimeout(() => ctl.abort(), espera);
    let res;
    try {
      // text/plain evita la verificación previa (CORS) que Apps Script no responde.
      res = await fetch(destino, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ a, d, t: url ? null : sesion.token, v: VERSION }), redirect: 'follow', signal: ctl.signal });
    } catch (e) { throw new ErrorApi('RED', ctl.signal.aborted ? 'El servidor de la empresa está demorado. Espera un momento e intenta de nuevo.' : 'No pudimos conectar con la empresa. Revisa tu señal e intenta de nuevo.'); }
    finally { clearTimeout(reloj); }
    let j; try { j = await res.clone().json(); } catch { const tx = await res.text().catch(() => ''); throw new ErrorApi('RED', /accounts\.google|ServiceLogin|Iniciar sesión|Sign in/i.test(tx) ? 'Google pidió iniciar sesión: la implementación no está en «Cualquier persona».' : /Error|Excepción|Exception/i.test(tx) ? 'El servidor tuvo un error al responder (revisa que la implementación sea la última versión).' : 'El servidor respondió algo inesperado. Intenta de nuevo.'); }
    if (!j.ok) {
      if (j.e === 'OCUPADO' && intento < reintentos) {
        const pausa = Math.round((600 * Math.pow(2, intento)) + Math.random() * 400);
        await new Promise((r) => setTimeout(r, pausa));
        continue;
      }
      if (j.e === 'SESION' && sesion.token && !url) { sesion.cerrar(false); alCaducar(); }
      throw new ErrorApi(j.e, claro(j.e, j.m));
    }
    return j.d;
  }
}
export const reintentable = (e) => e && (e.cod === 'RED' || e.cod === 'OCUPADO');
function dispositivoId() {
  let id = guardado.leer(K.disp, '');
  if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2)); guardado.poner(K.disp, id); }
  return id;
}
export const info = () => ({ equipo: equipo(), dispositivoId: dispositivoId() });

/* ---------- Reloj: corrige la hora del celular con la del servidor para las marcaciones sin señal ---------- */
const naive = (iso) => { const p = /(\d+)-(\d+)-(\d+)T(\d+):(\d+)/.exec(iso); return p ? Date.UTC(+p[1], +p[2] - 1, +p[3], +p[4], +p[5]) : NaN; };
export const reloj = {
  poner(isoServidor) { const n = new Date(), local = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes()), d = naive(isoServidor) - local; if (!isNaN(d)) guardado.poner(K.desfase, Math.abs(d) > 90000 ? d : 0); },
  ahora() { return new Date(Date.now() + (guardado.leer(K.desfase, 0) || 0)); }
};

/* ---------- Bandeja de salida: marcaciones hechas sin señal ----------
   Copia doble: IndexedDB con la foto y localStorage sin la foto. Si una falla, la otra conserva la marcación,
   y la lista está disponible de inmediato al abrir la aplicación (no espera a IndexedDB). */
let enviando = null;
const sinFoto = (l) => l.map(({ foto, ...r }) => (foto ? { ...r, conFoto: true } : r)); // la copia liviana recuerda que hay foto en IndexedDB
let colaMem = guardado.leer(K.salida, []) || [];
const espejo = () => guardado.poner(K.salida, sinFoto(colaMem));
const idb = (() => {
  if (typeof indexedDB === 'undefined') return null;
  let dbp = null;
  const abrir = () => dbp || (dbp = new Promise((ok, mal) => {
    const r = indexedDB.open('cj_offline', 2);
    r.onupgradeneeded = () => { ['salida', 'rech'].forEach((n) => { if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: 'id' }); }); };
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); ok(r.result); };
    r.onerror = () => mal(r.error); r.onblocked = () => mal(new Error('IndexedDB bloqueado'));
    setTimeout(() => mal(new Error('IndexedDB no responde')), 4000);
  }).catch((e) => { dbp = null; throw e; }));
  const tx = (store, modo, fn) => abrir().then((db) => new Promise((ok, mal) => {
    const t = db.transaction(store, modo), s = t.objectStore(store), req = fn(s);
    t.oncomplete = () => ok(req && req.result !== undefined ? req.result : true);
    t.onerror = () => mal(t.error); t.onabort = () => mal(t.error);
  }));
  return {
    todo: (st = 'salida') => tx(st, 'readonly', (s) => s.getAll()),
    leer: (id, st = 'salida') => tx(st, 'readonly', (s) => s.get(id)),
    poner: (m, st = 'salida') => tx(st, 'readwrite', (s) => s.put(m)),
    borrar: (id, st = 'salida') => tx(st, 'readwrite', (s) => s.delete(id))
  };
})();
// Une lo de IndexedDB (con fotos) con la copia de localStorage
const borradas = () => new Set(guardado.leer('cj.borradas', []) || []);
(() => { // versiones anteriores no guardaban la cédula: eran de quien tenía la sesión abierta en este equipo
  const ced = guardado.leer(K.yo, null)?.usuario?.cedula; if (!ced) return;
  if (colaMem.some((m) => !m.cedula)) { colaMem = colaMem.map((m) => (m.cedula ? m : { ...m, cedula: ced })); guardado.poner(K.salida, colaMem); }
  const rr = guardado.leer(K.rech, []) || []; if (rr.some((m) => !m.cedula)) guardado.poner(K.rech, rr.map((m) => (m.cedula ? m : { ...m, cedula: ced })));
})();
const cargada = idb ? Promise.race([idb.todo(), new Promise((ok) => setTimeout(() => ok(null), 3000))]).then((rows) => {
  const b = borradas(); rows = (rows || []).filter((x) => !b.has(x.id)); // lo que ya se envió no reaparece aunque IndexedDB no lo haya borrado
  const porId = new Map((rows || []).map((x) => [x.id, x]));
  const ced0 = guardado.leer(K.yo, null)?.usuario?.cedula;
  colaMem = colaMem.map((x) => { const r = porId.get(x.id); return r ? { ...r, cedula: r.cedula || x.cedula } : x; }).concat((rows || []).filter((x) => !colaMem.some((y) => y.id === x.id)).map((x) => (x.cedula || !ced0 ? x : { ...x, cedula: ced0 })));
  espejo();
}).catch(() => null) : Promise.resolve();
const dueno = () => sesion.yo?.usuario?.cedula || '';
export const bandeja = {
  cargada,
  lista: () => colaMem.slice(),
  // Solo las de la persona que tiene la sesión. Las que no tienen dueño (versiones anteriores) no se atribuyen a nadie solas.
  mias: (ced = dueno()) => colaMem.filter((m) => ced && m.cedula === ced),
  ajenas: (ced = dueno()) => colaMem.filter((m) => !ced || m.cedula !== ced),
  rechazadas: (ced = dueno()) => (guardado.leer(K.rech, []) || []).filter((m) => ced && m.cedula === ced),
  // Devuelve true si quedó guardada en al menos un almacenamiento permanente
  async agregar(m) {
    colaMem = colaMem.filter((x) => x.id !== m.id).concat(m);
    const ls = espejo(); // primero la copia rápida: si el celular se cierra ya, la marcación no se pierde
    let db = false;
    if (idb) { try { await Promise.race([idb.poner(m), new Promise((_, no) => setTimeout(() => no(new Error('lento')), 3000))]); db = true; } catch { db = false; } }
    if (!db && m.foto) { const { foto, ...sin } = m; colaMem = colaMem.map((x) => (x.id === m.id ? sin : x)); return espejo() || ls; } // sin IndexedDB la copia no promete una foto que no existe
    return ls || db;
  },
  quitar(id) {
    colaMem = colaMem.filter((m) => m.id !== id); espejo();
    if (idb) { const b = [...borradas(), id].slice(-200); guardado.poner('cj.borradas', b); idb.borrar(id).catch(() => {}); }
  },
  descartarRechazada(id) { guardado.poner(K.rech, (guardado.leer(K.rech, []) || []).filter((m) => m.id !== id)); if (idb) idb.borrar(id, 'rech').catch(() => {}); },
  // Vuelve a intentar una rechazada con su foto original (por ejemplo, agregando el código QR)
  async reintentar(id, extra = {}) {
    const r = bandeja.rechazadas().find((m) => m.id === id); if (!r) return null; // solo las propias
    let foto = null; if (idb) { try { foto = (await idb.leer(id, 'rech'))?.foto || null; } catch { /* sin foto */ } }
    const { rechazo, codRechazo, ...m } = r;
    return { ...m, ...(foto ? { foto } : {}), ...extra };
  },
  enviar() {
    if (enviando) return enviando; // un solo envío a la vez
    enviando = (async () => {
      await cargada;
      let enviadas = 0; const rechazadas = [];
      // En orden y deteniéndose en el primer fallo de red: si la entrada no sale, la salida no se manda (evita rechazos por orden)
      const yoCed = dueno(); // solo se envían las del usuario que tiene la sesión: nunca quedan a nombre de otro
      for (const m0 of bandeja.mias(yoCed).sort((a, b) => (a.hora < b.hora ? -1 : 1))) {
        let m = m0;
        if (!m.foto && m.conFoto && idb) { // la foto vive en IndexedDB: si no se puede leer ahora, se espera en vez de enviarla sin foto
          try { const x = await Promise.race([idb.leer(m.id), new Promise((_, no) => setTimeout(() => no(new Error('lento')), 3000))]); if (x?.foto) m = { ...m, foto: x.foto }; /* no existe: se envía sin foto y, si el servidor la exige, pasa a rechazadas con su salida */ } catch { break; }
        }
        try { const { conFoto, ...envio } = m; await api('marcar', { ...envio, offline: !m.manual }); enviadas++; bandeja.quitar(m.id); }
        catch (e) {
          if (e.cod === 'SESION' || e.cod === 'CONFIG' || e.cod === 'AJENA' || reintentable(e)) break; // se conservan para después
          bandeja.quitar(m.id); const { foto, ...resto } = m; rechazadas.push({ ...resto, rechazo: e.message, codRechazo: e.cod });
          if (idb && foto) idb.poner({ id: m.id, foto }, 'rech').catch(() => {}); // la foto se guarda para poder reintentar
        }
      }
      if (rechazadas.length) guardado.poner(K.rech, (guardado.leer(K.rech, []) || []).concat(rechazadas).slice(-50)); // de todas las personas del equipo; sin foto pesan poco
      return { enviadas, pendientes: bandeja.mias(yoCed).length, ajenas: bandeja.ajenas(yoCed).length, rechazadas };
    })().finally(() => { enviando = null; });
    return enviando;
  }
};

/* ---------- Monitoreo: los errores del navegador llegan a la hoja "Errores" ---------- */
let enviados = 0;
export function reportarError(mensaje, detalle) {
  if (!conexion.url || enviados >= 5 || !navigator.onLine) return; enviados++;
  const yo = sesion.yo;
  fetch(conexion.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, keepalive: true,
    body: JSON.stringify({ a: 'error', d: { mensaje: String(mensaje).slice(0, 400), detalle: String(detalle || '').slice(0, 1500), cedula: yo && yo.usuario ? yo.usuario.cedula : '', equipo: equipo(), version: VERSION } }) }).catch(() => {});
}
export function vigilarErrores() {
  window.addEventListener('error', (e) => reportarError(e.message, (e.filename || '') + ':' + e.lineno + ' ' + ((e.error && e.error.stack) || '')));
  window.addEventListener('unhandledrejection', (e) => { const r = e.reason; if (r instanceof ErrorApi) return; reportarError('Promesa sin atender: ' + (r && r.message ? r.message : r), r && r.stack); });
}
