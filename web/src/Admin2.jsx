import { colorLegible } from './util.js';
import { BotonDictar } from './a11y.jsx';
import React, { useEffect, useState } from 'react';
import { CalendarCheck, Check, Download, Lock, MessageCircle, Pencil, Plus, RefreshCw, Save, Stethoscope, Timer, X, DatabaseBackup, FileText, CheckCheck, Trash2 } from 'lucide-react';
import { api, VERSION } from './api.js';
import { Aviso, Boton, Campo, Casilla, Confirmar, Estado, Hoja, Insignia, Pestanas, Tabla, Tarjeta, Vacio, useAvisos, useCarga, useForm } from './ui.jsx';
import { comprimirArchivo, fechaCorta, fechaHora, horas, horasDec, hoyISO, pesos, sumarDias } from './util.js';
import { DetallePermiso, nombreEstado, tonoPermiso } from './Firma.jsx';
import { Desprendible, Liquidacion, enlaceWhatsApp, textoPermiso } from './Trabajador.jsx';
import { Rango, Titulo, aExcel, periodoActual, useAccion } from './Admin.jsx';
import { LiquidacionContrato, Licencia, Presupuesto, Provisiones } from './Modulos.jsx';

/* ---------- Permisos ---------- */
export function Permisos({ soloVer }) {
  const [reg, setReg] = useState(false), carga = useCarga(() => api('adminPermisos'), []), [filtro, setFiltro] = useState('pendientes'), [sel, setSel] = useState(null), [obs, setObs] = useState(''), [rem, setRem] = useState(true), [correr, ocupado] = useAccion();
  const abrir = (p) => { setSel(p); setObs(''); setRem(p.remunerado); };
  const decidir = async (decision) => { if (await correr(() => api('adminPermisoDecidir', { id: sel.id, decision, obs, remunerado: rem }), decision === 'aprobar' ? 'Permiso aprobado: ya cuenta para la nómina.' : 'Permiso rechazado.')) { setSel(null); carga.recargar(true); } };
  const sinFirmas = sel && sel.estado !== 'firmado';
  return <><Titulo t="Permisos" accion={!soloVer && <Boton variante="secundario" icono={Plus} onClick={() => setReg(true)}>Registrar a nombre de un trabajador</Boton>}>{soloVer ? 'Permisos de tu equipo y su estado. La aprobación final la da el administrador.' : 'Un permiso solo afecta la nómina cuando tú lo apruebas aquí, después de las firmas de los jefes.'}</Titulo>
    <div style={{ marginBottom: 16 }}><Pestanas etiqueta="Filtro de permisos" valor={filtro} alCambiar={setFiltro} opciones={[{ v: 'pendientes', t: 'Por decidir' }, { v: 'en_firmas', t: 'En firmas' }, { v: 'todos', t: 'Todos' }]} /></div>
    <Estado carga={carga}>{(l) => <Tabla columnas={[
      { k: 'nombre', t: 'Persona', render: (p) => <strong>{p.nombre}</strong> }, { k: 'tipoNombre', t: 'Tipo', render: (p) => <>{p.tipoNombre}<div className="suave chico">{p.remunerado ? 'Remunerado' : 'No remunerado'}</div></> },
      { k: 'fechaSalida', t: 'Sale', render: (p) => `${fechaCorta(p.fechaSalida)} ${p.horaSalida}` }, { k: 'fechaRegreso', t: 'Regresa', render: (p) => `${fechaCorta(p.fechaRegreso)} ${p.horaRegreso}` },
      { k: 'firmas', t: 'Firmas', orden: false, render: (p) => p.firmas.length ? `${p.firmas.filter((f) => f.estado === 'aprobado').length} de ${p.firmas.length}` : '—' },
      { k: 'estado', t: 'Estado', render: (p) => <Insignia tono={tonoPermiso[p.estado]}>{nombreEstado[p.estado]}</Insignia>, texto: (p) => nombreEstado[p.estado] },
      { k: 'salidaReal', t: 'Uso real', render: (p) => p.salidaReal ? <span className="chico">Salió {p.salidaReal.slice(11, 16)}{p.regresoReal ? ` · regresó ${p.regresoReal.slice(11, 16)}` : ''}</span> : '', texto: (p) => p.salidaReal ? `Salió ${p.salidaReal.slice(11, 16)}${p.regresoReal ? ` regresó ${p.regresoReal.slice(11, 16)}` : ''}` : '' },
      { k: 'a', t: '', acciones: true, orden: false, render: (p) => <Boton chico variante={!soloVer && ['firmado', 'vencido'].includes(p.estado) ? 'primario' : 'secundario'} onClick={() => abrir(p)}>{!soloVer && ['firmado', 'vencido'].includes(p.estado) ? 'Decidir' : 'Ver'}</Boton> }]}
      filas={l.filter((p) => filtro === 'todos' || (filtro === 'pendientes' ? ['firmado', 'vencido'].includes(p.estado) : p.estado === 'en_firmas'))} clave={(p) => p.id}
      vacio={filtro === 'pendientes' ? 'No hay permisos esperando tu decisión.' : 'No hay permisos en esta lista.'} />}</Estado>
    <Hoja abierta={!!sel} alCerrar={() => setSel(null)} titulo="Solicitud de permiso" alto={0.92}>{sel && <>
      <Insignia tono={tonoPermiso[sel.estado]}>{nombreEstado[sel.estado]}</Insignia>
      <DetallePermiso p={sel} />{sel.obs && <p className="suave chico">{sel.obs}</p>}
      <h3>Firmas</h3>
      {sel.firmas.length === 0 ? <Aviso tono="aviso">No hay jefes configurados para este centro. Agrégalos en Configuración → Jefes que firman.</Aviso> :
        <ul className="lista">{sel.firmas.map((f) => <li key={f.id}><div className="crece"><strong>{f.nombre}</strong><div className="suave chico">{f.cargo}{f.fecha ? ` · ${fechaHora(f.fecha)}` : ''}{f.obs ? ` · ${f.obs}` : ''}</div>{f.firma && <img src={f.firma} alt={`Firma de ${f.nombre}`} style={{ height: 48, background: '#fff', borderRadius: 6, marginTop: 4 }} />}</div>
          {f.estado === 'pendiente' && f.enlace && f.whatsapp ? <a className="btn secundario chico" href={enlaceWhatsApp(f.whatsapp, textoPermiso(sel, f))} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" />Recordar</a> : <Insignia tono={f.estado === 'aprobado' ? 'ok' : f.estado === 'rechazado' ? 'peligro' : 'aviso'}>{f.estado}</Insignia>}</li>)}</ul>}
      {!soloVer && ['firmado', 'en_firmas', 'vencido'].includes(sel.estado) && <>
        {sinFirmas && <Aviso tono="aviso">Faltan firmas. Puedes decidir sin ellas, pero debes escribir la justificación; queda en auditoría.</Aviso>}
        {!['ley', 'vacaciones'].includes(sel.cat) && <Casilla checked={rem} onChange={(e) => setRem(e.target.checked)}>Permiso remunerado (si no, se descuenta el tiempo)</Casilla>}
        <Campo como="textarea" etiqueta={sinFirmas ? 'Justificación' : 'Observación (obligatoria si rechazas)'} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} />
        <div className="acciones-hoja"><Boton variante="peligro" icono={X} cargando={ocupado} disabled={obs.trim().length < 5} onClick={() => decidir('rechazar')}>Rechazar</Boton><Boton icono={Check} cargando={ocupado} disabled={sinFirmas && obs.trim().length < 5} onClick={() => decidir('aprobar')}>Aprobar</Boton></div></>}
    </>}</Hoja>
    <RegistrarPermiso abierta={reg} alCerrar={() => setReg(false)} alListo={() => { setReg(false); carga.recargar(true); }} /></>;
}

function RegistrarPermiso({ abierta, alCerrar, alListo }) {
  const personas = useCarga(() => (abierta ? api('adminPersonal') : Promise.resolve([])), [abierta]), [cat, setCat] = useState([]), [f, campo, setF] = useForm({}), [correr, ocupado] = useAccion();
  useEffect(() => { if (abierta) { setF({ cedula: '', tipo: 'vacaciones', fechaSalida: hoyISO(), horaSalida: '', fechaRegreso: hoyISO(), horaRegreso: '', motivo: '', remunerado: false }); setCat((window.__yo && window.__yo.permisosCat) || []); } }, [abierta]); // eslint-disable-line
  const guardar = async () => { if (await correr(() => api('adminPermisoRegistrar', f), 'Registrado y aprobado.')) alListo(); };
  const c = cat.find((x) => x.id === f.tipo);
  return <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Registrar permiso o vacaciones" alto={0.92}>
    <p className="suave chico">Para lo que ya está acordado o soportado (vacaciones programadas, licencias, permisos pedidos en papel). Queda aprobado de inmediato, sin firmas, y en la auditoría con tu usuario.</p>
    <Campo como="select" etiqueta="Persona" {...campo('cedula')}><option value="">Elige…</option>{(personas.datos || []).filter((u) => u.estado === 'activo').map((u) => <option key={u.cedula} value={u.cedula}>{u.nombre}</option>)}</Campo>
    <Campo como="select" etiqueta="Tipo" {...campo('tipo')}>{cat.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</Campo>
    {c && !c.rem && <Casilla {...campo('remunerado', 'check')}>Pagarlo de todas formas (permiso remunerado por decisión de la empresa)</Casilla>}
    <div className="rejilla"><Campo etiqueta="Fecha de salida" type="date" {...campo('fechaSalida')} /><Campo etiqueta="Hora de salida" type="time" ayuda="Solo si es por horas." {...campo('horaSalida')} /></div>
    <div className="rejilla"><Campo etiqueta="Fecha de regreso" type="date" min={f.fechaSalida} ayuda="Día en que vuelve a trabajar." {...campo('fechaRegreso')} /><Campo etiqueta="Hora de regreso" type="time" {...campo('horaRegreso')} /></div>
    <Campo como="textarea" etiqueta="Motivo o soporte" maxLength={500} {...campo('motivo')} />
    <div className="acciones-hoja"><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={ocupado} disabled={!f.cedula} onClick={guardar}>Registrar y aprobar</Boton></div>
  </Hoja>;
}

/* ---------- Horas extra ---------- */
function SinAlmuerzoPendientes({ alCambiar }) {
  const lista = useCarga(() => api('adminSinAlmuerzo'), []), [correr, ocupado] = useAccion(), [rech, setRech] = useState(null);
  const decidir = async (x, decision, obs) => { if (await correr(() => api('adminSinAlmuerzoDecidir', { id: x.id, decision, obs }), decision === 'aprobar' ? 'Aprobado: ese día cuenta sin almuerzo.' : 'Rechazado: se descuenta el almuerzo programado.')) { setRech(null); lista.recargar(true); alCambiar && alCambiar(); } };
  const pend = (lista.datos || []).filter((x) => x.estado === 'pendiente');
  if (!lista.datos || !lista.datos.length) return null;
  return <Tarjeta titulo={`Jornadas sin almuerzo${pend.length ? ` · ${pend.length} por aprobar` : ''}`}>
    <p className="suave chico" style={{ marginBottom: 8 }}>Si lo apruebas, el tiempo del almuerzo de ese día cuenta como trabajado (puede generar horas extra). Si lo rechazas, se descuenta el almuerzo programado de la obra.</p>
    <Tabla buscar={false} etiqueta="Jornadas sin almuerzo" filas={lista.datos} columnas={[
      { k: 'nombre', t: 'Persona', render: (x) => <><strong>{x.nombre}</strong><div className="chico suave">{x.centro}</div></> }, { k: 'fecha', t: 'Fecha', render: (x) => fechaCorta(x.fecha) },
      { k: 'autorizaNombre', t: 'Autorizó' }, { k: 'razon', t: 'Razón', render: (x) => <span className="chico">{x.razon}</span> },
      { k: 'estado', t: 'Estado', render: (x) => <Insignia tono={x.estado === 'aprobado' ? 'ok' : x.estado === 'rechazado' ? 'peligro' : 'aviso'}>{x.estado}</Insignia> },
      { k: 'a', t: '', acciones: true, orden: false, render: (x) => x.estado === 'pendiente' && <span className="fila fin" style={{ gap: 4 }}><Boton chico cargando={ocupado} onClick={() => decidir(x, 'aprobar', '')}>Aprobar</Boton><Boton chico variante="secundario" onClick={() => setRech({ x, obs: '' })}>Rechazar</Boton></span> }]} />
    <Hoja abierta={!!rech} alCerrar={() => setRech(null)} titulo="Rechazar jornada sin almuerzo">{rech && <div className="pila">
      <Campo como="textarea" rows={2} etiqueta="¿Por qué se rechaza?" value={rech.obs} onChange={(e) => setRech({ ...rech, obs: e.target.value })} />
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setRech(null)}>Cancelar</Boton><Boton variante="peligro" cargando={ocupado} disabled={rech.obs.trim().length < 5} onClick={() => decidir(rech.x, 'rechazar', rech.obs)}>Rechazar</Boton></div></div>}</Hoja>
  </Tarjeta>;
}
export function Extras({ modulos = {}, cfg = {} }) {
  const [comp, setComp] = useState(false), [soporteComp, setSoporteComp] = useState('');
  const [filtro, setFiltro] = useState('pendiente'), carga = useCarga(() => api('adminExtras', { estado: filtro === 'todas' ? '' : filtro }), [filtro]), [sel, setSel] = useState(null), [min, setMin] = useState(0), [obs, setObs] = useState(''), [tope, setTope] = useState(false), [correr, ocupado] = useAccion();
  const abrir = (x) => { setSel(x); setMin(Math.min(x.minCalc, x.superaDia ? 120 : x.minCalc)); setObs(''); setTope(false); };
  const decidir = async (decision) => { if (await correr(() => api('adminExtraDecidir', { id: sel.id, decision, min, obs, confirmaTope: tope, aCompensatorio: comp, soporte: comp ? soporteComp : undefined }), decision === 'aprobar' ? 'Horas extra aprobadas.' : 'Horas extra rechazadas.')) { setSel(null); carga.recargar(true); } };
  return <><Titulo t="Horas extra">La aplicación calcula el tiempo trabajado por encima de la jornada. Solo lo que apruebes aquí entra a la nómina.</Titulo>
    <SinAlmuerzoPendientes alCambiar={() => carga.recargar(true)} />
    <div style={{ marginBottom: 16 }}><Pestanas etiqueta="Filtro de horas extra" valor={filtro} alCambiar={setFiltro} opciones={[{ v: 'pendiente', t: 'Por aprobar' }, { v: 'aprobada', t: 'Aprobadas' }, { v: 'rechazada', t: 'Rechazadas' }, { v: 'todas', t: 'Todas' }]} /></div>
    <Estado carga={carga}>{(l) => { const lote = l.filter((x) => x.estado === 'pendiente' && !x.superaDia && !x.cerrado); return <div className="pila">
      {filtro === 'pendiente' && lote.length > 1 && <div className="fila entre"><span className="suave chico">{lote.length} registro(s) están dentro del tope legal de 2 horas diarias. Los que lo superan se deciden uno por uno.</span>
        <Boton variante="secundario" icono={CheckCheck} cargando={ocupado} onClick={async () => { const r = await correr(() => api('adminExtrasLote', { ids: lote.map((x) => x.id) }, { espera: 120000 })); if (r) carga.recargar(true); }}>Aprobar las {lote.length} completas</Boton></div>}
      <Tabla columnas={[
      { k: 'fecha', t: 'Fecha', render: (x) => <span>{fechaCorta(x.fecha)}</span> }, { k: 'nombre', t: 'Persona', render: (x) => <strong>{x.nombre}</strong> },
      { k: 'minCalc', t: 'Calculadas', num: true, render: (x) => horas(x.minCalc) }, { k: 'minAprob', t: 'Aprobadas', num: true, render: (x) => x.minAprob === null ? '—' : horas(x.minAprob), valor: (x) => x.minAprob || 0 },
      { k: 'av', t: 'Avisos', orden: false, render: (x) => <span className="fila" style={{ gap: 4 }}>{x.superaDia && <Insignia tono="peligro">más de 2 h en el día</Insignia>}{x.superaSemana && <Insignia tono="peligro">más de 12 h en la semana</Insignia>}{x.obs && <span className="suave chico">{x.obs}</span>}</span> },
      { k: 'estado', t: 'Estado', render: (x) => <Insignia tono={{ pendiente: 'aviso', aprobada: 'ok', rechazada: 'peligro' }[x.estado]}>{x.estado}</Insignia> },
      { k: 'a', t: '', acciones: true, orden: false, render: (x) => x.cerrado ? <Insignia>cerrado</Insignia> : <Boton chico variante={x.estado === 'pendiente' ? 'primario' : 'secundario'} onClick={() => abrir(x)}>{x.estado === 'pendiente' ? 'Decidir' : 'Cambiar'}</Boton> }]}
      filas={l} clave={(x) => x.id} vacio={filtro === 'pendiente' ? 'No hay horas extra por aprobar.' : 'No hay registros.'} /></div>; }}</Estado>
    <Hoja abierta={!!sel} alCerrar={() => setSel(null)} titulo="Aprobar horas extra" alto={0.75}>{sel && <>
      <p><strong>{sel.nombre}</strong> · {fechaCorta(sel.fecha)}. Tiempo extra calculado: <strong className="num">{horas(sel.minCalc)}</strong>.</p>
      <Campo etiqueta="Minutos que apruebas" type="number" min="1" max={sel.minCalc} value={min} onChange={(e) => setMin(+e.target.value)} ayuda={`Equivale a ${horas(min)}. Máximo ${sel.minCalc} min.`} />
      {modulos.nomina && cfg.compensarExtras && <Casilla checked={comp} onChange={(e) => setComp(e.target.checked)}>Abonarlas al banco de compensatorios en vez de pagarlas. Se abonan con su recargo (2 h extra diurnas = 2,5 h de descanso). Escribe en la observación el acuerdo firmado con el trabajador.</Casilla>}
      {comp && <div className="campo"><label htmlFor="sopx">Foto del acuerdo firmado</label><input id="sopx" className="entrada" style={{ paddingTop: 10 }} type="file" accept="image/*" onChange={async (e) => { const f0 = e.target.files[0]; setSoporteComp(f0 ? await comprimirArchivo(f0) : ''); }} /></div>}
      {min > 120 && <><Aviso tono="peligro">Supera el máximo legal de <strong>2 horas extra por día</strong> (y 12 por semana). Solo procede con autorización del Ministerio del Trabajo o en las excepciones de ley.</Aviso>
        <Casilla checked={tope} onChange={(e) => setTope(e.target.checked)}>Confirmo que la empresa cuenta con el soporte para superar el tope. Queda registrado con mi usuario.</Casilla></>}
      <Campo etiqueta="Observación" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} />
      <div className="acciones-hoja"><Boton variante="secundario" cargando={ocupado} onClick={() => decidir('rechazar')}>Rechazar</Boton><Boton cargando={ocupado} disabled={!(min > 0) || min > sel.minCalc || (min > 120 && !tope)} onClick={() => decidir('aprobar')}>Aprobar {horas(min)}</Boton></div></>}</Hoja></>;
}

/* ---------- Incapacidades ---------- */
const TIPO_INC = { general: 'Enfermedad general', laboral: 'Accidente o enfermedad laboral', maternidad: 'Licencia de maternidad', paternidad: 'Licencia de paternidad' };
export function Incapacidades() {
  const [edit, setEdit] = useState(null);
  const carga = useCarga(() => api('adminIncapacidades'), []), personas = useCarga(() => api('adminPersonal'), []), [nuevo, setNuevo] = useState(false), [borrar, setBorrar] = useState(null), [f, campo, setF] = useForm({}), [soporte, setSoporte] = useState(''), [correr, ocupado] = useAccion(), avisos = useAvisos();
  const abrir = () => { setF({ cedula: '', tipo: 'general', desde: hoyISO(), hasta: hoyISO(), entidad: '', nota: '' }); setSoporte(''); setNuevo(true); };
  const guardar = async () => { if (await correr(() => api('adminIncapacidadGuardar', { ...f, soporte }), 'Incapacidad registrada.')) { setNuevo(false); carga.recargar(true); } };
  const eliminar = async () => { if (await correr(() => api('adminIncapacidadGuardar', { ...borrar, borrar: true }), 'Incapacidad eliminada.')) { setBorrar(null); carga.recargar(true); } };
  return <><Titulo t="Incapacidades" accion={<Boton icono={Plus} onClick={abrir}>Registrar incapacidad</Boton>}>Los días de incapacidad no cuentan como ausencia y se liquidan según su tipo. No se guarda el diagnóstico.</Titulo>
    <Estado carga={carga}>{(l) => <Tabla columnas={[{ k: 'nombre', t: 'Persona', render: (i) => <strong>{i.nombre}</strong> }, { k: 'tipo', t: 'Tipo', render: (i) => TIPO_INC[i.tipo], texto: (i) => TIPO_INC[i.tipo] }, { k: 'desde', t: 'Desde', render: (i) => fechaCorta(i.desde) }, { k: 'hasta', t: 'Hasta', render: (i) => fechaCorta(i.hasta) }, { k: 'dias', t: 'Días', num: true }, { k: 'entidad', t: 'Entidad' },
      { k: 'a', t: '', acciones: true, orden: false, render: (i) => <span className="fila fin" style={{ gap: 4 }}><Boton chico variante="secundario" icono={Pencil} onClick={() => setEdit({ id: i.id, tipo: i.tipo, desde: i.desde, hasta: i.hasta, entidad: i.entidad || '', nota: i.nota || '', nombre: i.nombre })}>Editar</Boton><Boton chico variante="texto" onClick={() => setBorrar(i)}>Eliminar</Boton></span> }]} filas={l} clave={(i) => i.id} vacio="No hay incapacidades registradas." />}</Estado>
    <Hoja abierta={nuevo} alCerrar={() => setNuevo(false)} titulo="Registrar incapacidad">
      <Campo como="select" etiqueta="Persona" {...campo('cedula')}><option value="">Elige…</option>{(personas.datos || []).filter((u) => u.estado !== 'inactivo').map((u) => <option key={u.cedula} value={u.cedula}>{u.nombre}</option>)}</Campo>
      <Campo como="select" etiqueta="Tipo" opciones={Object.keys(TIPO_INC).map((k) => ({ v: k, t: TIPO_INC[k] }))} {...campo('tipo')} />
      {f.tipo === 'general' && <Aviso>Se liquida al 66,67 % del salario, sin bajar del mínimo diario. Los dos primeros días los asume el empleador y desde el tercero la EPS.</Aviso>}
      <div className="rejilla"><Campo etiqueta="Desde" type="date" {...campo('desde')} /><Campo etiqueta="Hasta (incluido)" type="date" min={f.desde} {...campo('hasta')} /></div>
      <Campo etiqueta="Entidad que la expide" placeholder="EPS, ARL o IPS" {...campo('entidad')} /><Campo etiqueta="Nota interna" ayuda="No escribas el diagnóstico." {...campo('nota')} />
      <div className="campo"><label htmlFor="sinc">Soporte (foto del certificado, opcional)</label><input id="sinc" className="entrada" style={{ paddingTop: 10 }} type="file" accept="image/*" onChange={async (e) => { const a = e.target.files[0]; if (!a) return setSoporte(''); try { setSoporte(await comprimirArchivo(a)); } catch (x) { avisos.error(x); } }} /></div>
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setNuevo(false)}>Cancelar</Boton><Boton cargando={ocupado} disabled={!f.cedula} onClick={guardar}>Registrar</Boton></div>
    </Hoja>
    <Confirmar abierta={!!borrar} titulo="Eliminar incapacidad" texto="Eliminar" variante="peligro" cargando={ocupado} alCerrar={() => setBorrar(null)} alConfirmar={eliminar}>Los días volverán a contarse como ausencia si la persona no marcó.</Confirmar><Hoja abierta={!!edit} alCerrar={() => setEdit(null)} titulo={edit ? `Editar incapacidad · ${edit.nombre}` : ''}>{edit && <>
      <Campo como="select" etiqueta="Tipo" value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })} opciones={Object.keys(TIPO_INC).map((k) => ({ v: k, t: TIPO_INC[k] }))} />
      <div className="rejilla"><Campo etiqueta="Desde" type="date" value={edit.desde} onChange={(e) => setEdit({ ...edit, desde: e.target.value })} /><Campo etiqueta="Hasta (incluido)" type="date" min={edit.desde} ayuda="Para una prórroga, extiende esta fecha." value={edit.hasta} onChange={(e) => setEdit({ ...edit, hasta: e.target.value })} /></div>
      <Campo etiqueta="Entidad" value={edit.entidad} onChange={(e) => setEdit({ ...edit, entidad: e.target.value })} /><Campo etiqueta="Nota interna" value={edit.nota} onChange={(e) => setEdit({ ...edit, nota: e.target.value })} />
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton><Boton cargando={ocupado} onClick={async () => { if (await correr(() => api('adminIncapacidadEditar', edit), 'Incapacidad actualizada.')) { setEdit(null); carga.recargar(true); } }}>Guardar</Boton></div></>}</Hoja></>;
}

/* ---------- Archivos planos (CSV) para software contable y pago masivo ---------- */
export const CONCEPTOS = { SAL: 'Salario básico / días trabajados', VAC: 'Vacaciones disfrutadas', ING: 'Incapacidad enfermedad general', IN5: 'Incapacidad general desde el día 91', INL: 'Incapacidad laboral / licencia', DR: 'Descanso dominical y festivo remunerado', DNC: 'Dominical no causado por ausencia', BON: 'Bonos y pagos salariales', BNS: 'Auxilios no salariales', DES: 'Descuentos', AUS: 'Ausencias sin justificar', PNR: 'Permisos no remunerados (días)', PNH: 'Permisos no remunerados (horas)', RN: 'Recargo nocturno', DF: 'Dominical / festivo diurno', DFN: 'Dominical / festivo nocturno', HED: 'Hora extra diurna', HEN: 'Hora extra nocturna', HEDF: 'Hora extra diurna dominical / festiva', HENF: 'Hora extra nocturna dominical / festiva', AUX: 'Auxilio de transporte', SLD: 'Aporte a salud', PEN: 'Aporte a pensión', FSP: 'Fondo de solidaridad pensional' };
function bajarCsv(filas, nombre) {
  const celda = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s) && isNaN(+s)) s = "'" + s; return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + filas.map((f) => f.map(celda).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export async function planoContable(lista, p) {
  const cod = (await api('adminConfig')).codigosConcepto || {}, filas = [['Periodo desde', 'Periodo hasta', 'Cedula', 'Nombre', 'Codigo concepto', 'Concepto', 'Naturaleza', 'Cantidad', 'Valor']];
  lista.forEach((n) => { const q = n.detalle; q.conceptos.forEach((c) => filas.push([p.desde, p.hasta, n.cedula, n.nombre, cod[c.cod] || c.cod, c.concepto, c.valor < 0 ? 'DESCUENTO' : 'DEVENGO', c.cantidad, Math.abs(c.valor)]));
    q.deduccionesDet.forEach((c) => filas.push([p.desde, p.hasta, n.cedula, n.nombre, cod[c.cod] || c.cod, c.concepto, 'DEDUCCION', c.cantidad, c.valor])); });
  bajarCsv(filas, `plano-conceptos-${p.desde}-a-${p.hasta}.csv`);
}
export async function planoPagos(lista, p) {
  const per = {}; (await api('adminPersonal')).forEach((u) => { per[u.cedula] = u; });
  bajarCsv([['Tipo documento', 'Cedula', 'Nombre', 'Banco', 'Tipo de cuenta', 'Numero de cuenta', 'Valor a pagar', 'Referencia']].concat(lista.filter((n) => n.neto > 0).map((n) => { const u = per[n.cedula] || {}; return ['CC', n.cedula, n.nombre, u.banco || '', u.tipoCuenta || '', u.cuenta || '', Math.round(n.neto), `NOMINA ${p.desde} A ${p.hasta}`]; })), `plano-pagos-${p.desde}-a-${p.hasta}.csv`);
}

/* ---------- Nómina ---------- */
export function Nomina({ cfg, modulos = {}, irA }) {
  const [tab, setTab] = useState('previa'), [r, setR] = useState(() => periodoActual(cfg.periodoNomina)), previa = useCarga(() => api('adminNominaPrevia', r, { espera: 120000 }), [r.desde, r.hasta]), cerradas = useCarga(() => api('adminNominas'), [tab]);
  const [sel, setSel] = useState(null), [cerrar, setCerrar] = useState(false), [det, setDet] = useState(null), [desp, setDesp] = useState(null), [correr, ocupado] = useAccion();
  const hacerCierre = async () => { if (await correr(() => api('adminNominaCerrar', r, { espera: 180000 }), 'Periodo cerrado: los desprendibles ya están disponibles para cada trabajador.')) { setCerrar(false); previa.recargar(); setTab('cerradas'); } };
  const verCerrada = async (p) => { const l = await correr(() => api('adminNominaDetalle', p)); if (l) setDet({ p, l }); };
  if (desp) return <Desprendible n={desp} alVolver={() => setDesp(null)} />;
  const inco = useCarga(() => api('adminNominaInconsistencias', r), [r.desde, r.hasta, tab]);
  const paso = previa.datos?.cerrado ? 4 : (inco.datos && !inco.datos.items.some((x) => x.nivel !== 'info') ? 2 : 1);
  return <><Titulo t="Nómina y desprendibles">Liquidación estimada con la normativa vigente. Al cerrar el periodo se generan los desprendibles y ese periodo queda congelado.</Titulo>
    <ol className="flujo-nomina" aria-label="Pasos para pagar la quincena">{[['Revisar inconsistencias', 1], ['Revisar la previa', 2], ['Cerrar el periodo', 3], ['Desprendibles y archivo para el banco', 4]].map(([t, n]) =>
      <li key={n} className={n < paso ? 'hecho' : n === paso ? 'actual' : ''} aria-current={n === paso ? 'step' : undefined}><span>{n < paso ? '✓' : n}</span>{t}</li>)}</ol>
    {tab === 'previa' && inco.datos && inco.datos.items.length > 0 && !previa.datos?.cerrado && <Tarjeta titulo={`Antes de cerrar: ${inco.datos.items.filter((x) => x.nivel !== 'info').length} punto(s) por resolver`} className="inconsistencias">
      <ul className="lista">{inco.datos.items.map((x) => <li key={x.id}><span className="crece"><Insignia tono={x.nivel === 'bloquea' ? 'peligro' : x.nivel === 'revisar' ? 'aviso' : 'info'}>{x.cantidad}</Insignia> <strong>{x.titulo}</strong>
        <div className="chico suave">{x.ayuda}</div>{x.detalle.length > 0 && <div className="chico">{x.detalle.join(' · ')}{x.cantidad > x.detalle.length ? ` · y ${x.cantidad - x.detalle.length} más` : ''}</div>}</span>
        <Boton chico variante="secundario" onClick={() => irA && irA(x.destino)}>Resolver</Boton></li>)}</ul></Tarjeta>}
    {tab === 'previa' && inco.datos && !inco.datos.items.length && !previa.datos?.cerrado && <Aviso tono="ok">Sin inconsistencias en este periodo: revisa la previa y ciérralo.</Aviso>}
    <div style={{ marginBottom: 16 }}><Pestanas etiqueta="Vista de nómina" valor={tab} alCambiar={(v) => { setTab(v); setDet(null); }} opciones={[{ v: 'previa', t: 'Periodo por liquidar' }, { v: 'novedades', t: 'Bonos y descuentos' }, { v: 'cerradas', t: 'Periodos cerrados' }].concat(modulos.nomina ? [{ v: 'provisiones', t: 'Provisiones' }, { v: 'liquidacion', t: 'Liquidación de contrato' }] : [])} /></div>
    {tab === 'provisiones' ? <Provisiones cfg={cfg} /> : tab === 'liquidacion' ? <LiquidacionContrato /> : tab === 'novedades' ? <NovedadesPago r={r} setR={setR} alCambiar={() => previa.recargar(true)} /> : tab === 'previa' ? <>
      <div className="fila entre" style={{ marginBottom: 16, alignItems: 'flex-end' }}><Rango r={r} setR={setR} />
        <Boton icono={Lock} disabled={!previa.datos || previa.datos.cerrado || r.hasta >= hoyISO()} onClick={() => setCerrar(true)}>Cerrar periodo</Boton></div>
      <Estado carga={previa} lineas={8}>{(d) => <div className="pila">
        {d.cerrado && <Aviso>Este rango ya tiene una nómina cerrada. Consúltala en «Periodos cerrados».</Aviso>}
        {!d.cerrado && r.hasta >= hoyISO() && <Aviso>El periodo sigue en curso: los valores van hasta {fechaCorta(d.corte)} y podrás cerrarlo desde el {fechaCorta(sumarDias(r.hasta, 1))}.</Aviso>}
        {d.porRevisar > 0 && <Aviso tono="peligro"><strong>{d.porRevisar} marcación(es) digitadas o tardías sin revisar.</strong> Revísalas en Marcaciones: no se puede cerrar el periodo mientras estén pendientes.</Aviso>}
        {d.extrasPendientes > 0 && <Aviso tono="aviso"><strong>{d.extrasPendientes} registro(s) de horas extra sin aprobar</strong> en este periodo: no se están pagando.</Aviso>}
        {d.permisosPendientes > 0 && <Aviso tono="aviso"><strong>{d.permisosPendientes} permiso(s) sin resolver</strong>: mientras no se aprueben, esos días cuentan como ausencia.</Aviso>}
        <div className="indicadores"><div className="indicador n-info"><span className="valor">{d.filas.length}</span><span className="rotulo">Personas</span></div><div className="indicador"><span className="valor">{pesos(d.filas.reduce((s, x) => s + x.liq.devengado, 0))}</span><span className="rotulo">Total devengado</span></div><div className="indicador n-ok"><span className="valor">{pesos(d.filas.reduce((s, x) => s + x.liq.neto, 0))}</span><span className="rotulo">Neto a pagar</span></div></div>
        <Tabla columnas={[{ k: 'nombre', t: 'Persona', render: (x) => <><strong>{x.nombre}</strong>{!x.salarioOk && <div><Insignia tono="aviso">salario sin validar</Insignia></div>}</> }, { k: 'centro', t: 'Centro' },
          { k: 'h', t: 'Horas', num: true, valor: (x) => x.liq.horas.trabajadas, render: (x) => horasDec(x.liq.horas.trabajadas) }, { k: 'e', t: 'Extra', num: true, valor: (x) => x.liq.horas.extras, render: (x) => <>{horasDec(x.liq.horas.extras)}{x.liq.horas.extrasSinAprobar > 0 && <div className="suave chico">+{horasDec(x.liq.horas.extrasSinAprobar)} sin aprobar</div>}</> },
          { k: 'au', t: 'Ausencias', num: true, valor: (x) => x.liq.ausencias, render: (x) => x.liq.ausencias || '' }, { k: 'dev', t: 'Devengado', num: true, valor: (x) => x.liq.devengado, render: (x) => pesos(x.liq.devengado) }, { k: 'neto', t: 'Neto', num: true, valor: (x) => x.liq.neto, render: (x) => <strong>{pesos(x.liq.neto)}</strong> },
          { k: 'a', t: '', acciones: true, orden: false, render: (x) => <Boton chico variante="secundario" onClick={() => setSel(x)}>Detalle</Boton> }]} filas={d.filas} clave={(x) => x.cedula} vacio="No hay personal con salario para liquidar en este periodo." />
      </div>}</Estado></> :
      det ? <div className="pila"><div className="fila entre"><Boton variante="texto" onClick={() => setDet(null)}>← Periodos</Boton><Boton variante="secundario" icono={Download} onClick={() => aExcel({ 'Nómina': det.l.map((n) => { const q = n.detalle, v = (c) => q.conceptos.filter((k) => c.includes(k.cod)).reduce((s, k) => s + k.valor, 0); return { 'Cédula': n.cedula, Nombre: n.nombre, 'Días': q.diasNomina, 'Horas trabajadas': q.horas.trabajadas, 'Horas extra': q.horas.extras, Ausencias: q.ausencias, 'Salario básico': v(['SAL']), Recargos: v(['RN', 'DF', 'DFN']), 'Horas extra $': v(['HED', 'HEN', 'HEDF', 'HENF']), 'Auxilio transporte': v(['AUX']), Devengado: q.devengado, Deducciones: q.deducciones, Neto: q.neto }; }) }, `nomina-${det.p.desde}-a-${det.p.hasta}.xlsx`)}>Excel</Boton>
        <Boton variante="secundario" icono={Download} onClick={() => correr(() => planoContable(det.l, det.p), 'Plano de conceptos descargado.')}>Plano contable (CSV)</Boton><Boton variante="secundario" icono={Download} onClick={() => correr(() => planoPagos(det.l, det.p), 'Plano de pagos descargado.')}>Plano de pagos (CSV)</Boton></div>
        <Tabla columnas={[{ k: 'nombre', t: 'Persona', render: (n) => <strong>{n.nombre}</strong> }, { k: 'cedula', t: 'Cédula' }, { k: 'neto', t: 'Neto pagado', num: true, render: (n) => pesos(n.neto) }, { k: 'a', t: '', acciones: true, orden: false, render: (n) => <Boton chico variante="secundario" icono={FileText} onClick={() => setDesp(n)}>Desprendible</Boton> }]} filas={det.l} clave={(n) => n.id} /></div> :
        <Estado carga={cerradas}>{(l) => <Tabla buscar={false} columnas={[{ k: 'desde', t: 'Periodo', render: (p) => <strong>{fechaCorta(p.desde)} – {fechaCorta(p.hasta)}</strong> }, { k: 'personas', t: 'Personas', num: true }, { k: 'neto', t: 'Neto total', num: true, render: (p) => pesos(p.neto) }, { k: 'cerradoEl', t: 'Cerrado', render: (p) => fechaHora(p.cerradoEl) },
          { k: 'a', t: '', acciones: true, orden: false, render: (p) => <Boton chico variante="secundario" cargando={ocupado} onClick={() => verCerrada(p)}>Ver desprendibles</Boton> }]} filas={l} clave={(p) => p.desde} vacio="Aún no se ha cerrado ningún periodo." />}</Estado>}
    <Hoja abierta={!!sel} alCerrar={() => setSel(null)} titulo={sel ? sel.nombre : ''}>{sel && <><p className="suave chico">{sel.liq.diasNomina} días liquidados · {horasDec(sel.liq.horas.trabajadas)} trabajadas · {sel.liq.tardanzas} tardanza(s) · valor hora {pesos(sel.liq.valorHora)}</p><Liquidacion l={sel.liq} />
      {sel.liq.ausentes.length > 0 && <Aviso tono="aviso">Ausencias: {sel.liq.ausentes.map(fechaCorta).join(', ')}</Aviso>}{sel.liq.incompletos.length > 0 && <Aviso tono="aviso">Jornadas sin salida (no suman horas): {sel.liq.incompletos.map(fechaCorta).join(', ')}</Aviso>}</>}</Hoja>
    <Confirmar abierta={cerrar} titulo="Cerrar el periodo" texto="Cerrar y generar desprendibles" cargando={ocupado} alCerrar={() => setCerrar(false)} alConfirmar={hacerCierre}>
      <p>Del {fechaCorta(r.desde)} al {fechaCorta(r.hasta)}. Después del cierre <strong>no se podrán cambiar</strong> marcaciones, permisos, extras ni incapacidades de esas fechas.</p>
      {previa.datos && (previa.datos.extrasPendientes > 0 || previa.datos.permisosPendientes > 0) && <Aviso tono="peligro">Aún hay horas extra o permisos sin resolver en este periodo. Si cierras ahora, no se pagarán.</Aviso>}</Confirmar></>;
}

function NovedadesPago({ r, setR, alCambiar }) {
  const carga = useCarga(() => api('adminNovedades', r), [r.desde, r.hasta]), personas = useCarga(() => api('adminPersonal'), []), [nuevo, setNuevo] = useState(false), [f, campo, setF] = useForm({}), [sel, setSel] = useState([]), [correr, ocupado] = useAccion();
  const abrir = () => { setF({ tipo: 'salarial', fecha: hoyISO() < r.hasta ? hoyISO() : r.hasta, concepto: '', valor: '', nota: '' }); setSel([]); setNuevo(true); };
  const guardar = async () => { if (await correr(() => api('adminNovedadGuardar', { ...f, valor: +String(f.valor).replace(/\D/g, ''), cedulas: sel }), 'Novedad registrada.')) { setNuevo(false); carga.recargar(true); alCambiar(); } };
  const borrar = async (x) => { if (await correr(() => api('adminNovedadGuardar', { id: x.id, borrar: true }), 'Novedad eliminada.')) { carga.recargar(true); alCambiar(); } };
  const activos = (personas.datos || []).filter((u) => u.estado === 'activo');
  return <><div className="fila entre" style={{ marginBottom: 16, alignItems: 'flex-end' }}><Rango r={r} setR={setR} /><Boton icono={Plus} onClick={abrir}>Agregar bono o descuento</Boton></div>
    <p className="suave chico" style={{ marginBottom: 12 }}>Pagos y descuentos que no salen de las marcaciones: bonos, comisiones, rodamiento, viáticos, préstamos, dotación. Entran a la liquidación del periodo de su fecha. Para corregir un periodo ya cerrado, registra el ajuste con fecha del periodo abierto.</p>
    <Estado carga={carga}>{(l) => <Tabla columnas={[{ k: 'fecha', t: 'Fecha', render: (x) => fechaCorta(x.fecha) }, { k: 'nombre', t: 'Persona', render: (x) => <strong>{x.nombre}</strong> }, { k: 'concepto', t: 'Concepto' },
      { k: 'tipo', t: 'Tipo', render: (x) => <Insignia tono={x.valor < 0 ? 'peligro' : x.salarial ? 'ok' : 'info'}>{x.valor < 0 ? 'Descuento' : x.salarial ? 'Salarial' : 'No salarial'}</Insignia>, texto: (x) => (x.valor < 0 ? 'Descuento' : x.salarial ? 'Salarial' : 'No salarial') },
      { k: 'valor', t: 'Valor', num: true, render: (x) => pesos(Math.abs(x.valor)) }, { k: 'a', t: '', acciones: true, orden: false, render: (x) => x.cerrado ? <Insignia>cerrado</Insignia> : <Boton chico variante="texto" icono={Trash2} cargando={ocupado} onClick={() => borrar(x)}>Eliminar</Boton> }]}
      filas={l} clave={(x) => x.id} vacio="No hay bonos ni descuentos en este rango." />}</Estado>
    <Hoja abierta={nuevo} alCerrar={() => setNuevo(false)} titulo="Bono o descuento" alto={0.92}>
      <Campo como="select" etiqueta="Tipo" {...campo('tipo')} opciones={[{ v: 'salarial', t: 'Pago salarial (bono, comisión): cotiza a salud y pensión' }, { v: 'no_salarial', t: 'Pago no salarial (rodamiento, viáticos, auxilio)' }, { v: 'descuento', t: 'Descuento (préstamo, dotación, libranza)' }]} />
      <div className="rejilla"><Campo etiqueta="Concepto" placeholder="Ej.: Bono de alturas" maxLength={60} {...campo('concepto')} /><Campo etiqueta="Valor por persona ($)" inputMode="numeric" {...campo('valor')} /></div>
      <Campo etiqueta="Fecha" type="date" ayuda="Define en qué periodo se paga o se descuenta." {...campo('fecha')} />
      <SelectorPersonas personas={activos} sel={sel} setSel={setSel} />
      <Campo etiqueta="Nota (opcional)" maxLength={200} {...campo('nota')} />
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setNuevo(false)}>Cancelar</Boton><Boton cargando={ocupado} disabled={!sel.length} onClick={guardar}>Registrar para {sel.length} persona(s)</Boton></div>
    </Hoja></>;
}
function SelectorPersonas({ personas, sel, setSel }) {
  const [q, setQ] = useState(''), vis = personas.filter((u) => !q || (u.nombre + ' ' + u.cedula).toLowerCase().includes(q.toLowerCase()));
  return <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="pila junta"><legend className="etiqueta">Personas ({sel.length} elegidas)</legend>
    <div className="fila"><BotonDictar valor={q} alCambiar={setQ} etiqueta="la búsqueda" /><input className="entrada crece" type="search" placeholder="Buscar por nombre o cédula" aria-label="Buscar persona" value={q} onChange={(e) => setQ(e.target.value)} /><Boton chico variante="secundario" onClick={() => setSel(sel.length === vis.length ? [] : vis.map((u) => u.cedula))}>{sel.length === vis.length && vis.length ? 'Ninguna' : 'Todas'}</Boton></div>
    <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--c-borde)', borderRadius: 'var(--r-2)', padding: 8 }} className="pila junta">{vis.map((u) => <label key={u.cedula} className="fila" style={{ flexWrap: 'nowrap', minHeight: 36 }}><input type="checkbox" style={{ width: 20, height: 20, accentColor: 'var(--c-primario)' }} checked={sel.includes(u.cedula)} onChange={(e) => setSel(e.target.checked ? [...sel, u.cedula] : sel.filter((c) => c !== u.cedula))} /><span>{u.nombre}</span></label>)}{vis.length === 0 && <span className="suave chico">Sin coincidencias.</span>}</div></fieldset>;
}

/* ---------- Turnos rotativos ---------- */
const DIAS_C = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export function Turnos() {
  const carga = useCarga(() => api('adminTurnos'), []), personas = useCarga(() => api('adminPersonal'), []), [turno, setTurno] = useState(null), [prog, setProg] = useState(null), [sel, setSel] = useState([]), [correr, ocupado] = useAccion();
  const guardarTurno = async () => { if (await correr(() => api('adminTurnoGuardar', turno), 'Turno guardado.')) { setTurno(null); carga.recargar(true); } };
  const programar = async () => { if (await correr(() => api('adminProgramar', { ...prog, cedulas: sel }), 'Programación guardada.')) { setProg(null); carga.recargar(true); } };
  const quitar = async (p) => { if (await correr(() => api('adminProgramacionBorrar', { id: p.id }), 'Programación quitada.')) carga.recargar(true); };
  const activos = (personas.datos || []).filter((u) => u.estado === 'activo');
  return <><Titulo t="Turnos" accion={<><Boton variante="secundario" icono={Plus} onClick={() => setTurno({ nombre: '', e: '06:00', s: '14:00', ai: '', af: '', dias: [], activo: true })}>Crear turno</Boton><Boton icono={CalendarCheck} onClick={() => { setSel([]); setProg({ turnoId: '', desde: hoyISO(), hasta: sumarDias(hoyISO(), 6) }); }}>Programar personas</Boton></>}>Para quien no sigue el horario fijo de su obra: turnos de noche, rotaciones semanales y descansos. Mientras una persona tenga un turno programado, ese turno reemplaza el horario del centro.</Titulo>
    <Estado carga={carga}>{(d) => <div className="pila amplia">
      {d.turnos.length === 0 ? <Vacio icono={Timer} titulo="Aún no hay turnos">Crea los turnos de tu operación (por ejemplo: Mañana 06–14, Tarde 14–22, Noche 22–06) y luego prográmalos por fechas.</Vacio> :
        <div className="rejilla">{d.turnos.map((t) => <Tarjeta key={t.id}><div className="fila entre" style={{ alignItems: 'flex-start' }}><div><h3>{t.nombre}</h3><p className="num">{t.e}–{t.s}{t.ai ? ` · almuerzo ${t.ai}–${t.af}` : ''}</p><p className="suave chico">{horas(t.min)} por día · {t.dias.length ? t.dias.map((x) => DIAS_C[x]).join(', ') : 'todos los días del rango'}</p></div><Boton chico variante="secundario" icono={Pencil} onClick={() => setTurno(t)}>Editar</Boton></div>{t.min > 540 && <Aviso tono="aviso">Pasa de 9 horas diarias: el exceso se liquida como hora extra.</Aviso>}</Tarjeta>)}</div>}
      <Tarjeta titulo="Programación vigente y reciente"><Tabla columnas={[{ k: 'nombre', t: 'Persona', render: (p) => <strong>{p.nombre}</strong> }, { k: 'turno', t: 'Turno', render: (p) => p.turnoId === 'descanso' ? <Insignia>Descanso</Insignia> : p.turno }, { k: 'desde', t: 'Desde', render: (p) => fechaCorta(p.desde) }, { k: 'hasta', t: 'Hasta', render: (p) => fechaCorta(p.hasta) },
        { k: 'a', t: '', acciones: true, orden: false, render: (p) => p.cerrado ? <Insignia>cerrado</Insignia> : <Boton chico variante="texto" icono={Trash2} cargando={ocupado} onClick={() => quitar(p)}>Quitar</Boton> }]} filas={d.programacion} clave={(p) => p.id} vacio="Nadie tiene turnos programados: todos siguen el horario de su centro de trabajo." /></Tarjeta>
      <Hoja abierta={!!prog} alCerrar={() => setProg(null)} titulo="Programar personas" alto={0.92}>{prog && <>
        <Campo como="select" etiqueta="Turno" value={prog.turnoId} onChange={(e) => setProg({ ...prog, turnoId: e.target.value })}><option value="">Elige…</option>{d.turnos.filter((t) => t.activo).map((t) => <option key={t.id} value={t.id}>{t.nombre} ({t.e}–{t.s})</option>)}<option value="descanso">Descanso (no se espera que marque)</option></Campo>
        <div className="rejilla"><Campo etiqueta="Desde" type="date" value={prog.desde} onChange={(e) => setProg({ ...prog, desde: e.target.value })} /><Campo etiqueta="Hasta (incluido)" type="date" min={prog.desde} value={prog.hasta} onChange={(e) => setProg({ ...prog, hasta: e.target.value })} /></div>
        <SelectorPersonas personas={activos} sel={sel} setSel={setSel} />
        <p className="suave chico">Si una persona ya tenía otro turno en esas fechas, vale la programación más reciente.</p>
        <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setProg(null)}>Cancelar</Boton><Boton cargando={ocupado} disabled={!sel.length || !prog.turnoId} onClick={programar}>Programar a {sel.length} persona(s)</Boton></div></>}</Hoja>
    </div>}</Estado>
    <Hoja abierta={!!turno} alCerrar={() => setTurno(null)} titulo={turno?.id ? 'Editar turno' : 'Crear turno'} alto={0.8}>{turno && <>
      <Campo etiqueta="Nombre" placeholder="Ej.: Noche 22–06" value={turno.nombre} onChange={(e) => setTurno({ ...turno, nombre: e.target.value })} />
      <div className="rejilla"><Campo etiqueta="Entrada" type="time" value={turno.e} onChange={(e) => setTurno({ ...turno, e: e.target.value })} /><Campo etiqueta="Salida" type="time" ayuda="Si es menor que la entrada, termina al día siguiente." value={turno.s} onChange={(e) => setTurno({ ...turno, s: e.target.value })} /></div>
      <div className="rejilla"><Campo etiqueta="Inicio de la pausa (opcional)" type="time" value={turno.ai} onChange={(e) => setTurno({ ...turno, ai: e.target.value })} /><Campo etiqueta="Fin de la pausa" type="time" value={turno.af} onChange={(e) => setTurno({ ...turno, af: e.target.value })} /></div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="etiqueta">Días en que aplica (ninguno marcado = todos los días del rango programado)</legend><div className="fila" style={{ marginTop: 8 }}>{[1, 2, 3, 4, 5, 6, 0].map((x) => <label key={x} className="fila" style={{ gap: 4 }}><input type="checkbox" style={{ width: 20, height: 20, accentColor: 'var(--c-primario)' }} checked={turno.dias.includes(x)} onChange={(e) => setTurno({ ...turno, dias: e.target.checked ? [...turno.dias, x] : turno.dias.filter((y) => y !== x) })} />{DIAS_C[x]}</label>)}</div></fieldset>
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setTurno(null)}>Cancelar</Boton><Boton cargando={ocupado} onClick={guardarTurno}>Guardar turno</Boton></div></>}</Hoja></>;
}

/* ---------- Resumen por obra + exportación general ---------- */
export function Obras({ cfg, modulos = {} }) {
  const [vistaO, setVistaO] = useState('resumen');
  const [r, setR] = useState(() => periodoActual(cfg.periodoNomina)), carga = useCarga(() => api('adminResumenObra', r, { espera: 120000 }), [r.desde, r.hasta]), [correr, ocupado] = useAccion();
  const exportar = () => correr(async () => { const d = await api('adminExportar', r, { espera: 180000 }), { desde, hasta, empresa, ...hojas } = d; await aExcel(hojas, `jornada-${desde}-a-${hasta}.xlsx`); }, 'Archivo de Excel descargado.');
  return <><Titulo t="Resumen por obra" accion={<Boton icono={Download} cargando={ocupado} onClick={exportar}>Descargar todo a Excel</Boton>}>Horas, novedades y costo por centro de trabajo. El Excel trae personal, jornadas, extras, permisos, incapacidades, nómina y este resumen.</Titulo>
    <div style={{ marginBottom: 16 }}><Rango r={r} setR={setR} /></div>
    {modulos.presupuesto && <div style={{ marginBottom: 16 }}><Pestanas etiqueta="Vista" valor={vistaO} alCambiar={setVistaO} opciones={[{ v: 'resumen', t: 'Resumen' }, { v: 'presupuesto', t: 'Presupuesto' }]} /></div>}
    {vistaO === 'presupuesto' ? <Presupuesto /> : <>    <Estado carga={carga}>{(d) => <Tabla buscar={false} columnas={[{ k: 'centro', t: 'Centro de trabajo', render: (o) => <strong>{o.centro}</strong> }, { k: 'personas', t: 'Personas', num: true }, { k: 'dias', t: 'Días-persona', num: true }, { k: 'horas', t: 'Horas', num: true, render: (o) => horasDec(o.horas) }, { k: 'extras', t: 'Extra', num: true, render: (o) => horasDec(o.extras) }, { k: 'tardanzas', t: 'Tardanzas', num: true }, { k: 'ausencias', t: 'Ausencias', num: true }, { k: 'costo', t: 'Costo devengado', num: true, render: (o) => pesos(o.costo) }]}
      filas={d.obras} clave={(o) => o.centroId} vacio="No hay actividad en ese rango." />}</Estado>
    <p className="suave chico" style={{ marginTop: 12 }}>Las horas se cuentan en la obra donde se marcó. El costo corresponde al devengado del personal asignado a cada centro (sin prestaciones ni aportes del empleador).</p></>}</>;
}

/* ---------- Alertas ---------- */
export function Alertas() {
  const carga = useCarga(() => api('adminConfig'), []), bit = useCarga(() => api('adminBitacoras', { cual: 'alertas' }), []), [tab, setTab] = useState('config'), [f, setF] = useState(null), [correr, ocupado] = useAccion();
  useEffect(() => { if (carga.datos && !f) { const c = carga.datos; setF({ telegramSinNombres: c.telegramSinNombres !== false, alertasAgrupadas: !!c.alertasAgrupadas, telegramChatId: c.telegramChatId || '', telegramToken: '', correoAlertas: c.correoAlertas, minutosAusencia: c.minutosAusencia, fatigaHorasMax: c.fatigaHorasMax, fatigaAvisoMin: c.fatigaAvisoMin, recordatorioMin: c.recordatorioMin, recordatorioCorreo: c.recordatorioCorreo, alertas: Object.fromEntries(Object.keys(c.tiposAlerta).map((k) => [k, { activo: c.alertas[k]?.activo !== false, correos: c.alertas[k]?.correos || '' }])) }); } }, [carga.datos]); // eslint-disable-line
  const pon = (k, campo, v) => setF((x) => ({ ...x, alertas: { ...x.alertas, [k]: { ...x.alertas[k], [campo]: v } } }));
  return <><Titulo t="Alertas">Qué situaciones avisan por correo y a quién. Cada alerta puede tener sus propios destinatarios.</Titulo>
    <div style={{ marginBottom: 16 }}><Pestanas etiqueta="Vista de alertas" valor={tab} alCambiar={setTab} opciones={[{ v: 'config', t: 'Configurar' }, { v: 'historial', t: 'Historial' }]} /></div>
    {tab === 'config' ? <Estado carga={carga}>{(c) => f && <div className="pila">
      <Tarjeta titulo="Destinatarios y tiempos"><div className="pila">
        <Campo etiqueta="Correo general de alertas" type="text" placeholder="rrhh@empresa.co, jefe@empresa.co" ayuda="Varios correos separados por coma. Lo usa toda alerta que no tenga destinatarios propios." value={f.correoAlertas} onChange={(e) => setF({ ...f, correoAlertas: e.target.value })} />
        <div className="rejilla"><Campo etiqueta="Avisar ausencia a los (min)" type="number" min="5" ayuda="Minutos después de la hora de entrada sin marcar." value={f.minutosAusencia} onChange={(e) => setF({ ...f, minutosAusencia: e.target.value })} />
          <Campo etiqueta="Recordatorio de marcación (min)" type="number" min="0" ayuda="Antes de entrar y después de la hora de salida; igual en el almuerzo." value={f.recordatorioMin} onChange={(e) => setF({ ...f, recordatorioMin: e.target.value })} /></div>
        <div className="rejilla"><Campo etiqueta="Control de fatiga: máximo de horas continuas" type="number" min="0" step="0.5" ayuda="Jornada abierta, sin contar el almuerzo marcado. 0 = sin control." value={f.fatigaHorasMax} onChange={(e) => setF({ ...f, fatigaHorasMax: e.target.value })} />
          <Campo etiqueta="Avisar antes del máximo (min)" type="number" min="0" ayuda="La alerta sale estos minutos antes de llegar al límite." value={f.fatigaAvisoMin} onChange={(e) => setF({ ...f, fatigaAvisoMin: e.target.value })} /></div>
        <Casilla checked={f.alertasAgrupadas} onChange={(e) => setF({ ...f, alertasAgrupadas: e.target.checked })}>Agrupar tardanzas, ausencias y marcaciones fuera de zona en un resumen por hora (ahorra correos: Gmail gratuito permite 100 al día)</Casilla>
        <details><summary className="etiqueta" style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center' }}>Alertas también por Telegram (opcional)</summary><div className="pila" style={{ marginTop: 8 }}>
          <p className="suave chico">Crea un bot con @BotFather, agrégalo a un grupo y pega aquí su token y el número del grupo. Los mensajes llevan nombres y novedades del personal: menciónalo en tu política de privacidad.</p>
          <div className="rejilla"><Campo etiqueta={c.tieneTelegram ? 'Token del bot (guardado; escribe solo para cambiarlo)' : 'Token del bot'} type="password" autoComplete="off" value={f.telegramToken} onChange={(e) => setF({ ...f, telegramToken: e.target.value })} /><Campo etiqueta="Número del grupo (chat id)" value={f.telegramChatId} onChange={(e) => setF({ ...f, telegramChatId: e.target.value })} /></div></div></details>
        {f.telegramChatId && <Casilla checked={f.telegramSinNombres !== false} onChange={(e) => setF({ ...f, telegramSinNombres: e.target.checked })}>Enviar a Telegram sin nombres de personas (Telegram guarda los mensajes fuera de Colombia)</Casilla>}
        <Casilla checked={f.recordatorioCorreo} onChange={(e) => setF({ ...f, recordatorioCorreo: e.target.checked })}>Enviar además el recordatorio por correo al trabajador que no ha marcado (llega aunque tenga la aplicación cerrada)</Casilla>
      </div></Tarjeta>
      <Tarjeta titulo="Tipos de alerta"><div className="pila junta">{Object.keys(c.tiposAlerta).map((k) => <div key={k} className="fila" style={{ alignItems: 'flex-end', borderTop: '1px solid var(--c-borde)', paddingTop: 12 }}>
        <label className="fila crece" style={{ minWidth: 220, flexWrap: 'nowrap' }}><input type="checkbox" checked={f.alertas[k].activo} onChange={(e) => pon(k, 'activo', e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--c-primario)' }} /><strong>{c.tiposAlerta[k]}</strong></label>
        <input className="entrada crece" style={{ minWidth: 220 }} aria-label={`Destinatarios de: ${c.tiposAlerta[k]}`} placeholder="Usa el correo general" disabled={!f.alertas[k].activo} value={f.alertas[k].correos} onChange={(e) => pon(k, 'correos', e.target.value)} /></div>)}</div></Tarjeta>
      <div className="fila fin"><Boton icono={Save} cargando={ocupado} onClick={() => correr(() => api('adminConfigGuardar', f), 'Alertas guardadas.')}>Guardar alertas</Boton></div>
    </div>}</Estado> :
      <Estado carga={bit}>{(l) => <Tabla columnas={[{ k: 'fecha', t: 'Fecha', render: (a) => fechaHora(a.fecha) }, { k: 'tipo', t: 'Alerta', render: (a) => carga.datos?.tiposAlerta[a.tipo] || a.tipo }, { k: 'cedula', t: 'Cédula' }, { k: 'detalle', t: 'Detalle' }, { k: 'estado', t: 'Envío', render: (a) => <Insignia tono={a.estado === 'enviada' ? 'ok' : a.estado === 'desactivada' ? '' : 'aviso'}>{a.estado}</Insignia> }]} filas={l} vacio="Aún no se han generado alertas." />}</Estado>}</>;
}

/* ---------- Configuración ---------- */
const PCT = ['recargoNocturno', 'extraDiurna', 'extraNocturna', 'recargoDominical', 'pctSalud', 'pctPension'];
export function Config({ centros, recargarYo, yo, tabInicial, modulos = {} }) {
  const carga = useCarga(() => api('adminConfig'), []), [tab, setTab] = useState(tabInicial || 'empresa'), [f, setF] = useState(null), [L, setL] = useState(null), [jefe, setJefe] = useState(null), [correr, ocupado] = useAccion(), avisos = useAvisos();
  useEffect(() => { const c = carga.datos; if (!c) return; setF(c); const e = c.legalEfectivo, l = { ...e, festivosExtra: (e.festivosExtra || []).join(', ') }; PCT.forEach((k) => { l[k] = e[k] === null || e[k] === undefined ? '' : Math.round(e[k] * 10000) / 100; }); setL(l); }, [carga.datos]);
  const pon = (k, v) => setF((x) => ({ ...x, [k]: v })), emp = (k, v) => setF((x) => ({ ...x, empresa: { ...x.empresa, [k]: v } }));
  const guardar = async (datos, msg) => { const r = await correr(() => api('adminConfigGuardar', datos), msg || 'Configuración guardada.'); if (r) { carga.recargar(true); recargarYo(); } };
  const guardarLegal = () => { const l = { ...L, festivosExtra: String(L.festivosExtra).split(/[,\s]+/).filter(Boolean) }; PCT.forEach((k) => { l[k] = L[k] === '' ? '' : +L[k] / 100; }); guardar({ legal: l }, 'Parámetros legales guardados.'); };
  const logo = async (e) => { const a = e.target.files[0]; if (!a) return; try { const u = await comprimirArchivo(a, 240, 0.8); emp('logo', u); } catch (x) { avisos.error(x); } };
  const num = (k, t, ayuda, extra) => <Campo etiqueta={t} type="number" min="0" ayuda={ayuda} value={f[k]} onChange={(e) => pon(k, e.target.value)} {...extra} />;
  const leg = (k, t, ayuda, tipo = 'number') => <Campo etiqueta={t} type={tipo} step="any" ayuda={ayuda} value={L[k] ?? ''} onChange={(e) => setL({ ...L, [k]: e.target.value })} />;
  return <><Titulo t="Configuración">Todo lo propio de la empresa se ajusta aquí, sin tocar el código.</Titulo>
    <div style={{ marginBottom: 16 }}><Pestanas etiqueta="Secciones de configuración" valor={tab} alCambiar={setTab} opciones={[{ v: 'empresa', t: 'Empresa' }, { v: 'reglas', t: 'Reglas de marcación' }, { v: 'jefes', t: 'Jefes que firman' }, { v: 'legal', t: 'Parámetros legales' }, { v: 'datos', t: 'Datos y respaldo' }, { v: 'seguridad', t: 'Seguridad' }, { v: 'licencia', t: 'Licencia y versión' }]} /></div>
    <Estado carga={carga}>{() => f && L && <div className="pila">
      {tab === 'empresa' && <Tarjeta titulo="Datos de la empresa"><div className="pila">
        <div className="rejilla"><Campo etiqueta="Razón social" value={f.empresa.nombre} onChange={(e) => emp('nombre', e.target.value)} /><Campo etiqueta="NIT" value={f.empresa.nit} onChange={(e) => emp('nit', e.target.value)} /></div>
        <div className="rejilla"><Campo etiqueta="Dirección" value={f.empresa.direccion} onChange={(e) => emp('direccion', e.target.value)} /><Campo etiqueta="Teléfono" value={f.empresa.telefono} onChange={(e) => emp('telefono', e.target.value)} /></div>
        <div className="rejilla"><div className="campo"><label htmlFor="logo">Logo</label><div className="fila">{f.empresa.logo && <img src={f.empresa.logo} alt="Logo actual" style={{ height: 44, background: '#fff', borderRadius: 6 }} />}<input id="logo" className="entrada crece" style={{ paddingTop: 10 }} type="file" accept="image/*" onChange={logo} /></div></div>
          <div className="pila junta"><Campo etiqueta="Color principal" type="color" ayuda="Se usa en el encabezado, la tarjeta del reloj y los botones. Si eliges un color claro, se oscurece solo para que la letra blanca se lea bien." value={f.empresa.color || '#0E4A5A'} onChange={(e) => emp('color', e.target.value)} />
            <div className="fila muestras-color" role="group" aria-label="Colores sugeridos">{[['#0E4A5A', 'Petróleo'], ['#1F3A93', 'Azul'], ['#14532D', 'Verde'], ['#7A1F2B', 'Vino'], ['#3B2F6B', 'Morado'], ['#262B33', 'Grafito']].map(([c, n]) => <button key={c} type="button" title={n} aria-label={`Color ${n}`} aria-pressed={f.empresa.color === c} style={{ background: c }} onClick={() => emp('color', c)} />)}</div>
            <div className="vista-color" style={{ background: `rgb(${colorLegible(/^#[0-9a-f]{6}$/i.test(f.empresa.color || '') ? f.empresa.color : '#0E4A5A').join(',')})` }}><span>Así se verá</span><strong>Llegué</strong></div></div></div>
        <div className="rejilla"><Campo etiqueta="Correo para derechos de datos personales" type="email" ayuda="Aparece en la política de privacidad." value={f.empresa.correoDatos} onChange={(e) => emp('correoDatos', e.target.value)} /><Campo etiqueta="Área responsable de los datos" value={f.empresa.responsableDatos} onChange={(e) => emp('responsableDatos', e.target.value)} /></div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="pila junta"><legend className="etiqueta">Contactos de emergencia que ve el personal</legend><span className="ayuda">Además de la empresa y los jefes. Por ejemplo: brigadista, enfermería, línea de la ARL.</span>
          {(f.contactosEmergencia || []).map((x, i) => <div className="fila" key={i}><input className="entrada crece" aria-label="Nombre" placeholder="Nombre" value={x.nombre} onChange={(e) => pon('contactosEmergencia', f.contactosEmergencia.map((y, k) => (k === i ? { ...y, nombre: e.target.value } : y)))} /><input className="entrada crece" aria-label="Rol" placeholder="Rol" value={x.rol} onChange={(e) => pon('contactosEmergencia', f.contactosEmergencia.map((y, k) => (k === i ? { ...y, rol: e.target.value } : y)))} /><input className="entrada crece" aria-label="Teléfono" inputMode="tel" placeholder="Teléfono" value={x.telefono} onChange={(e) => pon('contactosEmergencia', f.contactosEmergencia.map((y, k) => (k === i ? { ...y, telefono: e.target.value } : y)))} /><Boton chico variante="texto" aria-label="Quitar contacto" onClick={() => pon('contactosEmergencia', f.contactosEmergencia.filter((_, k) => k !== i))}>Quitar</Boton></div>)}
          <Boton chico variante="secundario" icono={Plus} onClick={() => pon('contactosEmergencia', [...(f.contactosEmergencia || []), { nombre: '', rol: '', telefono: '' }])}>Agregar contacto</Boton></fieldset>
        <Campo etiqueta="Titular del software" ayuda="Aparece en la página de propiedad intelectual." value={f.empresa.titularSoftware} onChange={(e) => emp('titularSoftware', e.target.value)} />
        <Campo como="select" etiqueta="Periodo de nómina" value={f.periodoNomina} onChange={(e) => pon('periodoNomina', e.target.value)} opciones={[{ v: 'quincenal', t: 'Quincenal' }, { v: 'mensual', t: 'Mensual' }]} />
        <div className="fila fin"><Boton icono={Save} cargando={ocupado} onClick={() => guardar({ empresa: f.empresa, periodoNomina: f.periodoNomina, contactosEmergencia: f.contactosEmergencia || [] })}>Guardar</Boton></div></div></Tarjeta>}

      {tab === 'reglas' && <Tarjeta titulo="Reglas de marcación y permisos"><div className="pila">
        <div className="rejilla">{num('fotoProbabilidad', 'Foto al azar (% de marcaciones)', '0 = nunca, 100 = siempre.', { max: 100 })}{num('radioDefecto', 'Radio por defecto de un centro (m)')}</div>
        <Casilla checked={!!f.marcarAlmuerzo} onChange={(e) => pon('marcarAlmuerzo', e.target.checked)}>Pedir que marquen la salida y el regreso del almuerzo. Si está apagado (recomendado), solo marcan llegada y salida, y se descuenta la hora de almuerzo del horario de la obra; quien no salió a almorzar lo reporta con «No salí a almuerzo».</Casilla>
        <Casilla checked={f.geocercaEstricta} onChange={(e) => pon('geocercaEstricta', e.target.checked)}>Impedir la marcación fuera del radio del centro de trabajo. Si está apagado, se deja marcar pero se genera una alerta.</Casilla>
        <div className="rejilla">{num('toleranciaMin', 'Tolerancia de llegada por defecto (min)')}{num('diasAtrasManual', 'Días hacia atrás para “Se me olvidó marcar”')}</div>
        <Casilla checked={!!f.compensarExtras} onChange={(e) => pon('compensarExtras', e.target.checked)}>Permitir abonar horas extra al banco de compensatorios en vez de pagarlas. Atención: el Ministerio del Trabajo (concepto 36107) considera que las horas extra se pagan con su recargo y no se compensan con tiempo. Actívalo solo con asesoría legal.</Casilla>
        <div className="rejilla">{num('factorPrestacional', 'Factor prestacional (%)', 'Se suma al costo en Informes: prestaciones, aportes y parafiscales del empleador. Suele estar entre 50 y 55 %.')}</div>
        <div className="rejilla">{num('horasLimitePermiso', 'Límite para responder un permiso (horas)', 'Pasado este tiempo sin todas las firmas, vence y te llega una alerta.')}{num('sesionDias', 'Duración de la sesión (días)', 'El usuario permanece ingresado en su celular este tiempo.')}</div>
        <Casilla checked={f.aprobacionFinalAdmin} onChange={(e) => pon('aprobacionFinalAdmin', e.target.checked)}>Después de las firmas de los jefes, exigir la aprobación final del administrador (recomendado)</Casilla>
        <Casilla checked={f.autoRegistro} onChange={(e) => pon('autoRegistro', e.target.checked)}>Permitir que personas no cargadas se registren con el código de la empresa (quedan pendientes de tu aprobación)</Casilla>
        {f.autoRegistro && <Campo etiqueta="Código de la empresa" ayuda="Compártelo solo con tu personal. Cámbialo si se filtra." value={f.codigoEmpresa} onChange={(e) => pon('codigoEmpresa', e.target.value)} />}
        <div className="fila fin"><Boton icono={Save} cargando={ocupado} onClick={() => guardar(Object.fromEntries(['marcarAlmuerzo', 'compensarExtras', 'factorPrestacional', 'fotoProbabilidad', 'radioDefecto', 'geocercaEstricta', 'toleranciaMin', 'diasAtrasManual', 'horasLimitePermiso', 'sesionDias', 'aprobacionFinalAdmin', 'autoRegistro', 'codigoEmpresa'].map((k) => [k, f[k]])))}>Guardar</Boton></div></div></Tarjeta>}

      {tab === 'jefes' && <Tarjeta titulo="Jefes que firman los permisos" accion={<Boton chico icono={Plus} onClick={() => setJefe({ nombre: '', cargo: '', email: '', whatsapp: '', centros: [], activo: true, pin: '' })}>Agregar jefe</Boton>}>
        <p className="suave chico" style={{ marginBottom: 12 }}>Cada permiso debe ser firmado por todos los jefes activos del centro de trabajo del solicitante. Firman desde un enlace que reciben por WhatsApp o correo, con su clave personal.</p>
        {f.jefes.length === 0 ? <Vacio titulo="Sin jefes configurados">Mientras no haya jefes, los permisos pasan directo a tu aprobación.</Vacio> :
          <ul className="lista">{f.jefes.map((j) => <li key={j.id}><div className="crece"><strong>{j.nombre}</strong> {!j.activo && <Insignia>inactivo</Insignia>}<div className="suave chico">{j.cargo} · {j.centros.length ? j.centros.map((id) => centros.find((c) => c.id === id)?.nombre).filter(Boolean).join(', ') : 'todos los centros'}{j.whatsapp ? ` · WhatsApp ${j.whatsapp}` : ''}</div></div><Boton chico variante="secundario" icono={Pencil} onClick={() => setJefe({ ...j, pin: '' })}>Editar</Boton></li>)}</ul>}</Tarjeta>}

      {tab === 'legal' && <Tarjeta titulo="Parámetros legales de liquidación"><div className="pila">
        <Aviso>Valores por defecto vigentes a noviembre de 2026: jornada de 42 h (Ley 2101 de 2021), trabajo nocturno desde las 19:00 y recargo dominical escalonado (Ley 2466 de 2025). Actualízalos cuando cambie el salario mínimo o la norma.</Aviso>
        <div className="rejilla">{leg('jornadaSemanalH', 'Jornada máxima semanal (h)')}{leg('divisorMensual', 'Divisor mensual de la hora', 'Salario ÷ este número = valor de la hora.')}</div>
        <div className="rejilla">{leg('nocheInicio', 'Inicio de jornada nocturna', '', 'time')}{leg('nocheFin', 'Fin de jornada nocturna', '', 'time')}</div>
        <div className="rejilla">{leg('recargoNocturno', 'Recargo nocturno (%)')}{leg('recargoDominical', 'Recargo dominical y festivo (%)', 'Vacío = escalonado de ley: 90 % hasta jun-2027, luego 100 %.')}</div>
        <div className="rejilla">{leg('extraDiurna', 'Hora extra diurna (%)')}{leg('extraNocturna', 'Hora extra nocturna (%)')}</div>
        <div className="rejilla">{leg('maxOrdinariaDiaH', 'Máximo de horas ordinarias por día', 'Con horario de más horas, el exceso es extra.')}{leg('jornadaDiaSinHorarioH', 'Jornada diaria si la persona no tiene horario (h)')}</div>
        <Casilla checked={!!L.descontarDominical} onChange={(e) => setL({ ...L, descontarDominical: e.target.checked })}>Descontar el dominical de la semana cuando hay una ausencia sin justificar (CST art. 173). Es una facultad del empleador: actívalo solo si tu reglamento lo aplica.</Casilla>
        <div className="rejilla">{leg('maxExtraDiaH', 'Máximo de horas extra por día')}{leg('maxExtraSemanaH', 'Máximo de horas extra por semana')}</div>
        <div className="rejilla">{leg('smmlv', 'Salario mínimo mensual ($)')}{leg('auxTransporte', 'Auxilio de transporte mensual ($)')}</div>
        <div className="rejilla">{leg('pctSalud', 'Aporte del trabajador a salud (%)')}{leg('pctPension', 'Aporte del trabajador a pensión (%)')}</div>
        {leg('festivosExtra', 'Días de descanso adicionales de la empresa', 'Fechas AAAA-MM-DD separadas por coma. Los festivos nacionales se calculan solos cada año.', 'text')}
        <div className="fila fin"><Boton icono={Save} cargando={ocupado} onClick={guardarLegal}>Guardar parámetros</Boton></div></div></Tarjeta>}

      {tab === 'legal' && <Tarjeta titulo="Aportes del empleador (provisiones y presupuesto)"><div className="pila">
        <div className="rejilla">{num('arlPct', 'Tarifa de ARL (%)', 'Riesgo I 0,522 · II 1,044 · III 2,436 · IV 4,35 · V 6,96. Para obra civil suele ser V.', { step: '0.001', min: '0.348', max: '6.96' })}</div>
        <Casilla checked={!!f.exoneradoAportes} onChange={(e) => pon('exoneradoAportes', e.target.checked)}>La empresa está exonerada de salud, SENA e ICBF para quienes ganan menos de 10 salarios mínimos (Estatuto Tributario art. 114-1). Aplica a personas jurídicas declarantes de renta y a personas naturales con dos o más trabajadores. Confírmalo con tu contador.</Casilla>
        <div className="fila fin"><Boton icono={Save} cargando={ocupado} onClick={() => guardar({ arlPct: +f.arlPct, exoneradoAportes: !!f.exoneradoAportes })}>Guardar</Boton></div></div></Tarjeta>}
      {tab === 'legal' && <Tarjeta titulo="Códigos de concepto para el archivo plano"><div className="pila">
        <p className="suave chico">Escribe el código que usa tu software contable para cada concepto. El archivo plano (CSV) de cada nómina cerrada sale con estos códigos; si dejas uno vacío, sale la sigla interna.</p>
        <div className="rejilla">{Object.keys(CONCEPTOS).map((k) => <Campo key={k} etiqueta={`${CONCEPTOS[k]} (${k})`} maxLength={20} value={(f.codigosConcepto || {})[k] || ''} onChange={(e) => pon('codigosConcepto', { ...(f.codigosConcepto || {}), [k]: e.target.value })} />)}</div>
        <div className="fila fin"><Boton icono={Save} cargando={ocupado} onClick={() => guardar({ codigosConcepto: f.codigosConcepto || {} }, 'Códigos guardados.')}>Guardar códigos</Boton></div></div></Tarjeta>}

      {tab === 'seguridad' && <Tarjeta titulo="Seguridad de la marcación y del acceso"><div className="pila">
        <Casilla checked={!!f.soloCentroAsignado} onChange={(e) => pon('soloCentroAsignado', e.target.checked)}>Cada persona solo marca en su centro asignado</Casilla>
        <Casilla checked={!!f.fotoEnAnomalia} onChange={(e) => pon('fotoEnAnomalia', e.target.checked)}>Pedir foto siempre que la marcación sea dudosa (fuera de la obra, GPS impreciso o desplazamiento imposible)</Casilla>
        <div className="rejilla">{num('maxPrecisionGps', 'Precisión mínima del GPS (m)', 'Rechaza ubicaciones con un margen de error mayor. 0 = no rechazar.')}{num('qrVentanaSeg', 'El QR de portería cambia cada (segundos)')}</div>
        {modulos.seguridadPro && <><Casilla checked={!!f.vincularDispositivo} onChange={(e) => pon('vincularDispositivo', e.target.checked)}>Vincular cada cuenta de trabajador a un solo celular (para cambiar de equipo: Personal → Editar → Liberar celular)</Casilla>
          <Casilla checked={!!f.admin2FA} onChange={(e) => pon('admin2FA', e.target.checked)}>Pedir a los administradores un código por correo al ingresar</Casilla></>}
        <div className="rejilla">{num('sesionAdminHoras', 'La sesión de un administrador dura (horas)')}{num('sesionDias', 'La sesión de un trabajador dura (días)')}</div>
        <div className="fila fin"><Boton icono={Save} cargando={ocupado} onClick={() => guardar(Object.fromEntries(['soloCentroAsignado', 'fotoEnAnomalia', 'maxPrecisionGps', 'qrVentanaSeg', 'vincularDispositivo', 'admin2FA', 'sesionAdminHoras', 'sesionDias'].map((k) => [k, f[k]])))}>Guardar</Boton></div></div></Tarjeta>}
      {tab === 'licencia' && <Licencia yo={yo} recargarYo={recargarYo} />}
      {tab === 'datos' && <Tarjeta titulo="Conservación de datos y copias de seguridad"><div className="pila">
        <div className="rejilla">{num('retencionFotosDias', 'Conservar las fotos (días)', 'Luego se eliminan solas.')}{num('retencionGpsDias', 'Conservar las coordenadas GPS (días)', 'Luego se borran; la marcación se conserva.')}</div>
        <div className="rejilla">{num('respaldoCadaDias', 'Copia de seguridad cada (días)', '0 = desactivada.')}{num('respaldoConservar', 'Copias que se conservan')}</div>
        <div className="rejilla">{num('retencionSoportesDias', 'Conservar soportes de permisos e incapacidades (días)', 'Después se borra la foto; el registro queda.')}{num('archivarMeses', 'Pasar marcaciones al archivo histórico después de (meses)', 'Solo periodos cerrados. El histórico queda en su propia carpeta y no se borra. 0 = nunca.')}</div>
        <Campo etiqueta="Versión de las políticas" ayuda="Si la cambias, todos deberán autorizar de nuevo el tratamiento de datos al entrar." value={f.versionLegal} onChange={(e) => pon('versionLegal', e.target.value)} />
        <div className="fila fin"><Boton icono={Save} cargando={ocupado} onClick={() => guardar(Object.fromEntries(['retencionFotosDias', 'retencionGpsDias', 'respaldoCadaDias', 'respaldoConservar', 'versionLegal', 'retencionSoportesDias', 'archivarMeses'].map((k) => [k, f[k]])))}>Guardar</Boton></div></div></Tarjeta>}
    </div>}</Estado>
    <Hoja abierta={!!jefe} alCerrar={() => setJefe(null)} titulo={jefe?.id ? 'Editar jefe' : 'Agregar jefe'}>{jefe && <>
      <div className="rejilla"><Campo etiqueta="Nombre" required value={jefe.nombre} onChange={(e) => setJefe({ ...jefe, nombre: e.target.value })} /><Campo etiqueta="Cargo" value={jefe.cargo} onChange={(e) => setJefe({ ...jefe, cargo: e.target.value })} /></div>
      <div className="rejilla"><Campo etiqueta="WhatsApp" inputMode="numeric" ayuda="Celular de 10 dígitos." value={jefe.whatsapp} onChange={(e) => setJefe({ ...jefe, whatsapp: e.target.value })} /><Campo etiqueta="Correo" type="email" ayuda="Recibe el enlace de firma y la constancia." value={jefe.email} onChange={(e) => setJefe({ ...jefe, email: e.target.value })} /></div>
      <Campo etiqueta={jefe.tienePin ? 'Nueva clave de firma (deja vacío para no cambiarla)' : 'Clave de firma'} type="password" inputMode="numeric" autoComplete="new-password" ayuda="6 a 8 números. Entrégasela solo al jefe: con ella firma los permisos. Tras cinco errores la firma se bloquea 6 horas." value={jefe.pin} onChange={(e) => setJefe({ ...jefe, pin: e.target.value.replace(/\D/g, '') })} />
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="pila junta"><legend className="etiqueta">Centros donde firma (ninguno marcado = todos)</legend>{centros.map((c) => <Casilla key={c.id} checked={jefe.centros.includes(c.id)} onChange={(e) => setJefe({ ...jefe, centros: e.target.checked ? [...jefe.centros, c.id] : jefe.centros.filter((x) => x !== c.id) })}>{c.nombre}</Casilla>)}</fieldset>
      <Casilla checked={jefe.activo} onChange={(e) => setJefe({ ...jefe, activo: e.target.checked })}>Activo</Casilla>
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setJefe(null)}>Cancelar</Boton><Boton cargando={ocupado} onClick={async () => { if (await correr(() => api('adminJefeGuardar', jefe), 'Jefe guardado.')) { setJefe(null); carga.recargar(true); } }}>Guardar jefe</Boton></div></>}</Hoja></>;
}

/* ---------- Sistema: monitoreo, errores, pruebas, respaldo, auditoría ---------- */
export function Sistema({ modulos = {} }) {
  const [aud, setAud] = useState(null);
  const salud = useCarga(() => api('adminSalud', {}, { espera: 90000 }), []), [tab, setTab] = useState('salud'), bit = useCarga(() => (tab === 'salud' ? Promise.resolve([]) : api('adminBitacoras', { cual: tab })), [tab]), [correr, ocupado] = useAccion();
  const NOMBRE_TAREA = { tareaCada5: 'Recordatorios y vencimiento de permisos (cada 5 min)', tareaCada15: 'Ausencias y jornadas sin salida (cada 15 min)', tareaDiaria: 'Limpieza de datos y copia de seguridad (diaria)' };
  return <><Titulo t="Sistema y respaldo" accion={<Boton variante="secundario" icono={RefreshCw} cargando={salud.cargando} onClick={() => salud.recargar()}>Revisar de nuevo</Boton>}>Estado del servicio, pruebas de funcionamiento, copias de seguridad, errores y auditoría.</Titulo>
    <div style={{ marginBottom: 16 }}><Pestanas etiqueta="Vista del sistema" valor={tab} alCambiar={setTab} opciones={[{ v: 'salud', t: 'Estado' }, { v: 'errores', t: 'Errores' }, { v: 'auditoria', t: 'Auditoría' }]} /></div>
    {tab === 'salud' ? <Estado carga={salud} lineas={8}>{(s) => <div className="pila">
      <div className="indicadores">
        <div className={`indicador n-${s.pruebas.every((p) => p.ok) ? 'ok' : 'peligro'}`}><span className="valor">{s.pruebas.filter((p) => p.ok).length}/{s.pruebas.length}</span><span className="rotulo">Pruebas correctas</span></div>
        <div className={`indicador n-${s.errores7d ? 'aviso' : 'ok'}`}><span className="valor">{s.errores7d}</span><span className="rotulo">Errores en 7 días</span></div>
        <div className={`indicador n-${s.disparadores.length >= 3 ? 'ok' : 'peligro'}`}><span className="valor">{s.disparadores.length}/3</span><span className="rotulo">Tareas automáticas</span></div>
        <div className={`indicador n-${s.cupoCorreo !== null && s.cupoCorreo < 15 ? 'peligro' : ''}`}><span className="valor">{s.cupoCorreo ?? '—'}</span><span className="rotulo">Correos disponibles hoy</span></div>
        <div className={`indicador n-${s.capacidad > 80 ? 'peligro' : ''}`}><span className="valor">{s.capacidad} %</span><span className="rotulo">Capacidad usada</span></div>
      </div>
      {s.disparadores.length < 3 && <Aviso tono="peligro">Faltan tareas automáticas: no habrá alertas de ausencia ni copias de seguridad. Abre la hoja de cálculo → menú «Control de jornada» → «Instalar o reparar».</Aviso>}
      <div className="rejilla dos">
        {modulos.seguridadPro && <Tarjeta titulo="Integridad de la auditoría"><div className="pila"><p className="suave chico">Cada cambio queda encadenado con el anterior. Si alguien edita a mano la hoja de auditoría, aquí se nota.</p>
          {aud && (aud.integra ? <Aviso tono="ok">Íntegra: {aud.total} registros sin alteraciones.</Aviso> : <Aviso tono="peligro">Se alteraron {aud.alteradas.length} registro(s): {aud.alteradas.slice(0, 5).map((x) => `${fechaHora(x.fecha)} (${x.accion})`).join(', ')}.</Aviso>)}
          <Boton variante="secundario" onClick={async () => { try { setAud(await api('adminVerificarAuditoria', {}, { espera: 90000 })); } catch (e) { setAud({ integra: false, alteradas: [{ fecha: '', accion: e.message }] }); } }}>Verificar ahora</Boton></div></Tarjeta>}
        <Tarjeta titulo="Pruebas de funcionamiento"><ul className="lista">{s.pruebas.map((p) => <li key={p.nombre}>{p.ok ? <Check size={18} color="var(--c-ok)" aria-hidden="true" /> : <X size={18} color="var(--c-peligro)" aria-hidden="true" />}<span className="crece">{p.nombre}</span><Insignia tono={p.ok ? 'ok' : 'peligro'}>{p.ok ? 'correcta' : 'falló'}</Insignia></li>)}</ul></Tarjeta>
        <Tarjeta titulo="Copia de seguridad"><div className="pila"><p>Última copia: <strong>{s.ultimoRespaldo ? fechaHora(s.ultimoRespaldo) : 'aún no se ha hecho'}</strong></p><p className="suave chico">Se guarda una copia completa de la hoja de cálculo en la carpeta «Copias de seguridad» de tu Drive. Para restaurar: abre la copia y úsala como hoja principal (pasos en LEEME.md).</p>
          <p className="suave chico">Última limpieza de datos: {s.ultimaLimpieza ? s.ultimaLimpieza.replace('T', ' ') : 'pendiente'}</p>
          <Boton variante="secundario" icono={DatabaseBackup} cargando={ocupado} onClick={async () => { await correr(() => api('adminRespaldar', {}, { espera: 120000 }), 'Copia de seguridad creada.'); salud.recargar(true); }}>Hacer copia ahora</Boton></div></Tarjeta>
      </div>
      <Tarjeta titulo="Detalle"><ul className="lista chico">{s.disparadores.map((t) => <li key={t}><span className="crece">{NOMBRE_TAREA[t] || t}</span><Insignia tono="ok">activa</Insignia></li>)}
        <li><span className="crece">Registros guardados</span><span className="num">{Object.keys(s.filas).map((k) => `${k}: ${s.filas[k]}`).join(' · ')}</span></li>
        <li><span className="crece">Versión</span><span className="num">servidor {s.version} · aplicación {VERSION}</span></li></ul></Tarjeta>
    </div>}</Estado> :
      <Estado carga={bit}>{(l) => tab === 'errores' ? <Tabla columnas={[{ k: 'fecha', t: 'Fecha', render: (e) => fechaHora(e.fecha) }, { k: 'origen', t: 'Origen' }, { k: 'mensaje', t: 'Mensaje' }, { k: 'cedula', t: 'Usuario' }, { k: 'equipo', t: 'Equipo', render: (e) => <span className="chico suave">{e.equipo}</span> }, { k: 'version', t: 'Versión' }]} filas={l} vacio="No hay errores registrados." />
        : <Tabla columnas={[{ k: 'fecha', t: 'Fecha', render: (a) => fechaHora(a.fecha) }, { k: 'actor', t: 'Quién' }, { k: 'accion', t: 'Acción' }, { k: 'detalle', t: 'Detalle', render: (a) => <span className="chico" style={{ wordBreak: 'break-word' }}>{a.detalle}</span> }]} filas={l} vacio="Aún no hay movimientos." />}</Estado>}</>;
}
