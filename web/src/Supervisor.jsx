/* ---------- Herramientas del supervisor: revisión diaria de su gente y ubicación de sus obras ---------- */
import React, { useState } from 'react';
import { AlertTriangle, Check, ClipboardCheck, MapPin, UserX } from 'lucide-react';
import { api } from './api.js';
import { Aviso, Boton, Campo, Estado, Hoja, Insignia, Tarjeta, recordarTexto, useAvisos, useCarga } from './ui.jsx';
import { fechaLarga, horas, hoyISO, ubicar } from './util.js';
import { Titulo, useAccion } from './Admin.jsx';

const EST = { completa: ['Jornada completa', 'ok'], incompleta: ['Sin salida', 'aviso'], sin_marcas: ['Sin marcaciones', 'peligro'], permiso: ['Con permiso', 'info'], incapacidad: ['Incapacitado', 'info'], descanso: ['Descanso', ''] };
const REV = { ok: ['Horas correctas', 'ok'], no_vino: ['No vino', 'peligro'], novedad: ['Con novedad', 'aviso'] };
const ayerISO = () => { const d = new Date(hoyISO() + 'T12:00:00'); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };

export function RevisionDia() {
  const [fecha, setFecha] = useState(hoyISO()), carga = useCarga(() => api('supRevision', { fecha }), [fecha]), [correr, ocupado] = useAccion(), [hoja, setHoja] = useState(null);
  const revisar = async (cedulas, estado, nota = '') => {
    if (await correr(() => api('supRevisar', { cedulas, fecha, estado, nota }), estado === 'ok' ? `${cedulas.length} jornada(s) confirmada(s).` : 'Revisión guardada y avisada al administrador.')) { setHoja(null); carga.recargar(true); }
  };
  return <>
    <Titulo t="Revisión del día" accion={<div className="fila" style={{ gap: 6 }}>
      <Boton chico variante={fecha === hoyISO() ? 'primario' : 'secundario'} onClick={() => setFecha(hoyISO())}>Hoy</Boton>
      <Boton chico variante={fecha === ayerISO() ? 'primario' : 'secundario'} onClick={() => setFecha(ayerISO())}>Ayer</Boton>
      <input type="date" className="entrada" style={{ width: 'auto' }} aria-label="Otra fecha" max={hoyISO()} value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} /></div>}>
      Revisa las horas que marcó tu gente o confirma quién no vino. Lo que confirmes le llega al administrador para la nómina.</Titulo>
    <Estado carga={carga}>{(d) => {
      const completas = d.filas.filter((x) => x.estado === 'completa' && !x.revision && !x.revisarMarcas && !x.fueraZona);
      return <div className="pila">
        <div className="fila entre"><p><strong>{fechaLarga(d.fecha)}</strong> · {d.filas.length} persona(s) a tu cargo · {d.pendientes ? <span>{d.pendientes} por revisar</span> : 'todo revisado'}</p>
          {completas.length > 1 && <Boton icono={Check} cargando={ocupado} onClick={() => revisar(completas.map((x) => x.cedula), 'ok')}>Confirmar las {completas.length} jornadas completas sin novedad</Boton>}</div>
        {!d.filas.length && <Aviso tono="info">No tienes personas asignadas. El administrador las asigna en Personal → Editar → Supervisor.</Aviso>}
        <div className="revision-lista">{d.filas.map((x) => <article key={x.cedula} className={`revision ${x.revision ? 'hecha' : ''}`}>
          <header className="fila entre" style={{ alignItems: 'flex-start' }}>
            <div><h3>{x.nombre}</h3><p className="chico suave">{x.cargo || ''}{x.centro ? ` · ${x.centro}` : ''}{x.horario ? ` · horario ${x.horario}` : ''}</p></div>
            <Insignia tono={EST[x.estado][1]}>{EST[x.estado][0]}</Insignia></header>
          {x.entrada && <ol className="marcas-dia" aria-label="Marcaciones">
            <li><span>Entrada</span><strong>{x.entrada}</strong></li><li><span>Almuerzo</span><strong>{x.salAlm ? `${x.salAlm}–${x.entAlm || '?'}` : '—'}</strong></li>
            <li><span>Salida</span><strong>{x.salida || '—'}</strong></li><li><span>Trabajado</span><strong>{x.salida ? horas(x.trabajadoMin) : 'en curso'}</strong></li></ol>}
          {(x.tarde > 0 || x.extraMin >= 10 || x.fueraZona || x.revisarMarcas) && <div className="fila" style={{ gap: 6 }}>
            {x.tarde > 0 && <Insignia tono="aviso">llegó {x.tarde} min tarde</Insignia>}{x.extraMin >= 10 && <Insignia tono="info">{horas(x.extraMin)} extra</Insignia>}
            {x.fueraZona && <Insignia tono="peligro">marcó fuera de la obra</Insignia>}{x.revisarMarcas && <Insignia tono="aviso">marcación por revisar</Insignia>}</div>}
          {x.revision ? <p className="chico" role="status"><Insignia tono={REV[x.revision.estado][1]}>{REV[x.revision.estado][0]}</Insignia> {x.revision.nota && `· ${x.revision.nota} `}· revisó {x.revision.por}
            <Boton chico variante="texto" onClick={() => setHoja({ x, estado: x.revision.estado, nota: x.revision.nota || '' })}>Cambiar</Boton></p>
            : x.estado !== 'descanso' && <div className="fila" style={{ gap: 6 }}>
              {x.entrada && x.salida && <Boton chico icono={Check} cargando={ocupado} onClick={() => revisar([x.cedula], 'ok')}>Horas correctas</Boton>}
              {!x.entrada && x.estado === 'sin_marcas' && <Boton chico variante="peligro" icono={UserX} onClick={() => setHoja({ x, estado: 'no_vino', nota: '' })}>No vino</Boton>}
              <Boton chico variante="secundario" icono={AlertTriangle} onClick={() => setHoja({ x, estado: 'novedad', nota: '' })}>Novedad</Boton></div>}
        </article>)}</div>
      </div>; }}</Estado>
    <Hoja abierta={!!hoja} alCerrar={() => setHoja(null)} titulo={hoja ? `${hoja.x.nombre} · ${hoja.estado === 'no_vino' ? 'No vino' : hoja.estado === 'ok' ? 'Horas correctas' : 'Novedad'}` : ''}>{hoja && <div className="pila">
      {hoja.x.revision && <Campo como="select" etiqueta="Revisión" value={hoja.estado} onChange={(e) => setHoja({ ...hoja, estado: e.target.value })}
        opciones={[...(hoja.x.entrada ? [{ v: 'ok', t: 'Horas correctas' }] : [{ v: 'no_vino', t: 'No vino' }]), { v: 'novedad', t: 'Novedad' }]} />}
      {hoja.estado !== 'ok' && <Campo como="textarea" rows={3} maxLength={300} etiqueta={hoja.estado === 'no_vino' ? '¿Qué pasó?' : '¿Cuál es la novedad?'}
        ayuda={hoja.estado === 'no_vino' ? 'Por ejemplo: no avisó, avisó calamidad, se fue sin marcar. Puedes dictarlo.' : 'Por ejemplo: llegó a las 7:30 pero marcó tarde por falta de señal. Puedes dictarlo.'}
        recordar={'revision-' + hoja.estado} value={hoja.nota} onChange={(e) => setHoja({ ...hoja, nota: e.target.value })} />}
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setHoja(null)}>Cancelar</Boton>
        <Boton cargando={ocupado} disabled={hoja.estado !== 'ok' && hoja.nota.trim().length < 5} onClick={() => { recordarTexto('revision-' + hoja.estado, hoja.nota); revisar([hoja.x.cedula], hoja.estado, hoja.nota); }}>Guardar</Boton></div></div>}</Hoja>
  </>;
}

export function UbicarObras({ centros, recargar }) {
  const [sel, setSel] = useState(null), [pos, setPos] = useState(null), [radio, setRadio] = useState(''), [buscando, setBuscando] = useState(false), [correr, ocupado] = useAccion(), avisos = useAvisos();
  const tomar = async () => { setBuscando(true); setPos(null); try { setPos(await ubicar()); } catch (e) { avisos.error(e.message || 'No se pudo obtener la ubicación.'); } finally { setBuscando(false); } };
  const guardar = async () => { if (await correr(() => api('supUbicarObra', { centroId: sel.id, ...pos, radio: radio ? +radio : undefined }), 'Ubicación de la obra guardada.')) { setSel(null); recargar && recargar(); } };
  return <>
    <Titulo t="Ubicación de mis obras">Párate en la obra (mejor en la entrada o en el centro, a cielo abierto) y guarda su ubicación. Con ella la aplicación sabe si la gente marca dentro de la obra.</Titulo>
    <div className="rejilla dos">{centros.map((c) => <Tarjeta key={c.id}>
      <div className="fila entre" style={{ alignItems: 'flex-start' }}><div><h3>{c.nombre}</h3><p className="chico suave">{c.direccion || ''}</p></div>
        <Insignia tono={c.lat === null ? 'aviso' : 'ok'}><MapPin size={12} aria-hidden="true" />{c.lat === null ? 'sin ubicación' : `radio ${c.radio} m`}</Insignia></div>
      {c.lat !== null && <p className="chico suave" style={{ margin: '8px 0' }}>{c.lat.toFixed(5)}, {c.lng.toFixed(5)} · <a href={`https://www.google.com/maps?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer">ver en el mapa</a></p>}
      <Boton icono={MapPin} variante={c.lat === null ? 'primario' : 'secundario'} onClick={() => { setSel(c); setPos(null); setRadio(String(c.radio || '')); }}>{c.lat === null ? 'Fijar ubicación' : 'Cambiar ubicación'}</Boton>
    </Tarjeta>)}</div>
    <Hoja abierta={!!sel} alCerrar={() => setSel(null)} titulo={sel ? `Ubicación de ${sel.nombre}` : ''}>{sel && <div className="pila">
      <p>1. Ve a la obra y quédate quieto unos segundos a cielo abierto.<br />2. Toca «Tomar mi ubicación».<br />3. Revisa la precisión y guarda.</p>
      <Boton icono={MapPin} cargando={buscando} onClick={tomar}>Tomar mi ubicación</Boton>
      {pos && <Aviso tono={pos.prec > 100 ? 'peligro' : pos.prec > 40 ? 'aviso' : 'ok'}>Ubicación tomada con precisión de {Math.round(pos.prec)} m.{pos.prec > 100 ? ' Es muy imprecisa: sal a cielo abierto y vuelve a tomarla.' : pos.prec > 40 ? ' Sirve, pero si puedes, tómala otra vez al aire libre.' : ''}</Aviso>}
      <Campo etiqueta="Radio de la obra (metros)" type="number" min="30" max="2000" ayuda="Distancia desde este punto en la que se acepta marcar. Para una obra grande, súbelo." value={radio} onChange={(e) => setRadio(e.target.value)} />
      <Aviso tono="info">El cambio queda registrado con tu nombre y se le avisa al administrador.</Aviso>
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setSel(null)}>Cancelar</Boton><Boton cargando={ocupado} disabled={!pos || pos.prec > 100} onClick={guardar}>Guardar ubicación</Boton></div></div>}</Hoja>
  </>;
}

export const IconoRevision = ClipboardCheck;
