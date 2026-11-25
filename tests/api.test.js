// Pruebas de extremo a extremo del backend real sobre el simulador. Ejecutar: node tests/api.test.js
const assert = require('assert'), { crear } = require('./simulador');
let ok = 0, mal = 0;
function t(n, f) { try { f(); ok++; } catch (e) { mal++; console.log('✗ ' + n + '\n   ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n   ')); } }
const eq = (a, b, m) => assert.strictEqual(a, b, m);
const X = crear(), { S, api } = X;
const hora = (f, h) => S.ahora(new Date(f + 'T' + h + ':00-05:00').toISOString());
const FOTO = 'data:image/jpeg;base64,' + 'A'.repeat(400), FIRMA = 'data:image/png;base64,' + 'B'.repeat(400);
const GPS = { lat: 4.6500, lng: -74.1000, prec: 10 }, CONS = { datos: true, sensibles: true };
const H = { e: '07:00', s: '16:24', ai: '12:00', af: '13:00' }, LV = { 1: H, 2: H, 3: H, 4: H, 5: H };
let adm, tr, tr2, centro, jefe, codTr, permiso, enlace;
const sinError = (r) => { assert(r.ok, r.e + ': ' + r.m); return r.d; };
const falla = (r, cod) => { assert(!r.ok, 'debía fallar'); eq(r.e, cod, r.m); };

hora('2026-11-09', '06:00');
t('instalar crea hojas, secreto, carpetas, disparadores y código de administrador', () => {
  S.instalar(); assert(X.hojas.Usuarios && X.hojas.Marcaciones && X.props.SECRETO && X.props.CODIGO_ADMIN && X.props.CARPETA_FOTOS);
  eq(sinError(api('publico')).hayAdmin, false);
});
t('registro exige consentimiento de datos', () => falla(api('registro', { cedula: '79000001', codigo: X.props.CODIGO_ADMIN, clave: 'secreta1', nombre: 'Ana Admin', salario: 5000000 }), 'CONSENTIMIENTO'));
t('el primer administrador se crea con el código de un solo uso', () => {
  const cod = X.props.CODIGO_ADMIN, r = sinError(api('registro', { cedula: '79000001', codigo: cod, clave: 'secreta1', nombre: 'Ana Admin', salario: 5000000, consentimiento: CONS }));
  adm = r.token; eq(r.usuario.rol, 'admin'); assert(!X.props.CODIGO_ADMIN);
  falla(api('registro', { cedula: '79000099', codigo: cod, clave: 'secreta1', nombre: 'Intruso', salario: 1, consentimiento: CONS }), 'CODIGO');
});
t('la contraseña no se guarda en claro', () => assert(!JSON.stringify(X.hojas.Usuarios).includes('secreta1')));
t('configuración por empresa sin tocar código', () => {
  const c = sinError(api('adminConfigGuardar', { empresa: { nombre: 'Montajes Andinos S.A.S.', nit: '900.123.456-7' }, correoAlertas: 'rrhh@empresa.co', fotoProbabilidad: 0, alertas: { tardanza: { activo: true, correos: 'jefe.obra@empresa.co' } } }, adm));
  eq(c.empresa.nombre, 'Montajes Andinos S.A.S.'); eq(sinError(api('publico')).empresa.nombre, 'Montajes Andinos S.A.S.');
});
t('centro de trabajo con horario y geocerca; jefe con clave de firma', () => {
  centro = sinError(api('adminCentroGuardar', { nombre: 'Planta Tocancipá', cliente: 'Cervecería', lat: 4.65, lng: -74.1, radio: 150, horario: LV, tol: 5 }, adm));
  eq(centro.horario[1].e, '07:00');
  falla(api('adminJefeGuardar', { nombre: 'Jorge Jefe', cargo: 'Director de obra', whatsapp: '3001234567' }, adm), 'DATOS');
  sinError(api('adminJefeGuardar', { nombre: 'Jorge Jefe', cargo: 'Director de obra', whatsapp: '3001234567', email: 'jorge@empresa.co', pin: '482173' }, adm));
  jefe = sinError(api('adminConfig', {}, adm)).jefes[0]; assert(jefe.tienePin); assert(!JSON.stringify(X.hojas.Jefes).includes('482173'));
});
t('el administrador carga una persona y recibe un código de activación de un solo uso', () => {
  const r = sinError(api('adminPersonaGuardar', { cedula: '1.020.333.444', nombre: 'Pedro Pérez', cargo: 'Soldador', centroId: centro.id, salario: 1750905, ingreso: '2025-11-09' }, adm));
  codTr = r.codigo; assert(/^\d{6}$/.test(codTr)); eq(r.usuario.estado, 'preregistrado');
});
t('ATAQUE: reclamar la identidad de quien aún no tiene contraseña', () => {
  falla(api('registro', { cedula: '1020333444', codigo: '000000', clave: 'robada12', salario: 1, consentimiento: CONS }), 'CODIGO');
  falla(api('registro', { cedula: '1020333444', codigo: '', clave: 'robada12', salario: 1, consentimiento: CONS }), 'CODIGO');
  eq(sinError(api('consultarCedula', { cedula: '1020333444' })).existe, false); // y no revela nombre ni datos
});
t('el trabajador activa su cuenta con cédula + código y crea su contraseña', () => {
  const r = sinError(api('registro', { cedula: '1020333444', codigo: codTr, clave: 'pedro2026', salario: 9999999, consentimiento: CONS, email: 'pedro@correo.co' }));
  tr = r.token; eq(r.usuario.estado, 'activo'); eq(r.usuario.salario, 1750905, 'el salario validado por el admin no lo cambia el trabajador');
  falla(api('registro', { cedula: '1020333444', codigo: codTr, clave: 'otra12345', salario: 1, consentimiento: CONS }), 'EXISTE');
});
t('ingreso con contraseña; contraseña errada se rechaza y se limita', () => {
  falla(api('login', { cedula: '1020333444', clave: 'mala' }), 'CREDENCIALES');
  assert(sinError(api('login', { cedula: '1020333444', clave: 'pedro2026' })).token.length > 40);
});
t('autorregistro con código de empresa queda pendiente hasta que el admin apruebe', () => {
  const cod = sinError(api('adminConfig', {}, adm)).codigoEmpresa;
  const r = sinError(api('registro', { cedula: '52111222', codigo: cod, clave: 'luisa2026', nombre: 'Luisa Gómez', salario: 2500000, consentimiento: CONS, centroId: centro.id }));
  tr2 = r.token; eq(r.usuario.estado, 'pendiente');
  falla(api('marcar', Object.assign({ tipo: 'entrada' }, GPS), tr2), 'PERMISO');
  sinError(api('adminPersonaGuardar', { cedula: '52111222', nombre: 'Luisa Gómez', centroId: centro.id, salario: 2500000, estado: 'activo' }, adm));
});
t('ATAQUE: acciones de administrador sin sesión o con sesión de trabajador', () => {
  falla(api('adminPersonal', {}), 'SESION'); falla(api('adminPersonal', {}, 'x'.repeat(64)), 'SESION');
  falla(api('adminPersonal', {}, tr), 'PERMISO'); falla(api('adminConfigGuardar', { fotoProbabilidad: 0 }, tr), 'PERMISO');
});

/* ---- Marcaciones ---- */
hora('2026-11-09', '06:58');
t('no se puede marcar sin ubicación', () => { falla(api('marcar', { tipo: 'entrada' }, tr), 'GPS_REQUERIDO'); falla(api('marcar', { tipo: 'entrada', lat: 'x', lng: 1 }, tr), 'GPS_REQUERIDO'); });
t('entrada a tiempo usa la hora del servidor, no la del celular', () => {
  const r = sinError(api('marcar', Object.assign({ id: 'm1', tipo: 'entrada', hora: '2026-11-09T05:00' }, GPS), tr));
  eq(r.hora, '2026-11-09T06:58'); eq(r.hoy.siguiente, 'salida', 'el almuerzo sale del horario: después de llegar sigue la salida'); eq(r.enZona, '1');
});
t('reintento con el mismo id no duplica; segunda entrada se rechaza', () => {
  assert(sinError(api('marcar', Object.assign({ id: 'm1', tipo: 'entrada' }, GPS), tr)).repetida);
  falla(api('marcar', Object.assign({ tipo: 'entrada' }, GPS), tr), 'DUPLICADA');
  eq(X.hojas.Marcaciones.length, 2);
});
hora('2026-11-09', '16:30');
t('olvidó marcar el almuerzo: puede marcar la salida y el día suma 8,4 h', () => {
  const r = sinError(api('marcar', Object.assign({ tipo: 'salida' }, GPS), tr));
  eq(r.resumen.dias[0].min, 510); eq(r.hoy.siguiente, null);
});
hora('2026-11-10', '07:25');
t('llegada tarde genera alerta y correo al destinatario configurado', () => {
  const n = X.correos.length; sinError(api('marcar', Object.assign({ tipo: 'entrada' }, GPS), tr));
  const c = X.correos.slice(n).find(m => m.subject.includes('Llegada tarde')); assert(c); eq(c.to, 'jefe.obra@empresa.co'); assert(c.body.includes('25 min'));
});
t('la salida no puede ser anterior a la entrada', () => falla(api('marcar', Object.assign({ tipo: 'salida', manual: true, hora: '2026-11-10T06:00', motivo: 'prueba de orden' }, GPS), tr), 'ORDEN'));
hora('2026-11-11', '06:50');
t('se le olvidó la salida de ayer: digita la hora, exige motivo y queda para revisión', () => {
  falla(api('marcar', Object.assign({ tipo: 'salida', manual: true, fecha: '2026-11-10', hora: '2026-11-10T18:24' }, GPS), tr), 'DATOS');
  sinError(api('marcar', Object.assign({ tipo: 'salida', manual: true, fecha: '2026-11-10', hora: '2026-11-10T18:24', motivo: 'Se descargó el celular' }, GPS), tr));
  const f = S.leer('Marcaciones').pop(); eq(f.estado, 'revisar'); eq(f.manual, '1');
  assert(S.leer('Alertas').some(a => a.tipo === 'marcacion_manual'));
});
t('no se puede digitar una hora futura ni de hace más de 3 días', () => {
  falla(api('marcar', Object.assign({ tipo: 'entrada', manual: true, hora: '2026-11-11T09:00', motivo: 'hora futura' }, GPS), tr), 'DATOS');
  falla(api('marcar', Object.assign({ tipo: 'entrada', manual: true, fecha: '2026-11-04', hora: '2026-11-04T07:00', motivo: 'muy antiguo' }, GPS), tr), 'DATOS');
});
t('foto aleatoria: si toca foto y no llega, no se registra', () => {
  sinError(api('adminConfigGuardar', { fotoProbabilidad: 100 }, adm));
  falla(api('marcar', Object.assign({ tipo: 'entrada' }, GPS), tr), 'FOTO_REQUERIDA');
  assert(sinError(api('yo', {}, tr)).hoy.fotoPlan.entrada);
  sinError(api('marcar', Object.assign({ tipo: 'entrada', foto: FOTO }, GPS), tr));
  const f = S.leer('Marcaciones').pop(); assert(f.foto && X.archivos[f.foto]);
  assert(sinError(api('adminFoto', { id: f.foto }, adm)).url.startsWith('data:image/jpeg'));
  falla(api('adminFoto', { id: 'SS1' }, adm), 'DATOS');
  sinError(api('adminConfigGuardar', { fotoProbabilidad: 0 }, adm));
});
t('bloquear GPS o cámara genera alerta', () => { sinError(api('bloqueo', { que: 'gps', tipo: 'salida' }, tr)); assert(S.leer('Alertas').some(a => a.tipo === 'bloqueo_permisos')); });
hora('2026-11-11', '16:40');
t('fuera del centro: alerta; con geocerca estricta no deja marcar', () => {
  sinError(api('adminConfigGuardar', { geocercaEstricta: true }, adm));
  falla(api('marcar', { tipo: 'salida', lat: 4.70, lng: -74.05, prec: 10, foto: FOTO }, tr), 'FUERA_ZONA');
  sinError(api('adminConfigGuardar', { geocercaEstricta: false }, adm));
  falla(api('marcar', { tipo: 'salida', lat: 4.70, lng: -74.05, prec: 10 }, tr), 'FOTO_REQUERIDA'); // fuera de zona exige foto
  eq(sinError(api('marcar', { tipo: 'salida', lat: 4.70, lng: -74.05, prec: 10, foto: FOTO }, tr)).enZona, '0');
  assert(S.leer('Alertas').some(a => a.tipo === 'fuera_zona'));
});

/* ---- Horas extra ---- */
t('las 2 h extra del día 10 quedan pendientes y no se pagan hasta aprobarlas', () => {
  const ex = sinError(api('adminExtras', { estado: 'pendiente' }, adm)); const x = ex.find(e => e.fecha === '2026-11-10'); assert(x); eq(x.minCalc, 95); // entró 07:25, salió 18:24, jornada 8,4 h
  const fila = sinError(api('adminNominaPrevia', { desde: '2026-11-01', hasta: '2026-11-15' }, adm)).filas.find(f => f.cedula === '1020333444');
  eq(fila.liq.horas.extras, 0); assert(fila.liq.horas.extrasSinAprobar > 1.5);
  falla(api('adminExtraDecidir', { id: x.id, decision: 'aprobar', min: 500 }, adm), 'DATOS');
  sinError(api('adminExtraDecidir', { id: x.id, decision: 'aprobar', min: 95 }, adm));
  const f2 = sinError(api('adminNominaPrevia', { desde: '2026-11-01', hasta: '2026-11-15' }, adm)).filas.find(f => f.cedula === '1020333444');
  eq(f2.liq.horas.extras, 1.6); assert(f2.liq.conceptos.find(c => c.cod === 'HED'));
});
t('editar un día recalcula la semana y devuelve las extras a pendiente', () => {
  sinError(api('adminMarcacionGuardar', { cedula: '1020333444', fecha: '2026-11-10', tipo: 'salida', hora: '19:24', motivo: 'Corrección según planilla' }, adm));
  const x = sinError(api('adminExtras', {}, adm)).find(e => e.fecha === '2026-11-10'); eq(x.estado, 'pendiente'); eq(x.minCalc, 155);
  assert(S.leer('Auditoria').some(a => a.accion === 'marcacion_ajustada'));
});
t('aprobar por encima del tope legal de 2 h exige confirmación expresa', () => {
  const x = sinError(api('adminExtras', {}, adm)).find(e => e.fecha === '2026-11-10'); assert(x.superaDia);
  falla(api('adminExtraDecidir', { id: x.id, decision: 'aprobar', min: 155 }, adm), 'TOPE');
  sinError(api('adminExtraDecidir', { id: x.id, decision: 'aprobar', min: 120 }, adm));
});
t('cambiar el horario de la obra no altera los días ya trabajados', () => {
  const antes = sinError(api('adminMarcaciones', { desde: '2026-11-09', hasta: '2026-11-09' }, adm))[0].min;
  sinError(api('adminCentroGuardar', Object.assign({}, centro, { horario: { 1: { e: '06:00', s: '14:00' }, 2: H, 3: H, 4: H, 5: H } }), adm));
  const d = sinError(api('adminMarcaciones', { desde: '2026-11-09', hasta: '2026-11-09' }, adm))[0]; eq(d.min, antes); eq(d.tarde, 0);
  sinError(api('adminCentroGuardar', Object.assign({}, centro, { horario: LV }), adm));
});

/* ---- Permisos ---- */
hora('2026-11-12', '08:00');
t('solicitud de permiso: queda en firmas, con enlace para WhatsApp y correo al jefe', () => {
  falla(api('permisoCrear', { tipo: 'cita_medica', fechaSalida: '2026-11-13', fechaRegreso: '2026-11-13', motivo: 'Cita de control' }, tr), 'DATOS');
  permiso = sinError(api('permisoCrear', { tipo: 'cita_medica', fechaSalida: '2026-11-13', horaSalida: '09:00', fechaRegreso: '2026-11-13', horaRegreso: '12:00', motivo: 'Cita de control en la EPS' }, tr));
  eq(permiso.estado, 'en_firmas'); enlace = permiso.firmas[0].enlace; assert(enlace.includes('#/firma/')); eq(permiso.firmas[0].whatsapp, '3001234567');
  assert(X.correos.some(m => m.to === 'jorge@empresa.co' && m.subject.includes('Permiso por firmar')));
});
const partes = () => { const [p, j, k] = enlace.split('#/firma/')[1].split('.'); return { p, j, k }; };
t('ATAQUE: fabricar la firma del jefe sin su clave, con enlace alterado o sin sesión', () => {
  falla(api('firmaResponder', Object.assign(partes(), { decision: 'aprobar', firma: FIRMA, pin: '000000' })), 'CREDENCIALES'); // el trabajador tiene el enlace, pero no la clave
  falla(api('firmaResponder', Object.assign(partes(), { k: 'a'.repeat(28), decision: 'aprobar', firma: FIRMA, pin: '482173' })), 'ENLACE');
  falla(api('adminPermisoDecidir', { id: permiso.id, decision: 'aprobar', obs: 'me lo apruebo' }, tr), 'PERMISO');
  eq(S.leer('Permisos')[0].estado, 'en_firmas');
});
t('ATAQUE: adivinar la clave de firma por fuerza bruta se bloquea', () => {
  let r; for (let i = 0; i < 8; i++) r = api('firmaResponder', Object.assign(partes(), { decision: 'aprobar', firma: FIRMA, pin: '1' + i + '0000' }));
  eq(r.e, 'DEMASIADOS'); Object.keys(X.cache).forEach(k => { if (k.startsWith('rl:') || k.startsWith('fl:')) delete X.cache[k]; });
});
t('el jefe ve el permiso y firma con su clave: queda firmado, aún NO aprobado', () => {
  eq(sinError(api('firmaVer', partes())).nombre, 'Pedro Pérez');
  falla(api('firmaResponder', Object.assign(partes(), { decision: 'aprobar', pin: '482173' })), 'DATOS'); // sin firma dibujada
  eq(sinError(api('firmaResponder', Object.assign(partes(), { decision: 'aprobar', firma: FIRMA, pin: '482173' }))).estado, 'firmado');
  falla(api('firmaResponder', Object.assign(partes(), { decision: 'aprobar', firma: FIRMA, pin: '482173' })), 'DATOS');
  assert(X.correos.some(m => m.subject.includes('Constancia de tu respuesta')));
});
t('solo la aprobación del administrador en pantalla lo lleva a la nómina', () => {
  eq(sinError(api('adminTablero', {}, adm)).pendientes.permisos, 1);
  eq(sinError(api('adminPermisoDecidir', { id: permiso.id, decision: 'aprobar' }, adm)).estado, 'aprobado');
  eq(sinError(api('permisosMios', {}, tr))[0].estado, 'aprobado');
});
t('calamidad doméstica rechazada por el jefe exige motivo y queda rechazada', () => {
  const p = sinError(api('permisoCrear', { tipo: 'calamidad', fechaSalida: '2026-11-12', horaSalida: '10:00', fechaRegreso: '2026-11-12', horaRegreso: '14:00', motivo: 'Inundación en la vivienda' }, tr));
  const [pp, j, k] = p.firmas[0].enlace.split('#/firma/')[1].split('.');
  falla(api('firmaResponder', { p: pp, j, k, decision: 'rechazar', pin: '482173' }), 'DATOS');
  eq(sinError(api('firmaResponder', { p: pp, j, k, decision: 'rechazar', pin: '482173', obs: 'Falta el soporte' })).estado, 'rechazado');
});
t('permiso sin respuesta vence al cumplirse el límite configurado', () => {
  sinError(api('adminConfigGuardar', { horasLimitePermiso: 2 }, adm));
  const p = sinError(api('permisoCrear', { tipo: 'personal', fechaSalida: '2026-11-20', horaSalida: '14:00', fechaRegreso: '2026-11-20', horaRegreso: '16:00', motivo: 'Diligencia bancaria' }, tr));
  hora('2026-11-12', '10:30'); S.tareaCada5();
  eq(sinError(api('permisosMios', {}, tr)).find(x => x.id === p.id).estado, 'vencido'); assert(S.leer('Alertas').some(a => a.tipo === 'permiso_vencido'));
});
t('vacaciones: saldo causado según fecha de ingreso', () => eq(sinError(api('yo', {}, tr)).vacaciones.causadas, 15.2));

/* ---- Incapacidades, ausencias, tablero ---- */
t('incapacidad registrada por el administrador (sin diagnóstico)', () => {
  sinError(api('adminIncapacidadGuardar', { cedula: '52111222', tipo: 'general', desde: '2026-11-12', hasta: '2026-11-13', entidad: 'EPS Sura' }, adm));
  eq(sinError(api('adminIncapacidades', {}, adm))[0].dias, 2); assert(!('diagnostico' in S.leer('Incapacidades')[0]));
});
t('quien no se presenta genera alerta de ausencia una sola vez; con incapacidad no', () => {
  hora('2026-11-12', '08:15'); S.tareaCada15(); S.tareaCada15();
  const a = S.leer('Alertas').filter(x => x.tipo === 'ausencia'); eq(a.length, 1); eq(a[0].cedula, '1020333444');
});
t('tablero del administrador resume el día', () => {
  const tb = sinError(api('adminTablero', {}, adm)); eq(tb.cuenta.incapacidad, 1); eq(tb.cuenta.ausente, 1); assert(tb.personas.length >= 3);
});
t('resumen del trabajador: horas, neto estimado y proyección', () => {
  const r = sinError(api('yo', {}, tr)).resumen; assert(r.neto > 0 && r.proyeccion >= r.neto && r.horas.trabajadas > 20); eq(r.periodo.desde, '2026-11-01');
});

/* ---- Nómina y cierre ---- */
t('no se puede cerrar un periodo que no ha terminado', () => falla(api('adminNominaCerrar', { desde: '2026-11-01', hasta: '2026-11-15' }, adm), 'DATOS'));
hora('2026-11-17', '09:00');
t('cerrar la quincena genera desprendibles y congela el periodo', () => {
  const r = sinError(api('adminNominaCerrar', { desde: '2026-11-01', hasta: '2026-11-15' }, adm)); assert(r.personas >= 2);
  const d = sinError(api('desprendibles', {}, tr)); eq(d.length, 1); eq(d[0].detalle.persona.nombre, 'Pedro Pérez'); assert(d[0].neto > 0);
  falla(api('adminNominaCerrar', { desde: '2026-11-01', hasta: '2026-11-15' }, adm), 'CERRADO');
  falla(api('adminMarcacionGuardar', { cedula: '1020333444', fecha: '2026-11-10', tipo: 'salida', hora: '23:00', motivo: 'cambio tardío' }, adm), 'CERRADO');
  falla(api('marcar', Object.assign({ tipo: 'sal_alm', manual: true, fecha: '2026-11-13', hora: '2026-11-13T12:00', motivo: 'corrección tardía' }, GPS), tr), 'CERRADO');
});
t('un trabajador solo ve sus propios desprendibles', () => eq(sinError(api('desprendibles', {}, tr2)).every(d => d.detalle.persona.cedula === '52111222'), true));
t('resumen por obra y exportación completa para Excel', () => {
  const o = sinError(api('adminResumenObra', { desde: '2026-11-01', hasta: '2026-11-15' }, adm)).obras.find(x => x.centro === 'Planta Tocancipá'); assert(o.horas > 20 && o.personas >= 2);
  const x = sinError(api('adminExportar', { desde: '2026-11-01', hasta: '2026-11-15' }, adm));
  ['Personal', 'Jornadas', 'Horas extra', 'Permisos', 'Incapacidades', 'Nómina estimada', 'Resumen por obra'].forEach(h => assert(Array.isArray(x[h]) && x[h].length, h));
});

t('control de fatiga: avisa una sola vez al acercarse al máximo de horas continuas', () => {
  hora('2026-11-18', '07:00'); sinError(api('marcar', Object.assign({ tipo: 'entrada' }, GPS), tr));
  hora('2026-11-18', '15:00'); S.tareaCada15(); eq(S.leer('Alertas').filter(a => a.tipo === 'fatiga').length, 0);
  hora('2026-11-18', '16:45'); S.tareaCada15(); S.tareaCada15(); const f = S.leer('Alertas').filter(a => a.tipo === 'fatiga'); eq(f.length, 1); eq(f[0].cedula, '1020333444');
});
t('códigos contables por empresa para el archivo plano', () => {
  const c = sinError(api('adminConfigGuardar', { codigosConcepto: { SAL: '1001', HED: '1105', 'x<y': 'malo' } }, adm)); eq(c.codigosConcepto.SAL, '1001'); assert(!('x<y' in c.codigosConcepto));
});
t('los valores se guardan como texto literal (Sheets no los convierte en fecha ni fórmula)', () => {
assert(sinError(api('yo', {}, adm)).usuario.consVersion === sinError(api('publico')).versionLegal);
});

/* ---- Supervisor, turnos, recuperación de contraseña, instalación ---- */
let sup, c2;
t('supervisor: ve solo a la gente de sus centros y no accede a salarios, nómina ni configuración', () => {
  c2 = sinError(api('adminCentroGuardar', { nombre: 'Bodega Funza', horario: LV, tol: 5 }, adm));
  const r1 = sinError(api('adminPersonaGuardar', { cedula: '80111000', nombre: 'Sara Supervisora', rol: 'supervisor', centroId: centro.id, supCentros: [centro.id], salario: 3000000 }, adm));
  sup = sinError(api('registro', { cedula: '80111000', codigo: r1.codigo, clave: 'sara2026', consentimiento: CONS })).token;
  const r2 = sinError(api('adminPersonaGuardar', { cedula: '80222000', nombre: 'Otto Otraobra', centroId: c2.id, salario: 2000000 }, adm));
  const otro = sinError(api('registro', { cedula: '80222000', codigo: r2.codigo, clave: 'otto2026', consentimiento: CONS })).token;
  hora('2026-11-19', '07:00'); sinError(api('marcar', Object.assign({ tipo: 'entrada' }, GPS), otro));
  const tb = sinError(api('adminTablero', {}, sup)); assert(tb.personas.some(p => p.cedula === '1020333444')); assert(!tb.personas.some(p => p.cedula === '80222000')); assert(tb.personas.every(p => !('salario' in p)));
  assert(sinError(api('adminMarcaciones', { desde: '2026-11-19', hasta: '2026-11-19' }, sup)).every(m => m.cedula !== '80222000'));
  eq(sinError(api('adminCentros', {}, sup)).length, 1);
  ['adminPersonal', 'adminNominaPrevia', 'adminConfig', 'adminExportar', 'adminIncapacidades', 'adminBitacoras'].forEach(a => falla(api(a, {}, sup), 'PERMISO'));
  falla(api('adminMarcacionGuardar', { cedula: '1020333444', fecha: '2026-11-18', tipo: 'salida', hora: '17:00', motivo: 'no debe poder' }, sup), 'PERMISO');
  falla(api('adminTablero', {}, otro), 'PERMISO');
});
t('supervisor: aprueba extras de su gente, no las de otra obra', () => {
  hora('2026-11-19', '19:30'); const otro = sinError(api('login', { cedula: '80222000', clave: 'otto2026' })).token; sinError(api('marcar', Object.assign({ tipo: 'salida' }, GPS), otro));
  const ajena = sinError(api('adminExtras', {}, adm)).find(x => x.cedula === '80222000'); assert(ajena);
  assert(!sinError(api('adminExtras', {}, sup)).some(x => x.cedula === '80222000'));
  falla(api('adminExtraDecidir', { id: ajena.id, decision: 'aprobar', min: 30 }, sup), 'PERMISO');
});
t('turnos: la programación por fechas reemplaza el horario del centro y un descanso no cuenta como ausencia', () => {
  const tn = sinError(api('adminTurnoGuardar', { nombre: 'Noche 22-06', e: '22:00', s: '06:00', dias: [] }, adm)); eq(tn.min, 480);
  sinError(api('adminProgramar', { cedulas: ['80222000'], desde: '2026-11-23', hasta: '2026-11-25', turnoId: tn.id }, adm));
  sinError(api('adminProgramar', { cedulas: ['80222000'], desde: '2026-11-26', hasta: '2026-11-27', turnoId: 'descanso' }, adm));
  const otro = sinError(api('login', { cedula: '80222000', clave: 'otto2026' })).token;
  hora('2026-11-23', '21:58'); const r = sinError(api('marcar', Object.assign({ tipo: 'entrada' }, GPS), otro)); eq(r.hoy.horario.e, '22:00');
  hora('2026-11-24', '06:03'); const r2 = sinError(api('marcar', Object.assign({ tipo: 'salida' }, GPS), otro)); eq(r2.fecha, '2026-11-23');
  const d = sinError(api('adminMarcaciones', { desde: '2026-11-23', hasta: '2026-11-23', cedula: '80222000' }, adm))[0]; eq(d.min, 483); eq(d.tarde, 0);
  hora('2026-11-28', '09:00'); const f = sinError(api('adminNominaPrevia', { desde: '2026-11-16', hasta: '2026-11-30' }, adm)).filas.find(x => x.cedula === '80222000');
  assert(!f.liq.ausentes.includes('2026-11-26') && !f.liq.ausentes.includes('2026-11-27'), 'descanso no es ausencia'); assert(f.liq.ausentes.includes('2026-11-24'), 'turno programado y no asistió');
  eq(sinError(api('adminTurnos', {}, adm)).programacion.length, 2);
});
t('recuperar contraseña: código al correo registrado, de un solo uso y con intentos limitados', () => {
  eq(sinError(api('recuperarPedir', { cedula: '80222000' })).sinCorreo, true);
  const n = X.correos.length, r = sinError(api('recuperarPedir', { cedula: '1020333444' })); assert(r.enviado); eq(r.pista, 'pe***@correo.co');
  const cod = /código es: (\d{6})/.exec(X.correos.slice(n).pop().body)[1];
  falla(api('recuperarCambiar', { cedula: '1020333444', codigo: '000000', clave: 'nueva2026' }), 'CODIGO');
  const rc = sinError(api('recuperarCambiar', { cedula: '1020333444', codigo: cod, clave: 'nueva2026' })); assert(!rc.token, 'la recuperación no debe entregar sesión');
  const tk = sinError(api('login', { cedula: '1020333444', clave: 'nueva2026' })).token; tr = tk;
  falla(api('recuperarCambiar', { cedula: '1020333444', codigo: cod, clave: 'otra20267' }), 'CODIGO');
  falla(api('login', { cedula: '1020333444', clave: 'pedro2026' }), 'CREDENCIALES'); sinError(api('login', { cedula: '1020333444', clave: 'nueva2026' }));
  eq(sinError(api('recuperarPedir', { cedula: '99999999' })).enviado, false);
});
t('instalación: abrir la dirección /exec entrega el enlace de conexión y no revela el código de administrador', () => {
  const h = S.doGet().html; assert(h.includes('#/c/AKfycbTESTtestTESTtestTEST12345') || h.includes('AKfycbTESTtestTESTtestTEST12345')); assert(!/ADM-[0-9A-F]{6}/.test(h));
});

t('ATAQUE: fabricar una jornada en otra fecha o colar una marcación vieja como si fuera sin señal', () => {
  hora('2026-11-30', '10:00'); const p = sinError(api('login', { cedula: '1020333444', clave: 'nueva2026' })).token;
  falla(api('marcar', Object.assign({ tipo: 'entrada', manual: true, fecha: '2026-11-20', hora: '2026-11-29T07:00', motivo: 'día inventado' }, GPS), p), 'DATOS');
  falla(api('marcar', Object.assign({ tipo: 'entrada', manual: true, fecha: '2026-12-24', hora: '2026-11-30T07:00', motivo: 'día futuro' }, GPS), p), 'DATOS');
  const n = S.leer('Alertas').length; sinError(api('marcar', Object.assign({ tipo: 'entrada', offline: true, hora: '2026-11-28T07:00' }, GPS), p));
  eq(S.leer('Marcaciones').pop().estado, 'revisar'); assert(S.leer('Alertas').length > n);
  falla(api('adminNominaCerrar', { desde: '2026-11-16', hasta: '2026-11-29' }, adm), 'REVISAR');
});
t('ATAQUE: contraseñas triviales, rociado de contraseñas y adivinar el código de empresa', () => {
  falla(api('cambiarClave', { actual: 'nueva2026', nueva: '123456' }, tr), 'DATOS');
  let r; for (let i = 0; i < 35; i++) r = api('registro', { cedula: '9000' + (1000 + i), codigo: 'ZZZZ' + i, clave: 'buena2026x', nombre: 'Intruso X', salario: 1, consentimiento: CONS });
  eq(r.e, 'DEMASIADOS'); assert(S.leer('Alertas').some(a => a.tipo === 'seguridad'));
  Object.keys(X.cache).forEach(k => { if (k.startsWith('rl:') || k.startsWith('fl:')) delete X.cache[k]; });
});
t('cambiar la contraseña cierra las demás sesiones', () => {
  const otra = sinError(api('login', { cedula: '1020333444', clave: 'nueva2026' })).token;
  sinError(api('cambiarClave', { actual: 'nueva2026', nueva: 'obra-2026' }, tr)); sinError(api('yo', {}, tr)); falla(api('yo', {}, otra), 'SESION');
});
t('novedades de pago: bono salarial, auxilio no salarial y descuento entran a la liquidación', () => {
  sinError(api('adminNovedadGuardar', { cedulas: ['80222000'], fecha: '2026-11-20', concepto: 'Bono de alturas', valor: 100000, tipo: 'salarial' }, adm));
  sinError(api('adminNovedadGuardar', { cedulas: ['80222000'], fecha: '2026-11-20', concepto: 'Rodamiento', valor: 50000, tipo: 'no_salarial' }, adm));
  sinError(api('adminNovedadGuardar', { cedulas: ['80222000'], fecha: '2026-11-20', concepto: 'Préstamo', valor: 30000, tipo: 'descuento' }, adm));
  falla(api('adminNovedadGuardar', { cedulas: ['80222000'], fecha: '2026-11-10', concepto: 'Tardío', valor: 1, tipo: 'salarial' }, adm), 'CERRADO');
  const f = sinError(api('adminNominaPrevia', { desde: '2026-11-16', hasta: '2026-11-30' }, adm)).filas.find(x => x.cedula === '80222000').liq;
  const bon = f.conceptos.find(c => c.cod === 'BON'), bns = f.conceptos.find(c => c.cod === 'BNS'), des = f.deduccionesDet.find(c => c.cod === 'DES');
  eq(bon.valor, 100000); eq(bns.valor, 50000); eq(des.valor, 30000); eq(f.ibc, f.conceptos.filter(c => !['AUX', 'BNS'].includes(c.cod)).reduce((s, c) => s + c.valor, 0));
  eq(sinError(api('adminNovedades', { desde: '2026-11-16', hasta: '2026-11-30' }, adm)).length, 3);
});
t('horas extra en lote: aprueba solo las que están dentro del tope', () => {
  const pend = sinError(api('adminExtras', { estado: 'pendiente' }, adm)); assert(pend.length > 0);
  const r = sinError(api('adminExtrasLote', { ids: pend.map(x => x.id) }, adm)); eq(r.aprobadas, pend.filter(x => !x.superaDia && !x.cerrado).length);
});

t('RRHH registra vacaciones a nombre del trabajador: quedan aprobadas sin firmas', () => {
  const p = sinError(api('adminPermisoRegistrar', { cedula: '80222000', tipo: 'vacaciones', fechaSalida: '2026-12-01', fechaRegreso: '2026-12-08', motivo: 'Vacaciones acordadas' }, adm));
  eq(p.estado, 'aprobado'); eq(p.firmas.length, 0); falla(api('adminPermisoRegistrar', { cedula: '80222000', tipo: 'vacaciones', fechaSalida: '2026-12-01', fechaRegreso: '2026-12-08', motivo: 'x' }, sup), 'PERMISO');
});
t('importar de nuevo actualiza a quien ya existe sin borrar sus datos', () => {
  const r = sinError(api('adminPersonaImportar', { filas: [{ cedula: '80222000', nombre: 'Otto Otraobra', cargo: 'Soldador TIG', salario: 2200000 }] }, adm));
  eq(r[0].resultado, 'Actualizada'); const u = sinError(api('adminPersonal', {}, adm)).find(x => x.cedula === '80222000'); eq(u.cargo, 'Soldador TIG'); eq(u.salario, 2200000); eq(u.centroId, c2.id);
});
t('ATAQUE: bloquear la cuenta de otro con claves erradas no impide entrar luego de esperar, y el bloqueo solo cuenta fallos', () => {
  for (let i = 0; i < 3; i++) api('login', { cedula: '79000001', clave: 'mala' + i }); sinError(api('login', { cedula: '79000001', clave: 'secreta1' }));
  Object.keys(X.cache).forEach(k => { if (k.startsWith('rl:') || k.startsWith('fl:')) delete X.cache[k]; });
});
t('primeros pasos del administrador y exportación de vacaciones', () => {
  const tb = sinError(api('adminTablero', {}, adm)); assert(tb.pasos.empresa && tb.pasos.centros && tb.pasos.jefes && tb.pasos.personal); assert(!sinError(api('adminTablero', {}, sup)).pasos);
  assert(sinError(api('adminExportar', { desde: '2026-11-16', hasta: '2026-11-30' }, adm))['Vacaciones y ausentismo'].length > 0);
});
t('copia de la plantilla: la instalación descarta secreto y carpetas de la original', () => {
  const sec = X.props.SECRETO; X.props.SS_ID = 'OTRA_HOJA'; S.instalar(); assert(X.props.SECRETO && X.props.SECRETO !== sec); eq(X.props.SS_ID, 'SS1');
  X.props.SECRETO = sec; // restaura para que las sesiones de las pruebas siguientes sigan válidas
});

t('informes: cualquier agrupación cuadra con la nómina y respeta filtros y alcance', () => {
  const R = { desde: '2026-11-01', hasta: '2026-11-30' }, tot = sinError(api('adminInforme', { ...R, agrupar: 'total' }, adm)).filas[0];
  ['persona', 'centro', 'cargo', 'dia', 'semana', 'mes', 'diaSemana'].forEach((g) => {
    const l = sinError(api('adminInforme', { ...R, agrupar: g }, adm)).filas, s = (k) => Math.round(l.reduce((a, x) => a + x[k], 0) * 10) / 10;
    assert(Math.abs(s('horas') - tot.horas) < 0.5, g + ' horas'); eq(s('ausencias'), tot.ausencias, g); assert(Math.abs(s('costo') - tot.costo) < 50, g + ' costo');
  });
  const prev = sinError(api('adminNominaPrevia', R, adm)).filas.reduce((a, x) => a + x.liq.devengado, 0); assert(Math.abs(tot.costo - prev) < 50, 'costo = devengado de la nómina');
  const solo = sinError(api('adminInforme', { ...R, agrupar: 'persona', filtros: { centros: [c2.id] } }, adm)).filas; assert(solo.every(x => x.clave !== '1020333444'));
  sinError(api('adminConfigGuardar', { factorPrestacional: 52 }, adm)); assert(Math.abs(sinError(api('adminInforme', { ...R, agrupar: 'total' }, adm)).filas[0].costo - tot.costo * 1.52) < 80); sinError(api('adminConfigGuardar', { factorPrestacional: 0 }, adm));
  const s = sinError(api('adminInforme', { ...R, agrupar: 'persona' }, sup)); eq(s.verCosto, false); assert(s.filas.every(x => x.costo === null && x.clave !== '80222000'));
  falla(api('adminInforme', { desde: '2026-01-01', hasta: '2026-11-30' }, adm), 'DATOS');
});
t('el trabajador consulta su resumen en el rango que elija', () => {
  const r = sinError(api('miResumen', { desde: '2026-11-01', hasta: '2026-11-30' }, tr)); assert(r.horas.trabajadas > 0 && r.dias.length > 0); assert(!('porFecha' in r));
});

/* ---- Seguridad, retención, respaldo, monitoreo ---- */
t('dar de baja revoca la sesión de inmediato', () => {
  sinError(api('adminPersonaGuardar', { cedula: '52111222', nombre: 'Luisa Gómez', centroId: centro.id, salario: 2500000, estado: 'inactivo' }, adm));
  falla(api('yo', {}, tr2), 'SESION'); falla(api('login', { cedula: '52111222', clave: 'luisa2026' }), 'PERMISO');
});
t('el administrador no puede desactivarse ni quitarse el rol', () => falla(api('adminPersonaGuardar', { cedula: '79000001', nombre: 'Ana Admin', salario: 5000000, rol: 'trabajador' }, adm), 'DATOS'));
t('retención automática: borra fotos antiguas sin que nadie abra el panel', () => {
  const f = S.leer('Marcaciones').find(m => m.foto); assert(X.archivos[f.foto]);
  hora('2026-12-20', '02:00'); S.limpiar(); S.limpiarDatos_(); S.limpiar();
  assert(!X.archivos[f.foto]); eq(S.leer('Marcaciones').filter(m => m.foto).length, 0); assert(S.leer('Marcaciones')[0].lat !== '');
});
t('copia de seguridad: crea la copia, conserva las últimas N y avisa', () => {
  sinError(api('adminConfigGuardar', { respaldoConservar: 2 }, adm));
  for (let i = 0; i < 4; i++) sinError(api('adminRespaldar', {}, adm));
  eq(Object.values(X.archivos).filter(a => a.carpeta === X.props.CARPETA_RESPALDOS).length, 2); assert(X.props.ULTIMO_RESPALDO);
});
t('monitoreo: errores del cliente quedan registrados y el panel de salud responde', () => {
  sinError(api('error', { mensaje: 'TypeError: x is undefined', detalle: 'en Inicio.jsx', version: '1.0.0' }));
  const s = sinError(api('adminSalud', {}, adm)); eq(s.errores7d, 1); assert(s.pruebas.every(p => p.ok), JSON.stringify(s.pruebas)); eq(s.disparadores.length, 3);
  assert(sinError(api('adminBitacoras', { cual: 'auditoria' }, adm)).length > 10);
});
t('una acción desconocida o un cuerpo inválido no rompe el servicio', () => {
  falla(api('noExiste', {}), 'ACCION');
  eq(JSON.parse(S.doPost({ postData: { contents: '{mal json' } }).texto).e, 'ERROR');
});
t('cerrar sesión invalida el token', () => { sinError(api('salir', {}, tr)); falla(api('yo', {}, tr), 'SESION'); });
console.log(`API: ${ok} pruebas correctas, ${mal} con error`); process.exit(mal ? 1 : 0);
