/**
 * CONTROL DE JORNADA — Turnos rotativos y recuperación de contraseña.
 */

/* ---------- Recuperar contraseña con código enviado al correo registrado ---------- */
function a_recuperarPedir(d) {
  var ced = soloDigitos_(d.cedula); limite_('recp:' + ced, 3, 3600);
  var u = buscar('Usuarios', 'cedula', ced);
  if (!u || !u.hash || u.estado === 'inactivo') return { enviado: false };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) return { enviado: false, sinCorreo: true };
  var cod = codigo6_(); CacheService.getScriptCache().put('rec:' + ced, hmac_('rec|' + ced + '|' + cod), 900);
  var r = correo_(u.email, 'Código para cambiar tu contraseña', 'Tu código es: ' + cod + '\n\nVence en 15 minutos. Si no lo pediste, ignora este mensaje: tu contraseña sigue igual.');
  auditar_(ced, 'recuperar_pedido', '');
  var p = u.email.split('@');
  return { enviado: r.indexOf('@') > 0, pista: p[0].substr(0, 2) + '***@' + p[1] };
}
function a_recuperarCambiar(d) {
  var ced = soloDigitos_(d.cedula); limite_('recc:' + ced, 5, 900); // 5 intentos sobre un millón de códigos
  var c = CacheService.getScriptCache(), h = c.get('rec:' + ced);
  if (!h || h !== hmac_('rec|' + ced + '|' + soloDigitos_(d.codigo))) throw E_('CODIGO', 'El código no coincide o ya venció. Pide uno nuevo.');
  if (claveDebil_(d.clave, ced)) throw E_('DATOS', 'Elige una contraseña de al menos 6 caracteres que no sea tu cédula ni una secuencia fácil.');
  var u = buscar('Usuarios', 'cedula', ced); if (!u || u.estado === 'inactivo') throw E_('PERMISO', 'Tu usuario no está activo.');
  u.salt = azar_().substr(0, 16); u.hash = hashClaveV2_(String(d.clave), u.salt); guardar('Usuarios', u);
  c.remove('rec:' + ced); cerrarSesiones_(ced); auditar_(ced, 'clave_recuperada', '');
  if (u.rol !== 'trabajador') alertar_('seguridad', ced, 'Recuperó la contraseña de una cuenta de ' + u.rol + ' por correo. Si no fue esa persona, desactívala de inmediato.');
  // No entrega sesión: se ingresa con la clave nueva, pasando por celular vinculado y código por correo.
  return { listo: true };
}

/* ---------- Turnos y programación por fechas ---------- */
function turnoPub_(t) { return { id: t.id, nombre: t.nombre, e: t.e, s: t.s, ai: t.ai, af: t.af, dias: json_(t.dias, []), activo: t.activo !== '0', min: Motor.jornadaMin({ e: t.e, s: t.s, ai: t.ai, af: t.af }) }; }
function a_adminTurnos() {
  var a = ahora_(), n = {}, tn = { descanso: 'Descanso' }, desde = Motor.sumar(a.fecha, -31);
  leer('Usuarios').forEach(function (u) { n[u.cedula] = u.nombre; });
  var turnos = leer('Turnos').map(turnoPub_); turnos.forEach(function (t) { tn[t.id] = t.nombre; });
  return { turnos: turnos, programacion: leer('Programacion').filter(function (p) { return p.hasta >= desde; }).reverse().map(function (p) {
    return { id: p.id, cedula: p.cedula, nombre: n[p.cedula] || p.cedula, desde: p.desde, hasta: p.hasta, turnoId: p.turnoId, turno: tn[p.turnoId] || '(turno eliminado)', cerrado: periodoCerrado_(p.desde) }; }) };
}
function a_adminTurnoGuardar(d, adm) {
  var rh = /^\d\d:\d\d$/, t = d.id ? buscar('Turnos', 'id', d.id) : null, nuevo = !t; if (nuevo) t = { id: id_().substr(0, 8) };
  if (!txt_(d.nombre, 40)) throw E_('DATOS', 'Ponle un nombre al turno (por ejemplo: Noche 22-06).');
  if (!rh.test(d.e || '') || !rh.test(d.s || '')) throw E_('DATOS', 'Indica la hora de entrada y la de salida.');
  var alm = rh.test(d.ai || '') && rh.test(d.af || '');
  t.nombre = txt_(d.nombre, 40); t.e = d.e; t.s = d.s; t.ai = alm ? d.ai : ''; t.af = alm ? d.af : '';
  t.dias = JSON.stringify((d.dias || []).map(Number).filter(function (x) { return x >= 0 && x <= 6; })); t.activo = d.activo === false ? '0' : '1';
  if (nuevo) agregar('Turnos', t); else guardar('Turnos', t);
  auditar_(adm.cedula, nuevo ? 'turno_creado' : 'turno_editado', { id: t.id, nombre: t.nombre, e: t.e, s: t.s }); return turnoPub_(t);
}
function a_adminProgramar(d, adm) {
  var re = /^\d{4}-\d\d-\d\d$/, ceds = (d.cedulas || []).map(soloDigitos_).filter(Boolean), a = ahora_();
  if (!ceds.length) throw E_('DATOS', 'Elige al menos una persona.');
  if (!re.test(d.desde || '') || !re.test(d.hasta || '') || d.hasta < d.desde) throw E_('DATOS', 'Revisa las fechas.');
  if (Motor.diasEntre(d.desde, d.hasta) > 92) throw E_('DATOS', 'Programa máximo tres meses a la vez.');
  if (periodoCerrado_(d.desde)) throw E_('CERRADO', 'La fecha inicial pertenece a una nómina cerrada.');
  if (d.turnoId !== 'descanso' && !buscar('Turnos', 'id', d.turnoId)) throw E_('DATOS', 'Elige el turno.');
  ceds.forEach(function (c) { if (buscar('Usuarios', 'cedula', c)) agregar('Programacion', { id: id_(), cedula: c, desde: d.desde, hasta: d.hasta, turnoId: d.turnoId, creadoPor: adm.cedula, creado: a.iso }); });
  auditar_(adm.cedula, 'turno_programado', { personas: ceds.length, desde: d.desde, hasta: d.hasta, turno: d.turnoId }); return {};
}
function a_adminProgramacionBorrar(d, adm) {
  var p = buscar('Programacion', 'id', d.id); if (!p) throw E_('DATOS', 'No se encontró la programación.');
  if (periodoCerrado_(p.desde)) throw E_('CERRADO', 'Pertenece a una nómina cerrada y ya no se puede quitar.');
  borrar('Programacion', p); auditar_(adm.cedula, 'turno_desprogramado', { cedula: p.cedula, desde: p.desde, hasta: p.hasta }); return {};
}
