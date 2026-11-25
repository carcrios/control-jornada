/**
 * PANEL DE PROVEEDOR — Control de jornada (versión 2)
 *
 * Una hoja de Google tuya donde ves y manejas a todas las empresas:
 *  - Cada empresa aparece sola la primera noche después de instalar (o al tocar «Buscar mi licencia ahora»).
 *  - Marcas con casillas los módulos de cada una, el plan, el número de personas y la fecha de vencimiento.
 *  - La licencia le llega sola a cada empresa cada noche: renovar o cambiar módulos es editar su fila.
 *  - Ves la versión que tiene cada una, cuándo se reportó por última vez y cuántas personas usa.
 *
 * Instalación (una sola vez): crea una hoja nueva → Extensiones → Apps Script → pega este archivo → guarda →
 * vuelve a la hoja y recárgala → menú «Panel de proveedor → 0. Configurar» y sigue los pasos que muestra.
 */
var MODULOS = [
  ['asistencia', 'Asistencia'], ['nomina', 'Nómina'], ['permisos', 'Permisos'], ['turnos', 'Turnos'], ['prestamos', 'Préstamos'],
  ['autoservicio', 'Autoservicio'], ['kiosco', 'Kiosco'], ['qr', 'QR de obra'], ['presupuesto', 'Presupuesto'], ['tablero360', 'En vivo y 360°'], ['seguridadPro', 'Seguridad Pro']
];
var PLANES = {
  basico: { max: 25, modulos: ['asistencia'] },
  profesional: { max: 80, modulos: ['asistencia', 'nomina', 'permisos', 'turnos', 'prestamos', 'autoservicio'] },
  empresa: { max: 150, modulos: MODULOS.map(function (m) { return m[0]; }) }
};
var COLS = ['Empresa', 'NIT', 'Contacto', 'WhatsApp', 'Correo', 'Plan', 'Personas máx.', 'Vence (AAAA-MM-DD)']
  .concat(MODULOS.map(function (m) { return m[1]; }))
  .concat(['Suspendida', 'Estado', 'Versión', 'Último reporte', 'Personas activas', 'Conectada', 'Llave de licencia', 'Notas']);
var C = {}; COLS.forEach(function (n, i) { C[n] = i; });
var M0 = C['Asistencia'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Panel de proveedor')
    .addItem('0. Configurar', 'configurar')
    .addItem('Contraseña de la consola web…', 'claveConsola')
    .addItem('Abrir la consola web', 'abrirConsola')
    .addItem('1. Preparar la hoja de clientes', 'prepararHoja')
    .addItem('2. Calcular estados y llaves', 'calcularTodo')
    .addItem('Renovar la empresa seleccionada…', 'renovarSeleccionada')
    .addItem('Aprobar la versión publicada…', 'aprobarVersion')
    .addItem('Desconectar la empresa seleccionada (reinstaló)', 'olvidarRegistro')
    .addSeparator()
    .addItem('Ver vencimientos y empresas sin reportar', 'verResumen')
    .addItem('Avisarme cada mañana por correo', 'activarAvisos')
    .addToUi();
}
function prop_(k, v) { var p = PropertiesService.getScriptProperties(); if (v === undefined) return p.getProperty(k); p.setProperty(k, String(v)); return v; }
function clave_() { var k = prop_('CLAVE'); if (!k) { k = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); prop_('CLAVE', k); } return k; }
function hoy_() { return Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd'); }
function sumarDias_(iso, n) { var p = String(iso).split('-'); return Utilities.formatDate(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)), 'UTC', 'yyyy-MM-dd'); }
// 31 de enero + 1 mes = 28 (o 29) de febrero, no 3 de marzo
function sumarMeses_(iso, m) { var p = String(iso).split('-'), y = +p[0], mo = +p[1] - 1 + m, ult = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(); return Utilities.formatDate(new Date(Date.UTC(y, mo, Math.min(+p[2], ult))), 'UTC', 'yyyy-MM-dd'); }
function fecha_(v) { return v instanceof Date ? Utilities.formatDate(v, 'America/Bogota', 'yyyy-MM-dd') : String(v || '').trim().substr(0, 10); }
function digitos_(v) { return String(v || '').replace(/\D/g, ''); }
function hex_(b) { return b.map(function (x) { return ('0' + ((x + 256) % 256).toString(16)).slice(-2); }).join(''); }
// El panel vive en su hoja; si alguna vez no hay hoja activa (llamada desde la consola web), se abre por su id guardado
function libro_() { var ss = null; try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { }
  if (ss) { try { if (!prop_('LIBRO')) prop_('LIBRO', ss.getId()); } catch (e) { } return ss; }
  return SpreadsheetApp.openById(prop_('LIBRO')); }
function hoja_() { var h = libro_().getSheetByName('Clientes'); if (!h) { prepararHoja_(); h = libro_().getSheetByName('Clientes'); } return h; }

/* ---------- 0. Configurar ---------- */
function configurar() {
  var ui = SpreadsheetApp.getUi(), app = prop_('APP') || '';
  var r = ui.prompt('Dirección de tu página', 'Pega la dirección de GitHub Pages donde publicas la aplicación (ejemplo: https://carcrios.github.io/control-jornada/).', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  app = r.getResponseText().trim(); if (app && !/\/$/.test(app)) app += '/'; prop_('APP', app);
  try { SpreadsheetApp.getActiveSpreadsheet().setSpreadsheetTimeZone('America/Bogota'); } catch (e) { }
  var url = ''; try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { }
  // getUrl() a veces devuelve una implementación vieja: se confirma con la URL que muestra «Administrar implementaciones»
  var r2 = ui.prompt('Dirección del panel', 'Pega la «URL de la aplicación web» del panel (Implementar → Administrar implementaciones → la implementación activa). Si la dejas vacía se usa: ' + (url || '(ninguna)'), ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var pegada = r2.getResponseText().trim();
  if (pegada) { if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(pegada)) { ui.alert('Esa dirección no es una URL de aplicación web (debe empezar por https://script.google.com/macros/s/ y terminar en /exec).'); return; } url = pegada; }
  prop_('URL_PANEL', url); libro_(); hoja_();
  var prov = 'var PROVEEDOR = {\n  app: ' + JSON.stringify(app) + ',\n  clave: ' + JSON.stringify(clave_()) + ',\n  panel: ' + JSON.stringify(url) + '\n};';
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Proveedor.gs') || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Proveedor.gs');
  h.clear(); h.setColumnWidth(1, 900);
  h.getRange(1, 1, 8, 1).setValues([['Copia el bloque de la celda A3 y pégalo en el archivo «Proveedor.gs» de tu PLANTILLA (Apps Script → + → Script → nómbralo Proveedor).'],
    [url ? 'Panel publicado: ' + url : 'FALTA PUBLICAR EL PANEL: Extensiones → Apps Script → Implementar → Nueva implementación → Aplicación web → Ejecutar como: Yo · Acceso: Cualquier persona → Implementar. Después vuelve a usar «0. Configurar».'],
    [prov], [''], ['La clave firma las licencias: no la compartas. Todas las empresas que copien tu plantilla la heredan.'], [''],
    ['Empresas que ya tienes instaladas: pégales este mismo Proveedor.gs una vez (o espera: la actualización automática conserva el que tengan).'], ['']]).setWrap(true);
  h.getRange(3, 1).setFontFamily('Courier New').setBackground('#F3F6F6');
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(h);
  ui.alert(url ? 'Listo. En la pestaña «Proveedor.gs» está el bloque para tu plantilla.' : 'Falta publicar el panel como aplicación web. Mira la pestaña «Proveedor.gs».');
}

/* ---------- 1. Preparar hoja ---------- */
function prepararHoja() { prepararHoja_(); SpreadsheetApp.getUi().alert('Hoja «Clientes» lista.\n\n• Las columnas grises las llena el sistema.\n• Al elegir un plan se marcan solos sus módulos; elige «personalizado» para marcarlos a mano.\n• Las empresas nuevas aparecen solas cuando reportan.\n• Más fácil: maneja todo desde la consola web (menú «Abrir la consola»).'); }
function prepararHoja_() {
  var ss = libro_(), h = ss.getSheetByName('Clientes');
  var viejos = null;
  if (h && h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].join('|') !== COLS.join('|')) {
    viejos = h.getLastRow() > 1 ? h.getRange(1, 1, h.getLastRow(), h.getLastColumn()).getValues() : null;
    h.setName('Clientes (anterior ' + Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HHmm') + ')'); h = null;
  }
  if (!h) h = ss.insertSheet('Clientes', 0);
  if (viejos) { // se pasan las columnas que se llaman igual (o parecido) a la hoja nueva
    var cab = viejos[0].map(function (x) { return String(x).toLowerCase(); }), mapa = { 'plan (basico/profesional/empresa)': 'Plan', 'maxusuarios': 'Personas máx.', 'vence (aaaa-mm-dd)': 'Vence (AAAA-MM-DD)', 'llave de licencia': 'Llave de licencia' };
    var filas = viejos.slice(1).filter(function (r) { return r[0] || r[1]; }).map(function (r) { var n = COLS.map(function () { return ''; });
      cab.forEach(function (c0, j) { var dest = COLS.filter(function (c) { return c.toLowerCase() === c0; })[0] || mapa[c0]; if (dest) n[C[dest]] = r[j]; });
      MODULOS.forEach(function (m, i) { var pl = PLANES[String(n[C['Plan']]).toLowerCase()]; n[M0 + i] = pl ? pl.modulos.indexOf(m[0]) >= 0 : false; }); n[C['Suspendida']] = false; return n; });
    if (filas.length) h.getRange(2, 1, filas.length, COLS.length).setValues(filas);
  }
  h.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold').setBackground('#0E4A5A').setFontColor('#FFFFFF').setWrap(true);
  h.setFrozenRows(1); h.setFrozenColumns(2); h.setRowHeight(1, 42);
  var n = Math.max(h.getMaxRows() - 1, 200);
  h.getRange(2, C['Plan'] + 1, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['basico', 'profesional', 'empresa', 'personalizado'], true).build());
  h.getRange(2, M0 + 1, n, MODULOS.length + 1).insertCheckboxes();
  h.getRange(2, C['Vence (AAAA-MM-DD)'] + 1, n, 1).setNumberFormat('yyyy-mm-dd');
  h.getRange(2, C['NIT'] + 1, n, 1).setNumberFormat('@');
  [C['Estado'], C['Versión'], C['Último reporte'], C['Personas activas'], C['Conectada'], C['Llave de licencia']].forEach(function (c) { h.getRange(1, c + 1).setBackground('#5B6B6E'); });
  h.setColumnWidths(M0 + 1, MODULOS.length + 1, 82); h.setColumnWidth(C['Llave de licencia'] + 1, 160);
}

/* Al elegir el plan se marcan sus módulos (simple trigger) */
function onEdit(e) {
  try {
    var h = e.range.getSheet(); if (h.getName() !== 'Clientes' || e.range.getRow() < 2 || e.range.getColumn() !== C['Plan'] + 1) return;
    var n = e.range.getNumRows ? e.range.getNumRows() : 1;
    for (var k = 0; k < n; k++) {
      var fila = e.range.getRow() + k, plan = String(n === 1 ? (e.value || '') : h.getRange(fila, C['Plan'] + 1).getValue()).toLowerCase(), p = PLANES[plan]; if (!p) continue;
      h.getRange(fila, M0 + 1, 1, MODULOS.length).setValues([MODULOS.map(function (m) { return p.modulos.indexOf(m[0]) >= 0; })]);
      if (!h.getRange(fila, C['Personas máx.'] + 1).getValue()) h.getRange(fila, C['Personas máx.'] + 1).setValue(p.max);
      if (!fecha_(h.getRange(fila, C['Vence (AAAA-MM-DD)'] + 1).getValue())) h.getRange(fila, C['Vence (AAAA-MM-DD)'] + 1).setValue(sumarDias_(hoy_(), 30));
    }
  } catch (x) { }
}

/* ---------- Licencia de una fila ---------- */
function firmar_(datos) { var b = Utilities.base64EncodeWebSafe(JSON.stringify(datos)); return b + '.' + hex_(Utilities.computeHmacSha256Signature(b, clave_())).substr(0, 32); }
function licenciaDeFila_(r) {
  var nit = digitos_(r[C['NIT']]), vence = fecha_(r[C['Vence (AAAA-MM-DD)']]), plan = String(r[C['Plan']] || '').toLowerCase();
  if (!nit || !plan || !/^\d{4}-\d\d-\d\d$/.test(vence) || r[C['Suspendida']] === true) return '';
  var mods = MODULOS.filter(function (m, i) { return r[M0 + i] === true; }).map(function (m) { return m[0]; });
  return firmar_({ plan: plan, nit: nit, modulos: mods, maxUsuarios: Math.max(1, Math.round(+r[C['Personas máx.']] || (PLANES[plan] || PLANES.basico).max)), vence: vence });
}
function estadoDeFila_(r) {
  var vence = fecha_(r[C['Vence (AAAA-MM-DD)']]), hoy = hoy_();
  if (r[C['Suspendida']] === true) return 'Suspendida';
  if (!r[C['Plan']] || !vence) return 'Nueva: asigna plan y vencimiento';
  if (vence < hoy) return sumarDias_(vence, 15) >= hoy ? 'Vencida (en gracia)' : 'Vencida';
  if (vence <= sumarDias_(hoy, 7)) return 'Por vencer';
  return 'Activa';
}
function calcularTodo(silencioso) {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) { if (silencioso !== true) SpreadsheetApp.getUi().alert('Hay reportes llegando: intenta en un momento.'); return; }
  try { calcularTodo_(silencioso); } finally { lock.releaseLock(); }
}
function calcularTodo_(silencioso) {
  var h = hoja_(), n = h.getLastRow() - 1; if (n < 1) return;
  var v = h.getRange(2, 1, n, COLS.length).getValues();
  v.forEach(function (r) { if (!r[0] && !r[1]) return; r[C['Estado']] = estadoDeFila_(r); r[C['Llave de licencia']] = licenciaDeFila_(r); });
  h.getRange(2, 1, n, COLS.length).setValues(v);
  if (silencioso !== true) SpreadsheetApp.getUi().alert('Listo. Las empresas reciben su licencia solas esta noche (o al tocar «Buscar mi licencia ahora» en Configuración → Licencia).');
}
function renovarSeleccionada() {
  var ui = SpreadsheetApp.getUi(), h = hoja_(), fila = h.getActiveRange().getRow();
  if (fila < 2) return ui.alert('Primero selecciona la fila de la empresa.');
  var r = ui.prompt('Renovar', '¿Cuántos meses? (1, 3, 6 o 12)', ui.ButtonSet.OK_CANCEL); if (r.getSelectedButton() !== ui.Button.OK) return;
  var meses = Math.max(1, Math.round(+r.getResponseText() || 1)), celda = h.getRange(fila, C['Vence (AAAA-MM-DD)'] + 1), actual = fecha_(celda.getValue());
  var base = /^\d{4}-\d\d-\d\d$/.test(actual) && actual >= hoy_() ? actual : hoy_(), p = base.split('-');
  var nueva = sumarMeses_(base, meses);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { celda.setValue(nueva); h.getRange(fila, C['Suspendida'] + 1).setValue(false); calcularTodo_(true); } finally { lock.releaseLock(); }
  ui.alert('Renovada hasta ' + nueva + '. La empresa la recibe sola esta noche.');
}

/* ---------- Resumen y avisos ---------- */
function resumen_() {
  var h = hoja_(), n = h.getLastRow() - 1; if (n < 1) return '';
  var hoy = hoy_(), hace3 = sumarDias_(hoy, -3), ult = '', l = { venc: [], pronto: [], silencio: [], nuevas: [] };
  var v = h.getRange(2, 1, n, COLS.length).getValues();
  v.forEach(function (r) { if (String(r[C['Versión']]) > ult) ult = String(r[C['Versión']]); });
  v.forEach(function (r) {
    var emp = r[0] || r[1]; if (!emp) return; var e = estadoDeFila_(r), rep = fecha_(r[C['Último reporte']]);
    if (/^Vencida/.test(e)) l.venc.push('• ' + emp + ' (venció ' + fecha_(r[C['Vence (AAAA-MM-DD)']]) + ')');
    else if (e === 'Por vencer') l.pronto.push('• ' + emp + ' (vence ' + fecha_(r[C['Vence (AAAA-MM-DD)']]) + ')');
    if (/^Nueva/.test(e)) l.nuevas.push('• ' + emp + ' (NIT ' + r[1] + ')');
    if (rep && rep < hace3) l.silencio.push('• ' + emp + ' (último reporte ' + rep + ', versión ' + r[C['Versión']] + ')');
  });
  return (l.nuevas.length ? 'EMPRESAS NUEVAS (asigna plan):\n' + l.nuevas.join('\n') + '\n\n' : '') + (l.venc.length ? 'VENCIDAS:\n' + l.venc.join('\n') + '\n\n' : '') +
    (l.pronto.length ? 'POR VENCER (7 días):\n' + l.pronto.join('\n') + '\n\n' : '') + (l.silencio.length ? 'SIN REPORTAR HACE MÁS DE 3 DÍAS (revisa con ellas):\n' + l.silencio.join('\n') : '');
}
function verResumen() { SpreadsheetApp.getUi().alert(resumen_() || 'Todo al día: no hay empresas nuevas, vencidas, por vencer ni sin reportar.'); }
function activarAvisos() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'avisoDiario') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('avisoDiario').timeBased().atHour(7).everyDays(1).create();
  SpreadsheetApp.getUi().alert('Listo: cada mañana te llega un correo si hay empresas nuevas, por vencer, vencidas o sin reportar.');
}
function avisoDiario() { calcularTodo(true); var t = resumen_(); if (t) MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Control de jornada: empresas que requieren atención', t); }

/* ---------- Aprobar la versión que tomarán las empresas (otro canal que GitHub) ---------- */
function aprobarVersion() {
  var ui = SpreadsheetApp.getUi(), app = prop_('APP'); if (!app) return ui.alert('Primero usa «0. Configurar».');
  var r = UrlFetchApp.fetch(app + 'actualizacion/version.json?t=' + Date.now(), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return ui.alert('No se pudo leer ' + app + 'actualizacion/version.json (código ' + r.getResponseCode() + '). ¿Subiste docs/ a GitHub?');
  var v = JSON.parse(r.getContentText('UTF-8'));
  if (!/^[0-9a-f]{64}$/.test(v.sha256 || '')) return ui.alert('La versión publicada no trae huella. Vuelve a empaquetar.');
  var ok = ui.alert('Aprobar versión ' + v.version, 'Publicada el ' + (v.fecha || '?') + '.\nHuella: ' + v.sha256.substr(0, 16) + '…\n\n' + String(v.notas || '').substr(0, 900) + '\n\nSolo apruébala si TÚ la publicaste. Las empresas la instalarán esta noche.', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  prop_('APROBADA', JSON.stringify({ version: v.version, sha256: v.sha256, fecha: hoy_() }));
  ui.alert('Aprobada la versión ' + v.version + '. Las empresas conectadas la instalan esta noche.');
}
function olvidarRegistro() {
  var ui = SpreadsheetApp.getUi(), h = hoja_(), fila = h.getActiveRange().getRow(); if (fila < 2) return ui.alert('Selecciona la fila de la empresa.');
  var nit = digitos_(h.getRange(fila, C['NIT'] + 1).getValue()); if (!nit) return;
  if (ui.alert('Desconectar ' + nit, 'Úsalo solo si la empresa reinstaló la aplicación. Su próximo reporte la vuelve a conectar.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().deleteProperty('SEC_' + nit); h.getRange(fila, C['Conectada'] + 1).setValue('No');
}

/* ---------- Las empresas se reportan aquí cada noche ---------- */
function limpio_(v, n) { v = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().substr(0, n || 120); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(15000)) return salida_({ error: 'El panel está ocupado. Se intentará de nuevo.' });
    var env = JSON.parse(e.postData.contents || '{}'), d = JSON.parse(env.datos || '{}'), nit = digitos_(d.nit);
    if (!nit || nit.length < 6 || nit.length > 15) return salida_({ error: 'NIT no válido.' });
    var sec = prop_('SEC_' + nit), registrado = false;
    if (sec) { if (hex_(Utilities.computeHmacSha256Signature(env.datos, sec)) !== env.firma) return salida_({ error: 'Reporte no autorizado para este NIT. Si la empresa reinstaló, el proveedor debe desconectarla en su panel.' }); }
    else {
      if (!/^[0-9a-f]{64,}$/.test(env.registro || '') || hex_(Utilities.computeHmacSha256Signature(env.datos, env.registro)) !== env.firma) return salida_({ error: 'Registro no válido.' });
      var hoy = hoy_(), cuenta = JSON.parse(prop_('ALTAS') || '{}'); if (cuenta.dia !== hoy) cuenta = { dia: hoy, n: 0 };
      if (cuenta.n >= 30) return salida_({ error: 'Demasiadas empresas nuevas hoy. Intenta mañana.' });
      cuenta.n++; prop_('ALTAS', JSON.stringify(cuenta)); prop_('SEC_' + nit, env.registro); registrado = true;
    }
    var h = hoja_(), n = Math.max(h.getLastRow() - 1, 0), v = n ? h.getRange(2, 1, n, COLS.length).getValues() : [], i = -1;
    for (var k = 0; k < v.length; k++) if (digitos_(v[k][C['NIT']]) === nit) { i = k; break; }
    var r = i >= 0 ? v[i] : null;
    if (!r) { r = COLS.map(function () { return ''; }); r[C['Empresa']] = limpio_(d.empresa); r[C['NIT']] = "'" + nit; MODULOS.forEach(function (m, j) { r[M0 + j] = false; }); r[C['Suspendida']] = false; r[C['Correo']] = limpio_(d.contacto); }
    else if (!r[C['Correo']] && d.contacto) h.getRange(i + 2, C['Correo'] + 1).setValue(limpio_(d.contacto));
    var gris = { 'Versión': limpio_(d.version, 12), 'Último reporte': Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm'), 'Personas activas': Math.max(0, Math.min(100000, Math.round(+d.personas || 0))), 'Conectada': 'Sí' };
    Object.keys(gris).forEach(function (c) { r[C[c]] = gris[c]; });
    r[C['Estado']] = estadoDeFila_(r); r[C['Llave de licencia']] = licenciaDeFila_(r);
    if (i >= 0) { // solo se escriben las columnas grises: nunca se pisa lo que edita el proveedor
      h.getRange(i + 2, C['Estado'] + 1, 1, C['Llave de licencia'] - C['Estado'] + 1).setValues([r.slice(C['Estado'], C['Llave de licencia'] + 1)]);
    } else h.appendRow(r);
    var resp = { registrado: registrado }, ap = prop_('APROBADA'); if (ap) { var a = JSON.parse(ap); resp.aprobada = { version: a.version, sha256: a.sha256 }; }
    if (r[C['Llave de licencia']]) resp.llave = r[C['Llave de licencia']];
    else resp.mensaje = r[C['Suspendida']] === true ? 'La suscripción está suspendida. Comunícate con tu proveedor.' : 'Tu proveedor todavía no ha asignado el plan de esta empresa.';
    return salida_(resp);
  } catch (x) { return salida_({ error: 'El panel no pudo procesar el reporte.' }); } finally { try { lock.releaseLock(); } catch (y) { } }
}
function doGet() {
  return HtmlService.createHtmlOutput(consolaHtml_()).setTitle('Panel de proveedor · Control de jornada')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- Consola web (la misma URL del panel, protegida con contraseña) ---------- */
function sha_(t) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8)); }
function claveConsola() {
  var ui = SpreadsheetApp.getUi(), r = ui.prompt('Contraseña de la consola web', 'Escribe una contraseña de mínimo 8 caracteres. La pedirá la consola al entrar (guárdala: no se puede ver después).', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var c = r.getResponseText(); if (c.length < 8) return ui.alert('Muy corta: mínimo 8 caracteres.');
  var sal = Utilities.getUuid(); prop_('CONSOLA', sal + ':' + sha_(sal + c));
  libro_(); hoja_(); abrirConsola();
}
function abrirConsola() {
  var url = prop_('URL_PANEL') || ''; try { url = url || ScriptApp.getService().getUrl(); } catch (e) { }
  if (!prop_('CONSOLA')) return SpreadsheetApp.getUi().alert('Primero crea la contraseña: menú «Contraseña de la consola web…».');
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput('<p style="font-family:sans-serif">Abre la consola (guárdala en favoritos):</p><p style="font-family:sans-serif;word-break:break-all"><a href="' + url + '" target="_blank">' + url + '</a></p>').setWidth(520).setHeight(160), 'Consola web');
}
function consolaEntrar(clave) {
  var cc = CacheService.getScriptCache(), fallos = +(cc.get('fallos') || 0);
  if (fallos >= 8) throw new Error('Demasiados intentos. Espera 15 minutos.');
  var g = String(prop_('CONSOLA') || '').split(':');
  if (g.length < 2) throw new Error('Aún no hay contraseña. En la hoja del panel: menú «Panel de proveedor → Contraseña de la consola web…».');
  if (sha_(g[0] + String(clave || '')) !== g[1]) { cc.put('fallos', String(fallos + 1), 900); Utilities.sleep(800); throw new Error('Contraseña incorrecta.'); }
  var t = Utilities.getUuid() + Utilities.getUuid(); cc.put('ses:' + t, '1', 21600); return t;
}
function consola(token, accion, d) {
  if (!token || !CacheService.getScriptCache().get('ses:' + token)) throw new Error('SESION');
  d = d || {};
  if (accion === 'datos') return consolaDatos_();
  if (accion === 'verVersion') return versionPublicada_();
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) throw new Error('Hay reportes llegando: intenta en un momento.');
  try {
    if (accion === 'guardar') guardarEmpresa_(d);
    else if (accion === 'renovar') renovar_(d.nit, d.meses);
    else if (accion === 'desconectar') { PropertiesService.getScriptProperties().deleteProperty('SEC_' + digitos_(d.nit)); editarFila_(d.nit, function (r) { r[C['Conectada']] = 'No'; }); }
    else if (accion === 'aprobar') { var v = versionPublicada_(); if (v.sha256 !== d.sha256) throw new Error('La versión publicada cambió. Vuelve a revisarla.'); prop_('APROBADA', JSON.stringify({ version: v.version, sha256: v.sha256, fecha: hoy_() })); }
    else throw new Error('Acción desconocida.');
  } finally { lock.releaseLock(); }
  return consolaDatos_();
}
function versionPublicada_() {
  var app = prop_('APP'); if (!app) throw new Error('Falta la dirección de tu página: en la hoja usa «0. Configurar».');
  var r = UrlFetchApp.fetch(app + 'actualizacion/version.json?t=' + Date.now(), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('No se pudo leer ' + app + 'actualizacion/version.json. ¿Subiste docs a GitHub?');
  var v = JSON.parse(r.getContentText('UTF-8')); if (!/^[0-9a-f]{64}$/.test(v.sha256 || '')) throw new Error('La versión publicada no trae huella. Vuelve a empaquetar.');
  return { version: v.version, fecha: v.fecha || '', notas: String(v.notas || '').substr(0, 3000), sha256: v.sha256 };
}
function consolaDatos_() {
  var h = hoja_(), n = h.getLastRow() - 1, v = n > 0 ? h.getRange(2, 1, n, COLS.length).getValues() : [];
  var emp = v.filter(function (r) { return r[C['Empresa']] || r[C['NIT']]; }).map(function (r) {
    var m = {}; MODULOS.forEach(function (x, i) { m[x[0]] = r[M0 + i] === true; });
    return { empresa: String(r[C['Empresa']] || ''), nit: digitos_(r[C['NIT']]), contacto: String(r[C['Contacto']] || ''), whatsapp: String(r[C['WhatsApp']] || ''), correo: String(r[C['Correo']] || ''),
      plan: String(r[C['Plan']] || '').toLowerCase(), max: +r[C['Personas máx.']] || '', vence: fecha_(r[C['Vence (AAAA-MM-DD)']]), modulos: m, suspendida: r[C['Suspendida']] === true,
      estado: estadoDeFila_(r), version: String(r[C['Versión']] || ''), reporte: r[C['Último reporte']] instanceof Date ? Utilities.formatDate(r[C['Último reporte']], 'America/Bogota', 'yyyy-MM-dd HH:mm') : String(r[C['Último reporte']] || ''),
      personas: r[C['Personas activas']] === '' ? '' : +r[C['Personas activas']], conectada: String(r[C['Conectada']] || ''), notas: String(r[C['Notas']] || '') };
  });
  var ap = prop_('APROBADA');
  return { empresas: emp, modulos: MODULOS, planes: PLANES, aprobada: ap ? JSON.parse(ap) : null, app: prop_('APP') || '', hoy: hoy_() };
}
function editarFila_(nit, fn, crear) {
  nit = digitos_(nit); if (!nit || nit.length < 6) throw new Error('Escribe un NIT válido (solo números, sin dígito de verificación).');
  var h = hoja_(), n = Math.max(h.getLastRow() - 1, 0), v = n ? h.getRange(2, 1, n, COLS.length).getValues() : [], i = -1;
  for (var k = 0; k < v.length; k++) if (digitos_(v[k][C['NIT']]) === nit) { i = k; break; }
  if (i < 0 && !crear) throw new Error('No encontré la empresa con NIT ' + nit + '.');
  var r = i >= 0 ? v[i] : COLS.map(function () { return ''; });
  if (i < 0) { r[C['NIT']] = "'" + nit; MODULOS.forEach(function (m, j) { r[M0 + j] = false; }); r[C['Suspendida']] = false; r[C['Conectada']] = 'No'; }
  fn(r);
  r[C['Estado']] = estadoDeFila_(r); r[C['Llave de licencia']] = licenciaDeFila_(r);
  if (typeof r[C['NIT']] !== 'string' || r[C['NIT']].charAt(0) !== "'") r[C['NIT']] = "'" + nit;
  if (i >= 0) h.getRange(i + 2, 1, 1, COLS.length).setValues([r]); else h.appendRow(r);
}
function guardarEmpresa_(d) {
  editarFila_(d.nit, function (r) {
    ['empresa:Empresa', 'contacto:Contacto', 'whatsapp:WhatsApp', 'correo:Correo', 'notas:Notas'].forEach(function (x) { var p = x.split(':'); if (d[p[0]] !== undefined) r[C[p[1]]] = limpio_(d[p[0]], p[0] === 'notas' ? 500 : 120); });
    if (d.plan !== undefined) { var pl = String(d.plan || '').toLowerCase(); if (pl && !PLANES[pl] && pl !== 'personalizado') throw new Error('Plan no válido.'); r[C['Plan']] = pl; }
    if (d.max !== undefined) r[C['Personas máx.']] = Math.max(1, Math.min(100000, Math.round(+d.max || 0))) || '';
    if (d.vence !== undefined) { if (d.vence && !/^\d{4}-\d\d-\d\d$/.test(d.vence)) throw new Error('Fecha de vencimiento no válida.'); r[C['Vence (AAAA-MM-DD)']] = d.vence || ''; }
    if (d.modulos) MODULOS.forEach(function (m, i) { r[M0 + i] = m[0] === 'asistencia' ? true : d.modulos[m[0]] === true; });
    if (d.suspendida !== undefined) r[C['Suspendida']] = d.suspendida === true;
  }, d.nueva === true);
}
function renovar_(nit, meses) {
  meses = Math.max(1, Math.min(36, Math.round(+meses || 1)));
  editarFila_(nit, function (r) {
    var actual = fecha_(r[C['Vence (AAAA-MM-DD)']]), base = /^\d{4}-\d\d-\d\d$/.test(actual) && actual >= hoy_() ? actual : hoy_(), p = base.split('-');
    r[C['Vence (AAAA-MM-DD)']] = sumarMeses_(base, meses); r[C['Suspendida']] = false;
  });
}
function consolaHtml_() { return CONSOLA_HTML; }
function salida_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- Consola: página (generada por herramientas/panel.js) ---------- */
var CONSOLA_HTML = "<!DOCTYPE html>\n<html lang=\"es\"><head><meta charset=\"utf-8\">\n<style>\n:root{--t:#0E4A5A;--t2:#13687D;--f:#F4F7F7;--b:#FFFFFF;--l:#D5DEDF;--x:#14242A;--s:#5B6B6E;--ok:#1B7A3E;--okf:#E5F3EA;--w:#8A5A00;--wf:#FFF4DC;--e:#B3261E;--ef:#FCE8E6;--n:#2457A6;--nf:#E6EEFB}\n*{box-sizing:border-box}body{margin:0;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--f);color:var(--x)}\nheader{background:var(--t);color:#fff;padding:14px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}\nheader h1{font-size:18px;margin:0;flex:1}header small{opacity:.8}\nmain{max-width:1180px;margin:0 auto;padding:16px}\nbutton{font:inherit;border:0;border-radius:10px;padding:9px 14px;cursor:pointer;background:var(--t);color:#fff;min-height:40px}\nbutton.sec{background:#fff;color:var(--t);border:1px solid var(--l)}button.peligro{background:#fff;color:var(--e);border:1px solid #F0C4C0}\nbutton:disabled{opacity:.55;cursor:wait}\ninput,select,textarea{font:inherit;padding:9px 10px;border:1px solid var(--l);border-radius:9px;width:100%;background:#fff;color:var(--x);min-height:40px}\nlabel{display:block;font-size:13px;color:var(--s)}label>span{display:block;margin-bottom:4px}\n.tarj{background:var(--b);border:1px solid var(--l);border-radius:14px;padding:16px}\n.cifras{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}\n.cifra{background:#fff;border:1px solid var(--l);border-radius:12px;padding:12px 14px;cursor:pointer;text-align:left;color:var(--x);min-height:auto}\n.cifra b{display:block;font-size:24px}.cifra.act{outline:2px solid var(--t)}\n.barra{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.barra input{flex:1;min-width:200px}\ntable{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--l);border-radius:12px;overflow:hidden}\nth,td{text-align:left;padding:10px 12px;border-bottom:1px solid #E8EDEC;vertical-align:top}th{font-size:12px;color:var(--s);background:#FAFBFB;font-weight:600}\ntr.fila{cursor:pointer}tr.fila:hover{background:#F7FAFA}\n.chip{display:inline-block;white-space:normal;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:600}\n.c-ok{background:var(--okf);color:var(--ok)}.c-w{background:var(--wf);color:var(--w)}.c-e{background:var(--ef);color:var(--e)}.c-n{background:var(--nf);color:var(--n)}.c-g{background:#EEF1F1;color:var(--s)}\n.suave{color:var(--s);font-size:13px}\n.velo{position:fixed;inset:0;background:rgba(10,30,36,.45);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto;z-index:5}\n.modal{background:#fff;border-radius:16px;max-width:760px;width:100%;padding:20px}\n.rej{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}\n.mods{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;margin-top:6px}\n.mods label{display:flex;gap:8px;align-items:center;font-size:14px;color:var(--x);border:1px solid var(--l);border-radius:9px;padding:8px 10px}\n.mods input{width:auto;min-height:auto}\n.fila-b{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}\n.aviso{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--x);color:#fff;padding:10px 16px;border-radius:10px;z-index:9;max-width:90vw}\n.vacio{padding:30px;text-align:center}\n.entrar{max-width:380px;margin:60px auto}\npre{white-space:pre-wrap;background:var(--f);padding:10px;border-radius:9px;font-size:13px;max-height:260px;overflow:auto}\n@media(max-width:760px){.oc{display:none}}\n</style></head><body>\n<header><h1>Panel de proveedor <small>· Control de jornada</small></h1><span id=\"ver\" class=\"suave\" style=\"color:#cfe\"></span></header>\n<main id=\"app\"><p class=\"suave\">Panel de proveedor de Control de jornada: activo.</p></main>\n<div id=\"aviso\" class=\"aviso\" hidden></div>\n<script>\nvar T = null, D = null, filtro = 'todas', busca = '';\nfunction $(s) { return document.querySelector(s); }\nfunction esc(t) { return String(t == null ? '' : t).replace(/[&<>\"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]; }); }\nfunction aviso(t) { var a = $('#aviso'); a.textContent = t; a.hidden = false; clearTimeout(aviso.t); aviso.t = setTimeout(function () { a.hidden = true; }, 4500); }\nfunction llamar(accion, d) {\n  return new Promise(function (ok, no) {\n    google.script.run.withSuccessHandler(ok).withFailureHandler(function (e) {\n      var m = (e && e.message) || String(e); if (/SESION/.test(m)) { T = null; try { sessionStorage.removeItem('t'); } catch (x) {} pantallaEntrar('Tu sesión terminó. Vuelve a entrar.'); }\n      no(new Error(m));\n    }).consola(T, accion, d || {});\n  });\n}\nfunction pantallaEntrar(msg) {\n  $('#app').innerHTML = '<div class=\"tarj entrar\"><h2 style=\"margin-top:0\">Entrar</h2><p class=\"suave\">' + esc(msg || 'Escribe la contraseña de la consola. Se crea en la hoja del panel: menú «Panel de proveedor → Contraseña de la consola web…».') + '</p>' +\n    '<form id=\"fe\"><label><span>Contraseña</span><input id=\"pw\" type=\"password\" autocomplete=\"current-password\" required></label><div class=\"fila-b\"><button id=\"be\">Entrar</button></div></form></div>';\n  $('#pw').focus();\n  $('#fe').onsubmit = function (ev) { ev.preventDefault(); var b = $('#be'); b.disabled = true; b.textContent = 'Entrando…';\n    google.script.run.withSuccessHandler(function (t) { T = t; try { sessionStorage.setItem('t', t); } catch (x) {} cargar(); })\n      .withFailureHandler(function (e) { b.disabled = false; b.textContent = 'Entrar'; aviso(e.message); }).consolaEntrar($('#pw').value); };\n}\nfunction cargar() { $('#app').innerHTML = '<p class=\"suave\">Cargando empresas…</p>'; llamar('datos').then(function (d) { D = d; pintar(); }).catch(function (e) { if (!/SESION/.test(e.message)) aviso(e.message); }); }\nfunction claseEstado(e) { return /^Activa/.test(e) ? 'c-ok' : /^Por vencer|gracia/.test(e) ? 'c-w' : /^Vencida|Suspendida/.test(e) ? 'c-e' : /^Nueva/.test(e) ? 'c-n' : 'c-g'; }\nfunction grupo(x) { if (/^Nueva/.test(x.estado)) return 'nuevas'; if (/^Vencida|Suspendida/.test(x.estado)) return 'vencidas'; if (/^Por vencer/.test(x.estado)) return 'pronto'; if (sinReportar(x)) return 'silencio'; return 'activas'; }\nfunction sinReportar(x) { if (!x.reporte) return true; var h = new Date(D.hoy + 'T00:00:00'); h.setDate(h.getDate() - 3); return x.reporte.substr(0, 10) < h.toISOString().substr(0, 10); }\nfunction nombrePlan(p) { return { basico: 'Básico', profesional: 'Profesional', empresa: 'Empresa', personalizado: 'Personalizado' }[p] || '—'; }\nfunction pintar() {\n  var E = D.empresas, n = function (g) { return E.filter(function (x) { return g === 'todas' || grupo(x) === g || (g === 'silencio' && sinReportar(x)); }).length; };\n  $('#ver').textContent = D.aprobada ? 'Versión aprobada: ' + D.aprobada.version : 'Sin versión aprobada';\n  var cifras = [['todas', 'Empresas'], ['nuevas', 'Nuevas: asigna plan'], ['pronto', 'Por vencer'], ['vencidas', 'Vencidas o suspendidas'], ['silencio', 'Sin reportar (3 días)']]\n    .map(function (c) { return '<button class=\"cifra' + (filtro === c[0] ? ' act' : '') + '\" data-f=\"' + c[0] + '\"><b>' + n(c[0]) + '</b>' + c[1] + '</button>'; }).join('');\n  var lista = E.filter(function (x) { return (filtro === 'todas' || grupo(x) === filtro || (filtro === 'silencio' && sinReportar(x))) && (!busca || (x.empresa + ' ' + x.nit).toLowerCase().indexOf(busca) >= 0); })\n    .sort(function (a, b) { return (/^Nueva/.test(b.estado) - /^Nueva/.test(a.estado)) || a.empresa.localeCompare(b.empresa); });\n  var filas = lista.map(function (x) {\n    var mods = D.modulos.filter(function (m) { return x.modulos[m[0]]; }).length;\n    return '<tr class=\"fila\" data-nit=\"' + esc(x.nit) + '\"><td><strong>' + esc(x.empresa || '(sin nombre)') + '</strong><div class=\"suave\">NIT ' + esc(x.nit) + '</div></td>' +\n      '<td><span class=\"chip ' + claseEstado(x.estado) + '\">' + esc(x.estado) + '</span></td><td class=\"oc\">' + nombrePlan(x.plan) + '<div class=\"suave\">' + mods + ' de ' + D.modulos.length + ' módulos</div></td>' +\n      '<td>' + esc(x.vence || '—') + '</td><td class=\"oc\">' + (x.personas === '' ? '—' : x.personas) + ' / ' + (x.max || '—') + '</td>' +\n      '<td class=\"oc\">' + esc(x.version || '—') + '<div class=\"suave\">' + esc(x.reporte || 'nunca') + '</div></td></tr>';\n  }).join('');\n  $('#app').innerHTML = '<div class=\"cifras\">' + cifras + '</div>' +\n    '<div class=\"barra\"><input id=\"bus\" placeholder=\"Buscar por nombre o NIT\" value=\"' + esc(busca) + '\"><button id=\"nueva\">+ Agregar empresa</button><button class=\"sec\" id=\"version\">Versión y actualizaciones</button><button class=\"sec\" id=\"rec\">Actualizar lista</button></div>' +\n    (lista.length ? '<div style=\"overflow-x:auto\"><table><thead><tr><th>Empresa</th><th>Estado</th><th class=\"oc\">Plan</th><th>Vence</th><th class=\"oc\">Personas</th><th class=\"oc\">Versión · último reporte</th></tr></thead><tbody>' + filas + '</tbody></table></div>'\n      : '<div class=\"tarj vacio\"><h3 style=\"margin-top:0\">' + (E.length ? 'No hay empresas en este filtro' : 'Todavía no hay empresas') + '</h3><p class=\"suave\">Una empresa aparece aquí cuando su administrador escribe el <strong>NIT</strong> en <em>Configuración → Empresa</em> y usa <em>Configuración → Licencia y versión → Buscar mi licencia ahora</em> (o en su hoja: <em>Control de jornada → 3. Revisar instalación</em>). Si no quieres esperar, agrégala tú con «+ Agregar empresa» usando su NIT.</p></div>') +\n    '<p class=\"suave\" style=\"margin-top:14px\">Los cambios llegan a la empresa en su próximo reporte: cada noche, o al instante si su administrador toca «Buscar mi licencia ahora».</p>';\n  [].forEach.call(document.querySelectorAll('.cifra'), function (b) { b.onclick = function () { filtro = b.getAttribute('data-f'); pintar(); }; });\n  [].forEach.call(document.querySelectorAll('tr.fila'), function (r) { r.onclick = function () { editar(E.filter(function (x) { return x.nit === r.getAttribute('data-nit'); })[0]); }; });\n  $('#bus').oninput = function (e) { busca = e.target.value.toLowerCase(); var p = e.target.selectionStart; pintar(); var i = $('#bus'); i.focus(); i.setSelectionRange(p, p); };\n  $('#nueva').onclick = function () { editar(null); }; $('#rec').onclick = cargar; $('#version').onclick = verVersion;\n}\nfunction sumarDias(n) { var d = new Date(D.hoy + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().substr(0, 10); }\nfunction cerrarModal() { var v = $('.velo'); if (v) v.remove(); }\nfunction modal(html) { cerrarModal(); var v = document.createElement('div'); v.className = 'velo'; v.innerHTML = '<div class=\"modal\" role=\"dialog\" aria-modal=\"true\">' + html + '</div>'; document.body.appendChild(v);\n  v.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarModal(); }); return v; }\nfunction editar(x) {\n  var nueva = !x; x = x || { empresa: '', nit: '', contacto: '', whatsapp: '', correo: '', plan: '', max: '', vence: '', modulos: { asistencia: true }, suspendida: false, notas: '', estado: 'Nueva', conectada: 'No' };\n  var planes = ['', 'basico', 'profesional', 'empresa', 'personalizado'].map(function (p) { return '<option value=\"' + p + '\"' + (x.plan === p ? ' selected' : '') + '>' + (p ? nombrePlan(p) + (D.planes[p] ? ' (hasta ' + D.planes[p].max + ' personas)' : '') : 'Elige un plan…') + '</option>'; }).join('');\n  var mods = D.modulos.map(function (m) { return '<label><input type=\"checkbox\" data-m=\"' + m[0] + '\"' + (x.modulos[m[0]] || m[0] === 'asistencia' ? ' checked' : '') + (m[0] === 'asistencia' ? ' disabled' : '') + '> ' + esc(m[1]) + '</label>'; }).join('');\n  var v = modal('<h2 style=\"margin-top:0\">' + (nueva ? 'Agregar empresa' : esc(x.empresa || 'Empresa')) + '</h2>' +\n    (nueva ? '' : '<p><span class=\"chip ' + claseEstado(x.estado) + '\">' + esc(x.estado) + '</span> <span class=\"suave\">· Conectada: ' + esc(x.conectada || 'No') + ' · Versión ' + esc(x.version || '—') + ' · Último reporte: ' + esc(x.reporte || 'nunca') + ' · ' + (x.personas === '' ? '—' : x.personas) + ' personas activas</span></p>') +\n    '<div class=\"rej\"><label><span>Nombre de la empresa</span><input id=\"e-emp\" value=\"' + esc(x.empresa) + '\"></label>' +\n    '<label><span>NIT (solo números, sin dígito de verificación)</span><input id=\"e-nit\" inputmode=\"numeric\" value=\"' + esc(x.nit) + '\"' + (nueva ? '' : ' disabled') + '></label>' +\n    '<label><span>Plan</span><select id=\"e-plan\">' + planes + '</select></label>' +\n    '<label><span>Personas máximo</span><input id=\"e-max\" type=\"number\" min=\"1\" value=\"' + esc(x.max) + '\"></label>' +\n    '<label><span>Vence</span><input id=\"e-vence\" type=\"date\" value=\"' + esc(x.vence) + '\"></label>' +\n    '<label><span>Contacto</span><input id=\"e-con\" value=\"' + esc(x.contacto) + '\"></label>' +\n    '<label><span>WhatsApp</span><input id=\"e-wa\" inputmode=\"tel\" value=\"' + esc(x.whatsapp) + '\"></label>' +\n    '<label><span>Correo</span><input id=\"e-co\" type=\"email\" value=\"' + esc(x.correo) + '\"></label></div>' +\n    '<p style=\"margin:16px 0 0\"><strong>Módulos</strong> <span class=\"suave\">(al elegir un plan se marcan solos; si cambias alguno queda «Personalizado»)</span></p><div class=\"mods\">' + mods + '</div>' +\n    '<label style=\"margin-top:12px\"><span>Notas internas</span><textarea id=\"e-not\" rows=\"2\">' + esc(x.notas) + '</textarea></label>' +\n    '<label style=\"display:flex;gap:8px;align-items:center;margin-top:10px;color:var(--e)\"><input type=\"checkbox\" id=\"e-sus\" style=\"width:auto;min-height:auto\"' + (x.suspendida ? ' checked' : '') + '> Suspender ya (los trabajadores siguen marcando; el panel de la empresa queda en consulta)</label>' +\n    '<div class=\"fila-b\"><button id=\"g\">Guardar</button>' + (nueva ? '' : '<button class=\"sec\" data-r=\"1\">+1 mes</button><button class=\"sec\" data-r=\"3\">+3 meses</button><button class=\"sec\" data-r=\"6\">+6 meses</button><button class=\"sec\" data-r=\"12\">+12 meses</button><button class=\"peligro\" id=\"desc\">Desconectar (reinstaló)</button>') + '<button class=\"sec\" id=\"cer\">Cancelar</button></div>');\n  $('#e-emp').focus();\n  $('#e-plan').onchange = function () { var p = D.planes[this.value]; if (p) { [].forEach.call(v.querySelectorAll('[data-m]'), function (c) { c.checked = p.modulos.indexOf(c.getAttribute('data-m')) >= 0; }); if (!$('#e-max').value || nueva) $('#e-max').value = p.max; }\n    if (this.value && !$('#e-vence').value) $('#e-vence').value = sumarDias(30); };\n  [].forEach.call(v.querySelectorAll('[data-m]'), function (c) { c.onchange = function () { var p = D.planes[$('#e-plan').value]; if (!p) return;\n    var igual = [].every.call(v.querySelectorAll('[data-m]'), function (k) { return k.checked === (p.modulos.indexOf(k.getAttribute('data-m')) >= 0); }); if (!igual) $('#e-plan').value = 'personalizado'; }; });\n  $('#cer').onclick = cerrarModal;\n  var ocupar = function (b, p) { [].forEach.call(v.querySelectorAll('button'), function (k) { k.disabled = true; }); var t = b.textContent; b.textContent = 'Guardando…';\n    return p.then(function (d) { D = d; cerrarModal(); pintar(); }).catch(function (e) { aviso(e.message); [].forEach.call(v.querySelectorAll('button'), function (k) { k.disabled = false; }); b.textContent = t; }); };\n  $('#g').onclick = function () {\n    var m = {}; [].forEach.call(v.querySelectorAll('[data-m]'), function (c) { m[c.getAttribute('data-m')] = c.checked; });\n    var d = { nueva: nueva, nit: $('#e-nit').value.replace(/\\D/g, ''), empresa: $('#e-emp').value, plan: $('#e-plan').value, max: $('#e-max').value, vence: $('#e-vence').value, contacto: $('#e-con').value, whatsapp: $('#e-wa').value, correo: $('#e-co').value, notas: $('#e-not').value, modulos: m, suspendida: $('#e-sus').checked };\n    if (nueva && D.empresas.some(function (e) { return e.nit === d.nit; })) return aviso('Ya existe una empresa con ese NIT.');\n    if (d.plan && !d.vence) return aviso('Escribe la fecha de vencimiento.');\n    ocupar(this, llamar('guardar', d)).then(function () { aviso('Guardado. Le llega a la empresa en su próximo reporte.'); });\n  };\n  [].forEach.call(v.querySelectorAll('[data-r]'), function (b) { b.onclick = function () { var me = +b.getAttribute('data-r'); ocupar(b, llamar('renovar', { nit: x.nit, meses: me })).then(function () { aviso('Renovada ' + me + (me === 1 ? ' mes.' : ' meses.')); }); }; });\n  var bd = $('#desc'); if (bd) bd.onclick = function () { if (!confirm('Úsalo solo si la empresa reinstaló la aplicación y ya no puede reportar. Su próximo reporte la vuelve a conectar. ¿Desconectar?')) return; ocupar(bd, llamar('desconectar', { nit: x.nit })); };\n}\nfunction verVersion() {\n  var v = modal('<h2 style=\"margin-top:0\">Versión y actualizaciones</h2><p class=\"suave\">Revisando lo publicado en tu GitHub…</p>');\n  llamar('verVersion').then(function (p) {\n    var ya = D.aprobada && D.aprobada.sha256 === p.sha256, cuantas = D.empresas.filter(function (e) { return e.version === p.version; }).length;\n    v.querySelector('.modal').innerHTML = '<h2 style=\"margin-top:0\">Versión ' + esc(p.version) + '</h2>' +\n      '<p>' + (ya ? '<span class=\"chip c-ok\">Aprobada</span> Las empresas conectadas ya la están instalando de noche.' : '<span class=\"chip c-w\">Sin aprobar</span> Las empresas no la instalan hasta que la apruebes.') + '</p>' +\n      '<p class=\"suave\">Publicada: ' + esc(p.fecha || '—') + ' · Huella ' + esc(p.sha256.substr(0, 16)) + '… · ' + cuantas + ' de ' + D.empresas.length + ' empresas ya la tienen.</p>' +\n      '<p><strong>Novedades</strong></p><pre>' + esc(p.notas || '(sin notas)') + '</pre>' +\n      '<div class=\"fila-b\">' + (ya ? '' : '<button id=\"ap\">Aprobar esta versión</button>') + '<button class=\"sec\" id=\"cer\">Cerrar</button></div>';\n    $('#cer').onclick = cerrarModal;\n    var a = $('#ap'); if (a) a.onclick = function () { if (!confirm('Apruébala solo si TÚ la publicaste. Las empresas la instalan esta noche. ¿Aprobar ' + p.version + '?')) return; a.disabled = true;\n      llamar('aprobar', { sha256: p.sha256 }).then(function (d) { D = d; cerrarModal(); pintar(); aviso('Versión ' + p.version + ' aprobada.'); }).catch(function (e) { a.disabled = false; aviso(e.message); }); };\n  }).catch(function (e) { v.querySelector('.modal').innerHTML = '<h2 style=\"margin-top:0\">Versión y actualizaciones</h2><p>' + esc(e.message) + '</p><div class=\"fila-b\"><button class=\"sec\" id=\"cer\">Cerrar</button></div>'; $('#cer').onclick = cerrarModal; });\n}\ntry { T = sessionStorage.getItem('t'); } catch (x) {}\nif (T) cargar(); else pantallaEntrar();\n</script></body></html>\n";
