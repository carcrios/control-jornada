/* ---------- Accesibilidad: preferencias por persona, dictado por voz y lectura en voz alta ----------
   Todo se guarda en este equipo (localStorage) y se aplica al instante sobre <html>. */
import React, { useEffect, useRef, useState } from 'react';
import { Accessibility, Maximize2, MessageSquareText, Mic, Square, Volume2, X } from 'lucide-react';

const CLAVE = 'cj.accesibilidad';
const BASE = { letra: 'normal', contraste: false, movimiento: false, voz: false, claro: false, subrayar: false, leerAlTocar: false };
export function preferencias() { try { return { ...BASE, ...(JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}) }; } catch { return { ...BASE }; } }
export function aplicarPreferencias(p = preferencias()) {
  const h = document.documentElement;
  h.dataset.letra = p.letra; h.dataset.contraste = p.contraste ? 'alto' : ''; h.dataset.movimiento = p.movimiento ? 'reducido' : ''; h.dataset.subrayar = p.subrayar ? 'si' : '';
  if (p.claro) h.dataset.theme = 'light'; else if (h.dataset.theme === 'light') delete h.dataset.theme;
  activarLeerAlTocar(!!p.leerAlTocar);
}
/* Leer al tocar: al tocar un botón, título o texto, el celular lo dice en voz alta (y el toque sigue funcionando). */
let oyenteToque = null;
function textoDe(el) {
  const obj = el.closest('button, a, label, [role=button], [role=tab], h1, h2, h3, p, li, td, th, .valor, .insignia, .aviso, summary') || el;
  return (obj.getAttribute('aria-label') || obj.innerText || obj.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
}
function activarLeerAlTocar(si) {
  if (si && !oyenteToque) { oyenteToque = (e) => { const t = textoDe(e.target); if (t) hablar(t, true); }; document.addEventListener('click', oyenteToque, true); }
  else if (!si && oyenteToque) { document.removeEventListener('click', oyenteToque, true); oyenteToque = null; }
}
/* Leer la pantalla completa en voz alta */
export function leerPantalla() {
  const raiz = document.querySelector('[role=dialog]') || document.getElementById('contenido') || document.body;
  const partes = []; raiz.querySelectorAll('h1, h2, h3, p, li, label, button, .valor, .rotulo, .insignia, .fecha, .saludo, td, summary, [role=status]').forEach((n) => {
    if (n.closest('[aria-hidden=true], .oculto-visual') || !n.offsetParent) return; const t = (n.getAttribute('aria-label') || n.innerText || '').replace(/\s+/g, ' ').trim(); if (t && partes[partes.length - 1] !== t) partes.push(t); });
  hablar(partes.join('. ').slice(0, 4000) || 'No hay texto para leer en esta pantalla.', true);
}
export function callar() { try { window.speechSynthesis.cancel(); } catch { /* sin voz */ } }
function guardarPreferencias(p) { try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch { /* sin almacenamiento: se aplica solo en esta sesión */ } aplicarPreferencias(p); }

/* Lectura en voz alta (si la persona la activó). Sirve para confirmar marcaciones sin mirar la pantalla. */
export function hablar(texto, forzar = false) {
  try {
    if (!texto || !('speechSynthesis' in window) || (!forzar && !preferencias().voz)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(texto).replace(/\s+/g, ' ')); u.lang = 'es-CO'; u.rate = 0.95;
    const v = window.speechSynthesis.getVoices().find((x) => /^es/i.test(x.lang)); if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch { /* el navegador no lee en voz alta */ }
}

/* Dictado: convierte voz en texto dentro de cualquier campo. Usa el reconocimiento de voz del navegador
   (Chrome y Edge en Android y computador; Safari en iPhone). Si no está disponible, el botón no aparece y
   queda el micrófono del teclado del celular. */
const Reconocedor = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const dictadoDisponible = !!Reconocedor;
const NUMEROS = { cero: '0', uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9' };
function aDigitos(t) { return String(t).toLowerCase().split(/\s+/).map((w) => NUMEROS[w] ?? w).join('').replace(/\D/g, ''); }

export function BotonDictar({ valor, alCambiar, numerico, etiqueta }) {
  const [oye, setOye] = useState(false), [sinMic, setSinMic] = useState(false), rec = useRef(null), base = useRef('');
  useEffect(() => () => { try { rec.current?.abort(); } catch { /* ya detenido */ } }, []);
  if (!dictadoDisponible) return null;
  const parar = () => { try { rec.current?.stop(); } catch { /* ya detenido */ } };
  const iniciar = () => {
    try {
      const r = new Reconocedor(); rec.current = r;
      r.lang = 'es-CO'; r.interimResults = true; r.continuous = !numerico; r.maxAlternatives = 1;
      base.current = String(valor || '');
      r.onresult = (ev) => {
        let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
        if (numerico) { alCambiar(base.current + aDigitos(t)); return; }
        t = t.trim(); if (!t) return;
        const sep = base.current && !/\s$/.test(base.current) ? ' ' : '';
        const texto = base.current ? t : t.charAt(0).toUpperCase() + t.slice(1);
        alCambiar(base.current + sep + texto);
      };
      r.onend = () => setOye(false);
      r.onerror = (e) => { setOye(false); if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setSinMic(true); };
      setSinMic(false); r.start(); setOye(true);
    } catch { setOye(false); }
  };
  return <><button type="button" className={`dictar ${oye ? 'oyendo' : ''}`} onClick={oye ? parar : iniciar}
    aria-pressed={oye} aria-label={oye ? `Dejar de dictar ${etiqueta || ''}` : `Dictar ${etiqueta || 'con la voz'}`} title={oye ? 'Tocar para terminar' : 'Dictar con la voz'}>
    {oye ? <Square size={16} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
    {oye && <span className="oculto-visual" role="status">Escuchando… habla ahora.</span>}
  </button>{sinMic && <span className="pista" role="alert">Para dictar, permite el micrófono en tu navegador.</span>}</>;
}

/* «Hablar por mí»: para quien no puede hablar. Escribe o toca una frase y el celular la dice en voz alta;
   también la muestra en letra gigante para enseñarla a la otra persona. */
const FRASES = ['Buenos días', 'No puedo hablar, por favor léame aquí', 'Necesito ayuda', 'Ya marqué mi entrada', 'Necesito ir al baño', 'Me siento mal', 'Tengo una cita médica', '¿Me lo puede escribir, por favor?', 'Sí', 'No', 'Gracias'];
export function HablarPorMi({ alCerrar }) {
  const [t, setT] = useState(''), [grande, setGrande] = useState(''), frases = (() => { try { return JSON.parse(localStorage.getItem('cj.frases') || '[]'); } catch { return []; } })();
  const decir = (x) => { const v = String(x || '').trim(); if (!v) return; hablar(v, true); setGrande(v);
    if (!FRASES.includes(v)) { try { localStorage.setItem('cj.frases', JSON.stringify([v, ...frases.filter((y) => y !== v)].slice(0, 8))); } catch { /* sin almacenamiento */ } } };
  if (grande) return <div className="frase-grande" role="dialog" aria-label="Mensaje en pantalla completa" onClick={() => setGrande('')}>
    <p>{grande}</p><div className="fila" style={{ justifyContent: 'center', gap: 12 }}>
      <button type="button" className="btn secundario" onClick={(e) => { e.stopPropagation(); hablar(grande, true); }}><Volume2 size={20} aria-hidden="true" />Decir otra vez</button>
      <button type="button" className="btn" onClick={() => setGrande('')}><X size={20} aria-hidden="true" />Cerrar</button></div></div>;
  return <div className="pila">
    <p className="suave">Escribe lo que quieres decir o toca una frase. El celular lo dice en voz alta y lo muestra en grande.</p>
    <div className="frases">{[...frases, ...FRASES].slice(0, 14).map((f) => <button type="button" key={f} className="reciente" onClick={() => decir(f)}>{f}</button>)}</div>
    <label className="etiqueta" htmlFor="hablar-por-mi">Mi mensaje</label>
    <textarea id="hablar-por-mi" className="entrada" rows={3} value={t} onChange={(e) => setT(e.target.value)} placeholder="Escribe aquí…" />
    <div className="acciones-hoja"><button type="button" className="btn secundario" onClick={() => { setT(''); callar(); }}>Borrar</button>
      <button type="button" className="btn" disabled={!t.trim()} onClick={() => decir(t)}><Volume2 size={20} aria-hidden="true" />Decirlo en voz alta</button></div>
    {alCerrar && <button type="button" className="btn texto" onClick={alCerrar}>Volver</button>}
  </div>;
}

/* Panel de opciones de accesibilidad */
export function PanelAccesibilidad() {
  const [p, setP] = useState(preferencias());
  const pon = (k, v) => { const n = { ...p, [k]: v }; setP(n); guardarPreferencias(n); if (k === 'voz' && v) hablar('Lectura en voz alta activada.', true); };
  const Op = ({ k, children, ayuda }) => <label className="casilla"><input type="checkbox" checked={!!p[k]} onChange={(e) => pon(k, e.target.checked)} /><span>{children}{ayuda && <span className="ayuda" style={{ display: 'block' }}>{ayuda}</span>}</span></label>;
  const [comunicador, setComunicador] = useState(false), [leyendo, setLeyendo] = useState(false);
  if (comunicador) return <HablarPorMi alCerrar={() => setComunicador(false)} />;
  return <div className="pila">
    <div className="rejilla">
      <button type="button" className="btn" onClick={() => { if (leyendo) { callar(); setLeyendo(false); } else { setLeyendo(true); leerPantalla(); setTimeout(() => setLeyendo(false), 1500); } }}><Volume2 size={20} aria-hidden="true" />{leyendo ? 'Detener la lectura' : 'Leer esta pantalla en voz alta'}</button>
      <button type="button" className="btn secundario" onClick={() => setComunicador(true)}><MessageSquareText size={20} aria-hidden="true" />Hablar por mí (para quien no puede hablar)</button></div>
    <Op k="leerAlTocar" ayuda="Cada botón o texto que toques se dice en voz alta. Útil si cuesta leer la pantalla.">Leer en voz alta lo que toque</Op>
    <fieldset className="pila junta" style={{ border: 0, padding: 0, margin: 0 }}><legend className="etiqueta" style={{ marginBottom: 8 }}>Tamaño de la letra</legend>
      <div className="segmentos" role="radiogroup" aria-label="Tamaño de la letra">{[['normal', 'Normal'], ['grande', 'Grande'], ['muy', 'Muy grande']].map(([v, t]) =>
        <button key={v} type="button" role="radio" aria-checked={p.letra === v} className={p.letra === v ? 'activo' : ''} onClick={() => pon('letra', v)} style={{ fontSize: v === 'normal' ? '1rem' : v === 'grande' ? '1.15rem' : '1.3rem' }}>{t}</button>)}</div></fieldset>
    <Op k="contraste" ayuda="Textos más oscuros y bordes más marcados. Útil a pleno sol en la obra.">Alto contraste</Op>
    <Op k="voz" ayuda="La aplicación dice en voz alta los avisos, por ejemplo «Entrada registrada a las 6 y 55».">Leer los avisos en voz alta</Op>
    <Op k="movimiento" ayuda="Quita animaciones y el pulso de los botones.">Reducir el movimiento</Op>
    <Op k="subrayar">Subrayar todos los enlaces y botones de texto</Op>
    <Op k="claro" ayuda="Si el celular está en modo oscuro y prefieres ver la aplicación clara.">Usar siempre el tema claro</Op>
    <div className="aviso info" role="note"><Mic size={20} aria-hidden="true" /><div className="crece">{dictadoDisponible
      ? 'Para dictar, toca el micrófono que aparece al lado de cada casilla de texto y habla. Para números (cédula, celular) puedes decirlos uno por uno.'
      : 'Este navegador no permite dictar dentro de la aplicación. Usa el micrófono de tu teclado: aparece al tocar cualquier casilla de texto.'}</div></div>
  </div>;
}

export function IconoAccesibilidad(props) { return <Accessibility {...props} />; }
