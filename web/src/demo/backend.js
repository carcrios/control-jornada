// Backend real (los mismos archivos de Apps Script) corriendo dentro del navegador sobre servicios de Google simulados.
import motor from '../../../apps-script/Motor.gs?raw';
import base from '../../../apps-script/Base.gs?raw';
import servicios from '../../../apps-script/Servicios.gs?raw';
import turnos from '../../../apps-script/Turnos.gs?raw';
import informes from '../../../apps-script/Informes.gs?raw';
import modulos from '../../../apps-script/Modulos.gs?raw';
import tareas from '../../../apps-script/Tareas.gs?raw';
import actualizar from '../../../apps-script/Actualizar.gs?raw';
import { sha256, hmac, firmados, utf8 } from './sha.js';

export function crearBackend(previo) {
  const hojas = previo?.hojas || {}, props = previo?.props || {}, correos = previo?.correos || [], disparadores = previo?.disparadores || [], cache = {}, archivos = {};
  let nId = previo?.nId || 0;
  const hojaObj = (n) => ({
    getName: () => n, getLastRow: () => hojas[n].length, getMaxRows: () => 1000, setFrozenRows() { }, getProtections: () => [], protect() { const p = { setDescription: () => p, setWarningOnly: () => p }; return p; }, hideSheet() { },
    appendRow(r) { hojas[n].push(r.map((x) => String(x).replace(/^'/, ''))); },
    deleteRow(i) { hojas[n].splice(i - 1, 1); }, deleteRows(i, k) { hojas[n].splice(i - 1, k); },
    getRange(r, c, nr = 1, nc = 1) {
      const api = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (hojas[n][r - 1 + i] || [])[c - 1 + j] ?? '')),
        setValues(v) { v.forEach((fila, i) => { const row = hojas[n][r - 1 + i] || (hojas[n][r - 1 + i] = []); fila.forEach((x, j) => { row[c - 1 + j] = String(x).replace(/^'/, ''); }); }); return api; },
        setNumberFormat: () => api, setFontWeight: () => api
      };
      return api;
    }
  });
  const ss = { getId: () => 'SS1', getSheetByName: (n) => (hojas[n] ? hojaObj(n) : null), insertSheet(n) { hojas[n] = []; return hojaObj(n); }, getSheets: () => Object.keys(hojas).map(hojaObj), deleteSheet(h) { delete hojas[h.getName()]; } };
  const archivo = (id) => ({
    getId: () => id, getBlob: () => ({ getContentType: () => archivos[id].tipo, getBytes: () => archivos[id].bytes }),
    setTrashed() { delete archivos[id]; }, getDateCreated: () => archivos[id]?.creado || new Date(), getParents: () => ({ hasNext: () => false }),
    makeCopy(nombre, carpeta) { const k = 'F' + (++nId); archivos[k] = { nombre, carpeta: carpeta.getId(), creado: new Date(Date.now() + nId), bytes: [], tipo: 'sheet' }; return archivo(k); }
  });
  const carpeta = (id) => ({
    getId: () => id,
    createFile(blob) { const k = 'F' + (++nId); archivos[k] = { nombre: blob.nombre, carpeta: id, bytes: blob.bytes, tipo: blob.tipo, creado: new Date() }; return archivo(k); },
    createFolder() { return carpeta('C' + (++nId)); },
    getFiles() { const l = Object.keys(archivos).filter((k) => archivos[k].carpeta === id); let i = 0; return { hasNext: () => i < l.length, next: () => archivo(l[i++]) }; }
  });
  const b64 = { dec: (s) => Array.from(atob(s), (c) => c.charCodeAt(0)), enc: (b) => { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode((b[i] + 256) % 256); return btoa(s); } };
  const G = {
    SpreadsheetApp: { ProtectionType: { SHEET: 1 }, getActiveSpreadsheet: () => ss, openById: () => ss, getUi: () => { throw new Error('sin interfaz'); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: (k) => { delete props[k]; }, deleteAllProperties: () => { Object.keys(props).forEach((k) => delete props[k]); } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() { } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
      computeDigest: (a, s) => firmados(sha256(utf8(s))),
      computeHmacSha256Signature: (s, k) => firmados(hmac(s, k)),
      getUuid: () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () => ((Math.random() * 16) | 0).toString(16))),
      formatDate: (d, z) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; },
      base64Decode: b64.dec, base64Encode: b64.enc, base64DecodeWebSafe: (t) => b64.dec(String(t).replace(/-/g, '+').replace(/_/g, '/')), newBlob: (bytes, tipo, nombre) => ({ bytes, tipo, nombre, getDataAsString: () => new TextDecoder().decode(new Uint8Array(bytes.map((b) => (b + 256) % 256))) })
    },
    DriveApp: { getFolderById: carpeta, getFileById: (id) => { if (id !== 'SS1' && !archivos[id]) throw new Error('no existe'); return archivo(id); }, getRootFolder: () => carpeta('RAIZ') },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: (m) => { correos.unshift({ ...m, fecha: new Date().toISOString() }); correos.length = Math.min(correos.length, 80); } },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/AKfycbDEMOdemoDEMOdemo1234567/exec' }),
      getProjectTriggers: () => disparadores.map((f) => ({ getHandlerFunction: () => f })), deleteTrigger() { disparadores.length = 0; },
      newTrigger: (f) => { const c = { timeBased: () => c, everyMinutes: () => c, atHour: () => c, everyDays: () => c, create: () => { disparadores.push(f); } }; return c; }
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ texto: t, setMimeType() { return this; } }) },
    HtmlService: { createHtmlOutput: (h) => ({ html: h, setTitle() { return this; } }) },
    UrlFetchApp: { fetch() { return {}; } },
    Logger: { log() { } }
  };
  archivos.SS1 = { nombre: 'principal', carpeta: 'RAIZ', creado: new Date(), bytes: [], tipo: 'sheet' };
  const codigo = [motor.replace("if (typeof module !== 'undefined') module.exports = Motor;", ''), base, servicios, turnos, informes, modulos, tareas, actualizar].join('\n');
  const nombres = Object.keys(G);
  // eslint-disable-next-line no-new-func
  const S = new Function(...nombres, codigo + `
    ;return { doPost, instalar, tareaCada5, tareaCada15, tareaDiaria, prop_, leer, Motor,
      enlaceFirma: function (p, j) { return enlaceFirma_(p, j); }, ahora: function (x) { _AHORA = x; }, limpiar: function () { _c = {}; _cfg = null; } };`)(...nombres.map((n) => G[n]));
  const api = (a, d, t) => JSON.parse(S.doPost({ postData: { contents: JSON.stringify({ a, d, t }) } }).texto);
  return { S, api, hojas, props, correos, estado: () => ({ hojas, props, correos, disparadores, nId }) };
}
