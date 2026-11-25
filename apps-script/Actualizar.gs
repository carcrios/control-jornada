/**
 * CONTROL DE JORNADA — Actualización automática y conexión con el panel del proveedor.
 *
 * Actualización: cada noche (y con «Actualizar ahora») se revisa la versión publicada en la página del proveedor
 * (Proveedor.gs → app + 'actualizacion/version.json'). Solo se instala si:
 *   - la huella sha256 del código coincide con la que el proveedor APROBÓ en su panel (otro canal, otra cuenta);
 *     sin panel, solo se actualiza a mano y con huella;
 *   - el manifiesto nuevo no cambia quién ejecuta ni quién accede a la aplicación web;
 *   - no hay permisos nuevos de Google (si los hay, solo desde el menú de la hoja, por el dueño).
 * Pasos: reemplazar el código (conservando Proveedor.gs) → crear versión → apuntar la(s) implementación(es) web.
 * Si un paso falla, la noche siguiente se reintenta lo que falta (no se queda a medias).
 * Requisito una vez por cuenta: https://script.google.com/home/usersettings → «API de Google Apps Script».
 */
var API_SCRIPT = 'https://script.googleapis.com/v1/projects/';

function compararVersion_(a, b) {
  var x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (var i = 0; i < 3; i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}
// SOLO la dirección que puso el proveedor en Proveedor.gs: nunca un dato editable desde la aplicación
function baseActualizacion_() {
  var app = (prov_('app') || '').replace(/[#?].*$/, '');
  if (!/^https:\/\//.test(app)) return '';
  return app.replace(/\/?$/, '/') + 'actualizacion/';
}
function bajar_(url) {
  var r = UrlFetchApp.fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
  if (r.getResponseCode() !== 200) throw new Error('No se pudo descargar ' + url + ' (código ' + r.getResponseCode() + ').');
  return r.getContentText('UTF-8');
}
function huella_(t) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function apiScript_(metodo, ruta, cuerpo) {
  var o = { method: metodo, muteHttpExceptions: true, contentType: 'application/json', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  if (cuerpo) o.payload = JSON.stringify(cuerpo);
  var r = UrlFetchApp.fetch(API_SCRIPT + ScriptApp.getScriptId() + ruta, o), cod = r.getResponseCode(), t = r.getContentText();
  if (cod >= 200 && cod < 300) return t ? JSON.parse(t) : {};
  if (cod === 403 && /has not been used|is disabled|SERVICE_DISABLED|has not enabled the Apps Script API/i.test(t))
    throw E_('API_DESACTIVADA', 'Falta un permiso de una sola vez: abre https://script.google.com/home/usersettings con la cuenta dueña de esta hoja y activa «API de Google Apps Script». Si es una cuenta de empresa (Workspace), puede que su administrador lo tenga bloqueado.');
  if (/version/i.test(ruta) && /limit|maximum|200/i.test(t))
    throw E_('LIMITE_VERSIONES', 'Este proyecto llegó al límite de 200 versiones de Google. Abre Extensiones → Apps Script → Administrar implementaciones → Versiones archivadas, o pide ayuda a tu proveedor.');
  if (cod === 403 || cod === 401) throw E_('PERMISO', 'Google no dejó cambiar el código (' + cod + '). El dueño de la hoja debe abrirla → menú Control de jornada → Actualizar ahora, y aceptar los permisos.');
  throw new Error('La API de Apps Script respondió ' + cod + ': ' + t.substr(0, 300));
}
function armarProveedor_(fuentes) {
  var viejo = fuentes.join('\n'), toma = function (re) { var m = re.exec(viejo); return m ? m[1] : ''; };
  var app = toma(/var APP_PREDETERMINADA = '([^']*)'/) || prov_('app'), clave = toma(/var CLAVE_LICENCIA_PROVEEDOR = '([^']*)'/) || prov_('clave'), panel = prov_('panel');
  return '// Datos del proveedor. La actualización automática NUNCA cambia este archivo.\n' +
    '// app: dirección de la página (GitHub Pages) · clave: clave para firmar licencias · panel: enlace del panel del proveedor\n' +
    'var PROVEEDOR = {\n  app: ' + JSON.stringify(app) + ',\n  clave: ' + JSON.stringify(clave) + ',\n  panel: ' + JSON.stringify(panel) + '\n};\n';
}
function permisosNuevos_(manifViejo, manifNuevo) {
  var v = {}, n = {}; try { v = JSON.parse(manifViejo || '{}'); } catch (e) { } try { n = JSON.parse(manifNuevo || '{}'); } catch (e) { return ['(manifiesto ilegible)']; }
  if (!Array.isArray(n.oauthScopes) || !n.oauthScopes.length) return ['(el manifiesto nuevo no declara permisos)'];
  return n.oauthScopes.filter(function (s) { return (v.oauthScopes || []).indexOf(s) < 0; });
}
// El manifiesto nuevo no puede cambiar quién ejecuta ni quién entra a la aplicación web
function manifiestoSeguro_(manifViejo, manifNuevo) {
  var v = {}, n = {}; try { v = JSON.parse(manifViejo || '{}'); n = JSON.parse(manifNuevo || '{}'); } catch (e) { return false; }
  var w1 = v.webapp || {}, w2 = n.webapp || {};
  if (v.webapp && (w1.executeAs !== w2.executeAs || w1.access !== w2.access)) return false;
  if (!v.webapp && n.webapp && (w2.executeAs !== 'USER_DEPLOYING' || w2.access !== 'ANYONE_ANONYMOUS')) return false;
  return true;
}
function dueno_() { try { return DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId()).getOwner().getEmail(); } catch (e) { return ''; } }

/* Implementaciones web del proyecto (todas las de tipo aplicación web con versión fija) */
function implementacionesWeb_() {
  var r = apiScript_('get', '/deployments'), l = r.deployments || [];
  return l.filter(function (d) { return d.deploymentConfig && d.deploymentConfig.versionNumber && (d.entryPoints || []).some(function (e) { return e.entryPointType === 'WEB_APP'; }); });
}
function desplegar_(version) {
  var num = +prop_('ACT_VERSION_NUM_' + version);
  if (!num) { num = apiScript_('post', '/versions', { description: 'Control de jornada ' + version }).versionNumber; prop_('ACT_VERSION_NUM_' + version, num); }
  var deps = implementacionesWeb_();
  if (!deps.length) throw new Error('No se encontró la aplicación web publicada (Implementar → Nueva implementación → Aplicación web).');
  deps.forEach(function (d) {
    if (+d.deploymentConfig.versionNumber === num) return;
    apiScript_('put', '/deployments/' + d.deploymentId, { deploymentConfig: { scriptId: ScriptApp.getScriptId(), versionNumber: num, manifestFileName: 'appsscript', description: 'Control de jornada ' + version } });
  });
  prop_('ACT_DESPLEGADA', version); prop_('ACT_ERROR', null);
  return num;
}

/* Revisa y, si corresponde, actualiza. modo: 'noche' | 'hoja' (menú, por el dueño) | 'web' (panel de la empresa). */
function actualizar_(modo) {
  if (modo === true) modo = 'hoja'; if (modo === false || !modo) modo = 'noche';
  var lock = LockService.getDocumentLock && LockService.getDocumentLock();
  if (lock && !lock.tryLock(0)) return { ok: false, mensaje: 'Ya se está actualizando. Espera unos minutos.' };
  try {
    var base = baseActualizacion_();
    if (!base) return { ok: false, mensaje: 'Falta la dirección de la página en Proveedor.gs (app).' };
    // ¿Quedó a medias una actualización anterior? (el código ya es nuevo pero la aplicación web no)
    if (prop_('ACT_DESPLEGADA') !== VERSION && prop_('ACT_OBJETIVO') === VERSION) {
      desplegar_(VERSION); return { ok: true, version: VERSION, mensaje: 'Se terminó de aplicar la versión ' + VERSION + '.' };
    }
    var info = JSON.parse(bajar_(base + 'version.json'));
    prop_('ACT_REVISADA', ahora_().iso); prop_('ACT_DISPONIBLE', info.version || '');
    if (compararVersion_(info.version, VERSION) <= 0) return { ok: true, sinCambios: true, version: VERSION, mensaje: 'Ya tienes la última versión (' + VERSION + ').' };
    // Huella aprobada por el proveedor en su panel (otro canal). Sin panel: solo a mano.
    var aprob = {}; try { aprob = JSON.parse(prop_('ACT_APROBADA') || '{}'); } catch (e) { }
    if (prov_('panel')) {
      if (aprob.version !== info.version) return { ok: false, mensaje: 'La versión ' + info.version + ' todavía no está aprobada por tu proveedor. Se instalará cuando la apruebe.' };
    } else if (modo === 'noche') return { ok: false, mensaje: 'Hay una versión nueva (' + info.version + '). Sin panel del proveedor, se instala solo a mano.' };
    if (!info.sha256) throw new Error('La versión publicada no trae su huella: no se instala.');
    var codigo = bajar_(base + 'ControlJornada.gs'), manifiesto = bajar_(base + 'appsscript.json'), h = huella_(codigo);
    if (h !== info.sha256) throw new Error('El código descargado no coincide con su huella (incompleto o alterado). No se instaló.');
    if (prov_('panel') && h !== aprob.sha256) throw new Error('El código publicado no es el que aprobó tu proveedor. No se instaló; avisa a tu proveedor.');
    var actual = apiScript_('get', '/content'), archivos = actual.files || [];
    var prov = archivos.filter(function (f) { return f.name === 'Proveedor'; })[0];
    var manifViejo = (archivos.filter(function (f) { return f.type === 'JSON'; })[0] || {}).source;
    if (!manifiestoSeguro_(manifViejo, manifiesto)) throw new Error('La versión nueva cambia quién puede usar la aplicación web. No se instaló; avisa a tu proveedor.');
    var nuevos = permisosNuevos_(manifViejo, manifiesto);
    if (nuevos.length && modo !== 'hoja') {
      if (modo === 'noche') avisarAdmins_('Hay una actualización que necesita tu permiso', 'La versión ' + info.version + ' de Control de jornada necesita permisos nuevos de Google.\nEl DUEÑO de la hoja de cálculo debe abrirla → menú Control de jornada → «Actualizar ahora» y aceptar los permisos.\n\nNovedades:\n' + (info.notas || ''));
      return { ok: false, mensaje: 'Esta versión necesita permisos nuevos: el dueño de la hoja debe actualizar desde el menú Control de jornada → Actualizar ahora.' };
    }
    var otros = archivos.filter(function (f) { return f.type === 'HTML'; }).map(function (f) { return { name: f.name, type: f.type, source: f.source }; });
    prop_('ACT_OBJETIVO', info.version); prop_('ACT_ANTERIOR', VERSION);
    apiScript_('put', '/content', { files: [{ name: 'appsscript', type: 'JSON', source: manifiesto },
      { name: 'Proveedor', type: 'SERVER_JS', source: prov ? prov.source : armarProveedor_(archivos.filter(function (f) { return f.type === 'SERVER_JS'; }).map(function (f) { return f.source; })) },
      { name: 'ControlJornada', type: 'SERVER_JS', source: codigo }].concat(otros) });
    prop_('ACT_PENDIENTE_INSTALAR', info.version); prop_('ACT_ULTIMA', JSON.stringify({ de: VERSION, a: info.version, fecha: ahora_().iso }));
    if (nuevos.length) return { ok: true, version: info.version, mensaje: 'Código actualizado a la ' + info.version + '. Ahora vuelve a tocar «Actualizar ahora» en este menú y acepta los permisos que pida Google para terminar.' };
    desplegar_(info.version);
    avisarAdmins_('Control de jornada se actualizó a la versión ' + info.version, 'Se actualizó de la versión ' + VERSION + ' a la ' + info.version + '. El enlace no cambia y nadie tiene que hacer nada.\n\nNovedades:\n' + (info.notas || '—'));
    return { ok: true, version: info.version, mensaje: 'Actualizado a la versión ' + info.version + '.' };
  } finally { if (lock) lock.releaseLock(); }
}
// La primera ejecución del código nuevo pone al día las hojas y las tareas; si faltaba desplegar, lo termina
function ponerAlDiaTrasActualizar_() {
  var p = prop_('ACT_PENDIENTE_INSTALAR'); if (!p || compararVersion_(VERSION, p) < 0) return;
  prop_('ACT_PENDIENTE_INSTALAR', null);
  try { instalar(); } catch (e) { registrarError_('ponerAlDia', e); }
  if (prop_('ACT_DESPLEGADA') !== VERSION) { try { desplegar_(VERSION); } catch (e) { registrarError_('desplegar', e); prop_('ACT_ERROR', String(e.message || e).substr(0, 300)); } }
}
// Volver a la versión anterior: apunta la aplicación web a la versión guardada antes de actualizar
function volverVersionAnterior_() {
  var ant = prop_('ACT_ANTERIOR'), num = +prop_('ACT_VERSION_NUM_' + ant);
  if (!ant || !num) throw E_('DATOS', 'No hay una versión anterior guardada para volver.');
  implementacionesWeb_().forEach(function (d) { apiScript_('put', '/deployments/' + d.deploymentId, { deploymentConfig: { scriptId: ScriptApp.getScriptId(), versionNumber: num, manifestFileName: 'appsscript', description: 'Control de jornada ' + ant + ' (vuelta atrás)' } }); });
  cfgSet_('actualizarSolo', false);
  return { ok: true, mensaje: 'La aplicación volvió a la versión ' + ant + '. La actualización automática quedó apagada hasta que la vuelvas a activar.' };
}
function avisarAdmins_(asunto, cuerpo) {
  leer('Usuarios').filter(function (u) { return u.rol === 'admin' && u.email && u.estado !== 'inactivo'; }).forEach(function (u) { try { correo_(u.email, asunto, cuerpo); } catch (e) { } });
}

/* Menú de la hoja: solo el dueño (los permisos y la implementación son suyos) */
function actualizarAhora() {
  try {
    var yo = ''; try { yo = Session.getEffectiveUser().getEmail(); } catch (e) { }
    var du = dueno_(); if (du && yo && du !== yo) return aviso_('Solo el dueño de la hoja (' + du + ') puede actualizar desde aquí.');
    if (prov_('panel')) try { reportarAlPanel_(); } catch (e) { }
    var r = actualizar_('hoja'); aviso_(r.mensaje);
  } catch (e) { prop_('ACT_ERROR', String(e.message || e).substr(0, 300)); aviso_(e.message || String(e)); }
}

/* Panel del proveedor: reporte diario mínimo (NIT, versión, personas), licencia y versión aprobada */
function secretoInstalacion_() { var s = prop_('SECRETO_PANEL'); if (!s) { s = azar_() + azar_(); prop_('SECRETO_PANEL', s); } return s; }
function reportarAlPanel_() {
  var url = prov_('panel'), c = cfg_(); if (!url) return { ok: false, mensaje: 'Esta instalación no tiene panel de proveedor.' };
  if (c.reportarProveedor === false) return { ok: false, mensaje: 'El reporte al proveedor está apagado en Configuración.' };
  var datos = { nit: soloDigitos_(c.empresa.nit || ''), empresa: String(c.empresa.nombre || '').substr(0, 120), version: VERSION,
    personas: leer('Usuarios').filter(function (u) { return u.estado === 'activo'; }).length, contacto: String(c.contactoProveedor || '').substr(0, 120), ts: ahora_().iso };
  if (!datos.nit) return { ok: false, mensaje: 'Primero escribe el NIT de la empresa en Configuración → Empresa.' };
  var cuerpo = JSON.stringify(datos), sec = secretoInstalacion_();
  // El primer reporte registra el secreto de esta instalación; después cada reporte va firmado con él
  var env = { datos: cuerpo, firma: hex_(Utilities.computeHmacSha256Signature(cuerpo, sec)), registro: prop_('PANEL_REGISTRADO') ? '' : sec };
  var r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'text/plain;charset=utf-8', payload: JSON.stringify(env), muteHttpExceptions: true, followRedirects: true });
  var resp = {}; try { resp = JSON.parse(r.getContentText()); } catch (x) { return { ok: false, mensaje: 'El panel del proveedor no respondió bien.' }; }
  if (resp.registrado) prop_('PANEL_REGISTRADO', '1');
  if (resp.error) return { ok: false, mensaje: resp.error };
  prop_('PANEL_CONTACTO', ahora_().iso);
  if (resp.aprobada && resp.aprobada.version && /^[0-9a-f]{64}$/.test(resp.aprobada.sha256 || '')) prop_('ACT_APROBADA', JSON.stringify({ version: String(resp.aprobada.version), sha256: resp.aprobada.sha256 }));
  if (resp.llave && resp.llave !== prop_('LICENCIA')) {
    var prev = prop_('LICENCIA'), prevNit = prop_('LIC_NIT'), antes = licenciaEfectiva_();
    prop_('LIC_NIT', c.empresa.nit || ''); prop_('LICENCIA', resp.llave);
    var lic = licenciaEfectiva_();
    if (lic.motivo) { prop_('LICENCIA', prev || null); prop_('LIC_NIT', prevNit || null); return { ok: false, mensaje: lic.motivo }; }
    var igual = antes.plan === lic.plan && antes.vence === lic.vence && antes.maxUsuarios === lic.maxUsuarios && antes.modulos.join() === lic.modulos.join();
    if (!igual) auditar_('', 'licencia_recibida_del_panel', { plan: lic.plan, vence: lic.vence, modulos: lic.modulos.join(',') });
    return { ok: true, cambio: !igual, licencia: lic, mensaje: igual ? 'La licencia ya estaba al día.' : 'Licencia actualizada: plan ' + lic.plan + ', vence ' + (lic.vence || '—') + '.' };
  }
  return { ok: true, cambio: false, mensaje: resp.llave ? 'La licencia ya estaba al día.' : (resp.mensaje || 'El proveedor todavía no tiene una licencia para este NIT.') };
}

/* Tarea nocturna (fuera del bloqueo general: no frena las marcaciones) */
function tareaProveedor_() {
  try { reportarAlPanel_(); } catch (e) { registrarError_('panelProveedor', e); }
  var c = cfg_(); if (c.actualizarSolo === false) return;
  if (enCierreDeNomina_()) return; // no se cambia de versión entre el corte y el cierre de la nómina
  try { var r = actualizar_('noche'); if (r && r.ok === false && r.mensaje) prop_('ACT_ERROR', r.mensaje.substr(0, 300)); } catch (e) { registrarError_('actualizacion', e); prop_('ACT_ERROR', String(e.message || e).substr(0, 300)); }
}
// Del corte del periodo hasta 5 días después, si todavía no se cerró, no se actualiza solo
function enCierreDeNomina_() {
  try {
    var hoy = ahora_().fecha, p = Motor.periodoDe(Motor.sumar(hoy, -5), cfg_().periodoNomina);
    if (!p || !p.hasta) return false;
    return hoy > p.hasta && hoy <= Motor.sumar(p.hasta, 5) && !periodoCerrado_(p.hasta);
  } catch (e) { return false; }
}

/* Acciones del panel de la empresa (Configuración → Licencia y versión) */
function a_adminVersion(d, adm) {
  var ult = {}; try { ult = JSON.parse(prop_('ACT_ULTIMA') || '{}'); } catch (e) { }
  var c = cfg_();
  return { version: VERSION, disponible: prop_('ACT_DISPONIBLE') || '', revisada: prop_('ACT_REVISADA') || '', ultima: ult, error: prop_('ACT_ERROR') || '',
    automatica: c.actualizarSolo !== false, reportar: c.reportarProveedor !== false, conPagina: !!baseActualizacion_(), conPanel: !!prov_('panel'), panelContacto: prop_('PANEL_CONTACTO') || '',
    anterior: prop_('ACT_ANTERIOR') && +prop_('ACT_VERSION_NUM_' + prop_('ACT_ANTERIOR')) ? prop_('ACT_ANTERIOR') : '' };
}
function a_adminActualizar(d, adm) {
  if (d.automatica !== undefined) { cfgSet_('actualizarSolo', !!d.automatica); auditar_(adm.cedula, 'actualizacion_automatica', { activa: !!d.automatica }); return a_adminVersion(d, adm); }
  if (d.reportar !== undefined) { cfgSet_('reportarProveedor', !!d.reportar); auditar_(adm.cedula, 'reporte_proveedor', { activo: !!d.reportar }); return a_adminVersion(d, adm); }
  if (d.volver) { var v = volverVersionAnterior_(); auditar_(adm.cedula, 'volver_version', { a: prop_('ACT_ANTERIOR') }); return v; }
  if (prov_('panel')) try { reportarAlPanel_(); } catch (e) { }
  var r = actualizar_('web'); auditar_(adm.cedula, 'actualizar_ahora', { resultado: r.mensaje }); return r;
}
function a_adminLicenciaSincronizar(d, adm) { var r = reportarAlPanel_(); if (!r.ok) throw E_('DATOS', r.mensaje); return r; }
