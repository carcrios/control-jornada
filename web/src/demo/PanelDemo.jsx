import React, { useEffect, useState } from 'react';
import { FlaskConical, LogIn, Mail, MapPin, Camera, PenLine, Play, RotateCcw, X } from 'lucide-react';
import { api, sesion } from '../api.js';
import { demo, guardar, reiniciar } from './motor-demo.js';

const USUARIOS = [['79000001', 'Andrea Rojas', 'Administradora: panel completo, nómina, informes, configuración'], ['1020333444', 'Pedro Pérez', 'Trabajador: marcar, permisos, pagos'], ['80111000', 'Sara Vargas', 'Supervisora: su equipo de Planta Tocancipá, sin salarios']];
const PRIMERA = 'cj.demo.visto';
const leido = () => { try { return localStorage.getItem(PRIMERA); } catch { return '1'; } };

function Grupo({ titulo, icono: I, children }) {
  return <section style={{ borderTop: '1px solid var(--c-borde)', paddingTop: 12, marginTop: 12 }}><h3 style={{ fontSize: 'var(--t-2)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}><I size={16} aria-hidden="true" />{titulo}</h3>{children}</section>;
}
function Opciones({ valor, opciones, alCambiar, etiqueta }) {
  return <div className="fila" role="radiogroup" aria-label={etiqueta} style={{ gap: 6 }}>{opciones.map(([v, t]) => <button key={v} type="button" className="chip" aria-pressed={valor === v} onClick={() => alCambiar(v)}>{t}</button>)}</div>;
}

export default function PanelDemo() {
  const [abierto, setAbierto] = useState(() => !leido()), [gps, setGps] = useState(demo.gps), [cam, setCam] = useState(demo.camara), [msg, setMsg] = useState(''), [correo, setCorreo] = useState(null), [, refrescar] = useState(0);
  useEffect(() => { if (abierto) { try { localStorage.setItem(PRIMERA, '1'); } catch { /* */ } } const t = (e) => { if (e.key === 'Escape') setAbierto(false); }; document.addEventListener('keydown', t); return () => document.removeEventListener('keydown', t); }, [abierto]);
  const yo = sesion.yo?.usuario;
  const entrar = async (cedula) => { setMsg('Entrando…'); try { const r = await api('login', { cedula, clave: 'demo2026' }); sesion.token = r.token; sesion.yo = null; location.hash = '#/'; location.reload(); } catch (e) { setMsg(e.message); } };
  const firmar = () => {
    const S = demo.X.S, p = S.leer('Permisos').filter((x) => x.estado === 'en_firmas').pop();
    if (!p) return setMsg('No hay permisos esperando firma. Entra como Pedro y solicita uno.');
    const f = JSON.parse(p.firmas).find((x) => x.estado === 'pendiente'); location.hash = '#' + S.enlaceFirma(p.id, f.id).split('#')[1]; setAbierto(false);
    setMsg(`Firmando como ${f.nombre}. Clave de firma: 482173.`);
  };
  const tarea = (nombre) => { const n = demo.X.correos.length; demo.X.S.limpiar(); demo.X.S[nombre](); guardar(); refrescar((x) => x + 1); setMsg(`Listo: ${demo.X.correos.length - n} correo(s) nuevo(s).`); };
  return <>
    <style>{'body{padding-top:32px} .cabecera{top:32px!important} .admin-nav{top:88px!important}'}</style>
    <button type="button" className="no-imprimir" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-controls="panel-demo"
      style={{ position: 'fixed', left: 0, right: 0, top: 0, height: 32, zIndex: 70, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', border: 0, background: 'var(--c-acento)', color: 'var(--c-sobre-acento)', fontWeight: 650, fontSize: 13, cursor: 'pointer' }}>
      <FlaskConical size={15} aria-hidden="true" />Demostración · {abierto ? 'Cerrar controles' : 'Cambiar de persona'}</button>
    {abierto && <div id="panel-demo" role="dialog" aria-modal="false" aria-label="Controles de la demostración"
      style={{ position: 'fixed', right: 12, top: 40, zIndex: 75, width: 'min(380px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', background: 'var(--c-superficie)', border: '1px solid var(--c-borde)', borderRadius: 'var(--r-3)', boxShadow: 'var(--s-2)', padding: 16 }}>
      <div className="fila entre"><h2 style={{ fontSize: 'var(--t-4)' }}>Demostración</h2><button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" style={{ all: 'unset', cursor: 'pointer', width: 36, height: 36, display: 'grid', placeItems: 'center' }}><X size={20} /></button></div>
      <p className="suave chico" style={{ marginTop: 4 }}>Es la aplicación real con datos de ejemplo de una empresa ficticia. Todo corre en este navegador: nada sale a internet y puedes reiniciarla cuando quieras. La fecha y la hora son las reales.</p>
      {msg && <p className="chico" role="status" style={{ marginTop: 8, color: 'var(--c-info)' }}>{msg}</p>}

      <Grupo titulo="Entrar como" icono={LogIn}><div className="pila junta">{USUARIOS.map(([c, n, d]) => <button key={c} type="button" className="btn secundario" style={{ justifyContent: 'flex-start', textAlign: 'left', height: 'auto', padding: '8px 12px', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }} onClick={() => entrar(c)} aria-current={yo?.cedula === c || undefined}>
        <span>{n}{yo?.cedula === c ? ' · sesión actual' : ''}</span><span className="suave chico" style={{ fontWeight: 400 }}>{d}</span></button>)}</div>
        <p className="suave chico" style={{ marginTop: 6 }}>Contraseña de todos: <strong>demo2026</strong>. También puedes salir y crear una cuenta nueva con el código de empresa (Configuración → Reglas).</p></Grupo>

      <Grupo titulo="Firmar como jefe" icono={PenLine}><button type="button" className="btn secundario chico" onClick={firmar}>Abrir el último permiso por firmar</button><p className="suave chico" style={{ marginTop: 6 }}>Es lo que el jefe abre desde WhatsApp. Clave de firma: <strong>482173</strong>.</p></Grupo>

      <Grupo titulo="Simular el celular" icono={MapPin}>
        <span className="chico">Ubicación</span><Opciones etiqueta="Ubicación" valor={gps} alCambiar={(v) => { demo.gps = v; setGps(v); }} opciones={[['obra', 'En la obra'], ['fuera', 'Fuera de la obra'], ['bloqueado', 'GPS bloqueado']]} />
        <span className="chico" style={{ display: 'block', marginTop: 8 }}><Camera size={14} aria-hidden="true" /> Cámara (35 % de las marcaciones pide foto)</span><Opciones etiqueta="Cámara" valor={cam} alCambiar={(v) => { demo.camara = v; setCam(v); }} opciones={[['normal', 'Permitida'], ['bloqueada', 'Bloqueada']]} />
        <p className="suave chico" style={{ marginTop: 6 }}>Para probar «sin señal», activa el modo avión del celular o desconecta el wifi: la marcación queda guardada y se envía al volver.</p></Grupo>

      <Grupo titulo="Tareas automáticas" icono={Play}><p className="suave chico" style={{ marginBottom: 6 }}>En la instalación real corren solas cada 5 y 15 minutos.</p>
        <div className="fila"><button type="button" className="btn secundario chico" onClick={() => tarea('tareaCada15')}>Ausencias, salidas olvidadas y fatiga</button><button type="button" className="btn secundario chico" onClick={() => tarea('tareaCada5')}>Recordatorios y permisos vencidos</button></div></Grupo>

      <Grupo titulo={`Correos que habría enviado (${demo.X.correos.length})`} icono={Mail}>
        {demo.X.correos.length === 0 ? <p className="suave chico">Aún ninguno.</p> : <ul className="lista">{demo.X.correos.slice(0, 15).map((m, i) => <li key={i} style={{ display: 'block', padding: '6px 0' }}>
          <button type="button" style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }} aria-expanded={correo === i} onClick={() => setCorreo(correo === i ? null : i)}><strong className="chico">{m.subject}</strong><div className="suave chico">Para: {m.to}</div></button>
          {correo === i && <pre className="chico" style={{ whiteSpace: 'pre-wrap', background: 'var(--c-superficie-2)', padding: 8, borderRadius: 6, marginTop: 4, fontFamily: 'inherit' }}>{m.body}</pre>}</li>)}</ul>}</Grupo>

      <Grupo titulo="Empezar de nuevo" icono={RotateCcw}><button type="button" className="btn peligro chico" onClick={reiniciar}>Reiniciar la demostración</button></Grupo>
    </div>}
  </>;
}
