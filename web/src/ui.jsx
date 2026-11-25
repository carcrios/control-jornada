// Componentes base. Todos consumen los tokens de estilos.css y comparten estados:
// reposo, hover, foco visible, presionado, deshabilitado, cargando, error y vacío.
import { BotonDictar, dictadoDisponible, hablar } from './a11y.jsx';
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { BottomSheet, FluidTabs } from '@elizabthpazp/intera-ui';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Info, Search, WifiOff, X } from 'lucide-react';

export function useOscuro() {
  const [o, setO] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => { const m = window.matchMedia('(prefers-color-scheme: dark)'), f = (e) => setO(e.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return o;
}

export class Limite extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(e, i) { this.props.alFallar?.(e.message, (e.stack || '') + (i?.componentStack || '')); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="acceso"><div className="acceso-caja pila"><h1>La pantalla falló</h1><p className="suave">El error ya se envió al administrador. Tus marcaciones guardadas no se pierden.</p><Boton onClick={() => location.reload()}>Recargar la aplicación</Boton></div></div>;
  }
}

export function Boton({ variante = 'primario', cargando, icono: Icono, chico, ancho, children, className = '', disabled, ...p }) {
  return <button type="button" {...p} disabled={disabled || cargando} aria-busy={cargando || undefined} className={`btn ${variante} ${chico ? 'chico' : ''} ${ancho ? 'ancho' : ''} ${className}`}>
    {cargando ? <span className="giro" aria-hidden="true" /> : Icono ? <Icono size={chico ? 16 : 20} aria-hidden="true" /> : null}{children}
  </button>;
}

const TIPOS_DICTABLES = ['text', 'search', 'email', 'tel', 'url'];
// Textos usados antes en este equipo, para no escribir lo mismo otra vez
const recientes = (k) => { try { return JSON.parse(localStorage.getItem('cj.rec.' + k) || '[]'); } catch { return []; } };
export function recordarTexto(k, v) { const t = String(v || '').trim(); if (!k || t.length < 5) return; try { localStorage.setItem('cj.rec.' + k, JSON.stringify([t, ...recientes(k).filter((x) => x !== t)].slice(0, 6))); } catch { /* sin almacenamiento */ } }
export function Campo({ etiqueta, ayuda, error, como = 'input', opciones, children, className = '', sinDictado, recordar, ...p }) {
  const id = useId(), desc = [ayuda && id + 'a', error && id + 'e'].filter(Boolean).join(' ') || undefined;
  const comun = { id, className: 'entrada', 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': desc, ...p };
  // Dictado por voz en las casillas de texto (no en contraseñas, fechas, horas, archivos ni listas)
  const dictable = !sinDictado && dictadoDisponible && typeof p.onChange === 'function' && !p.disabled && !p.readOnly && p.value !== undefined
    && (como === 'textarea' || (como === 'input' && TIPOS_DICTABLES.includes(p.type || 'text')));
  const dictar = (v) => { let x = v; if (p.maxLength) x = x.slice(0, p.maxLength); p.onChange({ target: { value: x, name: p.name, type: p.type || 'text' }, currentTarget: { value: x } }); };
  const control = como === 'select' ? <select {...comun}>{opciones ? opciones.map((o) => <option key={o.v} value={o.v}>{o.t}</option>) : children}</select>
    : como === 'textarea' ? <textarea {...comun} /> : <input {...comun} />;
  const previos = recordar ? recientes(recordar).filter((x) => x !== p.value) : [];
  if (recordar) { const ob = p.onBlur; comun.onBlur = (e) => { recordarTexto(recordar, e.target.value); ob && ob(e); }; }
  return <div className={`campo ${className}`}>
    <label htmlFor={id}>{etiqueta}{p.required && <span aria-hidden="true"> *</span>}</label>
    {previos.length > 0 && !p.value && <div className="recientes" role="group" aria-label="Usados antes">{previos.slice(0, 4).map((x) => <button type="button" key={x} className="reciente" onClick={() => p.onChange({ target: { value: x, name: p.name }, currentTarget: { value: x } })}>{x.length > 48 ? x.slice(0, 46) + '…' : x}</button>)}</div>}
    {dictable ? <div className={`con-voz ${como === 'textarea' ? 'area' : ''}`}>{control}<BotonDictar valor={p.value} alCambiar={dictar} etiqueta={typeof etiqueta === 'string' ? etiqueta.toLowerCase() : ''} numerico={p.inputMode === 'numeric' || p.type === 'tel'} /></div> : control}
    {ayuda && <span className="ayuda" id={id + 'a'}>{ayuda}</span>}
    {error && <span className="error" id={id + 'e'} role="alert">{error}</span>}
  </div>;
}
export function Casilla({ children, ...p }) { return <label className="casilla"><input type="checkbox" {...p} /><span>{children}</span></label>; }
export function Tarjeta({ titulo, accion, children, className = '', ...p }) {
  return <section className={`tarjeta ${className}`} {...p}>{(titulo || accion) && <header><h2 style={{ fontSize: 'var(--t-4)' }}>{titulo}</h2>{accion}</header>}{children}</section>;
}
export const Insignia = ({ tono = '', children }) => <span className={`insignia ${tono ? 'i-' + tono : ''}`}>{children}</span>;
export function Aviso({ tono = 'info', children }) {
  const I = tono === 'ok' ? CheckCircle2 : tono === 'info' ? Info : AlertTriangle;
  return <div className={`aviso ${tono === 'aviso' ? 'aviso-a' : tono}`} role={tono === 'peligro' ? 'alert' : 'status'}><I size={20} aria-hidden="true" /><div className="crece">{children}</div></div>;
}
export const Vacio = ({ icono: I, titulo, children }) => <div className="vacio">{I && <I size={36} aria-hidden="true" />}<strong>{titulo}</strong>{children && <div style={{ maxWidth: '42ch' }}>{children}</div>}</div>;
export const Esqueleto = ({ lineas = 3, alto = 18 }) => <div className="pila junta" aria-hidden="true">{Array.from({ length: lineas }, (_, i) => <div key={i} className="esqueleto" style={{ height: alto, width: `${100 - (i % 3) * 14}%` }} />)}</div>;

/* ---------- Estados de carga de una consulta ---------- */
export function useCarga(fn, deps = []) {
  const [e, setE] = useState({ datos: null, cargando: true, error: null });
  const vivo = useRef(true), n = useRef(0);
  const recargar = useCallback(async (silencio) => {
    const turno = ++n.current; if (!silencio) setE((x) => ({ ...x, cargando: true, error: null }));
    try { const datos = await fn(); if (vivo.current && turno === n.current) setE({ datos, cargando: false, error: null }); }
    catch (error) { if (vivo.current && turno === n.current) setE((x) => ({ datos: silencio ? x.datos : null, cargando: false, error: silencio ? null : error })); }
  }, deps); // eslint-disable-line
  useEffect(() => { vivo.current = true; recargar(); return () => { vivo.current = false; }; }, [recargar]);
  return { ...e, recargar };
}
export function Estado({ carga, lineas = 5, children }) {
  if (carga.cargando && !carga.datos) return <div role="status" aria-live="polite"><span className="oculto-visual">Cargando…</span><Esqueleto lineas={lineas} /></div>;
  if (carga.error) return <Vacio icono={carga.error.cod === 'RED' ? WifiOff : AlertTriangle} titulo={carga.error.cod === 'RED' ? 'Sin conexión' : 'No se pudo cargar'}><p>{carga.error.message}</p><Boton variante="secundario" onClick={() => carga.recargar()}>Reintentar</Boton></Vacio>;
  return <div aria-busy={carga.cargando || undefined} style={{ opacity: carga.cargando ? .6 : 1, transition: 'opacity var(--d-media)' }}>{children(carga.datos)}</div>;
}

/* ---------- Avisos flotantes ---------- */
const CtxAvisos = createContext(null);
export const useAvisos = () => useContext(CtxAvisos);
export function Avisos({ children }) {
  const [l, setL] = useState([]);
  const quitar = useCallback((id) => setL((x) => x.filter((a) => a.id !== id)), []);
  const api = useMemo(() => {
    const poner = (tono, texto, ms) => { const id = Math.random(); hablar(texto); setL((x) => [...x.slice(-2), { id, tono, texto }]); setTimeout(() => quitar(id), ms || (tono === 'error' ? 9000 : 4500)); };
    return { ok: (t, ms) => poner('ok', t, ms), error: (t, ms) => poner('error', t?.message || t, ms), info: (t, ms) => poner('', t, ms) };
  }, [quitar]);
  return <CtxAvisos.Provider value={api}>{children}
    <div className="avisos-flotantes" aria-live="assertive">{l.map((a) => <div key={a.id} className={`flotante ${a.tono}`} role={a.tono === 'error' ? 'alert' : 'status'}><span className="crece">{a.texto}</span>
      <button onClick={() => quitar(a.id)} aria-label="Cerrar aviso" style={{ all: 'unset', cursor: 'pointer', display: 'grid', placeItems: 'center', width: 28, height: 28 }}><X size={18} /></button></div>)}</div>
  </CtxAvisos.Provider>;
}

/* ---------- Hoja inferior (InteraUI BottomSheet) con foco y Escape ---------- */
export function Hoja({ abierta, alCerrar, titulo, alto = 0.88, children }) {
  const oscuro = useOscuro(), ref = useRef(null), previo = useRef(null);
  useEffect(() => {
    if (!abierta) return;
    previo.current = document.activeElement;
    const t = setTimeout(() => { const el = ref.current?.querySelector('input, select, textarea, button'); el?.focus({ preventScroll: true }); }, 250);
    const tecla = (e) => { if (e.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => { clearTimeout(t); document.removeEventListener('keydown', tecla); previo.current?.focus?.(); };
  }, [abierta]); // eslint-disable-line
  return <BottomSheet open={abierta} onOpenChange={(v) => { if (!v) alCerrar(); }} title={titulo} darkMode={oscuro} snapPoints={[alto]} className="hoja-iu">
    <div ref={ref} role="dialog" aria-modal="true" aria-label={titulo} className="hoja-cuerpo">{children}</div>
  </BottomSheet>;
}
export function Confirmar({ abierta, titulo, children, texto = 'Confirmar', variante = 'primario', alConfirmar, alCerrar, cargando }) {
  return <Hoja abierta={abierta} alCerrar={alCerrar} titulo={titulo} alto={0.5}><div>{children}</div>
    <div className="acciones-hoja"><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton variante={variante} cargando={cargando} onClick={alConfirmar}>{texto}</Boton></div></Hoja>;
}
export function Pestanas({ opciones, valor, alCambiar, etiqueta }) {
  const oscuro = useOscuro();
  return <div className="pestanas" role="navigation" aria-label={etiqueta}><FluidTabs tabs={opciones.map((o) => ({ id: o.v, label: o.t }))} activeTab={valor} onChange={alCambiar} darkMode={oscuro} /></div>;
}

/* ---------- Tabla: buscar, ordenar, paginar; en celular cada fila se vuelve ficha ---------- */
export function Tabla({ columnas, filas, clave = (f, i) => i, buscar = true, porPagina = 25, vacio = 'No hay registros para mostrar.', extra }) {
  const [q, setQ] = useState(''), [orden, setOrden] = useState(null), [pag, setPag] = useState(0);
  const lista = useMemo(() => {
    let l = filas || [];
    if (q) { const t = q.toLowerCase(); l = l.filter((f) => columnas.some((c) => String(c.texto ? c.texto(f) : f[c.k] ?? '').toLowerCase().includes(t))); }
    if (orden) { const c = columnas.find((x) => x.k === orden.k), v = (f) => (c.valor ? c.valor(f) : f[c.k]); l = [...l].sort((a, b) => { const x = v(a), y = v(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'es', { numeric: true })) * orden.d; }); }
    return l;
  }, [filas, q, orden, columnas]);
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina)), p = Math.min(pag, paginas - 1), vis = lista.slice(p * porPagina, (p + 1) * porPagina);
  return <div className="pila junta">
    {(buscar || extra) && <div className="fila">{buscar && <div className="crece" style={{ position: 'relative', minWidth: 180 }}><Search size={18} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 15, color: 'var(--c-texto-2)' }} />
      <div className="con-voz"><input className="entrada" style={{ paddingLeft: 38 }} type="search" placeholder="Buscar…" aria-label="Buscar en la tabla" value={q} onChange={(e) => { setQ(e.target.value); setPag(0); }} /><BotonDictar valor={q} alCambiar={(v) => { setQ(v); setPag(0); }} etiqueta="la búsqueda" /></div></div>}{extra}</div>}
    <div className="tabla-caja">
      {vis.length === 0 ? <Vacio titulo={q ? 'Sin coincidencias' : 'Nada por aquí'}>{q ? `Ningún registro contiene “${q}”.` : vacio}</Vacio> :
        <table className="tabla apilable"><thead><tr>{columnas.map((c) => <th key={c.k} scope="col" className={c.num ? 'derecha' : ''} aria-sort={orden?.k === c.k ? (orden.d > 0 ? 'ascending' : 'descending') : undefined}>
          {c.orden === false || !c.t ? c.t : <button onClick={() => setOrden((o) => (o?.k === c.k ? { k: c.k, d: -o.d } : { k: c.k, d: 1 }))}>{c.t}{orden?.k === c.k && (orden.d > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}</button>}</th>)}</tr></thead>
          <tbody>{vis.map((f, i) => <tr key={clave(f, i)}>{columnas.map((c) => <td key={c.k} data-t={c.t} className={`${c.num ? 'derecha num' : ''} ${c.acciones ? 'acciones' : ''}`}>{c.render ? c.render(f) : f[c.k]}</td>)}</tr>)}</tbody></table>}
      {lista.length > porPagina && <div className="tabla-pie"><span>{p * porPagina + 1}–{Math.min(lista.length, (p + 1) * porPagina)} de {lista.length}</span>
        <span className="fila"><Boton chico variante="secundario" icono={ChevronLeft} disabled={p === 0} onClick={() => setPag(p - 1)} aria-label="Página anterior" /><span>Página {p + 1} de {paginas}</span><Boton chico variante="secundario" icono={ChevronRight} disabled={p >= paginas - 1} onClick={() => setPag(p + 1)} aria-label="Página siguiente" /></span></div>}
    </div>
  </div>;
}

/* ---------- Formulario con estado ---------- */
export function useForm(inicial) {
  const [v, setV] = useState(inicial);
  const campo = (k, tipo) => ({ value: v[k] ?? '', onChange: (e) => setV((x) => ({ ...x, [k]: tipo === 'check' ? e.target.checked : e.target.value })), ...(tipo === 'check' ? { checked: !!v[k], value: undefined } : {}) });
  return [v, campo, setV];
}
