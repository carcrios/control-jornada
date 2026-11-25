/* Botón flotante «Ayuda»: videos cortos, guías en PDF y preguntas frecuentes, según quién entra */
import React, { useEffect, useState } from 'react';
import { Download, HelpCircle, PlayCircle } from 'lucide-react';
import Guia from './Guia.jsx';
import { Hoja, Pestanas } from './ui.jsx';

// Los archivos viven junto a la aplicación (docs/ayuda). En la demo, que no los incluye, se traen de la página publicada.
const BASE = /github\.io$|^localhost$|^127\./.test(location.hostname) ? `${import.meta.env.BASE_URL}ayuda/` : 'https://carcrios.github.io/control-jornada/ayuda/';

const VIDEOS = [
  { f: '01-marcar-llegada-y-salida', t: 'Marcar la llegada y la salida', para: 'todos' },
  { f: '02-no-sali-a-almuerzo', t: 'Cuando no sales a almorzar', para: 'todos' },
  { f: '03-se-me-olvido-la-salida', t: 'Se me olvidó marcar la salida', para: 'todos' },
  { f: '04-pedir-permiso', t: 'Pedir un permiso', para: 'todos' },
  { f: '05-mi-pago-y-dudas', t: 'Ver mi pago y enviar dudas', para: 'todos' },
  { f: '06-entrar-rapido-y-accesibilidad', t: 'Entrar rápido y ajustar la letra', para: 'todos' },
  { f: '07-supervisor-revisar-el-dia', t: 'Supervisor: revisar el día', para: 'jefe' },
  { f: '08-admin-el-dia-a-dia', t: 'Administrador: el día a día', para: 'admin' },
  { f: '09-admin-aprobar-y-cerrar-nomina', t: 'Aprobar extras y cerrar la nómina', para: 'admin' },
  { f: '10-admin-informes-y-dudas', t: 'Informes y dudas del personal', para: 'admin' },
  { f: '11-admin-poner-en-marcha', t: 'Poner en marcha la empresa', para: 'admin' }
];
const PDFS = [
  { f: 'Guia-del-trabajador.pdf', t: 'Guía del trabajador', d: 'Paso a paso con imágenes, para imprimir o enviar por WhatsApp.', para: 'todos' },
  { f: 'Guia-del-administrador-y-supervisor.pdf', t: 'Guía del administrador y supervisor', d: 'Todo el manejo del panel: personal, horarios, permisos, nómina e informes.', para: 'jefe' },
  { f: 'Cartel-para-la-obra.pdf', t: 'Cartel para la obra', d: 'Para pegar en la entrada: cómo marcar en tres pasos.', para: 'jefe' }
];
const ve = (para, rol) => para === 'todos' || (para === 'jefe' && (rol === 'admin' || rol === 'supervisor')) || (para === 'admin' && rol === 'admin');

export default function Ayuda({ rol, enviar = true }) {
  const [abierta, setAbierta] = useState(false), [tab, setTab] = useState('videos'), [video, setVideo] = useState(null);
  const jefe = rol === 'admin' || rol === 'supervisor';
  // Al jefe le salen primero sus propios videos
  const videos = VIDEOS.filter((v) => ve(v.para, rol)).sort((a, b) => (jefe ? (b.para !== 'todos') - (a.para !== 'todos') : 0));
  const cerrar = () => { setAbierta(false); setVideo(null); };
  // Nunca tapa el botón de marcar: mientras se ve, la ayuda sube a la esquina de arriba
  const [arriba, setArriba] = useState(false);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    let obs = null, visto = null;
    const mirar = () => { const b = document.querySelector('.boton-marcar'); if (b === visto) return; obs?.disconnect(); visto = b; if (!b) { setArriba(false); return; }
      obs = new IntersectionObserver(([e]) => setArriba(e.isIntersecting && window.innerWidth < 900)); obs.observe(b); };
    mirar(); const i = setInterval(mirar, 1500);
    return () => { clearInterval(i); obs?.disconnect(); };
  }, []);
  return <>
    <button type="button" className={`ayuda-flotante${arriba ? ' arriba' : ''}`} onClick={() => setAbierta(true)} aria-label="Ayuda: videos, guías y preguntas frecuentes"><HelpCircle size={22} aria-hidden="true" /><span>Ayuda</span></button>
    <Hoja abierta={abierta} alCerrar={cerrar} titulo="Ayuda" alto={0.92}>
      {abierta && <div className="pila">
        <Pestanas etiqueta="Tipo de ayuda" valor={tab} alCambiar={(v) => { setTab(v); setVideo(null); }} opciones={[{ v: 'videos', t: 'Videos' }, { v: 'pdf', t: 'Guías PDF' }, { v: 'preguntas', t: 'Preguntas' }]} />
        {tab === 'videos' && <>
          {video && <div className="ayuda-video"><video src={BASE + video.f + '.mp4'} controls autoPlay playsInline preload="metadata" aria-label={video.t} /><p><strong>{video.t}</strong></p></div>}
          <ul className="ayuda-lista">{videos.map((v) => <li key={v.f}><button type="button" className={video?.f === v.f ? 'activo' : ''} onClick={() => setVideo(v)}>
            <PlayCircle size={22} aria-hidden="true" /><span>{v.t}{v.para !== 'todos' && <small>{v.para === 'admin' ? 'Administrador' : 'Supervisor y administrador'}</small>}</span></button></li>)}</ul>
          <p className="suave chico">Videos de menos de un minuto. Si tu plan de datos es limitado, míralos con wifi.</p>
        </>}
        {tab === 'pdf' && <ul className="ayuda-lista">{PDFS.filter((p) => ve(p.para, rol)).map((p) => <li key={p.f}><a href={BASE + p.f} target="_blank" rel="noopener" download>
          <Download size={22} aria-hidden="true" /><span>{p.t}<small>{p.d}</small></span></a></li>)}</ul>}
        {tab === 'preguntas' && <Guia enviar={enviar && !jefe} />}
      </div>}
    </Hoja>
  </>;
}
