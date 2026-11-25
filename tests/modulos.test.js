// Pruebas de los módulos avanzados (v1.6–1.7). Ejecutar: node tests/modulos.test.js
const assert = require('assert'), { crear } = require('./simulador'), crypto = require('crypto');
let ok = 0, mal = 0;
function t(n, f) { try { f(); ok++; } catch (e) { mal++; console.log('✗ ' + n + '\n   ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n   ')); } }
const eq = (a, b, m) => assert.strictEqual(a, b, m);
const sinError = (r) => { assert(r.ok, r.e + ': ' + r.m); return r.d; };
const falla = (r, cod) => { assert(!r.ok, 'debía fallar'); eq(r.e, cod, r.m); };
const CONS = { datos: true, sensibles: true }, GPS = { lat: 4.65, lng: -74.1, prec: 10 }, FOTO = 'data:image/jpeg;base64,' + 'A'.repeat(400);
const H = { e: '07:00', s: '16:24', ai: '12:00', af: '13:00' }, LV = { 1: H, 2: H, 3: H, 4: H, 5: H };

function empresa(opciones) {
  const X = crear(opciones), { S, api } = X, hora = (f, h) => S.ahora(new Date(f + 'T' + h + ':00-05:00').toISOString());
  hora('2026-09-01', '06:00'); S.instalar();
  const adm = sinError(api('registro', { cedula: '79000001', codigo: X.props.CODIGO_ADMIN, clave: 'secreta1', nombre: 'Ana Admin', salario: 5000000, consentimiento: CONS, email: 'ana@empresa.co' })).token;
  sinError(api('adminConfigGuardar', { fotoProbabilidad: 0, fotoEnAnomalia: false, urlApp: 'https://app.ejemplo.co/' }, adm));
  const c1 = sinError(api('adminCentroGuardar', { nombre: 'Planta', lat: 4.65, lng: -74.1, radio: 150, horario: LV, tol: 5 }, adm));
  const c2 = sinError(api('adminCentroGuardar', { nombre: 'Bodega', lat: 4.71, lng: -74.2, radio: 150, horario: LV, tol: 5 }, adm));
  const tk = {};
  [['1020333444', 'Pedro Pérez', c1.id, 'trabajador'], ['52111222', 'Luisa Gómez', c2.id, 'trabajador'], ['80111000', 'Sara Sup', c1.id, 'supervisor']].forEach(([ced, nombre, centroId, rol]) => {
    const r = sinError(api('adminPersonaGuardar', { cedula: ced, nombre, centroId, rol, supCentros: rol === 'supervisor' ? [centroId] : [], salario: 1750905, ingreso: '2025-03-10', email: ced + '@correo.co' }, adm));
    tk[ced] = sinError(api('registro', { cedula: ced, codigo: r.codigo, clave: 'clave2026', consentimiento: CONS })).token;
  });
  return { X, S, api, hora, adm, tk, c1, c2 };
}
const E = empresa();
const { S, api, hora, adm, tk, c1 } = E, P = '1020333444';
function semana(f0, salida) { ['01', '02', '03', '04', '05'].forEach((d) => { const f = f0 + d; hora(f, '06:58'); sinError(api('marcar', { tipo: 'entrada', ...GPS }, tk[P])); hora(f, salida); sinError(api('marcar', { tipo: 'salida', ...GPS }, tk[P])); }); }

t('préstamo: la cuota se descuenta al cerrar la nómina y aparece en el desprendible', () => {
  falla(api('adminPrestamoGuardar', { cedula: P, concepto: 'Adelanto', monto: 300000, cuotas: 3 }, adm), 'DATOS'); // sin autorización firmada no se crea
  sinError(api('adminPersonaGuardar', { cedula: P, nombre: 'Pedro Pérez', centroId: c1.id, rol: 'trabajador', salario: 3000000, ingreso: '2025-03-10', email: P + '@correo.co' }, adm)); // con el mínimo no se puede descontar (mínimo vital)
  sinError(api('adminPrestamoGuardar', { cedula: P, concepto: 'Adelanto', monto: 300000, cuotas: 3, autorizacion: FOTO }, adm));
  falla(api('adminPrestamoAplicarCuota', { id: sinError(api('adminPrestamos', {}, adm))[0].id }, adm), 'DATOS'); // no hay descuento manual
  semana('2026-09-', '16:24');
  hora('2026-09-17', '08:00'); sinError(api('adminNominaCerrar', { desde: '2026-09-01', hasta: '2026-09-15' }, adm));
  const p = sinError(api('adminPrestamos', {}, adm))[0]; eq(p.saldo, 200000); eq(p.pagadas, 1);
  eq(S.leer('Novedades').filter((n) => n.cedula === P && n.concepto.startsWith('Cuota')).length, 1, 'una sola cuota por periodo');
  const d = sinError(api('desprendibles', {}, tk[P]))[0]; assert(d.detalle.deduccionesDet.some((x) => x.cod === 'DES' && x.valor === 100000), 'cuota en el desprendible');
  sinError(api('confirmarDesprendible', { id: d.id }, tk[P])); assert(sinError(api('desprendibles', {}, tk[P]))[0].acuse.startsWith('2026'));
});
t('compensatorios: las extras se abonan con su recargo, sin duplicar, y el saldo no queda negativo', () => {
  hora('2026-09-21', '06:58'); sinError(api('marcar', { tipo: 'entrada', ...GPS }, tk[P])); hora('2026-09-21', '18:24'); sinError(api('marcar', { tipo: 'salida', ...GPS }, tk[P]));
  const x = sinError(api('adminExtras', { estado: 'pendiente' }, adm)).find((e) => e.fecha === '2026-09-21');
  falla(api('adminExtraDecidir', { id: x.id, decision: 'aprobar', min: 120, aCompensatorio: true, obs: 'Acuerdo firmado 21-sep' }, adm), 'DATOS'); // apagado por defecto
  sinError(api('adminConfigGuardar', { compensarExtras: true }, adm));
  falla(api('adminExtraDecidir', { id: x.id, decision: 'aprobar', min: 120, aCompensatorio: true }, adm), 'DATOS'); // sin el acuerdo escrito
  sinError(api('adminExtraDecidir', { id: x.id, decision: 'aprobar', min: 120, aCompensatorio: true, obs: 'Acuerdo firmado 21-sep', soporte: FOTO }, adm));
  eq(sinError(api('misCompensatorios', {}, tk[P])).saldoMin, 150, '2 h extra diurnas = 2,5 h de descanso (25 %)');
  sinError(api('adminExtraDecidir', { id: x.id, decision: 'aprobar', min: 120, aCompensatorio: true, obs: 'Acuerdo firmado 21-sep', soporte: FOTO }, adm));
  eq(sinError(api('misCompensatorios', {}, tk[P])).saldoMin, 150, 'decidir otra vez no duplica');
  falla(api('adminCompensatorioGuardar', { cedula: P, minutos: -480, fecha: '2026-09-25' }, adm), 'DATOS');
  sinError(api('adminCompensatorioGuardar', { cedula: P, minutos: -150, fecha: '2026-09-25' }, adm)); // los disfrutó
  falla(api('adminExtraDecidir', { id: x.id, decision: 'aprobar', min: 120, obs: 'mejor en dinero' }, adm), 'DATOS'); // ya no se puede quitar el abono
});
t('comunicados: llegan según el centro y registran la lectura', () => {
  sinError(api('adminComunicadoCrear', { titulo: 'Simulacro', cuerpo: 'Jueves 10 a. m.', centros: [c1.id] }, adm));
  const m = sinError(api('comunicadosMios', {}, tk[P])); eq(m.length, 1); eq(sinError(api('comunicadosMios', {}, tk['52111222'])).length, 0);
  sinError(api('comunicadoLeer', { id: m[0].id }, tk[P])); eq(sinError(api('adminComunicados', {}, adm))[0].totalLeidos, 1);
});
t('certificado laboral verificable por cualquiera con cédula, fecha y código', () => {
  const c = sinError(api('certificadoLaboral', { conSalario: true }, tk[P])); eq(c.empleado.salario, 3000000); assert(c.verificarEn.endsWith('#/verificar'));
  const v = sinError(api('certificadoVerificar', { cedula: P, fecha: c.fecha, codigo: c.codigoVerificacion })); eq(v.valido, true); eq(v.salario, 3000000, 'la verificación muestra el salario certificado');
  eq(sinError(api('certificadoVerificar', { cedula: P, fecha: c.fecha, codigo: 'ABCDEFGHIJ' })).valido, false);
  for (let i = 0; i < 12; i++) api('certificadoVerificar', { cedula: '11111111', fecha: c.fecha, codigo: 'ABCDEFGHIJ' }); // alguien satura con otra cédula…
  eq(sinError(api('certificadoVerificar', { cedula: P, fecha: c.fecha, codigo: c.codigoVerificacion })).valido, true, '…y la verificación legítima sigue funcionando');
});
t('kiosco: sesión propia que solo marca en su centro; no sirve para adivinar claves ni para entrar al panel', () => {
  hora('2026-09-22', '06:50'); const sup = sinError(api('login', { cedula: '80111000', clave: 'clave2026' })).token;
  falla(api('kioscoIniciar', { centroId: E.c2.id }, sup), 'PERMISO'); // centro que no es suyo
  const k = sinError(api('kioscoIniciar', { centroId: c1.id }, sup)).token;
  eq(sinError(api('yo', {}, k)).kiosco.centroId, c1.id);
  falla(api('adminExtras', { estado: 'pendiente' }, k), 'PERMISO'); falla(api('adminExtraDecidir', { id: 'x', decision: 'aprobar', min: 10 }, k), 'PERMISO'); falla(api('marcar', { tipo: 'entrada', ...GPS }, k), 'PERMISO');
  falla(api('kioscoMarcar', { cedula: P, clave: 'clave2026', tipo: 'entrada', ...GPS }, sup), 'PERMISO'); // sin activar el kiosco no se usa
  hora('2026-09-22', '06:55'); const r = sinError(api('kioscoMarcar', { cedula: P, clave: 'clave2026', tipo: 'entrada', ...GPS }, k)); eq(r.usuario, 'Pedro');
  falla(api('kioscoMarcar', { cedula: P, clave: 'mala', tipo: 'salida', ...GPS }, k), 'CREDENCIALES');
  falla(api('kioscoMarcar', { cedula: '52111222', clave: 'clave2026', tipo: 'entrada', ...GPS }, k), 'CREDENCIALES'); // otra obra: mismo error que clave mala
  falla(api('kioscoMarcar', { cedula: '79000001', clave: 'secreta1', tipo: 'entrada', ...GPS }, k), 'CREDENCIALES'); // nunca administradores
  falla(api('kioscoMarcar', { cedula: '79000001', clave: 'otra', tipo: 'entrada', ...GPS }, k), 'CREDENCIALES');
  falla(api('kioscoMarcar', { cedula: P, clave: 'clave2026', tipo: 'salida', ...GPS }, tk[P]), 'PERMISO');
  sinError(api('adminCentroGuardar', { ...c1, exigirQr: true }, adm)); hora('2026-09-22', '16:30');
  sinError(api('kioscoMarcar', { cedula: P, clave: 'clave2026', tipo: 'salida', ...GPS }, k)); // la tablet está en la obra: no pide QR
  sinError(api('adminCentroGuardar', { ...c1, exigirQr: false }, adm));
});
t('QR de obra: sin el código vigente no se marca; con el del minuto o el del día sí', () => {
  sinError(api('adminCentroGuardar', { ...c1, exigirQr: true }, adm));
  hora('2026-09-23', '06:55'); falla(api('marcar', { tipo: 'entrada', ...GPS }, tk[P]), 'QR_REQUERIDO');
  const q = sinError(api('adminQrCentro', { centroId: c1.id }, tk['80111000']));
  sinError(api('marcar', { tipo: 'entrada', ...GPS, qrCodigo: q.qrPayload }, tk[P]));
  const dia = sinError(api('adminQrCentro', { centroId: c1.id }, adm)).codigoDia;
  hora('2026-09-23', '12:00'); falla(api('marcar', { tipo: 'sal_alm', lat: 4.80, lng: -74.3, prec: 10, qrCodigo: dia }, tk[P]), 'QR_REQUERIDO'); // código del día fuera de la obra
  falla(api('marcar', { tipo: 'sal_alm', ...GPS, manual: true, hora: '2026-09-23T11:58', motivo: 'se me olvidó' }, tk[P]), 'QR_REQUERIDO'); // "olvido" de hace 2 min
  hora('2026-09-23', '16:30'); sinError(api('marcar', { tipo: 'salida', ...GPS, qrCodigo: dia }, tk[P]));
  sinError(api('adminCentroGuardar', { ...c1, exigirQr: false }, adm));
});
t('GPS: desplazamiento imposible queda en revisión con alerta; señal muy imprecisa se rechaza', () => {
  hora('2026-09-24', '06:55'); sinError(api('marcar', { tipo: 'entrada', ...GPS }, tk[P]));
  hora('2026-09-24', '07:05'); sinError(api('marcar', { tipo: 'sal_alm', lat: 6.25, lng: -75.56, prec: 10 }, tk[P]));
  assert(S.leer('Alertas').some((a) => a.tipo === 'gps_sospechoso'));
  falla(api('marcar', { tipo: 'ent_alm', lat: 4.65, lng: -74.1, prec: 500 }, tk[P]), 'GPS_IMPRECISO');
});
t('dos marcaciones seguidas en el mismo minuto se aceptan', () => {
  hora('2026-09-24', '12:00'); sinError(api('marcar', { tipo: 'ent_alm', ...GPS }, tk[P])); sinError(api('marcar', { tipo: 'salida', ...GPS }, tk[P]));
});
t('celular vinculado: otro equipo no entra hasta que el administrador lo libere', () => {
  sinError(api('adminConfigGuardar', { vincularDispositivo: true }, adm));
  sinError(api('login', { cedula: '52111222', clave: 'clave2026', dispositivoId: 'CEL-A' }));
  falla(api('login', { cedula: '52111222', clave: 'clave2026', dispositivoId: 'CEL-B' }), 'DISPOSITIVO');
  falla(api('login', { cedula: '52111222', clave: 'clave2026' }), 'DISPOSITIVO'); // sin identificador tampoco entra
  sinError(api('adminLiberarDispositivo', { cedula: '52111222' }, adm)); sinError(api('login', { cedula: '52111222', clave: 'clave2026', dispositivoId: 'CEL-B' }));
  sinError(api('adminConfigGuardar', { vincularDispositivo: false }, adm));
});
t('verificación en dos pasos del administrador por correo', () => {
  const r2 = sinError(api('adminPersonaGuardar', { cedula: '79000002', nombre: 'Beto Admin', rol: 'admin', salario: 3000000 }, adm));
  sinError(api('registro', { cedula: '79000002', codigo: r2.codigo, clave: 'beto2026x', consentimiento: CONS }));
  falla(api('adminConfigGuardar', { admin2FA: true }, adm), 'DATOS'); // hay un administrador sin correo
  sinError(api('adminPersonaGuardar', { cedula: '79000002', nombre: 'Beto Admin', rol: 'admin', salario: 3000000, email: 'beto@empresa.co' }, adm));
  sinError(api('adminConfigGuardar', { admin2FA: true }, adm));
  const n = E.X.correos.length; falla(api('login', { cedula: '79000001', clave: 'secreta1' }), '2FA_REQUERIDO');
  const cod = /es: (\d{6})/.exec(E.X.correos.slice(n).pop().body)[1];
  falla(api('login', { cedula: '79000001', clave: 'secreta1', codigo2fa: '000000' }), 'CREDENCIALES');
  sinError(api('login', { cedula: '79000001', clave: 'secreta1', codigo2fa: cod }));
  sinError(api('recuperarPedir', { cedula: '79000002' })); const rc = /(\d{6})/.exec(E.X.correos.slice(-1)[0].body)[1];
  assert(!sinError(api('recuperarCambiar', { cedula: '79000002', codigo: rc, clave: 'beto2027x' })).token, 'recuperar no salta el código');
  falla(api('login', { cedula: '79000002', clave: 'beto2027x' }), '2FA_REQUERIDO');
  const cod2 = /es: (\d{6})/.exec(E.X.correos.slice(-1)[0].body)[1]; sinError(api('login', { cedula: '79000002', clave: 'beto2027x', codigo2fa: cod2 }));
  sinError(api('adminConfigGuardar', { admin2FA: false }, adm));
});
t('liquidación de contrato: usa el promedio cuando hay salario variable y no descuenta préstamos sin autorización', () => {
  const l = sinError(api('adminLiquidacionContrato', { cedula: P, fechaRetiro: '2026-09-30' }, adm));
  assert(l.basePrestaciones >= l.salario + l.auxTransporte, 'base al menos salario + auxilio'); eq(l.saldoPrestamos, 200000); eq(l.descuentoPrestamos, 0);
  eq(l.diasAnio, 270, 'meses de 30 días'); eq(l.diasSemestre, 90); eq(l.cesantias, Math.round(l.baseCesantias * 270 / 360)); eq(l.indemnizacion, 0);
  const l2 = sinError(api('adminLiquidacionContrato', { cedula: P, fechaRetiro: '2026-09-30', autorizaDescuento: true }, adm)); eq(l2.totalEstimado, l.totalEstimado - 200000);
  const l3 = sinError(api('adminLiquidacionContrato', { cedula: P, fechaRetiro: '2026-09-30', causa: 'sin_justa_causa' }, adm));
  const dIndem = 30 + 20 * (l3.diasServicio / 360 - 1); assert(Math.abs(l3.indemnizacion - Math.round(l3.salario / 30 * dIndem)) <= 1, 'art. 64: 30 días el primer año y 20 por año adicional');
  const r = sinError(api('adminLiquidacionContrato', { cedula: P, fechaRetiro: '2026-12-31' }, adm)); eq(r.diasAnio, 360);
});
t('provisiones de prestaciones: prima y cesantías al 8,33 % del devengado', () => {
  const p = sinError(api('adminProvisiones', { desde: '2026-09-16', hasta: '2026-09-30' }, adm)), f = p.filas.find((x) => x.cedula === P);
  eq(f.prima, Math.round(f.devengado / 12)); eq(f.intereses, Math.round(f.cesantias * 0.12));
  assert(f.aportesDet.pension > 0 && f.aportesDet.caja > 0 && f.aportesDet.arl > 0 && f.aportesDet.salud > 0, 'aportes del empleador (sin exoneración por defecto)');
  eq(f.costoTotal, f.devengado + f.totalProvisiones + f.aportes);
});
t('traslado masivo, edición de incapacidad y supresión de datos de un exempleado', () => {
  eq(sinError(api('adminTrasladoMasivo', { centroId: E.c2.id, cedulas: [P] }, adm)).movidos, 1);
  sinError(api('adminIncapacidadGuardar', { cedula: '52111222', tipo: 'general', desde: '2026-09-25', hasta: '2026-09-26' }, adm));
  const i = sinError(api('adminIncapacidades', {}, adm))[0]; sinError(api('adminIncapacidadEditar', { id: i.id, hasta: '2026-09-29' }, adm)); eq(sinError(api('adminIncapacidades', {}, adm))[0].hasta, '2026-09-29');
  falla(api('adminAnonimizarUsuario', { cedula: '52111222' }, adm), 'DATOS');
  sinError(api('adminPersonaGuardar', { cedula: '52111222', nombre: 'Luisa Gómez', salario: 1750905, estado: 'inactivo' }, adm));
  const cert = sinError(api('adminCertificadoLaboral', { cedula: '52111222', conSalario: true }, adm)); eq(cert.empleado.estado, 'retirado'); // RRHH certifica a retirados
  sinError(api('adminIncapacidadEditar', { id: i.id, nota: 'gastritis crónica' }, adm));
  const sup = sinError(api('adminAnonimizarUsuario', { cedula: '52111222' }, adm)); assert(sinError(api('adminPersonal', {}, adm)).find((u) => u.cedula === '52111222').nombre.startsWith('Exempleado'));
  assert(sup.conservado.includes('CST'));
  assert(!S.leer('Incapacidades').some((x) => x.cedula === '52111222' && x.nota), 'sin datos de salud');
  assert(!S.leer('Marcaciones').some((m) => m.cedula === '52111222' && (m.lat || m.foto)), 'sin GPS ni fotos');
  eq(sinError(api('certificadoVerificar', { cedula: '52111222', fecha: cert.fecha, codigo: cert.codigoVerificacion })).valido, false, 'el certificado ya no se verifica');
});
t('vista en vivo, expediente y tablero 360°', () => {
  hora('2026-09-28', '08:00'); sinError(api('marcar', { tipo: 'entrada', ...GPS, lat: 4.71, lng: -74.2 }, tk[P]));
  eq(sinError(api('adminEnVivo', {}, adm)).resumen.en_obra, 1);
  const x = sinError(api('adminExpediente360', { cedula: P }, adm)); eq(x.usuario.cedula, P); assert(x.prestamos.length === 1);
  sinError(api('adminPersonaGuardar', { cedula: '80111000', nombre: 'Sara Sup', rol: 'supervisor', supCentros: [E.c2.id], centroId: c1.id, salario: 1750905 }, adm));
  const xs = sinError(api('adminExpediente360', { cedula: P }, tk['80111000'])); assert(xs.usuario.salario === undefined && xs.usuario.cuenta === undefined && !xs.prestamos.length, 'el supervisor no ve salario, cuenta ni préstamos');
  assert(sinError(api('adminTablero360', {}, adm)).alertasOperativas);
});
t('auditoría encadenada: detecta una fila alterada a mano', () => {
  eq(sinError(api('adminVerificarAuditoria', {}, adm)).integra, true);
  const h = E.X.hojas.Auditoria, copia = h.map((r) => r.slice()); h[3][3] = 'alterado'; S.limpiar(); eq(sinError(api('adminVerificarAuditoria', {}, adm)).integra, false);
  h.forEach((r, i) => { if (i >= 3) r[4] = ''; }); S.limpiar(); eq(sinError(api('adminVerificarAuditoria', {}, adm)).integra, false, 'borrar las firmas también se detecta');
  h.length = 0; copia.forEach((r) => h.push(r)); h.splice(-3, 3); S.limpiar(); eq(sinError(api('adminVerificarAuditoria', {}, adm)).integra, false, 'borrar las últimas filas también se detecta');
  h.length = 0; copia.forEach((r) => h.push(r)); S.limpiar(); eq(sinError(api('adminVerificarAuditoria', {}, adm)).integra, true);
});
t('Telegram: las alertas salen también por Telegram cuando está configurado', () => {
  sinError(api('adminConfigGuardar', { telegramToken: '123:abc', telegramChatId: '-100200' }, adm));
  const n = E.X.correos.length; hora('2026-09-29', '07:40'); sinError(api('marcar', { tipo: 'entrada', ...GPS, lat: 4.71, lng: -74.2 }, tk[P]));
  const tg = E.X.correos.slice(n).filter((m) => m.to === 'telegram'); assert(tg.some((m) => m.body.includes('Llegada tarde')));
  assert(!tg.some((m) => m.body.includes('Pedro')), 'por defecto Telegram no lleva nombres');
});
t('archivo histórico: va a su propia carpeta y la rotación de copias no lo borra', () => {
  const X = E.X, cols = X.hojas.Marcaciones[0], iF = cols.indexOf('fecha'), iE = cols.indexOf('estado');
  for (let i = 0; i < 520; i++) { const r = cols.map(() => ''); r[0] = 'viejo' + i; r[1] = P; r[iF] = '2024-01-1' + (i % 9); r[3] = 'entrada'; r[iE] = 'ok'; X.hojas.Marcaciones.splice(1, 0, r); }
  X.hojas.Periodos.push(['2024-01-01', '2024-01-31', 'x', 'x']);
  hora('2026-09-30', '02:00'); S.limpiar(); S.archivarHistorico_(); S.limpiar();
  const hist = Object.values(X.archivos).find((a) => a.nombre && a.nombre.startsWith('Histórico Marcaciones')); assert(hist, 'se creó el histórico'); eq(hist.hojas.Marcaciones.length, 521);
  assert(hist.hojas.Marcaciones.slice(1).every((r) => r[cols.indexOf('lat')] === '' && r[cols.indexOf('foto')] === ''), 'el histórico no guarda GPS ni fotos');
  assert(hist.carpeta !== X.props.CARPETA_RESPALDOS); assert(!S.leer('Marcaciones').some((m) => m.id.startsWith('viejo')));
  sinError(api('adminConfigGuardar', { respaldoConservar: 1 }, adm)); for (let i = 0; i < 3; i++) sinError(api('adminRespaldar', {}, adm));
  assert(Object.values(X.archivos).includes(hist), 'el histórico sigue ahí');
});

t('préstamo grande: la cuota no deja el neto por debajo del mínimo y el saldo sigue para el siguiente periodo', () => {
  sinError(api('adminPrestamoGuardar', { cedula: P, concepto: 'Moto', monto: 3000000, cuotas: 1, autorizacion: FOTO }, adm));
  ['05', '06', '07', '08', '09'].forEach((d) => { hora('2026-10-' + d, '06:58'); sinError(api('marcar', { tipo: 'entrada', ...GPS, lat: 4.71, lng: -74.2 }, tk[P])); hora('2026-10-' + d, '16:24'); sinError(api('marcar', { tipo: 'salida', ...GPS, lat: 4.71, lng: -74.2 }, tk[P])); });
  hora('2026-10-17', '08:00'); S.leer('Marcaciones').filter((m) => m.estado === 'revisar' && m.fecha >= '2026-10-01').forEach((m) => sinError(api('adminMarcacionGuardar', { id: m.id, estado: 'ok' }, adm)));
  sinError(api('adminNominaCerrar', { desde: '2026-10-01', hasta: '2026-10-15' }, adm));
  const d = sinError(api('desprendibles', {}, tk[P])).find((x) => x.desde === '2026-10-01'); assert(d.neto > 0, 'neto positivo: ' + d.neto);
  const moto = sinError(api('adminPrestamos', {}, adm)).find((x) => x.concepto === 'Moto'); assert(moto.saldo > 0 && moto.saldo < 3000000, 'cuota reducida y saldo pendiente');
});

t('jornalero: la liquidación usa el jornal × 30 y el certificado dice que es diario', () => {
  const r = sinError(api('adminPersonaGuardar', { cedula: '70777888', nombre: 'Jorge Jornal', centroId: c1.id, rol: 'trabajador', salario: 70000, tipoPago: 'dia', ingreso: '2026-01-01' }, adm));
  const t2 = sinError(api('registro', { cedula: '70777888', codigo: r.codigo, clave: 'clave2026', consentimiento: CONS })).token;
  const l = sinError(api('adminLiquidacionContrato', { cedula: '70777888', fechaRetiro: '2026-06-30' }, adm));
  eq(l.salario, 2100000); eq(l.cesantias, Math.round(l.baseCesantias * 180 / 360)); assert(l.baseCesantias >= 2100000);
  const c = sinError(api('certificadoLaboral', { conSalario: true }, t2)); eq(c.empleado.salarioTipo, 'diario');
});
t('kiosco: solo un supervisor con su clave lo apaga; el kiosco no puede cerrarse solo', () => {
  hora('2026-10-20', '07:00'); const sup = sinError(api('login', { cedula: '79000001', clave: 'secreta1' })).token;
  const k = sinError(api('kioscoIniciar', { centroId: c1.id }, sup)).token;
  falla(api('salir', {}, k), 'PERMISO');
  falla(api('kioscoSalir', { cedula: P, clave: 'clave2026' }, k), 'CREDENCIALES'); // un trabajador no lo apaga
  sinError(api('kioscoSalir', { cedula: '79000001', clave: 'secreta1' }, k));
  falla(api('yo', {}, k), 'SESION');
});
t('liquidación registrada: queda en su hoja y cierra el préstamo descontado', () => {
  const antes = sinError(api('adminPrestamos', {}, adm)).filter((x) => x.cedula === P && x.estado === 'activo').length; assert(antes > 0);
  hora('2026-11-01', '08:00'); const l = sinError(api('adminLiquidacionContrato', { cedula: P, fechaRetiro: '2026-10-31', autorizaDescuento: true, guardar: true }, adm));
  assert(l.descuentoPrestamos <= Math.floor(l.salarioPendiente * 0.5) + l.prima + l.vacaciones + l.indemnizacion, 'no se descuenta de las cesantías');
  assert(l.id && S.leer('Liquidaciones').some((x) => x.id === l.id));
  assert(l.descuentoPrestamos > 0);
  hora('2026-11-02', '08:00'); sinError(api('adminNominaCerrar', { desde: '2026-10-16', hasta: '2026-10-31' }, adm));
  assert(!S.leer('Nomina').some((n) => n.cedula === P && n.desde === '2026-10-16'), 'ya liquidado: no se le paga dos veces');
  falla(api('adminLiquidacionContrato', { cedula: P, fechaRetiro: '2026-10-31', guardar: true }, adm), 'DATOS'); // no se registra dos veces
  falla(api('adminLiquidacionContrato', { cedula: '80111000', fechaRetiro: '2027-01-15', guardar: true }, adm), 'DATOS'); // ni con retiro futuro
});

t('seguridad: nadie bloquea el ingreso de todos ni la verificación de un certificado auténtico', () => {
  hora('2026-11-03', '08:00');
  for (let i = 0; i < 140; i++) api('login', { cedula: String(30000000 + i), clave: 'basura' });
  sinError(api('login', { cedula: '79000001', clave: 'secreta1' }));
  const c = sinError(api('certificadoLaboral', {}, tk['80111000']));
  for (let i = 0; i < 30; i++) api('certificadoVerificar', { cedula: '80111000', fecha: c.fecha, codigo: 'ZZZZZZZZZ' + (i % 10) });
  eq(sinError(api('certificadoVerificar', { cedula: '80111000', fecha: c.fecha, codigo: c.codigoVerificacion })).valido, true);
});
t('supresión: no quedan motivos de salud en alertas; las alertas no copian el motivo', () => {
  const r = sinError(api('adminPersonaGuardar', { cedula: '41222333', nombre: 'Marta Prueba', centroId: c1.id, rol: 'trabajador', salario: 1750905, ingreso: '2026-01-01' }, adm));
  const t3 = sinError(api('registro', { cedula: '41222333', codigo: r.codigo, clave: 'clave2026', consentimiento: CONS })).token;
  hora('2026-11-04', '09:00'); sinError(api('marcar', { tipo: 'entrada', ...GPS, manual: true, hora: '2026-11-04T07:00', motivo: 'cita de oncología' }, t3));
  assert(!S.leer('Alertas').some((a) => a.detalle.includes('oncología')), 'la alerta no copia el motivo');
  sinError(api('adminPersonaGuardar', { cedula: '41222333', nombre: 'Marta Prueba', salario: 1750905, estado: 'inactivo' }, adm));
  sinError(api('adminAnonimizarUsuario', { cedula: '41222333' }, adm));
  assert(!S.leer('Alertas').some((a) => a.cedula === '41222333' && a.detalle !== '[suprimido]'));
  assert(!S.leer('Marcaciones').some((m) => m.cedula === '41222333' && m.motivo.includes('oncología')));
});

t('salir a un permiso aprobado: registra la hora y cierra la jornada; por horas, registra el regreso', () => {
  const r = sinError(api('adminPersonaGuardar', { cedula: '43555666', nombre: 'Sofía Permiso', centroId: c1.id, rol: 'trabajador', salario: 1750905, ingreso: '2026-01-01' }, adm));
  const t4 = sinError(api('registro', { cedula: '43555666', codigo: r.codigo, clave: 'clave2026', consentimiento: CONS })).token;
  hora('2026-11-09', '06:58'); sinError(api('marcar', { tipo: 'entrada', ...GPS }, t4));
  const crea = (o) => { const p = sinError(api('permisoCrear', o, t4)); sinError(api('adminPermisoDecidir', { id: p.id, decision: 'aprobar', forzar: true }, adm)); return p.id; };
  const id1 = crea({ tipo: 'cita_medica', fechaSalida: '2026-11-09', horaSalida: '10:00', fechaRegreso: '2026-11-09', horaRegreso: '12:00', motivo: 'Cita de control' });
  let y = sinError(api('yo', {}, t4)); eq(y.hoy.permiso.id, id1); eq(y.hoy.permiso.fase, 'salir');
  hora('2026-11-09', '10:00'); const s1 = sinError(api('permisoSalir', { id: id1, ...GPS }, t4)); eq(s1.cerroJornada, false); eq(s1.hoy.permiso.fase, 'regresar');
  falla(api('permisoSalir', { id: id1, ...GPS }, t4), 'DATOS');
  hora('2026-11-09', '12:20'); const g = sinError(api('permisoRegresar', { id: id1, ...GPS }, t4)); eq(g.tarde, 20); eq(g.hoy.permiso, null);
  const id2 = crea({ tipo: 'cita_medica', fechaSalida: '2026-11-09', horaSalida: '15:00', fechaRegreso: '2026-11-10', horaRegreso: '07:00', motivo: 'Diligencia' });
  hora('2026-11-09', '15:00'); const s2 = sinError(api('permisoSalir', { id: id2, ...GPS }, t4)); eq(s2.cerroJornada, true); eq(s2.hoy.marcas.salida, '15:00');
  const otro = sinError(api('adminPermisos', {}, adm)).find((p) => p.id === id2); assert(otro.salidaReal, 'el panel ve la hora real');
});

t('no salí a almuerzo: con quién autoriza y razón; aprobado, el almuerzo no se descuenta', () => {
  const r = sinError(api('adminPersonaGuardar', { cedula: '44777888', nombre: 'Tomás Almuerzo', centroId: c1.id, rol: 'trabajador', salario: 1750905, ingreso: '2026-01-01' }, adm));
  const t5 = sinError(api('registro', { cedula: '44777888', codigo: r.codigo, clave: 'clave2026', consentimiento: CONS })).token;
  falla(api('sinAlmuerzo', { autoriza: 'otro:Jefe', razon: 'Vaciado de concreto' }, t5), 'DATOS'); // sin entrada
  hora('2026-11-10', '06:58'); sinError(api('marcar', { tipo: 'entrada', ...GPS }, t5));
  const aut = sinError(api('autorizadores', {}, t5)); assert(aut.some((x) => x.id === 'u:79000001'), 'el administrador puede autorizar');
  falla(api('sinAlmuerzo', { autoriza: 'u:79000001', razon: 'x' }, t5), 'DATOS'); // sin razón
  falla(api('sinAlmuerzo', { autoriza: 'u:00000000', razon: 'Vaciado de concreto' }, t5), 'DATOS'); // autorizador inventado
  hora('2026-11-10', '13:30'); const s1 = sinError(api('sinAlmuerzo', { autoriza: 'u:79000001', razon: 'Vaciado de concreto continuo' }, t5));
  eq(s1.hoy.siguiente, 'salida'); eq(s1.hoy.sinAlmuerzo.estado, 'pendiente');
  hora('2026-11-10', '16:24'); sinError(api('marcar', { tipo: 'salida', ...GPS }, t5));
  const x = sinError(api('adminSinAlmuerzo', {}, adm)).find((y) => y.cedula === '44777888'); eq(x.autorizaNombre, 'Ana Admin'); eq(x.razon, 'Vaciado de concreto continuo');
  const min = () => { S.limpiar(); return S.leer('Extras').filter((e) => e.cedula === '44777888' && e.fecha === '2026-11-10' && e.estado !== 'sin_extra').reduce((s, e) => s + (+e.minCalc), 0); };
  const m0 = min(); sinError(api('adminSinAlmuerzoDecidir', { id: x.id, decision: 'aprobar' }, adm)); S.limpiar();
  const m1 = min(); assert(m1 >= m0 + 50, 'aprobado: el tiempo del almuerzo cuenta como trabajado (' + m0 + ' → ' + m1 + ')');
});

t('supervisor: ve solo su gente asignada, revisa sus horas o confirma que no vino, y ubica su obra', () => {
  hora('2026-11-11', '06:00');
  const mk = (ced, nom, extra = {}) => { const r = sinError(api('adminPersonaGuardar', { cedula: ced, nombre: nom, centroId: c1.id, rol: 'trabajador', salario: 1750905, ingreso: '2026-01-01', ...extra }, adm)); return sinError(api('registro', { cedula: ced, codigo: r.codigo, clave: 'clave2026', consentimiento: CONS })).token; };
  const rs = sinError(api('adminPersonaGuardar', { cedula: '81000001', nombre: 'Sergio Sup', centroId: c1.id, rol: 'supervisor', supCentros: [c1.id], salario: 3000000 }, adm));
  const sup = sinError(api('registro', { cedula: '81000001', codigo: rs.codigo, clave: 'clave2026', consentimiento: CONS })).token;
  const ta = mk('45000001', 'Ana Asignada', { supervisor: '81000001' }), tb = mk('45000002', 'Beto DeOtro', { supervisor: '79000001' }); mk('45000003', 'Ciro SinAsignar');
  hora('2026-11-11', '06:58'); sinError(api('marcar', { tipo: 'entrada', ...GPS }, ta)); sinError(api('marcar', { tipo: 'entrada', ...GPS }, tb));
  hora('2026-11-11', '16:24'); sinError(api('marcar', { tipo: 'salida', ...GPS }, ta));
  const rv = sinError(api('supRevision', { fecha: '2026-11-11' }, sup)), ceds = rv.filas.map((x) => x.cedula);
  assert(ceds.includes('45000001') && ceds.includes('45000003'), 've a su asignada y a quien no tiene supervisor en su obra');
  assert(!ceds.includes('45000002'), 'no ve a la persona asignada a otro supervisor');
  assert(!sinError(api('adminTablero', {}, sup)).personas.some((x) => x.cedula === '45000002'), 'tampoco en el tablero');
  const a1 = rv.filas.find((x) => x.cedula === '45000001'); eq(a1.estado, 'completa'); assert(a1.trabajadoMin >= 500);
  sinError(api('supRevisar', { cedulas: ['45000001'], fecha: '2026-11-11', estado: 'ok' }, sup));
  falla(api('supRevisar', { cedulas: ['45000003'], fecha: '2026-11-11', estado: 'no_vino' }, sup), 'DATOS'); // sin nota
  sinError(api('supRevisar', { cedulas: ['45000003'], fecha: '2026-11-11', estado: 'no_vino', nota: 'No avisó' }, sup));
  falla(api('supRevisar', { cedulas: ['45000002'], fecha: '2026-11-11', estado: 'ok' }, sup), 'PERMISO');
  falla(api('supRevisar', { cedulas: ['45000001'], fecha: '2026-11-11', estado: 'no_vino', nota: 'Prueba x' }, sup), 'DATOS'); // tiene marcas
  const r2 = sinError(api('supRevision', { fecha: '2026-11-11' }, sup)); eq(r2.filas.find((x) => x.cedula === '45000003').revision.estado, 'no_vino');
  assert(S.leer('Alertas').some((x) => x.cedula === '45000003' && x.detalle.includes('No avisó')), 'al administrador le llega la novedad');
  falla(api('supUbicarObra', { centroId: c1.id, lat: 4.651, lng: -74.101, prec: 250 }, sup), 'DATOS'); // GPS impreciso
  falla(api('supUbicarObra', { centroId: E.c2.id, lat: 4.651, lng: -74.101, prec: 10 }, sup), 'PERMISO');
  const u = sinError(api('supUbicarObra', { centroId: c1.id, lat: 4.65, lng: -74.1, prec: 12, radio: 200 }, sup)); eq(u.radio, 200);
  const inf = sinError(api('adminInforme', { desde: '2026-11-11', hasta: '2026-11-11', agrupar: 'supervisor' }, adm));
  assert(inf.filas.some((f) => f.nombre === 'Sergio Sup' && f.revisados >= 1), 'informe por supervisor con días revisados');
});

/* ---- Acciones rápidas, búsqueda, atender hoy, nómina guiada ---- */
t('recordatorio personal: solo lo ve esa persona; el supervisor no puede escribir a gente ajena', () => {
  const F = empresa(); const P2 = '52111222';
  sinError(F.api('adminRecordar', { cedula: P, tipo: 'olvido' }, F.adm));
  const m = sinError(F.api('comunicadosMios', {}, F.tk[P])); assert(m.some((x) => /sin salida/.test(x.cuerpo)), 'Pedro lo recibe');
  eq(sinError(F.api('comunicadosMios', {}, F.tk[P2])).filter((x) => /sin salida/.test(x.cuerpo)).length, 0, 'Luisa no');
  falla(F.api('adminRecordar', { cedula: P2, tipo: 'salida' }, F.tk['80111000']), 'PERMISO');
  falla(F.api('adminRecordar', { cedula: P, tipo: 'libre', mensaje: 'x' }, F.adm), 'DATOS');
});
t('búsqueda global: encuentra por nombre sin tildes, por cédula y obras; el supervisor solo ve su gente', () => {
  const F = empresa();
  assert(sinError(F.api('adminBuscar', { q: 'perez' }, F.adm)).personas.some((p) => p.cedula === P), 'por apellido sin tilde');
  assert(sinError(F.api('adminBuscar', { q: '5211' }, F.adm)).personas.some((p) => p.nombre === 'Luisa Gómez'), 'por cédula');
  assert(sinError(F.api('adminBuscar', { q: 'bodeg' }, F.adm)).obras.length === 1, 'obra');
  eq(sinError(F.api('adminBuscar', { q: 'luisa' }, F.tk['80111000'])).personas.length, 0, 'supervisor de Planta no ve a Luisa');
});
t('atender hoy, ayer sin salida, inconsistencias de nómina y jornadas largas en informes', () => {
  const F = empresa();
  F.hora('2026-09-14', '06:58'); sinError(F.api('marcar', { tipo: 'entrada', ...GPS }, F.tk[P]));
  F.hora('2026-09-15', '06:30'); const h = sinError(F.api('yo', {}, F.tk[P])).hoy; assert(h.ayerSinSalida, 'el trabajador ve que ayer no marcó salida');
  const tb = sinError(F.api('adminTablero', {}, F.adm)); assert(tb.atender && tb.atender.ayerSinSalida >= 1, 'el tablero lo pone en «atender hoy»');
  const inc = sinError(F.api('adminNominaInconsistencias', { desde: '2026-09-01', hasta: '2026-09-15' }, F.adm));
  assert(inc.items.some((x) => x.id === 'sinSalida' && x.destino === 'marcaciones'), 'la nómina avisa la jornada sin salida y lleva a corregirla');
  F.hora('2026-09-15', '06:58'); sinError(F.api('marcar', { tipo: 'entrada', ...GPS }, F.tk[P])); F.hora('2026-09-15', '18:30'); sinError(F.api('marcar', { tipo: 'salida', ...GPS }, F.tk[P]));
  F.hora('2026-09-16', '08:00'); const inf = sinError(F.api('adminInforme', { desde: '2026-09-15', hasta: '2026-09-15', agrupar: 'persona' }, F.adm));
  eq(inf.filas.find((f) => f.clave === P || /Pedro/.test(f.nombre)).diasLargos, 1, '11,5 h supera el límite de fatiga');
});
/* ---- Trabajador más fácil ---- */
t('deshacer: solo la última, propia, en línea y dentro de 2 minutos', () => {
  const F = empresa(); F.hora('2026-09-14', '06:58');
  const r = sinError(F.api('marcar', { tipo: 'entrada', id: 'mk1', ...GPS }, F.tk[P])); eq(r.deshacerSeg, 120);
  falla(F.api('marcarDeshacer', { id: 'mk1' }, F.tk['52111222']), 'DATOS');
  const d = sinError(F.api('marcarDeshacer', { id: 'mk1' }, F.tk[P])); eq(d.tipo, 'entrada'); assert(!d.hoy.marcas.entrada, 'la entrada desaparece');
  sinError(F.api('marcar', { tipo: 'entrada', id: 'mk2', ...GPS }, F.tk[P])); F.hora('2026-09-14', '07:02');
  falla(F.api('marcarDeshacer', { id: 'mk2' }, F.tk[P]), 'DATOS');
});
t('acceso rápido con PIN: rechaza PIN fácil, entra con el correcto y se desactiva a los 5 fallos', () => {
  const F = empresa();
  falla(F.api('accesoCrear', { pin: '1234' }, F.tk[P]), 'DATOS'); falla(F.api('accesoCrear', { pin: '7391' }, F.adm), 'PERMISO');
  const a = sinError(F.api('accesoCrear', { pin: '7391' }, F.tk[P]));
  const r = sinError(F.api('loginRapido', { id: a.id, secreto: a.secreto, pin: '7391' })); eq(r.usuario.cedula, P); assert(r.token.length > 40);
  falla(F.api('loginRapido', { id: a.id, secreto: 'otro', pin: '7391' }), 'ACCESO_RAPIDO');
  for (let i = 0; i < 4; i++) falla(F.api('loginRapido', { id: a.id, secreto: a.secreto, pin: '0000' }), 'CREDENCIALES');
  falla(F.api('loginRapido', { id: a.id, secreto: a.secreto, pin: '0000' }), 'ACCESO_RAPIDO');
  falla(F.api('loginRapido', { id: a.id, secreto: a.secreto, pin: '7391' }), 'ACCESO_RAPIDO');
});
t('cerrar todas las sesiones también anula el acceso rápido del celular', () => {
  const F = empresa(); const a = sinError(F.api('accesoCrear', { pin: '7391' }, F.tk[P]));
  sinError(F.api('salirTodas', {}, F.tk[P]));
  falla(F.api('loginRapido', { id: a.id, secreto: a.secreto, pin: '7391' }), 'ACCESO_RAPIDO');
});
t('prima de servicios del semestre: vista previa, registro una sola vez', () => {
  const F = empresa();
  const v = sinError(F.api('adminPrestacionesPeriodicas', { tipo: 'prima', periodo: '2026-2' }, F.adm));
  assert(v.filas.length > 0 && v.total > 0, 'calcula la prima'); const f = v.filas[0]; assert(f.valor === Math.round(f.base * f.dias / 360));
  const r = sinError(F.api('adminPrestacionesPeriodicas', { tipo: 'prima', periodo: '2026-2', registrar: true }, F.adm)); eq(r.registrados, v.filas.length);
  eq(sinError(F.api('adminPrestacionesPeriodicas', { tipo: 'prima', periodo: '2026-2', registrar: true }, F.adm)).registrados, 0, 'no duplica');
  falla(F.api('adminPrestacionesPeriodicas', { tipo: 'prima', periodo: '2026' }, F.adm), 'DATOS');
  assert(sinError(F.api('adminPrestacionesPeriodicas', { tipo: 'intereses', periodo: '2026' }, F.adm)).total > 0);
});
t('GPS impreciso: en línea se pide repetir; guardada sin señal no se pierde y queda para revisión', () => {
  const F = empresa(); sinError(F.api('adminConfigGuardar', { maxPrecisionGps: 50 }, F.adm)); F.hora('2026-09-14', '07:00');
  falla(F.api('marcar', { tipo: 'entrada', lat: GPS.lat, lng: GPS.lng, prec: 400 }, F.tk[P]), 'GPS_IMPRECISO');
  sinError(F.api('marcar', { tipo: 'entrada', lat: GPS.lat, lng: GPS.lng, prec: 400, offline: true, hora: '2026-09-14T06:58' }, F.tk[P]));
  const fila = F.X.hojas.Marcaciones.slice(-1)[0], cab = F.X.hojas.Marcaciones[0]; eq(fila[cab.indexOf('estado')], 'revisar');
});
t('lectura por fecha: con muchas filas viejas usa solo la cola, y si una marcación atrasada llegó antes lee todo', () => {
  const F = empresa(); const viejas = [];
  for (let i = 0; i < 9000; i++) viejas.push({ id: 'v' + i, cedula: '1', fecha: '2025-01-02', tipo: 'entrada', hora: '2025-01-02T07:00', servidor: '2025-01-02T07:00', estado: 'ok' });
  viejas.forEach((x) => F.S.agregar('Marcaciones', x)); F.hora('2026-09-14', '07:00'); sinError(F.api('marcar', { tipo: 'entrada', ...GPS }, F.tk[P]));
  const r = F.S.marcDesde_('2026-09-01'); assert(r.length < 9000, 'no lee las 9.000 viejas: ' + r.length); assert(r.some((m) => m.cedula === P && m.fecha === '2026-09-14'));
  assert(F.S.marcDesde_('2024-12-01').length > 9000, 'si la fecha es anterior a la cola, lee todo');
});
t('almuerzo: por defecto no se marca y se descuenta la franja del horario; si la empresa lo pide, vuelve a pedirse', () => {
  const F = empresa(); F.hora('2026-09-14', '06:58');
  eq(sinError(F.api('marcar', { tipo: 'entrada', ...GPS }, F.tk[P])).hoy.siguiente, 'salida');
  F.hora('2026-09-14', '16:30'); const r = sinError(F.api('marcar', { tipo: 'salida', ...GPS }, F.tk[P]));
  assert(r.resumen.horas.trabajadas <= 9 && r.resumen.horas.trabajadas >= 8, 'descuenta la hora de almuerzo programada: ' + r.resumen.horas.trabajadas);
  sinError(F.api('adminConfigGuardar', { marcarAlmuerzo: true }, F.adm)); F.hora('2026-09-15', '06:58');
  eq(sinError(F.api('marcar', { tipo: 'entrada', ...GPS }, F.tk[P])).hoy.siguiente, 'sal_alm');
});
t('salida olvidada: al día siguiente se registra con la hora del horario como sugerencia', () => {
  const F = empresa(); F.hora('2026-09-14', '06:58'); sinError(F.api('marcar', { tipo: 'entrada', ...GPS }, F.tk[P]));
  F.hora('2026-09-15', '06:50'); const y = sinError(F.api('yo', {}, F.tk[P])).hoy; eq(y.siguiente, 'entrada'); assert(y.ayerSinSalida.horaSalidaHorario, 'sugiere la hora de salida del horario');
  sinError(F.api('marcar', { tipo: 'salida', manual: true, fecha: '2026-09-14', hora: '2026-09-14T16:40', motivo: 'Olvidé marcar la salida', ...GPS }, F.tk[P]));
  assert(!sinError(F.api('yo', {}, F.tk[P])).hoy.ayerSinSalida, 'ya no la pide');
});
t('duda de nómina: el trabajador la envía, el administrador responde y le llega', () => {
  const F = empresa(); falla(F.api('consultaCrear', { texto: 'mal' }, F.tk[P]), 'DATOS');
  sinError(F.api('consultaCrear', { tema: 'extras', fecha: '2026-09-14', texto: 'No me aparecen las 2 horas extra del lunes' }, F.tk[P]));
  const l = sinError(F.api('adminConsultas', {}, F.adm)); eq(l.length, 1); eq(l[0].nombre, 'Pedro Pérez');
  eq(sinError(F.api('adminConsultas', {}, F.tk['80111000'])).length, 1, 'su supervisor también la ve');
  sinError(F.api('adminConsultaResponder', { id: l[0].id, respuesta: 'Ya las aprobé, salen en esta quincena.' }, F.adm));
  eq(sinError(F.api('consultasMias', {}, F.tk[P]))[0].estado, 'respondida');
  assert(sinError(F.api('comunicadosMios', {}, F.tk[P])).some((c) => /Ya las aprobé/.test(c.cuerpo)), 'le llega la respuesta');
  eq(sinError(F.api('adminConsultas', {}, F.adm)).length, 0, 'sale de las abiertas');
});
t('permiso en la tarde sin regreso: se pide sin hora de regreso, al salir cierra el día y no queda como ausencia', () => {
  const F = empresa(); F.hora('2026-09-14', '06:58'); sinError(F.api('marcar', { tipo: 'entrada', ...GPS }, F.tk[P]));
  const p = sinError(F.api('permisoCrear', { tipo: 'cita_medica', fechaSalida: '2026-09-14', horaSalida: '14:00', fechaRegreso: '2026-09-15', horaRegreso: '', horaRegreso2: '', motivo: 'Cita médica' }, F.tk[P]));
  sinError(F.api('adminPermisoDecidir', { id: p.id, decision: 'aprobar', forzar: true }, F.adm));
  F.hora('2026-09-14', '13:30'); const h = sinError(F.api('yo', {}, F.tk[P])).hoy; eq(h.permiso.fase, 'salir'); eq(h.permiso.regresaHoy, false);
  F.hora('2026-09-14', '14:02'); const s = sinError(F.api('permisoSalir', { id: p.id, ...GPS }, F.tk[P])); eq(s.cerroJornada, true); eq(s.hoy.marcas.salida, '14:02');
  F.hora('2026-09-15', '06:50'); const y = sinError(F.api('yo', {}, F.tk[P])).hoy; assert(!y.ayerSinSalida, 'no pide salida olvidada'); eq(y.siguiente, 'entrada');
  assert(!y.permiso, 'el permiso ya no aparece al día siguiente');
});
t('ingreso: trae de una vez los datos de la pantalla y migra contraseñas antiguas a la huella rápida', () => {
  const F = empresa(); const r = sinError(F.api('login', { cedula: P, clave: 'clave2026' }));
  assert(r.yo && r.yo.usuario && r.yo.usuario.cedula === P && r.yo.hoy, 'el ingreso trae «yo»');
  const u = F.S.buscar('Usuarios', 'cedula', P); assert(String(u.hash).indexOf('v3:') === 0, 'queda en v3');
  u.hash = 'v2:' + F.S.vueltas_('clave2026', u.salt, 600); F.S.guardar('Usuarios', u);
  sinError(F.api('login', { cedula: P, clave: 'clave2026' })); assert(String(F.S.buscar('Usuarios', 'cedula', P).hash).indexOf('v3:') === 0, 'la v2 se acepta y se migra');
});
t('turno de día con salida olvidada no se une al día siguiente; comunicados generales no se pierden; no se marca leído lo ajeno', () => {
  const F = empresa(); F.hora('2026-09-08', '06:58'); sinError(F.api('marcar', { tipo: 'entrada', ...GPS }, F.tk[P]));
  F.hora('2026-09-09', '06:30'); const h = sinError(F.api('yo', {}, F.tk[P])).hoy; eq(h.fecha, '2026-09-09'); eq(h.siguiente, 'entrada'); assert(h.ayerSinSalida && h.ayerSinSalida.fecha === '2026-09-08', 'pide la salida del 8');
  falla(F.api('marcar', { tipo: 'salida', ...GPS }, F.tk[P]), 'ORDEN');
  sinError(F.api('adminComunicadoCrear', { titulo: 'Dotación', cuerpo: 'El viernes se entrega la dotación.' }, F.adm));
  sinError(F.api('adminRecordar', { cedula: '52111222', tipo: 'salida' }, F.adm));
  for (let i = 0; i < 60; i++) F.S.agregar('Comunicados', { id: 'r' + i, titulo: 'Recordatorio de Ana', cuerpo: 'x', centros: '[]', creadoPor: '1', creado: '2026-09-09T07:00', leidos: '{}', cedulas: JSON.stringify(['99' + i]) });
  assert(sinError(F.api('comunicadosMios', {}, F.tk[P])).some((c) => c.titulo === 'Dotación'), 'Pedro sigue viendo el comunicado general');
  assert(!sinError(F.api('adminComunicados', {}, F.adm)).some((c) => /Recordatorio de/.test(c.titulo)), 'la lista del admin no mezcla los personales');
  const per = sinError(F.api('comunicadosMios', {}, F.tk['52111222'])).find((c) => /Recordatorio/.test(c.titulo));
  falla(F.api('comunicadoLeer', { id: per.id }, F.tk[P]), 'DATOS');
});
t('guía de nómina: entrega reglas vigentes y el valor de la hora de la persona', () => {
  const F = empresa(); F.hora('2026-11-20', '08:00');
  const g = sinError(F.api('guiaNomina', {}, F.tk[P])); eq(g.jornadaSemanalH, 42); eq(g.recargoDominical, 0.9); eq(g.yo.valorHora, Math.round(1750905 / 210)); eq(g.yo.conAuxilio, true);
});
/* ---- Actualización automática y panel del proveedor ---- */
const resp = (cod, t) => ({ getResponseCode: () => cod, getContentText: (_c) => (typeof t === 'string' ? t : JSON.stringify(t)) });
const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
t('actualización: compara versiones, conserva los datos del proveedor y apunta la aplicación a la versión nueva', () => {
  const llamadas = [], CODIGO = '// codigo nuevo 1.9.0', MANIF = JSON.stringify({ oauthScopes: ['a', 'b'] });
  const F = empresa({ proveedor: { app: 'https://app.ejemplo.co/' }, fetch: (u, o) => {
    llamadas.push([(o && o.method) || 'get', u.replace(/[?&]t=\d+/, '')]);
    if (u.includes('version.json')) return resp(200, { version: '1.9.0', sha256: sha(CODIGO), notas: 'Mejoras' });
    if (u.includes('actualizacion/ControlJornada.gs')) return resp(200, CODIGO);
    if (u.includes('actualizacion/appsscript.json')) return resp(200, MANIF);
    if (u.endsWith('/content') && o.method === 'get') return resp(200, { files: [{ name: 'appsscript', type: 'JSON', source: MANIF }, { name: 'Código', type: 'SERVER_JS', source: "var APP_PREDETERMINADA = 'https://viejo.github.io/cj/';\nvar CLAVE_LICENCIA_PROVEEDOR = 'k123';" }] });
    if (u.endsWith('/content')) { llamadas.push(['cuerpo', JSON.parse(o.payload)]); return resp(200, {}); }
    if (u.endsWith('/versions')) return resp(200, { versionNumber: 7 });
    if (u.endsWith('/deployments') && o.method === 'get') return resp(200, { deployments: [{ deploymentId: 'HEADID', deploymentConfig: {} }, { deploymentId: 'AKfycbTESTtestTESTtestTEST12345', deploymentConfig: { versionNumber: 3 }, entryPoints: [{ entryPointType: 'WEB_APP' }] }] });
    if (u.includes('/deployments/')) { llamadas.push(['dep', JSON.parse(o.payload)]); return resp(200, {}); }
    return resp(404, 'no');
  } });
  eq(F.S.compararVersion_('1.10.0', '1.9.3'), 1); eq(F.S.compararVersion_('1.8.0', '1.8.0'), 0);
  const r = F.S.actualizar_(true); eq(r.version, '1.9.0');
  const cuerpo = llamadas.find((x) => x[0] === 'cuerpo')[1].files, prov = cuerpo.find((f) => f.name === 'Proveedor').source;
  assert(/viejo\.github\.io/.test(prov) && /k123/.test(prov), 'arma Proveedor.gs con la dirección y la clave del código viejo');
  eq(cuerpo.find((f) => f.name === 'ControlJornada').source, CODIGO); assert(!cuerpo.some((f) => f.name === 'Código'), 'el archivo viejo se reemplaza');
  const dep = llamadas.find((x) => x[0] === 'dep')[1]; eq(dep.deploymentConfig.versionNumber, 7);
  assert(llamadas.some((x) => typeof x[1] === 'string' && x[1].includes('/deployments/AKfycbTESTtestTESTtestTEST12345')), 'la aplicación web sigue en el mismo enlace');
});
t('actualización segura: un admin no puede desviarla, sin aprobación del panel no instala y el manifiesto no puede abrir la app', () => {
  const F = empresa({ fetch: () => resp(200, { version: '9.9.9', sha256: 'x' }) }); // sin dirección del proveedor
  sinError(F.api('adminConfigGuardar', { urlApp: 'https://evil.example/' }, F.adm)); eq(F.S.actualizar_('web').ok, false, 'sin app del proveedor no hay de dónde actualizar');
  const G = empresa({ proveedor: { app: 'https://app.ejemplo.co/' } }); falla(G.api('adminConfigGuardar', { urlApp: 'https://evil.example/' }, G.adm), 'DATOS');
  const CODIGO = '// x', MAN = (acc) => JSON.stringify({ oauthScopes: ['a'], webapp: { executeAs: 'USER_DEPLOYING', access: acc } });
  const mk = (extra, manNuevo) => empresa(Object.assign({ proveedor: { app: 'https://app.ejemplo.co/', panel: 'https://panel/exec' }, fetch: (u, o) => {
    if (u.includes('version.json')) return resp(200, { version: '1.9.0', sha256: sha(CODIGO) });
    if (u.includes('actualizacion/ControlJornada.gs')) return resp(200, CODIGO);
    if (u.includes('actualizacion/appsscript.json')) return resp(200, manNuevo);
    if (u.endsWith('/content') && o.method === 'get') return resp(200, { files: [{ name: 'appsscript', type: 'JSON', source: MAN('ANYONE_ANONYMOUS') }] });
    return resp(200, {});
  } }, extra));
  const H = mk({}, MAN('ANYONE_ANONYMOUS')); assert(/no está aprobada/.test(H.S.actualizar_('noche').mensaje), 'sin aprobación no instala');
  const I = mk({}, MAN('DOMAIN')); I.S.prop_('ACT_APROBADA', JSON.stringify({ version: '1.9.0', sha256: sha(CODIGO) }));
  let err = ''; try { I.S.actualizar_('hoja'); } catch (e) { err = e.message; } assert(/quién puede usar/.test(err), 'manifiesto que cambia el acceso se rechaza: ' + err);
  const J = mk({}, MAN('ANYONE_ANONYMOUS')); J.S.prop_('ACT_APROBADA', JSON.stringify({ version: '1.9.0', sha256: 'f'.repeat(64) }));
  err = ''; try { J.S.actualizar_('hoja'); } catch (e) { err = e.message; } assert(/no es el que aprobó/.test(err), 'código distinto al aprobado se rechaza');
});
t('actualización a medias: si falló al apuntar la aplicación, la noche siguiente lo termina', () => {
  let puts = 0; const F = empresa({ proveedor: { app: 'https://app.ejemplo.co/' }, fetch: (u, o) => {
    if (u.endsWith('/versions')) return resp(200, { versionNumber: 9 });
    if (u.endsWith('/deployments') && o.method === 'get') return resp(200, { deployments: [{ deploymentId: 'D1', deploymentConfig: { versionNumber: 8 }, entryPoints: [{ entryPointType: 'WEB_APP' }] }] });
    if (u.includes('/deployments/D1')) { puts++; return resp(200, {}); }
    return resp(500, ''); } });
  F.S.prop_('ACT_OBJETIVO', '1.8.0'); F.S.prop_('ACT_DESPLEGADA', '1.7.0');
  const r = F.S.actualizar_('noche'); assert(/terminó/.test(r.mensaje), r.mensaje); eq(puts, 1); eq(F.S.prop_('ACT_DESPLEGADA'), '1.8.0');
});
t('actualización: si ya está al día no cambia nada; si el código llega incompleto se detiene', () => {
  let n = 0; const F = empresa({ proveedor: { app: 'https://app.ejemplo.co/' }, fetch: (u) => { n++; return u.includes('version.json') ? resp(200, { version: '1.8.0' }) : resp(500, ''); } });
  assert(F.S.actualizar_(true).sinCambios, 'sin cambios'); eq(n, 1);
  const G = empresa({ proveedor: { app: 'https://app.ejemplo.co/' }, fetch: (u) => (u.includes('version.json') ? resp(200, { version: '2.0.0', sha256: 'otra' }) : resp(200, 'codigo')) });
  let err = ''; try { G.S.actualizar_(true); } catch (e) { err = e.message; } assert(/incompleto/.test(err), 'detecta descarga incompleta');
});
t('panel del proveedor: la instalación reporta su NIT y recibe sola la licencia con los módulos marcados', () => {
  const CL = 'clave-panel'; let enviado = null;
  const llaveP = (o) => { const b = Buffer.from(JSON.stringify(o)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', CL).update(b).digest('hex').slice(0, 32); };
  const F = empresa({ proveedor: { clave: CL, panel: 'https://script.google.com/macros/s/PANEL/exec' }, fetch: (u, o) => { enviado = JSON.parse(JSON.parse(o.payload).datos); return resp(200, { llave: llaveP({ plan: 'personalizado', nit: '9001234567', modulos: ['asistencia', 'permisos', 'kiosco'], vence: '2027-12-31' }) }); } });
  sinError(F.api('adminConfigGuardar', { empresa: { nombre: 'Montajes', nit: '900.123.456-7' } }, F.adm));
  falla(F.api('adminPrestamos', {}, F.adm), 'MODULO_NO_INCLUIDO');
  eq(enviado.nit, '9001234567', 'al guardar el NIT se reporta de una vez'); const r = sinError(F.api('adminLicenciaSincronizar', {}, F.adm)); eq(r.cambio, false, 'ya estaba aplicada'); assert(enviado.personas >= 1, 'reporta personas');
  const y = sinError(F.api('yo', {}, F.adm)); eq(y.licencia.modulos.join(','), 'asistencia,permisos,kiosco');
  falla(F.api('adminPrestamos', {}, F.adm), 'MODULO_NO_INCLUIDO');
});
/* ---- Licencia firmada por el proveedor ---- */
const CLAVE = 'clave-del-proveedor-para-pruebas';
function llave(plan, vence, extra, nit = '9001234567') { const b = Buffer.from(JSON.stringify({ plan, nit, modulosExtra: extra || [], vence })).toString('base64url'); return b + '.' + crypto.createHmac('sha256', CLAVE).update(b).digest('hex').slice(0, 32); }
const L = empresa({ proveedor: { clave: CLAVE } });
t('licencia: sin llave rige el plan básico; los módulos de otros planes responden que no están incluidos', () => {
  falla(L.api('adminPrestamos', {}, L.adm), 'MODULO_NO_INCLUIDO'); sinError(L.api('adminTablero', {}, L.adm));
});
t('licencia: una llave falsificada, de otra empresa o sin vencimiento se rechaza; una válida activa el plan', () => {
  sinError(L.api('adminConfigGuardar', { empresa: { nombre: 'Montajes', nit: '900.123.456-7' } }, L.adm));
  falla(L.api('adminLicenciaActivar', { llave: llave('empresa', '2030-01-01').replace(/.$/, '0') }, L.adm), 'DATOS');
  falla(L.api('adminLicenciaActivar', { llave: llave('empresa', '2030-01-01', [], '800999111') }, L.adm), 'DATOS');
  falla(L.api('adminLicenciaActivar', { llave: llave('empresa', '') }, L.adm), 'DATOS');
  const r = sinError(L.api('adminLicenciaActivar', { llave: llave('profesional', '2026-12-31') }, L.adm)); eq(r.plan, 'profesional'); sinError(L.api('adminPrestamos', {}, L.adm));
});
t('licencia: 15 días de gracia tras vencer para cerrar nómina y renovar', () => {
  L.hora('2027-01-05', '06:00'); L.adm = sinError(L.api('login', { cedula: '79000001', clave: 'secreta1' })).token;
  const y = sinError(L.api('yo', {}, L.adm)); eq(y.licencia.enGracia, true); eq(y.licencia.vencida, false);
  sinError(L.api('adminPersonaGuardar', { cedula: '99999998', nombre: 'En gracia', salario: 1750905 }, L.adm));
});
t('licencia vencida: el panel queda en consulta, el personal sigue marcando y viendo lo suyo', () => {
  L.hora('2027-01-20', '06:58'); L.tk[P] = sinError(L.api('login', { cedula: P, clave: 'clave2026' })).token; sinError(L.api('marcar', { tipo: 'entrada', ...GPS }, L.tk[P]));
  L.adm = sinError(L.api('login', { cedula: '79000001', clave: 'secreta1' })).token; sinError(L.api('adminTablero', {}, L.adm)); sinError(L.api('desprendibles', {}, L.tk[P]));
  falla(L.api('adminPersonaGuardar', { cedula: '99999999', nombre: 'Nuevo', salario: 1 }, L.adm), 'LICENCIA_VENCIDA');
  sinError(L.api('adminLicenciaActivar', { llave: llave('profesional', '2027-12-31') }, L.adm)); sinError(L.api('adminPersonaGuardar', { cedula: '99999999', nombre: 'Nuevo', salario: 1750905 }, L.adm));
});
console.log(`Módulos: ${ok} pruebas correctas, ${mal} con error`); process.exit(mal ? 1 : 0);
