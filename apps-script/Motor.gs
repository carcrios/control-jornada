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
if (typeof module !== 'undefined') module.exports = Motor;
