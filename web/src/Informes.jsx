import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Bookmark, Download, Filter, Table2, Trash2, X } from 'lucide-react';
import { api, guardado } from './api.js';
import { Aviso, Boton, Campo, Estado, Hoja, Insignia, Tarjeta, Vacio, useCarga } from './ui.jsx';
import { hoyISO, pesos, sumarDias } from './util.js';
import { Titulo, aExcel, useAccion } from './Admin.jsx';

/* ---------- Catálogo: qué se puede medir y cómo agrupar ---------- */
export const METRICAS = [
  { k: 'horas', t: 'Horas trabajadas', u: 'h' }, { k: 'ordinarias', t: 'Horas ordinarias', u: 'h' }, { k: 'extras', t: 'Horas extra', u: 'h' },
  { k: 'extrasAprob', t: 'Extra aprobadas', u: 'h' }, { k: 'extrasPend', t: 'Extra sin aprobar', u: 'h' }, { k: 'nocturnas', t: 'Horas nocturnas', u: 'h' },
  { k: 'dominicales', t: 'Horas dominicales y festivas', u: 'h' }, { k: 'horasPromedio', t: 'Promedio de horas por día', u: 'h', prom: true },
  { k: 'dias', t: 'Días-persona trabajados', u: '' }, { k: 'personas', t: 'Personas', u: '', noSuma: true }, { k: 'tardanzas', t: 'Llegadas tarde', u: '' },
  { k: 'minTarde', t: 'Minutos tarde', u: 'min' }, { k: 'ausencias', t: 'Ausencias', u: '' }, { k: 'ausentismo', t: 'Ausentismo', u: '%', prom: true },
  { k: 'diasPermiso', t: 'Días de permiso', u: '' }, { k: 'diasIncapacidad', t: 'Días de incapacidad', u: '' }, { k: 'incompletas', t: 'Jornadas sin salida', u: '' }, { k: 'revisados', t: 'Días revisados por supervisor', u: '' }, { k: 'noVino', t: 'No vino (confirmado)', u: '' }, { k: 'novedades', t: 'Novedades del supervisor', u: '' }, { k: 'sinAlmuerzo', t: 'Días sin almuerzo aprobados', u: '' },
  { k: 'digitadas', t: 'Marcaciones digitadas', u: '' }, { k: 'fueraZona', t: 'Marcaciones fuera de zona', u: '' }, { k: 'diasLargos', t: 'Jornadas largas (fatiga)', u: '' }, { k: 'costo', t: 'Costo de personal', u: '$', costo: true },
  { k: 'presHoras', t: 'Horas presupuestadas', u: 'h' }, { k: 'presHorasPct', t: '% horas usadas del presupuesto', u: '%' }, { k: 'presCosto', t: 'Costo presupuestado', u: '$', costo: true }, { k: 'presCostoPct', t: '% costo usado del presupuesto', u: '%', costo: true }
];
const AGRUPAR = [['persona', 'Persona'], ['centro', 'Centro de trabajo'], ['cargo', 'Cargo'], ['supervisor', 'Supervisor'], ['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['diaSemana', 'Día de la semana'], ['total', 'Total de la empresa']];
const TIEMPO = ['dia', 'semana', 'mes', 'diaSemana'];
// Informes de un clic: cada uno trae su periodo, para no armar filtros
const UN_CLIC = [
  { nombre: 'Tardanzas de la semana', agrupar: 'persona', metricas: ['tardanzas', 'minTarde', 'ausencias'], grafica: 'tardanzas', rapido: 'semana' },
  { nombre: 'Extras por obra', agrupar: 'centro', metricas: ['extras', 'extrasAprob', 'extrasPend', 'costo'], grafica: 'extras', rapido: 'quincena' },
  { nombre: 'Riesgo de fatiga', agrupar: 'persona', metricas: ['diasLargos', 'horasPromedio', 'horas', 'extras'], grafica: 'diasLargos', rapido: 'semana' },
  { nombre: 'Presupuesto contra lo real', agrupar: 'centro', metricas: ['horas', 'presHoras', 'presHorasPct', 'costo', 'presCosto', 'presCostoPct'], grafica: 'presHorasPct', rapido: 'mes' }
];
const PREDETERMINADAS = [
  { nombre: 'Horas por obra', agrupar: 'centro', metricas: ['horas', 'extras', 'personas', 'costo'], grafica: 'horas' },
  { nombre: 'Ausentismo por persona', agrupar: 'persona', metricas: ['ausencias', 'ausentismo', 'tardanzas', 'diasIncapacidad', 'diasPermiso'], grafica: 'ausencias' },
  { nombre: 'Extras por semana', agrupar: 'semana', metricas: ['extras', 'extrasAprob', 'extrasPend', 'horas'], grafica: 'extras' },
  { nombre: 'Puntualidad por día de la semana', agrupar: 'diaSemana', metricas: ['tardanzas', 'minTarde', 'ausencias'], grafica: 'tardanzas' },
  { nombre: 'Costo por mes', agrupar: 'mes', metricas: ['costo', 'horas', 'extras'], grafica: 'costo' },
  { nombre: 'Control de marcación', agrupar: 'persona', metricas: ['digitadas', 'fueraZona', 'incompletas', 'tardanzas'], grafica: 'digitadas' },
  { nombre: 'Revisión de supervisores', agrupar: 'supervisor', metricas: ['dias', 'revisados', 'noVino', 'novedades', 'sinAlmuerzo', 'ausencias'], grafica: 'revisados' }
];

const p2 = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export function rangoRapido(k) {
  const h = hoyISO(), d = new Date(h + 'T12:00:00'), w = (d.getDay() + 6) % 7, y = d.getFullYear(), m = d.getMonth();
  switch (k) {
    case 'semana': return { desde: sumarDias(h, -w), hasta: h };
    case 'semanaPasada': return { desde: sumarDias(h, -w - 7), hasta: sumarDias(h, -w - 1) };
    case 'quincena': return d.getDate() <= 15 ? { desde: iso(new Date(y, m, 1)), hasta: h } : { desde: iso(new Date(y, m, 16)), hasta: h };
    case 'mes': return { desde: iso(new Date(y, m, 1)), hasta: h };
    case 'mesPasado': return { desde: iso(new Date(y, m - 1, 1)), hasta: iso(new Date(y, m, 0)) };
    case '30': return { desde: sumarDias(h, -29), hasta: h };
    case 'trimestre': return { desde: sumarDias(h, -89), hasta: h };
    default: return null;
  }
}
const RAPIDOS = [['semana', 'Esta semana'], ['semanaPasada', 'Semana pasada'], ['quincena', 'Quincena actual'], ['mes', 'Este mes'], ['mesPasado', 'Mes pasado'], ['30', 'Últimos 30 días'], ['trimestre', 'Últimos 90 días']];

export const formato = (m, v) => v === null || v === undefined ? '—' : m.u === '$' ? pesos(v) : m.u === '%' ? `${v.toLocaleString('es-CO')} %` : m.u === 'h' ? `${v.toLocaleString('es-CO')} h` : m.u === 'min' ? `${v.toLocaleString('es-CO')} min` : v.toLocaleString('es-CO');
const etiquetaFila = (f, por) => por === 'dia' ? new Date(f.clave + 'T12:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
  : por === 'semana' ? 'Sem. ' + new Date(f.clave + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  : por === 'mes' ? (() => { const s = new Date(f.clave + '-15T12:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); })() : f.nombre;

/* ---------- Gráfica de una sola serie: barras finas, valor en la punta, detalle al pasar el puntero ---------- */
function Grafica({ filas, metrica, por }) {
  const [foco, setFoco] = useState(null), tiempo = TIEMPO.includes(por), datos = filas.slice(0, tiempo ? 62 : 15), max = Math.max(1, ...datos.map((f) => Math.abs(f[metrica.k] || 0)));
  if (!datos.length) return null;
  if (!tiempo) return <figure style={{ margin: 0 }} aria-label={`${metrica.t} por ${AGRUPAR.find((a) => a[0] === por)[1].toLowerCase()}`}>
    <figcaption className="etiqueta" style={{ marginBottom: 12 }}>{metrica.t}{filas.length > 15 && <span className="suave chico"> · los 15 mayores de {filas.length}</span>}</figcaption>
    <div className="pila junta" role="list">{datos.map((f) => <div key={f.clave} role="listitem" className="barra-fila" title={`${f.nombre}: ${formato(metrica, f[metrica.k])}`}>
      <span className="barra-rotulo">{etiquetaFila(f, por)}</span>
      <span className="barra-pista"><span className="barra" style={{ width: `${Math.max(0.5, (Math.abs(f[metrica.k] || 0) / max) * 100)}%` }} /></span>
      <span className="barra-valor num">{formato(metrica, f[metrica.k])}</span></div>)}</div></figure>;
  const n = datos.length, ancho = 640, alto = 200, pad = 28, paso = (ancho - pad) / n, bw = Math.max(3, Math.min(28, paso - 4));
  const marcas = [0, 0.5, 1].map((x) => x * max);
  return <figure style={{ margin: 0 }} aria-label={`${metrica.t} por ${AGRUPAR.find((a) => a[0] === por)[1].toLowerCase()}`}>
    <figcaption className="etiqueta" style={{ marginBottom: 8 }}>{metrica.t}</figcaption>
    <div style={{ position: 'relative' }} onMouseLeave={() => setFoco(null)}>
      <svg viewBox={`0 0 ${ancho} ${alto + 34}`} width="100%" role="img" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
        {marcas.map((v, i) => { const y = alto - (v / max) * (alto - 10); return <g key={i}><line x1={pad} x2={ancho} y1={y} y2={y} stroke="var(--c-borde)" strokeWidth="1" strokeDasharray={i ? '3 4' : undefined} /><text x={pad - 6} y={y + 4} textAnchor="end" fontSize="11" fill="var(--c-texto-2)">{metrica.u === '$' ? (v >= 1e6 ? Math.round(v / 1e5) / 10 + ' M' : Math.round(v / 1e3) + ' k') : Math.round(v * 10) / 10}</text></g>; })}
        {datos.map((f, i) => { const v = Math.abs(f[metrica.k] || 0), h = (v / max) * (alto - 10), x = pad + i * paso + (paso - bw) / 2;
          return <g key={f.clave}>
            <rect x={pad + i * paso} y={0} width={paso} height={alto} fill="transparent" onMouseEnter={() => setFoco(i)} onTouchStart={() => setFoco(i)} />
            <path d={h < 1 ? `M${x},${alto}h${bw}` : `M${x},${alto}v${-(h - Math.min(4, h))}q0,-${Math.min(4, h)} ${Math.min(4, bw / 2)},-${Math.min(4, h)}h${bw - 2 * Math.min(4, bw / 2)}q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, h)}v${h - Math.min(4, h)}z`} fill={foco === i ? 'var(--c-primario-fuerte)' : 'var(--c-primario)'} stroke={h < 1 ? 'var(--c-borde-fuerte)' : 'none'} pointerEvents="none" />
            {(n <= 12 || i % Math.ceil(n / 12) === 0) && <text x={x + bw / 2} y={alto + 16} textAnchor="middle" fontSize="11" fill="var(--c-texto-2)">{etiquetaFila(f, por).replace('Sem. ', '')}</text>}
          </g>; })}
      </svg>
      {foco !== null && <div className="tooltip-grafica" style={{ left: `${((pad + foco * paso + paso / 2) / ancho) * 100}%` }} role="status"><strong>{etiquetaFila(datos[foco], por)}</strong><br />{formato(metrica, datos[foco][metrica.k])}</div>}
    </div></figure>;
}

/* ---------- Pantalla de informes ---------- */
const VISTAS = 'cj.informes.vistas';
export default function Informes({ soloVer }) {
  const [rapido, setRapido] = useState('mes'), [r, setR] = useState(() => rangoRapido('mes')), [por, setPor] = useState('centro'), [filtros, setFiltros] = useState({ centros: [], cargos: [], cedulas: [] });
  const [metricas, setMetricas] = useState(['horas', 'extras', 'personas', 'costo']), [graf, setGraf] = useState('horas'), [vista, setVista] = useState('ambas'), [verFiltros, setVerFiltros] = useState(false), [verMetricas, setVerMetricas] = useState(false);
  const [guardadas, setGuardadas] = useState(() => guardado.leer(VISTAS, [])), [orden, setOrden] = useState(null), [correr, ocupado] = useAccion();
  const carga = useCarga(() => api('adminInforme', { ...r, agrupar: por, filtros }, { espera: 120000 }), [r.desde, r.hasta, por, JSON.stringify(filtros)]);
  const disponibles = METRICAS.filter((m) => !m.costo || !soloVer), cols = disponibles.filter((m) => metricas.includes(m.k)), mg = disponibles.find((m) => m.k === graf) || cols[0] || disponibles[0];
  const nFiltros = filtros.centros.length + filtros.cargos.length + filtros.cedulas.length;
  const aplicar = (v) => { setPor(v.agrupar); setMetricas(v.metricas.filter((k) => disponibles.some((m) => m.k === k))); setGraf(v.grafica); if (v.filtros) setFiltros(v.filtros); if (v.rapido && rangoRapido(v.rapido)) { setRapido(v.rapido); setR(rangoRapido(v.rapido)); } };
  const [nombreV, setNombreV] = useState(null);
  const guardarVista = () => { const nombre = (nombreV || '').trim().slice(0, 40); if (!nombre) return; const l = [...guardadas.filter((x) => x.nombre !== nombre), { nombre, agrupar: por, metricas, grafica: graf, filtros, rapido }]; setGuardadas(l); guardado.poner(VISTAS, l); setNombreV(null); };
  const filasOrd = useMemo(() => { const l = carga.datos?.filas || []; if (!orden) return l; return [...l].sort((a, b) => ((a[orden.k] ?? -1) - (b[orden.k] ?? -1)) * orden.d || 0); }, [carga.datos, orden]);
  const totales = useMemo(() => { const l = carga.datos?.filas || [], t = {}; cols.forEach((m) => {
    if (m.k === 'personas') t[m.k] = carga.datos?.personasConActividad ?? null;
    else if (m.k === 'horasPromedio') { const d = l.reduce((s, x) => s + x.dias, 0); t[m.k] = d ? Math.round(l.reduce((s, x) => s + x.horas, 0) / d * 10) / 10 : 0; }
    else if (m.k === 'ausentismo') { const a = l.reduce((s, x) => s + x.ausencias, 0), d = l.reduce((s, x) => s + x.dias, 0); t[m.k] = a + d ? Math.round(a * 1000 / (a + d)) / 10 : 0; }
    else t[m.k] = m.costo && soloVer ? null : Math.round(l.reduce((s, x) => s + (x[m.k] || 0), 0) * 10) / 10; }); return t; }, [carga.datos, metricas]); // eslint-disable-line
  const nombrePor = AGRUPAR.find((a) => a[0] === por)[1];
  const exportar = (csv) => correr(async () => {
    const filas = filasOrd.map((f) => Object.fromEntries([[nombrePor, etiquetaFila(f, por)], ...cols.map((m) => [m.t + (m.u && m.u !== '$' ? ` (${m.u})` : ''), f[m.k]])]));
    filas.push(Object.fromEntries([[nombrePor, 'TOTAL'], ...cols.map((m) => [m.t + (m.u && m.u !== '$' ? ` (${m.u})` : ''), totales[m.k]])]));
    const nombre = `informe-${por}-${r.desde}-a-${r.hasta}`;
    if (!csv) return aExcel({ Informe: filas, Filtros: [{ Desde: r.desde, Hasta: r.hasta, 'Agrupado por': nombrePor, Centros: filtros.centros.map((id) => carga.datos?.opciones.centros.find((c) => c.id === id)?.nombre).join(', ') || 'Todos', Cargos: filtros.cargos.join(', ') || 'Todos', Personas: filtros.cedulas.length || 'Todas', 'Factor prestacional %': carga.datos?.factorPrestacional }] }, nombre + '.xlsx');
    const enc = Object.keys(filas[0]), cel = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + [enc.join(';')].concat(filas.map((f) => enc.map((k) => cel(f[k])).join(';'))).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = nombre + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }, 'Informe descargado.');
  const cambiarRango = (k) => { setRapido(k); const x = rangoRapido(k); if (x) setR(x); };

  return <><Titulo t="Informes" accion={<><Boton variante="secundario" icono={Download} cargando={ocupado} disabled={!carga.datos?.filas.length} onClick={() => exportar(false)}>Excel</Boton><Boton variante="secundario" icono={Download} disabled={!carga.datos?.filas.length} onClick={() => exportar(true)}>CSV</Boton></>}>
    Arma el resumen que necesites: cualquier rango de hasta 90 días, agrupado como quieras, con las mismas reglas de la nómina.</Titulo>

    <div className="pila" style={{ marginBottom: 16 }}>
      <div className="un-clic" role="group" aria-label="Informes de un clic">{UN_CLIC.map((v) => <button key={v.nombre} type="button" className="tarjeta-clic" onClick={() => aplicar(v)}><strong>{v.nombre}</strong><span className="suave chico">{RAPIDOS.find((x) => x[0] === v.rapido)?.[1]}</span></button>)}</div>
      <div className="fila" role="group" aria-label="Informes listos">{PREDETERMINADAS.map((v) => <Boton key={v.nombre} chico variante="secundario" onClick={() => aplicar(v)}>{v.nombre}</Boton>)}
        {guardadas.map((v) => <span key={v.nombre} className="fila" style={{ gap: 0 }}><Boton chico variante="secundario" icono={Bookmark} onClick={() => aplicar(v)}>{v.nombre}</Boton><Boton chico variante="texto" aria-label={`Borrar el informe guardado ${v.nombre}`} onClick={() => { const l = guardadas.filter((x) => x.nombre !== v.nombre); setGuardadas(l); guardado.poner(VISTAS, l); }}><X size={14} /></Boton></span>)}</div>
      <div className="filtros-informe">
        <Campo como="select" etiqueta="Periodo" value={rapido} onChange={(e) => cambiarRango(e.target.value)}>{RAPIDOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}<option value="otro">Otras fechas…</option></Campo>
        {rapido === 'otro' && <><Campo etiqueta="Desde" type="date" value={r.desde} onChange={(e) => setR({ ...r, desde: e.target.value })} /><Campo etiqueta="Hasta" type="date" min={r.desde} max={sumarDias(r.desde, 92)} value={r.hasta} onChange={(e) => setR({ ...r, hasta: e.target.value })} /></>}
        <Campo como="select" etiqueta="Agrupar por" value={por} onChange={(e) => { setPor(e.target.value); setOrden(null); }} opciones={AGRUPAR.map(([v, t]) => ({ v, t }))} />
        <Campo como="select" etiqueta="Gráfica de" value={mg.k} onChange={(e) => { setGraf(e.target.value); if (!metricas.includes(e.target.value)) setMetricas([...metricas, e.target.value]); }} opciones={disponibles.map((m) => ({ v: m.k, t: m.t }))} />
        <div className="fila" style={{ alignSelf: 'flex-end' }}>
          <Boton variante="secundario" icono={Filter} onClick={() => setVerFiltros(true)}>Filtros{nFiltros ? ` (${nFiltros})` : ''}</Boton>
          <Boton variante="secundario" icono={Table2} onClick={() => setVerMetricas(true)}>Columnas ({cols.length})</Boton>
          <Boton variante="texto" icono={Bookmark} onClick={() => setNombreV('')}>Guardar este informe</Boton>
        </div>
      </div>
      {nFiltros > 0 && <div className="fila">{filtros.centros.map((id) => <Insignia key={id} tono="info">{carga.datos?.opciones.centros.find((c) => c.id === id)?.nombre || 'Centro'}</Insignia>)}{filtros.cargos.map((c) => <Insignia key={c} tono="info">{c === '-' ? 'Sin cargo' : c}</Insignia>)}{filtros.cedulas.length > 0 && <Insignia tono="info">{filtros.cedulas.length} persona(s)</Insignia>}
        <Boton chico variante="texto" icono={Trash2} onClick={() => setFiltros({ centros: [], cargos: [], cedulas: [] })}>Quitar filtros</Boton></div>}
    </div>

    {por === 'centro' && metricas.some((k) => k.startsWith('pres')) && carga.datos && !carga.datos.filas.some((f) => f.presHoras || f.presCosto) && <Aviso tono="info">Ninguna obra tiene presupuesto. Escríbelo en «Obras y sedes» → Editar (horas y costo al mes) y este informe lo compara con lo real.</Aviso>}
    <Estado carga={carga} lineas={8}>{(d) => d.filas.length === 0 ? <Vacio icono={BarChart3} titulo="Sin datos para mostrar">No hay actividad con esos filtros en el rango elegido. Prueba otro periodo o quita filtros.</Vacio> : <div className="pila amplia">
      <div className="indicadores">{cols.slice(0, 6).map((m) => <div key={m.k} className="indicador"><span className="valor" style={{ fontSize: m.u === '$' ? 'var(--t-5)' : undefined }}>{formato(m, totales[m.k])}</span><span className="rotulo">{m.t}{m.prom ? ' (promedio)' : ''}</span></div>)}</div>
      {d.corte < d.hasta && <p className="suave chico">Datos hasta hoy ({d.corte}).</p>}
      {mg.costo && d.factorPrestacional === 0 && !soloVer && <Aviso>El costo es el devengado (salario, recargos, extras, auxilio y bonos). Para incluir prestaciones y aportes del empleador, pon el factor prestacional en Configuración → Reglas.</Aviso>}
      {por !== 'total' && <div className="fila" role="radiogroup" aria-label="Qué mostrar">{[['ambas', 'Gráfica y tabla'], ['grafica', 'Solo gráfica'], ['tabla', 'Solo tabla']].map(([k, t]) => <Boton key={k} chico variante={vista === k ? 'primario' : 'secundario'} aria-pressed={vista === k} onClick={() => setVista(k)}>{t}</Boton>)}</div>}
      {por !== 'total' && vista !== 'tabla' && <Tarjeta><Grafica filas={TIEMPO.includes(por) ? d.filas : [...d.filas].sort((a, b) => (b[mg.k] || 0) - (a[mg.k] || 0))} metrica={mg} por={por} /></Tarjeta>}
      {(vista !== 'grafica' || por === 'total') && <div className="tabla-caja"><table className="tabla apilable">
        <thead><tr><th scope="col">{nombrePor}</th>{cols.map((m) => <th key={m.k} scope="col" className="derecha" aria-sort={orden?.k === m.k ? (orden.d > 0 ? 'ascending' : 'descending') : undefined}><button onClick={() => setOrden((o) => (o?.k === m.k ? { k: m.k, d: -o.d } : { k: m.k, d: -1 }))}>{m.t}</button></th>)}</tr></thead>
        <tbody>{filasOrd.map((f) => <tr key={f.clave}><td data-t={nombrePor}><strong>{etiquetaFila(f, por)}</strong></td>{cols.map((m) => <td key={m.k} data-t={m.t} className="derecha num">{formato(m, f[m.k])}</td>)}</tr>)}</tbody>
        {filasOrd.length > 1 && <tfoot><tr className="fila-total"><td data-t={nombrePor}><strong>Total</strong></td>{cols.map((m) => <td key={m.k} data-t={m.t} className="derecha num"><strong>{formato(m, totales[m.k])}</strong></td>)}</tr></tfoot>}
      </table></div>}
    </div>}</Estado>

    <Hoja abierta={verFiltros} alCerrar={() => setVerFiltros(false)} titulo="Filtros" alto={0.85}>
      {carga.datos && <>
        <Seleccion titulo="Centros de trabajo" items={carga.datos.opciones.centros.map((c) => ({ v: c.id, t: c.nombre }))} sel={filtros.centros} setSel={(x) => setFiltros({ ...filtros, centros: x })} />
        <Seleccion titulo="Cargos" items={carga.datos.opciones.cargos.map((c) => ({ v: c, t: c === '-' ? 'Sin cargo' : c }))} sel={filtros.cargos} setSel={(x) => setFiltros({ ...filtros, cargos: x })} />
        <Seleccion titulo="Personas" buscar items={carga.datos.opciones.personas.map((p) => ({ v: p.cedula, t: p.nombre }))} sel={filtros.cedulas} setSel={(x) => setFiltros({ ...filtros, cedulas: x })} />
      </>}
      <p className="suave chico">Sin nada marcado en un grupo, se incluyen todos.</p>
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setFiltros({ centros: [], cargos: [], cedulas: [] })}>Limpiar</Boton><Boton onClick={() => setVerFiltros(false)}>Ver resultado</Boton></div>
    </Hoja>
    <Hoja abierta={nombreV !== null} alCerrar={() => setNombreV(null)} titulo="Guardar este informe" alto={0.45}>
      <Campo etiqueta="Nombre" placeholder="Ej.: Extras de la obra Funza" maxLength={40} value={nombreV || ''} onChange={(e) => setNombreV(e.target.value)} ayuda="Guarda la agrupación, columnas, filtros y periodo en este navegador." />
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setNombreV(null)}>Cancelar</Boton><Boton disabled={!(nombreV || '').trim()} onClick={guardarVista}>Guardar</Boton></div>
    </Hoja>
    <Hoja abierta={verMetricas} alCerrar={() => setVerMetricas(false)} titulo="Columnas del informe" alto={0.85}>
      <Seleccion titulo="Elige qué medir" items={disponibles.map((m) => ({ v: m.k, t: m.t }))} sel={metricas} setSel={(x) => { if (x.length) setMetricas(disponibles.filter((m) => x.includes(m.k)).map((m) => m.k)); }} />
      <div className="acciones-hoja"><Boton onClick={() => setVerMetricas(false)}>Listo</Boton></div>
    </Hoja></>;
}

function Seleccion({ titulo, items, sel, setSel, buscar }) {
  const [q, setQ] = useState(''), vis = items.filter((i) => !q || i.t.toLowerCase().includes(q.toLowerCase()));
  return <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="pila junta"><legend className="etiqueta">{titulo} {sel.length > 0 && <span className="suave chico">({sel.length})</span>}</legend>
    {buscar && <input className="entrada" type="search" placeholder="Buscar" aria-label={`Buscar en ${titulo}`} value={q} onChange={(e) => setQ(e.target.value)} />}
    <div className="chips">{vis.map((i) => { const on = sel.includes(i.v); return <button key={i.v} type="button" className="chip" aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== i.v) : [...sel, i.v])}>{i.t}</button>; })}</div></fieldset>;
}

