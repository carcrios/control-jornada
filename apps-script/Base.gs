/**
 * CONTROL DE JORNADA — Backend en Google Apps Script sobre Google Sheets.
 * Base: acceso a datos, seguridad, configuración y enrutador de la API.
 * Una hoja de cálculo = una empresa. Nada de la empresa está escrito en el código: todo vive en la hoja Config.
 */
var VERSION = '1.8.0';
// Datos del proveedor (dirección de la página, clave de licencias y panel): viven en el archivo Proveedor.gs
// (var PROVEEDOR = { app, clave, panel }), que la actualización automática nunca toca.
function prov_(k) { try { return (typeof PROVEEDOR !== 'undefined' && PROVEEDOR && PROVEEDOR[k]) ? String(PROVEEDOR[k]) : ''; } catch (e) { return ''; } }
var PLANES = {
  basico: { maxUsuarios: 25, modulos: ['asistencia'] },
  profesional: { maxUsuarios: 80, modulos: ['asistencia', 'nomina', 'permisos', 'turnos', 'prestamos', 'autoservicio'] },
  empresa: { maxUsuarios: 150, modulos: ['asistencia', 'nomina', 'permisos', 'turnos', 'prestamos', 'autoservicio', 'kiosco', 'qr', 'presupuesto', 'tablero360', 'seguridadPro'] }
};
var _AHORA = null; // solo para pruebas

var HOJAS = {
  Config: ['clave', 'valor'],
  Usuarios: ['cedula', 'nombre', 'cargo', 'rol', 'centroId', 'salario', 'salarioOk', 'tipoPago', 'email', 'telefono', 'ingreso', 'eps', 'arl', 'estado', 'hash', 'salt', 'codigo', 'consVersion', 'consFecha', 'creado', 'supCentros', 'banco', 'tipoCuenta', 'cuenta', 'retiro', 'dispositivoId', 'fotoRef', 'tipoContrato', 'finContrato', 'liquidado', 'supervisor'],
  Sesiones: ['hash', 'cedula', 'creado', 'expira', 'equipo'],
  Centros: ['id', 'nombre', 'cliente', 'direccion', 'lat', 'lng', 'radio', 'horario', 'tol', 'festivos', 'activo', 'poligono', 'exigirQr', 'presupuestoHoras', 'presupuestoCosto', 'arlPct'],
  Jefes: ['id', 'nombre', 'cargo', 'email', 'whatsapp', 'pin', 'centros', 'activo'],
  Marcaciones: ['id', 'cedula', 'fecha', 'tipo', 'hora', 'servidor', 'lat', 'lng', 'prec', 'dist', 'enZona', 'centroId', 'foto', 'fotoExigida', 'manual', 'motivo', 'estado', 'horario', 'origen', 'editadoPor'],
  Permisos: ['id', 'cedula', 'tipo', 'cat', 'remunerado', 'fechaSalida', 'horaSalida', 'fechaRegreso', 'horaRegreso', 'motivo', 'soporte', 'estado', 'creado', 'limite', 'firmas', 'decididoPor', 'decididoEl', 'obs', 'salidaReal', 'regresoReal', 'gpsSalida', 'gpsRegreso'],
  Incapacidades: ['id', 'cedula', 'tipo', 'desde', 'hasta', 'entidad', 'nota', 'soporte', 'registradoPor', 'creado'],
  Extras: ['id', 'cedula', 'fecha', 'minCalc', 'minAprob', 'estado', 'decididoPor', 'decididoEl', 'obs'],
  Nomina: ['id', 'desde', 'hasta', 'cedula', 'nombre', 'neto', 'detalle', 'generado', 'acuse'],
  Periodos: ['desde', 'hasta', 'cerradoPor', 'cerradoEl'],
  Novedades: ['id', 'cedula', 'fecha', 'concepto', 'valor', 'salarial', 'nota', 'creadoPor', 'creado'],
  Turnos: ['id', 'nombre', 'e', 's', 'ai', 'af', 'dias', 'activo'],
  Programacion: ['id', 'cedula', 'desde', 'hasta', 'turnoId', 'creadoPor', 'creado'],
  Alertas: ['fecha', 'tipo', 'cedula', 'detalle', 'enviadoA', 'estado'],
  Auditoria: ['fecha', 'actor', 'accion', 'detalle', 'hash'],
  Errores: ['fecha', 'cedula', 'origen', 'mensaje', 'detalle', 'equipo', 'version'],
  Prestamos: ['id', 'cedula', 'concepto', 'monto', 'cuotas', 'cuotaValor', 'pagadas', 'saldo', 'estado', 'creadoPor', 'creado', 'autorizacion', 'ultimoPeriodo'],
  Compensatorios: ['id', 'cedula', 'fecha', 'minutos', 'tipo', 'motivo', 'creadoPor', 'creado', 'soporte'],
  Comunicados: ['id', 'titulo', 'cuerpo', 'centros', 'creadoPor', 'creado', 'leidos', 'cedulas'],
  Certificados: ['codigo', 'cedula', 'fecha', 'nombre', 'cargo', 'ingreso', 'retiro', 'tipoContrato', 'salario', 'estado', 'emitidoPor', 'creado', 'tipoPago'],
  Revisiones: ['id', 'cedula', 'fecha', 'estado', 'nota', 'revisadoPor', 'revisadoEl', 'horasMin'],
  PagosPrestaciones: ['id', 'tipo', 'periodo', 'cedula', 'dias', 'base', 'valor', 'registrado', 'por'],
  Consultas: ['id', 'cedula', 'tema', 'fecha', 'texto', 'estado', 'creado', 'respuesta', 'respondidoPor', 'respondidoEl'],
  Accesos: ['id', 'cedula', 'secreto', 'pin', 'modo', 'intentos', 'creado', 'usado', 'equipo'],
  SinAlmuerzo: ['id', 'cedula', 'fecha', 'autoriza', 'autorizaNombre', 'razon', 'estado', 'creado', 'decididoPor', 'decididoEl', 'obs'],
  Liquidaciones: ['id', 'cedula', 'nombre', 'retiro', 'causa', 'total', 'detalle', 'registradoPor', 'creado']
};

var TIPOS_ALERTA = {
  tardanza: 'Llegada tarde', ausencia: 'No se presentó', fuera_zona: 'Marcación fuera del centro de trabajo',
  marcacion_manual: 'Marcación con hora digitada', bloqueo_permisos: 'Bloqueó la ubicación o la cámara', sin_foto: 'Marcación sin la foto exigida',
  duda_nomina: 'Duda o novedad de nómina de un trabajador', incompleto: 'Jornada sin salida', permiso_nuevo: 'Nueva solicitud de permiso', permiso_vencido: 'Permiso sin respuesta a tiempo', permiso_uso: 'Salida o regreso de permiso fuera de la hora aprobada', sin_almuerzo: 'Trabajó sin salir a almuerzo (por aprobar)', revision_novedad: 'El supervisor reportó una novedad en la jornada',
  permiso_resuelto: 'Permiso aprobado o rechazado', extras_tope: 'Horas extra por encima del tope legal', extras_pendientes: 'Horas extra por aprobar',
  fatiga: 'Jornada continua cerca del máximo (fatiga)', seguridad: 'Intentos de acceso sospechosos', registro_nuevo: 'Nuevo usuario por aprobar', respaldo: 'Resultado de la copia de seguridad', error_sistema: 'Error del sistema', contrato_vencimiento: 'Contrato próximo a vencer', gps_sospechoso: 'Ubicación sospechosa (posible GPS falso)', presupuesto_obra: 'Alerta de presupuesto de obra'
};

var CFG_DEF = {
  empresa: { nombre: 'Mi empresa', nit: '', direccion: '', telefono: '', logo: '', color: '', correoDatos: '', responsableDatos: '', titularSoftware: '' },
  urlApp: '', actualizarSolo: true, reportarProveedor: true, contactoProveedor: '', zona: 'America/Bogota', periodoNomina: 'quincenal',
  marcarAlmuerzo: false, fotoProbabilidad: 30, geocercaEstricta: false, soloCentroAsignado: false, maxPrecisionGps: 120, qrVentanaSeg: 60, fotoEnAnomalia: true, radioDefecto: 150, toleranciaMin: 5, recordatorioMin: 5, recordatorioCorreo: false,
  factorPrestacional: 0, fatigaHorasMax: 10, fatigaAvisoMin: 30, codigosConcepto: {},
  minutosAusencia: 60, diasAtrasManual: 3, horasLimitePermiso: 24, aprobacionFinalAdmin: true,
  autoRegistro: true, codigoEmpresa: '', sesionDias: 90, sesionAdminHoras: 24, admin2FA: false,
  correoAlertas: '', alertas: {},
  retencionFotosDias: 30, retencionGpsDias: 365, retencionSoportesDias: 365, archivarMeses: 12, respaldoCadaDias: 7, respaldoConservar: 8,
  vincularDispositivo: false, alertasAgrupadas: false, telegramToken: '', telegramChatId: '', telegramSinNombres: true,
  arlPct: 0.522, exoneradoAportes: false, compensarExtras: false,
  contactosEmergencia: [],
  versionLegal: '2026-11',
  legal: {} // parámetros del motor que la empresa quiera sobrescribir
};
var CFG_PUBLICAS = ['empresa', 'versionLegal', 'autoRegistro'];

/* ---------- Utilidades ---------- */
function E_(cod, msg) { var e = new Error(msg); e.cod = cod; return e; }
function ss_() {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  if (!s) s = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SS_ID'));
  return s;
}
function prop_(k, v) { var p = PropertiesService.getScriptProperties(); if (v === undefined) return p.getProperty(k); if (v === null) p.deleteProperty(k); else p.setProperty(k, String(v)); return v; }
function ahora_() {
  var d = _AHORA ? new Date(_AHORA) : new Date(), z = cfg_().zona;
  var s = Utilities.formatDate(d, z, "yyyy-MM-dd'T'HH:mm");
  return { iso: s, fecha: s.substr(0, 10), hora: s.substr(11, 5), ms: d.getTime() };
}
function isoMs_(iso) { var p = String(iso).match(/(\d+)-(\d+)-(\d+)T(\d+):(\d+)/); return p ? Date.UTC(+p[1], +p[2] - 1, +p[3], +p[4], +p[5]) : NaN; } // diferencia entre horas locales
function hex_(bytes) { return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function sha_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function hmac_(s) { return hex_(Utilities.computeHmacSha256Signature(s, prop_('SECRETO'))); }
function igualSeguro_(a, b) {
  a = String(a || ''); b = String(b || '');
  var d = a.length ^ b.length, len = Math.max(a.length, b.length);
  for (var i = 0; i < len; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function hashClave_(clave, salt) { var h = salt + '|' + clave; for (var i = 0; i < 150; i++) h = sha_(h + salt); return h; }
// Huella de la contraseña: HMAC con el secreto del servidor (sin ese secreto no se puede atacar fuera de línea).
// v3 usa 150 vueltas (ingreso rápido); v2 (600 vueltas) se sigue aceptando y se migra a v3 en el siguiente ingreso.
var ITER_CLAVE = 150;
function vueltas_(clave, salt, n) { var h = hmac_(salt + '|' + clave); for (var i = 0; i < n; i++) h = hmac_(h + '|' + salt); return h; }
function hashClaveV2_(clave, salt) { return 'v3:' + vueltas_(clave, salt, ITER_CLAVE); }
function verificarClave_(clave, salt, hash) { if (!hash) return false; hash = String(hash);
  if (hash.indexOf('v3:') === 0) return igualSeguro_('v3:' + vueltas_(clave, salt, ITER_CLAVE), hash);
  if (hash.indexOf('v2:') === 0) return igualSeguro_('v2:' + vueltas_(clave, salt, 600), hash);
  return igualSeguro_(hashClave_(clave, salt), hash); }
function azar_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }
function codigo6_() { return String(parseInt(azar_().substr(0, 8), 16) % 900000 + 100000); }
function id_() { return azar_().substr(0, 16); }
function soloDigitos_(s) { return String(s || '').replace(/\D/g, ''); }
function txt_(s, max) { return String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().substr(0, max || 300); }
function json_(s, def) { try { return s ? JSON.parse(s) : def; } catch (e) { return def; } }
function distancia_(a, b, c, d) {
  var R = 6371000, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, q = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) * Math.sin(y / 2);
  return Math.round(2 * R * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q)));
}
function enPoligono_(lat, lng, poly) {
  if (!Array.isArray(poly) || poly.length < 3) return false;
  var dentro = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = +poly[i][0], yi = +poly[i][1], xj = +poly[j][0], yj = +poly[j][1];
    if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / ((yj - yi) || 1e-12) + xi)) dentro = !dentro;
  }
  return dentro;
}
function codigoQrCentro_(centroId, ventana) { return hmac_('qr|' + centroId + '|' + ventana).substr(0, 6).toUpperCase(); }
function codigoDiaCentro_(centroId, fecha) { return hmac_('qrdia|' + centroId + '|' + fecha).substr(0, 6).toUpperCase(); }
// Devuelve 'qr' (código rotativo vigente), 'dia' (código del día indicado) o false.
// El código del día solo se acepta dentro de la geocerca o, sin conexión, quedando para revisión (ver a_marcar).
function validarQrCentro_(centroId, entrada, fechaDia, msMarca) {
  var raw = txt_(entrada, 80).toUpperCase(); if (!raw) return false;
  var a = ahora_(), seg = Math.max(30, +cfg_().qrVentanaSeg || 60), w = Math.floor(a.ms / (seg * 1000));
  var cod = raw.indexOf('CJ:') === 0 ? raw.split(':').pop() : raw;
  if (cod === codigoQrCentro_(centroId, w) || cod === codigoQrCentro_(centroId, w - 1)) return 'qr';
  if (msMarca) { var wm = Math.floor(msMarca / (seg * 1000)); for (var k = -2; k <= 1; k++) if (cod === codigoQrCentro_(centroId, wm + k)) return 'qr'; } // escaneado sin señal: vale el QR de la hora de la marca
  if (raw === codigoDiaCentro_(centroId, fechaDia || a.fecha)) return 'dia';
  return false;
}
// Contador de FALLOS (no de intentos): bloquea adivinar claves aunque el atacante cambie de cédula o de permiso.
function fallo_(clave, seg) { var c = CacheService.getScriptCache(), k = 'fl:' + clave, n = +(c.get(k) || 0) + 1; c.put(k, String(n), seg); return n; }
function bloqueado_(clave, max) { if (+(CacheService.getScriptCache().get('fl:' + clave) || 0) >= max) throw E_('DEMASIADOS', 'Demasiados intentos fallidos. Espera un rato e intenta de nuevo.'); }
function claveDebil_(clave, cedula) { clave = String(clave || ''); return clave.length < 6 || clave === cedula || /^(\d)\1+$/.test(clave) || ['123456', '1234567', '12345678', '123456789', '654321', 'abcdef', 'qwerty', 'password', 'colombia', 'abc123', '111222', '123123'].indexOf(clave.toLowerCase()) >= 0; }
function codigoLargo_() { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = azar_(), r = ''; for (var i = 0; i < 8; i++) r += a.charAt(parseInt(s.substr(i * 2, 2), 16) % a.length); return r; }
function limite_(clave, max, seg) {
  var c = CacheService.getScriptCache(), k = 'rl:' + clave, n = +(c.get(k) || 0);
  if (n >= max) throw E_('DEMASIADOS', 'Demasiados intentos. Espera unos minutos y vuelve a intentar.');
  c.put(k, String(n + 1), seg);
}

/* ---------- Acceso a hojas ---------- */
var _c = {};
function hoja_(n) {
  var s = ss_(), h = s.getSheetByName(n);
  if (!h) {
    h = s.insertSheet(n); var cols = HOJAS[n];
    h.getRange(1, 1, h.getMaxRows(), cols.length).setNumberFormat('@'); // todo texto: Sheets no convierte cédulas ni fechas
    h.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold'); h.setFrozenRows(1);
  }
  return h;
}
function celda_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') v = JSON.stringify(v);
  v = String(v); if (v.length > 49000) v = v.substr(0, 49000);
  return v === '' ? '' : "'" + v; // el apóstrofo obliga a Sheets a guardar texto literal: ni fechas, ni números, ni fórmulas
}
function leer(n, cola) {
  var k = n + '|' + (cola || ''); if (_c[k]) return _c[k];
  var h = hoja_(n), last = h.getLastRow(), cols = HOJAS[n];
  if (last < 2) return (_c[k] = []);
  var ini = cola && last - 1 > cola ? last - cola + 1 : 2;
  var v = h.getRange(ini, 1, last - ini + 1, cols.length).getValues();
  return (_c[k] = v.map(function (r, i) {
    var o = { _f: ini + i };
    cols.forEach(function (c, j) { var x = r[j]; o[c] = x === null || x === undefined ? '' : (x instanceof Date ? Utilities.formatDate(x, 'America/Bogota', "yyyy-MM-dd'T'HH:mm") : String(x)); });
    return o;
  }));
}
function sucio_(n) { Object.keys(_c).forEach(function (k) { if (k.indexOf(n + '|') === 0) delete _c[k]; }); if (n === 'Config') _cfg = null; }
function agregar(n, o) { hoja_(n).appendRow(HOJAS[n].map(function (c) { return celda_(o[c]); })); sucio_(n); return o; }
function guardar(n, o) { hoja_(n).getRange(o._f, 1, 1, HOJAS[n].length).setValues([HOJAS[n].map(function (c) { return celda_(o[c]); })]); sucio_(n); return o; }
function borrar(n, o) { hoja_(n).deleteRow(o._f); sucio_(n); }
function buscar(n, campo, valor, cola) { var l = leer(n, cola); for (var i = l.length - 1; i >= 0; i--) if (l[i][campo] === String(valor)) return l[i]; return null; }

/* ---------- Configuración ---------- */
var _cfg = null;
function cfg_() {
  if (_cfg) return _cfg;
  var o = JSON.parse(JSON.stringify(CFG_DEF));
  leer('Config').forEach(function (r) {
    var v = json_(r.valor, undefined); if (v === undefined) return;
    if (o[r.clave] && typeof o[r.clave] === 'object' && !Array.isArray(o[r.clave]) && typeof v === 'object') { for (var k in v) o[r.clave][k] = v[k]; } else o[r.clave] = v;
  });
  return (_cfg = o);
}
function cfgSet_(clave, valor) {
  var r = buscar('Config', 'clave', clave);
  if (r) { r.valor = JSON.stringify(valor); guardar('Config', r); } else agregar('Config', { clave: clave, valor: JSON.stringify(valor) });
  _cfg = null;
}
function legal_() { return Motor.cfg(cfg_().legal); }

/* ---------- Auditoría, alertas, errores ---------- */
function auditar_(actor, accion, detalle) {
  var fecha = ahora_().iso, det = txt_(typeof detalle === 'string' ? detalle : JSON.stringify(detalle), 2000);
  var prev = leer('Auditoria', 1), ant = prev.length ? (prev[0].hash || '') : 'GENESIS';
  var h = hmac_(ant + '|' + fecha + '|' + actor + '|' + accion + '|' + det).substr(0, 32);
  agregar('Auditoria', { fecha: fecha, actor: actor, accion: accion, detalle: det, hash: h });
  try { // ancla fuera de la hoja (la primera vez cuenta las filas firmadas que ya existían)
    var nAud = prop_('AUD_N'); if (nAud === null || nAud === undefined) { nAud = leer('Auditoria').filter(function (r) { return !!r.hash; }).length; prop_('AUD_DESDE', fecha); } else nAud = +nAud + 1;
    prop_('AUD_N', String(nAud)); prop_('AUD_ULT', h);
  } catch (e) { }
}
// Mientras hay bloqueo los correos se encolan y salen al soltarlo: un envío lento no frena a quien marca
var _colaCorreo = [], _enBloqueo = false;
function soltarCorreos_() { var l = _colaCorreo; _colaCorreo = []; l.forEach(function (x) { correoYa_(x[0], x[1], x[2]); }); }
function correo_(para, asunto, cuerpo) {
  para = String(para || '').split(/[,; ]+/).filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
  if (!para.length) return '';
  if (_enBloqueo) { _colaCorreo.push([para, asunto, cuerpo]); return para.join(','); }
  return correoYa_(para, asunto, cuerpo);
}
function correoYa_(para, asunto, cuerpo) {
  try {
    if (MailApp.getRemainingDailyQuota() < para.length) return 'SIN CUPO DE CORREO';
    if (_colaCorreo.length > 60) return 'SIN CUPO DE CORREO';
    MailApp.sendEmail({ to: para.join(','), subject: '[' + cfg_().empresa.nombre + '] ' + asunto, body: cuerpo + '\n\n— Control de jornada · mensaje automático', name: cfg_().empresa.nombre });
    return para.join(',');
  } catch (e) { return 'FALLÓ: ' + e.message; }
}
// Los mensajes se encolan y salen al terminar la petición, fuera del bloqueo: un Telegram lento no demora a nadie.
var _colaTelegram = [];
function telegram_(texto) { var c = cfg_(); if ((prop_('TELEGRAM_TOKEN') || c.telegramToken) && c.telegramChatId) _colaTelegram.push(texto); }
function enviarTelegram_() { var l = _colaTelegram; _colaTelegram = []; l.forEach(telegramYa_); }
function telegramYa_(texto) {
  var c = cfg_(), tok = prop_('TELEGRAM_TOKEN') || c.telegramToken; if (!tok || !c.telegramChatId) return;
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/sendMessage', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ chat_id: c.telegramChatId, text: '[' + c.empresa.nombre + '] ' + texto })
    });
  } catch (e) { /* no interrumpir por fallo de Telegram */ }
}
var ALERTAS_AGRUPABLES = { tardanza: 1, ausencia: 1, fuera_zona: 1, marcacion_manual: 1, sin_foto: 1 };
function alertar_(tipo, cedula, detalle) {
  var c = cfg_(), a = (c.alertas || {})[tipo] || {}, activo = a.activo !== false, para = a.correos || c.correoAlertas, enviado = '';
  var diferida = activo && para && ALERTAS_AGRUPABLES[tipo] && (c.alertasAgrupadas || leer('Usuarios').filter(function (x) { return x.estado === 'activo'; }).length > 30); // con más de 30 personas se agrupan siempre: evita agotar el cupo de correo
  var u = cedula ? buscar('Usuarios', 'cedula', cedula) : null;
  if (activo && !diferida) telegram_((TIPOS_ALERTA[tipo] || tipo) + (u && !c.telegramSinNombres ? ' — ' + u.nombre : '') + '\n' + detalle); // Telegram está fuera del país: por defecto sin nombres
  if (activo && para && !diferida) {
    enviado = correo_(para, TIPOS_ALERTA[tipo] + (u ? ': ' + u.nombre : ''), (u ? u.nombre + ' (C.C. ' + cedula + ')\n' : '') + detalle + '\n\nFecha: ' + ahora_().iso.replace('T', ' '));
  }
  agregar('Alertas', { fecha: ahora_().iso, tipo: tipo, cedula: cedula || '', detalle: txt_(detalle, 500), enviadoA: diferida ? para : enviado, estado: !activo ? 'desactivada' : diferida ? 'pendiente_resumen' : enviado && enviado.indexOf('@') > 0 ? 'enviada' : 'registrada' });
}
function registrarError_(origen, err, extra) {
  try {
    agregar('Errores', { fecha: ahora_().iso, cedula: (extra && extra.cedula) || '', origen: origen, mensaje: txt_(err && err.message ? err.message : err, 400), detalle: txt_(err && err.stack ? err.stack : (extra && extra.detalle) || '', 1500), equipo: txt_(extra && extra.equipo, 200), version: (extra && extra.version) || VERSION });
  } catch (e) { /* nunca romper por registrar */ }
}

/* ---------- Sesiones ---------- */
function crearSesion_(cedula, equipo, rol) {
  var t = azar_(), a = ahora_(), c = cfg_();
  var ttl = rol === 'admin' ? Math.max(1, +c.sesionAdminHoras || 24) * 3600000 : c.sesionDias * 86400000;
  equipo = txt_(equipo, 120); if (rol !== 'kiosco' && equipo.indexOf('KIOSCO|') === 0) equipo = equipo.substr(7);
  agregar('Sesiones', { hash: sha_(t), cedula: cedula, creado: a.iso, expira: String(a.ms + ttl), equipo: equipo });
  return t;
}
function usuarioDeToken_(t) {
  if (!t || String(t).length < 40) throw E_('SESION', 'Tu sesión terminó. Ingresa de nuevo.');
  var h = sha_(String(t)), cache = CacheService.getScriptCache(), ced = cache.get('ses:' + h);
  if (!ced) {
    var s = buscar('Sesiones', 'hash', h);
    if (!s || +s.expira < ahora_().ms) throw E_('SESION', 'Tu sesión terminó. Ingresa de nuevo.');
    ced = s.cedula + (String(s.equipo).indexOf('KIOSCO|') === 0 ? '|' + String(s.equipo).split('|')[1] : ''); cache.put('ses:' + h, ced, 1800);
  }
  var partes = String(ced).split('|'), u = buscar('Usuarios', 'cedula', partes[0]);
  if (!u || (u.estado !== 'activo' && u.estado !== 'pendiente')) throw E_('SESION', 'Tu usuario no está activo. Habla con el administrador.');
  if (partes.length > 1) { // sesión de kiosco: solo sirve para marcar en ese centro
    var kc = centroDe_(partes[1]), alK = alcance_(u);
    if (u.estado !== 'activo' || ['admin', 'supervisor'].indexOf(u.rol) < 0 || !kc || !kc.activo || (alK && !alK[partes[1]])) throw E_('SESION', 'Este kiosco quedó sin autorización. Un supervisor debe activarlo de nuevo.');
    var k = {}; for (var x in u) k[x] = u[x]; k._kiosco = partes[1]; return k;
  }
  return u;
}
function cerrarSesiones_(cedula, soloHash) {
  var cache = CacheService.getScriptCache();
  leer('Sesiones').filter(function (s) { return s.cedula === cedula && (!soloHash || s.hash === soloHash); })
    .sort(function (a, b) { return b._f - a._f; }).forEach(function (s) { cache.remove('ses:' + s.hash); borrar('Sesiones', s); });
  // Cerrar todas las sesiones también anula los accesos rápidos (PIN/huella) de esa persona
  if (!soloHash) leer('Accesos').filter(function (x) { return x.cedula === cedula; }).sort(function (a, b) { return b._f - a._f; }).forEach(function (x) { borrar('Accesos', x); });
}
function usuarioPublico_(u) {
  return { cedula: u.cedula, nombre: u.nombre, cargo: u.cargo, rol: u.rol, centroId: u.centroId, salario: +u.salario || 0, salarioOk: u.salarioOk === '1', tipoPago: u.tipoPago || 'mensual',
    email: u.email, telefono: u.telefono, ingreso: String(u.ingreso).substr(0, 10), eps: u.eps, arl: u.arl, estado: u.estado, retiro: String(u.retiro || '').substr(0, 10), supCentros: json_(u.supCentros, []), supervisor: u.supervisor || '', banco: u.banco || '', tipoCuenta: u.tipoCuenta || '', cuenta: u.cuenta || '', consVersion: String(u.consVersion).indexOf(cfg_().versionLegal) === 0 ? cfg_().versionLegal : u.consVersion, tieneClave: !!u.hash, tieneDispositivo: !!u.dispositivoId, tieneFotoRef: !!u.fotoRef, tipoContrato: u.tipoContrato || '', finContrato: String(u.finContrato || '').substr(0, 10) };
}

/* ---------- Licenciamiento por plan y módulos ---------- */
function licenciaEfectiva_() {
  var def = { plan: 'empresa', modulos: PLANES.empresa.modulos.slice(), maxUsuarios: PLANES.empresa.maxUsuarios, vence: '', vencida: false };
  var raw = prop_('LICENCIA');
  if (!raw) return prov_('clave') ? { plan: 'basico', modulos: PLANES.basico.modulos.slice(), maxUsuarios: PLANES.basico.maxUsuarios, vence: '', vencida: false } : def;
  var partes = String(raw).split('.');
  if (partes.length !== 2) return def;
  if (prov_('clave')) {
    var firma = hex_(Utilities.computeHmacSha256Signature(partes[0], prov_('clave'))).substr(0, 32);
    if (!igualSeguro_(firma, partes[1])) return { plan: 'basico', modulos: PLANES.basico.modulos.slice(), maxUsuarios: PLANES.basico.maxUsuarios, vence: '', vencida: true };
  }
  try {
    var datos = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString('UTF-8'));
    var base = PLANES[datos.plan] || PLANES.basico;
    // Módulos: la llave puede traer la lista exacta (panel de proveedor con casillas) o el plan más módulos extra
    var todos = PLANES.empresa.modulos, mods = Array.isArray(datos.modulos) ? datos.modulos.filter(function (m) { return todos.indexOf(m) >= 0; }) : base.modulos.slice();
    if (mods.indexOf('asistencia') < 0) mods.unshift('asistencia');
    (datos.modulosExtra || []).forEach(function (m) { if (mods.indexOf(m) < 0) mods.push(m); });
    var vence = String(datos.vence || '').substr(0, 10), hoy = ahora_().fecha;
    // La llave es de una empresa (NIT) y siempre tiene vencimiento. Tras vencer hay 15 días de gracia para cerrar nómina y renovar.
    var nitOk = !prov_('clave') || (datos.nit && soloDigitos_(datos.nit) === soloDigitos_(prop_('LIC_NIT') || cfg_().empresa.nit));
    if (prov_('clave') && (!/^\d{4}-\d\d-\d\d$/.test(vence) || !nitOk))
      return { plan: 'basico', modulos: PLANES.basico.modulos.slice(), maxUsuarios: PLANES.basico.maxUsuarios, vence: vence, vencida: true, motivo: !nitOk ? 'La llave es de otra empresa (NIT distinto).' : 'La llave no tiene fecha de vencimiento.' };
    var gracia = vence ? Motor.sumar(vence, 15) : '';
    return { plan: datos.plan || 'basico', modulos: mods, maxUsuarios: Math.min(+datos.maxUsuarios || base.maxUsuarios, 2000), vence: vence, nit: datos.nit || '',
      enGracia: !!(vence && hoy > vence && hoy <= gracia), vencida: !!(vence && hoy > gracia) };
  } catch (e) { return def; }
}
function moduloActivo_(mod) { return !mod || licenciaEfectiva_().modulos.indexOf(mod) >= 0; }

/* ---------- Enrutador ---------- */
var ACCIONES = {}; // nombre -> {fn, rol: 'publico' | 'usuario' | 'admin', escribe, modulo}
function accion_(nombre, rol, escribe, fn, modulo) { ACCIONES[nombre] = { fn: fn, rol: rol, escribe: escribe, modulo: modulo || '' }; }

var ACCIONES_SIEMPRE = { publico: 1, consultarCedula: 1, login: 1, salir: 1, yo: 1, adminLicenciaActivar: 1, adminLicenciaSincronizar: 1, adminActualizar: 1, kioscoMarcar: 1, kioscoIniciar: 1, kioscoSalir: 1 };
var ACCIONES_KIOSCO = { kioscoMarcar: 1, kioscoSalir: 1, yo: 1 }; // salir del kiosco exige la clave de un supervisor (kioscoSalir)
// Toma el bloqueo solo si la petición aún no lo tiene (acciones de lectura que escriben poco)
function conBloqueo_(fn) {
  if (_enBloqueo) return fn();
  var l = LockService.getScriptLock(); if (!l.tryLock(25000)) throw E_('OCUPADO', 'El sistema está ocupado. Intenta de nuevo en unos segundos.');
  _enBloqueo = true; try { return fn(); } finally { l.releaseLock(); _enBloqueo = false; }
}
function despachar_(req) {
  _c = {}; _cfg = null;
  if (!ACCIONES.publico) registrarAcciones_();
  var a = ACCIONES[req && req.a];
  if (!a) throw E_('ACCION', 'Esta función no está disponible en la versión instalada de tu empresa. Pide al administrador que actualice el código.');
  if (a.modulo && !moduloActivo_(a.modulo)) throw E_('MODULO_NO_INCLUIDO', 'El módulo "' + a.modulo + '" no está incluido en tu plan actual.');
  if (req.d) delete req.d._fotoPre;
  // La foto se sube a Drive antes de tomar el bloqueo: es lo más lento de marcar
  if (req.a === 'marcar' && req.d && req.d.foto) {
    var uf = usuarioDeToken_(req.t), tf = String(req.d.tipo || '').replace(/[^a-z_]/g, '');
    req.d._fotoPre = guardarImagen_(req.d.foto, uf.cedula + '_' + ahora_().iso.replace(/[:T]/g, '-') + '_' + tf + '.jpg', 'CARPETA_FOTOS'); delete req.d.foto;
  }
  var lock = null;
  if (a.escribe) { lock = LockService.getScriptLock(); if (!lock.tryLock(25000)) throw E_('OCUPADO', 'El sistema está ocupado. Intenta de nuevo en unos segundos.'); _enBloqueo = true; }
  try {
    var u = null;
    if (a.rol !== 'publico') {
      u = usuarioDeToken_(req.t);
      if (u._kiosco && !ACCIONES_KIOSCO[req.a]) throw E_('PERMISO', 'Esta tablet está en modo kiosco: solo sirve para marcar.');
      if (!u._kiosco && req.a === 'kioscoMarcar') throw E_('PERMISO', 'Primero activa el modo kiosco en esta tablet.');
      if (a.rol === 'supervisor' && (['admin', 'supervisor'].indexOf(u.rol) < 0 || u.estado !== 'activo')) throw E_('PERMISO', 'Esta acción es solo para supervisores y administradores.');
      if (a.rol === 'admin' && (u.rol !== 'admin' || u.estado !== 'activo')) throw E_('PERMISO', 'Esta acción es solo para administradores.');
      // Suscripción vencida: el panel queda en solo lectura. Nadie pierde acceso a sus datos y el personal sigue marcando.
      if (prov_('clave') && a.escribe && (a.rol === 'admin' || a.rol === 'supervisor') && !ACCIONES_SIEMPRE[req.a] && licenciaEfectiva_().vencida)
        throw E_('LICENCIA_VENCIDA', 'La suscripción está vencida: el panel quedó en modo consulta. Ingresa la nueva llave de licencia en Configuración → Licencia para volver a editar.');
    }
    var res = a.fn(req.d || {}, u, req);
    if (a.escribe) try { CacheService.getScriptCache().put('gen', String(Date.now()), 21600); } catch (e) { }
    return { ok: true, d: res };
  } finally { if (lock) { lock.releaseLock(); _enBloqueo = false; } try { soltarCorreos_(); } catch (e) { } try { enviarTelegram_(); } catch (e) { } }
}
function doPost(e) {
  var out, req = null;
  try { req = JSON.parse(e.postData.contents); out = despachar_(req); }
  catch (err) {
    if (err && err.cod) out = { ok: false, e: err.cod, m: err.message };
    else { registrarError_('servidor:' + (req && req.a), err); out = { ok: false, e: 'ERROR', m: 'Algo falló en el servidor. El error quedó registrado para revisión.' }; }
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function html_(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
// Al abrir la dirección /exec en el navegador: termina la instalación si faltaba y entrega el enlace de conexión.
function doGet() {
  _c = {}; _cfg = null;
  var estado = 'Servicio activo.', instalado = !!prop_('SECRETO') && prop_('SS_ID') === SpreadsheetApp.getActiveSpreadsheet().getId();
  if (!instalado) { try { instalar(); instalado = true; estado = 'Instalación completada.'; } catch (e) { estado = 'No se pudo instalar: ' + e.message + '. Abre la hoja de cálculo y usa el menú Control de jornada → Instalar o reparar.'; } }
  var hayAdmin = false, e0 = enlaceEmpresa_(), enlace = e0.enlace, id = e0.id, url = e0.url;
  try { hayAdmin = leer('Usuarios').some(function (u) { return u.rol === 'admin' && u.hash; }); } catch (e) { }
  var h = '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:32px auto;padding:0 16px;line-height:1.5;color:#14242A">' +
    '<h1 style="font-size:22px">Control de jornada · versión ' + VERSION + '</h1><p>' + html_(estado) + '</p>' +
    (enlace ? '<p><strong>Enlace de tu empresa</strong> (ábrelo y compártelo con tu personal):</p><p><a href="' + html_(enlace) + '" target="_blank" style="word-break:break-all">' + html_(enlace) + '</a></p>'
      : '<p><strong>Código de conexión</strong> (pégalo en la página de la aplicación):</p><p style="word-break:break-all;background:#E8EDEC;padding:12px;border-radius:8px;font-family:monospace">' + html_(id || url) + '</p>') +
    (hayAdmin ? '' : '<p>Primer ingreso: el <strong>código del primer administrador</strong> está en la hoja de cálculo, menú <em>Control de jornada → Ver código del primer administrador</em>. Por seguridad no se muestra aquí.</p>') + '</div>';
  return HtmlService.createHtmlOutput(h).setTitle('Control de jornada');
}
