/**
 * CONTROL DE JORNADA — Instalación, tareas programadas, copias de seguridad y retención de datos.
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Control de jornada')
    .addItem('1. Instalar', 'instalar')
    .addItem('2. Ver el enlace de mi empresa', 'verEnlace')
    .addItem('3. Revisar instalación', 'revisarInstalacion')
    .addSeparator()
    .addItem('Ver código del primer administrador', 'verCodigoAdmin')
    .addItem('Hacer copia de seguridad ahora', 'respaldarAhora')
    .addItem('Probar funcionamiento', 'probarFuncionamiento')
    .addItem('Actualizar ahora', 'actualizarAhora')
    .addToUi();
}
function aviso_(t) { try { SpreadsheetApp.getUi().alert(t); } catch (e) { Logger.log(t); } }

/** Ejecutar UNA vez desde el menú (o desde el editor). Se puede repetir sin perder datos. */
function instalar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Una copia de la plantilla trae las propiedades de la original: se descartan para no compartir secreto ni carpetas.
  if (prop_('SS_ID') && prop_('SS_ID') !== ss.getId()) PropertiesService.getScriptProperties().deleteAllProperties();
  prop_('SS_ID', ss.getId());
  Object.keys(HOJAS).forEach(function (n) { var h = hoja_(n); h.getRange(1, 1, 1, HOJAS[n].length).setValues([HOJAS[n]]).setFontWeight('bold'); // encabezados al día tras una actualización
    h.getRange(1, 1, h.getMaxRows(), HOJAS[n].length).setNumberFormat('@'); });
  ['Sesiones', 'Auditoria', 'Errores'].forEach(function (n) { var h = ss.getSheetByName(n); if (h && h.hideSheet) h.hideSheet(); }); // hojas técnicas ocultas
  ['Usuarios', 'Sesiones', 'Marcaciones', 'Nomina', 'Periodos', 'Auditoria'].forEach(function (n) {
    try { var h = ss.getSheetByName(n); if (h && !h.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) h.protect().setDescription('Protegida por Control de jornada').setWarningOnly(true); } catch (e) { }
  });
  if (!prop_('SECRETO')) prop_('SECRETO', azar_() + azar_());
  var raiz = DriveApp.getFileById(ss.getId()).getParents(), padre = raiz.hasNext() ? raiz.next() : DriveApp.getRootFolder();
  if (!prop_('CARPETA_FOTOS')) prop_('CARPETA_FOTOS', padre.createFolder('Control de jornada - Fotos y soportes (privado)').getId());
  if (!prop_('CARPETA_RESPALDOS')) prop_('CARPETA_RESPALDOS', padre.createFolder('Control de jornada - Copias de seguridad').getId());
  var hayAdmin = leer('Usuarios').some(function (u) { return u.rol === 'admin' && u.hash; });
  if (!hayAdmin && !prop_('CODIGO_ADMIN')) prop_('CODIGO_ADMIN', 'ADM-' + azar_().substr(0, 10).toUpperCase());
  if (!cfg_().codigoEmpresa) cfgSet_('codigoEmpresa', codigoLargo_());
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tareaCada5').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('tareaCada15').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('tareaDiaria').timeBased().atHour(2).everyDays(1).create();
  var s1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1'); if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  var url = urlServicio_();
  aviso_('Instalación lista.\n\n' + (prop_('CODIGO_ADMIN') ? 'Código del primer administrador (un solo uso): ' + prop_('CODIGO_ADMIN') + '\nLo vuelves a ver en el menú Control de jornada.\n\n' : 'Ya existe un administrador.\n\n') +
    (url ? 'Ya está publicada. Usa el menú «2. Ver el enlace de mi empresa».' : 'Falta un paso: Extensiones → Apps Script → botón azul «Implementar» → «Nueva implementación» → tipo «Aplicación web» → Ejecutar como: Yo · Quién tiene acceso: Cualquier persona → Implementar.\nLuego vuelve aquí y usa el menú «2. Ver el enlace de mi empresa».'));
}
// getUrl() a veces entrega una implementación vieja o borrada: manda la que se comprobó que responde (URL_SERVICIO)
function urlServicio_() { var g = prop_('URL_SERVICIO'); if (g) return g; try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }
// ¿Responde esta URL como el servidor de Control de jornada, abierta por cualquier persona sin iniciar sesión?
function respondeServicio_(url) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url || '')) return { ok: false, por: 'formato' };
  try { var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true }), t = r.getContentText() || '';
    if (/Control de jornada/.test(t) && !/Panel de proveedor/.test(t)) return { ok: true };
    if (/Panel de proveedor/.test(t)) return { ok: false, por: 'panel' };
    if (r.getResponseCode() === 404 || /does not exist|no existe/i.test(t)) return { ok: false, por: 'borrada' };
    if (/accounts\.google|ServiceLogin|Sign in|Iniciar sesi/i.test(t)) return { ok: false, por: 'acceso' };
    return { ok: false, por: 'otro' };
  } catch (e) { return { ok: false, por: 'red' }; }
}
var POR_QUE_ = { formato: 'no es una URL de aplicación web (debe empezar por https://script.google.com/macros/s/ y terminar en /exec)', panel: 'es la URL del PANEL DE PROVEEDOR, no la de esta empresa', borrada: 'esa implementación está borrada o archivada', acceso: 'Google pide iniciar sesión: en la implementación cambia «Quién tiene acceso» a «Cualquier persona»', red: 'no se pudo probar (intenta de nuevo en un minuto)', otro: 'respondió algo distinto a Control de jornada' };
// Pide la URL de «Administrar implementaciones», la prueba y la guarda. Devuelve la URL buena o ''.
function pedirUrlServicio_(motivo) {
  var ui = SpreadsheetApp.getUi();
  for (var i = 0; i < 3; i++) {
    var r = ui.prompt('Enlace de esta empresa', (motivo ? motivo + '\n\n' : '') + 'En esta misma hoja: Extensiones → Apps Script → Implementar → Administrar implementaciones → copia la «URL de la aplicación web» de la implementación activa y pégala aquí.\n(Si no hay ninguna: Implementar → Nueva implementación → Aplicación web → Ejecutar como: Yo · Quién tiene acceso: Cualquier persona → Implementar.)', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return '';
    var u = r.getResponseText().trim(), p = respondeServicio_(u);
    if (p.ok) { prop_('URL_SERVICIO', u); return u; }
    motivo = 'Esa URL no sirve: ' + POR_QUE_[p.por] + '.';
  }
  return '';
}
// Menú «Revisar instalación»: prueba todo de verdad y deja el resultado en la pestaña «Revisión»
function revisarInstalacion() {
  var filas = [], bien = function (n, ok, arreglo) { filas.push([(ok ? '✅ ' : '❌ ') + n, ok ? '' : arreglo]); };
  var url = urlServicio_(), p = respondeServicio_(url);
  if (!p.ok) { var nueva = pedirUrlServicio_('El enlace guardado no responde (' + POR_QUE_[p.por] + ').'); if (nueva) { url = nueva; p = { ok: true }; } }
  bien('Servidor publicado y abierto a cualquier persona', p.ok, 'Implementar → Administrar implementaciones: debe haber una activa con «Ejecutar como: Yo» y «Quién tiene acceso: Cualquier persona». Después vuelve a usar «Revisar instalación».');
  var e = enlaceEmpresa_(); bien('Enlace para los celulares', !!e.enlace && p.ok, e.enlace ? 'Primero arregla el punto anterior.' : 'Falta la dirección de GitHub Pages: en Apps Script, archivo Proveedor.gs, llena app (o en la aplicación: Configuración → Dirección de la aplicación).');
  var app = (cfg_().urlApp || prov_('app') || '').replace(/[#?].*$/, ''), okApp = false;
  if (app) try { okApp = UrlFetchApp.fetch(app, { muteHttpExceptions: true }).getResponseCode() === 200; } catch (x) { }
  bien('Página de GitHub Pages en línea (' + (app || 'sin dirección') + ')', okApp, 'Revisa que la carpeta docs esté subida y que GitHub Pages esté activo (Settings → Pages → rama main, carpeta /docs).');
  var act = ScriptApp.getProjectTriggers().length; bien('Tareas automáticas instaladas (' + act + ')', act >= 3, 'Menú Control de jornada → 1. Instalar.');
  var adm = leer('Usuarios').some(function (u) { return u.rol === 'admin'; }); bien('Primer administrador registrado', adm, 'Abre el enlace de la empresa, toca «Soy el administrador» y usa el código de «Ver código del primer administrador».');
  // Se reporta al panel en este momento: la empresa aparece de inmediato en la consola del proveedor
  var panel = prov_('panel'), rep = null;
  if (panel) { try { rep = reportarAlPanel_(); } catch (x) { rep = { ok: false, mensaje: String(x.message || x) }; } }
  bien(panel ? 'Reportada al panel del proveedor' + (rep && rep.ok ? ' (' + rep.mensaje + ')' : '') : 'Panel del proveedor (no configurado: opcional)', !panel || (rep && rep.ok),
    rep && /NIT/.test(rep.mensaje) ? 'Falta el NIT: entra a la aplicación como administrador → Configuración → Empresa → escribe el NIT y guarda. Después vuelve a usar «Revisar instalación».'
      : (rep ? rep.mensaje + ' — Si dice que no responde, copia de nuevo el bloque de la pestaña «Proveedor.gs» de la hoja del panel en el archivo Proveedor.gs de esta empresa.' : ''));
  var ss = SpreadsheetApp.getActive(), h = ss.getSheetByName('Revisión') || ss.insertSheet('Revisión', 0);
  h.clear(); h.setColumnWidth(1, 430); h.setColumnWidth(2, 640);
  var todo = filas.every(function (f) { return f[0].charAt(0) === '✅'; });
  var cab = [[todo ? 'TODO ESTÁ BIEN. Enlace para los celulares:' : 'HAY COSAS POR ARREGLAR (columna B dice cómo):', ''], [e.enlace || '', ''], ['', ''], ['Revisión', 'Cómo arreglarlo']];
  h.getRange(1, 1, cab.length + filas.length, 2).setValues(cab.concat(filas)).setWrap(true).setVerticalAlignment('top');
  h.getRange(1, 1).setFontWeight('bold').setFontSize(13).setFontColor(todo ? '#1B7A3E' : '#B3261E'); h.getRange(4, 1, 1, 2).setFontWeight('bold');
  if (e.enlace) h.getRange(2, 1).setFormula('=HYPERLINK("' + e.enlace + '","' + e.enlace + '")');
  ss.setActiveSheet(h);
}
function enlaceEmpresa_() {
  var url = urlServicio_(), m = /\/s\/([A-Za-z0-9_-]{20,})\//.exec(url), app = (cfg_().urlApp || prov_('app') || '').replace(/[#?].*$/, '');
  return { url: url, id: m ? m[1] : '', enlace: m && app ? app + '#/c/' + m[1] : '' };
}
function verEnlace() {
  var p = respondeServicio_(urlServicio_());
  if (!p.ok && !pedirUrlServicio_('El enlace que tenía guardado no responde (' + POR_QUE_[p.por] + ').')) return;
  var e = enlaceEmpresa_();
  if (!e.url) return aviso_('Todavía no está publicada. Extensiones → Apps Script → «Implementar» → «Nueva implementación» → «Aplicación web» → Ejecutar como: Yo · Acceso: Cualquier persona → Implementar. Después vuelve a este menú.');
  // El enlace se escribe en la pestaña «Enlace» de la hoja: no depende de ventanas emergentes,
  // que algunos navegadores con bloqueadores (LibreWolf, Brave, Firefox estricto) no dejan abrir.
  var ss = SpreadsheetApp.getActive(), h = ss.getSheetByName('Enlace') || ss.insertSheet('Enlace', 0);
  h.clear(); h.setColumnWidth(1, 900);
  var filas = e.enlace ? [['Enlace de tu empresa (ábrelo, entra con tu cédula y el código del primer administrador, y compártelo con tu personal):'], [e.enlace], [''], ['Si no abre en tu navegador, ábrelo en Chrome, Edge o Safari, o desactiva el bloqueador de anuncios para esa página.']]
    : [['Falta la dirección de la página: en Apps Script, archivo Proveedor.gs, llena app con tu enlace de GitHub Pages. Mientras tanto, este es el código de conexión (pégalo en la página de la aplicación):'], [e.id]];
  h.getRange(1, 1, filas.length, 1).setValues(filas).setWrap(true);
  h.getRange(2, 1).setFontSize(13).setFontWeight('bold').setFontColor('#0E4A5A');
  if (e.enlace) h.getRange(2, 1).setFormula('=HYPERLINK("' + e.enlace + '","' + e.enlace + '")');
  ss.setActiveSheet(h); h.setActiveRange(h.getRange(2, 1));
  try { SpreadsheetApp.getUi().alert('Enlace de tu empresa', (e.enlace || e.id) + '\n\nTambién quedó en la pestaña «Enlace» de esta hoja.', SpreadsheetApp.getUi().ButtonSet.OK); } catch (x) { Logger.log(e.enlace || e.id); }
}
function verCodigoAdmin() { aviso_(prop_('CODIGO_ADMIN') ? 'Código del primer administrador: ' + prop_('CODIGO_ADMIN') : 'El código ya fue usado. Los nuevos administradores se crean desde el panel.'); }
function respaldarAhora() { aviso_(respaldar_()); }
function probarFuncionamiento() { aviso_(autoPrueba_().map(function (p) { return (p.ok ? '✔ ' : '✘ ') + p.nombre; }).join('\n')); }

function tarea_(nombre, fn) {
  _c = {}; _cfg = null;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return;
  _enBloqueo = true;
  try { fn(); } catch (e) { registrarError_('tarea:' + nombre, e); try { alertar_('error_sistema', '', 'Falló la tarea programada "' + nombre + '": ' + e.message); } catch (x) { } }
  finally { lock.releaseLock(); _enBloqueo = false; try { soltarCorreos_(); } catch (e) { } try { enviarTelegram_(); } catch (e) { } }
}
function unaVez_(clave, seg) { var c = CacheService.getScriptCache(); if (c.get(clave)) return false; c.put(clave, '1', seg || 21600); return true; }
function lista_(clave, fecha) { var v = json_(prop_(clave), {}); return v.f === fecha ? v : { f: fecha, l: [] }; }
function cubierto_(cedula, fecha, incs) {
  return incs.some(function (i) { return i.cedula === cedula && i.desde <= fecha && fecha <= i.hasta; }) || permisosAprobados_(cedula).some(function (p) { return p.desde <= fecha && fecha <= p.hasta && !p.horas; });
}

/** Cada 5 minutos: recordatorios de marcación por correo y vencimiento de permisos sin respuesta. */
function tareaCada5() { ponerAlDiaTrasActualizar_(); tarea_('cada5', function () {
  var a = ahora_(), c = cfg_(), ahoraMin = Motor.aMin(a.hora);
  leer('Permisos').forEach(function (p) {
    if (p.estado !== 'en_firmas' || +p.limite > a.ms) return;
    p.estado = 'vencido'; p.obs = 'Venció el plazo de ' + c.horasLimitePermiso + ' h sin todas las firmas.'; guardar('Permisos', p);
    alertar_('permiso_vencido', p.cedula, 'El permiso del ' + p.fechaSalida + ' venció sin todas las firmas. El administrador puede decidirlo desde el panel.');
    var u = buscar('Usuarios', 'cedula', p.cedula); if (u && u.email) correo_(u.email, 'Tu permiso no fue respondido a tiempo', 'Tu solicitud del ' + p.fechaSalida + ' venció sin respuesta. Comunícate con tu jefe o con el administrador.');
  });
  if (!c.recordatorioCorreo) return;
  try { if (MailApp.getRemainingDailyQuota() < 20) return; } catch (e) { }
  var marc = leer('Marcaciones', colaMarc_()), incs = leer('Incapacidades'), cs = {}; centros_().forEach(function (x) { cs[x.id] = x; });
  leer('Usuarios').forEach(function (u) {
    if (u.estado !== 'activo' || !u.email) return;
    var hor = horarioDe_(cs[u.centroId], a.fecha, u.cedula); if (!hor) return;
    var d = diasDe_(marc, u.cedula, a.fecha, a.fecha)[0] || {}, rec = +c.recordatorioMin || 5;
    [['entrada', hor.e, !d.entrada], ['sal_alm', hor.ai, d.entrada && !d.salAlm && !d.salida], ['ent_alm', hor.af, d.salAlm && !d.entAlm && !d.salida], ['salida', hor.s, d.entrada && !d.salida]].forEach(function (x) {
      if (!x[1] || !x[2]) return; var t = Motor.aMin(x[1]) + rec;
      if (ahoraMin < t || ahoraMin >= t + 10 || !unaVez_('rec:' + u.cedula + a.fecha + x[0])) return;
      if (x[0] === 'entrada' && cubierto_(u.cedula, a.fecha, incs)) return;
      correo_(u.email, 'Recuerda marcar: ' + NOMBRE_TIPO[x[0]], 'Hola ' + u.nombre.split(' ')[0] + ', aún no registras "' + NOMBRE_TIPO[x[0]] + '" de hoy (' + x[1] + ').\nAbre la aplicación y márcala: ' + c.urlApp);
    });
  });
}); }

/** Cada 15 minutos: personas que no se presentaron y jornadas que quedaron sin salida. */
function tareaCada15() { tarea_('cada15', function () {
  var a = ahora_(), c = cfg_(), ahoraMin = Motor.aMin(a.hora), marc = leer('Marcaciones', colaMarc_()), incs = leer('Incapacidades'), cs = {}; centros_().forEach(function (x) { cs[x.id] = x; });
  var aus = lista_('AVISO_AUSENCIA', a.fecha), inc = lista_('AVISO_INCOMPLETO', a.fecha), fat = lista_('AVISO_FATIGA', a.fecha), ayer = Motor.sumar(a.fecha, -1);
  leer('Usuarios').forEach(function (u) {
    if (u.estado !== 'activo') return;
    var hor = horarioDe_(cs[u.centroId], a.fecha, u.cedula), d = diasDe_(marc, u.cedula, ayer, a.fecha), hoy = null, prev = null;
    d.forEach(function (x) { if (x.fecha === a.fecha) hoy = x; else prev = x; });
    if (hor && !hoy && aus.l.indexOf(u.cedula) < 0 && ahoraMin >= Motor.aMin(hor.e) + (+c.minutosAusencia || 60) && !cubierto_(u.cedula, a.fecha, incs)) {
      aus.l.push(u.cedula); alertar_('ausencia', u.cedula, 'No ha registrado entrada hoy. Su horario empezaba a las ' + hor.e + (cs[u.centroId] ? ' en ' + cs[u.centroId].nombre : '') + ' y no tiene permiso ni incapacidad registrados.');
    }
    // Control de fatiga: jornada abierta que se acerca al máximo de horas continuas
    var ab = hoy && hoy.entrada && !hoy.salida ? hoy : (prev && prev.entrada && !prev.salida ? prev : null);
    if (ab && +c.fatigaHorasMax > 0 && fat.l.indexOf(u.cedula) < 0) {
      var tr = (isoMs_(a.iso) - isoMs_(ab.fecha + 'T' + ab.entrada)) / 60000;
      if (ab.salAlm && ab.entAlm) tr -= Math.max(0, Motor.aMin(ab.entAlm) - Motor.aMin(ab.salAlm));
      if (tr < 16 * 60 && tr >= c.fatigaHorasMax * 60 - (+c.fatigaAvisoMin || 0)) {
        fat.l.push(u.cedula);
        alertar_('fatiga', u.cedula, 'Lleva ' + (Math.round(tr / 6) / 10) + ' h de trabajo continuo desde las ' + ab.entrada + (cs[ab.centroId || u.centroId] ? ' en ' + cs[ab.centroId || u.centroId].nombre : '') + ' y sigue sin marcar salida. Límite configurado: ' + c.fatigaHorasMax + ' h. Verifique su estado y ordene el relevo o el descanso.');
        if (u.email) correo_(u.email, 'Llevas muchas horas de trabajo continuo', 'Hola ' + u.nombre.split(' ')[0] + ', llevas cerca de ' + c.fatigaHorasMax + ' horas de trabajo. Avisa a tu jefe, toma una pausa y, si ya terminaste, marca tu salida: ' + c.urlApp);
      }
    }
    if (prev && prev.entrada && !prev.salida && inc.l.indexOf(u.cedula) < 0 && isoMs_(a.iso) - isoMs_(prev.fecha + 'T' + prev.entrada) > 16 * 3600000) {
      inc.l.push(u.cedula); alertar_('incompleto', u.cedula, 'La jornada del ' + prev.fecha + ' quedó sin salida. Mientras no se complete, ese día no suma horas.');
      if (u.email) correo_(u.email, 'Te faltó marcar la salida de ayer', 'Tu jornada del ' + prev.fecha + ' quedó sin salida. Entra a la aplicación y usa "Se me olvidó marcar" para poner la hora en que saliste: ' + c.urlApp);
    }
  });
  prop_('AVISO_AUSENCIA', JSON.stringify(aus)); prop_('AVISO_INCOMPLETO', JSON.stringify(inc)); prop_('AVISO_FATIGA', JSON.stringify(fat));
  if (c.alertasAgrupadas && unaVez_('digest:' + a.iso.substr(0, 13), 3300)) enviarResumenAlertas_();
}); }

function enviarResumenAlertas_() {
  var pend = leer('Alertas').filter(function (x) { return x.estado === 'pendiente_resumen'; });
  if (!pend.length) return;
  var porCorreo = {}, nombres = {}, cuenta = {};
  pend.forEach(function (x) { var k = TIPOS_ALERTA[x.tipo] || x.tipo; cuenta[k] = (cuenta[k] || 0) + 1; });
  telegram_('Resumen de alertas: ' + Object.keys(cuenta).map(function (k) { return k + ' (' + cuenta[k] + ')'; }).join(', ') + '. Detalle en el panel, sección Sistema.');
  leer('Usuarios').forEach(function (u) { nombres[u.cedula] = u.nombre; });
  pend.forEach(function (x) {
    var dest = x.enviadoA || cfg_().correoAlertas; if (!dest) return;
    (porCorreo[dest] = porCorreo[dest] || []).push(x);
  });
  Object.keys(porCorreo).forEach(function (dest) {
    var lista = porCorreo[dest];
    var cuerpo = 'Resumen de ' + lista.length + ' alerta(s) reciente(s):\n\n' + lista.map(function (x) {
      return '• [' + x.fecha.replace('T', ' ') + '] ' + (TIPOS_ALERTA[x.tipo] || x.tipo) + (x.cedula ? ' — ' + (nombres[x.cedula] || x.cedula) : '') + ': ' + x.detalle;
    }).join('\n');
    var res = correo_(dest, 'Resumen de alertas (' + lista.length + ')', cuerpo);
    lista.forEach(function (x) { x.estado = res && res.indexOf('@') > 0 ? 'enviada' : 'registrada'; x.enviadoA = res || dest; guardar('Alertas', x); });
  });
}

/** Diaria (2:00 a. m.): retención de fotos y GPS, sesiones vencidas, resumen de extras y copia de seguridad. */
function tareaDiaria() {
  tareaProveedor_(); // reporte al panel, licencia y actualización: fuera del bloqueo general para no frenar marcaciones
  // Lo pesado (limpieza y archivo) va en bloqueos separados: entre uno y otro alcanzan a entrar las marcaciones
  tarea_('limpieza', function () { limpiarDatos_(); });
  tarea_('archivo', function () { if (cfg_().archivarMeses > 0) archivarHistorico_(); });
  tarea_('diaria', function () {
  var a = ahora_(), c = cfg_();
  // Enero: recordar actualizar el salario mínimo y el auxilio del año (decreto de diciembre)
  var an = +a.fecha.substr(0, 4); if (a.fecha.substr(5, 2) === '01' && an > 2026 && !prop_('AVISO_SMMLV_' + an) && legal_().smmlv === Motor.DEF.smmlv) {
    prop_('AVISO_SMMLV_' + an, '1'); avisarAdmins_('Actualiza el salario mínimo de ' + an, 'La nómina sigue con el salario mínimo y el auxilio de transporte de ' + (an - 1) + '. Escribe los de ' + an + ' en Configuración → Parámetros legales antes de cerrar la primera quincena.'); }
  leer('Sesiones').filter(function (s) { return +s.expira < a.ms; }).sort(function (x, y) { return y._f - x._f; }).forEach(function (s) { borrar('Sesiones', s); });
  var pend = leer('Extras').filter(function (x) { return x.estado === 'pendiente'; }).length;
  if (pend) alertar_('extras_pendientes', '', 'Hay ' + pend + ' registro(s) de horas extra esperando aprobación. Las horas extra sin aprobar no entran a la nómina.');
  // Contratos próximos a vencer (preaviso legal de 30 días en Colombia: avisa desde 35 días antes)
  leer('Usuarios').forEach(function (u) {
    var fin = String(u.finContrato || '').substr(0, 10);
    if (u.estado !== 'activo' || !/^\d{4}-\d\d-\d\d$/.test(fin)) return;
    var faltan = Motor.diasEntre(a.fecha, fin);
    if (faltan >= 0 && faltan <= 35 && unaVez_('vence:' + u.cedula + ':' + fin, 6 * 86400)) {
      alertar_('contrato_vencimiento', u.cedula, 'El contrato (' + (u.tipoContrato || 'término fijo') + ') vence el ' + fin + ' (en ' + faltan + ' día(s)). Recuerda el preaviso legal de 30 días.');
    }
  });
  // Cruce automático de presupuesto de obras del mes en curso (alerta al 80 % y 100 %)
  try {
    var iniMes = a.fecha.substr(0, 8) + '01', pres = a_adminPresupuestoObras({ desde: iniMes, hasta: a.fecha });
    pres.obras.forEach(function (o) {
      if (o.alerta === 'ok') return;
      if (unaVez_('pres:' + o.centroId + ':' + iniMes + ':' + o.alerta, 25 * 86400)) {
        alertar_('presupuesto_obra', '', 'La obra "' + o.centro + '" está en nivel ' + o.alerta.toUpperCase() + ' de presupuesto (horas: ' + (o.pctHoras || 0) + ' %, costo: ' + (o.pctCosto || 0) + ' %).');
      }
    });
  } catch (e) { }
  var ult = prop_('ULTIMO_RESPALDO');
  if (c.respaldoCadaDias > 0 && (!ult || Motor.diasEntre(ult.substr(0, 10), a.fecha) >= c.respaldoCadaDias)) respaldar_();
}); }

/** Política de retención automática: no depende de que alguien abra el panel. */
function limpiarDatos_() {
  var a = ahora_(), c = cfg_(), h = hoja_('Marcaciones'), cols = HOJAS.Marcaciones, n = h.getLastRow() - 1; if (n < 1) return;
  var limFoto = Motor.sumar(a.fecha, -c.retencionFotosDias), limGps = Motor.sumar(a.fecha, -c.retencionGpsDias);
  var iF = cols.indexOf('fecha'), iFo = cols.indexOf('foto'), iLa = cols.indexOf('lat'), iLn = cols.indexOf('lng'), iPr = cols.indexOf('prec');
  var v = h.getRange(2, 1, n, cols.length).getValues(), cambios = 0, borradas = 0, pri = -1, ult = -1;
  for (var i = 0; i < v.length && borradas < 400; i++) {
    var f = String(v[i][iF]), toca = false;
    if (v[i][iFo] && f < limFoto) { try { DriveApp.getFileById(String(v[i][iFo])).setTrashed(true); } catch (e) { } v[i][iFo] = ''; cambios++; borradas++; toca = true; }
    if (v[i][iLa] !== '' && f < limGps) { v[i][iLa] = ''; v[i][iLn] = ''; v[i][iPr] = ''; cambios++; toca = true; }
    if (toca) { if (pri < 0) pri = i; ult = i; }
  }
  // Solo se reescriben las columnas que cambian (foto y GPS) y solo en las filas tocadas: más rápido y sin pisar lo demás
  if (cambios) {
    var tramo = v.slice(pri, ult + 1);
    h.getRange(2 + pri, iFo + 1, tramo.length, 1).setValues(tramo.map(function (r) { return [r[iFo]]; }));
    if (iLn === iLa + 1 && iPr === iLa + 2) h.getRange(2 + pri, iLa + 1, tramo.length, 3).setValues(tramo.map(function (r) { return [r[iLa], r[iLn], r[iPr]]; }));
    else [iLa, iLn, iPr].forEach(function (k) { h.getRange(2 + pri, k + 1, tramo.length, 1).setValues(tramo.map(function (r) { return [r[k]]; })); });
    sucio_('Marcaciones');
  }
  ['Alertas', 'Errores'].forEach(function (nh) { // las bitácoras con datos personales también caducan
    var hh = hoja_(nh), k = hh.getLastRow() - 1; if (k < 1) return; var vv = hh.getRange(2, 1, k, 1).getValues(), q = 0;
    while (q < vv.length && String(vv[q][0]).substr(0, 10) < limGps) q++; if (q) { hh.deleteRows(2, q); sucio_(nh); } });
  // Retención de soportes de permisos e incapacidades
  var limSop = Motor.sumar(a.fecha, -(c.retencionSoportesDias || 365)), sopBorrados = 0;
  [['Permisos', 'fechaRegreso'], ['Incapacidades', 'hasta']].forEach(function (par) {
    leer(par[0]).forEach(function (r) {
      if (r.soporte && r[par[1]] && String(r[par[1]]).substr(0, 10) < limSop && sopBorrados < 200) {
        try { DriveApp.getFileById(String(r.soporte)).setTrashed(true); } catch (e) { }
        r.soporte = ''; guardar(par[0], r); sopBorrados++;
      }
    });
  });
  prop_('ULTIMA_LIMPIEZA', a.iso + ' · ' + borradas + ' foto(s), ' + sopBorrados + ' soporte(s) eliminado(s)');
}

/** Archiva marcaciones antiguas de periodos ya cerrados para mantener ágil la hoja activa. */
function archivarHistorico_() {
  var a = ahora_(), c = cfg_(), meses = +c.archivarMeses || 12;
  var lim = Motor.sumar(a.fecha, -meses * 30), h = hoja_('Marcaciones'), cols = HOJAS.Marcaciones, n = h.getLastRow() - 1;
  if (n < 500) return; // solo archiva cuando ya hay volumen relevante
  var iF = cols.indexOf('fecha'), v = h.getRange(2, 1, n, cols.length).getValues(), mover = [], conservar = [];
  for (var i = 0; i < v.length; i++) {
    var f = String(v[i][iF]).substr(0, 10);
    if (f && f < lim && periodoCerrado_(f)) mover.push(v[i]); else conservar.push(v[i]);
  }
  // Al histórico solo pasa lo que sirve como soporte de nómina: sin ubicación ni foto (minimización, Ley 1581 art. 4)
  ['lat', 'lng', 'prec', 'dist', 'foto'].forEach(function (k) { var ix = cols.indexOf(k); mover.forEach(function (r) { r[ix] = ''; }); });
  var iM = cols.indexOf('motivo'); mover.forEach(function (r) { if (r[iM]) r[iM] = '[motivo no archivado]'; }); // texto libre: puede tener datos de salud
  if (mover.length < 100) return;
  try {
    if (!prop_('CARPETA_HISTORICO')) { var pr = DriveApp.getFileById(ss_().getId()).getParents(), pd = pr.hasNext() ? pr.next() : DriveApp.getRootFolder(); prop_('CARPETA_HISTORICO', pd.createFolder('Control de jornada - Histórico (no borrar)').getId()); }
    var carpeta = DriveApp.getFolderById(prop_('CARPETA_HISTORICO')); // fuera de la carpeta de respaldos: la rotación de copias no lo toca
    var nombre = 'Histórico Marcaciones ' + a.fecha.substr(0, 4) + ' - ' + c.empresa.nombre;
    var it = carpeta.getFilesByName(nombre), existe = it.hasNext(), archSs = existe ? SpreadsheetApp.openById(it.next().getId()) : SpreadsheetApp.create(nombre);
    if (!existe) { try { DriveApp.getFileById(archSs.getId()).moveTo(carpeta); } catch (e) { } }
    var ah = archSs.getSheetByName('Marcaciones') || archSs.insertSheet('Marcaciones');
    if (ah.getLastRow() === 0) ah.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    ah.getRange(ah.getLastRow() + 1, 1, mover.length, cols.length).setValues(mover);
    h.getRange(2, 1, n, cols.length).clearContent();
    if (conservar.length) h.getRange(2, 1, conservar.length, cols.length).setValues(conservar);
    sucio_('Marcaciones');
    auditar_('sistema', 'archivar_historico', { archivadas: mover.length, archivo: nombre });
  } catch (e) { registrarError_('archivar_historico', e); }
}

/** Copia completa de la hoja de cálculo a la carpeta de respaldos. Conserva las últimas N. */
function respaldar_() {
  var a = ahora_(), c = cfg_(), msg;
  try {
    var carpeta = DriveApp.getFolderById(prop_('CARPETA_RESPALDOS'));
    DriveApp.getFileById(ss_().getId()).makeCopy('Respaldo ' + a.iso.replace('T', ' ').replace(':', 'h') + ' - ' + c.empresa.nombre, carpeta);
    var arch = [], it = carpeta.getFiles(); while (it.hasNext()) arch.push(it.next());
    arch.sort(function (x, y) { return y.getDateCreated() - x.getDateCreated(); }).slice(Math.max(1, c.respaldoConservar)).forEach(function (f) { f.setTrashed(true); });
    prop_('ULTIMO_RESPALDO', a.iso); msg = 'Copia de seguridad creada el ' + a.iso.replace('T', ' ') + '. Se conservan las últimas ' + c.respaldoConservar + '.';
  } catch (e) { msg = 'La copia de seguridad FALLÓ: ' + e.message; registrarError_('respaldo', e); }
  alertar_('respaldo', '', msg); return msg;
}
