/**
 * CONTROL DE JORNADA — Servicios de la API.
 */
var TIPOS = ['entrada', 'sal_alm', 'ent_alm', 'salida'];
var NOMBRE_TIPO = { entrada: 'Entrada', sal_alm: 'Salida a almuerzo', ent_alm: 'Regreso de almuerzo', salida: 'Salida' };

/* ---------- Alcance por rol: el supervisor solo ve las personas de sus centros ---------- */
function alcance_(u) { // null = todo (administrador o llamada interna)
  if (!u || u.rol === 'admin') return null;
  var l = json_(u.supCentros, []), m = {}; if (!l.length && u.centroId) l = [u.centroId];
  l.forEach(function (x) { m[x] = 1; }); return m;
}
// Gente de un supervisor: la que tiene asignada a él; quien no tiene supervisor asignado, por la obra.
function veA_(sup, p, al) { if (al === undefined) al = alcance_(sup); if (!al) return true; if (!p) return false; return p.supervisor ? p.supervisor === sup.cedula : !!al[p.centroId]; }
function enAlcance_(u, cedula) { var a = alcance_(u); if (!a) return true; return veA_(u, buscar('Usuarios', 'cedula', cedula), a); }

/* ---------- Lecturas comunes ---------- */
function centros_() {
  return leer('Centros').map(function (c) {
    return { _f: c._f, id: c.id, nombre: c.nombre, cliente: c.cliente, direccion: c.direccion, lat: c.lat === '' ? null : +c.lat, lng: c.lng === '' ? null : +c.lng,
      radio: +c.radio || cfg_().radioDefecto, horario: json_(c.horario, {}), tol: c.tol === '' ? cfg_().toleranciaMin : +c.tol, festivos: c.festivos === '1', activo: c.activo !== '0', poligono: json_(c.poligono, []), exigirQr: c.exigirQr === '1', presupuestoHoras: +c.presupuestoHoras || 0, presupuestoCosto: +c.presupuestoCosto || 0 };
  });
}
function centroDe_(id) { var l = centros_(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
function centroPub_(c) { var o = {}; ['id', 'nombre', 'cliente', 'direccion', 'lat', 'lng', 'radio', 'horario', 'tol', 'festivos', 'activo', 'poligono', 'exigirQr', 'presupuestoHoras', 'presupuestoCosto', 'arlPct'].forEach(function (k) { o[k] = c[k]; }); return o; }
// Turno programado para una persona en una fecha: undefined = sin programación (rige el horario del centro), null = descanso.
function turnoDe_(cedula, fecha) {
  var pr = leer('Programacion'), r = null;
  for (var i = 0; i < pr.length; i++) if (pr[i].cedula === cedula && pr[i].desde <= fecha && fecha <= pr[i].hasta) r = pr[i]; // gana la más reciente
  if (!r) return undefined;
  if (r.turnoId === 'descanso') return null;
  var t = buscar('Turnos', 'id', r.turnoId); if (!t || !t.e || !t.s) return undefined;
  var dias = json_(t.dias, []); if (dias.length && dias.indexOf(Motor.dow(fecha)) < 0) return null;
  return { e: t.e, s: t.s, ai: t.ai || '', af: t.af || '' };
}
// Quien trabaja los sábados cuenta el sábado como día hábil de vacaciones (concepto MinTrabajo 6510 de 2026)
function sabadoHabil_(cedula) { var u = buscar('Usuarios', 'cedula', cedula), c = u ? centroDe_(u.centroId) : null; return !!(c && c.horario && (c.horario[6] || c.horario['6'])); }
function horarioDe_(centro, fecha, cedula) {
  if (cedula) { var t = turnoDe_(cedula, fecha); if (t !== undefined) { if (t) t.tol = centro ? centro.tol : cfg_().toleranciaMin; return t; } }
  if (!centro) return null;
  var h = Motor.horarioDia(centro.horario, fecha, legal_(), centro.festivos); if (!h) return null;
  return { e: h.e, s: h.s, ai: h.ai || '', af: h.af || '', tol: centro.tol };
}
// Agrupa las marcaciones válidas de una persona en días de jornada.
// Índice por cédula de un arreglo de marcaciones (se rehace si el arreglo creció): evita recorrer todo por cada persona
function porCedula_(marc) {
  if (marc.__pc && marc.__pc.n === marc.length) return marc.__pc.o;
  var o = {}; marc.forEach(function (r) { (o[r.cedula] || (o[r.cedula] = [])).push(r); });
  Object.defineProperty(marc, '__pc', { value: { n: marc.length, o: o }, enumerable: false, writable: true, configurable: true }); return o;
}
// Cuántas filas recientes de Marcaciones bastan: ~22 días con 4 marcas por persona activa (mín. 4.000, máx. 30.000)
// Marcaciones desde una fecha leyendo solo las filas recientes necesarias (la hoja crece en orden de llegada).
// Si la cola no alcanza a cubrir la fecha (marcaciones muy atrasadas o empresa grande), lee la hoja completa: nunca se pierden datos.
function marcDesde_(desde) {
  desde = Motor.sumar(desde, -7); var hoy = ahora_().fecha;
  var n = leer('Usuarios').filter(function (u) { return u.estado !== 'inactivo'; }).length || 1;
  var cola = Math.max(4000, n * 5 * (Motor.diasEntre(desde, hoy) + 10));
  var sh = hoja_('Marcaciones'), ult = sh.getLastRow(); if (cola >= ult - 1) return leer('Marcaciones');
  // Cubre la fecha si la fila más antigua de la cola llegó al servidor antes de «desde» (lo que llegó después está en la cola)
  var r = leer('Marcaciones', cola), primera = r[0] && String(r[0].servidor || '').substr(0, 10);
  return primera && primera < desde ? r : leer('Marcaciones');
}
function colaMarc_() { var n = leer('Usuarios').filter(function (u) { return u.estado !== 'inactivo'; }).length; return Math.min(30000, Math.max(4000, n * 90)); }
function diasDe_(marc, cedula, desde, hasta) {
  var m = {};
  (porCedula_(marc)[cedula] || []).forEach(function (r) {
    if (r.cedula !== cedula || r.estado === 'anulada' || r.fecha < desde || r.fecha > hasta) return;
    var d = m[r.fecha] || (m[r.fecha] = { fecha: r.fecha, horario: null, centroId: r.centroId, marcas: [] });
    var k = { entrada: 'entrada', sal_alm: 'salAlm', ent_alm: 'entAlm', salida: 'salida' }[r.tipo];
    d[k] = r.hora.substr(11, 5);
    if (r.tipo === 'entrada' || !d.horario) { d.horario = json_(r.horario, null) || d.horario; d.centroId = r.centroId || d.centroId; }
    d.marcas.push({ id: r.id, tipo: r.tipo, hora: r.hora, manual: r.manual === '1', estado: r.estado, enZona: r.enZona, dist: r.dist, foto: r.foto, fotoExigida: r.fotoExigida === '1', motivo: r.motivo, origen: r.origen, centroId: r.centroId, lat: r.lat, lng: r.lng });
  });
  var sinA = {}; leer('SinAlmuerzo').forEach(function (x) { if (x.cedula === cedula && x.estado === 'aprobado') sinA[x.fecha] = true; });
  return Object.keys(m).sort().map(function (f) { if (sinA[f]) m[f].sinAlmuerzo = true; return m[f]; });
}
// Un día trabajado sin horario programado (el sábado de quien trabaja de lunes a viernes) es todo tiempo suplementario.
function marcarLibres_(dias, u) {
  var c = u ? centroDe_(u.centroId) : null, tiene = !!(c && Object.keys(c.horario).length);
  dias.forEach(function (d) { if (!d.horario && u) { var t = turnoDe_(u.cedula, d.fecha); d.libre = t === null || (t === undefined && tiene); } });
  return dias;
}
function fotoRequerida_(cedula, fecha, tipo) {
  var p = +cfg_().fotoProbabilidad;
  if (p <= 0) return false; if (p >= 100) return true;
  return parseInt(hmac_('foto|' + cedula + '|' + fecha + '|' + tipo).substr(0, 6), 16) % 100 < p;
}
function periodoCerrado_(fecha) { return leer('Periodos').some(function (p) { return p.desde <= fecha && fecha <= p.hasta; }); }
function guardarImagen_(dataUrl, nombre, carpeta) {
  var m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw E_('FOTO', 'La foto no llegó bien. Tómala de nuevo.');
  if (m[2].length > 700000) throw E_('FOTO', 'La foto pesa demasiado. Tómala de nuevo.');
  return DriveApp.getFolderById(prop_(carpeta)).createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), 'image/' + m[1], nombre)).getId();
}
function permisosAprobados_(cedula) {
  var u0 = buscar('Usuarios', 'cedula', cedula), cen = u0 ? centroDe_(u0.centroId) : null, l = [];
  // Horas de permiso dentro del horario del día, sin la franja de almuerzo ni lo que queda fuera del horario
  var horasEn = function (f, ini, fin) {
    var h = cen ? horarioDe_(cen, f, cedula) : null, a = Motor.aMin(ini), b = fin ? Motor.aMin(fin) : null;
    if (!h || !h.e || !h.s) return b === null ? null : Math.max(0, Math.round((b - a) / 6) / 10);
    var e = Motor.aMin(h.e), s = Motor.aMin(h.s); if (s <= e) s += 1440; if (a < e - 60 && s > 1440) a += 1440; if (b !== null && b < a) b += 1440;
    var x = Math.max(a, e), y = Math.min(b === null ? s : b, s), t = Math.max(0, y - x);
    if (h.ai && h.af) { var ai = Motor.aMin(h.ai), af = Motor.aMin(h.af); if (ai < e) { ai += 1440; af += 1440; } t -= Math.max(0, Math.min(af, y) - Math.max(ai, x)); }
    return Math.max(0, Math.round(t / 6) / 10);
  };
  leer('Permisos').filter(function (p) { return p.cedula === cedula && p.estado === 'aprobado'; }).forEach(function (p) {
    var mismo = p.fechaSalida === p.fechaRegreso, rem = p.remunerado === '1';
    if (mismo) { l.push({ desde: p.fechaSalida, hasta: p.fechaSalida, remunerado: rem, horas: p.horaSalida && p.horaRegreso ? horasEn(p.fechaSalida, p.horaSalida, p.horaRegreso) : null, tipo: p.tipo }); return; }
    var hasta = Motor.sumar(p.fechaRegreso, -1);
    if (p.horaSalida) { // sale a mitad del día y no vuelve: ese día cuenta solo desde la hora de salida hasta el fin del horario
      l.push({ desde: p.fechaSalida, hasta: p.fechaSalida, remunerado: rem, horas: horasEn(p.fechaSalida, p.horaSalida, null), tipo: p.tipo });
      if (hasta > p.fechaSalida) l.push({ desde: Motor.sumar(p.fechaSalida, 1), hasta: hasta, remunerado: rem, horas: null, tipo: p.tipo });
    } else l.push({ desde: p.fechaSalida, hasta: hasta, remunerado: rem, horas: null, tipo: p.tipo });
  });
  return l.concat(leer('Compensatorios').filter(function (x) { return x.cedula === cedula && +x.minutos < 0; }).map(function (x) {
    var u0 = buscar('Usuarios', 'cedula', cedula), h0 = u0 ? horarioDe_(centroDe_(u0.centroId), x.fecha, cedula) : null, jor = h0 ? Motor.jornadaMin(h0) : 480, m = -x.minutos;
    return { desde: x.fecha, hasta: x.fecha, remunerado: true, horas: m >= jor ? null : Math.round(m / 6) / 10, tipo: 'compensatorio' };
  }));
}
function insumos_(u, desde, hasta, corte, marc) {
  var centro = centroDe_(u.centroId), ext = {};
  leer('Extras').forEach(function (x) { if (x.cedula === u.cedula && x.estado === 'aprobada') ext[x.fecha] = +x.minAprob || 0; });
  var prog = {}; if (leer('Programacion').some(function (x) { return x.cedula === u.cedula; })) for (var pf = desde; pf <= hasta; pf = Motor.sumar(pf, 1)) { var pt = turnoDe_(u.cedula, pf); if (pt !== undefined) prog[pf] = !!pt; }
  var nov = leer('Novedades').filter(function (n) { return n.cedula === u.cedula; }).map(function (n) { return { fecha: n.fecha, concepto: n.concepto, valor: +n.valor || 0, salarial: n.salarial === '1' }; });
  // Domingos y festivos trabajados desde el 1 del mes (ocasional u habitual) y bases para salario variable
  var descMes = {}, L = legal_(); diasDe_(marc, u.cedula, desde.substr(0, 8) + '01', hasta).forEach(function (d) { if (d.entrada && Motor.esDescanso(d.fecha, L)) { var m = d.fecha.substr(0, 7); descMes[m] = (descMes[m] || 0) + 1; } });
  var baseVac = 0, baseInc = 0;
  try { var excl = ['HED', 'HEN', 'HEDF', 'HENF', 'AUX', 'BNS', 'VAC', 'PRI', 'INT'], pr = promedioNominas_(u.cedula, Motor.sumar(desde, -365), Motor.sumar(desde, -1), excl); if (pr.dias >= 30) baseVac = pr.mensual / 30;
    var pm = promedioNominas_(u.cedula, Motor.sumar(desde, -31), Motor.sumar(desde, -1), ['AUX', 'BNS']); if (pm.dias >= 15) baseInc = pm.mensual / 30; } catch (e) { }
  return { descansosMes: descMes, baseVacDia: baseVac, baseIncDia: baseInc, programado: prog, novedades: nov, retiro: String(u.retiro || '').substr(0, 10), usuario: { salario: +u.salario || 0, tipoPago: u.tipoPago || 'mensual' }, desde: desde, hasta: hasta, corte: corte, ingreso: u.ingreso || '',
    dias: marcarLibres_(diasDe_(marc, u.cedula, Motor.lunesDe(desde), hasta), u), extras: ext, horario: centro ? centro.horario : null, trabajaFestivos: centro ? centro.festivos : false,
    permisos: permisosAprobados_(u.cedula),
    incapacidades: leer('Incapacidades').filter(function (i) { return i.cedula === u.cedula; }).map(function (i) { return { desde: i.desde, hasta: i.hasta, tipo: i.tipo }; }) };
}
function sinDetalle_(l) { var o = {}; for (var k in l) if (k !== 'porFecha') o[k] = l[k]; return o; }

/* ---------- Estado del día y resumen del trabajador ---------- */
function estadoHoy_(u, marc) {
  var a = ahora_(), ayer = Motor.sumar(a.fecha, -1), dias = diasDe_(marc, u.cedula, ayer, a.fecha), hoy = null, prev = null;
  dias.forEach(function (d) { if (d.fecha === a.fecha) hoy = d; else prev = d; });
  var fecha = a.fecha;
  if (!hoy && prev && prev.entrada && !prev.salida && sigueTurno_(u, prev, ayer, a.iso)) { hoy = prev; fecha = ayer; } // turno nocturno abierto
  var marcas = {}; if (hoy) hoy.marcas.forEach(function (m) { marcas[m.tipo] = m.hora.substr(11, 5); });
  var sa = leer('SinAlmuerzo').filter(function (x) { return x.cedula === u.cedula && x.fecha === fecha && x.estado !== 'rechazado'; })[0] || null;
  // Almuerzo: por defecto se descuenta solo la franja del horario de la obra; se marca solo si la empresa lo pide (o si ya salió a almorzar)
  var almManual = !!cfg_().marcarAlmuerzo || (!!marcas.sal_alm && !marcas.ent_alm);
  var sig = !marcas.entrada ? 'entrada' : marcas.salida ? null : (sa || !almManual) && !(marcas.sal_alm && !marcas.ent_alm) ? 'salida' : (!marcas.sal_alm ? 'sal_alm' : !marcas.ent_alm ? 'ent_alm' : 'salida');
  var centro = centroDe_((hoy && hoy.centroId) || u.centroId), plan = {};
  TIPOS.forEach(function (t) { plan[t] = fotoRequerida_(u.cedula, fecha, t); });
  return { fecha: fecha, marcas: marcas, siguiente: sig, almManual: almManual, fotoPlan: plan, horario: (hoy && hoy.horario) || horarioDe_(centro, fecha, u.cedula), centroId: centro ? centro.id : '', festivo: Motor.esFestivo(fecha, legal_()), permiso: permisoDeHoy_(u, a.fecha),
    sinAlmuerzo: sa ? { estado: sa.estado, autorizaNombre: sa.autorizaNombre, razon: sa.razon } : null,
    ayerSinSalida: ayerSinSalida_(u, marc, fecha), fatigaHorasMax: +cfg_().fatigaHorasMax || 10 };
}
// ¿Dejó la jornada de su último día laboral sin salida? (para recordárselo con un botón directo)
// ¿La jornada abierta de ayer sigue en curso? Solo si su turno cruza la medianoche (o, sin horario, empezó en la tarde),
// o si todavía no han pasado 4 h desde la salida programada. Un turno de día con la salida olvidada NO se une a hoy.
function sigueTurno_(u, prev, f, ahoraIso) {
  var desde = isoMs_(f + 'T' + prev.entrada), ya = isoMs_(String(ahoraIso).substr(0, 16)); if (ya - desde >= 16 * 3600000) return false;
  var hs = horarioDe_(centroDe_(prev.centroId || u.centroId), f, u.cedula);
  if (hs && hs.e && hs.s) return hs.s <= hs.e ? true : ya <= isoMs_(f + 'T' + hs.s) + 4 * 3600000;
  return prev.entrada >= '14:00';
}
function ayerSinSalida_(u, marc, hoy) {
  for (var i = 1; i <= 3; i++) { var f = Motor.sumar(hoy, -i), d = diasDe_(marc, u.cedula, f, f)[0];
    if (d && d.entrada) { if (d.salida || periodoCerrado_(f)) return null; var hs = horarioDe_(centroDe_(d.centroId || u.centroId), f, u.cedula); return { fecha: f, entrada: d.entrada, horaSalidaHorario: hs && hs.s ? hs.s : '' }; } }
  return null;
}
// Permiso aprobado que la persona puede usar hoy: salir a él o, si es por horas, registrar el regreso
function permisoDeHoy_(u, hoy) {
  var p = leer('Permisos').filter(function (x) {
    if (x.cedula !== u.cedula || x.estado !== 'aprobado') return false;
    if (!x.salidaReal) return x.fechaSalida === hoy;
    return !x.regresoReal && x.fechaRegreso === hoy && !!x.horaRegreso; // permiso por horas: regresa el mismo día
  })[0];
  if (!p) return null;
  var cat = Motor.PERMISOS.filter(function (x) { return x.id === p.tipo; })[0] || {};
  return { id: p.id, tipoNombre: cat.nombre || p.tipo, fechaSalida: p.fechaSalida, horaSalida: p.horaSalida || '', fechaRegreso: p.fechaRegreso, horaRegreso: p.horaRegreso || '',
    regresaHoy: p.fechaRegreso === hoy && !!p.horaRegreso, fase: p.salidaReal ? 'regresar' : 'salir', salidaReal: p.salidaReal ? p.salidaReal.substr(11, 5) : '' };
}
// ---------- Jornada sin almuerzo: la persona lo reporta con quién lo autorizó y por qué; un jefe lo aprueba ----------
function autorizadores_(u) {
  var l = [];
  leer('Usuarios').forEach(function (x) {
    if (x.estado !== 'activo' || x.cedula === u.cedula || ['admin', 'supervisor'].indexOf(x.rol) < 0) return;
    if (!veA_(x, u)) return;
    l.push({ id: 'u:' + x.cedula, nombre: x.nombre, cargo: x.rol === 'admin' ? 'Administración' : (x.cargo || 'Supervisor') });
  });
  jefes_().forEach(function (j) { l.push({ id: 'j:' + j.id, nombre: j.nombre, cargo: j.cargo || 'Jefe' }); });
  return l;
}
function a_autorizadores(d, u) { return autorizadores_(u); }
function a_sinAlmuerzo(d, u) {
  var a = ahora_(), h = estadoHoy_(u, leer('Marcaciones', colaMarc_()));
  if (!h.marcas.entrada) throw E_('DATOS', 'Primero marca tu entrada de hoy.');
  if (h.marcas.sal_alm) throw E_('DATOS', 'Ya marcaste salida a almuerzo hoy.');
  if (h.sinAlmuerzo) throw E_('DATOS', 'Ya reportaste que hoy no saliste a almuerzo.');
  var razon = txt_(d.razon, 300); if (razon.length < 5) throw E_('DATOS', 'Escribe la razón por la que no saliste a almuerzo.');
  var aut = txt_(d.autoriza, 60), nom = '';
  var op = autorizadores_(u).filter(function (x) { return x.id === aut; })[0];
  if (op) nom = op.nombre; else if (aut.indexOf('otro:') === 0 && txt_(aut.substr(5), 60).length >= 3) nom = txt_(aut.substr(5), 60); else throw E_('DATOS', 'Elige quién autorizó que no salieras a almuerzo.');
  var f = { id: id_(), cedula: u.cedula, fecha: a.fecha, autoriza: aut, autorizaNombre: nom, razon: razon, estado: 'pendiente', creado: a.iso, decididoPor: '', decididoEl: '', obs: '' };
  agregar('SinAlmuerzo', f);
  alertar_('sin_almuerzo', u.cedula, 'Reporta que hoy no salió a almuerzo. Autoriza: ' + nom + '. Razón: ' + razon + '. Apruébalo en Horas extra.');
  auditar_(u.cedula, 'sin_almuerzo', { id: f.id, autoriza: nom });
  var marc = leer('Marcaciones', colaMarc_());
  return { hoy: estadoHoy_(u, marc), resumen: resumen_(u, marc) };
}
function a_adminSinAlmuerzo(d, adm) {
  var al = alcance_(adm), hoy = ahora_().fecha;
  return leer('SinAlmuerzo').filter(function (x) { var p = buscar('Usuarios', 'cedula', x.cedula); return veA_(adm, p, al) && (x.estado === 'pendiente' || Motor.sumar(x.fecha, 30) >= hoy); })
    .map(function (x) { var p = buscar('Usuarios', 'cedula', x.cedula), c = p ? centroDe_(p.centroId) : null; return { id: x.id, cedula: x.cedula, nombre: p ? p.nombre : x.cedula, centro: c ? c.nombre : '', fecha: x.fecha, autorizaNombre: x.autorizaNombre, razon: x.razon, estado: x.estado, obs: x.obs }; })
    .sort(function (a, b) { return (a.estado === 'pendiente' ? 0 : 1) - (b.estado === 'pendiente' ? 0 : 1) || (a.fecha < b.fecha ? 1 : -1); });
}
function a_adminSinAlmuerzoDecidir(d, adm) {
  var x = buscar('SinAlmuerzo', 'id', txt_(d.id, 40)); if (!x) throw E_('DATOS', 'No se encontró el registro.');
  if (!enAlcance_(adm, x.cedula)) throw E_('PERMISO', 'Esa persona no está a tu cargo.');
  if (periodoCerrado_(x.fecha)) throw E_('CERRADO', 'No se puede cambiar: la nómina de esa quincena ya se cerró y se pagó. Si hay un error, pide al administrador una corrección en la quincena siguiente (bono o descuento).');
  var ok = d.decision === 'aprobar'; if (!ok && txt_(d.obs, 200).length < 5) throw E_('DATOS', 'Escribe por qué se rechaza.');
  x.estado = ok ? 'aprobado' : 'rechazado'; x.decididoPor = adm.cedula; x.decididoEl = ahora_().iso; x.obs = txt_(d.obs, 200); guardar('SinAlmuerzo', x);
  recalcularExtras_(x.cedula, x.fecha); // el tiempo de almuerzo pasa (o deja de pasar) a contar como trabajado
  auditar_(adm.cedula, 'sin_almuerzo_' + x.estado, { id: x.id, cedula: x.cedula, fecha: x.fecha });
  return { ok: true };
}
var _marcaPermiso = false; // solo lo activa a_permisoSalir en el servidor
// "Salir a mi permiso": deja constancia de la hora real de salida con ubicación y, si no vuelve hoy, cierra la jornada con la salida
function a_permisoSalir(d, u) {
  var a = ahora_(), p = buscar('Permisos', 'id', txt_(d.id, 40));
  if (!p || p.cedula !== u.cedula) throw E_('DATOS', 'No se encontró el permiso.');
  if (p.estado !== 'aprobado') throw E_('DATOS', 'Ese permiso todavía no está aprobado: no puedes salir con él.');
  if (p.salidaReal) throw E_('DATOS', 'Ya registraste la salida a este permiso a las ' + p.salidaReal.substr(11, 5) + '.');
  if (p.fechaSalida !== a.fecha) throw E_('DATOS', 'Este permiso es para el ' + p.fechaSalida + '. Solo puedes salir con él ese día.');
  var gps = isFinite(+d.lat) && isFinite(+d.lng) ? (+d.lat).toFixed(6) + ',' + (+d.lng).toFixed(6) : '';
  p.salidaReal = a.iso; p.gpsSalida = gps; guardar('Permisos', p);
  var marc = leer('Marcaciones', colaMarc_()), h = estadoHoy_(u, marc), cerro = false;
  var regresaHoy = p.fechaRegreso === a.fecha && !!p.horaRegreso;
  if (h.marcas.entrada && !h.marcas.salida && !regresaHoy) { // no vuelve hoy: la jornada termina al salir al permiso
    _marcaPermiso = true;
    try { a_marcar({ tipo: 'salida', lat: d.lat, lng: d.lng, prec: d.prec, centroId: h.centroId, id: 'PERM-' + p.id, motivo: 'Salida a permiso' }, u); cerro = true; }
    finally { _marcaPermiso = false; }
  }
  var cat = Motor.PERMISOS.filter(function (x) { return x.id === p.tipo; })[0] || {};
  if (p.horaSalida && a.iso.substr(11, 5) < p.horaSalida) alertar_('permiso_uso', u.cedula, 'Salió a su permiso (' + (cat.nombre || p.tipo) + ') a las ' + a.iso.substr(11, 5) + ', antes de la hora aprobada (' + p.horaSalida + ').');
  auditar_(u.cedula, 'permiso_salida', { id: p.id, hora: a.iso, gps: gps, cerroJornada: cerro });
  marc = leer('Marcaciones', colaMarc_());
  return { hora: a.iso.substr(11, 5), cerroJornada: cerro, regresaHoy: regresaHoy, hoy: estadoHoy_(u, marc), resumen: resumen_(u, marc) };
}
// Regreso de un permiso por horas el mismo día
function a_permisoRegresar(d, u) {
  var a = ahora_(), p = buscar('Permisos', 'id', txt_(d.id, 40));
  if (!p || p.cedula !== u.cedula || !p.salidaReal) throw E_('DATOS', 'No hay una salida a permiso para registrar el regreso.');
  if (p.regresoReal) throw E_('DATOS', 'Ya registraste el regreso a las ' + p.regresoReal.substr(11, 5) + '.');
  p.regresoReal = a.iso; p.gpsRegreso = isFinite(+d.lat) && isFinite(+d.lng) ? (+d.lat).toFixed(6) + ',' + (+d.lng).toFixed(6) : ''; guardar('Permisos', p);
  var tarde = p.horaRegreso && a.iso.substr(11, 5) > p.horaRegreso ? Math.round((isoMs_(a.iso) - isoMs_(a.fecha + 'T' + p.horaRegreso)) / 60000) : 0;
  if (tarde > (+cfg_().toleranciaMin || 0)) alertar_('permiso_uso', u.cedula, 'Regresó de su permiso a las ' + a.iso.substr(11, 5) + ', ' + tarde + ' min después de lo aprobado (' + p.horaRegreso + ').');
  auditar_(u.cedula, 'permiso_regreso', { id: p.id, hora: a.iso, tarde: tarde });
  var marc = leer('Marcaciones', colaMarc_());
  return { hora: a.iso.substr(11, 5), tarde: tarde, hoy: estadoHoy_(u, marc), resumen: resumen_(u, marc) };
}
function resumen_(u, marc) {
  var a = ahora_(), c = cfg_(), per = Motor.periodoDe(a.fecha, c.periodoNomina), L = legal_();
  var ins = insumos_(u, per.desde, per.hasta, a.fecha, marc), hoyD = null;
  ins.dias.forEach(function (d) { if (d.fecha === a.fecha) hoyD = d; });
  // el día de hoy aún abierto no debe contar como ausencia ni incompleto
  var liq = Motor.liquidarPeriodo(ins, L);
  liq.incompletos = liq.incompletos.filter(function (f) { return f !== a.fecha; });
  var resto = Motor.diasNomina(per.desde, per.hasta) - liq.diasNomina, vDia = (+u.salario || 0) / 30;
  var aux = (+u.salario || 0) <= L.smmlv * L.topeAuxSmmlv ? L.auxTransporte / 30 : 0;
  var proy = u.tipoPago === 'dia' ? liq.neto : liq.neto + Math.round(resto * (vDia * (1 - L.pctSalud - L.pctPension) + aux));
  var o = sinDetalle_(liq); o.proyeccion = proy; o.periodo = per;
  o.dias = ins.dias.filter(function (d) { return d.fecha >= per.desde; }).map(function (d) {
    var r = liq.porFecha[d.fecha] || {};
    return { fecha: d.fecha, entrada: d.entrada || '', salAlm: d.salAlm || '', entAlm: d.entAlm || '', salida: d.salida || '', min: r.trabajadoMin || 0, extra: r.extraCalculadaMin || 0, tarde: r.tardanzaMin || 0, incompleto: !!r.incompleto && d.fecha !== a.fecha };
  });
  return o;
}

/* ---------- Registro e ingreso ---------- */
function a_publico() { var c = cfg_(), o = { version: VERSION, hayAdmin: leer('Usuarios').some(function (u) { return u.rol === 'admin' && u.hash; }) }; CFG_PUBLICAS.forEach(function (k) { o[k] = c[k]; }); return o; }

function a_consultarCedula(d) {
  var ced = soloDigitos_(d.cedula); if (ced.length < 5) throw E_('DATOS', 'Escribe tu número de cédula completo.');
  limite_('ced:' + ced, 12, 600);
  var u = buscar('Usuarios', 'cedula', ced);
  // No se revela nombre ni datos: solo si ya tiene contraseña.
  return { existe: !!(u && u.hash), inactivo: !!(u && u.estado === 'inactivo') };
}

function a_registro(d) {
  var ced = soloDigitos_(d.cedula), c = cfg_(), a = ahora_();
  if (ced.length < 5 || ced.length > 12) throw E_('DATOS', 'La cédula no es válida.');
  limite_('reg:' + ced, 6, 900);
  bloqueado_('regcod', 30);
  var clave = String(d.clave || ''); if (claveDebil_(clave, ced)) throw E_('DATOS', 'Elige una contraseña de al menos 6 caracteres que no sea tu cédula ni una secuencia fácil (como 123456).');
  var cons = d.consentimiento || {};
  if (!cons.datos || !cons.sensibles) throw E_('CONSENTIMIENTO', 'Para usar la aplicación debes autorizar el tratamiento de tus datos.');
  var cod = txt_(d.codigo, 40), u = buscar('Usuarios', 'cedula', ced), salario = Math.max(0, Math.round(+d.salario || 0));
  if (u && u.hash) throw E_('EXISTE', 'Esta cédula ya tiene contraseña. Ingresa con ella.');
  if (u && u.estado === 'inactivo') throw E_('PERMISO', 'Tu usuario está inactivo. Habla con el administrador.');
  var salt = azar_().substr(0, 16), rol = 'trabajador', estado = 'activo', codAdmin = prop_('CODIGO_ADMIN');
  if (codAdmin && cod === codAdmin) { rol = 'admin'; prop_('CODIGO_ADMIN', null); }
  else if (u) { if (!u.codigo || u.codigo !== hmac_('act|' + ced + '|' + cod)) { fallo_('regcod', 3600); throw E_('CODIGO', 'El código de activación no coincide. Pídelo al administrador.'); } rol = u.rol || 'trabajador'; }
  else {
    if (!c.autoRegistro) throw E_('CODIGO', 'Tu cédula aún no está cargada. Pide al administrador que te registre.');
    if (!c.codigoEmpresa || cod.toUpperCase() !== String(c.codigoEmpresa).toUpperCase()) { if (fallo_('regcod', 3600) === 30) alertar_('seguridad', '', 'Se acumularon 30 códigos de registro errados en una hora. El registro quedó bloqueado temporalmente.'); throw E_('CODIGO', 'El código de la empresa no coincide.'); }
    estado = 'pendiente';
  }
  var base = u || { cedula: ced, creado: a.iso, tipoPago: 'mensual' };
  base.nombre = base.nombre || txt_(d.nombre, 80); if (!base.nombre) throw E_('DATOS', 'Escribe tu nombre completo.');
  base.rol = rol; base.estado = estado; base.hash = hashClaveV2_(clave, salt); base.salt = salt; base.codigo = '';
  if (c.vincularDispositivo && d.dispositivoId) base.dispositivoId = txt_(d.dispositivoId, 80);
  if (base.salarioOk !== '1') { if (!salario) throw E_('DATOS', 'Escribe tu salario mensual.'); base.salario = salario; base.salarioOk = ''; }
  base.email = base.email || txt_(d.email, 120); base.telefono = base.telefono || soloDigitos_(d.telefono).substr(0, 15);
  base.cargo = base.cargo || txt_(d.cargo, 60); base.centroId = base.centroId || txt_(d.centroId, 20);
  base.consVersion = c.versionLegal; base.consFecha = a.iso;
  if (u) guardar('Usuarios', base); else agregar('Usuarios', base);
  auditar_(ced, 'registro', { rol: rol, estado: estado, consentimiento: c.versionLegal });
  if (estado === 'pendiente') alertar_('registro_nuevo', ced, 'Se registró con el código de la empresa y espera aprobación del administrador.');
  return { token: crearSesion_(ced, d.equipo), usuario: usuarioPublico_(base) };
}

// Al ingresar se devuelve de una vez lo que la aplicación pide después (a_yo): una vuelta menos al servidor
function conYo_(r, d, u) { try { r.yo = a_yo({ base: d.base }, buscar('Usuarios', 'cedula', u.cedula)); } catch (e) { } return r; }
function a_login(d) {
  var ced = soloDigitos_(d.cedula); limite_('login:' + ced, 30, 900); bloqueado_('lg:' + ced, 8); // el contador global solo alerta: si bloqueara, cualquiera podría dejar a la empresa sin ingreso
  var u = buscar('Usuarios', 'cedula', ced);
  if (!u || !u.hash || !verificarClave_(String(d.clave || ''), u.salt, u.hash)) {
    fallo_('lg:' + ced, 900);
    if (fallo_('login', 600) === 30) alertar_('seguridad', '', 'Hubo 30 ingresos fallidos en 10 minutos desde distintas cédulas. Puede ser un intento de adivinar contraseñas.');
    throw E_('CREDENCIALES', 'La cédula o la contraseña no coinciden.');
  }
  // La clave se verifica sin bloqueo (es lo lento); solo lo que escribe toma el bloqueo
  return conBloqueo_(function () { _c = {}; return a_loginSigue_(d, buscar('Usuarios', 'cedula', ced)); });
}
function a_loginSigue_(d, u) {
  var ced = u.cedula;
  if (u.estado === 'inactivo') throw E_('PERMISO', 'Tu usuario está inactivo. Habla con el administrador.');
  var c = cfg_(), dev = txt_(d.dispositivoId, 80), cambio = false;
  if (c.vincularDispositivo && u.rol === 'trabajador') {
    if (!dev) throw E_('DISPOSITIVO', 'Esta empresa exige ingresar desde la aplicación en tu celular. Actualiza la aplicación e intenta de nuevo.');
    if (u.dispositivoId && u.dispositivoId !== dev) {
      alertar_('seguridad', u.cedula, 'Intentó ingresar desde un celular distinto al vinculado. Si cambió de celular, autorízalo en Personal → Editar → Liberar celular.');
      throw E_('DISPOSITIVO', 'Tu cuenta está vinculada a otro celular. Ya avisamos al administrador: cuando autorice el cambio, vuelve a ingresar desde este celular.');
    }
    if (!u.dispositivoId) { u.dispositivoId = dev; cambio = true; cerrarSesiones_(u.cedula); } // al vincular, se cierran las sesiones de otros equipos
  }
  if (c.admin2FA && u.rol === 'admin' && !u.email) throw E_('PERMISO', 'Tu cuenta de administrador no tiene correo y la empresa exige código por correo. Pide a otro administrador que registre tu correo.');
  if (c.admin2FA && u.rol === 'admin') {
    var cch2 = CacheService.getScriptCache(), k2 = '2fa:' + u.cedula, esperado = cch2.get(k2);
    if (!d.codigo2fa) {
      var cod2 = codigo6_(); cch2.put(k2, cod2, 300);
      correo_(u.email, 'Código de verificación de ingreso', 'Tu código de un solo uso para ingresar como administrador es: ' + cod2 + '\n\nVence en 5 minutos.');
      throw E_('2FA_REQUERIDO', 'Enviamos un código de verificación de 6 dígitos a tu correo.');
    }
    if (!esperado || !igualSeguro_(String(d.codigo2fa).trim(), esperado)) {
      fallo_('lg:' + ced, 900);
      throw E_('CREDENCIALES', 'El código de verificación no coincide o ya venció.');
    }
    cch2.remove(k2);
  }
  if (String(u.hash).indexOf('v3:') !== 0) { u.hash = hashClaveV2_(String(d.clave || ''), u.salt); cambio = true; } // migración transparente a v2
  if (cambio) guardar('Usuarios', u);
  CacheService.getScriptCache().remove('rl:login:' + ced);
  return conYo_({ token: crearSesion_(ced, d.equipo, u.rol), usuario: usuarioPublico_(u) }, d, u);
}
function a_salir(d, u, req) { cerrarSesiones_(u.cedula, sha_(String(req.t))); return {}; }
function a_salirTodas(d, u) { cerrarSesiones_(u.cedula); auditar_(u.cedula, 'cerrar_todas_sesiones', ''); return { ok: true }; }
function a_cambiarClave(d, u, req) {
  if (!verificarClave_(String(d.actual || ''), u.salt, u.hash)) throw E_('CREDENCIALES', 'La contraseña actual no coincide.');
  if (claveDebil_(d.nueva, u.cedula)) throw E_('DATOS', 'Elige una contraseña de al menos 6 caracteres que no sea tu cédula ni una secuencia fácil.');
  u.salt = azar_().substr(0, 16); u.hash = hashClaveV2_(String(d.nueva), u.salt); guardar('Usuarios', u);
  var mia = sha_(String(req.t)), cch = CacheService.getScriptCache(); // cierra las demás sesiones
  leer('Sesiones').filter(function (s) { return s.cedula === u.cedula && s.hash !== mia; }).sort(function (x, y) { return y._f - x._f; }).forEach(function (s) { cch.remove('ses:' + s.hash); borrar('Sesiones', s); }); auditar_(u.cedula, 'cambio_clave', ''); return {};
}
function a_consentir(d, u) {
  if (!d.datos || !d.sensibles) throw E_('CONSENTIMIENTO', 'Debes autorizar el tratamiento de datos para continuar.');
  u.consVersion = cfg_().versionLegal; u.consFecha = ahora_().iso; guardar('Usuarios', u); auditar_(u.cedula, 'consentimiento', u.consVersion); return { consVersion: u.consVersion };
}
function a_misDatos(d, u) {
  if (d.email !== undefined) u.email = txt_(d.email, 120);
  if (d.telefono !== undefined) u.telefono = soloDigitos_(d.telefono).substr(0, 15);
  if (d.salario !== undefined && u.salarioOk !== '1') u.salario = Math.max(0, Math.round(+d.salario || 0));
  guardar('Usuarios', u); return usuarioPublico_(u);
}

function a_yo(d, u) {
  if (u._kiosco) { var kc = centroDe_(u._kiosco), cf = cfg_(); return { kiosco: { centroId: u._kiosco, centro: kc ? kc.nombre : '', activadoPor: u.nombre }, ahora: ahora_().iso, version: VERSION, cfg: { empresa: cf.empresa, versionLegal: cf.versionLegal } }; }
  var c = cfg_(), a = ahora_(), marc = leer('Marcaciones', colaMarc_());
  if (u.rol === 'admin' && !c.urlApp && /^https:\/\//.test(d.base || '')) cfgSet_('urlApp', txt_(d.base, 200));
  var o = { usuario: usuarioPublico_(u), ahora: a.iso, version: VERSION, licencia: licenciaEfectiva_(),
    arranque: u.rol === 'admin' && (!centros_().length || !leer('Usuarios').some(function (x) { return x.rol === 'trabajador'; })),
    cfg: { marcarAlmuerzo: !!c.marcarAlmuerzo, empresa: c.empresa, versionLegal: c.versionLegal, recordatorioMin: c.recordatorioMin, periodoNomina: c.periodoNomina, diasAtrasManual: c.diasAtrasManual, geocercaEstricta: c.geocercaEstricta, horasLimitePermiso: c.horasLimitePermiso, compensarExtras: !!c.compensarExtras },
    centros: centros_().filter(function (x) { return x.activo; }).map(centroPub_), permisosCat: Motor.PERMISOS };
  if (u.estado !== 'activo') { o.centros = []; return o; } // sin aprobar no se entregan datos de la empresa
  o.hoy = estadoHoy_(u, marc); o.resumen = resumen_(u, marc);
  var tomadas = 0; leer('Permisos').forEach(function (p) { if (p.cedula === u.cedula && p.tipo === 'vacaciones' && p.estado === 'aprobado') tomadas += Motor.diasHabiles(p.fechaSalida, Motor.sumar(p.fechaRegreso, -1), legal_(), sabadoHabil_(p.cedula)); });
  o.vacaciones = { causadas: Motor.vacacionesCausadas(u.ingreso, a.fecha), tomadas: tomadas };
  return o;
}

/* ---------- Marcaciones ---------- */
var _marcaKiosco = false; // lo activa solo a_kioscoMarcar en el servidor; nunca viene del cliente
function a_marcar(d, u) {
  if (u.estado !== 'activo') throw E_('PERMISO', 'Tu usuario aún no ha sido aprobado por el administrador.');
  if (d.cedula && soloDigitos_(d.cedula) !== u.cedula) throw E_('AJENA', 'Esta marcación pertenece a otra persona que usó este celular. Debe enviarla ella al ingresar con su cuenta.');
  var c = cfg_(), a = ahora_(), tipo = d.tipo, marc = leer('Marcaciones', colaMarc_());
  if (TIPOS.indexOf(tipo) < 0) throw E_('DATOS', 'Tipo de marcación no válido.');
  var mid = txt_(d.id, 40) || id_();
  for (var i = marc.length - 1; i >= 0 && i > marc.length - 3000; i--) if (marc[i].id === mid) return { repetida: true, hoy: estadoHoy_(u, marc), resumen: resumen_(u, marc) }; // reintento seguro
  var lat = +d.lat, lng = +d.lng;
  if (d.lat === undefined || d.lat === null || d.lat === '' || isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw E_('GPS_REQUERIDO', 'No se puede marcar sin ubicación. Activa el GPS y da permiso a la aplicación.');
  var manual = !!d.manual, offline = !!d.offline && !manual, hora = a.iso;
  if (manual || offline) {
    hora = String(d.hora || '').substr(0, 16);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(hora)) throw E_('DATOS', 'La hora no es válida.');
    var dif = isoMs_(a.iso) - isoMs_(hora);
    if (dif < -5 * 60000) throw E_('DATOS', 'No se puede marcar una hora que aún no llega.');
    if (dif > (c.diasAtrasManual + 1) * 86400000) throw E_('DATOS', 'Solo puedes corregir marcaciones de los últimos ' + c.diasAtrasManual + ' días. Pide el ajuste al administrador.');
    if (manual && txt_(d.motivo, 200).length < 5) throw E_('DATOS', 'Explica brevemente por qué no marcaste a tiempo.');
  }
  // ¿A qué jornada pertenece?
  var fecha = /^\d{4}-\d\d-\d\d$/.test(d.fecha || '') && manual ? d.fecha : hora.substr(0, 10);
  if (fecha !== hora.substr(0, 10) && fecha !== Motor.sumar(hora.substr(0, 10), -1)) throw E_('DATOS', 'El día de la jornada no corresponde con la hora indicada.');
  var cerca = diasDe_(marc, u.cedula, Motor.sumar(fecha, -1), fecha), dia = null, prev = null;
  cerca.forEach(function (x) { if (x.fecha === fecha) dia = x; else prev = x; });
  if (tipo !== 'entrada' && !dia && prev && prev.entrada && !prev.salida && sigueTurno_(u, prev, prev.fecha, hora)) { dia = prev; fecha = prev.fecha; }
  if (periodoCerrado_(fecha)) throw E_('CERRADO', 'Ese día ya pertenece a una nómina cerrada. Habla con el administrador.');
  var tiene = {}; if (dia) dia.marcas.forEach(function (m) { tiene[m.tipo] = m.hora; });
  if (tiene[tipo]) throw E_('DUPLICADA', 'Ya registraste "' + NOMBRE_TIPO[tipo] + '" en esta jornada (' + tiene[tipo].substr(11, 5) + ').');
  if (tipo !== 'entrada' && !tiene.entrada) throw E_('ORDEN', 'Primero registra tu entrada. Si se te olvidó, puedes digitar la hora en que llegaste.');
  tiene[tipo] = hora; var ant = null;
  TIPOS.forEach(function (t) { if (!tiene[t]) return; if (ant && isoMs_(tiene[t]) < isoMs_(ant)) throw E_('ORDEN', 'La hora de "' + NOMBRE_TIPO[t] + '" no puede ser anterior a la marcación anterior.'); ant = tiene[t]; });
  if (isoMs_(tiene[tipo]) - isoMs_(tiene.entrada) > 20 * 3600000) throw E_('ORDEN', 'La jornada no puede durar más de 20 horas. Revisa la hora.');
  // Centro, geocerca (polígono o radio), QR dinámico y detección anti-spoofing
  var prec = Math.round(+d.prec || 0);
  var imprecisa = !manual && +c.maxPrecisionGps > 0 && prec > +c.maxPrecisionGps;
  if (imprecisa && !d.offline) throw E_('GPS_IMPRECISO', 'La señal GPS es muy imprecisa (' + prec + ' m). Muévete a un lugar despejado e intenta de nuevo.');
  var centro = (c.soloCentroAsignado && u.centroId) ? centroDe_(u.centroId) : (centroDe_(txt_(d.centroId, 20)) || centroDe_(u.centroId));
  var dist = '', enZona = '', sospechoso = !!d.gpsSospechoso, motivoSosp = sospechoso ? 'Lectura GPS repetida o sintética.' : '';
  var qrDia = false;
  if (centro && centro.exigirQr && !_marcaKiosco && !_marcaPermiso) { // la tablet del kiosco está físicamente en la obra
    var reciente = isoMs_(a.iso) - isoMs_(hora) < 15 * 60000;
    if (!manual || reciente) {
      var q = validarQrCentro_(centro.id, d.qrCodigo, offline ? hora.substr(0, 10) : a.fecha, offline ? a.ms - (isoMs_(a.iso) - isoMs_(hora)) : 0);
      if (!q) throw E_('QR_REQUERIDO', 'Este centro exige escanear el código QR de la obra o escribir el código del día.');
      qrDia = q === 'dia';
      if (offline && isoMs_(a.iso) - isoMs_(hora) > 30 * 60000) { sospechoso = true; motivoSosp = 'QR de obra presentado más de 30 min después de la hora declarada (sin conexión).'; }
    }
  }
  if (centro && centro.poligono && centro.poligono.length >= 3) {
    if (centro.lat !== null && centro.lng !== null) dist = distancia_(lat, lng, centro.lat, centro.lng);
    enZona = enPoligono_(lat, lng, centro.poligono) ? '1' : '0';
  } else if (centro && centro.lat !== null && centro.lng !== null) {
    dist = distancia_(lat, lng, centro.lat, centro.lng); enZona = dist <= centro.radio + Math.min(prec, 50) ? '1' : '0';
  }
  if (qrDia && enZona !== '1') { // el código del día no prueba presencia: exige estar dentro de la obra
    if (!offline) throw E_('QR_REQUERIDO', 'El código del día solo sirve dentro de la obra. Escanea el QR de la portería.');
    sospechoso = true; motivoSosp = motivoSosp || 'Usó el código del día sin conexión y fuera de la geocerca.';
  }
  if (enZona === '0' && c.geocercaEstricta && !manual) throw E_('FUERA_ZONA', 'Estás fuera de ' + centro.nombre + (dist !== '' ? ' (a ' + dist + ' m)' : '') + '. Acércate al centro de trabajo para marcar.');
  // Velocidad imposible respecto a la marcación anterior del mismo día
  if (dia && dia.marcas && dia.marcas.length) {
    var ultM = null;
    for (var mi = dia.marcas.length - 1; mi >= 0; mi--) { if (dia.marcas[mi].lat !== '' && dia.marcas[mi].lng !== '') { ultM = dia.marcas[mi]; break; } }
    if (ultM) {
      var dPrev = distancia_(lat, lng, +ultM.lat, +ultM.lng), dtH = Math.abs(isoMs_(hora) - isoMs_(ultM.hora)) / 3600000;
      if (dPrev > 500 && dtH > 0 && (dPrev / 1000) / dtH > 150) { sospechoso = true; motivoSosp = 'Desplazamiento imposible: ' + dPrev + ' m en ' + Math.round(dtH * 60) + ' min.'; }
    }
  }
  // Foto aleatoria u obligatoria por anomalía
  var anomaliaFoto = c.fotoEnAnomalia && (enZona === '0' || sospechoso || prec > 60);
  var exigida = !manual && !_marcaPermiso && (fotoRequerida_(u.cedula, fecha, tipo) || anomaliaFoto), fotoId = '', estado = (manual || sospechoso) ? 'revisar' : 'ok';
  if (sospechoso) alertar_('gps_sospechoso', u.cedula, motivoSosp + ' (' + NOMBRE_TIPO[tipo] + ', ' + hora.replace('T', ' ') + ')');
  var tardio = offline && isoMs_(a.iso) - isoMs_(hora) > 20 * 60000; if (tardio || (imprecisa && offline)) estado = 'revisar'; // llegó sin conexión con hora del celular: la revisa el administrador
  if (d._fotoPre) fotoId = d._fotoPre;
  else if (d.foto) fotoId = guardarImagen_(d.foto, u.cedula + '_' + hora.replace(/[:T]/g, '-') + '_' + tipo + '.jpg', 'CARPETA_FOTOS');
  else if (exigida) { if (!offline) throw E_('FOTO_REQUERIDA', 'Esta marcación pide una foto. Tómala para continuar.'); estado = 'revisar'; }
  var hor = (dia && dia.horario) || horarioDe_(centro, fecha, u.cedula);
  var fila = { id: mid, cedula: u.cedula, fecha: fecha, tipo: tipo, hora: hora, servidor: a.iso, lat: lat.toFixed(6), lng: lng.toFixed(6), prec: String(Math.round(+d.prec || 0)), dist: String(dist), enZona: enZona,
    centroId: centro ? centro.id : '', foto: fotoId, fotoExigida: exigida ? '1' : '', manual: manual ? '1' : '', motivo: manual ? txt_(d.motivo, 200) : '', estado: estado, horario: hor ? JSON.stringify(hor) : '', origen: manual ? 'manual' : offline ? 'sin_conexion' : 'en_linea', editadoPor: '' };
  agregar('Marcaciones', fila); fila._f = hoja_('Marcaciones').getLastRow(); marc.push(fila); _c['Marcaciones|30000'] = marc; // evita releer toda la hoja
  // Alertas
  if (tipo === 'entrada' && hor && Motor.aMin(hora.substr(11, 5)) > Motor.aMin(hor.e) + (+hor.tol || 0))
    alertar_('tardanza', u.cedula, 'Marcó entrada a las ' + hora.substr(11, 5) + ' (horario ' + hor.e + ')' + (centro ? ' en ' + centro.nombre : '') + '. Retraso: ' + (Motor.aMin(hora.substr(11, 5)) - Motor.aMin(hor.e)) + ' min.');
  if (enZona === '0') alertar_('fuera_zona', u.cedula, NOMBRE_TIPO[tipo] + ' a ' + dist + ' m de ' + centro.nombre + ' (radio permitido ' + centro.radio + ' m). Consulta la ubicación en el panel, sección Marcaciones.');
  if (tardio) alertar_('marcacion_manual', u.cedula, '"' + NOMBRE_TIPO[tipo] + '" del ' + fecha + ' a las ' + hora.substr(11, 5) + ' se registró sin conexión y llegó al servidor ' + Math.round((isoMs_(a.iso) - isoMs_(hora)) / 60000) + ' min después. La hora es la del celular: revísala.');
  if (manual) alertar_('marcacion_manual', u.cedula, 'Digitó "' + NOMBRE_TIPO[tipo] + '" del ' + fecha + ' a las ' + hora.substr(11, 5) + '. El motivo está en Marcaciones.');
  if (exigida && !fotoId) alertar_('sin_foto', u.cedula, NOMBRE_TIPO[tipo] + ' del ' + fecha + ' llegó sin la foto exigida (se registró sin conexión).');
  if (tipo === 'salida' || tiene.salida) recalcularExtras_(u.cedula, fecha, marc);
  return { id: mid, deshacerSeg: manual || offline ? 0 : 120, hora: hora, fecha: fecha, enZona: enZona, dist: dist, hoy: estadoHoy_(u, marc), resumen: resumen_(u, marc) };
}

function a_bloqueo(d, u) {
  limite_('blq:' + u.cedula, 4, 3600);
  alertar_('bloqueo_permisos', u.cedula, (d.que === 'camara' ? 'Canceló o bloqueó la cámara' : 'Bloqueó o no activó la ubicación (GPS)') + ' al intentar marcar "' + (NOMBRE_TIPO[d.tipo] || '') + '". No pudo registrar la marcación.');
  return {};
}

// Deshacer un toque equivocado: solo la última marcación propia, hecha en línea hace menos de 2 minutos
function a_marcarDeshacer(d, u) {
  var marc = leer('Marcaciones', colaMarc_()), m = null, a = ahora_();
  for (var i = marc.length - 1; i >= 0; i--) if (marc[i].cedula === u.cedula && marc[i].estado !== 'anulada') { m = marc[i]; break; }
  if (!m || m.id !== String(d.id || '')) throw E_('DATOS', 'Solo se puede deshacer tu última marcación.');
  if (m.manual === '1' || isoMs_(a.iso) - isoMs_(m.servidor) > 125000) throw E_('DATOS', 'Ya pasaron los 2 minutos para deshacer. Si te equivocaste, pide el ajuste a tu jefe.');
  if (periodoCerrado_(m.fecha)) throw E_('CERRADO', 'Esa quincena ya se cerró.');
  m.estado = 'anulada'; m.editadoPor = u.cedula; m.motivo = 'Deshecha por el trabajador (toque equivocado)'; guardar('Marcaciones', m);
  auditar_(u.cedula, 'marcacion_deshecha', { id: m.id, tipo: m.tipo, hora: m.hora });
  if (m.tipo === 'salida') recalcularExtras_(u.cedula, m.fecha, marc);
  return { tipo: m.tipo, hoy: estadoHoy_(u, marc), resumen: resumen_(u, marc) };
}
// Entrar rápido con PIN o huella desde el mismo celular. El celular guarda un secreto largo; el servidor solo su huella (hash).
function a_accesoCrear(d, u) {
  if (u.rol === 'admin') throw E_('PERMISO', 'Los administradores entran siempre con su contraseña.');
  var modo = d.modo === 'huella' ? 'huella' : 'pin', pin = soloDigitos_(d.pin);
  if (modo === 'pin' && (pin.length < 4 || pin.length > 6 || /^(\d)\1+$/.test(pin) || '0123456789'.indexOf(pin) >= 0 || '9876543210'.indexOf(pin) >= 0)) throw E_('DATOS', 'Elige un PIN de 4 a 6 números que no sea fácil (ni 1234 ni 1111).');
  leer('Accesos').filter(function (x) { return x.cedula === u.cedula; }).reverse().forEach(function (x) { borrar('Accesos', x); }); // uno por persona: el último celular
  var sec = azar_(), id = id_();
  agregar('Accesos', { id: id, cedula: u.cedula, secreto: sha_(sec), pin: modo === 'pin' ? hmac_(id + '|' + pin) : '', modo: modo, intentos: '0', creado: ahora_().iso, usado: '', equipo: txt_(d.equipo, 120) });
  auditar_(u.cedula, 'acceso_rapido_creado', { modo: modo });
  return { id: id, secreto: sec, modo: modo };
}
function a_accesoBorrar(d, u) { leer('Accesos').filter(function (x) { return x.cedula === u.cedula; }).reverse().forEach(function (x) { borrar('Accesos', x); }); return { ok: true }; }
function a_loginRapido(d) {
  return conBloqueo_(function () { return a_loginRapidoYa_(d); });
}
function a_loginRapidoYa_(d) {
  var x = buscar('Accesos', 'id', txt_(d.id, 40)), fallo = function () { throw E_('CREDENCIALES', 'El PIN no coincide.'); };
  if (!x || !igualSeguro_(sha_(String(d.secreto || '')), x.secreto)) throw E_('ACCESO_RAPIDO', 'El acceso rápido de este celular ya no sirve. Entra con tu cédula y contraseña y vuélvelo a crear.');
  if (x.modo === 'pin' && !igualSeguro_(hmac_(x.id + '|' + soloDigitos_(d.pin)), x.pin)) {
    x.intentos = String(+x.intentos + 1); if (+x.intentos >= 5) { borrar('Accesos', x); throw E_('ACCESO_RAPIDO', 'Fallaste el PIN 5 veces y se desactivó. Entra con tu cédula y contraseña.'); }
    guardar('Accesos', x); fallo();
  }
  var u = buscar('Usuarios', 'cedula', x.cedula); if (!u || u.estado !== 'activo' || u.rol === 'admin') throw E_('ACCESO_RAPIDO', 'Tu usuario no está activo. Habla con el administrador.');
  x.intentos = '0'; x.usado = ahora_().iso; guardar('Accesos', x);
  return conYo_({ token: crearSesion_(u.cedula, d.equipo, u.rol), usuario: usuarioPublico_(u) }, d, u);
}
// Dudas y novedades de nómina: el trabajador escribe a la persona de nómina y ve la respuesta
var TEMAS_CONSULTA = { pago: 'Mi pago no cuadra', extras: 'Horas extra', descuento: 'Un descuento', marcacion: 'Una marcación', otro: 'Otra duda o novedad' };
function a_consultaCrear(d, u) {
  var texto = txt_(d.texto, 800).trim(); if (texto.length < 8) throw E_('DATOS', 'Cuéntanos un poco más (mínimo 8 letras).');
  var tema = TEMAS_CONSULTA[d.tema] ? d.tema : 'otro', fecha = /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : '';
  limite_('cons:' + u.cedula, 10, 86400);
  var x = { id: id_(), cedula: u.cedula, tema: tema, fecha: fecha, texto: texto, estado: 'abierta', creado: ahora_().iso, respuesta: '', respondidoPor: '', respondidoEl: '' };
  agregar('Consultas', x);
  alertar_('duda_nomina', u.cedula, TEMAS_CONSULTA[tema] + (fecha ? ' (día ' + fecha + ')' : '') + ':\n' + texto + '\n\nRespóndela en el panel: Pago → Guía de nómina → Dudas de trabajadores.');
  return { id: x.id };
}
function a_consultasMias(d, u) { return leer('Consultas').filter(function (x) { return x.cedula === u.cedula; }).reverse().slice(0, 20).map(function (x) { return { id: x.id, tema: TEMAS_CONSULTA[x.tema], fecha: x.fecha, texto: x.texto, estado: x.estado, creado: x.creado, respuesta: x.respuesta, respondidoEl: x.respondidoEl }; }); }
function a_adminConsultas(d, adm) {
  var us = {}; leer('Usuarios').forEach(function (u) { us[u.cedula] = u; }); var al = alcance_(adm);
  return leer('Consultas').filter(function (x) { return us[x.cedula] && (adm.rol === 'admin' || veA_(adm, us[x.cedula], al)) && (d.todas || x.estado === 'abierta'); }).reverse().slice(0, 200)
    .map(function (x) { return { id: x.id, cedula: x.cedula, nombre: us[x.cedula].nombre, tema: TEMAS_CONSULTA[x.tema], fecha: x.fecha, texto: x.texto, estado: x.estado, creado: x.creado, respuesta: x.respuesta }; });
}
function a_adminConsultaResponder(d, adm) {
  var x = buscar('Consultas', 'id', txt_(d.id, 40)); if (!x) throw E_('DATOS', 'No se encontró la consulta.');
  if (adm.rol !== 'admin' && !enAlcance_(adm, x.cedula)) throw E_('PERMISO', 'Esa persona no está a tu cargo.');
  var r = txt_(d.respuesta, 800).trim(); if (r.length < 3) throw E_('DATOS', 'Escribe la respuesta.');
  x.respuesta = r; x.estado = 'respondida'; x.respondidoPor = adm.cedula; x.respondidoEl = ahora_().iso; guardar('Consultas', x);
  agregar('Comunicados', { id: id_(), titulo: 'Respuesta a tu duda de nómina', cuerpo: 'Preguntaste: «' + x.texto.substr(0, 160) + '»\n\n' + r, centros: '[]', creadoPor: adm.cedula, creado: ahora_().iso, leidos: '{}', cedulas: JSON.stringify([x.cedula]) });
  var u = buscar('Usuarios', 'cedula', x.cedula); if (u && u.email) correo_(u.email, 'Respuesta a tu duda de nómina', 'Hola ' + u.nombre.split(' ')[0] + ':\n\n' + r);
  auditar_(adm.cedula, 'consulta_respondida', { id: x.id, cedula: x.cedula });
  return { ok: true };
}
// Datos para la guía de nómina: las reglas vigentes que usa el motor y, para el trabajador, sus propios valores
function a_guiaNomina(d, u) {
  var L = legal_(), c = cfg_(), hoy = ahora_().fecha;
  var sal = +u.salario || 0, porDia = u.tipoPago === 'diario', vHora = sal ? Math.round(porDia ? sal * 30 / L.divisorMensual : sal / L.divisorMensual) : 0;
  return { smmlv: L.smmlv, auxTransporte: L.auxTransporte, topeAuxSmmlv: L.topeAuxSmmlv, jornadaSemanalH: L.jornadaSemanalH, divisorMensual: L.divisorMensual, nocheInicio: L.nocheInicio, nocheFin: L.nocheFin,
    recargoNocturno: L.recargoNocturno, extraDiurna: L.extraDiurna, extraNocturna: L.extraNocturna, recargoDominical: Motor.recDominical(hoy, L), maxExtraDiaH: L.maxExtraDiaH, maxExtraSemanaH: L.maxExtraSemanaH,
    pctSalud: L.pctSalud, pctPension: L.pctPension, pctIncapGeneral: L.pctIncapGeneral, maxOrdinariaDiaH: L.maxOrdinariaDiaH, periodicidad: c.periodoNomina || 'quincenal',
    yo: { salario: sal, tipoPago: u.tipoPago || 'mensual', valorHora: vHora, rol: u.rol, conAuxilio: sal > 0 && sal <= L.smmlv * L.topeAuxSmmlv } };
}
function recalcularExtras_(cedula, fecha, marc) {
  var L = legal_(), lun = Motor.lunesDe(fecha), dom = Motor.sumar(lun, 6), liq = Motor.liquidarDias(marcarLibres_(diasDe_(marc || leer('Marcaciones', colaMarc_()), cedula, lun, dom), buscar('Usuarios', 'cedula', cedula)), L, null), sem = 0;
  var filas = {}; leer('Extras').forEach(function (x) { if (x.cedula === cedula && x.fecha >= lun && x.fecha <= dom) filas[x.fecha] = x; });
  for (var f = lun; f <= dom; f = Motor.sumar(f, 1)) {
    var calc = liq[f] ? liq[f].extraCalculadaMin : 0, x = filas[f]; sem += calc;
    if (!x && calc >= 10) {
      agregar('Extras', { id: cedula + '|' + f, cedula: cedula, fecha: f, minCalc: calc, minAprob: '', estado: 'pendiente' });
      if (calc > L.maxExtraDiaH * 60) alertar_('extras_tope', cedula, 'El ' + f + ' registró ' + (Math.round(calc / 6) / 10) + ' h extra. El máximo legal es ' + L.maxExtraDiaH + ' h por día.');
    } else if (x && +x.minCalc !== calc && !periodoCerrado_(f)) {
      x.minCalc = calc;
      if (calc < 10) { x.estado = 'sin_extra'; x.minAprob = ''; }
      else if (x.estado !== 'pendiente') { x.estado = 'pendiente'; x.minAprob = ''; x.obs = 'Se recalculó tras un cambio en las marcaciones; requiere nueva aprobación.'; }
      guardar('Extras', x);
    }
  }
  if (sem > L.maxExtraSemanaH * 60) alertar_('extras_tope', cedula, 'En la semana del ' + lun + ' acumula ' + (Math.round(sem / 6) / 10) + ' h extra. El máximo legal es ' + L.maxExtraSemanaH + ' h por semana.');
}

function a_historial(d, u) {
  var a = ahora_(), desde = /^\d{4}-\d\d-\d\d$/.test(d.desde || '') ? d.desde : a.fecha.substr(0, 8) + '01', hasta = /^\d{4}-\d\d-\d\d$/.test(d.hasta || '') ? d.hasta : Motor.ultimoDia(desde);
  if (Motor.diasEntre(desde, hasta) > 62) throw E_('DATOS', 'Consulta máximo dos meses a la vez.');
  var dias = diasDe_(marcDesde_(Motor.lunesDe(desde)), u.cedula, Motor.lunesDe(desde), hasta), liq = Motor.liquidarDias(dias, legal_(), null);
  return dias.filter(function (x) { return x.fecha >= desde; }).map(function (x) {
    var r = liq[x.fecha];
    return { fecha: x.fecha, entrada: x.entrada || '', salAlm: x.salAlm || '', entAlm: x.entAlm || '', salida: x.salida || '', min: r.trabajadoMin, extra: r.extraCalculadaMin, tarde: r.tardanzaMin, incompleto: r.incompleto && x.fecha !== a.fecha,
      manual: x.marcas.some(function (m) { return m.manual; }), festivo: Motor.esFestivo(x.fecha, legal_()) };
  });
}

/* ---------- Permisos ---------- */
function jefes_() { return leer('Jefes').filter(function (j) { return j.activo !== '0'; }); }
function tokenFirma_(pid, jid) { return hmac_('firma|' + pid + '|' + jid).substr(0, 28); }
function enlaceFirma_(pid, jid) { return (cfg_().urlApp || '').replace(/[#?].*$/, '') + '#/firma/' + pid + '.' + jid + '.' + tokenFirma_(pid, jid); }
function permisoPub_(p, conEnlaces) {
  var firmas = json_(p.firmas, []), u = buscar('Usuarios', 'cedula', p.cedula), cat = Motor.PERMISOS.filter(function (x) { return x.id === p.tipo; })[0] || {};
  var o = { salidaReal: p.salidaReal || '', regresoReal: p.regresoReal || '', id: p.id, cedula: p.cedula, nombre: u ? u.nombre : '', cargo: u ? u.cargo : '', tipo: p.tipo, tipoNombre: cat.nombre || p.tipo, norma: cat.norma || '', cat: p.cat, remunerado: p.remunerado === '1',
    fechaSalida: p.fechaSalida, horaSalida: p.horaSalida, fechaRegreso: p.fechaRegreso, horaRegreso: p.horaRegreso, motivo: p.motivo, soporte: p.soporte, estado: p.estado, creado: p.creado, limite: p.limite,
    decididoPor: p.decididoPor, decididoEl: p.decididoEl, obs: p.obs,
    firmas: firmas.map(function (f) { return { id: f.id, nombre: f.nombre, cargo: f.cargo, estado: f.estado, fecha: f.fecha, obs: f.obs, firma: f.firma, whatsapp: conEnlaces ? f.whatsapp : undefined, enlace: conEnlaces && f.estado === 'pendiente' ? enlaceFirma_(p.id, f.id) : undefined }; }) };
  return o;
}
function a_permisoCrear(d, u, req, adm) {
  if (u.estado !== 'activo') throw E_('PERMISO', adm ? 'Esa persona no está activa.' : 'Tu usuario aún no ha sido aprobado.');
  var c = cfg_(), a = ahora_(), cat = Motor.PERMISOS.filter(function (x) { return x.id === d.tipo; })[0];
  if (!cat) throw E_('DATOS', 'Elige el tipo de permiso.');
  var re = /^\d{4}-\d\d-\d\d$/, rh = /^\d\d:\d\d$/;
  if (!re.test(d.fechaSalida || '') || !re.test(d.fechaRegreso || '')) throw E_('DATOS', 'Completa la fecha de salida y la de regreso.');
  if (d.fechaRegreso < d.fechaSalida) throw E_('DATOS', 'El regreso no puede ser antes de la salida.');
  var hs = rh.test(d.horaSalida || '') ? d.horaSalida : '', hr = rh.test(d.horaRegreso || '') ? d.horaRegreso : '';
  if (d.fechaSalida === d.fechaRegreso) { if (!hs || !hr) throw E_('DATOS', 'Para un permiso dentro del mismo día indica hora de salida y de regreso.'); if (hr <= hs) throw E_('DATOS', 'La hora de regreso debe ser posterior a la de salida.'); }
  if (txt_(d.motivo, 500).length < 5) throw E_('DATOS', 'Escribe el motivo del permiso.');
  if (!adm && cat.cat !== 'calamidad' && d.fechaSalida < Motor.sumar(a.fecha, -c.diasAtrasManual)) throw E_('DATOS', 'Esa fecha es demasiado antigua para pedir el permiso desde la aplicación. Habla con tu jefe o con Gestión Humana.');
  if (adm && periodoCerrado_(d.fechaSalida)) throw E_('CERRADO', 'No se puede cambiar: la nómina de esa quincena ya se cerró y se pagó. Si hay un error, pide al administrador una corrección en la quincena siguiente (bono o descuento).');
  if (!adm) limite_('perm:' + u.cedula, 10, 3600);
  var pid = id_(), centro = u.centroId;
  var firmas = adm ? [] : jefes_().filter(function (j) { var cs = json_(j.centros, []); return !cs.length || cs.indexOf(centro) >= 0; })
    .map(function (j) { return { id: j.id, nombre: j.nombre, cargo: j.cargo, whatsapp: j.whatsapp, estado: 'pendiente', fecha: '', obs: '', firma: '' }; });
  var p = { id: pid, cedula: u.cedula, tipo: cat.id, cat: cat.cat, remunerado: cat.rem ? '1' : '', fechaSalida: d.fechaSalida, horaSalida: hs, fechaRegreso: d.fechaRegreso, horaRegreso: hr, motivo: txt_(d.motivo, 500),
    soporte: d.soporte ? guardarImagen_(d.soporte, 'soporte_' + u.cedula + '_' + pid + '.jpg', 'CARPETA_FOTOS') : '', estado: adm ? 'aprobado' : firmas.length ? 'en_firmas' : 'firmado', creado: a.iso,
    limite: String(a.ms + c.horasLimitePermiso * 3600000), firmas: JSON.stringify(firmas), decididoPor: adm ? adm.cedula : '', decididoEl: adm ? a.iso : '', obs: adm ? 'Registrado por la administración' + (d.obs ? ': ' + txt_(d.obs, 200) : '') : '' };
  if (adm && !cat.rem && d.remunerado) p.remunerado = '1';
  agregar('Permisos', p);
  if (adm) { auditar_(adm.cedula, 'permiso_registrado', { id: p.id, cedula: u.cedula, tipo: p.tipo, desde: p.fechaSalida, hasta: p.fechaRegreso }); return permisoPub_(p, false); }
  var resumen = cat.nombre + '\nSale: ' + p.fechaSalida + ' ' + hs + '\nRegresa: ' + p.fechaRegreso + ' ' + hr + '\nMotivo: ' + p.motivo;
  jefes_().forEach(function (j) { if (j.email && firmas.some(function (f) { return f.id === j.id; })) correo_(j.email, 'Permiso por firmar: ' + u.nombre, u.nombre + ' (C.C. ' + u.cedula + ') solicita:\n' + resumen + '\n\nFirma o rechaza aquí (necesitas tu clave de firma):\n' + enlaceFirma_(pid, j.id)); });
  alertar_('permiso_nuevo', u.cedula, cat.nombre + '. Sale: ' + p.fechaSalida + ' ' + hs + '. Regresa: ' + p.fechaRegreso + ' ' + hr + '. El motivo está en Permisos.'); // los datos de salud no se copian a alertas ni a Telegram
  return permisoPub_(p, true);
}
function a_adminPermisoRegistrar(d, adm) { var u = buscar('Usuarios', 'cedula', soloDigitos_(d.cedula)); if (!u) throw E_('DATOS', 'Elige la persona.'); return a_permisoCrear(d, u, null, adm); }
function a_permisosMios(d, u) { return leer('Permisos').filter(function (p) { return p.cedula === u.cedula; }).reverse().slice(0, 60).map(function (p) { return permisoPub_(p, p.estado === 'en_firmas'); }); }
function a_permisoCancelar(d, u) {
  var p = buscar('Permisos', 'id', d.id); if (!p || p.cedula !== u.cedula) throw E_('DATOS', 'No se encontró el permiso.');
  if (['en_firmas', 'firmado', 'vencido'].indexOf(p.estado) < 0) throw E_('DATOS', 'Este permiso ya fue resuelto y no se puede cancelar.');
  p.estado = 'cancelado'; guardar('Permisos', p); auditar_(u.cedula, 'permiso_cancelado', p.id); return {};
}
function firmaValida_(d) {
  var pid = txt_(d.p, 20), jid = txt_(d.j, 20);
  if (!pid || !jid || String(d.k) !== tokenFirma_(pid, jid)) throw E_('ENLACE', 'El enlace de firma no es válido.');
  var p = buscar('Permisos', 'id', pid); if (!p) throw E_('ENLACE', 'El permiso ya no existe.');
  return p;
}
function a_firmaVer(d) {
  limite_('fv:' + txt_(d.p, 20), 60, 600);
  var p = firmaValida_(d), o = permisoPub_(p, false); o.jefeId = d.j; o.soporte = o.soporte ? '1' : '';
  o.firmas.forEach(function (f) { delete f.firma; }); o.empresa = cfg_().empresa; return o;
}
function a_firmaResponder(d) {
  var p = firmaValida_(d), jid = txt_(d.j, 20), a = ahora_();
  limite_('fr:' + p.id + jid, 6, 900); bloqueado_('pin:' + jid, 5); // tope por permiso y, sobre todo, por jefe: crear más permisos no da más intentos
  var j = buscar('Jefes', 'id', jid);
  if (!j || j.activo === '0' || !j.pin || j.pin !== hmac_('pin|' + jid + '|' + String(d.pin || ''))) {
    if (fallo_('pin:' + jid, 21600) === 5) { alertar_('seguridad', p.cedula, 'Cinco claves de firma erradas para ' + (j ? j.nombre : jid) + '. Su firma queda bloqueada 6 horas. Último permiso intentado: el de esta persona.'); if (j && j.email) correo_(j.email, 'Intentaron usar tu clave de firma', 'Hubo cinco intentos fallidos de firmar permisos a tu nombre. Tu firma queda bloqueada 6 horas. Si no fuiste tú, pide al administrador una clave nueva.'); }
    throw E_('CREDENCIALES', 'La clave de firma no coincide.');
  }
  if (p.estado !== 'en_firmas') throw E_('DATOS', 'Este permiso ya no está esperando firmas (estado: ' + p.estado + ').');
  var firmas = json_(p.firmas, []), f = firmas.filter(function (x) { return x.id === jid; })[0];
  if (!f) throw E_('ENLACE', 'No estás en la lista de firmantes de este permiso.');
  if (f.estado !== 'pendiente') throw E_('DATOS', 'Ya respondiste este permiso.');
  var aprueba = d.decision === 'aprobar';
  if (!aprueba && txt_(d.obs, 300).length < 5) throw E_('DATOS', 'Explica por qué lo rechazas.');
  if (aprueba && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]{200,30000}$/.test(d.firma || '')) throw E_('DATOS', 'Dibuja tu firma para aprobar.');
  f.estado = aprueba ? 'aprobado' : 'rechazado'; f.fecha = a.iso; f.obs = txt_(d.obs, 300); f.firma = aprueba ? d.firma : '';
  p.firmas = JSON.stringify(firmas);
  var c = cfg_(), u = buscar('Usuarios', 'cedula', p.cedula);
  if (!aprueba) { p.estado = 'rechazado'; p.obs = 'Rechazado por ' + f.nombre + ': ' + f.obs; }
  else if (firmas.every(function (x) { return x.estado === 'aprobado'; })) {
    p.estado = c.aprobacionFinalAdmin ? 'firmado' : 'aprobado';
    if (!c.aprobacionFinalAdmin) { p.decididoPor = 'firmas completas'; p.decididoEl = a.iso; }
  }
  guardar('Permisos', p); auditar_('jefe:' + jid, 'firma_permiso', { permiso: p.id, decision: f.estado });
  if (j.email) correo_(j.email, 'Constancia de tu respuesta', 'Se registró tu respuesta (' + f.estado + ') al permiso de ' + (u ? u.nombre : p.cedula) + ' el ' + a.iso.replace('T', ' ') + '.\nSi no fuiste tú, avisa de inmediato al administrador.');
  if (p.estado !== 'en_firmas') {
    alertar_('permiso_resuelto', p.cedula, 'Permiso del ' + p.fechaSalida + ': ' + (p.estado === 'firmado' ? 'todas las firmas completas, falta la aprobación final del administrador.' : p.estado + '. ' + p.obs));
    if (u && u.email) correo_(u.email, 'Tu permiso: ' + p.estado, 'Tu permiso del ' + p.fechaSalida + ' quedó en estado: ' + p.estado + '.\n' + p.obs);
  }
  return { estado: p.estado, miEstado: f.estado };
}

function a_desprendibles(d, u) {
  return leer('Nomina').filter(function (n) { return n.cedula === u.cedula; }).reverse().slice(0, 36).map(function (n) { return { id: n.id, desde: n.desde, hasta: n.hasta, neto: +n.neto, generado: n.generado, acuse: n.acuse || '', detalle: json_(n.detalle, {}) }; });
}
function a_error(d, u, req) {
  limite_('err', 120, 3600);
  registrarError_('cliente', { message: txt_(d.mensaje, 400), stack: txt_(d.detalle, 1500) }, { cedula: soloDigitos_(d.cedula), equipo: d.equipo, version: txt_(d.version, 20) });
  return {};
}

/* ---------- Nómina guiada: lo que hay que resolver antes de cerrar un periodo ---------- */
function a_adminNominaInconsistencias(d, adm) {
  var r = rango_(d, 62), hoy = ahora_().fecha, hasta = r.hasta < hoy ? r.hasta : Motor.sumar(hoy, -1), marc = leer('Marcaciones', colaMarc_()), us = {}, items = [];
  leer('Usuarios').forEach(function (u) { us[u.cedula] = u; });
  var nom = function (c) { return (us[c] || {}).nombre || c; }, add = function (id, nivel, titulo, ayuda, lista, destino) { if (lista.length) items.push({ id: id, nivel: nivel, titulo: titulo, ayuda: ayuda, cantidad: lista.length, detalle: lista.slice(0, 8), destino: destino }); };
  add('revisar', 'bloquea', 'Marcaciones por revisar', 'Digitadas a mano, tardías o fuera de la obra. Mientras estén pendientes no se puede cerrar.',
    marc.filter(function (m) { return m.estado === 'revisar' && m.fecha >= r.desde && m.fecha <= r.hasta; }).map(function (m) { return nom(m.cedula) + ' · ' + m.fecha + ' ' + (NOMBRE_TIPO_[m.tipo] || m.tipo); }), 'marcaciones');
  var sinSal = [];
  Object.keys(us).forEach(function (c) { if (us[c].estado !== 'activo' && us[c].estado !== 'inactivo') return; diasDe_(marc, c, r.desde, hasta).forEach(function (dd) { if (dd.entrada && !dd.salida) sinSal.push(nom(c) + ' · ' + dd.fecha); }); });
  add('sinSalida', 'revisar', 'Jornadas sin salida', 'Sin salida esos días no cuentan horas. Pide a la persona registrar el olvido o corrígelo en Marcaciones.', sinSal, 'marcaciones');
  add('extras', 'revisar', 'Horas extra sin decidir', 'Solo las aprobadas se pagan. Decide antes de cerrar.',
    leer('Extras').filter(function (x) { return x.estado === 'pendiente' && x.fecha >= r.desde && x.fecha <= r.hasta; }).map(function (x) { return nom(x.cedula) + ' · ' + x.fecha + ' · ' + Math.round(x.minCalc) + ' min'; }), 'extras');
  add('sinAlmuerzo', 'revisar', 'Jornadas sin almuerzo sin decidir', 'Si no se aprueban, se descuenta el almuerzo programado.',
    leer('SinAlmuerzo').filter(function (x) { return x.estado === 'pendiente' && x.fecha >= r.desde && x.fecha <= r.hasta; }).map(function (x) { return nom(x.cedula) + ' · ' + x.fecha; }), 'extras');
  add('permisos', 'revisar', 'Permisos sin decidir en el periodo', 'Un permiso no aprobado cuenta como ausencia.',
    leer('Permisos').filter(function (p) { return ['pendiente', 'en_firmas', 'firmado', 'vencido'].indexOf(p.estado) >= 0 && p.fechaSalida <= r.hasta && p.fechaRegreso >= r.desde; }).map(function (p) { return nom(p.cedula) + ' · ' + p.fechaSalida; }), 'permisos');
  add('salarios', 'revisar', 'Salarios sin validar', 'Confirma el salario de cada persona antes de pagar.',
    Object.keys(us).filter(function (c) { return us[c].estado === 'activo' && us[c].rol !== 'admin' && us[c].salarioOk !== '1'; }).map(nom), 'personal');
  add('banco', 'info', 'Personas sin cuenta bancaria', 'No saldrán en el archivo plano para el banco.',
    Object.keys(us).filter(function (c) { return us[c].estado === 'activo' && us[c].rol !== 'admin' && (!us[c].banco || !us[c].cuenta); }).map(nom), 'personal');
  var rev = {}; leer('Revisiones').forEach(function (x) { if (x.fecha >= r.desde && x.fecha <= r.hasta) rev[x.cedula + '|' + x.fecha] = 1; });
  var sinRev = 0; Object.keys(us).forEach(function (c) { if (us[c].estado === 'activo') diasDe_(marc, c, r.desde, hasta).forEach(function (dd) { if (dd.entrada && !rev[c + '|' + dd.fecha]) sinRev++; }); });
  if (sinRev) items.push({ id: 'sinRevision', nivel: 'info', titulo: 'Jornadas sin revisión del supervisor', ayuda: 'No impide cerrar, pero conviene que el supervisor confirme las horas.', cantidad: sinRev, detalle: [], destino: 'revision' });
  return { desde: r.desde, hasta: r.hasta, items: items, bloquea: items.some(function (x) { return x.nivel === 'bloquea'; }) };
}
var NOMBRE_TIPO_ = { entrada: 'entrada', sal_alm: 'salida a almuerzo', ent_alm: 'regreso de almuerzo', salida: 'salida' };

/* ---------- Revisión diaria del supervisor: confirma las horas de su gente o que no vino ---------- */
function a_supRevision(d, adm) {
  var a = ahora_(), f = /^\d{4}-\d\d-\d\d$/.test(d.fecha || '') ? d.fecha : a.fecha; if (f > a.fecha) f = a.fecha;
  var al = alcance_(adm), L = legal_(), marc = leer('Marcaciones', colaMarc_()), incs = leer('Incapacidades'), cs = {}, rev = {};
  centros_().forEach(function (c) { cs[c.id] = c; });
  leer('Revisiones').forEach(function (r) { if (r.fecha === f) rev[r.cedula] = r; });
  var filas = [];
  leer('Usuarios').forEach(function (u) {
    if (u.estado !== 'activo' || u.rol === 'admin' || u.cedula === adm.cedula || !veA_(adm, u, al)) return;
    var centro = cs[u.centroId], hor = horarioDe_(centro, f, u.cedula), dia = marcarLibres_(diasDe_(marc, u.cedula, f, f), u)[0];
    var liq = dia ? Motor.liquidarDias([dia], L, {})[f] : null, est;
    if (incs.some(function (i) { return i.cedula === u.cedula && i.desde <= f && f <= i.hasta; })) est = 'incapacidad';
    else if (dia && dia.entrada) est = dia.salida ? 'completa' : 'incompleta';
    else { var per = permisosAprobados_(u.cedula).filter(function (p) { return p.desde <= f && f <= p.hasta && !p.horas; })[0]; est = per ? 'permiso' : hor ? 'sin_marcas' : 'descanso'; }
    var r = rev[u.cedula], tarde = dia && dia.entrada && hor ? Math.max(0, Motor.aMin(dia.entrada) - Motor.aMin(hor.e) - (+hor.tol || 0)) : 0;
    filas.push({ cedula: u.cedula, nombre: u.nombre, cargo: u.cargo, centro: centro ? centro.nombre : '', estado: est, horario: hor ? hor.e + '–' + hor.s : '',
      entrada: dia ? dia.entrada || '' : '', salAlm: dia ? dia.salAlm || '' : '', entAlm: dia ? dia.entAlm || '' : '', salida: dia ? dia.salida || '' : '', tarde: tarde,
      trabajadoMin: liq ? liq.trabajadoMin : 0, extraMin: liq ? liq.extraCalculadaMin : 0, fueraZona: !!(dia && dia.marcas.some(function (m) { return m.enZona === '0'; })),
      revisarMarcas: !!(dia && dia.marcas.some(function (m) { return m.estado === 'revisar'; })),
      revision: r ? { estado: r.estado, nota: r.nota, por: (buscar('Usuarios', 'cedula', r.revisadoPor) || {}).nombre || r.revisadoPor, el: r.revisadoEl } : null });
  });
  filas.sort(function (x, y) { return (x.revision ? 1 : 0) - (y.revision ? 1 : 0) || x.nombre.localeCompare(y.nombre); });
  return { fecha: f, filas: filas, pendientes: filas.filter(function (x) { return !x.revision && x.estado !== 'descanso'; }).length };
}
function a_supRevisar(d, adm) {
  var a = ahora_(), f = /^\d{4}-\d\d-\d\d$/.test(d.fecha || '') ? d.fecha : ''; if (!f || f > a.fecha) throw E_('DATOS', 'La fecha no es válida: elige un día de hoy o anterior.');
  if (periodoCerrado_(f)) throw E_('CERRADO', 'No se puede cambiar: la nómina de esa quincena ya se cerró y se pagó. Si hay un error, pide al administrador una corrección en la quincena siguiente (bono o descuento).');
  var lista = (d.cedulas || [d.cedula]).map(soloDigitos_).filter(Boolean), est = ['ok', 'no_vino', 'novedad'].indexOf(d.estado) >= 0 ? d.estado : '';
  if (!est) throw E_('DATOS', 'Elige: horas correctas, no vino o novedad.');
  var nota = txt_(d.nota, 300); if (est !== 'ok' && nota.length < 5) throw E_('DATOS', est === 'no_vino' ? 'Escribe qué pasó (por ejemplo: no avisó, calamidad, se fue sin marcar).' : 'Describe la novedad.');
  var marc = leer('Marcaciones', colaMarc_()), L = legal_(), n = 0;
  lista.forEach(function (ced) {
    if (!enAlcance_(adm, ced)) throw E_('PERMISO', 'Una de las personas no está a tu cargo.');
    var u = buscar('Usuarios', 'cedula', ced), dia = marcarLibres_(diasDe_(marc, ced, f, f), u)[0];
    if (est === 'no_vino' && dia && dia.entrada) throw E_('DATOS', u.nombre + ' tiene marcaciones ese día: usa «Novedad» si algo no cuadra.');
    var liq = dia ? Motor.liquidarDias([dia], L, {})[f] : null, id = ced + '|' + f, r = buscar('Revisiones', 'id', id);
    var fila = { id: id, cedula: ced, fecha: f, estado: est, nota: nota, revisadoPor: adm.cedula, revisadoEl: a.iso, horasMin: String(liq ? liq.trabajadoMin : 0) };
    if (r) { for (var k in fila) r[k] = fila[k]; guardar('Revisiones', r); } else agregar('Revisiones', fila);
    if (est !== 'ok') alertar_('revision_novedad', ced, (est === 'no_vino' ? 'No vino el ' : 'Novedad en la jornada del ') + f + ': ' + nota + ' (revisó ' + adm.nombre + ').');
    n++;
  });
  auditar_(adm.cedula, 'revision_jornada', { fecha: f, estado: est, personas: n });
  return { revisadas: n };
}
// El supervisor fija la ubicación de su obra con el GPS de su celular, parado en la obra
function a_supUbicarObra(d, adm) {
  var c = centroDe_(txt_(d.centroId, 20)); if (!c) throw E_('DATOS', 'No se encontró la obra.');
  var al = alcance_(adm); if (al && !al[c.id]) throw E_('PERMISO', 'Esa obra no está a tu cargo.');
  var lat = +d.lat, lng = +d.lng, prec = +d.prec || 0, radio = Math.round(+d.radio || 0);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) throw E_('DATOS', 'No llegó una ubicación válida.');
  if (prec > 100) throw E_('DATOS', 'El GPS está impreciso (' + Math.round(prec) + ' m). Sal a cielo abierto y vuelve a intentarlo.');
  if (radio && (radio < 30 || radio > 2000)) throw E_('DATOS', 'El radio debe estar entre 30 y 2.000 metros.');
  var fila = buscar('Centros', 'id', c.id), antes = fila.lat + ',' + fila.lng;
  fila.lat = lat.toFixed(6); fila.lng = lng.toFixed(6); if (radio) fila.radio = String(radio);
  guardar('Centros', fila); _c = {};
  auditar_(adm.cedula, 'obra_ubicacion', { centro: c.id, antes: antes, ahora: fila.lat + ',' + fila.lng, precision: Math.round(prec), radio: fila.radio });
  if (adm.rol !== 'admin') alertar_('seguridad', adm.cedula, 'Cambió la ubicación de la obra ' + c.nombre + ' (antes ' + antes + ', ahora ' + fila.lat + ',' + fila.lng + ', precisión ' + Math.round(prec) + ' m).');
  return { ok: true, lat: +fila.lat, lng: +fila.lng, radio: +fila.radio };
}

/* =====================  ADMINISTRACIÓN  ===================== */
// El tablero se guarda 60 s por persona; cualquier escritura cambia la «generación» y lo invalida
function a_adminTablero(d, adm) {
  var cc = CacheService.getScriptCache(), k = 'tab:' + adm.cedula + ':' + (cc.get('gen') || '0') + ':' + sha_(JSON.stringify(d || {})).substr(0, 8), v = cc.get(k);
  if (v) { try { return JSON.parse(v); } catch (e) { } }
  var r = tableroYa_(d, adm), s = JSON.stringify(r); if (s.length < 90000) try { cc.put(k, s, 60); } catch (e) { }
  return r;
}
function tableroYa_(d, adm) {
  var al = alcance_(adm), enS = {}, a = ahora_(), L = legal_(), marc = leer('Marcaciones', colaMarc_()), ahoraMin = Motor.aMin(a.hora), filas = [], cuenta = { presente: 0, almuerzo: 0, salio: 0, ausente: 0, por_llegar: 0, permiso: 0, incapacidad: 0, descanso: 0, tarde: 0 };
  var incs = leer('Incapacidades'), cs = {}; centros_().forEach(function (c) { cs[c.id] = c; });
  leer('Usuarios').forEach(function (u) {
    if (u.estado !== 'activo' || !veA_(adm, u, al)) return; enS[u.cedula] = 1;
    var centro = cs[u.centroId], hor = horarioDe_(centro, a.fecha, u.cedula), d = diasDe_(marc, u.cedula, a.fecha, a.fecha)[0], est, tarde = 0;
    if (incs.some(function (i) { return i.cedula === u.cedula && i.desde <= a.fecha && a.fecha <= i.hasta; })) est = 'incapacidad';
    else if (d && d.salida) est = 'salio'; else if (d && d.salAlm && !d.entAlm) est = 'almuerzo'; else if (d && d.entrada) est = 'presente';
    else {
      var per = permisosAprobados_(u.cedula).filter(function (p) { return p.desde <= a.fecha && a.fecha <= p.hasta && !p.horas; })[0];
      est = per ? 'permiso' : !hor ? 'descanso' : ahoraMin < Motor.aMin(hor.e) + (+hor.tol || 0) ? 'por_llegar' : 'ausente';
    }
    if (d && d.entrada && d.horario && Motor.aMin(d.entrada) > Motor.aMin(d.horario.e) + (+d.horario.tol || 0)) { tarde = Motor.aMin(d.entrada) - Motor.aMin(d.horario.e); cuenta.tarde++; }
    cuenta[est]++;
    filas.push({ cedula: u.cedula, nombre: u.nombre, cargo: u.cargo, centro: centro ? centro.nombre : 'Sin centro', estado: est, entrada: d ? d.entrada || '' : '', salida: d ? d.salida || '' : '', tarde: tarde,
      fueraZona: !!(d && d.marcas.some(function (m) { return m.enZona === '0'; })) });
  });
  var res = { fecha: a.fecha, hora: a.hora, festivo: Motor.esFestivo(a.fecha, L), cuenta: cuenta, personas: filas,
    pendientes: { permisos: leer('Permisos').filter(function (p) { return p.estado === 'firmado' || p.estado === 'vencido'; }).length,
      enFirmas: leer('Permisos').filter(function (p) { return p.estado === 'en_firmas'; }).length,
      extras: leer('Extras').filter(function (x) { return x.estado === 'pendiente'; }).length,
      revisar: marc.filter(function (m) { return m.estado === 'revisar'; }).length,
      usuarios: leer('Usuarios').filter(function (u) { return u.estado === 'pendiente'; }).length,
      salarios: leer('Usuarios').filter(function (u) { return u.estado === 'activo' && u.salarioOk !== '1'; }).length } };
  if (al) res.pendientes = { permisos: 0, enFirmas: 0, usuarios: 0, salarios: 0,
    extras: leer('Extras').filter(function (x) { return x.estado === 'pendiente' && enS[x.cedula]; }).length, revisar: marc.filter(function (m) { return m.estado === 'revisar' && enS[m.cedula]; }).length };
  // Lo que necesita atención hoy (en el alcance de quien mira)
  var ayer = Motor.sumar(a.fecha, -1), veo = function (ced) { return !al || enS[ced]; }, revAyer = {};
  leer('Revisiones').forEach(function (r) { if (r.fecha === ayer) revAyer[r.cedula] = 1; });
  var sinSalida = [], sinRevisar = 0;
  leer('Usuarios').forEach(function (u) {
    if (u.estado !== 'activo' || u.rol === 'admin' || !veo(u.cedula)) return;
    var dA = diasDe_(marc, u.cedula, ayer, ayer)[0];
    if (dA && dA.entrada && !dA.salida) sinSalida.push({ cedula: u.cedula, nombre: u.nombre });
    if (dA && dA.entrada && !revAyer[u.cedula]) sinRevisar++;
  });
  res.atender = { dudas: (function () { try { return a_adminConsultas({}, adm).length; } catch (e) { return 0; } })(),
    noHanMarcado: filas.filter(function (x) { return x.estado === 'ausente'; }).length,
    revisar: res.pendientes.revisar, extras: res.pendientes.extras, permisos: res.pendientes.permisos + (al ? 0 : 0),
    sinAlmuerzo: leer('SinAlmuerzo').filter(function (x) { return x.estado === 'pendiente' && veo(x.cedula); }).length,
    ayerSinSalida: sinSalida.length, ayerSinSalidaNombres: sinSalida.slice(0, 5).map(function (x) { return x.nombre; }),
    sinRevisarAyer: sinRevisar,
    fatiga: leer('Alertas').filter(function (x) { return x.tipo === 'fatiga' && x.fecha >= ayer && veo(x.cedula); }).length,
    usuarios: res.pendientes.usuarios || 0
  };
  if (!al) { var cf = cfg_(), us = leer('Usuarios');
    res.pasos = { empresa: cf.empresa.nombre !== CFG_DEF.empresa.nombre, centros: centros_().length > 0, jefes: leer('Jefes').length > 0, alertas: !!cf.correoAlertas,
      personal: us.some(function (u) { return u.rol !== 'admin'; }), activos: us.some(function (u) { return u.rol !== 'admin' && u.hash; }) }; }
  res.rol = adm ? adm.rol : 'admin'; return res;
}

function a_adminPersonal() { return leer('Usuarios').map(usuarioPublico_); }
function a_adminPersonaGuardar(d, adm) {
  var ced = soloDigitos_(d.cedula); if (ced.length < 5 || ced.length > 12) throw E_('DATOS', 'La cédula no es válida.');
  var u = buscar('Usuarios', 'cedula', ced), nuevo = !u, cod = null;
  if (nuevo) {
    var activos = leer('Usuarios').filter(function (x) { return x.estado !== 'inactivo'; }).length, maxU = licenciaEfectiva_().maxUsuarios;
    if (activos >= maxU) throw E_('LIMITE_PLAN', 'Alcanzaste el límite de ' + maxU + ' personas de tu plan actual.');
    u = { cedula: ced, creado: ahora_().iso, estado: 'preregistrado', hash: '', salt: '' }; cod = codigo6_(); u.codigo = hmac_('act|' + ced + '|' + cod);
  }
  if (!txt_(d.nombre, 80)) throw E_('DATOS', 'Escribe el nombre.');
  u.nombre = txt_(d.nombre, 80); u.cargo = txt_(d.cargo, 60); u.rol = ['admin', 'supervisor'].indexOf(d.rol) >= 0 ? d.rol : 'trabajador'; u.centroId = txt_(d.centroId, 20);
  u.supCentros = JSON.stringify((d.supCentros || []).map(function (x) { return txt_(x, 20); }));
  if (d.supervisor !== undefined) { var sv = soloDigitos_(d.supervisor); if (sv) { var su = buscar('Usuarios', 'cedula', sv); if (!su || ['supervisor', 'admin'].indexOf(su.rol) < 0 || sv === ced) throw E_('DATOS', 'El supervisor elegido no es válido.'); } u.supervisor = sv; }
  u.banco = txt_(d.banco, 40); u.tipoCuenta = ['ahorros', 'corriente', ''].indexOf(d.tipoCuenta) >= 0 ? d.tipoCuenta || '' : ''; u.cuenta = soloDigitos_(d.cuenta).substr(0, 24);
  u.salario = Math.max(0, Math.round(+d.salario || 0)); u.salarioOk = u.salario ? '1' : ''; u.tipoPago = d.tipoPago === 'dia' ? 'dia' : 'mensual';
  u.email = txt_(d.email, 120); u.telefono = soloDigitos_(d.telefono).substr(0, 15); u.ingreso = /^\d{4}-\d\d-\d\d$/.test(d.ingreso || '') ? d.ingreso : ''; u.eps = txt_(d.eps, 60); u.arl = txt_(d.arl, 60);
  u.tipoContrato = ['indefinido', 'fijo', 'obra', 'aprendizaje', ''].indexOf(d.tipoContrato || '') >= 0 ? (d.tipoContrato || '') : '';
  u.finContrato = /^\d{4}-\d\d-\d\d$/.test(d.finContrato || '') ? d.finContrato : '';
  if (!nuevo && d.estado && ['activo', 'inactivo'].indexOf(d.estado) >= 0 && u.hash) {
    if (u.cedula === adm.cedula && d.estado === 'inactivo') throw E_('DATOS', 'No puedes desactivar tu propio usuario.');
    u.estado = d.estado; if (d.estado === 'inactivo') cerrarSesiones_(ced);
    u.retiro = d.estado === 'inactivo' ? (/^\d{4}-\d\d-\d\d$/.test(d.retiro || '') ? d.retiro : ahora_().fecha) : ''; // sin fecha de retiro se seguiría liquidando // la baja revoca el acceso de inmediato
  }
  if (!nuevo && u.cedula === adm.cedula && u.rol !== 'admin') throw E_('DATOS', 'No puedes quitarte el rol de administrador.');
  if (nuevo) agregar('Usuarios', u); else guardar('Usuarios', u);
  auditar_(adm.cedula, nuevo ? 'persona_creada' : 'persona_editada', { cedula: ced, estado: u.estado, rol: u.rol, salario: u.salario });
  return { usuario: usuarioPublico_(u), codigo: cod };
}
function a_adminPersonaCodigo(d, adm) { // nuevo código de activación (también sirve para restablecer la contraseña)
  var u = buscar('Usuarios', 'cedula', soloDigitos_(d.cedula)); if (!u) throw E_('DATOS', 'No se encontró la persona.');
  var cod = codigo6_(); u.codigo = hmac_('act|' + u.cedula + '|' + cod); u.hash = ''; u.salt = ''; if (u.estado !== 'inactivo') u.estado = 'preregistrado';
  guardar('Usuarios', u); cerrarSesiones_(u.cedula); auditar_(adm.cedula, 'codigo_activacion', u.cedula); return { codigo: cod };
}
function a_adminPersonaImportar(d, adm) {
  var filas = d.filas || [], res = []; if (filas.length > 300) throw E_('DATOS', 'Importa máximo 300 personas por archivo.');
  filas.forEach(function (f) {
    try { var ced = soloDigitos_(f.cedula); var ya = buscar('Usuarios', 'cedula', ced);
      if (ya) { var m = usuarioPublico_(ya); Object.keys(f).forEach(function (k) { if (f[k] !== '' && f[k] !== 0 && f[k] !== null) m[k] = f[k]; }); delete m.estado; a_adminPersonaGuardar(m, adm); res.push({ cedula: ced, nombre: m.nombre, resultado: 'Actualizada', codigo: '' }); return; }
      var r = a_adminPersonaGuardar(f, adm); res.push({ cedula: ced, nombre: r.usuario.nombre, resultado: 'Creada', codigo: r.codigo });
    } catch (e) { res.push({ cedula: f.cedula, nombre: f.nombre, resultado: 'Error: ' + e.message, codigo: '' }); }
  });
  return res;
}

function centrosVisibles_(adm) { var al = alcance_(adm); if (!al) return null; var m = {}; Object.keys(al).forEach(function (k) { m[k] = 1; }); leer('Usuarios').forEach(function (u) { if (u.supervisor === adm.cedula && u.centroId) m[u.centroId] = 1; }); return m; }
function a_adminCentros(d, adm) { var al = centrosVisibles_(adm); return centros_().filter(function (c) { return !al || al[c.id]; }).map(centroPub_); }
function a_adminQrCentro(d, adm) {
  var c = centroDe_(txt_(d.centroId, 20)); if (!c) throw E_('DATOS', 'Centro no encontrado.');
  var al = alcance_(adm); if (al && !al[c.id]) throw E_('PERMISO', 'No tienes acceso a este centro.');
  var a = ahora_(), seg = Math.max(30, +cfg_().qrVentanaSeg || 60), w = Math.floor(a.ms / (seg * 1000)), cod = codigoQrCentro_(c.id, w);
  return { centroId: c.id, centro: c.nombre, qrPayload: 'CJ:' + c.id + ':' + w + ':' + cod, codigoMinuto: cod, codigoDia: codigoDiaCentro_(c.id, a.fecha), vigenciaSeg: seg, expiraEnSeg: seg - Math.floor((a.ms / 1000) % seg) };
}
function a_adminCentroGuardar(d, adm) {
  var c = d.id ? buscar('Centros', 'id', d.id) : null, nuevo = !c; if (nuevo) c = { id: id_().substr(0, 8) };
  if (!txt_(d.nombre, 80)) throw E_('DATOS', 'Escribe el nombre del centro de trabajo.');
  var hor = {}, rh = /^\d\d:\d\d$/;
  for (var w = 0; w < 7; w++) { var h = (d.horario || {})[w]; if (h && rh.test(h.e || '') && rh.test(h.s || '')) hor[w] = { e: h.e, s: h.s, ai: rh.test(h.ai || '') && rh.test(h.af || '') ? h.ai : '', af: rh.test(h.ai || '') && rh.test(h.af || '') ? h.af : '' }; }
  c.nombre = txt_(d.nombre, 80); c.cliente = txt_(d.cliente, 80); c.direccion = txt_(d.direccion, 160);
  c.lat = d.lat === '' || d.lat === null || isNaN(+d.lat) ? '' : (+d.lat).toFixed(6); c.lng = d.lng === '' || d.lng === null || isNaN(+d.lng) ? '' : (+d.lng).toFixed(6);
  c.radio = Math.max(20, Math.round(+d.radio || cfg_().radioDefecto)); c.horario = JSON.stringify(hor); c.tol = d.tol === '' || d.tol === undefined ? '' : Math.max(0, Math.round(+d.tol));
  c.festivos = d.festivos ? '1' : ''; c.activo = d.activo === false ? '0' : '1';
  var poly = Array.isArray(d.poligono) ? d.poligono.filter(function (pt) { return Array.isArray(pt) && pt.length === 2 && !isNaN(+pt[0]) && !isNaN(+pt[1]); }).map(function (pt) { return [+(+pt[0]).toFixed(6), +(+pt[1]).toFixed(6)]; }) : [];
  c.poligono = poly.length >= 3 ? JSON.stringify(poly) : '';
  c.arlPct = +d.arlPct > 0 ? String(Math.min(6.96, Math.max(0.348, +d.arlPct))) : '';
  c.exigirQr = d.exigirQr ? '1' : '';
  c.presupuestoHoras = +d.presupuestoHoras > 0 ? String(Math.round(+d.presupuestoHoras)) : '';
  c.presupuestoCosto = +d.presupuestoCosto > 0 ? String(Math.round(+d.presupuestoCosto)) : '';
  if (nuevo) agregar('Centros', c); else guardar('Centros', c);
  // El horario nuevo aplica desde hoy: cada día ya fichado conserva la foto del horario con que se trabajó.
  auditar_(adm.cedula, nuevo ? 'centro_creado' : 'centro_editado', { id: c.id, nombre: c.nombre, horario: hor });
  return centroPub_(centroDe_(c.id));
}

function rango_(d, maxDias) {
  var a = ahora_(), re = /^\d{4}-\d\d-\d\d$/, desde = re.test(d.desde || '') ? d.desde : a.fecha, hasta = re.test(d.hasta || '') ? d.hasta : desde;
  if (hasta < desde) throw E_('DATOS', 'El rango de fechas no es válido.');
  if (Motor.diasEntre(desde, hasta) > (maxDias || 62)) throw E_('DATOS', 'Consulta máximo ' + (maxDias || 62) + ' días a la vez.');
  return { desde: desde, hasta: hasta, hoy: a.fecha };
}
function a_adminMarcaciones(d, adm) {
  var al = alcance_(adm);
  var r = rango_(d), marc = marcDesde_(Motor.lunesDe(r.desde)), L = legal_(), nombres = {}, cs = {}, out = [];
  leer('Usuarios').forEach(function (u) { if (veA_(adm, u, al)) nombres[u.cedula] = u.nombre; }); centros_().forEach(function (c) { cs[c.id] = c.nombre; });
  Object.keys(nombres).forEach(function (ced) {
    if (d.cedula && d.cedula !== ced) return;
    var dias = diasDe_(marc, ced, Motor.lunesDe(r.desde), r.hasta), liq = Motor.liquidarDias(dias, L, null);
    dias.forEach(function (x) {
      if (x.fecha < r.desde || (d.centroId && x.centroId !== d.centroId)) return; var q = liq[x.fecha];
      out.push({ cedula: ced, nombre: nombres[ced], fecha: x.fecha, centro: cs[x.centroId] || '', entrada: x.entrada || '', salAlm: x.salAlm || '', entAlm: x.entAlm || '', salida: x.salida || '',
        min: q.trabajadoMin, extra: q.extraCalculadaMin, tarde: q.tardanzaMin, incompleto: q.incompleto && x.fecha !== r.hoy, almuerzoAsumido: q.almuerzoAsumido, marcas: x.marcas, cerrado: periodoCerrado_(x.fecha) });
    });
  });
  return out.sort(function (a, b) { return a.fecha === b.fecha ? (a.nombre < b.nombre ? -1 : 1) : (a.fecha < b.fecha ? 1 : -1); });
}
function a_adminMarcacionGuardar(d, adm) { // el administrador corrige, agrega o anula una marcación; siempre queda en auditoría
  var re = /^\d{4}-\d\d-\d\d$/, ced = soloDigitos_(d.cedula);
  if (!re.test(d.fecha || '') || TIPOS.indexOf(d.tipo) < 0) throw E_('DATOS', 'Faltan datos: revisa que todos los campos estén llenos e intenta de nuevo.');
  if (periodoCerrado_(d.fecha)) throw E_('CERRADO', 'No se puede cambiar: la nómina de esa quincena ya se cerró y se pagó. Si hay un error, regístralo como bono o descuento en la quincena siguiente.');
  if (txt_(d.motivo, 200).length < 5) throw E_('DATOS', 'Escribe el motivo del ajuste.');
  var u = buscar('Usuarios', 'cedula', ced); if (!u) throw E_('DATOS', 'No se encontró la persona.');
  var marc = leer('Marcaciones'), act = null;
  marc.forEach(function (m) { if (m.cedula === ced && m.fecha === d.fecha && m.tipo === d.tipo && m.estado !== 'anulada') act = m; });
  var antes = act ? act.hora : '';
  if (d.anular) { if (!act) throw E_('DATOS', 'No hay marcación para anular.'); act.estado = 'anulada'; act.editadoPor = adm.cedula; act.motivo = txt_(d.motivo, 200); guardar('Marcaciones', act); }
  else {
    if (!/^\d\d:\d\d$/.test(d.hora || '')) throw E_('DATOS', 'La hora no es válida.');
    var dia = diasDe_(marc, ced, d.fecha, d.fecha)[0], ent = d.tipo === 'entrada' ? d.hora : dia && dia.entrada;
    var hora = (ent && d.tipo !== 'entrada' && d.hora < ent ? Motor.sumar(d.fecha, 1) : d.fecha) + 'T' + d.hora;
    if (act) { act.hora = hora; act.estado = 'ok'; act.editadoPor = adm.cedula; act.motivo = txt_(d.motivo, 200); guardar('Marcaciones', act); }
    else { var centro = centroDe_(u.centroId), hor = (dia && dia.horario) || horarioDe_(centro, d.fecha, ced);
      agregar('Marcaciones', { id: id_(), cedula: ced, fecha: d.fecha, tipo: d.tipo, hora: hora, servidor: ahora_().iso, centroId: centro ? centro.id : '', manual: '1', motivo: txt_(d.motivo, 200), estado: 'ok', horario: hor ? JSON.stringify(hor) : '', origen: 'administrador', editadoPor: adm.cedula }); }
  }
  auditar_(adm.cedula, d.anular ? 'marcacion_anulada' : 'marcacion_ajustada', { cedula: ced, fecha: d.fecha, tipo: d.tipo, antes: antes, despues: d.anular ? '' : d.hora, motivo: d.motivo });
  recalcularExtras_(ced, d.fecha); return {};
}
function a_adminMarcacionRevisada(d, adm) {
  var m = buscar('Marcaciones', 'id', d.id); if (!m) throw E_('DATOS', 'No se encontró la marcación.');
  m.estado = 'ok'; m.editadoPor = adm.cedula; guardar('Marcaciones', m); auditar_(adm.cedula, 'marcacion_revisada', m.id); return {};
}
function a_adminFoto(d, adm) {
  var id = txt_(d.id, 80), ok = leer('Marcaciones').some(function (m) { return m.foto === id; }) || leer('Permisos').some(function (p) { return p.soporte === id; }) || leer('Incapacidades').some(function (i) { return i.soporte === id; });
  if (ok && alcance_(adm)) { var mf = buscar('Marcaciones', 'foto', id); ok = !!(mf && enAlcance_(adm, mf.cedula)); } // el supervisor solo ve fotos de marcaciones de su gente
  if (!id || !ok) throw E_('DATOS', 'La foto ya no está: se borra automáticamente pasado el tiempo de conservación de la empresa.');
  try { var b = DriveApp.getFileById(id).getBlob(); return { url: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) }; }
  catch (e) { throw E_('DATOS', 'La foto fue eliminada por la política de retención.'); }
}

function a_adminPermisos(d, adm) { var sup = !!alcance_(adm); return leer('Permisos').filter(function (p) { return enAlcance_(adm, p.cedula); }).reverse().slice(0, 300).map(function (p) { var o = permisoPub_(p, !sup); if (sup) o.soporte = ''; return o; }); }
function a_adminPermisoDecidir(d, adm) {
  var p = buscar('Permisos', 'id', d.id); if (!p) throw E_('DATOS', 'No se encontró el permiso.');
  if (['firmado', 'en_firmas', 'vencido'].indexOf(p.estado) < 0) throw E_('DATOS', 'Este permiso ya fue resuelto.');
  if (periodoCerrado_(p.fechaSalida)) throw E_('CERRADO', 'La fecha del permiso pertenece a una nómina cerrada.');
  var aprueba = d.decision === 'aprobar';
  if ((p.estado !== 'firmado' || !aprueba) && txt_(d.obs, 300).length < 5) throw E_('DATOS', p.estado !== 'firmado' ? 'Faltan firmas. Para decidir sin ellas escribe la justificación.' : 'Escribe el motivo del rechazo.');
  p.estado = aprueba ? 'aprobado' : 'rechazado'; p.decididoPor = adm.cedula; p.decididoEl = ahora_().iso; p.obs = txt_(d.obs, 300);
  if (d.remunerado !== undefined && p.cat !== 'ley' && p.cat !== 'vacaciones') p.remunerado = d.remunerado ? '1' : '';
  guardar('Permisos', p); auditar_(adm.cedula, 'permiso_' + p.estado, { id: p.id, cedula: p.cedula, obs: p.obs });
  var u = buscar('Usuarios', 'cedula', p.cedula);
  if (u && u.email) correo_(u.email, 'Tu permiso fue ' + p.estado, 'Tu permiso del ' + p.fechaSalida + ' fue ' + p.estado + ' por la administración.' + (p.obs ? '\nObservación: ' + p.obs : ''));
  return permisoPub_(p, true);
}

function a_adminIncapacidades() {
  var n = {}; leer('Usuarios').forEach(function (u) { n[u.cedula] = u.nombre; });
  return leer('Incapacidades').reverse().map(function (i) { return { id: i.id, cedula: i.cedula, nombre: n[i.cedula] || '', tipo: i.tipo, desde: i.desde, hasta: i.hasta, dias: Motor.diasEntre(i.desde, i.hasta) + 1, entidad: i.entidad, nota: i.nota, soporte: i.soporte, creado: i.creado }; });
}
function a_adminIncapacidadGuardar(d, adm) {
  var re = /^\d{4}-\d\d-\d\d$/, ced = soloDigitos_(d.cedula);
  if (!buscar('Usuarios', 'cedula', ced)) throw E_('DATOS', 'Elige la persona.');
  if (!re.test(d.desde || '') || !re.test(d.hasta || '') || d.hasta < d.desde) throw E_('DATOS', 'Revisa las fechas de la incapacidad.');
  if (['general', 'laboral', 'maternidad', 'paternidad'].indexOf(d.tipo) < 0) throw E_('DATOS', 'Elige el tipo de incapacidad.');
  if (periodoCerrado_(d.desde)) throw E_('CERRADO', 'No se puede cambiar: la nómina de esa quincena ya se cerró y se pagó. Si hay un error, pide al administrador una corrección en la quincena siguiente (bono o descuento).');
  if (d.borrar) { var x = buscar('Incapacidades', 'id', d.id); if (x) { borrar('Incapacidades', x); auditar_(adm.cedula, 'incapacidad_borrada', { cedula: ced, desde: x.desde }); } return {}; }
  // Por minimización de datos (Ley 1581) NO se guarda el diagnóstico: solo fechas, tipo y entidad.
  var i = { id: id_(), cedula: ced, tipo: d.tipo, desde: d.desde, hasta: d.hasta, entidad: txt_(d.entidad, 80), nota: txt_(d.nota, 200),
    soporte: d.soporte ? guardarImagen_(d.soporte, 'incapacidad_' + ced + '_' + d.desde + '.jpg', 'CARPETA_FOTOS') : '', registradoPor: adm.cedula, creado: ahora_().iso };
  agregar('Incapacidades', i); auditar_(adm.cedula, 'incapacidad_creada', { cedula: ced, desde: i.desde, hasta: i.hasta, tipo: i.tipo }); return {};
}

function a_adminExtras(d, adm) {
  var al = alcance_(adm), enS = {}; if (al) leer('Usuarios').forEach(function (u) { if (veA_(adm, u, al)) enS[u.cedula] = 1; });
  var n = {}, L = legal_(), porSem = {}; leer('Usuarios').forEach(function (u) { n[u.cedula] = u.nombre; });
  var l = leer('Extras').filter(function (x) { return x.estado !== 'sin_extra' && (!d.estado || x.estado === d.estado) && (!al || enS[x.cedula]); });
  l.forEach(function (x) { var k = x.cedula + Motor.lunesDe(x.fecha); porSem[k] = (porSem[k] || 0) + (+x.minCalc || 0); });
  return l.reverse().slice(0, 500).map(function (x) {
    return { id: x.id, cedula: x.cedula, nombre: n[x.cedula] || '', fecha: x.fecha, minCalc: +x.minCalc, minAprob: x.minAprob === '' ? null : +x.minAprob, estado: x.estado, obs: x.obs, decididoPor: x.decididoPor,
      superaDia: +x.minCalc > L.maxExtraDiaH * 60, superaSemana: porSem[x.cedula + Motor.lunesDe(x.fecha)] > L.maxExtraSemanaH * 60, cerrado: periodoCerrado_(x.fecha) };
  });
}
function a_adminExtraDecidir(d, adm) {
  var x = buscar('Extras', 'id', d.id); if (!x) throw E_('DATOS', 'No se encontró el registro.');
  if (!enAlcance_(adm, x.cedula)) throw E_('PERMISO', 'Esa persona no pertenece a tus centros de trabajo.');
  if (periodoCerrado_(x.fecha)) throw E_('CERRADO', 'No se puede cambiar: la nómina de esa quincena ya se cerró y se pagó. Si hay un error, pide al administrador una corrección en la quincena siguiente (bono o descuento).');
  var L = legal_(), min = d.decision === 'aprobar' ? Math.round(+d.min) : 0;
  if (d.decision === 'aprobar') {
    if (!(min > 0) || min > +x.minCalc) throw E_('DATOS', 'Los minutos aprobados deben estar entre 1 y ' + x.minCalc + '.');
    if (min > L.maxExtraDiaH * 60 && !d.confirmaTope) throw E_('TOPE', 'Vas a aprobar más de ' + L.maxExtraDiaH + ' horas extra en un día, por encima del máximo legal. Confirma si cuentas con autorización del Ministerio del Trabajo.');
  }
  var aComp = d.decision === 'aprobar' && !!d.aCompensatorio, previo = buscar('Compensatorios', 'id', 'EXT|' + x.id);
  if (aComp && !cfg_().compensarExtras) throw E_('DATOS', 'Abonar horas extra a compensatorio está desactivado (Configuración → Reglas). El Ministerio del Trabajo considera que las horas extra se pagan con su recargo.');
  // 2. al cambiar la decisión no puede quedar saldo negativo (el descanso ya disfrutado no se devuelve)
  if (previo && saldoCompensatorio_(x.cedula) - (+previo.minutos || 0) < 0) throw E_('DATOS', 'Esas horas ya se tomaron como descanso: no se puede cambiar la decisión sin dejar el saldo en negativo.');
  if (aComp && !d.soporte) throw E_('DATOS', 'Adjunta la foto del acuerdo firmado con el trabajador para abonar a compensatorio.');
  if (aComp && txt_(d.obs, 200).length < 5) throw E_('DATOS', 'Para abonar a compensatorio escribe en la observación el acuerdo con el trabajador (por ejemplo: "acuerdo firmado del 3 de noviembre").');
  if (previo) borrar('Compensatorios', previo); // al cambiar la decisión se reversa el abono anterior: nunca queda doble
  var minComp = aComp ? minutosCompensatorio_(x, min) : 0;
  x.estado = d.decision === 'aprobar' ? 'aprobada' : 'rechazada'; x.minAprob = aComp ? 0 : min; x.decididoPor = adm.cedula; x.decididoEl = ahora_().iso; x.obs = txt_(d.obs, 200) + (d.confirmaTope ? ' [Aprobado por encima del tope legal]' : '') + (aComp ? ' [Abonado a banco de compensatorios: ' + min + ' min]' : '');
  guardar('Extras', x);
  if (aComp && min > 0) agregar('Compensatorios', { soporte: guardarImagen_(d.soporte, 'acuerdo_extra_' + x.cedula + '_' + x.fecha + '.jpg', 'CARPETA_FOTOS'), id: 'EXT|' + x.id, cedula: x.cedula, fecha: x.fecha, minutos: String(minComp), tipo: 'abono', motivo: min + ' min extra del ' + x.fecha + ' con su recargo = ' + minComp + ' min de descanso. ' + txt_(d.obs, 120), creadoPor: adm.cedula, creado: ahora_().iso });
  auditar_(adm.cedula, 'extra_' + x.estado, { cedula: x.cedula, fecha: x.fecha, min: min, tope: !!d.confirmaTope, aCompensatorio: aComp }); return {};
}

/* ---------- Horas extra en lote y novedades de pago (bonos, auxilios, descuentos) ---------- */
// Las horas extra llevan recargo (CST art. 168): el descanso equivalente es minutos × (1 + recargo de cada minuto).
function minutosCompensatorio_(x, min) {
  var u = buscar('Usuarios', 'cedula', x.cedula), L = legal_(), cfgM = Motor.cfg(L);
  var dias = marcarLibres_(diasDe_(leer('Marcaciones', colaMarc_()), x.cedula, Motor.lunesDe(x.fecha), x.fecha), u), ext = {}; ext[x.fecha] = min;
  var r = Motor.liquidarDias(dias, L, ext)[x.fecha]; if (!r) return Math.round(min * (1 + cfgM.extraDiurna));
  var rd = Motor.recDominical(x.fecha, cfgM);
  return Math.round(r.extDiu * (1 + cfgM.extraDiurna) + r.extNoc * (1 + cfgM.extraNocturna) + r.extDomDiu * (1 + cfgM.extraDiurna + rd) + r.extDomNoc * (1 + cfgM.extraNocturna + rd));
}
function a_adminExtrasLote(d, adm) {
  var L = legal_(), n = 0, a = ahora_(), ids = {}; (d.ids || []).forEach(function (x) { ids[x] = 1; });
  leer('Extras').forEach(function (x) {
    if (!ids[x.id] || x.estado !== 'pendiente' || +x.minCalc > L.maxExtraDiaH * 60 || periodoCerrado_(x.fecha) || !enAlcance_(adm, x.cedula)) return;
    x.estado = 'aprobada'; x.minAprob = x.minCalc; x.decididoPor = adm.cedula; x.decididoEl = a.iso; x.obs = 'Aprobada en lote'; guardar('Extras', x); n++;
  });
  auditar_(adm.cedula, 'extras_lote', { aprobadas: n }); return { aprobadas: n };
}
function a_adminNovedades(d) {
  var r = rango_(d, 62), n = {}; leer('Usuarios').forEach(function (u) { n[u.cedula] = u.nombre; });
  return leer('Novedades').filter(function (x) { return x.fecha >= r.desde && x.fecha <= r.hasta; }).reverse().map(function (x) {
    return { id: x.id, cedula: x.cedula, nombre: n[x.cedula] || x.cedula, fecha: x.fecha, concepto: x.concepto, valor: +x.valor, salarial: x.salarial === '1', nota: x.nota, cerrado: periodoCerrado_(x.fecha) }; });
}
function a_adminNovedadGuardar(d, adm) {
  if (d.borrar) { var x = buscar('Novedades', 'id', d.id); if (!x) return {}; if (periodoCerrado_(x.fecha)) throw E_('CERRADO', 'No se puede cambiar: la nómina de esa quincena ya se cerró y se pagó. Si hay un error, pide al administrador una corrección en la quincena siguiente (bono o descuento).'); borrar('Novedades', x); auditar_(adm.cedula, 'novedad_borrada', { cedula: x.cedula, concepto: x.concepto, valor: x.valor }); return {}; }
  var ceds = (d.cedulas || []).map(soloDigitos_).filter(function (c) { return buscar('Usuarios', 'cedula', c); }), valor = Math.round(+d.valor || 0);
  if (!ceds.length) throw E_('DATOS', 'Elige al menos una persona.');
  if (!/^\d{4}-\d\d-\d\d$/.test(d.fecha || '')) throw E_('DATOS', 'Indica la fecha: define en qué periodo se paga o descuenta.');
  if (periodoCerrado_(d.fecha)) throw E_('CERRADO', 'Esa fecha pertenece a una nómina cerrada. Usa una fecha del periodo abierto para hacer el ajuste.');
  if (!valor) throw E_('DATOS', 'Escribe el valor.'); if (txt_(d.concepto, 60).length < 3) throw E_('DATOS', 'Escribe el concepto (por ejemplo: Bono de alturas).');
  if (d.tipo === 'descuento') valor = -Math.abs(valor); else valor = Math.abs(valor);
  ceds.forEach(function (c) { agregar('Novedades', { id: id_(), cedula: c, fecha: d.fecha, concepto: txt_(d.concepto, 60), valor: valor, salarial: d.tipo === 'salarial' ? '1' : '', nota: txt_(d.nota, 200), creadoPor: adm.cedula, creado: ahora_().iso }); });
  auditar_(adm.cedula, 'novedad_creada', { personas: ceds.length, concepto: d.concepto, valor: valor, tipo: d.tipo }); return {};
}

/* ---------- Nómina ---------- */
function liquidarTodos_(desde, hasta, corte) {
  var marc = marcDesde_(Motor.lunesDe(desde)), L = legal_(), cs = {}; centros_().forEach(function (c) { cs[c.id] = c.nombre; });
  return leer('Usuarios').filter(function (u) { return !(u.liquidado && u.liquidado >= desde && u.liquidado <= hasta) && (u.estado === 'activo' || (u.estado === 'inactivo' && u.hash)) && +u.salario > 0; }).map(function (u) {
    var liq = Motor.liquidarPeriodo(insumos_(u, desde, hasta, corte, marc), L);
    return { cedula: u.cedula, nombre: u.nombre, cargo: u.cargo, centroId: u.centroId, centro: cs[u.centroId] || '', salario: +u.salario, salarioOk: u.salarioOk === '1', tipoPago: u.tipoPago || 'mensual', estado: u.estado, retiro: String(u.retiro || '').substr(0, 10), liq: liq };
  }).filter(function (x) { return x.estado === 'activo' || x.liq.diasTrabajados > 0 || (x.retiro && x.retiro >= desde && x.liq.devengado > 0); }); // retirado en o después de este periodo: se le paga aunque no haya marcado (vacaciones, incapacidad)
}
function a_adminNominaPrevia(d) {
  var r = rango_(d, 31), corte = r.hasta < r.hoy ? r.hasta : r.hoy;
  return { desde: r.desde, hasta: r.hasta, corte: corte, cerrado: periodoCerrado_(r.desde) || periodoCerrado_(r.hasta),
    porRevisar: marcDesde_(r.desde).filter(function (m) { return m.estado === 'revisar' && m.fecha >= r.desde && m.fecha <= r.hasta; }).length,
    extrasPendientes: leer('Extras').filter(function (x) { return x.estado === 'pendiente' && x.fecha >= r.desde && x.fecha <= r.hasta; }).length,
    permisosPendientes: leer('Permisos').filter(function (p) { return ['en_firmas', 'firmado', 'vencido'].indexOf(p.estado) >= 0 && p.fechaSalida <= r.hasta && p.fechaRegreso >= r.desde; }).length,
    filas: liquidarTodos_(r.desde, r.hasta, corte).map(function (x) { x.liq = sinDetalle_(x.liq); return x; }) };
}
function a_adminNominaCerrar(d, adm) {
  var r = rango_(d, 31), a = ahora_(), c = cfg_();
  if (r.hasta > r.hoy) throw E_('DATOS', 'El periodo aún no termina. Podrás cerrarlo desde el ' + Motor.sumar(r.hasta, 1) + '.');
  if (leer('Periodos').some(function (p) { return p.desde <= r.hasta && r.desde <= p.hasta; })) throw E_('CERRADO', 'Ya existe una nómina cerrada que cubre esas fechas.');
  var rev = marcDesde_(r.desde).filter(function (m) { return m.estado === 'revisar' && m.fecha >= r.desde && m.fecha <= r.hasta; }).length;
  if (rev) throw E_('REVISAR', 'Hay ' + rev + ' marcación(es) digitadas o tardías sin revisar en este periodo. Revísalas en Marcaciones antes de cerrar: con ellas se va a pagar.');
  var filas = liquidarTodos_(r.desde, r.hasta, r.hasta);
  // Cuotas de préstamos: una por préstamo y periodo, solo a quien se le liquida y sin bajar del mínimo legal
  if (d.descontarPrestamos !== false && moduloActivo_('prestamos') && aplicarCuotasPrestamos_(r, filas, adm).length) { _c = {}; filas = liquidarTodos_(r.desde, r.hasta, r.hasta); }
  filas.forEach(function (x) {
    var det = sinDetalle_(x.liq); det.empresa = { nombre: c.empresa.nombre, nit: c.empresa.nit }; det.persona = { nombre: x.nombre, cedula: x.cedula, cargo: x.cargo, centro: x.centro, salario: x.salario, tipoPago: x.tipoPago };
    agregar('Nomina', { id: r.desde + '|' + r.hasta + '|' + x.cedula, desde: r.desde, hasta: r.hasta, cedula: x.cedula, nombre: x.nombre, neto: x.liq.neto, detalle: JSON.stringify(det), generado: a.iso });
  });
  agregar('Periodos', { desde: r.desde, hasta: r.hasta, cerradoPor: adm.cedula, cerradoEl: a.iso });
  auditar_(adm.cedula, 'nomina_cerrada', { desde: r.desde, hasta: r.hasta, personas: filas.length, total: filas.reduce(function (s, x) { return s + x.liq.neto; }, 0) });
  return { personas: filas.length };
}
function a_adminNominas() {
  var tot = {}; leer('Nomina').forEach(function (n) { var k = n.desde + '|' + n.hasta; tot[k] = tot[k] || { n: 0, neto: 0 }; tot[k].n++; tot[k].neto += +n.neto; });
  return leer('Periodos').reverse().map(function (p) { var t = tot[p.desde + '|' + p.hasta] || { n: 0, neto: 0 }; return { desde: p.desde, hasta: p.hasta, cerradoPor: p.cerradoPor, cerradoEl: p.cerradoEl, personas: t.n, neto: t.neto }; });
}
function a_adminNominaDetalle(d) {
  return leer('Nomina').filter(function (n) { return n.desde === d.desde && n.hasta === d.hasta; }).map(function (n) { return { id: n.id, desde: n.desde, hasta: n.hasta, cedula: n.cedula, nombre: n.nombre, neto: +n.neto, generado: n.generado, acuse: n.acuse || '', detalle: json_(n.detalle, {}) }; });
}

function a_confirmarDesprendible(d, u) {
  var n = buscar('Nomina', 'id', txt_(d.id, 40));
  if (!n || n.cedula !== u.cedula) throw E_('DATOS', 'No se encontró ese desprendible.');
  if (n.acuse) return { acuse: n.acuse };
  n.acuse = ahora_().iso; guardar('Nomina', n);
  auditar_(u.cedula, 'desprendible_recibido', { id: n.id, desde: n.desde, hasta: n.hasta });
  return { acuse: n.acuse };
}

function a_adminLiberarDispositivo(d, adm) {
  var u = buscar('Usuarios', 'cedula', soloDigitos_(d.cedula));
  if (!u) throw E_('DATOS', 'No se encontró la persona.');
  u.dispositivoId = ''; guardar('Usuarios', u); cerrarSesiones_(u.cedula);
  auditar_(adm.cedula, 'liberar_dispositivo', u.cedula);
  return { ok: true };
}

// Supresión (Ley 1581 art. 8 lit. e). Se borra todo lo que no es obligatorio conservar. Se conservan, con la cédula,
// los registros de nómina, jornada y novedades exigidos por la ley laboral (CST art. 264, Ley 962 de 2005 art. 28) y la
// auditoría, que es prueba de integridad; las copias de seguridad desaparecen solas al rotar.
function a_adminAnonimizarUsuario(d, adm) {
  var u = buscar('Usuarios', 'cedula', soloDigitos_(d.cedula));
  if (!u) throw E_('DATOS', 'No se encontró la persona.');
  if (u.estado !== 'inactivo') throw E_('DATOS', 'Primero desactiva a la persona antes de suprimir sus datos personales.');
  var ced = u.cedula, n = { marcaciones: 0, permisos: 0, incapacidades: 0, archivos: 0 };
  var tirar = function (id) { if (!id) return; try { DriveApp.getFileById(id).setTrashed(true); n.archivos++; } catch (e) { } };
  u.nombre = 'Exempleado ' + sha_(ced + '|' + prop_('SECRETO')).substr(0, 8).toUpperCase();
  u.email = ''; u.telefono = ''; u.eps = ''; u.arl = ''; u.banco = ''; u.tipoCuenta = ''; u.cuenta = ''; u.cargo = '';
  u.dispositivoId = ''; u.hash = ''; u.salt = ''; u.codigo = ''; u.salario = '0'; u.supCentros = '';
  tirar(u.fotoRef); u.fotoRef = '';
  guardar('Usuarios', u); cerrarSesiones_(ced);
  leer('Marcaciones').forEach(function (m) { if (m.cedula !== ced) return; tirar(m.foto); m.lat = ''; m.lng = ''; m.prec = ''; m.dist = ''; m.foto = ''; m.motivo = m.motivo ? '[suprimido]' : ''; guardar('Marcaciones', m); n.marcaciones++; });
  leer('Permisos').forEach(function (p) { if (p.cedula !== ced) return; tirar(p.soporte); p.soporte = ''; p.motivo = '[suprimido]'; p.obs = ''; guardar('Permisos', p); n.permisos++; });
  leer('Incapacidades').forEach(function (x) { if (x.cedula !== ced) return; tirar(x.soporte); x.soporte = ''; x.nota = ''; x.entidad = ''; guardar('Incapacidades', x); n.incapacidades++; });
  leer('Prestamos').forEach(function (p) { if (p.cedula === ced && p.autorizacion && p.estado !== 'activo') { tirar(p.autorizacion); p.autorizacion = 'suprimida'; guardar('Prestamos', p); } });
  if (HOJAS.Certificados) leer('Certificados').filter(function (x) { return x.cedula === ced; }).sort(function (a, b) { return b._f - a._f; }).forEach(function (x) { borrar('Certificados', x); });
  leer('Comunicados').forEach(function (c) { var l = json_(c.leidos, {}); if (l[ced]) { delete l[ced]; c.leidos = JSON.stringify(l); guardar('Comunicados', c); } });
  leer('Alertas').forEach(function (x) { if (x.cedula === ced && x.detalle !== '[suprimido]') { x.detalle = '[suprimido]'; guardar('Alertas', x); } });
  leer('Errores').forEach(function (x) { if (x.cedula === ced) { x.detalle = ''; x.mensaje = '[suprimido]'; x.equipo = ''; guardar('Errores', x); } });
  suprimirEnHistorico_(ced);
  auditar_(adm.cedula, 'suprimir_datos', { marcaciones: n.marcaciones, permisos: n.permisos, incapacidades: n.incapacidades, archivos: n.archivos });
  return { ok: true, suprimido: n, conservado: 'Cédula, fechas y horas de jornada, nómina, novedades y auditoría: se conservan por obligación legal (CST art. 264; Ley 962 de 2005 art. 28).' };
}

function suprimirEnHistorico_(ced) {
  var id = prop_('CARPETA_HISTORICO'); if (!id) return;
  try {
    var arch = DriveApp.getFolderById(id).getFiles(), cols = HOJAS.Marcaciones, iC = cols.indexOf('cedula');
    while (arch.hasNext()) {
      var h = SpreadsheetApp.openById(arch.next().getId()).getSheetByName('Marcaciones'); if (!h || h.getLastRow() < 2) continue;
      var r = h.getRange(2, 1, h.getLastRow() - 1, cols.length), v = r.getValues(), cambio = false;
      v.forEach(function (f) { if (String(f[iC]).replace(/^'/, '') === ced) { ['lat', 'lng', 'prec', 'dist', 'foto', 'motivo'].forEach(function (k) { if (f[cols.indexOf(k)] !== '') { f[cols.indexOf(k)] = ''; cambio = true; } }); } });
      if (cambio) r.setValues(v);
    }
  } catch (e) { registrarError_('suprimir_historico', e); }
}
function a_adminIncapacidadEditar(d, adm) {
  var inc = buscar('Incapacidades', 'id', txt_(d.id, 40));
  if (!inc) throw E_('DATOS', 'No se encontró la incapacidad.');
  var re = /^\d{4}-\d\d-\d\d$/, desde = re.test(d.desde || '') ? d.desde : inc.desde, hasta = re.test(d.hasta || '') ? d.hasta : inc.hasta;
  if (hasta < desde) throw E_('DATOS', 'El rango de fechas no es válido.');
  if (periodoCerrado_(inc.desde) || periodoCerrado_(desde)) throw E_('CERRADO', 'La incapacidad toca un periodo de nómina cerrado.');
  inc.tipo = ['general', 'laboral', 'maternidad', 'paternidad'].indexOf(d.tipo) >= 0 ? d.tipo : inc.tipo;
  inc.desde = desde; inc.hasta = hasta;
  if (d.entidad !== undefined) inc.entidad = txt_(d.entidad, 60);
  if (d.nota !== undefined) inc.nota = txt_(d.nota, 200);
  guardar('Incapacidades', inc);
  auditar_(adm.cedula, 'incapacidad_editada', { id: inc.id, cedula: inc.cedula, desde: inc.desde, hasta: inc.hasta });
  return { ok: true };
}

function a_adminTrasladoMasivo(d, adm) {
  var centroId = txt_(d.centroId, 20), ceds = Array.isArray(d.cedulas) ? d.cedulas : [], sv = d.supervisor === undefined || d.supervisor === '' ? null : d.supervisor === '-' ? '' : soloDigitos_(d.supervisor);
  if (centroId && !centroDe_(centroId)) throw E_('DATOS', 'Selecciona un centro de trabajo válido.');
  if (!centroId && sv === null) throw E_('DATOS', 'Elige la nueva obra o el supervisor.');
  if (sv) { var su = buscar('Usuarios', 'cedula', sv); if (!su || ['supervisor', 'admin'].indexOf(su.rol) < 0) throw E_('DATOS', 'El supervisor elegido no es válido.'); }
  if (!ceds.length || ceds.length > 200) throw E_('DATOS', 'Selecciona entre 1 y 200 personas para trasladar.');
  var movidos = 0;
  ceds.forEach(function (c) {
    var u = buscar('Usuarios', 'cedula', soloDigitos_(c));
    if (!u || u.estado === 'inactivo') return;
    if (centroId) u.centroId = centroId; if (sv !== null && u.cedula !== sv) u.supervisor = sv; guardar('Usuarios', u); movidos++;
  });
  auditar_(adm.cedula, 'traslado_masivo', { centroId: centroId, supervisor: sv, cantidad: movidos, nota: txt_(d.nota, 120) });
  return { movidos: movidos };
}

function a_adminResumenObra(d) {
  var r = rango_(d, 62), corte = r.hasta < r.hoy ? r.hasta : r.hoy, marc = marcDesde_(Motor.lunesDe(r.desde)), L = legal_(), obras = {};
  function ob(id, nombre) { return obras[id] || (obras[id] = { centroId: id, centro: nombre, personas: 0, horas: 0, extras: 0, tardanzas: 0, ausencias: 0, costo: 0, dias: 0 }); }
  var cs = {}; centros_().forEach(function (c) { cs[c.id] = c.nombre; });
  liquidarTodos_(r.desde, r.hasta, corte).forEach(function (x) {
    var o = ob(x.centroId || '-', x.centro || 'Sin centro asignado'); o.personas++; o.ausencias += x.liq.ausencias; o.costo += x.liq.devengado;
    var porCentro = {}; diasDe_(marc, x.cedula, r.desde, r.hasta).forEach(function (dd) { porCentro[dd.fecha] = dd.centroId; });
    Object.keys(x.liq.porFecha).forEach(function (f) {
      var q = x.liq.porFecha[f], cid = porCentro[f] || x.centroId || '-', t = ob(cid, cs[cid] || 'Sin centro asignado');
      t.horas += q.trabajadoMin / 60; t.extras += q.extraCalculadaMin / 60; if (q.tardanzaMin) t.tardanzas++; if (q.trabajadoMin) t.dias++;
    });
  });
  return { desde: r.desde, hasta: r.hasta, obras: Object.keys(obras).map(function (k) { var o = obras[k]; o.horas = Math.round(o.horas * 10) / 10; o.extras = Math.round(o.extras * 10) / 10; return o; }) };
}

/* ---------- Configuración, jefes, monitoreo ---------- */
function a_adminConfig() {
  var c = cfg_(), o = JSON.parse(JSON.stringify(c)); o.legalEfectivo = legal_(); o.tiposAlerta = TIPOS_ALERTA;
  o.telegramToken = ''; o.tieneTelegram = !!(prop_('TELEGRAM_TOKEN') || c.telegramToken);
  o.jefes = leer('Jefes').map(function (j) { return { id: j.id, nombre: j.nombre, cargo: j.cargo, email: j.email, whatsapp: j.whatsapp, centros: json_(j.centros, []), activo: j.activo !== '0', tienePin: !!j.pin }; });
  o.codigoAdminPendiente = !!prop_('CODIGO_ADMIN'); return o;
}
function a_adminConfigGuardar(d, adm) {
  var cambios = [];
  if (d.admin2FA) { var sinCorreo = leer('Usuarios').filter(function (u) { return u.rol === 'admin' && u.estado === 'activo' && !u.email; }).map(function (u) { return u.nombre; });
    if (sinCorreo.length) throw E_('DATOS', 'Antes de exigir el código por correo, registra el correo de: ' + sinCorreo.join(', ') + '.'); }
  if (d.arlPct !== undefined && (+d.arlPct < 0.348 || +d.arlPct > 6.96)) throw E_('DATOS', 'La tarifa de ARL va de 0,348 % (riesgo I) a 6,96 % (riesgo V).');
  Object.keys(d).forEach(function (k) {
    if (k === 'telegramToken') { if (d[k]) { prop_('TELEGRAM_TOKEN', txt_(d[k], 120)); cambios.push('telegramToken'); } return; }
    if (!(k in CFG_DEF) || k === 'zona') return; var v = d[k], def = CFG_DEF[k];
    if (k === 'urlApp') { // dirección de la página: solo https y, si el proveedor la fijó, la misma; se avisa a todos los administradores
      v = txt_(v, 200).trim(); if (v && !/^https:\/\/[a-z0-9.-]+(\/[^\s"'<>]*)?$/i.test(v)) throw E_('DATOS', 'La dirección de la página debe empezar por https://');
      var pa = prov_('app'); if (v && pa && v.replace(/[#?].*$/, '').replace(/\/?$/, '/') !== pa.replace(/[#?].*$/, '').replace(/\/?$/, '/')) throw E_('DATOS', 'La dirección de la página la fija tu proveedor (' + pa + ').');
      if (v !== cfg_().urlApp) { avisarAdmins_('Cambió la dirección de la página de la empresa', adm.nombre + ' cambió la dirección de la página a: ' + (v || '(vacía)') + '\nSi no fuiste tú ni alguien de confianza, revísalo en Configuración.'); } }
    if (typeof def === 'number') { v = +v; if (isNaN(v) || v < 0) throw E_('DATOS', 'Valor no válido en "' + k + '".'); }
    else if (typeof def === 'boolean') v = !!v;
    else if (typeof def === 'string') v = txt_(v, 300);
    else if (k === 'legal') { var L = {}; Object.keys(v || {}).forEach(function (q) { if (!(q in Motor.DEF)) return; if (q === 'festivosExtra') L[q] = (v[q] || []).filter(function (f) { return /^\d{4}-\d\d-\d\d$/.test(f); }); else if (typeof Motor.DEF[q] === 'string') L[q] = /^\d\d:\d\d$/.test(v[q]) ? v[q] : Motor.DEF[q]; else if (typeof Motor.DEF[q] === 'boolean') L[q] = !!v[q]; else if (v[q] !== '' && v[q] !== null && !isNaN(+v[q])) L[q] = +v[q]; }); v = L; }
    else if (k === 'empresa') { var e = {}; Object.keys(CFG_DEF.empresa).forEach(function (q) { e[q] = txt_((v || {})[q], q === 'logo' ? 40000 : 200); }); if (e.logo && !/^data:image\/(png|jpeg|webp);base64,/.test(e.logo) && !/^https:\/\//.test(e.logo)) e.logo = ''; if (e.color && !/^#[0-9a-fA-F]{6}$/.test(e.color)) e.color = ''; v = e; }
    else if (k === 'contactosEmergencia') { v = (Array.isArray(v) ? v : []).slice(0, 10).map(function (x) { return { nombre: txt_(x && x.nombre, 80), rol: txt_(x && x.rol, 40), telefono: soloDigitos_(x && x.telefono).substr(0, 15) }; }).filter(function (x) { return x.nombre && x.telefono; }); }
    else if (k === 'codigosConcepto') { var cc = {}; Object.keys(v || {}).forEach(function (q) { if (/^[A-Z]{2,5}$/.test(q) && txt_(v[q], 20)) cc[q] = txt_(v[q], 20); }); v = cc; }
    else if (k === 'alertas') { var al = {}; Object.keys(TIPOS_ALERTA).forEach(function (q) { var x = (v || {})[q] || {}; al[q] = { activo: x.activo !== false, correos: txt_(x.correos, 300) }; }); v = al; }
    cfgSet_(k, v); cambios.push(k);
  });
  auditar_(adm.cedula, 'configuracion', cambios.join(', '));
  // Al escribir el NIT por primera vez la empresa se reporta de una vez: aparece en el panel del proveedor sin esperar a la noche
  if (cambios.indexOf('empresa') >= 0 && prov_('panel') && !prop_('PANEL_CONTACTO')) { try { reportarAlPanel_(); } catch (e) { registrarError_('panelProveedor', e); } }
  return a_adminConfig();
}
function a_adminJefeGuardar(d, adm) {
  var j = d.id ? buscar('Jefes', 'id', d.id) : null, nuevo = !j; if (nuevo) j = { id: id_().substr(0, 8), pin: '' };
  if (!txt_(d.nombre, 80)) throw E_('DATOS', 'Escribe el nombre del jefe.');
  j.nombre = txt_(d.nombre, 80); j.cargo = txt_(d.cargo, 60); j.email = txt_(d.email, 120); j.whatsapp = soloDigitos_(d.whatsapp).substr(0, 15); j.centros = JSON.stringify((d.centros || []).map(function (x) { return txt_(x, 20); })); j.activo = d.activo === false ? '0' : '1';
  if (d.pin) { if (!/^\d{6,8}$/.test(String(d.pin))) throw E_('DATOS', 'La clave de firma debe tener entre 6 y 8 números.'); j.pin = hmac_('pin|' + j.id + '|' + d.pin); }
  if (!j.pin) throw E_('DATOS', 'Asigna una clave de firma. Sin ella el jefe no puede firmar.');
  if (nuevo) agregar('Jefes', j); else guardar('Jefes', j);
  auditar_(adm.cedula, nuevo ? 'jefe_creado' : 'jefe_editado', { id: j.id, nombre: j.nombre, cambioClave: !!d.pin }); return {};
}
function a_adminBitacoras(d) {
  var n = { alertas: 'Alertas', auditoria: 'Auditoria', errores: 'Errores' }[d.cual]; if (!n) throw E_('DATOS', 'Bitácora desconocida.');
  return leer(n, 400).reverse().map(function (r) { var o = {}; HOJAS[n].forEach(function (k) { o[k] = r[k]; }); return o; });
}
// Verifica la cadena: cada fila firma la anterior. Además compara contra el último eslabón y el total guardados
// fuera de la hoja, así que borrar hashes o filas del final también se detecta.
function a_adminVerificarAuditoria() {
  var filas = leer('Auditoria'), ant = 'GENESIS', alteradas = [], desde = prop_('AUD_DESDE') || '', conHash = 0, ult = '';
  filas.forEach(function (r) {
    if (!r.hash) { if (desde && r.fecha >= desde) alteradas.push({ fila: r._f, fecha: r.fecha, accion: r.accion + ' (sin firma)' }); ant = ''; return; }
    var esp = hmac_(ant + '|' + r.fecha + '|' + r.actor + '|' + r.accion + '|' + r.detalle).substr(0, 32);
    if (!igualSeguro_(r.hash, esp)) alteradas.push({ fila: r._f, fecha: r.fecha, accion: r.accion });
    ant = r.hash; ult = r.hash; conHash++;
  });
  var nEsp = +(prop_('AUD_N') || 0), ultEsp = prop_('AUD_ULT') || '';
  if (nEsp && (conHash !== nEsp || ult !== ultEsp)) alteradas.push({ fila: '', fecha: '', accion: 'Faltan registros: se esperaban ' + nEsp + ' firmados y hay ' + conHash + '.' });
  return { total: filas.length, integra: alteradas.length === 0, alteradas: alteradas.slice(0, 50) };
}
function a_adminSalud() {
  var a = ahora_(), conteo = {}, disparadores = [], cupo = null, pruebas = autoPrueba_();
  Object.keys(HOJAS).forEach(function (h) { conteo[h] = Math.max(0, hoja_(h).getLastRow() - 1); });
  try { disparadores = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }); } catch (e) { }
  try { cupo = MailApp.getRemainingDailyQuota(); } catch (e) { }
  var hace7 = Motor.sumar(a.fecha, -7);
  return { version: VERSION, ahora: a.iso, filas: conteo, disparadores: disparadores, cupoCorreo: cupo, ultimoRespaldo: prop_('ULTIMO_RESPALDO') || '', ultimaLimpieza: prop_('ULTIMA_LIMPIEZA') || '',
    errores7d: leer('Errores', 400).filter(function (e) { return e.fecha >= hace7; }).length, sesiones: leer('Sesiones').length, pruebas: pruebas,
    capacidad: Math.round(conteo.Marcaciones / 2000) / 10 }; // % aproximado frente a 200.000 filas recomendadas
}
function a_adminRespaldar(d, adm) { var r = respaldar_(); auditar_(adm.cedula, 'respaldo_manual', r); return { resultado: r }; }

// Pruebas rápidas del motor que corren en el propio servidor (el conjunto completo está en /tests).
function autoPrueba_() {
  var H = { e: '07:00', s: '16:24', ai: '12:00', af: '13:00', tol: 5 }, r = [];
  function p(n, ok) { r.push({ nombre: n, ok: !!ok }); }
  try {
    p('Festivos 2026 (18 días)', Object.keys(Motor.festivos(2026)).length === 18);
    p('Jornada diaria 8,4 h', Motor.liquidarDia({ fecha: '2026-11-10', entrada: '07:00', salAlm: '12:00', entAlm: '13:00', salida: '16:24' }, H).ordDiu === 504);
    p('Almuerzo olvidado se asume', Motor.liquidarDia({ fecha: '2026-11-10', entrada: '07:00', salida: '16:24' }, H).trabajadoMin === 504);
    p('Extra nocturna desde 19:00', Motor.liquidarDia({ fecha: '2026-11-10', entrada: '07:00', salAlm: '12:00', entAlm: '13:00', salida: '20:24' }, H).extNoc === 84);
    p('Recargo dominical 90 %', Motor.recDominical('2026-11-15', Motor.cfg()) === 0.9);
    p('Quincena = 15 días', Motor.diasNomina('2026-10-16', '2026-10-31') === 15);
    p('Hoja y secreto disponibles', !!ss_() && !!prop_('SECRETO'));
    p('Carpeta de fotos accesible', !!DriveApp.getFolderById(prop_('CARPETA_FOTOS')));
  } catch (e) { p('Error al ejecutar: ' + e.message, false); }
  return r;
}

/* ---------- Exportación ---------- */
function a_adminExportar(d) {
  var r = rango_(d, 62), h = function (m) { return Math.round(m / 6) / 10; }, cs = {}; centros_().forEach(function (c) { cs[c.id] = c.nombre; });
  var previa = a_adminNominaPrevia(r), n = {}; leer('Usuarios').forEach(function (u) { n[u.cedula] = u.nombre; });
  var dentro = function (a, b) { return a <= r.hasta && b >= r.desde; };
  return { desde: r.desde, hasta: r.hasta, empresa: cfg_().empresa.nombre,
    Personal: leer('Usuarios').map(function (u) { return { 'Cédula': u.cedula, Nombre: u.nombre, Cargo: u.cargo, 'Centro de trabajo': cs[u.centroId] || '', Rol: u.rol, Estado: u.estado, Salario: +u.salario || 0, 'Salario validado': u.salarioOk === '1' ? 'Sí' : 'No', 'Tipo de pago': u.tipoPago, Ingreso: u.ingreso, EPS: u.eps, ARL: u.arl, Correo: u.email, 'Teléfono': u.telefono, Banco: u.banco, 'Tipo de cuenta': u.tipoCuenta, 'Número de cuenta': u.cuenta }; }),
    Jornadas: a_adminMarcaciones(r).reverse().map(function (x) { return { Fecha: x.fecha, 'Cédula': x.cedula, Nombre: x.nombre, 'Centro de trabajo': x.centro, Entrada: x.entrada, 'Salida almuerzo': x.salAlm, 'Regreso almuerzo': x.entAlm, Salida: x.salida, 'Horas trabajadas': h(x.min), 'Horas extra': h(x.extra), 'Minutos tarde': x.tarde, 'Marcación digitada': x.marcas.some(function (m) { return m.manual; }) ? 'Sí' : '', 'Fuera de zona': x.marcas.some(function (m) { return m.enZona === '0'; }) ? 'Sí' : '', Incompleta: x.incompleto ? 'Sí' : '' }; }),
    'Horas extra': a_adminExtras({}).filter(function (x) { return x.fecha >= r.desde && x.fecha <= r.hasta; }).map(function (x) { return { Fecha: x.fecha, 'Cédula': x.cedula, Nombre: x.nombre, 'Horas calculadas': h(x.minCalc), 'Horas aprobadas': x.minAprob === null ? '' : h(x.minAprob), Estado: x.estado, 'Supera tope diario': x.superaDia ? 'Sí' : '', 'Observación': x.obs }; }),
    Permisos: leer('Permisos').filter(function (p) { return dentro(p.fechaSalida, p.fechaRegreso); }).map(function (p) { var q = permisoPub_(p); return { 'Cédula': p.cedula, Nombre: q.nombre, Tipo: q.tipoNombre, Norma: q.norma, Remunerado: q.remunerado ? 'Sí' : 'No', 'Fecha salida': p.fechaSalida, 'Hora salida': p.horaSalida, 'Fecha regreso': p.fechaRegreso, 'Hora regreso': p.horaRegreso, Motivo: p.motivo, Estado: p.estado, Firmas: q.firmas.map(function (f) { return f.nombre + ': ' + f.estado; }).join(' | '), 'Decidido por': p.decididoPor, 'Observación': p.obs }; }),
    Incapacidades: leer('Incapacidades').filter(function (i) { return dentro(i.desde, i.hasta); }).map(function (i) { return { 'Cédula': i.cedula, Nombre: n[i.cedula] || '', Tipo: i.tipo, Desde: i.desde, Hasta: i.hasta, 'Días': Motor.diasEntre(i.desde, i.hasta) + 1, Entidad: i.entidad, Nota: i.nota }; }),
    'Nómina estimada': previa.filas.map(function (x) { var q = x.liq, v = function (c) { var t = q.conceptos.filter(function (k) { return k.cod === c; })[0]; return t ? t.valor : 0; };
      return { 'Cédula': x.cedula, Nombre: x.nombre, 'Centro de trabajo': x.centro, Salario: x.salario, 'Días liquidados': q.diasNomina, 'Horas trabajadas': q.horas.trabajadas, 'Horas extra pagadas': q.horas.extras, 'Horas extra sin aprobar': q.horas.extrasSinAprobar, Ausencias: q.ausencias, Tardanzas: q.tardanzas,
        'Salario básico': v('SAL'), 'Recargos y dominicales': v('RN') + v('DF') + v('DFN'), 'Horas extra $': v('HED') + v('HEN') + v('HEDF') + v('HENF'), 'Auxilio transporte': v('AUX'), Devengado: q.devengado, Deducciones: q.deducciones, 'Neto a pagar': q.neto }; }),
    'Vacaciones y ausentismo': (function () { var hoy = ahora_().fecha, tom = {}, ex = {};
      leer('Permisos').forEach(function (p) { if (p.tipo === 'vacaciones' && p.estado === 'aprobado') tom[p.cedula] = (tom[p.cedula] || 0) + Motor.diasHabiles(p.fechaSalida, Motor.sumar(p.fechaRegreso, -1), legal_(), sabadoHabil_(p.cedula)); });
      previa.filas.forEach(function (x) { ex[x.cedula] = x.liq; });
      return leer('Usuarios').filter(function (u) { return u.estado === 'activo'; }).map(function (u) { var c = Motor.vacacionesCausadas(u.ingreso, hoy), q = ex[u.cedula];
        return { 'Cédula': u.cedula, Nombre: u.nombre, Ingreso: String(u.ingreso).substr(0, 10), 'Vacaciones causadas (días hábiles)': c, 'Vacaciones disfrutadas': tom[u.cedula] || 0, 'Saldo de vacaciones': Math.round((c - (tom[u.cedula] || 0)) * 10) / 10,
          'Ausencias en el rango': q ? q.ausencias : '', 'Tardanzas en el rango': q ? q.tardanzas : '', 'Minutos tarde': q ? q.tardanzaMin : '' }; }); })(),
    'Resumen por obra': a_adminResumenObra(r).obras.map(function (o) { return { 'Centro de trabajo': o.centro, 'Personas asignadas': o.personas, 'Días-persona trabajados': o.dias, 'Horas trabajadas': o.horas, 'Horas extra': o.extras, Tardanzas: o.tardanzas, Ausencias: o.ausencias, 'Costo devengado del personal asignado': o.costo }; }) };
}

/* ---------- Registro de acciones ---------- */
function registrarAcciones_() {
  var P = 'publico', U = 'usuario', A = 'admin', V = 'supervisor';
  [['publico', P, 0, a_publico], ['consultarCedula', P, 0, a_consultarCedula], ['registro', P, 1, a_registro], ['login', P, 0, a_login], ['loginRapido', P, 0, a_loginRapido], ['firmaVer', P, 0, a_firmaVer], ['firmaResponder', P, 1, a_firmaResponder], ['error', P, 1, a_error], ['recuperarPedir', P, 1, a_recuperarPedir], ['recuperarCambiar', P, 1, a_recuperarCambiar],
   ['salir', U, 1, a_salir], ['cambiarClave', U, 1, a_cambiarClave], ['consentir', U, 1, a_consentir], ['misDatos', U, 1, a_misDatos], ['yo', U, 0, a_yo], ['marcar', U, 1, a_marcar], ['marcarDeshacer', U, 1, a_marcarDeshacer], ['accesoCrear', U, 1, a_accesoCrear], ['accesoBorrar', U, 1, a_accesoBorrar], ['guiaNomina', U, 0, a_guiaNomina], ['adminVersion', A, 0, a_adminVersion], ['adminActualizar', A, 1, a_adminActualizar], ['adminLicenciaSincronizar', A, 1, a_adminLicenciaSincronizar], ['consultaCrear', U, 1, a_consultaCrear], ['consultasMias', U, 0, a_consultasMias], ['adminConsultas', V, 0, a_adminConsultas], ['adminConsultaResponder', V, 1, a_adminConsultaResponder], ['permisoSalir', U, 1, a_permisoSalir], ['autorizadores', U, 0, a_autorizadores], ['sinAlmuerzo', U, 1, a_sinAlmuerzo], ['adminSinAlmuerzo', V, 0, a_adminSinAlmuerzo], ['adminSinAlmuerzoDecidir', V, 1, a_adminSinAlmuerzoDecidir], ['permisoRegresar', U, 1, a_permisoRegresar], ['bloqueo', U, 1, a_bloqueo], ['historial', U, 0, a_historial],
   ['permisoCrear', U, 1, a_permisoCrear], ['permisosMios', U, 0, a_permisosMios], ['permisoCancelar', U, 1, a_permisoCancelar], ['desprendibles', U, 0, a_desprendibles],
   ['adminTablero', V, 0, a_adminTablero], ['adminPersonal', A, 0, a_adminPersonal], ['adminPersonaGuardar', A, 1, a_adminPersonaGuardar], ['adminPersonaCodigo', A, 1, a_adminPersonaCodigo], ['adminPersonaImportar', A, 1, a_adminPersonaImportar],
   ['adminCentros', V, 0, a_adminCentros], ['adminCentroGuardar', A, 1, a_adminCentroGuardar], ['supRevision', V, 0, a_supRevision], ['adminRecordar', V, 1, a_adminRecordar], ['adminBuscar', V, 0, a_adminBuscar], ['adminNominaInconsistencias', A, 0, a_adminNominaInconsistencias], ['supRevisar', V, 1, a_supRevisar], ['supUbicarObra', V, 1, a_supUbicarObra], ['adminMarcaciones', V, 0, a_adminMarcaciones], ['adminMarcacionGuardar', A, 1, a_adminMarcacionGuardar], ['adminMarcacionRevisada', A, 1, a_adminMarcacionRevisada], ['adminFoto', V, 0, a_adminFoto],
   ['adminPermisos', V, 0, a_adminPermisos], ['adminPermisoDecidir', A, 1, a_adminPermisoDecidir], ['adminPermisoRegistrar', A, 1, a_adminPermisoRegistrar], ['adminIncapacidades', A, 0, a_adminIncapacidades], ['adminIncapacidadGuardar', A, 1, a_adminIncapacidadGuardar],
   ['adminExtras', V, 0, a_adminExtras], ['adminExtraDecidir', V, 1, a_adminExtraDecidir], ['adminNominaPrevia', A, 0, a_adminNominaPrevia], ['adminNominaCerrar', A, 1, a_adminNominaCerrar], ['adminNominas', A, 0, a_adminNominas], ['adminNominaDetalle', A, 0, a_adminNominaDetalle],
   ['adminResumenObra', A, 0, a_adminResumenObra], ['adminConfig', A, 0, a_adminConfig], ['adminConfigGuardar', A, 1, a_adminConfigGuardar], ['adminJefeGuardar', A, 1, a_adminJefeGuardar], ['adminBitacoras', A, 0, a_adminBitacoras], ['adminSalud', A, 0, a_adminSalud],
   ['adminRespaldar', A, 1, a_adminRespaldar], ['adminExportar', A, 0, a_adminExportar],
   ['adminExtrasLote', V, 1, a_adminExtrasLote], ['adminNovedades', A, 0, a_adminNovedades], ['adminNovedadGuardar', A, 1, a_adminNovedadGuardar],
   ['adminInforme', V, 0, a_adminInforme], ['miResumen', U, 0, a_miResumen],
   ['adminTurnos', A, 0, a_adminTurnos], ['adminTurnoGuardar', A, 1, a_adminTurnoGuardar], ['adminProgramar', A, 1, a_adminProgramar], ['adminProgramacionBorrar', A, 1, a_adminProgramacionBorrar],
   ['confirmarDesprendible', U, 1, a_confirmarDesprendible, 'nomina'], ['adminLiberarDispositivo', A, 1, a_adminLiberarDispositivo, 'seguridadPro'], ['adminAnonimizarUsuario', A, 1, a_adminAnonimizarUsuario], ['adminIncapacidadEditar', A, 1, a_adminIncapacidadEditar, 'permisos'], ['adminTrasladoMasivo', A, 1, a_adminTrasladoMasivo], ['adminQrCentro', V, 0, a_adminQrCentro, 'qr'],
   ['kioscoMarcar', U, 1, a_kioscoMarcar, 'kiosco'], ['kioscoIniciar', V, 1, a_kioscoIniciar, 'kiosco'], ['kioscoSalir', U, 1, a_kioscoSalir],
   ['adminProvisiones', A, 0, a_adminProvisiones, 'nomina'], ['adminLiquidacionContrato', A, 1, a_adminLiquidacionContrato, 'nomina'], ['adminPrestacionesPeriodicas', A, 1, a_adminPrestacionesPeriodicas, 'nomina'], ['adminPrestamos', A, 0, a_adminPrestamos, 'prestamos'], ['adminPrestamoGuardar', A, 1, a_adminPrestamoGuardar, 'prestamos'], ['adminPrestamoAplicarCuota', A, 1, a_adminPrestamoAplicarCuota, 'prestamos'],
   ['misCompensatorios', U, 0, a_misCompensatorios, 'nomina'], ['adminCompensatorioGuardar', A, 1, a_adminCompensatorioGuardar, 'nomina'], ['certificadoLaboral', U, 1, a_certificadoLaboral, 'autoservicio'], ['adminCertificadoLaboral', A, 1, a_adminCertificadoLaboral, 'autoservicio'],
   ['adminComunicadoCrear', A, 1, a_adminComunicadoCrear, 'autoservicio'], ['adminComunicados', A, 0, a_adminComunicados, 'autoservicio'], ['comunicadosMios', U, 0, a_comunicadosMios, 'autoservicio'], ['comunicadoLeer', U, 1, a_comunicadoLeer, 'autoservicio'],
   ['adminPresupuestoObras', A, 0, a_adminPresupuestoObras, 'presupuesto'], ['adminEnVivo', V, 0, a_adminEnVivo, 'tablero360'],
   ['salirTodas', U, 1, a_salirTodas], ['certificadoVerificar', P, 0, a_certificadoVerificar], ['adminVerificarAuditoria', A, 0, a_adminVerificarAuditoria, 'seguridadPro'],
   ['miProgramacion', U, 0, a_miProgramacion, 'turnos'], ['misPrestamos', U, 0, a_misPrestamos, 'prestamos'], ['misExtras', U, 0, a_misExtras, 'nomina'], ['incapacidadReportar', U, 1, a_incapacidadReportar, 'permisos'], ['contactosEmergencia', U, 0, a_contactosEmergencia],
   ['adminExpediente360', V, 0, a_adminExpediente360, 'tablero360'], ['adminTablero360', V, 0, a_adminTablero360, 'tablero360'], ['adminLicenciaActivar', A, 1, a_adminLicenciaActivar]
  ].forEach(function (x) { accion_(x[0], x[1], !!x[2], x[3], x[4]); });
}
