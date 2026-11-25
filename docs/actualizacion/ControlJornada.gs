/* Control de jornada 1.8.1 — pega este archivo en Apps Script (Extensiones → Apps Script) con el nombre ControlJornada.
   Tus datos de proveedor van aparte, en Proveedor.gs. Generado por herramientas/empaquetar.js: no lo edites a mano. */

// ===================== Motor.gs =====================
/**
 * MOTOR DE LIQUIDACIÓN — Colombia (CST, Ley 2101/2021, Ley 2466/2025)
 * Archivo puro (sin servicios de Google): corre igual en Apps Script y en Node (pruebas).
 * Todo parámetro legal es configurable desde el panel de administración; estos son los
 * valores por defecto vigentes a noviembre de 2026.
 */
var Motor = (function () {
  var DEF = {
    jornadaSemanalH: 42,        // Ley 2101/2021, desde 15-jul-2026
    divisorMensual: 210,        // 42 h × 30 / 6
    nocheInicio: '19:00',       // Ley 2466/2025 (desde 25-dic-2025)
    nocheFin: '06:00',
    recargoNocturno: 0.35,      // CST art. 168
    extraDiurna: 0.25,
    extraNocturna: 0.75,
    recargoDominical: null,     // null = escalonado Ley 2466 (80 % jul-2025, 90 % jul-2026, 100 % jul-2027)
    dominicalPagaHoraBase: true,// dominical ocasional: hora + recargo, adicional al salario
    maxExtraDiaH: 2,            // Ley 50/1990 art. 22
    maxExtraSemanaH: 12,
    jornadaDiaSinHorarioH: 8,
    smmlv: 1750905,             // 2026
    auxTransporte: 249095,      // 2026
    topeAuxSmmlv: 2,
    pctSalud: 0.04,
    pctPension: 0.04,
    pctSolidaridad: 0.01,       // salarios >= 4 SMMLV
    pctIncapGeneral: 0.6667,
    pctIncapLaboral: 1,
    contarAntesDeEntrada: false,// llegar antes del horario no suma tiempo (hasta 2 h antes); true = sí cuenta
    maxOrdinariaDiaH: 9,        // jornada flexible: hasta 9 h diarias sin recargo (CST art. 161); lo que pase es extra
    descontarDominical: false,  // CST art. 173: la ausencia injustificada hace perder el dominical (facultad del empleador)
    festivosExtra: []
  };

  function cfgDe(c) { var o = {}, k; for (k in DEF) o[k] = DEF[k]; for (k in (c || {})) if (c[k] !== undefined && c[k] !== null && c[k] !== '') o[k] = c[k]; return o; }
  // Valores legales según la fecha: si la empresa no los cambió (siguen en el valor de hoy), se usan los vigentes en esa fecha
  var VIGENCIAS = { smmlv: { 2024: 1300000, 2025: 1423500, 2026: 1750905 }, auxTransporte: { 2024: 162000, 2025: 200000, 2026: 249095 } };
  function vigente(cfg, f) {
    if (!f) return cfg; var o = {}, k; for (k in cfg) o[k] = cfg[k]; var y = +String(f).substr(0, 4);
    if (f < '2026-07-15' && o.jornadaSemanalH === DEF.jornadaSemanalH && o.divisorMensual === DEF.divisorMensual) { o.jornadaSemanalH = f < '2025-07-15' ? 46 : 44; o.divisorMensual = f < '2025-07-15' ? 230 : 220; }
    if (f < '2025-12-25' && o.nocheInicio === DEF.nocheInicio) o.nocheInicio = '21:00';
    ['smmlv', 'auxTransporte'].forEach(function (q) { var t = VIGENCIAS[q]; if (o[q] === DEF[q] && t[y] && y < 2026) o[q] = t[y]; });
    return o;
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function aMin(hhmm) { if (!hhmm) return null; var p = String(hhmm).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function aHHMM(m) { m = ((m % 1440) + 1440) % 1440; return p2(Math.floor(m / 60)) + ':' + p2(m % 60); }
  function fecha(iso) { var p = String(iso).substr(0, 10).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function iso(d) { return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); }
  function sumar(isoF, n) { var d = fecha(isoF); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function dow(isoF) { return fecha(isoF).getUTCDay(); } // 0 = domingo
  function lunesDe(isoF) { var w = dow(isoF); return sumar(isoF, w === 0 ? -6 : 1 - w); }
  function diasEntre(a, b) { return Math.round((fecha(b) - fecha(a)) / 86400000); }

  /* ---------- Festivos (Ley 51 de 1983) ---------- */
  var _fest = {};
  function pascua(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return y + '-' + p2(mes) + '-' + p2(dia);
  }
  function alLunes(f) { var w = dow(f); return w === 1 ? f : sumar(f, w === 0 ? 1 : 8 - w); }
  function festivos(y) {
    if (_fest[y]) return _fest[y];
    var s = {}, pa = pascua(y);
    ['01-01', '05-01', '07-20', '08-07', '12-08', '12-25'].forEach(function (x) { s[y + '-' + x] = 1; });
    ['01-06', '03-19', '06-29', '08-15', '10-12', '11-01', '11-11'].forEach(function (x) { s[alLunes(y + '-' + x)] = 1; });
    s[sumar(pa, -3)] = 1; s[sumar(pa, -2)] = 1; s[sumar(pa, 43)] = 1; s[sumar(pa, 64)] = 1; s[sumar(pa, 71)] = 1;
    _fest[y] = s; return s;
  }
  function esFestivo(f, cfg) { return !!festivos(+f.substr(0, 4))[f] || ((cfg && cfg.festivosExtra) || []).indexOf(f) >= 0; }
  function esDescanso(f, cfg) { return dow(f) === 0 || esFestivo(f, cfg); }
  function recDominical(f, cfg) {
    if (cfg.recargoDominical !== null && cfg.recargoDominical !== undefined) return +cfg.recargoDominical;
    return f < '2025-07-01' ? 0.75 : f < '2026-07-01' ? 0.80 : f < '2027-07-01' ? 0.90 : 1;
  }

  /* ---------- Horario ---------- */
  // horario de un centro: { "1": {e:"07:00", s:"17:00", ai:"12:00", af:"13:00"}, ... } clave = día de la semana (0-6)
  function horarioDia(horario, f, cfg, trabajaFestivos) {
    if (!horario) return null;
    if (esFestivo(f, cfg) && !trabajaFestivos) return null;
    var h = horario[String(dow(f))];
    return (h && h.e && h.s) ? h : null;
  }
  function jornadaMin(h) {
    if (!h) return 0;
    var e = aMin(h.e), s = aMin(h.s); if (s <= e) s += 1440;
    var t = s - e;
    if (h.ai && h.af) { var a = aMin(h.ai), b = aMin(h.af); if (a < e) { a += 1440; b += 1440; } if (b < a) b += 1440; t -= Math.max(0, Math.min(b, s) - Math.max(a, e)); }
    return t;
  }

  /* ---------- Liquidación de un día ---------- */
  // dia: {fecha, entrada, salAlm, entAlm, salida} en 'HH:MM' (la salida puede caer al día siguiente)
  // h: horario del día (foto tomada al fichar, para que un cambio posterior no altere días pasados) o null
  // ctx: {ordSemanaMin: ordinarias ya acumuladas en la semana, extraAprobadaMin: minutos extra aprobados}
  function liquidarDia(dia, h, cfgIn, ctx) {
    var cfg = cfgDe(cfgIn); ctx = ctx || {};
    var r = { fecha: dia.fecha, incompleto: false, almuerzoAsumido: false, tardanzaMin: 0, salidaAnticipadaMin: 0,
      trabajadoMin: 0, ordDiu: 0, ordNoc: 0, domDiu: 0, domNoc: 0, extDiu: 0, extNoc: 0, extDomDiu: 0, extDomNoc: 0,
      extraCalculadaMin: 0, extraSinAprobarMin: 0, jornadaMin: 0, ordinariasMin: 0 };
    var ent = aMin(dia.entrada), sal = aMin(dia.salida);
    if (ent === null) { r.incompleto = !!dia.salida; return r; }
    if (sal === null) { r.incompleto = true; return r; }
    if (sal <= ent) sal += 1440;
    var corte = [];
    var sa = aMin(dia.salAlm), ea = aMin(dia.entAlm);
    if (sa !== null && ea !== null) {
      if (sa < ent) sa += 1440; if (ea < sa) ea += 1440;
      corte = [Math.max(sa, ent), Math.min(ea, sal)];
    } else if (h && h.ai && h.af && !dia.sinAlmuerzo) { // almuerzo sin marcar: se asume la franja programada (salvo jornada sin almuerzo aprobada)
      var a = aMin(h.ai), b = aMin(h.af); if (a < aMin(h.e)) { a += 1440; b += 1440; } if (b < a) b += 1440;
      if (sa !== null) { if (sa < ent) sa += 1440; b = sa + (b - a); a = sa; }   // marcó salida pero no regreso
      else if (ea !== null) { if (ea < ent) ea += 1440; a = ea - (b - a); b = ea; }
      if (Math.min(b, sal) > Math.max(a, ent)) { corte = [Math.max(a, ent), Math.min(b, sal)]; r.almuerzoAsumido = true; }
    } else if (!h && !dia.sinAlmuerzo && sa === null && ea === null && sal - ent > 6 * 60) { // día sin horario (domingo, festivo, sábado no programado) de más de 6 h: se descuenta 1 h de almuerzo
      var aa = cfg.almuerzoSinHorario ? aMin(cfg.almuerzoSinHorario) : 720, bb = aa + 60; if (aa < ent) { aa += 1440; bb += 1440; }
      if (aa >= ent && bb <= sal) { corte = [aa, bb]; r.almuerzoAsumido = true; } // solo si la franja de almuerzo cae dentro de lo trabajado (un turno de noche no la tiene)
    }
    var jor = h ? Math.min(jornadaMin(h), cfg.maxOrdinariaDiaH * 60) : cfg.jornadaDiaSinHorarioH * 60; r.jornadaMin = h ? jor : 0;
    if (!h && dia.libre && !esDescanso(dia.fecha, cfg)) jor = 0; // día no programado (p. ej. sábado): todo es trabajo suplementario
    if (h) {
      var tol = +(h.tol || 0), he = aMin(h.e), hs = aMin(h.s); if (hs <= he) hs += 1440;
      if (ent > he + tol) r.tardanzaMin = ent - he;
      if (sal < hs) r.salidaAnticipadaMin = hs - sal;
    }
    var ni = aMin(cfg.nocheInicio), nf = aMin(cfg.nocheFin), topeSem = cfg.jornadaSemanalH * 60;
    var ordSem = ctx.ordSemanaMin || 0, aprob = ctx.extraAprobadaMin === undefined ? 1e9 : ctx.extraAprobadaMin;
    var ordDia = 0, f0 = dia.fecha, f1 = null, d0 = esDescanso(f0, cfg), d1 = null;
    var ini = ent;
    if (h && !cfg.contarAntesDeEntrada) { var he0 = aMin(h.e); if (ent < he0 && he0 - ent <= 120) ini = he0; }
    for (var m = ini; m < sal; m++) {
      if (corte.length && m >= corte[0] && m < corte[1]) continue;
      var desc;
      if (m < 1440) desc = d0; else { if (f1 === null) { f1 = sumar(f0, 1); d1 = esDescanso(f1, cfg); } desc = d1; }
      var tod = m % 1440, noc = tod >= ni || tod < nf;
      r.trabajadoMin++;
      if (ordDia < jor && ordSem < topeSem) {
        ordDia++; ordSem++;
        if (desc) { if (noc) r.domNoc++; else r.domDiu++; } else { if (noc) r.ordNoc++; else r.ordDiu++; }
      } else {
        r.extraCalculadaMin++;
        if (aprob > 0) { aprob--; if (desc) { if (noc) r.extDomNoc++; else r.extDomDiu++; } else { if (noc) r.extNoc++; else r.extDiu++; } }
        else r.extraSinAprobarMin++;
      }
    }
    r.ordinariasMin = ordDia;
    return r;
  }

  // Liquida una lista de días. Devuelve mapa fecha -> resultado respetando el tope semanal (lunes a domingo).
  // dias: [{fecha, entrada, salAlm, entAlm, salida, horario}]  extras: {fecha: minutosAprobados} | null (= todo aprobado)
  function liquidarDias(dias, cfg, extras) {
    var orden = dias.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }), res = {}, sem = null, acum = 0;
    orden.forEach(function (d) {
      var l = lunesDe(d.fecha); if (l !== sem) { sem = l; acum = 0; }
      var r = liquidarDia(d, d.horario || null, cfg, { ordSemanaMin: acum, extraAprobadaMin: extras ? (extras[d.fecha] || 0) : undefined });
      acum += r.ordinariasMin || 0; res[d.fecha] = r;
    });
    return res;
  }

  function avisosExtras(porFecha, cfgIn) {
    var cfg = cfgDe(cfgIn), av = [], sem = {};
    Object.keys(porFecha).forEach(function (f) {
      var x = porFecha[f].extraCalculadaMin || 0; if (!x) return;
      if (x > cfg.maxExtraDiaH * 60) av.push({ fecha: f, tipo: 'dia', min: x });
      var l = lunesDe(f); sem[l] = (sem[l] || 0) + x;
    });
    Object.keys(sem).forEach(function (l) { if (sem[l] > cfg.maxExtraSemanaH * 60) av.push({ fecha: l, tipo: 'semana', min: sem[l] }); });
    return av;
  }

  /* ---------- Periodo de nómina ---------- */
  function ultimoDia(f) { var d = fecha(f.substr(0, 8) + '01'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return iso(d); }
  function periodoDe(f, tipo) {
    var ym = f.substr(0, 8), d = +f.substr(8, 2);
    if (tipo === 'mensual') return { desde: ym + '01', hasta: ultimoDia(f) };
    return d <= 15 ? { desde: ym + '01', hasta: ym + '15' } : { desde: ym + '16', hasta: ultimoDia(f) };
  }
  // Días de nómina con la convención de meses de 30 días.
  function diasNomina(desde, hasta) {
    var n = 0, f = desde;
    while (f <= hasta) { var d = +f.substr(8, 2), fin = ultimoDia(f); if (d <= 30) n++; if (f === fin && d < 30) n += 30 - d; f = sumar(f, 1); }
    return n;
  }
  function cubre(lista, f) { for (var i = 0; i < lista.length; i++) if (lista[i].desde <= f && f <= lista[i].hasta) return lista[i]; return null; }

  /**
   * p: { usuario:{salario,tipoPago}, desde, hasta, corte (fecha hasta donde hay datos), ingreso,
   *      dias:[...], extras:{fecha:min}|null, horario (del centro), trabajaFestivos,
   *      permisos:[{desde,hasta,remunerado,horas,tipo}] (solo APROBADOS), incapacidades:[{desde,hasta,tipo}] }
   */
  function liquidarPeriodo(p, cfgIn) {
    var cfg = vigente(cfgDe(cfgIn), p.hasta), u = p.usuario, sal = +u.salario || 0, porDia = u.tipoPago === 'dia';
    var corte = p.corte && p.corte < p.hasta ? p.corte : p.hasta; if (p.retiro && p.retiro < corte) corte = p.retiro;
    var desde = p.ingreso && p.ingreso > p.desde ? p.ingreso : p.desde;
    var vDia = porDia ? sal : sal / 30, vHora = porDia ? sal * 30 / cfg.divisorMensual : sal / cfg.divisorMensual;
    var liq = liquidarDias(p.dias, cfg, p.extras), porFecha = {};
    // Domingos y festivos trabajados por mes calendario (CST art. 179, Ley 2466): hasta 2 = ocasional (hora + recargo); 3 o más = habitual
    var descMes = {}; Object.keys(p.descansosMes || {}).forEach(function (m) { descMes[m] = +p.descansosMes[m] || 0; });
    if (!p.descansosMes) Object.keys(liq).forEach(function (f) { if (liq[f].trabajadoMin > 0 && esDescanso(f, cfg)) { var m = f.substr(0, 7); descMes[m] = (descMes[m] || 0) + 1; } });
    var t = { trabajadoMin: 0, ordDiu: 0, ordNoc: 0, domDiu: 0, domNoc: 0, extDiu: 0, extNoc: 0, extDomDiu: 0, extDomNoc: 0, extraSinAprobarMin: 0, tardanzas: 0, tardanzaMin: 0 };
    var valores = { recNoc: 0, dom: 0, domNoc: 0, extDiu: 0, extNoc: 0, extDomDiu: 0, extDomNoc: 0 };
    var diasTrab = 0, incompletos = [];
    Object.keys(liq).forEach(function (f) {
      if (f < desde || f > corte) return;
      var r = liq[f]; porFecha[f] = r;
      if (r.incompleto) { incompletos.push(f); return; }
      if (r.trabajadoMin > 0) diasTrab++;
      ['trabajadoMin', 'ordDiu', 'ordNoc', 'domDiu', 'domNoc', 'extDiu', 'extNoc', 'extDomDiu', 'extDomNoc', 'extraSinAprobarMin', 'tardanzaMin'].forEach(function (k) { t[k] += r[k] || 0; });
      if (r.tardanzaMin) t.tardanzas++;
      var habitual = (descMes[f.substr(0, 7)] || 0) >= 3;
      var rd = recDominical(f, cfg), base = cfg.dominicalPagaHoraBase && !porDia && !(habitual && r.jornadaMin > 0) ? 1 : 0, vm = vHora / 60; // habitual y en el horario, o pago por día: solo el recargo
      valores.recNoc += r.ordNoc * vm * cfg.recargoNocturno;
      valores.dom += r.domDiu * vm * (base + rd);
      valores.domNoc += r.domNoc * vm * (base + rd + cfg.recargoNocturno);
      valores.extDiu += r.extDiu * vm * (1 + cfg.extraDiurna);
      valores.extNoc += r.extNoc * vm * (1 + cfg.extraNocturna);
      valores.extDomDiu += r.extDomDiu * vm * (1 + cfg.extraDiurna + rd);
      valores.extDomNoc += r.extDomNoc * vm * (1 + cfg.extraNocturna + rd);
    });
    var aus = 0, diasIncGen = 0, diasIncOtra = 0, diasVac = 0, diasPermNoRem = 0, horasPermNoRem = 0, f = desde, ausentes = [];
    var perms = p.permisos || [], incs = (p.incapacidades || []).slice().sort(function (a, b) { return a.desde < b.desde ? -1 : 1; });
    // Prórrogas: incapacidades generales seguidas cuentan desde el inicio de la primera (CST art. 227)
    incs.forEach(function (x, i) { x.inicio = x.desde; var pv = incs[i - 1]; if (pv && pv.tipo === 'general' && x.tipo === 'general' && sumar(pv.hasta, 1) >= x.desde) x.inicio = pv.inicio; });
    var diasIncLarga = 0, diasLic = 0, faltaSem = {}, descansos = 0;
    while (f <= corte) {
      var inc = cubre(incs, f), per = cubre(perms, f), r2 = liq[f], trabajo = r2 && (r2.trabajadoMin > 0 || r2.incompleto), es31 = +f.substr(8, 2) === 31;
      var prog = p.programado && p.programado[f] !== undefined ? p.programado[f] : !!horarioDia(p.horario, f, cfg, p.trabajaFestivos);
      var finFeb = f.substr(5, 2) === '02' && sumar(f, 1).substr(5, 2) === '03', extra = finFeb ? 30 - +f.substr(8, 2) : 0; // febrero: convención de 30 días
      if (inc) { if (!es31) { var k0 = 1 + extra; if (inc.tipo === 'general') { if (diasEntre(inc.inicio || inc.desde, f) >= 90) diasIncLarga += k0; else diasIncGen += k0; } else diasIncOtra += k0; } }
      else if (per && per.tipo === 'vacaciones') { if (!es31) diasVac += 1 + extra; }
      else if (per && !per.horas) { if (!trabajo && !es31) { if (per.remunerado) diasLic++; else diasPermNoRem++; } }
      else if (!trabajo && prog) { faltaSem[lunesDe(f)] = 1; if (!porDia && !es31) { aus++; ausentes.push(f); } }
      else if (!trabajo && esDescanso(f, cfg)) descansos++;
      // Jornalero que trabaja su domingo o festivo: conserva el descanso remunerado y además cobra el día con recargo (CST arts. 173, 179 y 180)
      if (porDia && trabajo && !inc && esDescanso(f, cfg)) descansos++;
      f = sumar(f, 1);
    }
    perms.forEach(function (x) { if (x.horas && !x.remunerado && x.desde >= desde && x.desde <= corte) horasPermNoRem += +x.horas; });

    var dn = diasNomina(desde, corte), c = [];
    function add(cod, concepto, cant, valor) { valor = (valor < 0 ? -1 : 1) * Math.round(Math.abs(valor)); if (valor) c.push({ cod: cod, concepto: concepto, cantidad: cant, valor: valor }); }
    var h = function (m) { return Math.round(m / 6) / 10; };
    var piso = cfg.smmlv / 30, semFalta = Object.keys(faltaSem).filter(function (l) { var dm = sumar(l, 6); return dm >= desde && dm <= corte; }).length;
    if (porDia) {
      add('SAL', 'Días trabajados', diasTrab, diasTrab * vDia);
      var dr = Math.max(0, descansos - semFalta); // CST arts. 173 y 177: el jornalero gana el descanso si no faltó sin justificación esa semana
      add('DR', 'Descanso dominical y festivo remunerado', dr, dr * vDia);
    } else {
      var dSal = Math.max(0, dn - diasIncGen - diasIncLarga - diasIncOtra - diasVac);
      add('SAL', 'Salario básico', dSal, dSal * vDia);
      add('AUS', 'Ausencias sin justificar', aus, -aus * vDia);
      if (cfg.descontarDominical) add('DNC', 'Dominical no causado por ausencia', semFalta, -semFalta * vDia);
      add('PNR', 'Permisos no remunerados (días)', diasPermNoRem, -diasPermNoRem * vDia);
      add('PNH', 'Permisos no remunerados (horas)', horasPermNoRem, -horasPermNoRem * vHora);
    }
    // Salario variable: vacaciones con el promedio del último año (CST art. 192) e incapacidades con el IBC del mes anterior
    var vVac = Math.max(vDia, +p.baseVacDia || 0), vInc = Math.max(vDia, +p.baseIncDia || 0);
    add('VAC', 'Vacaciones disfrutadas', diasVac, diasVac * vVac);
    add('ING', 'Incapacidad enfermedad general', diasIncGen, diasIncGen * Math.max(vInc * cfg.pctIncapGeneral, Math.min(piso, vInc)));
    add('IN5', 'Incapacidad general desde el día 91 (50 %)', diasIncLarga, diasIncLarga * Math.max(vInc * 0.5, Math.min(piso, vInc)));
    add('INL', 'Incapacidad laboral / licencia', diasIncOtra, diasIncOtra * vInc * cfg.pctIncapLaboral);
    add('RN', 'Recargo nocturno', h(t.ordNoc), valores.recNoc);
    add('DF', 'Dominical / festivo diurno', h(t.domDiu), valores.dom);
    add('DFN', 'Dominical / festivo nocturno', h(t.domNoc), valores.domNoc);
    add('HED', 'Hora extra diurna', h(t.extDiu), valores.extDiu);
    add('HEN', 'Hora extra nocturna', h(t.extNoc), valores.extNoc);
    add('HEDF', 'Hora extra diurna dominical / festiva', h(t.extDomDiu), valores.extDomDiu);
    add('HENF', 'Hora extra nocturna dominical / festiva', h(t.extDomNoc), valores.extDomNoc);
    var novs = (p.novedades || []).filter(function (n) { return n.fecha >= p.desde && n.fecha <= corte && +n.valor; });
    novs.forEach(function (n) { if (n.salarial && n.valor > 0) add('BON', n.concepto, 1, n.valor); });
    var ibc = c.reduce(function (s, x) { return s + x.valor; }, 0);
    var mensual = porDia ? sal * 30 : sal, diasAux = porDia ? diasTrab : Math.max(0, dn - aus - diasIncGen - diasIncLarga - diasIncOtra - diasVac - diasPermNoRem - diasLic);
    if (mensual <= cfg.smmlv * cfg.topeAuxSmmlv) add('AUX', 'Auxilio de transporte', diasAux, diasAux * cfg.auxTransporte / 30);
    novs.forEach(function (n) { if (!n.salarial && n.valor > 0) add('BNS', n.concepto, 1, n.valor); });
    var devengado = c.reduce(function (s, x) { return s + x.valor; }, 0), d = [];
    // Ley 1393 de 2010 art. 30: lo no salarial que pase del 40 % de la remuneración total entra al IBC
    var noSal = novs.reduce(function (s, n) { return s + (!n.salarial && n.valor > 0 ? n.valor : 0); }, 0), totalRem = ibc + noSal, exceso = Math.max(0, noSal - totalRem * 0.4);
    if (exceso > 0) ibc += Math.round(exceso);
    var ibcBase = Math.min(Math.max(0, ibc), cfg.smmlv * 25 * dn / 30); // tope de cotización: 25 SMMLV
    function ded(cod, concepto, pct) { var v = Math.round(ibcBase * pct); if (v) d.push({ cod: cod, concepto: concepto, cantidad: Math.round(pct * 10000) / 100 + ' %', valor: v }); }
    ded('SLD', 'Aporte a salud', cfg.pctSalud); ded('PEN', 'Aporte a pensión', cfg.pctPension);
    // Fondo de solidaridad pensional sobre el IBC llevado a mes (Ley 100 art. 27): 1 % desde 4 SMMLV y adicional de 0,2 a 1 % desde 16 SMMLV
    var sm = dn ? ibc * 30 / dn / cfg.smmlv : 0, adic = sm < 16 ? 0 : sm < 17 ? 0.002 : sm < 18 ? 0.004 : sm < 19 ? 0.006 : sm <= 20 ? 0.008 : 0.01;
    if (sm >= 4) ded('FSP', 'Fondo de solidaridad pensional', cfg.pctSolidaridad + adic);
    novs.forEach(function (n) { if (n.valor < 0) d.push({ cod: 'DES', concepto: n.concepto, cantidad: 1, valor: Math.round(-n.valor) }); });
    var deducciones = d.reduce(function (s, x) { return s + x.valor; }, 0);
    return { desde: p.desde, hasta: p.hasta, corte: corte, diasNomina: dn, diasTrabajados: diasTrab, valorHora: Math.round(vHora),
      horas: { trabajadas: h(t.trabajadoMin), nocturnas: h(t.ordNoc + t.domNoc), dominicales: h(t.domDiu + t.domNoc), extras: h(t.extDiu + t.extNoc + t.extDomDiu + t.extDomNoc), extrasSinAprobar: h(t.extraSinAprobarMin) },
      tardanzas: t.tardanzas, tardanzaMin: t.tardanzaMin, ausencias: aus, ausentes: ausentes, incompletos: incompletos,
      conceptos: c, deduccionesDet: d, ibc: ibc, devengado: devengado, deducciones: deducciones, neto: devengado - deducciones,
      avisos: avisosExtras(porFecha, cfg), porFecha: porFecha };
  }

  /* ---------- Vacaciones (CST art. 186: 15 días hábiles por año) ---------- */
  function vacacionesCausadas(ingreso, hoy) { if (!ingreso || hoy < ingreso) return 0; return Math.max(0, Math.round(diasNomina(ingreso, hoy) * 15 / 360 * 10) / 10); } // 15 días hábiles por cada 360 (CST art. 186)
  function diasHabiles(desde, hasta, cfg, sabadoHabil) {
    var n = 0, f = desde; while (f <= hasta) { var w = dow(f); if (w !== 0 && !esFestivo(f, cfg) && (w !== 6 || sabadoHabil)) n++; f = sumar(f, 1); } return n;
  }

  /* ---------- Catálogo de permisos ---------- */
  var PERMISOS = [
    { id: 'cita_medica', cat: 'ley', nombre: 'Cita médica o de urgencia', norma: 'CST art. 57 num. 6 (Ley 2466 de 2025)', rem: true },
    { id: 'luto', cat: 'ley', nombre: 'Licencia de luto (5 días hábiles)', norma: 'Ley 1280 de 2009', rem: true },
    { id: 'paternidad', cat: 'ley', nombre: 'Licencia de paternidad', norma: 'Ley 2114 de 2021', rem: true },
    { id: 'maternidad', cat: 'ley', nombre: 'Licencia de maternidad', norma: 'CST art. 236', rem: true },
    { id: 'sufragio', cat: 'ley', nombre: 'Descanso por votar (media jornada)', norma: 'Ley 403 de 1997', rem: true },
    { id: 'jurado', cat: 'ley', nombre: 'Jurado de votación (1 día)', norma: 'Código Electoral art. 105', rem: true },
    { id: 'citacion', cat: 'ley', nombre: 'Citación judicial o administrativa', norma: 'CST art. 57 num. 6', rem: true },
    { id: 'escolar', cat: 'ley', nombre: 'Obligación escolar como acudiente', norma: 'CST art. 57 num. 6 (Ley 2466 de 2025)', rem: true },
    { id: 'cargo_oficial', cat: 'ley', nombre: 'Cargo oficial de forzosa aceptación', norma: 'CST art. 57 num. 6', rem: true },
    { id: 'sindical', cat: 'ley', nombre: 'Comisión sindical', norma: 'CST art. 57 num. 6', rem: true },
    { id: 'entierro', cat: 'ley', nombre: 'Entierro de un compañero', norma: 'CST art. 57 num. 6', rem: true },
    { id: 'familia', cat: 'acuerdo', nombre: 'Jornada de la familia', norma: 'Ley 1857 de 2017 (no obligatoria con jornada de 42 h: Ley 2101 de 2021)', rem: true },
    { id: 'bicicleta', cat: 'acuerdo', nombre: 'Día por uso de bicicleta', norma: 'Ley 1811 de 2016 · Ley 2466 de 2025 (según lo adopte la empresa)', rem: true },
    { id: 'calamidad', cat: 'calamidad', nombre: 'Calamidad doméstica', norma: 'CST art. 57 num. 6 · Sentencia C-930 de 2009', rem: true },
    { id: 'vacaciones', cat: 'vacaciones', nombre: 'Vacaciones', norma: 'CST art. 186', rem: true },
    { id: 'acuerdo_rem', cat: 'acuerdo', nombre: 'Permiso remunerado por acuerdo', norma: 'Acuerdo con el empleador', rem: true },
    { id: 'acuerdo_comp', cat: 'acuerdo', nombre: 'Permiso con reposición de tiempo', norma: 'Acuerdo con el empleador', rem: true },
    { id: 'personal', cat: 'voluntario', nombre: 'Permiso personal no remunerado', norma: 'CST art. 51 num. 4', rem: false }
  ];

  return { DEF: DEF, cfg: cfgDe, aMin: aMin, aHHMM: aHHMM, sumar: sumar, dow: dow, lunesDe: lunesDe, diasEntre: diasEntre, pascua: pascua,
    festivos: festivos, esFestivo: esFestivo, esDescanso: esDescanso, recDominical: recDominical, horarioDia: horarioDia, jornadaMin: jornadaMin,
    liquidarDia: liquidarDia, vigente: vigente, liquidarDias: liquidarDias, avisosExtras: avisosExtras, periodoDe: periodoDe, diasNomina: diasNomina,
    liquidarPeriodo: liquidarPeriodo, vacacionesCausadas: vacacionesCausadas, diasHabiles: diasHabiles, PERMISOS: PERMISOS, ultimoDia: ultimoDia };
})();


// ===================== Base.gs =====================
/**
 * CONTROL DE JORNADA — Backend en Google Apps Script sobre Google Sheets.
 * Base: acceso a datos, seguridad, configuración y enrutador de la API.
 * Una hoja de cálculo = una empresa. Nada de la empresa está escrito en el código: todo vive en la hoja Config.
 */
var VERSION = '1.8.1';
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
  empresa: { nombre: 'Mi empresa', nit: '', direccion: '', telefono: '', logo: '', color: '', correoDatos: '', responsableDatos: '', titularSoftware: '', icono: 'soldador' },
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

// ===================== Servicios.gs =====================
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
    else if (k === 'empresa') { var e = {}; Object.keys(CFG_DEF.empresa).forEach(function (q) { e[q] = txt_((v || {})[q], q === 'logo' ? 40000 : 200); }); if (e.logo && !/^data:image\/(png|jpeg|webp);base64,/.test(e.logo) && !/^https:\/\//.test(e.logo)) e.logo = ''; if (e.color && !/^#[0-9a-fA-F]{6}$/.test(e.color)) e.color = ''; if (['soldador', 'casco', 'persona', 'ninguno'].indexOf(e.icono) < 0) e.icono = 'soldador'; v = e; }
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

// ===================== Turnos.gs =====================
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

// ===================== Informes.gs =====================
/**
 * CONTROL DE JORNADA — Informes versátiles: cualquier rango, filtros y agrupación, con las mismas reglas de la nómina.
 */
var AGRUPACIONES = { persona: 1, centro: 1, cargo: 1, supervisor: 1, dia: 1, semana: 1, mes: 1, diaSemana: 1, total: 1 };
var NOMBRE_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function a_adminInforme(d, adm) {
  var r = rango_(d, 93), corte = r.hasta < r.hoy ? r.hasta : r.hoy, L = legal_(), al = alcance_(adm), verCosto = !al, c = cfg_();
  var por = AGRUPACIONES[d.agrupar] ? d.agrupar : 'persona', f = d.filtros || {}, marc = marcDesde_(Motor.lunesDe(r.desde));
  var setDe = function (l) { var m = null; (l || []).forEach(function (x) { (m = m || {})[String(x)] = 1; }); return m; };
  var fCentro = setDe(f.centros), fPersona = setDe(f.cedulas), fCargo = setDe(f.cargos), cs = {};
  centros_().forEach(function (x) { cs[x.id] = x.nombre; });
  var factor = 1 + (+c.factorPrestacional || 0) / 100, g = {}, totalPersonas = {};
  function clave(fecha, u, cid) {
    switch (por) {
      case 'persona': return [u.cedula, u.nombre];
      case 'centro': return [cid || '-', cs[cid] || 'Sin centro'];
      case 'cargo': return [u.cargo || '-', u.cargo || 'Sin cargo'];
      case 'supervisor': return [u.supervisor || '-', u.supervisor ? ((buscar('Usuarios', 'cedula', u.supervisor) || {}).nombre || u.supervisor) : 'Supervisor de su obra'];
      case 'dia': return [fecha, fecha];
      case 'semana': var l = Motor.lunesDe(fecha); return [l, 'Semana del ' + l];
      case 'mes': return [fecha.substr(0, 7), fecha.substr(0, 7)];
      case 'diaSemana': var w = Motor.dow(fecha); return [String((w + 6) % 7), NOMBRE_DIA[w]];
      default: return ['total', 'Total'];
    }
  }
  function grupo(k) { return g[k[0]] || (g[k[0]] = { clave: k[0], nombre: k[1], personas: {}, dias: 0, revisados: 0, noVino: 0, novedades: 0, sinAlmuerzo: 0, diasLargos: 0, horas: 0, ordinarias: 0, nocturnas: 0, dominicales: 0, extras: 0, extrasAprob: 0, extrasPend: 0, tardanzas: 0, minTarde: 0, ausencias: 0, incompletas: 0, digitadas: 0, fueraZona: 0, diasPermiso: 0, diasIncapacidad: 0, costo: 0 }); }
  var revs = {}; leer('Revisiones').forEach(function (x) { if (x.fecha >= r.desde && x.fecha <= r.hasta) revs[x.cedula + '|' + x.fecha] = x.estado; });
  var sinA = {}; leer('SinAlmuerzo').forEach(function (x) { if (x.estado === 'aprobado') sinA[x.cedula + '|' + x.fecha] = 1; });
  leer('Usuarios').forEach(function (u) {
    if (u.estado === 'preregistrado' || !veA_(adm, u, al) || (fPersona && !fPersona[u.cedula]) || (fCargo && !fCargo[u.cargo || '-'])) return;
    if (u.estado !== 'activo' && !(u.retiro && u.retiro >= r.desde)) return;
    var ins = insumos_(u, r.desde, r.hasta, corte, marc), liq = Motor.liquidarPeriodo(ins, L), diaCentro = {}, marcasDia = {};
    ins.dias.forEach(function (x) { diaCentro[x.fecha] = x.centroId; marcasDia[x.fecha] = x.marcas; });
    var minTot = 0; Object.keys(liq.porFecha).forEach(function (k) { minTot += liq.porFecha[k].trabajadoMin || 0; });
    var ausentes = setDe(liq.ausentes) || {}, dDesde = ins.ingreso && ins.ingreso > r.desde ? ins.ingreso : r.desde, dHasta = liq.corte, nDias = Math.max(1, Motor.diasEntre(dDesde, dHasta) + 1);
    var cubre = function (l, x) { return l.some(function (p) { return p.desde <= x && x <= p.hasta && !p.horas; }); };
    for (var fe = dDesde; fe <= dHasta; fe = Motor.sumar(fe, 1)) {
      var q = liq.porFecha[fe], cid = diaCentro[fe] || u.centroId;
      if (fCentro && !fCentro[cid]) continue;
      var inc = cubre(ins.incapacidades, fe), per = !inc && cubre(ins.permisos, fe), aus = !!ausentes[fe];
      var costoDia = verCosto ? liq.devengado * (minTot ? (q ? q.trabajadoMin : 0) / minTot : 1 / nDias) * factor : 0;
      if (!q && !inc && !per && !aus && !costoDia) continue;
      var G = grupo(clave(fe, u, cid));
      if (q) {
        if (q.trabajadoMin) { G.dias++; G.personas[u.cedula] = 1; totalPersonas[u.cedula] = 1; }
        G.horas += q.trabajadoMin; G.ordinarias += q.ordinariasMin || 0; G.nocturnas += q.ordNoc + q.domNoc; G.dominicales += q.domDiu + q.domNoc;
        G.extras += q.extraCalculadaMin; G.extrasAprob += q.extDiu + q.extNoc + q.extDomDiu + q.extDomNoc; G.extrasPend += q.extraSinAprobarMin;
        if (+c.fatigaHorasMax > 0 && q.trabajadoMin >= c.fatigaHorasMax * 60) G.diasLargos++;
        if (q.tardanzaMin) { G.tardanzas++; G.minTarde += q.tardanzaMin; } if (q.incompleto && fe < r.hoy) G.incompletas++;
        (marcasDia[fe] || []).forEach(function (m) { if (m.manual) G.digitadas++; if (m.enZona === '0') G.fueraZona++; });
      }
      var rv = revs[u.cedula + '|' + fe]; if (rv) { G.revisados++; if (rv === 'no_vino') G.noVino++; if (rv === 'novedad') G.novedades++; } if (sinA[u.cedula + '|' + fe]) G.sinAlmuerzo++;
      if (aus) { G.ausencias++; G.personas[u.cedula] = 1; } if (inc) G.diasIncapacidad++; if (per) G.diasPermiso++;
      G.costo += costoDia;
    }
  });
  var h = function (m) { return Math.round(m / 6) / 10; };
  var filas = Object.keys(g).map(function (k) { var x = g[k];
    return { clave: x.clave, nombre: x.nombre, personas: Object.keys(x.personas).length, dias: x.dias, horas: h(x.horas), ordinarias: h(x.ordinarias), nocturnas: h(x.nocturnas), dominicales: h(x.dominicales),
      extras: h(x.extras), extrasAprob: h(x.extrasAprob), extrasPend: h(x.extrasPend), tardanzas: x.tardanzas, minTarde: x.minTarde, ausencias: x.ausencias, incompletas: x.incompletas, digitadas: x.digitadas, fueraZona: x.fueraZona,
      diasPermiso: x.diasPermiso, revisados: x.revisados, noVino: x.noVino, novedades: x.novedades, sinAlmuerzo: x.sinAlmuerzo, diasLargos: x.diasLargos, diasIncapacidad: x.diasIncapacidad, horasPromedio: x.dias ? Math.round(x.horas / x.dias / 6) / 10 : 0,
      ausentismo: x.dias + x.ausencias ? Math.round(x.ausencias * 1000 / (x.dias + x.ausencias)) / 10 : 0, costo: verCosto ? Math.round(x.costo) : null };
  }).map(function (f) { // presupuesto contra lo real: presupuesto mensual prorrateado a los días del rango
    if (por !== 'centro') return f; var ce = centros_().filter(function (x) { return x.id === f.clave; })[0]; if (!ce) return f;
    var fr = (Motor.diasEntre(r.desde, corte) + 1) / 30;
    if (+ce.presupuestoHoras > 0) { f.presHoras = Math.round(ce.presupuestoHoras * fr); f.presHorasPct = Math.round(f.horas * 100 / f.presHoras); }
    if (verCosto && +ce.presupuestoCosto > 0) { f.presCosto = Math.round(ce.presupuestoCosto * fr); f.presCostoPct = Math.round(f.costo * 100 / f.presCosto); }
    return f;
  }).sort(function (a, b) { return ['dia', 'semana', 'mes', 'diaSemana'].indexOf(por) >= 0 ? (a.clave < b.clave ? -1 : 1) : b.horas - a.horas; });
  return { desde: r.desde, hasta: r.hasta, corte: corte, agrupar: por, verCosto: verCosto, factorPrestacional: +c.factorPrestacional || 0, personasConActividad: Object.keys(totalPersonas).length, filas: filas,
    opciones: { centros: centros_().filter(function (x) { var cv = centrosVisibles_(adm); return !cv || cv[x.id]; }).map(function (x) { return { id: x.id, nombre: x.nombre }; }),
      cargos: Object.keys(leer('Usuarios').reduce(function (m, u) { if (veA_(adm, u, al)) m[u.cargo || '-'] = 1; return m; }, {})).sort(),
      personas: leer('Usuarios').filter(function (u) { return u.estado !== 'preregistrado' && veA_(adm, u, al); }).map(function (u) { return { cedula: u.cedula, nombre: u.nombre }; }) } };
}

/* El trabajador consulta su propio resumen en cualquier rango (máximo dos meses). */
function a_miResumen(d, u) {
  var r = rango_(d, 62), corte = r.hasta < r.hoy ? r.hasta : r.hoy, ins = insumos_(u, r.desde, r.hasta, corte, leer('Marcaciones', colaMarc_())), liq = Motor.liquidarPeriodo(ins, legal_());
  liq.incompletos = liq.incompletos.filter(function (f) { return f !== r.hoy; });
  var o = sinDetalle_(liq); o.dias = ins.dias.filter(function (x) { return x.fecha >= r.desde && x.fecha <= r.hasta; }).map(function (x) { var q = liq.porFecha[x.fecha] || {};
    return { fecha: x.fecha, entrada: x.entrada || '', salAlm: x.salAlm || '', entAlm: x.entAlm || '', salida: x.salida || '', min: q.trabajadoMin || 0, extra: q.extraCalculadaMin || 0, tarde: q.tardanzaMin || 0, incompleto: !!q.incompleto && x.fecha !== r.hoy }; });
  return o;
}

// ===================== Modulos.gs =====================
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

// ===================== Tareas.gs =====================
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
  // Se prueba igual que lo hace el celular: una petición POST a «publico» que debe devolver JSON
  try {
    var r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'text/plain;charset=utf-8', payload: JSON.stringify({ a: 'publico', d: {} }), muteHttpExceptions: true, followRedirects: true });
    var t = r.getContentText() || '', j = null; try { j = JSON.parse(t); } catch (x) { }
    if (j && j.ok) return { ok: true };
    if (j && /NIT no v/.test(j.error || '')) return { ok: false, por: 'panel' };
    if (j) return { ok: false, por: 'otro' };
    if (r.getResponseCode() === 404 || /does not exist|no existe|not found/i.test(t)) return { ok: false, por: 'borrada' };
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
  var adm = leer('Usuarios').some(function (u) { return u.rol === 'admin'; }); bien('Primer administrador registrado', adm, p.ok ? 'Abre el enlace de arriba, escribe tu cédula y el código de «Control de jornada → Ver código del primer administrador», y crea tu contraseña.' : 'Primero arregla el servidor (primera fila).');
  // Se reporta al panel en este momento: la empresa aparece de inmediato en la consola del proveedor
  var panel = prov_('panel'), rep = null;
  if (panel) { try { rep = reportarAlPanel_(); } catch (x) { rep = { ok: false, mensaje: String(x.message || x) }; } }
  bien(panel ? 'Reportada al panel del proveedor' + (rep && rep.ok ? ' (' + rep.mensaje + ')' : '') : 'Panel del proveedor (no configurado: opcional)', !panel || (rep && rep.ok),
    rep && /NIT/.test(rep.mensaje) ? 'Falta el NIT: entra a la aplicación como administrador → Configuración → Empresa → escribe el NIT y guarda. Después vuelve a usar «Revisar instalación».'
      : (rep ? rep.mensaje + ' — Si dice que no responde, copia de nuevo el bloque de la pestaña «Proveedor.gs» de la hoja del panel en el archivo Proveedor.gs de esta empresa.' : ''));
  var ss = SpreadsheetApp.getActive(), h = ss.getSheetByName('Revisión') || ss.insertSheet('Revisión', 0);
  h.clear(); h.setColumnWidth(1, 430); h.setColumnWidth(2, 640);
  var todo = filas.every(function (f) { return f[0].charAt(0) === '✅'; });
  var cab = [[todo ? 'TODO ESTÁ BIEN. Enlace para los celulares:' : 'HAY COSAS POR ARREGLAR (columna B dice cómo, de arriba hacia abajo):', ''], [p.ok ? (e.enlace || '') : '', ''], ['', ''], ['Revisión', 'Cómo arreglarlo']];
  h.getRange(1, 1, cab.length + filas.length, 2).setValues(cab.concat(filas)).setWrap(true).setVerticalAlignment('top');
  h.getRange(1, 1).setFontWeight('bold').setFontSize(13).setFontColor(todo ? '#1B7A3E' : '#B3261E'); h.getRange(4, 1, 1, 2).setFontWeight('bold');
  if (e.enlace && p.ok) h.getRange(2, 1).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(e.enlace).setLinkUrl(e.enlace).build());
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
  if (e.enlace) h.getRange(2, 1).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(e.enlace).setLinkUrl(e.enlace).build());
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

// ===================== Actualizar.gs =====================
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
  var r = actualizar_('web'); auditar_(adm.cedula, 'actualizar_ahora', { resultado: r.mensaje });
  if (r && r.ok === false) throw E_('DATOS', r.mensaje); // así la pantalla siempre muestra por qué no se actualizó
  return r;
}
function a_adminLicenciaSincronizar(d, adm) { var r = reportarAlPanel_(); if (!r.ok) throw E_('DATOS', r.mensaje); return r; }
