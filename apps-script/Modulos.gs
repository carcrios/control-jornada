/**
 * CONTROL DE JORNADA — Módulos avanzados v1.6.0:
 * Modo Kiosco, Provisiones de prestaciones, Simulador de liquidación, Préstamos/cuotas,
 * Banco de compensatorios, Certificado laboral, Comunicados con lectura,
 * Presupuesto por obra, Vista en vivo, Expediente/Tablero 360° y Licenciamiento.
 */

/* ---------- 1. Modo Kiosco (tablet compartida en portería/obra) ---------- */
// La tablet usa una sesión propia de kiosco (ver a_kioscoIniciar): solo puede marcar, en un único centro.
function a_kioscoMarcar(d, k) {
  var ced = soloDigitos_(d.cedula); if (ced.length < 5) throw E_('DATOS', 'Escribe la cédula.');
  bloqueado_('kio:' + ced, 8); bloqueado_('kt:' + k.cedula + k._kiosco, 40); // por cédula y por tablet
  var u = buscar('Usuarios', 'cedula', ced);
  // Mismo error para cédula ajena, de otro rol o clave mala: el kiosco no sirve para adivinar contraseñas.
  var valido = u && u.hash && u.rol === 'trabajador' && u.estado === 'activo' && u.centroId === k._kiosco && verificarClave_(String(d.clave || ''), u.salt, u.hash);
  if (!valido) {
    fallo_('kio:' + ced, 900); fallo_('kt:' + k.cedula + k._kiosco, 900);
    if (fallo_('login', 600) === 30) alertar_('seguridad', '', 'Hubo 30 intentos fallidos en 10 minutos (ingreso o kiosco). Puede ser un intento de adivinar contraseñas.');
    throw E_('CREDENCIALES', 'Cédula o contraseña incorrecta, o la persona no marca en este centro.');
  }
  var res;
  _marcaKiosco = true;
  try { res = a_marcar({ tipo: d.tipo, lat: d.lat, lng: d.lng, prec: d.prec, centroId: k._kiosco, foto: d.foto, id: d.id }, u); }
  finally { _marcaKiosco = false; }
  auditar_(k.cedula, 'kiosco_marcacion', { cedula: u.cedula, tipo: d.tipo, centro: k._kiosco });
  return { usuario: u.nombre.split(' ')[0], resultado: { hora: res.hora, repetida: !!res.repetida } };
}
function a_kioscoSalir(d, k, req) {
  if (!k._kiosco) throw E_('PERMISO', 'Esta acción es solo para tablets en modo kiosco.');
  var ced = soloDigitos_(d.cedula); bloqueado_('kio:' + ced, 8); // el bloqueo de la tablet no impide que el supervisor la apague
  var s = buscar('Usuarios', 'cedula', ced), al = s ? alcance_(s) : null;
  var ok = s && s.hash && s.estado === 'activo' && ['admin', 'supervisor'].indexOf(s.rol) >= 0 && (!al || al[k._kiosco]) && verificarClave_(String(d.clave || ''), s.salt, s.hash);
  if (!ok) { fallo_('kio:' + ced, 900); fallo_('kt:' + k.cedula + k._kiosco, 900); throw E_('CREDENCIALES', 'Solo un supervisor de este centro o un administrador puede apagar el kiosco.'); }
  cerrarSesiones_(k.cedula, sha_(String(req.t))); auditar_(ced, 'kiosco_apagado', { centro: k._kiosco });
  return { ok: true };
}
function a_kioscoIniciar(d, sup) {
  var c = centroDe_(txt_(d.centroId, 20)); if (!c || !c.activo) throw E_('DATOS', 'Elige el centro donde queda la tablet.');
  var al = alcance_(sup); if (al && !al[c.id]) throw E_('PERMISO', 'Ese centro no está a tu cargo.');
  auditar_(sup.cedula, 'kiosco_activado', { centro: c.id });
  return { token: crearSesion_(sup.cedula, 'KIOSCO|' + c.id, 'kiosco'), centro: c.nombre };
}

/* ---------- 2. Provisiones de prestaciones sociales (Colombia) ---------- */
// Provisiones de prestaciones y aportes del empleador del periodo. Estimado para presupuesto, no reemplaza la PILA.
function costoEmpleador_(liq, L, c, arlCentro) {
  var val = function (cods) { return (liq.conceptos || []).filter(function (k) { return cods.indexOf(k.cod) >= 0; }).reduce(function (s, k) { return s + (+k.valor || 0); }, 0); };
  var noSal = val(['BNS']), aux = val(['AUX']), extras = val(COD_EXTRAS), domFest = val(['DF', 'DFN']);
  var basePrest = Math.max(0, liq.devengado - noSal);              // salario + auxilio, sin pagos no salariales (art. 128)
  var baseVac = Math.max(0, liq.devengado - noSal - aux - extras - domFest); // sin auxilio, extras ni trabajo en descansos (art. 192)
  var p = { prima: Math.round(basePrest / 12), cesantias: Math.round(basePrest / 12), vacaciones: Math.round(baseVac * 15 / 360) };
  p.intereses = Math.round(p.cesantias * 0.12);
  var cant = function (cod) { return ((liq.conceptos || []).filter(function (k) { return k.cod === cod; })[0] || {}).cantidad || 0; };
  var ibc = +liq.ibc || 0, dn = +liq.diasNomina || 30, diasArl = Math.min(dn, cant('SAL') + cant('DR')); // incapacidad y vacaciones no causan ARL
  var exon = c.exoneradoAportes && (liq.devengado - aux) < 10 * L.smmlv * dn / 30; // ET art. 114-1: sobre lo devengado
  var a = { pension: Math.round(ibc * 0.12), salud: exon ? 0 : Math.round(ibc * 0.085), arl: Math.round(ibc * (dn ? diasArl / dn : 1) * (+arlCentro || +c.arlPct || 0.522) / 100), caja: Math.round(ibc * 0.04), sena: exon ? 0 : Math.round(ibc * 0.02), icbf: exon ? 0 : Math.round(ibc * 0.03) };
  p.totalProvisiones = p.prima + p.cesantias + p.intereses + p.vacaciones;
  a.total = a.pension + a.salud + a.arl + a.caja + a.sena + a.icbf;
  return { p: p, a: a, costo: liq.devengado + p.totalProvisiones + a.total };
}
function a_adminProvisiones(d) {
  var r = rango_(d, 62), corte = r.hasta < r.hoy ? r.hasta : r.hoy, L = legal_(), c = cfg_();
  var previa = a_adminNominaPrevia({ desde: r.desde, hasta: r.hasta }), arl = {};
  leer('Centros').forEach(function (cc) { if (+cc.arlPct > 0) arl[cc.id] = +cc.arlPct; });
  var total = { devengado: 0, prima: 0, cesantias: 0, intereses: 0, vacaciones: 0, totalProvisiones: 0, aportes: 0, costoTotal: 0 };
  var filas = previa.filas.map(function (x) {
    var k = costoEmpleador_(x.liq, L, c, arl[x.centroId]);
    total.devengado += x.liq.devengado; total.prima += k.p.prima; total.cesantias += k.p.cesantias; total.intereses += k.p.intereses; total.vacaciones += k.p.vacaciones;
    total.totalProvisiones += k.p.totalProvisiones; total.aportes += k.a.total; total.costoTotal += k.costo;
    return { cedula: x.cedula, nombre: x.nombre, centro: x.centro, centroId: x.centroId, devengado: x.liq.devengado, prima: k.p.prima, cesantias: k.p.cesantias, intereses: k.p.intereses, vacaciones: k.p.vacaciones,
      totalProvisiones: k.p.totalProvisiones, aportes: k.a.total, aportesDet: k.a, costoTotal: k.costo };
  });
  return { desde: r.desde, hasta: r.hasta, corte: corte, filas: filas, total: total, arlPct: +c.arlPct || 0.522, exonerado: !!c.exoneradoAportes };
}

/* ---------- 5. Simulador de liquidación de contrato ---------- */
// Liquidación final del contrato (estimada, para revisión del contador). Meses de 30 días (CST arts. 249 y 306, Ley 52 de 1975).
var COD_EXTRAS = ['HED', 'HEN', 'HEDF', 'HENF'], COD_NO_SALARIO = ['BNS', 'AUS', 'PNR', 'PNH', 'DNC', 'AUX'];
function promedioNominas_(ced, desde, hasta, excluir) {
  var suma = 0, dias = 0;
  leer('Nomina').forEach(function (n) {
    if (n.cedula !== ced || n.hasta < desde || n.desde > hasta) return; var det = json_(n.detalle, {}), dn = +det.diasNomina || 0; if (!dn) return;
    dias += dn; (det.conceptos || []).forEach(function (k) { if (excluir.indexOf(k.cod) < 0 && +k.valor > 0) suma += +k.valor; });
  });
  return { mensual: dias ? Math.round(suma * 30 / dias) : 0, dias: dias };
}
function diasNoRemunerados_(ced, desde, hasta) { // licencias no remuneradas y suspensiones no cuentan para prestaciones (CST art. 51)
  var n = 0; leer('Permisos').forEach(function (p) {
    if (p.cedula !== ced || p.estado !== 'aprobado' || p.remunerado === '1') return;
    var a = p.fechaSalida > desde ? p.fechaSalida : desde, b0 = p.fechaSalida === p.fechaRegreso ? p.fechaSalida : Motor.sumar(p.fechaRegreso, -1), b = b0 < hasta ? b0 : hasta;
    if (a <= b && !(p.horaSalida && p.fechaSalida === p.fechaRegreso)) n += Motor.diasNomina(a, b);
  });
  return n;
}
// Prima de servicios (30 jun / 20 dic, CST art. 306) e intereses de cesantías (31 ene, Ley 52 de 1975), por periodo:
// d.tipo 'prima' con d.periodo 'AAAA-1' | 'AAAA-2', o 'intereses' con d.periodo 'AAAA'. Sin d.registrar es solo vista previa.
function a_adminPrestacionesPeriodicas(d, adm) {
  var tipo = d.tipo === 'intereses' ? 'intereses' : 'prima', per = String(d.periodo || ''), ini, fin;
  if (tipo === 'prima') { var m = /^(\d{4})-([12])$/.exec(per); if (!m) throw E_('DATOS', 'Elige el semestre (por ejemplo 2026-2).'); ini = m[1] + (m[2] === '1' ? '-01-01' : '-07-01'); fin = m[1] + (m[2] === '1' ? '-06-30' : '-12-31'); }
  else { if (!/^\d{4}$/.test(per)) throw E_('DATOS', 'Elige el año de las cesantías.'); ini = per + '-01-01'; fin = per + '-12-31'; }
  var L = legal_(), ya = {}, excl = ['BNS', 'AUS', 'PNR', 'PNH', 'DNC'];
  leer('PagosPrestaciones').forEach(function (p) { if (p.tipo === tipo && p.periodo === per) ya[p.cedula] = p; });
  var filas = leer('Usuarios').filter(function (u) { return u.rol !== 'admin' || +u.salario > 0; }).map(function (u) {
    var ing = String(u.ingreso || '').substr(0, 10), ret = String(u.retiro || '').substr(0, 10);
    if (!/^\d{4}-\d\d-\d\d$/.test(ing) || ing > fin || (ret && ret < ini) || !(+u.salario > 0)) return null;
    var a = ing > ini ? ing : ini, b = ret && ret < fin ? ret : fin;
    var dias = Math.max(0, Motor.diasNomina(a, b) - diasNoRemunerados_(u.cedula, a, b)); if (!dias) return null;
    var sal = (+u.salario || 0) * (u.tipoPago === 'dia' ? 30 : 1), fija = sal + (sal <= L.smmlv * L.topeAuxSmmlv ? L.auxTransporte : 0);
    var p = promedioNominas_(u.cedula, a, b, excl), base = p.dias >= 30 && p.mensual > fija ? p.mensual : fija;
    var valor = tipo === 'prima' ? Math.round(base * dias / 360) : Math.round(Math.round(base * dias / 360) * dias * 0.12 / 360);
    return { cedula: u.cedula, nombre: u.nombre, dias: dias, base: base, valor: valor, yaRegistrado: !!ya[u.cedula] };
  }).filter(Boolean);
  var total = filas.reduce(function (s, f) { return s + f.valor; }, 0), nuevos = 0;
  if (d.registrar) {
    filas.forEach(function (f) { if (f.yaRegistrado) return; agregar('PagosPrestaciones', { id: id_(), tipo: tipo, periodo: per, cedula: f.cedula, dias: f.dias, base: f.base, valor: f.valor, registrado: ahora_().iso, por: adm.cedula }); f.yaRegistrado = true; nuevos++; });
    auditar_(adm.cedula, 'prestaciones_' + tipo, { periodo: per, personas: nuevos, total: total });
  }
  return { tipo: tipo, periodo: per, desde: ini, hasta: fin, filas: filas, total: total, registrados: nuevos,
    nota: tipo === 'prima' ? 'Prima: base × días / 360. Se paga a más tardar el 30 de junio y el 20 de diciembre.' : 'Intereses: 12 % anual sobre las cesantías del año, proporcional a los días. Se pagan al trabajador a más tardar el 31 de enero.' };
}
var CAUSAS_RETIRO = { renuncia: 'Renuncia voluntaria', justa_causa: 'Despido con justa causa', sin_justa_causa: 'Despido sin justa causa', mutuo_acuerdo: 'Mutuo acuerdo', fin_plazo: 'Vencimiento del plazo pactado (con preaviso)', fin_obra: 'Terminación de la obra o labor' };
function a_adminLiquidacionContrato(d, adm) {
  var u = buscar('Usuarios', 'cedula', soloDigitos_(d.cedula));
  if (!u) throw E_('DATOS', 'No se encontró la persona.');
  var L = legal_(), retiro = /^\d{4}-\d\d-\d\d$/.test(d.fechaRetiro || '') ? d.fechaRetiro : (u.retiro || ahora_().fecha);
  var ingreso = String(u.ingreso || '').substr(0, 10), causa = CAUSAS_RETIRO[d.causa] ? d.causa : 'renuncia', tipo = u.tipoContrato || 'indefinido';
  if (!/^\d{4}-\d\d-\d\d$/.test(ingreso) || retiro < ingreso) throw E_('DATOS', 'Verifica la fecha de ingreso y la fecha de retiro.');
  var sal = (+u.salario || 0) * (u.tipoPago === 'dia' ? 30 : 1), aux = sal <= L.smmlv * L.topeAuxSmmlv ? L.auxTransporte : 0, avisos = []; // jornal → salario mensual equivalente
  var anio = retiro.substr(0, 4), iniAnio = anio + '-01-01', iniSem = retiro.substr(5, 2) >= '07' ? anio + '-07-01' : iniAnio;
  var dAnio = ingreso > iniAnio ? ingreso : iniAnio, dSem = ingreso > iniSem ? ingreso : iniSem;
  var diasAnio = Math.max(0, Motor.diasNomina(dAnio, retiro) - diasNoRemunerados_(u.cedula, dAnio, retiro));
  var diasSem = Math.max(0, Motor.diasNomina(dSem, retiro) - diasNoRemunerados_(u.cedula, dSem, retiro));
  // Bases: salario fijo = básico + auxilio; variable = promedio (último año para cesantías, semestre para prima; art. 253 y 306)
  var fija = sal + aux, pAnio = promedioNominas_(u.cedula, Motor.sumar(retiro, -365), retiro, ['BNS', 'AUS', 'PNR', 'PNH', 'DNC']);
  var pSem = promedioNominas_(u.cedula, dSem, retiro, ['BNS', 'AUS', 'PNR', 'PNH', 'DNC']);
  var baseCes = pAnio.dias >= 30 && pAnio.mensual > fija ? pAnio.mensual : fija, basePrima = pSem.dias >= 30 && pSem.mensual > fija ? pSem.mensual : fija;
  var cesantias = Math.round(baseCes * diasAnio / 360), intereses = Math.round(cesantias * diasAnio * 0.12 / 360), prima = Math.round(basePrima * diasSem / 360);
  // Vacaciones: 15 días hábiles por 360 días; base sin horas extra ni auxilio (art. 192)
  var pVac = promedioNominas_(u.cedula, Motor.sumar(retiro, -365), retiro, COD_EXTRAS.concat(COD_NO_SALARIO, ['DF', 'DFN'])), baseVac = pVac.dias >= 30 && pVac.mensual > sal ? pVac.mensual : sal;
  var diasServ = Math.max(0, Motor.diasNomina(ingreso, retiro) - diasNoRemunerados_(u.cedula, ingreso, retiro)), causadas = Math.round(diasServ * 15 / 360 * 10) / 10, tomadas = 0;
  leer('Permisos').forEach(function (p) { if (p.cedula === u.cedula && p.tipo === 'vacaciones' && p.estado === 'aprobado') tomadas += Motor.diasHabiles(p.fechaSalida, Motor.sumar(p.fechaRegreso, -1), L, sabadoHabil_(p.cedula)); });
  var diasVacPend = Math.max(0, Math.round((causadas - tomadas) * 10) / 10), vacaciones = Math.round(baseVac / 30 * diasVacPend);
  // Indemnización por despido sin justa causa (CST art. 64)
  var indem = 0, indemDet = '';
  if (causa === 'sin_justa_causa') {
    var vDia = Math.max(sal, baseVac) / 30;
    if (tipo === 'fijo' && /^\d{4}-\d\d-\d\d$/.test(u.finContrato || '') && u.finContrato > retiro) { var falta = Motor.diasNomina(Motor.sumar(retiro, 1), u.finContrato); indem = Math.round(vDia * falta); indemDet = 'Salarios del tiempo que faltaba del contrato a término fijo: ' + falta + ' días.'; }
    else if (tipo === 'obra') { indem = Math.round(vDia * 15); indemDet = 'Contrato por obra o labor: mínimo 15 días (ajusta al tiempo que faltaba para terminar la obra si es mayor).'; avisos.push('Revisa cuánto faltaba para terminar la obra: la indemnización es ese tiempo, con mínimo 15 días.'); }
    else {
      var anios = diasServ / 360, alto = sal >= 10 * L.smmlv, primero = alto ? 20 : 30, adic = alto ? 15 : 20;
      var dIndem = anios <= 1 ? primero : primero + adic * (anios - 1); indem = Math.round(vDia * dIndem);
      indemDet = (alto ? 'Salario de 10 SMMLV o más: 20 días el primer año y 15 por año adicional' : 'Salario menor a 10 SMMLV: 30 días el primer año y 20 por año adicional') + ' (proporcional): ' + Math.round(dIndem * 10) / 10 + ' días.';
      if (tipo === 'fijo') avisos.push('La persona tiene contrato a término fijo pero sin fecha de terminación registrada: se calculó como indefinido. Registra la fecha en Personal → Editar.');
    }
  }
  if (causa === 'fin_plazo') avisos.push('Si no se dio preaviso de 30 días, el contrato a término fijo se prorrogó y debe liquidarse como despido sin justa causa.');
  // Salario del último periodo, si aún no se ha pagado en una nómina cerrada
  var salarioPendiente = 0, per = Motor.periodoDe(retiro, cfg_().periodoNomina);
  if (!periodoCerrado_(retiro)) {
    var uRet = {}; for (var k in u) uRet[k] = u[k]; uRet.retiro = retiro;
    var liqP = Motor.liquidarPeriodo(insumos_(uRet, per.desde, retiro, retiro, leer('Marcaciones')), L); salarioPendiente = Math.max(0, liqP.neto);
  }
  if (+retiro.substr(5, 2) <= 2 && retiro.substr(5, 5) < '02-15') avisos.push('Retiro antes del 15 de febrero: si las cesantías de ' + (+anio - 1) + ' no se consignaron al fondo a tiempo, se deben pagar directamente con la sanción de la Ley 50 de 1990 (art. 99).');
  avisos.push('Pagar todo el día del retiro. Si se paga tarde sin razón, se causa un día de salario por cada día de retraso (CST art. 65).');
  var saldoPrestamos = 0; leer('Prestamos').forEach(function (p) { if (p.cedula === u.cedula && p.estado === 'activo') saldoPrestamos += +p.saldo || 0; });
  if (/^\d{4}-\d\d-\d\d$/.test(d.primaPagadaHasta || '') && d.primaPagadaHasta >= dSem) { // solo se liquida la prima después de lo ya pagado
    var dPri = d.primaPagadaHasta >= retiro ? 0 : Math.max(0, Motor.diasNomina(Motor.sumar(d.primaPagadaHasta, 1), retiro) - diasNoRemunerados_(u.cedula, Motor.sumar(d.primaPagadaHasta, 1), retiro));
    prima = Math.round(basePrima * dPri / 360); diasSem = dPri; avisos.push('Prima pagada hasta el ' + d.primaPagadaHasta + ': se liquidan ' + dPri + ' días.'); }
  if (retiro.substr(5, 2) === '01') avisos.push('Retiro en enero: verifica que los intereses de las cesantías de ' + (+anio - 1) + ' se hayan pagado antes del 31 de enero (Ley 52 de 1975).');
  var total = salarioPendiente + cesantias + intereses + prima + vacaciones + indem;
  // Solo préstamos con autorización firmada, y nunca de las cesantías ni de más de la mitad del salario pendiente (CST arts. 149 y 250)
  var saldoAut = 0; leer('Prestamos').forEach(function (p) { if (p.cedula === u.cedula && p.estado === 'activo' && p.autorizacion) saldoAut += +p.saldo || 0; });
  var descontable = Math.floor(salarioPendiente * 0.5) + prima + vacaciones + indem;
  var desc = d.autorizaDescuento ? Math.min(saldoAut, descontable) : 0;
  if (desc < saldoAut && d.autorizaDescuento) avisos.push('Quedan ' + saldoAut + ' − ' + desc + ' de préstamo sin descontar: las cesantías y la mitad del salario no se pueden retener. Acuerda el pago del saldo con el trabajador.');
  var r = { cedula: u.cedula, nombre: u.nombre, cargo: u.cargo, ingreso: ingreso, retiro: retiro, causa: causa, causaTexto: CAUSAS_RETIRO[causa], tipoContrato: tipo, salario: sal, auxTransporte: aux,
    diasAnio: diasAnio, diasSemestre: diasSem, diasServicio: diasServ, baseCesantias: baseCes, basePrima: basePrima, baseVacaciones: baseVac,
    basePrestaciones: baseCes, baseFuente: baseCes > fija ? 'promedio del último año (' + pAnio.dias + ' días liquidados)' : 'salario básico + auxilio',
    salarioPendiente: salarioPendiente, periodoPendiente: periodoCerrado_(retiro) ? '' : per.desde + ' a ' + retiro,
    cesantias: cesantias, interesesCesantias: intereses, prima: prima, diasVacacionesPendientes: diasVacPend, vacaciones: vacaciones,
    indemnizacion: indem, indemnizacionDetalle: indemDet, saldoPrestamos: saldoPrestamos, descuentoPrestamos: desc, totalEstimado: total - desc, avisos: avisos,
    empresa: cfg_().empresa };
  if (d.guardar && adm) {
    if (retiro > ahora_().fecha) throw E_('DATOS', 'Solo se registra la liquidación con la fecha de retiro real (hoy o antes). Para fechas futuras usa «Calcular».');
    if (leer('Liquidaciones').some(function (x) { return x.cedula === u.cedula; })) throw E_('DATOS', 'Esta persona ya tiene una liquidación registrada. Consulta la hoja Liquidaciones.');
    var resta = desc; // el saldo descontado en la liquidación cierra los préstamos
    leer('Prestamos').forEach(function (p) { if (resta <= 0 || p.cedula !== u.cedula || p.estado !== 'activo') return; var v = Math.min(resta, +p.saldo); p.saldo = String(+p.saldo - v); resta -= v; if (+p.saldo <= 0) p.estado = 'pagado'; guardar('Prestamos', p); });
    var uu = buscar('Usuarios', 'cedula', u.cedula); uu.liquidado = retiro; uu.retiro = retiro; uu.estado = 'inactivo'; guardar('Usuarios', uu); cerrarSesiones_(uu.cedula); // la nómina del periodo ya no lo vuelve a pagar
    r.id = id_(); agregar('Liquidaciones', { id: r.id, cedula: u.cedula, nombre: u.nombre, retiro: retiro, causa: causa, total: String(r.totalEstimado), detalle: JSON.stringify(r), registradoPor: adm.cedula, creado: ahora_().iso });
    auditar_(adm.cedula, 'liquidacion_contrato', { id: r.id, cedula: u.cedula, retiro: retiro, causa: causa, total: r.totalEstimado, indemnizacion: indem, descuentoPrestamos: desc });
  }
  return r;
}

/* ---------- 6. Préstamos y adelantos con cuotas ---------- */
function a_adminPrestamos() {
  var nom = {}; leer('Usuarios').forEach(function (u) { nom[u.cedula] = u.nombre; });
  return leer('Prestamos').reverse().map(function (p) {
    return { id: p.id, cedula: p.cedula, nombre: nom[p.cedula] || p.cedula, concepto: p.concepto, monto: +p.monto, cuotas: +p.cuotas, cuotaValor: +p.cuotaValor, pagadas: +p.pagadas, saldo: +p.saldo, estado: p.estado, creado: p.creado };
  });
}
function a_adminPrestamoGuardar(d, adm) {
  var ced = soloDigitos_(d.cedula), u = buscar('Usuarios', 'cedula', ced);
  if (!u) throw E_('DATOS', 'No se encontró la persona.');
  if (u.estado !== 'activo' || u.liquidado) throw E_('DATOS', 'Solo se registran préstamos a personas activas.');
  var monto = Math.round(+d.monto || 0), cuotas = Math.max(1, Math.min(60, Math.round(+d.cuotas || 1)));
  if (monto <= 0) throw E_('DATOS', 'El monto debe ser mayor a cero.');
  // CST arts. 59 y 149: sin autorización escrita del trabajador no se puede descontar del salario.
  if (!d.autorizacion) throw E_('DATOS', 'Adjunta la foto de la autorización de descuento firmada por el trabajador.');
  var fila = {
    id: id_(), cedula: ced, concepto: txt_(d.concepto, 80) || 'Préstamo / adelanto',
    monto: String(monto), cuotas: String(cuotas), cuotaValor: String(Math.round(monto / cuotas)),
    pagadas: '0', saldo: String(monto), estado: 'activo', creadoPor: adm.cedula, creado: ahora_().iso, autorizacion: '', ultimoPeriodo: ''
  };
  fila.autorizacion = guardarImagen_(d.autorizacion, 'autorizacion_prestamo_' + ced + '_' + fila.id + '.jpg', 'CARPETA_FOTOS');
  agregar('Prestamos', fila);
  auditar_(adm.cedula, 'prestamo_creado', { id: fila.id, cedula: ced, monto: monto, cuotas: cuotas });
  return { id: fila.id };
}
// Las cuotas se descuentan solas al cerrar la nómina (una por préstamo y periodo, con tope). No hay descuento manual.
function a_adminPrestamoAplicarCuota() { throw E_('DATOS', 'Las cuotas se descuentan automáticamente al cerrar la nómina, con el tope legal. No se aplican a mano.'); }
// Cuánto se puede descontar a alguien en el periodo sin dejarlo por debajo del mínimo ni pasar del 50 % del neto.
function topeDescuento_(liq, L) {
  var cant = function (cod) { return ((liq.conceptos || []).filter(function (k) { return k.cod === cod; })[0] || {}).cantidad || 0; };
  var val = function (cod) { return ((liq.conceptos || []).filter(function (k) { return k.cod === cod; })[0] || {}).valor || 0; };
  var pagados = Math.max(0, cant('SAL') + cant('DR') - cant('AUS') - cant('PNR')), neto = +liq.neto || 0;
  // El mínimo vital de los días pagados no se toca (CST arts. 59, 149 y 154) y nunca más del 50 % del neto (criterio de la Ley 1527 de 2012)
  var piso = (L.smmlv / 30) * pagados * (1 - L.pctSalud - L.pctPension);
  return Math.max(0, Math.floor(Math.min(neto * 0.5, neto - val('AUX') - piso)));
}
function aplicarCuotasPrestamos_(r, filas, adm) {
  var L = legal_(), porCed = {}, tocados = {}; filas.forEach(function (x) { porCed[x.cedula] = x; });
  leer('Prestamos').filter(function (p) { return p.estado === 'activo' && +p.saldo > 0 && p.autorizacion; }).forEach(function (p) {
    var x = porCed[p.cedula], clave = r.desde + '|' + r.hasta; if (!x || p.ultimoPeriodo === clave) return; // sin liquidación en este cierre: no se descuenta
    var disp = topeDescuento_(x.liq, L) - (tocados[p.cedula] || 0), valor = Math.max(0, Math.min(+p.saldo, +p.cuotaValor, disp));
    p.ultimoPeriodo = clave;
    if (valor > 0) {
      tocados[p.cedula] = (tocados[p.cedula] || 0) + valor;
      agregar('Novedades', { id: id_(), cedula: p.cedula, fecha: r.hasta, concepto: 'Cuota: ' + p.concepto, valor: String(-valor), salarial: '', nota: 'Préstamo ' + p.id + ' · cuota ' + (+p.pagadas + 1) + (valor < +p.cuotaValor ? ' (reducida por el tope legal)' : ''), creadoPor: adm.cedula, creado: ahora_().iso });
      p.pagadas = String(+p.pagadas + 1); p.saldo = String(Math.max(0, +p.saldo - valor)); if (+p.saldo <= 0) p.estado = 'pagado';
      auditar_(adm.cedula, 'prestamo_cuota', { id: p.id, cedula: p.cedula, valor: valor, saldo: +p.saldo });
    } else alertar_('nomina', p.cedula, 'No se descontó la cuota del préstamo "' + p.concepto + '" en el periodo ' + clave + ': el neto no alcanza sin bajar del mínimo legal.');
    guardar('Prestamos', p);
  });
  return Object.keys(tocados);
}

/* ---------- 7. Banco de horas / compensatorios ---------- */
function saldoCompensatorio_(ced) { return leer('Compensatorios').filter(function (x) { return x.cedula === ced; }).reduce(function (s, x) { return s + (+x.minutos || 0); }, 0); }
function a_misCompensatorios(d, u) {
  var lista = leer('Compensatorios').filter(function (x) { return x.cedula === u.cedula; });
  var saldoMin = lista.reduce(function (s, x) { return s + (+x.minutos || 0); }, 0);
  return { saldoMin: saldoMin, saldoHoras: Math.round(saldoMin / 6) / 10, movimientos: lista.reverse().slice(0, 60) };
}
// Disfrute = día (o parte del día) de descanso pagado: la nómina lo trata como permiso remunerado, no como ausencia.
function a_adminCompensatorioGuardar(d, adm) {
  var ced = soloDigitos_(d.cedula); if (!buscar('Usuarios', 'cedula', ced)) throw E_('DATOS', 'No se encontró la persona.');
  var min = Math.round(+d.minutos || 0); if (!min) throw E_('DATOS', 'Indica los minutos (positivos para abonar, negativos para disfrutar).');
  var fecha = /^\d{4}-\d\d-\d\d$/.test(d.fecha || '') ? d.fecha : ahora_().fecha;
  if (periodoCerrado_(fecha)) throw E_('CERRADO', 'No se puede cambiar: la nómina de esa quincena ya se cerró y se pagó. Si hay un error, pide al administrador una corrección en la quincena siguiente (bono o descuento).');
  if (min < 0 && saldoCompensatorio_(ced) + min < 0) throw E_('DATOS', 'El saldo no alcanza: tiene ' + (Math.round(saldoCompensatorio_(ced) / 6) / 10) + ' h a favor.');
  if (min > 0 && (txt_(d.motivo, 160).length < 5 || !d.soporte)) throw E_('DATOS', 'Para abonar horas escribe el origen y adjunta la foto del acuerdo firmado con el trabajador.');
  var fila = { id: id_(), cedula: ced, fecha: fecha, minutos: String(min), tipo: min > 0 ? 'abono' : 'disfrute', motivo: txt_(d.motivo, 160), creadoPor: adm.cedula, creado: ahora_().iso, soporte: '' };
  if (d.soporte) fila.soporte = guardarImagen_(d.soporte, 'acuerdo_compensatorio_' + ced + '_' + fila.id + '.jpg', 'CARPETA_FOTOS');
  agregar('Compensatorios', fila);
  auditar_(adm.cedula, 'compensatorio', { cedula: ced, minutos: min, fecha: fecha });
  return { id: fila.id };
}

/* ---------- 8. Certificado laboral en 1 clic ---------- */
// Cada certificado queda guardado tal como se emitió: la verificación pública muestra exactamente lo certificado.
function emitirCertificado_(u, conSalario, emisor) {
  var c = cfg_(), a = ahora_(), activo = u.estado === 'activo', cod = '';
  do { cod = codigoLargo_() + codigoLargo_().substr(0, 2); } while (buscar('Certificados', 'codigo', cod));
  var reg = { codigo: cod, cedula: u.cedula, fecha: a.fecha, nombre: u.nombre, cargo: u.cargo || 'Colaborador', ingreso: String(u.ingreso || '').substr(0, 10),
    retiro: activo ? '' : String(u.retiro || '').substr(0, 10), tipoContrato: u.tipoContrato || '', salario: conSalario ? String(+u.salario || 0) : '', estado: activo ? 'vinculado' : 'retirado', emitidoPor: emisor, creado: a.iso, tipoPago: u.tipoPago === 'dia' ? 'dia' : 'mensual' };
  agregar('Certificados', reg);
  auditar_(emisor, 'certificado_laboral', { cedula: u.cedula, codigo: cod, conSalario: conSalario });
  return { empresa: c.empresa.nombre, nit: c.empresa.nit, direccion: c.empresa.direccion, telefono: c.empresa.telefono,
    fecha: a.fecha, codigoVerificacion: cod, verificarEn: (c.urlApp || '').replace(/[#?].*$/, '') + (c.urlApp ? '#/verificar' : ''),
    empleado: { nombre: reg.nombre, cedula: u.cedula, cargo: reg.cargo, ingreso: reg.ingreso, retiro: reg.retiro, tipoContrato: reg.tipoContrato || 'laboral', salario: conSalario ? +reg.salario : null, salarioTipo: reg.tipoPago === 'dia' ? 'diario' : 'mensual', estado: reg.estado === 'vinculado' ? 'activo' : 'retirado' } };
}
function a_certificadoLaboral(d, u) { limite_('cert:' + u.cedula, 10, 86400); return emitirCertificado_(u, !!d.conSalario, u.cedula); }
// RRHH lo emite para cualquier persona, también retirados (que ya no pueden entrar a la aplicación)
function a_adminCertificadoLaboral(d, adm) {
  var u = buscar('Usuarios', 'cedula', soloDigitos_(d.cedula)); if (!u || /^Exempleado /.test(u.nombre)) throw E_('DATOS', 'No se encontró la persona.');
  return emitirCertificado_(u, !!d.conSalario, adm.cedula);
}

/* ---------- 9. Comunicados con confirmación de lectura ---------- */
function a_adminComunicadoCrear(d, adm) {
  var tit = txt_(d.titulo, 120), cuerpo = txt_(d.cuerpo, 2000);
  if (!tit || !cuerpo) throw E_('DATOS', 'Escribe el título y el mensaje del comunicado.');
  var fila = { id: id_(), titulo: tit, cuerpo: cuerpo, centros: JSON.stringify(Array.isArray(d.centros) ? d.centros : []), creadoPor: adm.cedula, creado: ahora_().iso, leidos: '{}' };
  agregar('Comunicados', fila);
  auditar_(adm.cedula, 'comunicado_creado', { id: fila.id, titulo: tit });
  return { id: fila.id };
}
// Recordatorio personal desde la lista de personas: le llega en «Más» y por correo si tiene
var RECORDATORIOS = { salida: 'Recuerda marcar tu salida cada día: sin salida, la jornada no cuenta horas.', olvido: 'Tienes una jornada sin salida. Entra a la aplicación y usa «Se me olvidó marcar» para registrarla.',
  activar: 'Aún no has activado tu cuenta. Entra con el enlace de la empresa, tu cédula y el código de activación.', permiso: 'Tienes una solicitud de permiso con información pendiente. Revísala en la aplicación.' };
function a_adminRecordar(d, adm) {
  var u = buscar('Usuarios', 'cedula', soloDigitos_(d.cedula)); if (!u) throw E_('DATOS', 'No se encontró la persona.');
  if (!enAlcance_(adm, u.cedula)) throw E_('PERMISO', 'Esa persona no está a tu cargo.');
  var txt = txt_(d.mensaje, 500) || RECORDATORIOS[d.tipo] || ''; if (txt.length < 5) throw E_('DATOS', 'Escribe el recordatorio.');
  limite_('rec:' + u.cedula, 5, 86400);
  agregar('Comunicados', { id: id_(), titulo: 'Recordatorio de ' + adm.nombre.split(' ')[0], cuerpo: txt, centros: '[]', creadoPor: adm.cedula, creado: ahora_().iso, leidos: '{}', cedulas: JSON.stringify([u.cedula]) });
  var porCorreo = false; if (u.email) { try { correo_(u.email, 'Recordatorio · ' + cfg_().empresa.nombre, 'Hola ' + u.nombre.split(' ')[0] + ':\n\n' + txt + '\n\n' + adm.nombre); porCorreo = true; } catch (e) { } }
  auditar_(adm.cedula, 'recordatorio', { cedula: u.cedula, tipo: d.tipo || 'libre' });
  return { ok: true, porCorreo: porCorreo };
}
// Búsqueda global del panel: personas, obras, permisos y secciones en un solo lugar
function a_adminBuscar(d, adm) {
  var q = String(d.q || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); if (q.length < 2) return { personas: [], obras: [] };
  var n = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }, al = alcance_(adm), cv = centrosVisibles_(adm), cs = {};
  centros_().forEach(function (c) { cs[c.id] = c; });
  var personas = leer('Usuarios').filter(function (u) { return u.estado !== 'preregistrado' && !/^Exempleado /.test(u.nombre) && veA_(adm, u, al) && (n(u.nombre).indexOf(q) >= 0 || u.cedula.indexOf(q) === 0 || n(u.cargo).indexOf(q) >= 0); })
    .slice(0, 8).map(function (u) { return { cedula: u.cedula, nombre: u.nombre, cargo: u.cargo, centro: (cs[u.centroId] || {}).nombre || '', estado: u.estado }; });
  var obras = centros_().filter(function (c) { return (!cv || cv[c.id]) && (n(c.nombre).indexOf(q) >= 0 || n(c.cliente).indexOf(q) >= 0 || n(c.direccion).indexOf(q) >= 0); }).slice(0, 5).map(function (c) { return { id: c.id, nombre: c.nombre, direccion: c.direccion }; });
  return { personas: personas, obras: obras };
}
function a_adminComunicados() {
  return leer('Comunicados').reverse().filter(function (x) { return !json_(x.cedulas, []).length; }).slice(0, 100).map(function (x) { // los recordatorios personales no se listan aquí
    var l = json_(x.leidos, {});
    return { id: x.id, titulo: x.titulo, cuerpo: x.cuerpo, centros: json_(x.centros, []), creado: x.creado, totalLeidos: Object.keys(l).length, leidos: l };
  });
}
// ¿Este comunicado es para esta persona? (personal por cédula, o general por obra)
function paraMi_(x, u) { var ps = json_(x.cedulas, []); if (ps.length) return ps.indexOf(u.cedula) >= 0; var cs = json_(x.centros, []); return !cs.length || cs.indexOf(u.centroId) >= 0; }
function a_comunicadosMios(d, u) {
  return leer('Comunicados').reverse().filter(function (x) { return paraMi_(x, u); }).slice(0, 50).map(function (x) {
    var l = json_(x.leidos, {});
    return { id: x.id, titulo: x.titulo, cuerpo: x.cuerpo, creado: x.creado, leidoEl: l[u.cedula] || '' };
  });
}
function a_comunicadoLeer(d, u) {
  var c = buscar('Comunicados', 'id', txt_(d.id, 40));
  if (!c || !paraMi_(c, u)) throw E_('DATOS', 'Comunicado no encontrado.');
  var l = json_(c.leidos, {});
  if (!l[u.cedula]) { l[u.cedula] = ahora_().iso; c.leidos = JSON.stringify(l); guardar('Comunicados', c); }
  return { leidoEl: l[u.cedula] };
}

/* ---------- 10. Presupuesto por obra (horas y costo) ---------- */
function a_adminPresupuestoObras(d) {
  var res = a_adminResumenObra(d), cs = {}, prov = a_adminProvisiones(d), carga = prov.total.devengado > 0 ? prov.total.costoTotal / prov.total.devengado : 1, porC = {};
  prov.filas.forEach(function (x) { var k = x.centroId || '-'; porC[k] = porC[k] || { dev: 0, costo: 0 }; porC[k].dev += x.devengado; porC[k].costo += x.costoTotal; });
  res.obras.forEach(function (o) { var p = porC[o.centroId], f = p && p.dev > 0 ? p.costo / p.dev : carga; o.costo = Math.round(o.costo * f); }); // costo real por obra: devengado + prestaciones + aportes (ARL de esa obra)
  centros_().forEach(function (c) { cs[c.id] = c; });
  return {
    desde: res.desde, hasta: res.hasta, factorCarga: Math.round(carga * 100) / 100,
    obras: res.obras.map(function (o) {
      var c = cs[o.centroId] || {};
      var pH = +(c.presupuestoHoras || 0), pC = +(c.presupuestoCosto || 0);
      var pctH = pH > 0 ? Math.round((o.horas / pH) * 100) : null;
      var pctC = pC > 0 ? Math.round((o.costo / pC) * 100) : null;
      var alerta = (pctH >= 100 || pctC >= 100) ? 'excedido' : (pctH >= 80 || pctC >= 80) ? 'aviso' : 'ok';
      return { centroId: o.centroId, centro: o.centro, horas: o.horas, presupuestoHoras: pH, pctHoras: pctH, costo: o.costo, presupuestoCosto: pC, pctCosto: pctC, alerta: alerta };
    })
  };
}

/* ---------- 11. Vista en vivo «Quién está en obra ahora» ---------- */
function a_adminEnVivo(d, adm) {
  var a = ahora_(), al = alcance_(adm), marc = leer('Marcaciones', 15000), incs = leer('Incapacidades'), cs = {};
  centros_().forEach(function (c) { cs[c.id] = c.nombre; });
  var resumen = { en_obra: 0, almuerzo: 0, salio: 0, ausente: 0, cubierto: 0 };
  var personas = leer('Usuarios').filter(function (u) {
    return u.estado === 'activo' && veA_(adm, u, al);
  }).map(function (u) {
    var dHoy = diasDe_(marc, u.cedula, a.fecha, a.fecha)[0] || null;
    var estado = 'ausente', horas = 0;
    if (dHoy && dHoy.entrada) {
      if (dHoy.salida) estado = 'salio';
      else if (dHoy.salAlm && !dHoy.entAlm) estado = 'almuerzo';
      else estado = 'en_obra';
      var finIso = dHoy.salida ? (a.fecha + 'T' + dHoy.salida) : a.iso;
      horas = Math.max(0, Math.round(((isoMs_(finIso) - isoMs_(a.fecha + 'T' + dHoy.entrada)) / 3600000) * 10) / 10);
    } else if (cubierto_(u.cedula, a.fecha, incs)) {
      estado = 'cubierto';
    }
    resumen[estado]++;
    return { cedula: u.cedula, nombre: u.nombre, cargo: u.cargo, centroId: u.centroId, centro: cs[u.centroId] || '', estado: estado, entrada: dHoy ? (dHoy.entrada || '') : '', salida: dHoy ? (dHoy.salida || '') : '', horasTranscurridas: horas };
  });
  return { fecha: a.fecha, hora: a.hora, resumen: resumen, personas: personas };
}

/* ---------- 12. Autoservicio del trabajador: programación, préstamos, extras, incapacidad y emergencias ---------- */
function a_miProgramacion(d, u) {
  var a = ahora_(), n = Math.max(1, Math.min(31, Math.round(+d.dias || 14))), centro = centroDe_(u.centroId), L = legal_(), dias = [];
  var incs = leer('Incapacidades').filter(function (i) { return i.cedula === u.cedula; });
  var perms = permisosAprobados_(u.cedula);
  for (var i = 0; i < n; i++) {
    var f = Motor.sumar(a.fecha, i), hor = horarioDe_(centro, f, u.cedula);
    var enInc = incs.some(function (x) { return x.desde <= f && f <= x.hasta; });
    var enPerm = perms.some(function (p) { return p.desde <= f && f <= p.hasta && !p.horas; });
    var nov = enInc ? 'incapacidad' : enPerm ? 'permiso' : '';
    dias.push({ fecha: f, festivo: Motor.esFestivo(f, L), centro: centro ? centro.nombre : '', descanso: !hor || !!nov, novedad: nov, horario: nov ? null : hor });
  }
  return { desde: a.fecha, dias: dias };
}
function a_misPrestamos(d, u) {
  return leer('Prestamos').filter(function (p) { return p.cedula === u.cedula; }).reverse().map(function (p) {
    return { id: p.id, concepto: p.concepto, monto: +p.monto, cuotas: +p.cuotas, cuotaValor: +p.cuotaValor, pagadas: +p.pagadas, saldo: +p.saldo, estado: p.estado, creado: p.creado };
  });
}
function a_misExtras(d, u) {
  return leer('Extras').filter(function (x) { return x.cedula === u.cedula; }).reverse().slice(0, 60).map(function (x) {
    return { id: x.id, fecha: x.fecha, minCalc: +x.minCalc || 0, minAprob: x.minAprob === '' ? null : +x.minAprob, estado: x.estado, obs: x.obs || '' };
  });
}
function a_incapacidadReportar(d, u) {
  var re = /^\d{4}-\d\d-\d\d$/, desde = d.desde || '', hasta = d.hasta || '';
  if (!re.test(desde) || !re.test(hasta) || hasta < desde) throw E_('DATOS', 'Indica fechas válidas de inicio y fin.');
  if (periodoCerrado_(desde)) throw E_('CERRADO', 'Esa fecha pertenece a una nómina ya cerrada. Comunícate con el administrador.');
  var tipo = ['general', 'laboral', 'maternidad', 'paternidad'].indexOf(d.tipo) >= 0 ? d.tipo : 'general';
  var sop = d.foto ? guardarImagen_(d.foto, 'INCAP_' + u.cedula + '_' + desde + '.jpg', 'CARPETA_FOTOS') : '';
  var fila = { id: id_(), cedula: u.cedula, tipo: tipo, desde: desde, hasta: hasta, entidad: txt_(d.entidad, 60) || u.eps || '', nota: txt_(d.nota, 200), soporte: sop, registradoPor: 'trabajador:' + u.cedula, creado: ahora_().iso };
  agregar('Incapacidades', fila);
  alertar_('permiso_nuevo', u.cedula, 'Reportó incapacidad (' + tipo + ') del ' + desde + ' al ' + hasta + '. Verifica el soporte en el panel.');
  auditar_(u.cedula, 'incapacidad_reportada', { id: fila.id, tipo: tipo, desde: desde, hasta: hasta });
  return { id: fila.id };
}
function a_contactosEmergencia(d, u) {
  var c = cfg_(), lista = [];
  if (c.empresa.telefono) lista.push({ nombre: c.empresa.nombre, rol: 'Empresa', telefono: c.empresa.telefono });
  if (Array.isArray(c.contactosEmergencia)) c.contactosEmergencia.forEach(function (x) { if (x && x.telefono) lista.push({ nombre: txt_(x.nombre, 80), rol: txt_(x.rol, 40) || 'Emergencia', telefono: soloDigitos_(x.telefono) }); });
  leer('Jefes').forEach(function (j) {
    if (j.activo === '0' || !j.whatsapp) return;
    var cs = json_(j.centros, []);
    if (!cs.length || cs.indexOf(u.centroId) >= 0) lista.push({ nombre: j.nombre, rol: j.cargo || 'Jefe inmediato', telefono: j.whatsapp });
  });
  return { arl: u.arl || '', eps: u.eps || '', contactos: lista };
}

/* ---------- 13. Interconexión total: Expediente 360° y Tablero Gerencial 360° ---------- */
function a_adminExpediente360(d, adm) {
  var ced = soloDigitos_(d.cedula), u = buscar('Usuarios', 'cedula', ced);
  if (!u) throw E_('DATOS', 'No se encontró la persona.');
  if (!enAlcance_(adm, u.cedula)) throw E_('PERMISO', 'Esta persona no pertenece a tu centro.');
  var a = ahora_(), marc = leer('Marcaciones', 15000), L = legal_();
  var tom = 0; leer('Permisos').forEach(function (p) { if (p.cedula === u.cedula && p.tipo === 'vacaciones' && p.estado === 'aprobado') tom += Motor.diasHabiles(p.fechaSalida, Motor.sumar(p.fechaRegreso, -1), L, sabadoHabil_(p.cedula)); });
  var ultNom = leer('Nomina').filter(function (n) { return n.cedula === u.cedula; }).slice(-1)[0] || null;
  var pub = usuarioPublico_(u), esAdm = adm.rol === 'admin';
  if (!esAdm) ['salario', 'banco', 'tipoCuenta', 'cuenta', 'eps', 'arl', 'email', 'telefono'].forEach(function (k) { delete pub[k]; }); // el supervisor no ve datos financieros ni de contacto
  return {
    usuario: pub,
    hoy: estadoHoy_(u, marc),
    resumenPeriodo: resumen_(u, marc),
    programacion: a_miProgramacion({ dias: 14 }, u),
    vacaciones: { causadas: Motor.vacacionesCausadas(u.ingreso, a.fecha), tomadas: tom },
    compensatorios: a_misCompensatorios({}, u),
    prestamos: esAdm ? a_misPrestamos({}, u) : [],
    extras: a_misExtras({}, u).slice(0, 15),
    comunicadosPendientes: a_comunicadosMios({}, u).filter(function (c) { return !c.leidoEl; }).length,
    ultimaNomina: ultNom && esAdm ? { id: ultNom.id, desde: ultNom.desde, hasta: ultNom.hasta, neto: +ultNom.neto, acuse: ultNom.acuse || '' } : null
  };
}
function a_adminTablero360(d, adm) {
  var a = ahora_(), enVivo = a_adminEnVivo({}, adm), iniMes = a.fecha.substr(0, 8) + '01';
  var extrasPendientes = a_adminExtras({ estado: 'pendiente' }, adm).length;
  var contratosPorVencer = leer('Usuarios').filter(function (u) {
    var fin = String(u.finContrato || '').substr(0, 10);
    if (u.estado !== 'activo' || !/^\d{4}-\d\d-\d\d$/.test(fin) || !enAlcance_(adm, u.cedula)) return false;
    var faltan = Motor.diasEntre(a.fecha, fin);
    return faltan >= 0 && faltan <= 35;
  }).map(function (u) { return { cedula: u.cedula, nombre: u.nombre, tipoContrato: u.tipoContrato, finContrato: u.finContrato }; });
  var presupuestos = adm.rol === 'admin' ? a_adminPresupuestoObras({ desde: iniMes, hasta: a.fecha }).obras.filter(function (o) { return o.alerta !== 'ok'; }) : [];
  return {
    fecha: a.fecha, hora: a.hora,
    enVivo: enVivo.resumen,
    alertasOperativas: {
      extrasPendientes: extrasPendientes,
      contratosPorVencer: contratosPorVencer,
      obrasPresupuestoAlerta: presupuestos
    }
  };
}

/* ---------- 14. Activación de licencia por plan y módulos ---------- */
function a_adminLicenciaActivar(d, adm) {
  var raw = txt_(d.llave, 1000);
  if (!prov_('clave')) throw E_('DATOS', 'Esta instalación no usa llaves de licencia: tiene todos los módulos.');
  if (!raw || raw.split('.').length !== 2) throw E_('DATOS', 'La llave de licencia no tiene un formato válido.');
  var prev = prop_('LICENCIA'), prevNit = prop_('LIC_NIT');
  if (prevNit && soloDigitos_(prevNit) !== soloDigitos_(cfg_().empresa.nit)) throw E_('DATOS', 'El NIT de la empresa no coincide con el de la licencia activa (' + prevNit + ').');
  prop_('LIC_NIT', cfg_().empresa.nit || ''); prop_('LICENCIA', raw);
  var lic = licenciaEfectiva_();
  if (lic.vencida) { prop_('LICENCIA', prev || null); prop_('LIC_NIT', prevNit || null); throw E_('DATOS', lic.motivo || 'La llave de licencia es inválida o está vencida.'); }
  auditar_(adm.cedula, 'licencia_activada', { plan: lic.plan, maxUsuarios: lic.maxUsuarios, vence: lic.vence });
  return lic;
}

/* El receptor de un certificado confirma que es auténtico con cédula, fecha y código (sin sesión). */
function a_certificadoVerificar(d) {
  var ced = soloDigitos_(d.cedula), f = /^\d{4}-\d\d-\d\d$/.test(d.fecha || '') ? d.fecha : '', cod = txt_(d.codigo, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!ced || !f || cod.length !== 10) throw E_('DATOS', 'Escribe la cédula, la fecha del certificado y el código de 10 caracteres.');
  var r = buscar('Certificados', 'codigo', cod), ok = !!(r && r.cedula === ced && r.fecha === f);
  if (!ok) { // solo se limitan los fallos, por cédula+código: un certificado auténtico siempre se puede verificar
    bloqueado_('certv:' + ced + ':' + cod, 5); fallo_('certv:' + ced + ':' + cod, 3600);
    if (fallo_('certv', 3600) === 300) alertar_('seguridad', '', 'Hubo 300 verificaciones de certificados fallidas en una hora.');
    return { valido: false, empresa: cfg_().empresa.nombre };
  }
  return { valido: true, empresa: cfg_().empresa.nombre, nombre: r.nombre, cargo: r.cargo, ingreso: r.ingreso, retiro: r.retiro, estadoAlEmitir: r.estado,
    salario: r.salario === '' ? null : +r.salario, salarioTipo: r.tipoPago === 'dia' ? 'diario' : 'mensual', vigente: r.estado === 'vinculado', fecha: r.fecha };
}
