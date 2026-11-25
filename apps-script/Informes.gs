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
