import React, { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { api } from './api.js';
import { Aviso, Boton, Campo, Estado, Insignia, Tarjeta, useCarga } from './ui.jsx';
import { fechaCorta, fechaHora } from './util.js';
import { Cabecera } from './App.jsx';

export function LienzoFirma({ alCambiar }) {
  const ref = useRef(null), dib = useRef(false), hay = useRef(false);
  useEffect(() => { const c = ref.current, r = c.getBoundingClientRect(); c.width = Math.round(r.width * 2); c.height = Math.round(r.height * 2); const x = c.getContext('2d'); x.scale(2, 2); x.lineWidth = 2.2; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#10222a'; }, []);
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const exportar = () => { const c = ref.current, m = document.createElement('canvas'); m.width = 360; m.height = Math.round(360 * c.height / c.width); const x = m.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, m.width, m.height); x.drawImage(c, 0, 0, m.width, m.height); return m.toDataURL('image/jpeg', 0.6); };
  return <div className="pila junta"><canvas ref={ref} className="lienzo-firma" role="img" aria-label="Recuadro para dibujar tu firma con el dedo o el ratón"
    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dib.current = true; const [x, y] = pos(e), c = ref.current.getContext('2d'); c.beginPath(); c.moveTo(x, y); }}
    onPointerMove={(e) => { if (!dib.current) return; const [x, y] = pos(e), c = ref.current.getContext('2d'); c.lineTo(x, y); c.stroke(); hay.current = true; }}
    onPointerUp={() => { dib.current = false; if (hay.current) alCambiar(exportar()); }} />
    <Boton variante="texto" chico icono={Eraser} onClick={() => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); hay.current = false; alCambiar(''); }}>Borrar y repetir</Boton></div>;
}

export const tonoPermiso = { en_firmas: 'aviso', firmado: 'info', aprobado: 'ok', rechazado: 'peligro', vencido: 'peligro', cancelado: '' };
export const nombreEstado = { en_firmas: 'En firmas', firmado: 'Firmado, falta aprobación final', aprobado: 'Aprobado', rechazado: 'Rechazado', vencido: 'Venció sin respuesta', cancelado: 'Cancelado' };
export function DetallePermiso({ p }) {
  return <dl className="pila junta" style={{ margin: 0 }}>
    {[['Trabajador', `${p.nombre} · C.C. ${p.cedula}${p.cargo ? ' · ' + p.cargo : ''}`], ['Tipo', `${p.tipoNombre} (${p.remunerado ? 'remunerado' : 'no remunerado'})`], ['Fundamento', p.norma],
      ['Sale', `${fechaCorta(p.fechaSalida)} ${p.horaSalida || ''}`], ['Regresa', `${fechaCorta(p.fechaRegreso)} ${p.horaRegreso || ''}`], ['Motivo', p.motivo], ['Solicitado', fechaHora(p.creado)]]
      .map(([k, v]) => v && <div key={k} className="fila" style={{ alignItems: 'baseline', flexWrap: 'nowrap' }}><dt className="suave chico" style={{ width: 92, flex: 'none' }}>{k}</dt><dd style={{ margin: 0 }}>{v}</dd></div>)}
  </dl>;
}

export default function Firma({ codigo }) {
  const [p, j, k] = (codigo || '').split('.'), carga = useCarga(() => api('firmaVer', { p, j, k }), [codigo]);
  const [pin, setPin] = useState(''), [firma, setFirma] = useState(''), [obs, setObs] = useState(''), [modo, setModo] = useState('aprobar'), [env, setEnv] = useState(false), [err, setErr] = useState(''), [hecho, setHecho] = useState(null);
  const responder = async () => { setEnv(true); setErr(''); try { setHecho(await api('firmaResponder', { p, j, k, decision: modo, firma, obs, pin })); } catch (e) { setErr(e.message); } finally { setEnv(false); } };
  return <div className="app"><Estado carga={carga}>{(d) => { const mia = d.firmas.find((f) => f.id === d.jefeId); return <>
    <Cabecera empresa={d.empresa} />
    <main className="contenido pila" id="contenido">
      <div><h1>Solicitud de permiso</h1><div style={{ marginTop: 8 }}><Insignia tono={tonoPermiso[hecho?.estado || d.estado]}>{nombreEstado[hecho?.estado || d.estado]}</Insignia></div></div>
      <Tarjeta><DetallePermiso p={d} /></Tarjeta>
      <Tarjeta titulo="Firmas requeridas"><ul className="lista">{d.firmas.map((f) => <li key={f.id}><div className="crece"><strong>{f.nombre}</strong><div className="suave chico">{f.cargo}</div></div><Insignia tono={f.estado === 'aprobado' ? 'ok' : f.estado === 'rechazado' ? 'peligro' : 'aviso'}>{f.id === d.jefeId && hecho ? hecho.miEstado : f.estado}</Insignia></li>)}</ul></Tarjeta>
      {hecho ? <Aviso tono="ok">Tu respuesta quedó registrada. Si tienes correo configurado, recibirás una constancia. Ya puedes cerrar esta página.</Aviso>
        : !mia || mia.estado !== 'pendiente' || d.estado !== 'en_firmas' ? <Aviso>Este permiso ya no espera tu firma.</Aviso>
        : <Tarjeta titulo={`Responde como ${mia.nombre}`}><div className="pila">
          <div className="fila" role="radiogroup" aria-label="Decisión"><Boton variante={modo === 'aprobar' ? 'primario' : 'secundario'} aria-pressed={modo === 'aprobar'} onClick={() => setModo('aprobar')} className="crece">Aprobar</Boton><Boton variante={modo === 'rechazar' ? 'peligro' : 'secundario'} aria-pressed={modo === 'rechazar'} onClick={() => setModo('rechazar')} className="crece">Rechazar</Boton></div>
          {modo === 'aprobar' ? <div className="campo"><span className="etiqueta">Dibuja tu firma</span><LienzoFirma alCambiar={setFirma} /></div> : null}
          <Campo como="textarea" etiqueta={modo === 'rechazar' ? 'Motivo del rechazo' : 'Observación (opcional)'} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} />
          <Campo etiqueta="Tu clave de firma" type="password" inputMode="numeric" autoComplete="off" ayuda="Clave personal que te asignó el administrador. Evita que otra persona firme por ti con este enlace." value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          {err && <Aviso tono="peligro">{err}</Aviso>}
          <Boton variante={modo === 'rechazar' ? 'peligro' : 'primario'} cargando={env} disabled={pin.length < 4 || (modo === 'aprobar' ? !firma : obs.trim().length < 5)} onClick={responder}>{modo === 'aprobar' ? 'Firmar y aprobar' : 'Rechazar permiso'}</Boton>
        </div></Tarjeta>}
    </main></>; }}</Estado></div>;
}
