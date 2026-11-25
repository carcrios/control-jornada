import { Asistente, RevisionImportacion, SelectorPlantilla, leerExcelPersonas, plantillaExcel } from './Arranque.jsx';
import { IconoRevision, RevisionDia, UbicarObras } from './Supervisor.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { AlarmClock, BellRing, Building2, CalendarCheck, ClipboardList, Download, FileSpreadsheet, HeartPulse, Image, LayoutDashboard, LogOut, MapPin, Pencil, Plus, RefreshCw, Settings, Stethoscope, Timer, Upload, Users, Wallet, KeyRound, LocateFixed, CalendarClock, BarChart3, Copy, MessageCircle, Search, ChevronDown, Sparkles, HelpCircle, Zap, Send, ClockAlert } from 'lucide-react';
import { api, conexion } from './api.js';
import { Aviso, Boton, Campo, Casilla, Confirmar, Estado, Hoja, Insignia, Tabla, Tarjeta, Vacio, useAvisos, useCarga, useForm } from './ui.jsx';
import { NOMBRE_TIPO, TIPOS, fechaCorta, fechaHora, horas, hoyISO, pesos, sumarDias, ubicar, saludo } from './util.js';
import Informes from './Informes.jsx';
import Guia, { ConsultasAdmin } from './Guia.jsx';
import { Permisos, Extras, Incapacidades, Nomina, Obras, Alertas, Config, Sistema, Turnos } from './Admin2.jsx';
import { ActivarKiosco, BandaLicencia, Comunicados, EnVivo, Expediente, Prestamos, QrObra, moduloActivo } from './Modulos.jsx';
import { Activity, ArrowRightLeft, Landmark as Banco, Megaphone, QrCode, Smartphone, Tablet, UserX, FolderOpen } from 'lucide-react';
// Tablero y menú piden lo mismo al entrar: una sola llamada compartida por 5 s
let _tab = null;
function tableroCompartido() { if (!_tab || Date.now() - _tab.t > 5000) _tab = { t: Date.now(), p: api('adminTablero').catch((e) => { _tab = null; throw e; }) }; return _tab.p; }

export const periodoActual = (tipo) => { const h = hoyISO(), ym = h.slice(0, 8), d = +h.slice(8), fin = new Date(+h.slice(0, 4), +h.slice(5, 7), 0).getDate();
  return tipo === 'mensual' ? { desde: ym + '01', hasta: ym + fin } : d <= 15 ? { desde: ym + '01', hasta: ym + '15' } : { desde: ym + '16', hasta: ym + fin }; };
export function Rango({ r, setR }) {
  return <div className="fila"><Campo etiqueta="Desde" type="date" value={r.desde} onChange={(e) => setR({ ...r, desde: e.target.value })} /><Campo etiqueta="Hasta" type="date" value={r.hasta} min={r.desde} onChange={(e) => setR({ ...r, hasta: e.target.value })} /></div>;
}
export async function aExcel(hojas, nombre) {
  const XLSX = await import('xlsx'), libro = XLSX.utils.book_new();
  Object.keys(hojas).forEach((h) => { const filas = hojas[h]; if (!Array.isArray(filas)) return; const ws = XLSX.utils.json_to_sheet(filas.length ? filas : [{ 'Sin registros': '' }]);
    ws['!cols'] = Object.keys(filas[0] || { a: 1 }).map((k) => ({ wch: Math.min(40, Math.max(k.length + 2, ...filas.slice(0, 200).map((f) => String(f[k] ?? '').length + 2))) })); XLSX.utils.book_append_sheet(libro, ws, h.slice(0, 31)); });
  XLSX.writeFile(libro, nombre);
}
export function useAccion() {
  const avisos = useAvisos(), [ocupado, setO] = useState(false);
  const correr = async (fn, ok) => { setO(true); try { const r = await fn(); if (ok) avisos.ok(ok); return r === undefined ? true : r; } catch (e) { avisos.error(e); return false; } finally { setO(false); } };
  return [correr, ocupado];
}
export const Titulo = ({ t, children, accion }) => <div className="titulo-pagina"><div><h1>{t}</h1>{children && <p>{children}</p>}</div>{accion && <div className="fila no-imprimir">{accion}</div>}</div>;

/* ---------- Tablero ---------- */
const EST = { presente: ['Trabajando', 'ok'], almuerzo: ['En almuerzo', 'info'], salio: ['Ya salió', ''], ausente: ['No se presentó', 'peligro'], por_llegar: ['Por llegar', ''], permiso: ['En permiso', 'info'], incapacidad: ['Incapacidad', 'info'], descanso: ['Descanso', ''] };
function RelojPanel() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 15000); return () => clearInterval(i); }, []);
  return <span className="reloj-panel" role="timer" aria-label="Hora actual">{t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>;
}
function GraficaObras({ personas }) {
  const SERIES = [['trabajando', 'Trabajando', 'var(--c-ok)', 'var(--c-superficie)'], ['tarde', 'Llegaron tarde (ya están)', 'var(--c-acento)', 'var(--c-sobre-acento)'], ['ausente', 'No se presentaron', 'var(--c-peligro)', 'var(--c-superficie)'], ['otro', 'Por llegar, salieron o con novedad', 'var(--c-borde-fuerte)', 'var(--c-texto)']];
  const g = {}; personas.forEach((p) => { const o = p.centro || 'Sin obra', x = g[o] || (g[o] = { trabajando: 0, tarde: 0, ausente: 0, otro: 0, total: 0 });
    const k = p.tarde > 0 && ['presente', 'almuerzo', 'salio'].includes(p.estado) ? 'tarde' : ['presente', 'almuerzo'].includes(p.estado) ? 'trabajando' : p.estado === 'ausente' ? 'ausente' : 'otro'; x[k]++; x.total++; });
  const filas = Object.entries(g).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  if (filas.length < 1) return null;
  return <Tarjeta titulo="Cómo va cada obra hoy">
    <div className="leyenda">{SERIES.map(([k, t, c]) => <span key={k}><i style={{ background: c }} aria-hidden="true" />{t}</span>)}</div>
    <div className="obras-barras">{filas.map(([o, x]) => <div key={o} className="obra-fila">
      <span className="obra-nombre">{o}</span>
      <div className="obra-barra" role="img" aria-label={`${o}: ${x.trabajando} trabajando, ${x.tarde} tarde, ${x.ausente} ausentes, ${x.otro} otros, de ${x.total}`}>
        {SERIES.map(([k, t, c, tc]) => x[k] > 0 && <span key={k} title={`${t}: ${x[k]}`} style={{ flexGrow: x[k], background: c, color: tc }}>{x[k]}</span>)}</div>
      <span className="obra-total">{x.total}</span></div>)}</div>
  </Tarjeta>;
}
function Tablero({ ir, yo }) {
  const carga = useCarga(() => tableroCompartido(), []), [filtro, setFiltro] = useState('');
  useEffect(() => { const i = setInterval(() => { if (document.visibilityState === 'visible') carga.recargar(true); }, 120000); return () => clearInterval(i); }, []); // eslint-disable-line
  return <><Titulo t={`${saludo()}, ${(yo?.usuario?.nombre || '').split(' ')[0]}`} accion={<span className="fila" style={{ gap: 12 }}><RelojPanel /><Boton variante="secundario" icono={RefreshCw} cargando={carga.cargando} onClick={() => carga.recargar()}>Actualizar</Boton></span>}>Así va la empresa hoy: quién está, quién falta y qué espera tu decisión.</Titulo>
    <Estado carga={carga} lineas={8}>{(d) => { const c = d.cuenta, p = d.pendientes, at = d.atender || {}, pend = [
        ['ausente', at.noHanMarcado, 'no han marcado entrada hoy', null, 'Ver quiénes', 'peligro'],
        ['ayer', at.ayerSinSalida, `no marcaron salida ayer${at.ayerSinSalidaNombres?.length ? ': ' + at.ayerSinSalidaNombres.join(', ') : ''}`, 'revision', 'Revisar', 'peligro'],
        ['revisar', p.revisar, 'marcación(es) digitadas, tardías o fuera de la obra por revisar', 'marcaciones', 'Revisar', 'aviso'],
        ['permisos', p.permisos, 'permiso(s) por aprobar', 'permisos', 'Decidir', 'aviso'],
        ['dudas', at.dudas, 'duda(s) de nómina de trabajadores por responder', 'guia', 'Responder', 'aviso'],
        ['extras', p.extras, 'registro(s) de horas extra por aprobar', 'extras', 'Decidir', 'aviso'],
        ['sinAlm', at.sinAlmuerzo, 'jornada(s) sin almuerzo por aprobar', 'extras', 'Decidir', 'aviso'],
        ['fatiga', at.fatiga, 'alerta(s) de fatiga desde ayer (jornadas muy largas)', 'alertas', 'Ver', 'peligro'],
        ['sinRev', at.sinRevisarAyer, 'jornada(s) de ayer sin revisión del supervisor', 'revision', 'Revisar', 'info'],
        ['usuarios', p.usuarios, 'persona(s) nuevas por aprobar', 'personal', 'Aprobar', 'aviso'], ['salarios', p.salarios, 'salario(s) sin validar', 'personal', 'Validar', 'info']].filter((x) => x[1] > 0);
      return <div className="pila amplia">
        <p className="suave">{new Date(d.fecha + 'T12:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{d.festivo ? ' · festivo' : ''}</p>
        {d.pasos && !Object.values(d.pasos).every(Boolean) && <Tarjeta titulo="Primeros pasos" accion={<span className="suave chico">{Object.values(d.pasos).filter(Boolean).length} de 6</span>}>
          <p className="suave chico" style={{ marginBottom: 8 }}>Completa esto una vez y la aplicación queda lista para tu personal.</p>
          <ol className="lista tocable" style={{ paddingLeft: 0 }}>{[['empresa', 'Pon el nombre, NIT y logo de la empresa', 'config'], ['centros', 'Crea las obras o sedes con su horario y ubicación', 'centros'], ['alertas', 'Escribe el correo que recibe las alertas', 'alertas'],
            ['jefes', 'Agrega los jefes que firman los permisos', 'config'], ['personal', 'Carga el personal (uno a uno o desde Excel)', 'personal'], ['activos', 'Comparte el enlace: al menos una persona activó su cuenta', 'personal']].map(([k, t, v], i) =>
            <li key={k}><button onClick={() => ir(v)}><span className="insignia" style={d.pasos[k] ? { background: 'var(--c-ok-suave)', color: 'var(--c-ok)' } : undefined} aria-hidden="true">{d.pasos[k] ? '✓' : i + 1}</span><span className="crece" style={d.pasos[k] ? { textDecoration: 'line-through', color: 'var(--c-texto-2)' } : undefined}>{t}<span className="oculto-visual">{d.pasos[k] ? ' (hecho)' : ' (pendiente)'}</span></span>{!d.pasos[k] && <span className="suave chico">Ir</span>}</button></li>)}</ol>
        </Tarjeta>}
        <Tarjeta titulo="Qué necesito atender hoy" className="atender">{pend.length ? <ul className="lista tocable">{pend.map(([k, n, t, destino, acc, tono]) => <li key={k}><button onClick={() => (destino ? ir(destino) : setFiltro('ausente'))}><Insignia tono={tono}>{n}</Insignia><span className="crece">{t}</span><span className="chico" style={{ fontWeight: 650 }}>{acc} →</span></button></li>)}</ul>
          : <p className="fila" style={{ gap: 8 }}><span className="insignia" style={{ background: 'var(--c-ok)', color: 'var(--c-superficie)' }}>✓</span>Todo al día: no hay nada pendiente.</p>}</Tarjeta>
        <div className="indicadores" role="group" aria-label="Filtrar personal por estado">
          {[['presente', c.presente + c.almuerzo, 'Trabajando', 'ok'], ['ausente', c.ausente, 'No se presentaron', 'peligro'], ['tarde', c.tarde, 'Llegaron tarde', 'aviso'], ['por_llegar', c.por_llegar, 'Por llegar', ''], ['salio', c.salio, 'Ya salieron', ''], ['novedad', c.permiso + c.incapacidad, 'Permiso o incapacidad', 'info']].map(([k, v, t, tono]) =>
            <button key={k} className={`indicador n-${tono} ${v === 0 ? 'cero' : ['peligro', 'aviso'].includes(tono) ? 'atencion' : ''}`} aria-pressed={filtro === k} onClick={() => setFiltro(filtro === k ? '' : k)} title={filtro === k ? 'Quitar el filtro' : 'Ver solo estas personas'}><span className="valor">{v}</span><span className="rotulo">{t}</span>{filtro === k && <span className="chico">Filtrando ✕</span>}</button>)}
        </div>
        <GraficaObras personas={d.personas} />
        {p.enFirmas > 0 && <p className="suave chico">{p.enFirmas} permiso(s) están en manos de los jefes para firma.</p>}
        <Tabla columnas={[{ k: 'nombre', t: 'Persona', render: (f) => <><strong>{f.nombre}</strong><div className="suave chico">{f.cargo}</div></> }, { k: 'centro', t: 'Centro de trabajo' },
          { k: 'estado', t: 'Estado', render: (f) => <span className="fila" style={{ gap: 4 }}><Insignia tono={EST[f.estado][1]}>{EST[f.estado][0]}</Insignia>{f.tarde > 0 && <Insignia tono="aviso">tarde {f.tarde} min</Insignia>}{f.fueraZona && <Insignia tono="peligro">fuera de zona</Insignia>}</span>, texto: (f) => EST[f.estado][0] },
          { k: 'entrada', t: 'Entrada', num: true }, { k: 'salida', t: 'Salida', num: true }]}
          filas={d.personas.filter((f) => !filtro || (filtro === 'tarde' ? f.tarde > 0 : filtro === 'presente' ? ['presente', 'almuerzo'].includes(f.estado) : filtro === 'novedad' ? ['permiso', 'incapacidad'].includes(f.estado) : f.estado === filtro))}
          clave={(f) => f.cedula} vacio="Aún no hay personal activo. Ve a «Personal» para cargarlo." />
      </div>; }}</Estado></>;
}

/* ---------- Personal ---------- */
const ESTADO_U = { activo: ['Activo', 'ok'], pendiente: ['Por aprobar', 'aviso'], preregistrado: ['Sin activar', 'info'], inactivo: ['Inactivo', ''] };
function Personal({ centros, yo, ir }) {
  const [acc, setAcc] = useState(null), [exp, setExp] = useState(null), [tras, setTras] = useState(null), carga = useCarga(() => api('adminPersonal'), []), [edit, setEdit] = useState(null), [codigo, setCodigo] = useState(null), [imp, setImp] = useState(null), [correr, ocupado] = useAccion();
  const nombreCentro = (id) => centros.find((c) => c.id === id)?.nombre || '—';
  const importar = async (e) => { const a = e.target.files[0]; e.target.value = ''; if (!a) return; setImp({ revision: await leerExcelPersonas(a, centros, carga.datos || []) }); };
  const confirmarImport = async (l) => { const r = await correr(() => api('adminPersonaImportar', { filas: l }, { espera: 120000 })); if (r) { setImp({ res: r }); carga.recargar(true); } };
  return <><Titulo t="Personal" accion={<><label className="btn secundario"><Upload size={20} aria-hidden="true" />Importar Excel<input type="file" accept=".xlsx,.xls,.csv" className="oculto-visual" onChange={importar} /></label><Boton variante="texto" icono={Download} onClick={plantillaExcel}>Plantilla</Boton><Boton variante="secundario" icono={ArrowRightLeft} onClick={() => setTras({ centroId: '', supervisor: '', sel: [] })}>Trasladar o asignar supervisor</Boton><Boton icono={Plus} onClick={() => setEdit({})}>Agregar persona</Boton></>}>Cada persona activa su cuenta con su cédula y un código de un solo uso que entregas tú.</Titulo>
    <Tarjeta className="hundida" style={{ marginBottom: 16 }}><div className="fila entre"><div className="crece" style={{ minWidth: 220 }}><strong>Enlace para tu personal</strong><div className="suave chico" style={{ wordBreak: 'break-all' }}>{conexion.enlace()}</div><div className="suave chico">Cada persona lo abre en su celular, entra con su cédula y su código de activación, y luego instala la aplicación.</div></div>
      <div className="fila"><Boton chico variante="secundario" icono={Copy} onClick={() => navigator.clipboard?.writeText(conexion.enlace())}>Copiar</Boton><a className="btn secundario chico" href={`https://wa.me/?text=${encodeURIComponent('Control de jornada. Abre este enlace en tu celular para registrar tu entrada y salida: ' + conexion.enlace())}`} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" />WhatsApp</a></div></div></Tarjeta>
    <Estado carga={carga} lineas={8}>{(l) => <Tabla columnas={[
      { k: 'nombre', t: 'Nombre', render: (u) => <><strong>{u.nombre}</strong><div className="suave chico">C.C. {u.cedula}{u.rol === 'admin' ? ' · administrador' : u.rol === 'supervisor' ? ' · supervisor' : ''}</div></>, texto: (u) => u.nombre + ' ' + u.cedula },
      { k: 'cargo', t: 'Cargo' }, { k: 'centroId', t: 'Centro', render: (u) => nombreCentro(u.centroId), texto: (u) => nombreCentro(u.centroId) }, { k: 'supervisor', t: 'Supervisor', render: (u) => { const sv = (carga.datos || []).find((x) => x.cedula === u.supervisor); return sv ? sv.nombre : <span className="suave">el de su obra</span>; }, texto: (u) => ((carga.datos || []).find((x) => x.cedula === u.supervisor) || {}).nombre || '' },
      { k: 'salario', t: 'Salario', num: true, render: (u) => <>{pesos(u.salario)}{!u.salarioOk && u.salario > 0 && <div><Insignia tono="aviso">sin validar</Insignia></div>}</> },
      { k: 'estado', t: 'Estado', render: (u) => <Insignia tono={ESTADO_U[u.estado]?.[1]}>{ESTADO_U[u.estado]?.[0] || u.estado}</Insignia>, texto: (u) => ESTADO_U[u.estado]?.[0] },
      { k: 'a', t: '', acciones: true, orden: false, render: (u) => <span className="fila fin" style={{ gap: 4 }}>{moduloActivo(yo, 'tablero360') && u.estado === 'activo' && <Boton chico variante="texto" icono={FolderOpen} onClick={() => setExp(u.cedula)}>Expediente</Boton>}<Boton chico variante="secundario" icono={Pencil} onClick={() => setEdit(u)}>Editar</Boton><Boton chico variante="texto" icono={Zap} aria-label={`Acciones rápidas para ${u.nombre}`} onClick={() => setAcc(u)}>Acciones</Boton></span> }]}
      filas={l} clave={(u) => u.cedula} vacio="Agrega la primera persona o importa la lista desde Excel." />}</Estado>
    <Expediente cedula={exp} alCerrar={() => setExp(null)} esAdmin={yo?.usuario?.rol === 'admin'} />
    <AccionesPersona persona={acc} alCerrar={() => setAcc(null)} ir={ir} verExp={moduloActivo(yo, 'tablero360') ? (c) => { setAcc(null); setExp(c); } : null} alEditar={(u) => { setAcc(null); setEdit(u); }} />
    <Hoja abierta={!!tras} alCerrar={() => setTras(null)} titulo="Trasladar o asignar supervisor" alto={0.9}>{tras && <>
      <div className="rejilla"><Campo como="select" etiqueta="Nueva obra" value={tras.centroId} onChange={(e) => setTras({ ...tras, centroId: e.target.value })} opciones={[{ v: '', t: '(no cambiar)' }, ...centros.map((c) => ({ v: c.id, t: c.nombre }))]} />
        <Campo como="select" etiqueta="Supervisor que los revisa" value={tras.supervisor || ''} onChange={(e) => setTras({ ...tras, supervisor: e.target.value })}
          opciones={[{ v: '', t: '(no cambiar)' }, { v: '-', t: 'El de su obra' }, ...(carga.datos || []).filter((u) => ['supervisor', 'admin'].includes(u.rol) && u.estado === 'activo').map((u) => ({ v: u.cedula, t: u.nombre }))]} /></div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="pila junta"><legend className="etiqueta">Personas ({tras.sel.length})</legend>
        <div style={{ maxHeight: 320, overflowY: 'auto' }} className="pila junta">{(carga.datos || []).filter((u) => u.estado === 'activo' && u.rol !== 'admin' && (!tras.centroId || u.centroId !== tras.centroId)).map((u) => <Casilla key={u.cedula} checked={tras.sel.includes(u.cedula)} onChange={(e) => setTras({ ...tras, sel: e.target.checked ? [...tras.sel, u.cedula] : tras.sel.filter((x) => x !== u.cedula) })}>{u.nombre} <span className="suave chico">· {nombreCentro(u.centroId)}</span></Casilla>)}</div></fieldset>
      <p className="suave chico">El cambio aplica desde hoy: los días ya trabajados conservan la obra donde se marcaron.</p>
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setTras(null)}>Cancelar</Boton><Boton cargando={ocupado} disabled={!tras.sel.length || (!tras.centroId && !tras.supervisor)} onClick={async () => { const r = await correr(() => api('adminTrasladoMasivo', { centroId: tras.centroId, supervisor: tras.supervisor || undefined, cedulas: tras.sel }), 'Cambios guardados.'); if (r) { setTras(null); carga.recargar(true); } }}>Aplicar a {tras.sel.length} persona(s)</Boton></div></>}</Hoja>
    <FormPersona yo={yo} persona={edit} centros={centros} supervisores={(carga.datos || []).filter((u) => ['supervisor', 'admin'].includes(u.rol) && u.estado === 'activo')} alCerrar={() => setEdit(null)} alGuardar={(r) => { setEdit(null); carga.recargar(true); if (r.codigo) setCodigo(r); }} />
    <Hoja abierta={!!codigo} alCerrar={() => setCodigo(null)} titulo="Código de activación" alto={0.55}>{codigo && <>
      <p>Entrega este código a <strong>{codigo.usuario?.nombre || 'la persona'}</strong>. Lo usa una sola vez, junto con su cédula, para crear su contraseña.</p>
      <div className="reloj" style={{ justifyContent: 'center', letterSpacing: '.12em', fontSize: '3.5rem' }} aria-label={`Código ${codigo.codigo.split('').join(' ')}`}>{codigo.codigo}</div>
      <Aviso tono="aviso">Anótalo ahora: por seguridad no se vuelve a mostrar. Si se pierde, genera uno nuevo desde «Editar».</Aviso>
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => navigator.clipboard?.writeText(codigo.codigo)}>Copiar</Boton><Boton onClick={() => setCodigo(null)}>Listo</Boton></div></>}</Hoja>
    <Hoja abierta={!!imp} alCerrar={() => setImp(null)} titulo={imp?.revision ? 'Revisa antes de importar' : 'Resultado de la importación'} alto={0.9}>{imp?.revision ? (imp.revision.error ? <><Aviso tono="peligro">{imp.revision.error}</Aviso><Boton variante="secundario" icono={Download} onClick={plantillaExcel}>Descargar plantilla de Excel</Boton></>
      : <RevisionImportacion datos={imp.revision} ocupado={ocupado} alImportar={confirmarImport} alCancelar={() => setImp(null)} />) : imp?.error ? <Aviso tono="peligro">{imp.error}</Aviso> : imp && <>
      <Aviso tono="aviso">Descarga los códigos ahora: no se vuelven a mostrar.</Aviso>
      <Boton icono={Download} onClick={() => aExcel({ 'Códigos': imp.res.map((r) => ({ 'Cédula': r.cedula, Nombre: r.nombre, Resultado: r.resultado, 'Código de activación': r.codigo })) }, 'codigos-activacion.xlsx')}>Descargar códigos en Excel</Boton>
      <ul className="lista">{imp.res.map((r, i) => <li key={i}><span className="crece">{r.nombre}<div className="suave chico">{r.resultado}</div></span><strong className="num">{r.codigo}</strong></li>)}</ul></>}</Hoja>
    {ocupado && <div className="avisos-flotantes"><div className="flotante" role="status"><span className="giro" />Importando…</div></div>}
  </>;
}
// Acciones rápidas sobre una persona sin salir de la lista
const RECORD = [['olvido', 'Tiene una jornada sin salida'], ['salida', 'Que marque la salida todos los días'], ['activar', 'Que active su cuenta'], ['permiso', 'Información pendiente en un permiso'], ['libre', 'Escribir otro mensaje']];
function AccionesPersona({ persona: u, alCerrar, ir, verExp, alEditar }) {
  const [modo, setModo] = useState(null), [correr, ocupado] = useAccion(), [f, campo, setF] = useForm({});
  useEffect(() => { setModo(null); setF({ fecha: sumarDias(hoyISO(), -1), tipo: 'salida', hora: '17:00', motivo: '', rtipo: 'olvido', mensaje: '' }); }, [u]); // eslint-disable-line
  if (!u) return null;
  const olvido = async () => { const r = await correr(() => api('adminMarcacionGuardar', { cedula: u.cedula, fecha: f.fecha, tipo: f.tipo, hora: f.hora, motivo: f.motivo }), 'Marcación registrada. Queda en la auditoría con tu nombre.'); if (r) alCerrar(); };
  const recordar = async () => { const r = await correr(() => api('adminRecordar', { cedula: u.cedula, tipo: f.rtipo, mensaje: f.rtipo === 'libre' ? f.mensaje : '' })); if (r) alCerrar(); };
  const nom = u.nombre.split(' ')[0];
  return <Hoja abierta alCerrar={alCerrar} titulo={`${u.nombre}`} alto={0.8}>
    {!modo && <div className="pila">
      <p className="suave">C.C. {u.cedula}{u.cargo ? ' · ' + u.cargo : ''}</p>
      <div className="acciones-rapidas">
        {verExp && <Boton variante="secundario" icono={FolderOpen} onClick={() => verExp(u.cedula)}>Ver expediente</Boton>}
        {u.estado === 'activo' && <Boton variante="secundario" icono={ClockAlert} onClick={() => setModo('olvido')}>Registrar marcación olvidada</Boton>}
        <Boton variante="secundario" icono={Send} onClick={() => setModo('recordar')}>Enviar recordatorio</Boton>
        <Boton variante="secundario" icono={CalendarCheck} onClick={() => { alCerrar(); ir('permisos'); }}>Revisar permisos</Boton>
        <Boton variante="secundario" icono={Pencil} onClick={() => alEditar(u)}>Editar datos</Boton>
      </div></div>}
    {modo === 'olvido' && <div className="pila">
      <p>Registra la marcación que {nom} no hizo. Queda como digitada, con tu nombre y el motivo.</p>
      <div className="rejilla"><Campo etiqueta="Fecha" type="date" max={hoyISO()} {...campo('fecha')} /><Campo como="select" etiqueta="Qué faltó" {...campo('tipo')} opciones={TIPOS.map((t) => ({ v: t, t: NOMBRE_TIPO[t] }))} /><Campo etiqueta="Hora" type="time" {...campo('hora')} /></div>
      <Campo como="textarea" etiqueta="Motivo" ayuda="Mínimo 5 letras. Ej.: el supervisor confirma que salió a las 5:00 p. m." {...campo('motivo')} />
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setModo(null)}>Atrás</Boton><Boton cargando={ocupado} disabled={(f.motivo || '').trim().length < 5} onClick={olvido}>Registrar</Boton></div></div>}
    {modo === 'recordar' && <div className="pila">
      <p>{nom} lo verá en la aplicación (sección Más → Comunicados) y por correo si lo tiene registrado.</p>
      <Campo como="select" etiqueta="Recordatorio" {...campo('rtipo')} opciones={RECORD.map(([v, t]) => ({ v, t }))} />
      {f.rtipo === 'libre' && <Campo como="textarea" etiqueta="Mensaje" maxLength={500} {...campo('mensaje')} />}
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setModo(null)}>Atrás</Boton><Boton cargando={ocupado} icono={Send} disabled={f.rtipo === 'libre' && (f.mensaje || '').trim().length < 5} onClick={() => correr(recordar, 'Recordatorio enviado.')}>Enviar</Boton></div></div>}
  </Hoja>;
}
// Búsqueda global (Ctrl+K): personas, obras y secciones
function BuscadorGlobal({ menu, ir, abrirPersona }) {
  const [q, setQ] = useState(''), [res, setRes] = useState(null), [sel, setSel] = useState(0), ref = React.useRef(null);
  const st = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  useEffect(() => { const k = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  useEffect(() => { if (q.trim().length < 2) { setRes(null); return; } let vivo = true; const t = setTimeout(() => api('adminBuscar', { q }).then((r) => vivo && setRes(r)).catch(() => vivo && setRes({ personas: [], obras: [] })), 250); return () => { vivo = false; clearTimeout(t); }; }, [q]);
  const secciones = q.trim().length < 2 ? [] : menu.flatMap((g) => g[1]).filter((i) => st(i[1]).includes(st(q))).slice(0, 4);
  const items = [...(res?.personas || []).map((p) => ({ k: 'p' + p.cedula, t: p.nombre, s: `C.C. ${p.cedula}${p.centro ? ' · ' + p.centro : ''}`, ir: () => abrirPersona(p) })),
    ...(res?.obras || []).map((o) => ({ k: 'o' + o.id, t: o.nombre, s: 'Obra' + (o.direccion ? ' · ' + o.direccion : ''), ir: () => ir('centros') })),
    ...secciones.map((s) => ({ k: 's' + s[0], t: s[1], s: 'Sección', ir: () => ir(s[0]) }))];
  const elegir = (x) => { x.ir(); setQ(''); setRes(null); };
  return <div className="busqueda-global no-imprimir" role="search">
    <Search size={18} aria-hidden="true" className="lupa" /><input className="entrada" aria-label="Buscar persona, cédula, obra o sección" ref={ref} type="search" placeholder="Buscar persona, cédula, obra… (Ctrl+K)" value={q}
      role="combobox" aria-expanded={items.length > 0} aria-controls="res-busqueda" aria-autocomplete="list"
      onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); } else if (e.key === 'Enter' && items[sel]) elegir(items[sel]); else if (e.key === 'Escape') setQ(''); }} />
    {q.trim().length >= 2 && <ul className="resultados" id="res-busqueda" role="listbox" aria-label="Resultados">{items.length ? items.map((x, i) => <li key={x.k} role="option" aria-selected={i === sel}><button type="button" onClick={() => elegir(x)}><strong>{x.t}</strong><div className="suave chico">{x.s}</div></button></li>) : <li className="suave chico" style={{ padding: 10 }}>{res ? 'Sin resultados.' : 'Buscando…'}</li>}</ul>}
  </div>;
}
function FormPersona({ persona, centros, alCerrar, alGuardar, yo, supervisores = [] }) {
  const nueva = persona && !persona.cedula, [f, campo, setF] = useForm({}), [correr, ocupado] = useAccion();
  useEffect(() => { if (persona) setF({ cedula: '', nombre: '', cargo: '', rol: 'trabajador', centroId: centros[0]?.id || '', salario: '', tipoPago: 'mensual', email: '', telefono: '', ingreso: '', eps: '', arl: '', supCentros: [], supervisor: '', banco: '', tipoCuenta: '', cuenta: '', retiro: '', tipoContrato: '', finContrato: '', ...persona }); }, [persona]); // eslint-disable-line
  const guardar = async (extra) => { const r = await correr(() => api('adminPersonaGuardar', { ...f, salario: +String(f.salario).replace(/\D/g, ''), ...extra }), 'Persona guardada.'); if (r) alGuardar(r); };
  const nuevoCodigo = async () => { const r = await correr(() => api('adminPersonaCodigo', { cedula: f.cedula })); if (r) alGuardar({ codigo: r.codigo, usuario: f }); };
  return <Hoja abierta={!!persona} alCerrar={alCerrar} titulo={nueva ? 'Agregar persona' : 'Editar persona'}>
    {persona?.estado === 'pendiente' && <Aviso tono="aviso">Se registró con el código de la empresa. Revisa sus datos y salario, y apruébala para que pueda marcar.</Aviso>}
    <div className="rejilla"><Campo etiqueta="Cédula" inputMode="numeric" disabled={!nueva} required {...campo('cedula')} /><Campo etiqueta="Nombre completo" required {...campo('nombre')} /></div>
    <div className="rejilla"><Campo etiqueta="Cargo" {...campo('cargo')} /><Campo como="select" etiqueta="Centro de trabajo" {...campo('centroId')}><option value="">Sin asignar</option>{centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Campo></div>
    {f.rol !== 'admin' && <Campo como="select" etiqueta="Supervisor que lo revisa" ayuda="Ese supervisor verá a esta persona, revisará sus horas y aprobará sus novedades. Si lo dejas vacío, lo ve el supervisor de su obra." {...campo('supervisor')}>
      <option value="">El de su obra</option>{supervisores.filter((s) => s.cedula !== f.cedula).map((s) => <option key={s.cedula} value={s.cedula}>{s.nombre}{s.rol === 'admin' ? ' (administración)' : ''}</option>)}</Campo>}
    <div className="rejilla"><Campo etiqueta="Salario" inputMode="numeric" ayuda="Al guardar queda validado." {...campo('salario')} /><Campo como="select" etiqueta="Forma de pago" opciones={[{ v: 'mensual', t: 'Salario mensual' }, { v: 'dia', t: 'Valor por día trabajado' }]} {...campo('tipoPago')} /></div>
    <div className="rejilla"><Campo etiqueta="Fecha de ingreso" type="date" ayuda="Para calcular vacaciones." {...campo('ingreso')} /><Campo como="select" etiqueta="Rol" opciones={[{ v: 'trabajador', t: 'Trabajador' }, { v: 'supervisor', t: 'Supervisor de obra' }, { v: 'admin', t: 'Administrador' }]} {...campo('rol')} /></div>
    <div className="rejilla"><Campo como="select" etiqueta="Tipo de contrato" opciones={[{ v: '', t: '—' }, { v: 'indefinido', t: 'Término indefinido' }, { v: 'fijo', t: 'Término fijo' }, { v: 'obra', t: 'Obra o labor' }, { v: 'aprendizaje', t: 'Aprendizaje' }]} {...campo('tipoContrato')} />
      {(f.tipoContrato === 'fijo' || f.tipoContrato === 'obra' || f.tipoContrato === 'aprendizaje') && <Campo etiqueta="Fin del contrato" type="date" ayuda="Te avisa 35 días antes, para el preaviso de 30." {...campo('finContrato')} />}</div>
    {f.rol === 'supervisor' && <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="pila junta"><legend className="etiqueta">Centros que supervisa</legend><span className="ayuda">Ve el tablero, las marcaciones y los permisos de esa gente, y aprueba sus horas extra. No ve salarios ni nómina. Sin marcar ninguno, supervisa su propio centro.</span>{centros.map((c) => <Casilla key={c.id} checked={(f.supCentros || []).includes(c.id)} onChange={(e) => setF((x) => ({ ...x, supCentros: e.target.checked ? [...(x.supCentros || []), c.id] : (x.supCentros || []).filter((y) => y !== c.id) }))}>{c.nombre}</Casilla>)}</fieldset>}
    <div className="rejilla"><Campo etiqueta="Correo" type="email" {...campo('email')} /><Campo etiqueta="Celular" inputMode="numeric" {...campo('telefono')} /></div>
    <div className="rejilla"><Campo etiqueta="EPS" {...campo('eps')} /><Campo etiqueta="ARL" {...campo('arl')} /></div>
    <div className="rejilla"><Campo etiqueta="Banco" ayuda="Para el archivo plano de pagos." {...campo('banco')} /><Campo como="select" etiqueta="Tipo de cuenta" opciones={[{ v: '', t: '—' }, { v: 'ahorros', t: 'Ahorros' }, { v: 'corriente', t: 'Corriente' }]} {...campo('tipoCuenta')} /><Campo etiqueta="Número de cuenta" inputMode="numeric" {...campo('cuenta')} /></div>
    {!nueva && persona?.estado !== 'pendiente' && <Campo etiqueta="Fecha de retiro" type="date" ayuda="Solo al dar de baja: desde el día siguiente deja de liquidarse. Vacía = hoy." {...campo('retiro')} />}
    {!nueva && <div className="fila"><Boton chico variante="secundario" icono={KeyRound} onClick={nuevoCodigo}>Nuevo código (restablece la contraseña)</Boton>
      {moduloActivo(yo, 'seguridadPro') && persona?.estado === 'activo' && <Boton chico variante="texto" icono={Smartphone} onClick={async () => { if (await correr(() => api('adminLiberarDispositivo', { cedula: f.cedula }), 'Celular liberado: podrá ingresar desde un equipo nuevo.')) alCerrar(); }}>Liberar celular</Boton>}
      {persona?.estado === 'inactivo' && <Boton chico variante="texto" icono={UserX} onClick={async () => { if (await correr(() => api('adminAnonimizarUsuario', { cedula: f.cedula }), 'Datos personales suprimidos. Se conservan las jornadas y pagos que exige la ley.')) alGuardar({}); }}>Suprimir datos personales</Boton>}
      {persona?.estado === 'activo' && <Boton chico variante="texto" onClick={() => guardar({ estado: 'inactivo' })}>Dar de baja{f.retiro ? ` el ${fechaCorta(f.retiro)}` : ' hoy'}</Boton>}{persona?.estado === 'inactivo' && <Boton chico variante="texto" onClick={() => guardar({ estado: 'activo' })}>Reactivar</Boton>}</div>}
    <div className="acciones-hoja"><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={ocupado} onClick={() => guardar(persona?.estado === 'pendiente' ? { estado: 'activo' } : {})}>{persona?.estado === 'pendiente' ? 'Guardar y aprobar' : 'Guardar'}</Boton></div>
  </Hoja>;
}

/* ---------- Centros de trabajo ---------- */
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], ORDEN = [1, 2, 3, 4, 5, 6, 0];
const minDia = (h) => { if (!h?.e || !h?.s) return 0; const m = (x) => +x.slice(0, 2) * 60 + +x.slice(3); let t = m(h.s) - m(h.e); if (t <= 0) t += 1440; if (h.ai && h.af) t -= Math.max(0, m(h.af) - m(h.ai)); return t; };
function Centros({ centros, recargar, yo }) {
  const [edit, setEdit] = useState(null), [qr, setQr] = useState(null);
  return <><Titulo t="Centros de trabajo" accion={<Boton icono={Plus} onClick={() => setEdit({})}>Agregar centro</Boton>}>Cada obra o sede tiene su horario, su ubicación y su radio permitido para marcar.</Titulo>
    {centros.length === 0 ? <Vacio icono={Building2} titulo="Aún no hay centros de trabajo">Crea el primero para asignarle personal y horario.</Vacio> :
      <div className="rejilla dos">{centros.map((c) => { const sem = ORDEN.reduce((s, d) => s + minDia(c.horario[d]), 0); return <Tarjeta key={c.id}>
        <div className="fila entre" style={{ alignItems: 'flex-start' }}><div><h3>{c.nombre}</h3><p className="suave chico">{c.cliente}{c.direccion ? ` · ${c.direccion}` : ''}</p></div>{!c.activo && <Insignia>Inactivo</Insignia>}</div>
        <ul className="lista chico" style={{ margin: '12px 0' }}>{ORDEN.filter((d) => c.horario[d]).map((d) => <li key={d} style={{ padding: '4px 0' }}><span className="crece">{DIAS[d]}</span><span className="num">{c.horario[d].e}–{c.horario[d].s}{c.horario[d].ai ? ` · almuerzo ${c.horario[d].ai}–${c.horario[d].af}` : ''}</span></li>)}</ul>
        <div className="fila"><Insignia tono={sem > 42 * 60 ? 'peligro' : 'ok'}>{horas(sem)} por semana</Insignia><Insignia tono={c.lat === null ? 'aviso' : ''}><MapPin size={12} aria-hidden="true" />{c.lat === null ? 'sin ubicación' : `radio ${c.radio} m`}</Insignia>{c.poligono?.length >= 3 && <Insignia>polígono</Insignia>}{c.exigirQr && <Insignia tono="info">exige QR</Insignia>}<span className="crece" />{moduloActivo(yo, 'qr') && <Boton chico variante="secundario" icono={QrCode} onClick={() => setQr(c)}>QR</Boton>}<Boton chico variante="secundario" icono={Pencil} onClick={() => setEdit(c)}>Editar</Boton></div>
      </Tarjeta>; })}</div>}
    <QrObra centro={qr} alCerrar={() => setQr(null)} />
    <FormCentro yo={yo} centro={edit} alCerrar={() => setEdit(null)} alGuardar={() => { setEdit(null); recargar(); }} /></>;
}
// Horario de toda la semana en un paso: entrada, salida y qué días se trabaja
function HorarioSemana({ hor, almO, alAplicar }) {
  const base = ORDEN.map((d) => hor[d]).find((h) => h && h.e) || { e: '07:00', s: '16:24' };
  const [e, setE] = useState(base.e), [sa, setSa] = useState(base.s), [dias, setDias] = useState(() => ORDEN.filter((d) => hor[d]?.e).length ? ORDEN.filter((d) => hor[d]?.e) : [1, 2, 3, 4, 5]);
  const [sab, setSab] = useState(() => (hor[6]?.e && hor[6]?.s !== base.s ? hor[6].s : ''));
  const cambia = (d) => setDias((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  const aplicar = () => { const n = {}; dias.forEach((d) => { const conAlm = almO.ai && almO.af && !(d === 6 && sab); n[d] = { e, s: d === 6 && sab ? sab : sa, ...(conAlm ? { ai: almO.ai, af: almO.af } : {}) }; }); alAplicar(n); };
  return <fieldset className="pila junta horario-semana"><legend className="etiqueta">Horario de la semana</legend>
    <div className="fila" style={{ gap: 8, alignItems: 'flex-end' }}><Campo etiqueta="Entrada" type="time" value={e} onChange={(x) => setE(x.target.value)} /><Campo etiqueta="Salida" type="time" value={sa} onChange={(x) => setSa(x.target.value)} /></div>
    <div className="dias-chips" role="group" aria-label="Días que se trabaja">{ORDEN.map((d) => <button key={d} type="button" aria-pressed={dias.includes(d)} onClick={() => cambia(d)}>{DIAS[d].slice(0, 3)}</button>)}</div>
    {dias.includes(6) && <Campo etiqueta="Salida del sábado (si es distinta)" type="time" value={sab} onChange={(x) => setSab(x.target.value)} ayuda="Vacío = igual que los demás días. Si sale más temprano, el sábado queda sin almuerzo." />}
    <Boton disabled={!e || !sa || sa <= e || !dias.length} onClick={aplicar}>Aplicar a {dias.length === 7 ? 'todos los días' : dias.length + ' días'}</Boton>
    <span className="ayuda">Pone la misma entrada, salida y almuerzo en los días marcados y deja libres los demás. Abajo puedes ajustar un día puntual.</span></fieldset>;
}
function FormCentro({ centro, alCerrar, alGuardar, yo }) {
  const [f, campo, setF] = useForm({}), [hor, setHor] = useState({}), [correr, ocupado] = useAccion(), avisos = useAvisos(), [gps, setGps] = useState(false);
  useEffect(() => { if (!centro) return; setF({ nombre: '', cliente: '', direccion: '', radio: 150, tol: 5, festivos: false, activo: true, exigirQr: false, presupuestoHoras: '', presupuestoCosto: '', arlPct: '', ...centro, lat: centro.lat ?? '', lng: centro.lng ?? '', poligonoTxt: (centro.poligono || []).map((p) => p.join(', ')).join('\n') });
    setHor(centro.id ? centro.horario : Object.fromEntries([1, 2, 3, 4, 5].map((d) => [d, { e: '07:00', s: '16:24', ai: '12:00', af: '13:00' }]))); }, [centro]); // eslint-disable-line
  const pon = (d, k, v) => setHor((h) => ({ ...h, [d]: { ...(h[d] || {}), [k]: v } }));
  const sem = ORDEN.reduce((s, d) => s + minDia(hor[d]), 0);
  const aqui = async () => { setGps(true); try { const p = await ubicar(); setF((x) => ({ ...x, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) })); avisos.ok(`Ubicación tomada (precisión ${p.prec} m).`); } catch (e) { avisos.error(e); } finally { setGps(false); } };
  const poligono = () => { const pts = String(f.poligonoTxt || '').split(/[\n;]+/).map((l) => l.split(/[,\s]+/).filter(Boolean).map(Number)).filter((p) => p.length === 2 && !p.some(isNaN)); return pts; };
  const [almO, setAlmO] = useState(() => { const d0 = ORDEN.map((d) => hor[d]).find((x) => x && x.ai); return { ai: d0?.ai || '12:00', af: d0?.af || '13:00' }; });
  const guardar = async () => { const r = await correr(() => api('adminCentroGuardar', { ...f, horario: hor, poligono: poligono() }), 'Centro guardado.'); if (r) alGuardar(); };
  return <Hoja abierta={!!centro} alCerrar={alCerrar} titulo={centro?.id ? 'Editar centro de trabajo' : 'Nuevo centro de trabajo'} alto={0.92}>
    <div className="rejilla"><Campo etiqueta="Nombre de la obra o sede" required {...campo('nombre')} /><Campo etiqueta="Cliente" {...campo('cliente')} /></div>
    <Campo etiqueta="Dirección" {...campo('direccion')} />
    <SelectorPlantilla alElegir={(h) => { setHor(h); const d0 = Object.values(h).find((x) => x.ai); if (d0) setAlmO({ ai: d0.ai, af: d0.af }); }} />
    <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="pila junta"><legend className="etiqueta" style={{ marginBottom: 8 }}>Almuerzo de esta obra</legend>
      <div className="fila" style={{ alignItems: 'flex-end', gap: 8 }}>
        <Campo etiqueta="Desde" type="time" value={almO.ai} onChange={(e) => setAlmO({ ...almO, ai: e.target.value })} />
        <Campo etiqueta="Hasta" type="time" value={almO.af} onChange={(e) => setAlmO({ ...almO, af: e.target.value })} />
        <Boton variante="secundario" disabled={!almO.ai || !almO.af || almO.af <= almO.ai} onClick={() => { const n = { ...hor }; ORDEN.forEach((d) => { if (n[d]?.e) n[d] = { ...n[d], ai: almO.ai, af: almO.af }; }); setHor(n); }}>Aplicar a todos los días</Boton></div>
      <span className="ayuda">La hora de almuerzo de la obra. Se aplica a cada día con horario; abajo puedes ajustar un día distinto (por ejemplo, el sábado sin almuerzo). Si alguien no sale a almuerzo, lo reporta desde su celular con quién lo autorizó y por qué.</span></fieldset>
    <HorarioSemana key={(centro?.id || 'nueva') + JSON.stringify(hor)} hor={hor} almO={almO} alAplicar={(n) => { setHor(n); avisos.ok('Horario aplicado. Revisa abajo el total de horas de la semana.'); }} />
    <details><summary className="etiqueta" style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center' }}>Ajustar un día puntual</summary>
    <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="pila junta"><legend className="oculto-visual">Horario por día</legend>
      <div className="dias-horario">{ORDEN.map((d) => { const h = hor[d] || {}; return <div className="dia" key={d}><span className="etiqueta">{DIAS[d]}</span>
        {[['e', 'entrada'], ['ai', 'inicio de almuerzo'], ['af', 'fin de almuerzo'], ['s', 'salida']].map(([k, n]) => <input key={k} type="time" className="entrada" aria-label={`${DIAS[d]}: ${n}`} title={n} value={h[k] || ''} onChange={(e) => pon(d, k, e.target.value)} />)}</div>; })}</div>
      <span className="ayuda">Orden: entrada · inicio de almuerzo · fin de almuerzo · salida. Deja vacío el día que no se trabaja. Un cambio de horario aplica desde hoy; los días ya trabajados conservan el horario con que se ficharon.</span>
    </fieldset></details>
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      {sem > 0 && <Aviso tono={sem > 42 * 60 ? 'peligro' : 'ok'}>Este horario suma <strong>{horas(sem)}</strong> a la semana. {sem > 42 * 60 ? 'Supera la jornada máxima legal de 42 horas (Ley 2101 de 2021): el exceso se liquidará como horas extra.' : 'Está dentro de la jornada máxima legal de 42 horas.'}</Aviso>}
    </fieldset>
    <div className="rejilla"><Campo etiqueta="Tolerancia de llegada (min)" type="number" min="0" {...campo('tol')} /><Campo etiqueta="Radio permitido (m)" type="number" min="20" {...campo('radio')} /></div>
    <div className="rejilla"><Campo etiqueta="Latitud" inputMode="decimal" {...campo('lat')} /><Campo etiqueta="Longitud" inputMode="decimal" {...campo('lng')} /></div>
    <Boton variante="secundario" icono={LocateFixed} cargando={gps} onClick={aqui}>Usar mi ubicación actual (estoy en la obra)</Boton>
    <details><summary className="etiqueta" style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center' }}>Forma exacta de la obra (opcional)</summary>
      <Campo como="textarea" etiqueta="Esquinas del polígono" ayuda="Una esquina por línea: latitud, longitud. Mínimo 3. Cópialas de Google Maps (clic derecho sobre el mapa). Si lo llenas, reemplaza el radio." placeholder={'4.650120, -74.100340\n4.650980, -74.099120\n4.649870, -74.098760'} {...campo('poligonoTxt')} />
      {f.poligonoTxt && <p className="chico">{poligono().length >= 3 ? `${poligono().length} esquinas válidas.` : 'Faltan esquinas válidas: se usará el radio.'}</p>}</details>
    {moduloActivo(yo, 'qr') && <Casilla {...campo('exigirQr', 'check')}>Exigir el código QR de portería para marcar en esta obra</Casilla>}
    <Campo etiqueta="Tarifa de ARL de esta obra (%)" type="number" step="0.001" min="0.348" max="6.96" ayuda="Vacío = la de la empresa. Riesgo V (obra civil, alturas) = 6,96." {...campo('arlPct')} />
    {moduloActivo(yo, 'presupuesto') && <div className="rejilla"><Campo etiqueta="Presupuesto de horas al mes" type="number" min="0" {...campo('presupuestoHoras')} /><Campo etiqueta="Presupuesto de costo al mes ($)" inputMode="numeric" {...campo('presupuestoCosto')} /></div>}
    <Casilla {...campo('festivos', 'check')}>En este centro se trabaja los festivos según el horario</Casilla>
    <Casilla {...campo('activo', 'check')}>Centro activo</Casilla>
    <div className="acciones-hoja"><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={ocupado} onClick={guardar}>Guardar centro</Boton></div>
  </Hoja>;
}

/* ---------- Marcaciones ---------- */
function Marcaciones({ centros, soloVer }) {
  const [r, setR] = useState({ desde: sumarDias(hoyISO(), -6), hasta: hoyISO() }), [centroId, setCentroId] = useState(''), carga = useCarga(() => api('adminMarcaciones', { ...r, centroId }), [r.desde, r.hasta, centroId]);
  const [det, setDet] = useState(null), [foto, setFoto] = useState(null), [aj, setAj] = useState(null), [correr, ocupado] = useAccion();
  const verFoto = async (id) => { setFoto({ cargando: true }); const x = await correr(() => api('adminFoto', { id })); setFoto(x ? x : null); };
  const guardarAjuste = async () => { const ok = await correr(() => api('adminMarcacionGuardar', aj), aj.anular ? 'Marcación anulada.' : 'Marcación ajustada.'); if (ok) { setAj(null); setDet(null); carga.recargar(true); } };
  const revisada = async (id) => { if (await correr(() => api('adminMarcacionRevisada', { id }), 'Marcada como revisada.')) { setDet(null); carga.recargar(true); } };
  return <><Titulo t="Marcaciones">Jornada por persona y día. Abre un día para ver ubicación, foto y corregir una hora.</Titulo>
    <div className="fila" style={{ marginBottom: 16, alignItems: 'flex-end' }}><Rango r={r} setR={setR} /><Campo como="select" etiqueta="Centro" value={centroId} onChange={(e) => setCentroId(e.target.value)}><option value="">Todos</option>{centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Campo></div>
    <Estado carga={carga} lineas={8}>{(l) => <Tabla columnas={[
      { k: 'fecha', t: 'Fecha', render: (f) => <span>{fechaCorta(f.fecha)}</span> }, { k: 'nombre', t: 'Persona', render: (f) => <strong>{f.nombre}</strong> }, { k: 'centro', t: 'Centro' },
      { k: 'entrada', t: 'Entrada', num: true }, { k: 'salAlm', t: 'Almuerzo', num: true, render: (f) => f.salAlm ? `${f.salAlm}–${f.entAlm || '?'}` : f.almuerzoAsumido ? <span className="suave">asumido</span> : '' }, { k: 'salida', t: 'Salida', num: true },
      { k: 'min', t: 'Trabajado', num: true, render: (f) => f.incompleto ? '—' : horas(f.min) },
      { k: 'n', t: 'Novedades', orden: false, render: (f) => <span className="fila" style={{ gap: 4 }}>{f.tarde > 0 && <Insignia tono="aviso">tarde {f.tarde}′</Insignia>}{f.extra > 0 && <Insignia tono="info">extra {horas(f.extra)}</Insignia>}{f.incompleto && <Insignia tono="peligro">sin salida</Insignia>}{f.marcas.some((m) => m.estado === 'revisar') && <Insignia tono="peligro">revisar</Insignia>}{f.marcas.some((m) => m.enZona === '0') && <Insignia tono="peligro">fuera de zona</Insignia>}{f.cerrado && <Insignia>cerrado</Insignia>}</span>, texto: (f) => (f.marcas.some((m) => m.estado === 'revisar') ? 'revisar ' : '') + (f.tarde ? 'tarde' : '') },
      { k: 'a', t: '', acciones: true, orden: false, render: (f) => <Boton chico variante="secundario" onClick={() => setDet(f)}>Ver día</Boton> }]}
      filas={l} clave={(f) => f.cedula + f.fecha} vacio="No hay marcaciones en ese rango." />}</Estado>
    <Hoja abierta={!!det} alCerrar={() => setDet(null)} titulo={det ? `${det.nombre} · ${fechaCorta(det.fecha)}` : ''}>{det && <>
      <ul className="lista">{TIPOS.map((t) => { const m = det.marcas.find((x) => x.tipo === t); return <li key={t} style={{ alignItems: 'flex-start' }}><div className="crece"><strong>{NOMBRE_TIPO[t]}</strong> <span className="num">{m ? m.hora.slice(11) : '—'}</span>
        {m && <div className="fila chico" style={{ gap: 4, marginTop: 4 }}><Insignia>{{ en_linea: 'en línea', sin_conexion: 'sin señal', manual: 'digitada', administrador: 'por administrador' }[m.origen] || m.origen}</Insignia>{m.estado === 'revisar' && <Insignia tono="peligro">por revisar</Insignia>}{m.enZona === '0' && <Insignia tono="peligro">a {m.dist} m del centro</Insignia>}{m.enZona === '1' && <Insignia tono="ok">en el centro</Insignia>}{m.fotoExigida && !m.foto && <Insignia tono="aviso">sin foto</Insignia>}</div>}
        {m?.motivo && <div className="suave chico">Motivo: {m.motivo}</div>}
        {m && <div className="fila" style={{ marginTop: 6 }}>{m.lat && <a className="btn texto chico" href={`https://maps.google.com/?q=${m.lat},${m.lng}`} target="_blank" rel="noreferrer"><MapPin size={16} aria-hidden="true" />Mapa</a>}{m.foto && <Boton chico variante="texto" icono={Image} onClick={() => verFoto(m.foto)}>Foto</Boton>}{m.estado === 'revisar' && !soloVer && <Boton chico variante="texto" onClick={() => revisada(m.id)}>Dar por revisada</Boton>}</div>}</div>
        {!det.cerrado && !soloVer && <Boton chico variante="secundario" icono={Pencil} onClick={() => setAj({ cedula: det.cedula, fecha: det.fecha, tipo: t, hora: m ? m.hora.slice(11) : '', motivo: '', existe: !!m })}>{m ? 'Corregir' : 'Agregar'}</Boton>}</li>; })}</ul>
      {det.cerrado && <Aviso>Este día pertenece a una nómina cerrada y ya no se puede modificar.</Aviso>}</>}</Hoja>
    <Hoja abierta={!!aj} alCerrar={() => setAj(null)} titulo={aj ? `${aj.existe ? 'Corregir' : 'Agregar'}: ${NOMBRE_TIPO[aj.tipo]}` : ''} alto={0.6}>{aj && <>
      <Campo etiqueta="Hora correcta" type="time" value={aj.hora} onChange={(e) => setAj({ ...aj, hora: e.target.value })} />
      <Campo como="textarea" etiqueta="Motivo del ajuste" ayuda="Queda en el registro de auditoría con tu usuario." value={aj.motivo} onChange={(e) => setAj({ ...aj, motivo: e.target.value })} />
      <div className="acciones-hoja">{aj.existe && <Boton variante="texto" onClick={() => { setAj({ ...aj, anular: true }); }} disabled={aj.motivo.trim().length < 5}>{aj.anular ? 'Se anulará al guardar' : 'Anular marcación'}</Boton>}<Boton cargando={ocupado} disabled={aj.motivo.trim().length < 5 || (!aj.anular && !aj.hora)} onClick={guardarAjuste}>{aj.anular ? 'Confirmar anulación' : 'Guardar ajuste'}</Boton></div></>}</Hoja>
    <Hoja abierta={!!foto} alCerrar={() => setFoto(null)} titulo="Foto de la marcación" alto={0.7}>{foto?.url ? <img src={foto.url} alt="Foto tomada al marcar" style={{ borderRadius: 12, width: '100%' }} /> : <div className="esqueleto" style={{ height: 300 }} />}</Hoja>
  </>;
}

/* ---------- Estructura ---------- */
const MENU = [['Día a día', [['tablero', 'Hoy', LayoutDashboard], ['revision', 'Revisión del día', IconoRevision], ['marcaciones', 'Marcaciones', ClipboardList, 'revisar'], ['permisos', 'Permisos', CalendarCheck, 'permisos'], ['extras', 'Horas extra', Timer, 'extras'], ['incapacidades', 'Incapacidades', Stethoscope], ['envivo', 'En vivo', Activity, null, 'tablero360'], ['kiosco', 'Kiosco', Tablet, null, 'kiosco']]],
  ['Pago', [['informes', 'Informes', BarChart3], ['nomina', 'Nómina', Wallet], ['guia', 'Guía de nómina', HelpCircle], ['prestamos', 'Préstamos', Banco, null, ['prestamos', 'nomina']], ['obras', 'Por obra', FileSpreadsheet]]],
  ['Empresa', [['personal', 'Personal', Users, 'usuarios'], ['centros', 'Obras y sedes', Building2], ['turnos', 'Turnos', CalendarClock, null, 'turnos'], ['comunicados', 'Comunicados', Megaphone, null, 'autoservicio'], ['alertas', 'Alertas', BellRing], ['config', 'Configuración', Settings], ['arranque', 'Asistente de inicio', Sparkles], ['sistema', 'Sistema', HeartPulse]]]];
export default function Admin({ yo, recargarYo, alSalir }) {
  window.__yo = yo;
  const [sub, setSub] = useState(''), [vista, setVista] = useState('tablero'), centrosC = useCarga(() => api('adminCentros'), []), pend = useCarga(() => tableroCompartido().then((d) => d.pendientes), [vista === 'tablero']), sup = yo.usuario.rol !== 'admin';
  const [qMenu, setQMenu] = useState(''), [plegados, setPlegados] = useState(() => { try { return JSON.parse(localStorage.getItem('cj.menuPlegado') || '[]'); } catch { return []; } });
  const plegar = (g) => { const l = plegados.includes(g) ? plegados.filter((x) => x !== g) : [...plegados, g]; setPlegados(l); try { localStorage.setItem('cj.menuPlegado', JSON.stringify(l)); } catch { /* sin almacenamiento */ } };
  const sinTilde = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const vale = (x) => { const m = x[4]; return !m || (Array.isArray(m) ? m.some((k) => moduloActivo(yo, k)) : moduloActivo(yo, m)); };
  const menu = (sup ? [['Mi equipo', MENU[0][1].filter((x) => ['tablero', 'revision', 'marcaciones', 'permisos', 'extras', 'envivo', 'kiosco'].includes(x[0])).concat([['ubicacion', 'Ubicación de obras', MapPin], ['informes', 'Informes', BarChart3]])]] : MENU).map(([g, l]) => [g, l.filter(vale)]);
  const [expG, setExpG] = useState(null);
  const [saltoAsist, setSaltoAsist] = useState(() => { try { return !!localStorage.getItem('cj.asistenteSaltado'); } catch { return false; } });
  const centros = centrosC.datos || [], ir = (v, s) => { setVista(v); setSub(s || ''); window.scrollTo(0, 0); }, n = (k) => (k && pend.datos ? pend.datos[k] : 0);
  const comun = { centros, cfg: yo.cfg, ir, soloVer: sup, yo, modulos: Object.fromEntries((yo.licencia?.modulos || ['asistencia', 'nomina', 'permisos', 'turnos', 'prestamos', 'autoservicio', 'kiosco', 'qr', 'presupuesto', 'tablero360', 'seguridadPro']).map((m) => [m, true])) };
  return <><BandaLicencia yo={yo} ir={ir} /><div className="admin">
    <nav className="admin-nav no-imprimir" aria-label="Administración">
      <div className="nav-buscar"><Search size={16} aria-hidden="true" /><input type="search" placeholder="Buscar sección…" aria-label="Buscar sección" value={qMenu} onChange={(e) => setQMenu(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const x = menu.flatMap((g) => g[1]).find((i) => sinTilde(i[1]).includes(sinTilde(qMenu))); if (x) { ir(x[0]); setQMenu(''); } } }} /></div>
      {menu.map(([g, items]) => { const vis = items.filter((i) => !qMenu || sinTilde(i[1]).includes(sinTilde(qMenu))); if (!vis.length) return null;
        const cerrado = !qMenu && plegados.includes(g) && !vis.some((i) => i[0] === vista), pendG = vis.reduce((s, i) => s + n(i[3]), 0);
        return <div key={g}><h2><button className="grupo" aria-expanded={!cerrado} onClick={() => plegar(g)}><ChevronDown size={14} aria-hidden="true" style={{ transform: cerrado ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />{g}{cerrado && pendG > 0 && <span className="cuenta">{pendG}</span>}</button></h2>
          {!cerrado && vis.map(([k, t, I, c]) => <button key={k} aria-current={vista === k ? 'page' : undefined} onClick={() => { ir(k); setQMenu(''); }}><I size={18} aria-hidden="true" />{t}{n(c) > 0 && <span className="cuenta" aria-label={`${n(c)} pendientes`}>{n(c)}</span>}</button>)}</div>; })}
      <div style={{ marginTop: 16, borderTop: '1px solid var(--c-borde)', paddingTop: 8 }}><button onClick={alSalir}><LogOut size={18} aria-hidden="true" />Cerrar sesión</button></div></nav>
    <div className="admin-movil no-imprimir"><Campo como="select" etiqueta="Sección de administración" value={vista} onChange={(e) => ir(e.target.value)}>{menu.map(([g, items]) => <optgroup key={g} label={g}>{items.map(([k, t, , c]) => <option key={k} value={k}>{t}{n(c) > 0 ? ` (${n(c)})` : ''}</option>)}</optgroup>)}</Campo></div>
    <main className="admin-cuerpo" id="contenido" tabIndex={-1}>
      <BuscadorGlobal menu={menu} ir={ir} abrirPersona={(p) => moduloActivo(yo, 'tablero360') && p.estado === 'activo' ? setExpG(p.cedula) : ir('personal')} />
      <Expediente cedula={expG} alCerrar={() => setExpG(null)} esAdmin={!sup} />
      {vista === 'tablero' && (yo.arranque && !saltoAsist ? <Asistente yo={yo} centros={centros} alTerminar={() => { centrosC.recargar(true); recargarYo && recargarYo(); ir('tablero'); }} alSaltar={() => { try { localStorage.setItem('cj.asistenteSaltado', '1'); } catch { /* sin almacenamiento */ } setSaltoAsist(true); }} /> : <Tablero ir={ir} yo={yo} />)}
      {vista === 'arranque' && <Asistente yo={yo} centros={centros} alTerminar={() => { centrosC.recargar(true); recargarYo && recargarYo(); ir('tablero'); }} alSaltar={() => ir('tablero')} />}
      {vista === 'personal' && <Personal {...comun} />}
      {vista === 'centros' && <Centros {...comun} recargar={() => { centrosC.recargar(true); recargarYo(); }} />}
      {vista === 'marcaciones' && <Marcaciones {...comun} />}
      {vista === 'permisos' && <Permisos {...comun} />}
      {vista === 'extras' && <Extras {...comun} />}
      {vista === 'incapacidades' && <Incapacidades {...comun} />}
      {vista === 'nomina' && <Nomina {...comun} irA={ir} />}
      {vista === 'obras' && <Obras {...comun} />}
      {vista === 'alertas' && <Alertas {...comun} />}
      {vista === 'config' && <Config {...comun} tabInicial={sub} recargarYo={recargarYo} />}
      {vista === 'sistema' && <Sistema {...comun} />}
      {vista === 'turnos' && <Turnos {...comun} />}
      {vista === 'informes' && <Informes {...comun} />}
      {vista === 'guia' && <><Titulo t="Guía de nómina">Pregunta con tus palabras o dicta: responde con las reglas vigentes de tu configuración. Tus trabajadores tienen la misma guía en su pago y desde ahí te envían sus dudas.</Titulo><div className="pila"><ConsultasAdmin /><Guia /></div></>}
      {vista === 'envivo' && <EnVivo {...comun} />}
      {vista === 'revision' && <RevisionDia />}
      {vista === 'ubicacion' && <UbicarObras centros={centros} recargar={() => centrosC.recargar(true)} />}
      {vista === 'kiosco' && <ActivarKiosco centros={centros.filter((c) => c.activo !== false)} />}
      {vista === 'prestamos' && <Prestamos {...comun} />}
      {vista === 'comunicados' && <Comunicados {...comun} />}
    </main>
  </div></>;
}
