// Simulador mínimo de los servicios de Google (Sheets, Drive, Mail, Cache…) para correr el backend real en Node.
// Sirve para las pruebas automáticas y para el servidor de desarrollo local (tests/servidor-local.js).
const fs = require('fs'), path = require('path'), crypto = require('crypto');

function crear(opciones = {}) {
  const hojas = {}, props = {}, cache = {}, archivos = {}, correos = [], disparadores = [];
  let nId = 0;
  const hojaObj = (n) => ({
    getName: () => n, getLastRow: () => { let k = hojas[n].length; while (k > 0 && !(hojas[n][k - 1] || []).some((x) => x !== '' && x !== undefined)) k--; return k; }, getMaxRows: () => 1000, setFrozenRows() { }, getProtections: () => [], protect() { const p = { setDescription: () => p, setWarningOnly: () => p }; return p; }, hideSheet() { },
    appendRow(r) { let k = hojas[n].length; while (k > 0 && !(hojas[n][k - 1] || []).some((x) => x !== '' && x !== undefined)) k--; hojas[n].length = k; hojas[n].push(r.map(x => String(x).replace(/^'/, ''))); },
    deleteRow(i) { hojas[n].splice(i - 1, 1); }, deleteRows(i, k) { hojas[n].splice(i - 1, k); },
    getRange(r, c, nr = 1, nc = 1) {
      const api = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (hojas[n][r - 1 + i] || [])[c - 1 + j] ?? '')),
        setValues(v) { v.forEach((fila, i) => { const row = hojas[n][r - 1 + i] || (hojas[n][r - 1 + i] = []); fila.forEach((x, j) => { row[c - 1 + j] = String(x).replace(/^'/, ''); }); }); return api; },
        setNumberFormat: () => api, setFontWeight: () => api, clearContent() { for (let i = 0; i < nr; i++) hojas[n][r - 1 + i] = []; return api; }
      };
      return api;
    }
  });
  const libro = (id) => { const hs = archivos[id].hojas; const ho = (n) => ({ getLastRow: () => hs[n].length, getRange: (r, c, nr = 1, nc = 1) => { const api = { setValues(v) { v.forEach((f, i) => { hs[n][r - 1 + i] = f.map(String); }); return api; }, setFontWeight: () => api }; return api; } });
    return { getId: () => id, getSheetByName: (n) => (hs[n] ? ho(n) : null), insertSheet: (n) => { hs[n] = []; return ho(n); } }; };
  const ss = {
    getId: () => 'SS1', getSheetByName: (n) => hojas[n] ? hojaObj(n) : null, insertSheet(n) { hojas[n] = []; return hojaObj(n); },
    getSheets: () => Object.keys(hojas).map(hojaObj), deleteSheet(h) { delete hojas[h.getName()]; }
  };
  const archivo = (id) => ({
    moveTo(c) { archivos[id].carpeta = c.getId(); }, getName: () => archivos[id].nombre,
    getId: () => id, getBlob: () => ({ getContentType: () => archivos[id].tipo, getBytes: () => archivos[id].bytes }),
    setTrashed() { delete archivos[id]; }, getDateCreated: () => archivos[id].creado, getParents: () => ({ hasNext: () => false }),
    makeCopy(nombre, carpeta) { const k = 'F' + (++nId); archivos[k] = { nombre, carpeta: carpeta.getId(), creado: new Date(Date.now() + nId), bytes: [], tipo: 'sheet' }; return archivo(k); }
  });
  const carpeta = (id) => ({
    getId: () => id,
    createFile(blob) { const k = 'F' + (++nId); archivos[k] = { nombre: blob.nombre, carpeta: id, bytes: blob.bytes, tipo: blob.tipo, creado: new Date() }; return archivo(k); },
    createFolder(n) { const k = 'C' + (++nId); return carpeta(k); },
    getFilesByName(n) { const l = Object.keys(archivos).filter(k => archivos[k].carpeta === id && archivos[k].nombre === n); let i = 0; return { hasNext: () => i < l.length, next: () => archivo(l[i++]) }; },
    getFiles() { const l = Object.keys(archivos).filter(k => archivos[k].carpeta === id); let i = 0; return { hasNext: () => i < l.length, next: () => archivo(l[i++]) }; }
  });
  const G = {
    SpreadsheetApp: { ProtectionType: { SHEET: 1 }, getActiveSpreadsheet: () => ss, openById: (id) => (id === 'SS1' ? ss : libro(id)),
      create: (n) => { const k = 'F' + (++nId); archivos[k] = { nombre: n, carpeta: 'RAIZ', creado: new Date(), bytes: [], tipo: 'sheet', hojas: {} }; return libro(k); }, getUi: () => { throw new Error('sin interfaz'); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; }, deleteAllProperties: () => { Object.keys(props).forEach((k) => delete props[k]); } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() { } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
      computeDigest: (a, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()].map(b => b > 127 ? b - 256 : b),
      computeHmacSha256Signature: (s, k) => [...crypto.createHmac('sha256', k).update(s, 'utf8').digest()].map(b => b > 127 ? b - 256 : b),
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, z) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; },
      base64Decode: s => [...Buffer.from(s, 'base64')], base64DecodeWebSafe: s => [...Buffer.from(s, 'base64url')], base64EncodeWebSafe: (t) => Buffer.from(String(t), 'utf8').toString('base64url'), base64Encode: b => Buffer.from(b).toString('base64'),
      newBlob: (bytes, tipo, nombre) => ({ bytes, tipo, nombre, getDataAsString: () => Buffer.from(bytes.map((b) => (b + 256) % 256)).toString('utf8') })
    },
    DriveApp: { getFolderById: carpeta, getFileById: (id) => { if (id !== 'SS1' && !archivos[id]) throw new Error('no existe'); return archivo(id); }, getRootFolder: () => carpeta('RAIZ') },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: (m) => { correos.push(m); } },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/AKfycbTESTtestTESTtestTEST12345/exec' }), getOAuthToken: () => 'TOKEN', getScriptId: () => 'SCRIPT1',
      getProjectTriggers: () => disparadores.map(f => ({ getHandlerFunction: () => f })), deleteTrigger() { disparadores.length = 0; },
      newTrigger: (f) => { const c = { timeBased: () => c, everyMinutes: () => c, atHour: () => c, everyDays: () => c, create: () => { disparadores.push(f); } }; return c; }
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ texto: t, setMimeType() { return this; } }) },
    HtmlService: { createHtmlOutput: (h) => ({ html: h, setTitle() { return this; } }) },
    UrlFetchApp: { fetch(u, o) { if (opciones.fetch) return opciones.fetch(u, o, { correos }); correos.push({ to: 'telegram', subject: 'telegram', body: JSON.parse(o.payload).text }); return {}; } },
    PROVEEDOR: opciones.proveedor,
    Logger: { log() { } }
  };
  archivos.SS1 = { nombre: 'principal', carpeta: 'RAIZ', creado: new Date(), bytes: [], tipo: 'sheet' };
  const dir = path.join(__dirname, '../apps-script');
  let codigo = ['Motor.gs', 'Base.gs', 'Servicios.gs', 'Turnos.gs', 'Informes.gs', 'Modulos.gs', 'Tareas.gs', 'Actualizar.gs'].map(f => fs.readFileSync(path.join(dir, f), 'utf8').replace("if (typeof module !== 'undefined') module.exports = Motor;", '')).join('\n');
  (opciones.reemplazar || []).forEach(([a, b]) => { if (!codigo.includes(a)) throw new Error('reemplazo no encontrado: ' + a); codigo = codigo.replace(a, b); });
  const nombres = Object.keys(G);
  const S = new Function(...nombres, codigo + `
    ;return { agregar, prop_, buscar, guardar, vueltas_, actualizar_, reportarAlPanel_, compararVersion_, armarProveedor_, ponerAlDiaTrasActualizar_, marcDesde_, tareaDiaria, doPost, doGet, archivarHistorico_, instalar, tareaCada5, tareaCada15, tareaDiaria, limpiarDatos_, respaldar_, prop_, leer, cfgSet_, Motor,
      ahora: function (x) { _AHORA = x; }, limpiar: function () { _c = {}; _cfg = null; } };`)(...nombres.map(n => G[n]));
  const api = (a, d, t) => JSON.parse(S.doPost({ postData: { contents: JSON.stringify({ a, d, t }) } }).texto);
  return { S, api, hojas, props, cache, archivos, correos };
}
module.exports = { crear };
