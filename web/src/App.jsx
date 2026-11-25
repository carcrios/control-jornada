import { IconoAccesibilidad, PanelAccesibilidad } from './a11y.jsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Ayuda from './Ayuda.jsx';
import { Clock, LogOut, RefreshCw, ShieldCheck, UserRound, WifiOff } from 'lucide-react';
import { colorLegible } from './util.js';
import { api, sesion, configurada, alCaducarSesion, conexion, idDeTexto, urlDeId, reloj, VERSION, guardado, bandeja } from './api.js';
import { Avisos, Boton, Aviso, Campo, Casilla, Esqueleto, Hoja, useAvisos } from './ui.jsx';
import Acceso from './Acceso.jsx';
import Legal, { PieLegal } from './Legal.jsx';
import Firma from './Firma.jsx';
import { VerificarCertificado } from './Autoservicio.jsx';
import Trabajador from './Trabajador.jsx';
import Admin from './Admin.jsx';
import { Kiosco } from './Modulos.jsx';

const ruta = () => location.hash.replace(/^#\/?/, '').split('/');
function useRuta() { const [r, setR] = useState(ruta); useEffect(() => { const f = () => { setR(ruta()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []); return r; }
function useEnLinea() { const [v, setV] = useState(navigator.onLine); useEffect(() => { const a = () => setV(true), b = () => setV(false); window.addEventListener('online', a); window.addEventListener('offline', b); return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); }; }, []); return v; }

// La marca (nombre, logo y color) llega de la configuración de la empresa: nada está escrito en el código.
function aplicarMarca(empresa) {
  if (!empresa) return;
  document.title = empresa.nombre ? `${empresa.nombre} · Control de jornada` : 'Control de jornada';
  const c = empresa.color, raiz = document.documentElement.style;
  if (!/^#[0-9a-f]{6}$/i.test(c || '')) { ['--c-primario', '--c-primario-fuerte', '--c-sobre-primario'].forEach((k) => raiz.removeProperty(k)); return; }
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return; // en modo oscuro se conserva la paleta accesible
  const [r, g, b] = colorLegible(c);
  raiz.setProperty('--c-primario', `rgb(${r},${g},${b})`);
  raiz.setProperty('--c-primario-fuerte', `rgb(${[r, g, b].map((x) => Math.round(x * 0.75)).join(',')})`);
  raiz.setProperty('--c-sobre-primario', '#FFFFFF');
}


export function BotonAccesibilidad({ claro }) {
  const [abierta, setAbierta] = useState(false);
  return <><button type="button" className={`btn-a11y ${claro ? 'claro' : ''}`} onClick={() => setAbierta(true)} aria-label="Opciones de accesibilidad" title="Accesibilidad"><IconoAccesibilidad size={22} aria-hidden="true" /></button>
    <Hoja abierta={abierta} alCerrar={() => setAbierta(false)} titulo="Accesibilidad"><PanelAccesibilidad /></Hoja></>;
}
export function Cabecera({ empresa, children }) {
  return <header className="cabecera no-imprimir"><div className="marca">{empresa?.logo ? <img src={empresa.logo} alt="" /> : <Clock size={26} aria-hidden="true" />}<strong>{empresa?.nombre || 'Control de jornada'}</strong></div><BotonAccesibilidad />{children}</header>;
}

function SinConfigurar() {
  const [v, setV] = useState(''), [err, setErr] = useState('');
  const seguir = (e) => { e.preventDefault(); const id = idDeTexto(v); if (!id) return setErr('Ese código o enlace no es válido. Cópialo completo.'); location.hash = '#/c/' + id; };
  return <main className="acceso" id="contenido"><form className="acceso-caja pila" onSubmit={seguir} noValidate>
    <div className="logo"><div className="sello"><Clock size={28} aria-hidden="true" /></div><div><strong style={{ fontFamily: 'var(--f-titulo)', fontSize: 'var(--t-4)' }}>Control de jornada</strong></div></div>
    <h1>Conecta con tu empresa</h1>
    <p className="suave">Abre el enlace que te envió tu empresa. Si en cambio te dieron un código, pégalo aquí.</p>
    <Campo como="textarea" etiqueta="Código o enlace de la empresa" value={v} onChange={(e) => setV(e.target.value)} error={err} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
    <Boton type="submit" disabled={!v.trim()}>Continuar</Boton>
  </form></main>;
}

// Enlace de empresa: #/c/<código>. Muestra a qué empresa se va a conectar el celular antes de guardarlo.
function Conectar({ codigo }) {
  const id = idDeTexto(codigo), [emp, setEmp] = useState(null), [err, setErr] = useState(''), [red, setRed] = useState(false), otra = conexion.id && conexion.id !== id;
  useEffect(() => {
    if (conexion.fija || (id && conexion.id === id)) { location.hash = '#/'; return; }
    if (!id) return setErr('El enlace está incompleto. Pide que te lo envíen de nuevo.');
    api('publico', {}, { url: urlDeId(id) }).then(setEmp).catch((e) => { setRed(e.cod === 'RED'); setErr(e.cod === 'RED' ? `No pudimos conectar con el servidor de la empresa. (${e.message})` : 'No se encontró una empresa con este enlace. Pide que te lo envíen de nuevo.'); });
  }, [id]); // eslint-disable-line
  const aceptar = () => { conexion.poner(id); location.hash = '#/'; location.reload(); };
  return <main className="acceso" id="contenido"><div className="acceso-caja pila">
    <h1>Conectar este celular</h1>
    {err ? <><Aviso tono="peligro">{err}</Aviso>{red && <div className="pila chico">
      <p><strong>Para saber qué pasa</strong>, abre este enlace en una pestaña nueva:</p>
      <a className="btn secundario" href={urlDeId(id)} target="_blank" rel="noopener noreferrer">Probar el servidor de la empresa</a>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        <li>Si dice <b>«Control de jornada · versión…»</b>, el servidor está bien: el problema es este navegador o la red. Prueba en Chrome, Edge o Safari, sin bloqueador de anuncios ni VPN.</li>
        <li>Si te pide <b>iniciar sesión en Google</b> o dice que no tienes permiso: en Apps Script → Implementar → Administrar implementaciones → editar → «Quién tiene acceso: <b>Cualquier persona</b>».</li>
        <li>Si dice que <b>no se encontró</b> la página: el enlace es de una implementación borrada. Vuelve a tomar el enlace del menú «Control de jornada → 2. Ver el enlace de mi empresa».</li>
      </ul>
      <Boton variante="secundario" onClick={() => location.reload()}>Intentar de nuevo</Boton></div>}</> : !emp ? <div role="status"><span className="oculto-visual">Buscando la empresa…</span><Esqueleto lineas={3} /></div> : <>
      <div className="logo" style={{ marginBottom: 0 }}><div className="sello">{emp.empresa.logo ? <img src={emp.empresa.logo} alt="" /> : <Clock size={28} aria-hidden="true" />}</div><div><strong style={{ fontFamily: 'var(--f-titulo)', fontSize: 'var(--t-5)' }}>{emp.empresa.nombre}</strong>{emp.empresa.nit && <div className="suave chico">NIT {emp.empresa.nit}</div>}</div></div>
      <p className="suave">Vas a usar esta aplicación con la empresa de arriba. Continúa solo si es la empresa donde trabajas y el enlace te lo envió ella.</p>
      {otra && <Aviso tono="aviso">Este celular ya estaba conectado con otra empresa. Al continuar se cierra esa sesión.</Aviso>}
      <Boton onClick={aceptar}>Sí, es mi empresa</Boton></>}
    <a className="btn texto" href="#/">Cancelar</a>
  </div></main>;
}

function Reconsentir({ empresa, alListo }) {
  const [a, setA] = useState(false), [b, setB] = useState(false), [c, setC] = useState(false), avisos = useAvisos();
  const enviar = async () => { setC(true); try { await api('consentir', { datos: a, sensibles: b }); alListo(); } catch (e) { avisos.error(e); } finally { setC(false); } };
  return <main className="acceso" id="contenido"><div className="acceso-caja pila"><h1>Actualizamos las políticas</h1>
    <p className="suave">{empresa?.nombre} actualizó la política de tratamiento de datos. Para seguir usando la aplicación revisa y autoriza de nuevo.</p>
    <Casilla checked={a} onChange={(e) => setA(e.target.checked)}>Leí y acepto la <a href="#/legal/privacidad">política de privacidad</a> y los <a href="#/legal/terminos">términos de uso</a>.</Casilla>
    <Casilla checked={b} onChange={(e) => setB(e.target.checked)}>Autorizo el uso de mi <strong>ubicación</strong> y de mi <strong>fotografía</strong> al marcar, como se explica en <a href="#/legal/permisos">permisos y consentimiento</a>.</Casilla>
    <Boton cargando={c} disabled={!a || !b} onClick={enviar}>Autorizar y continuar</Boton></div></main>;
}

// Compara versiones «1.8.0»: el aviso «Actualizar» solo sale si el servidor es MÁS nuevo que la página
const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; } return 0; };
function Principal({ alSalir }) {
  const [yo, setYo] = useState(() => sesion.yo), [error, setError] = useState(null), [modoSel, setModo] = useState(null);
  const avisos = useAvisos(), enLinea = useEnLinea(), ultima = useRef(0);
  const cargar = useCallback(async () => {
    try { const d = await api('yo', { base: location.origin + location.pathname }); ultima.current = Date.now(); reloj.poner(d.ahora); sesion.yo = d; setYo(d); setError(null); aplicarMarca(d.cfg.empresa); return d; }
    catch (e) { if (e.cod !== 'SESION') setError(e); return null; }
  }, []);
  // Marcaciones guardadas sin señal: se envían desde cualquier pantalla, no solo desde Jornada
  useEffect(() => { const ir = () => { if (navigator.onLine && bandeja.mias().length) bandeja.enviar().catch(() => {}); }; ir();
    window.addEventListener('online', ir); const i = setInterval(ir, 60000); return () => { window.removeEventListener('online', ir); clearInterval(i); }; }, []);
  useEffect(() => { if (sesion.yoFresco && sesion.yo) { const d = sesion.yo; sesion.yoFresco = false; ultima.current = Date.now(); reloj.poner(d.ahora); aplicarMarca(d.cfg.empresa); } else cargar(); const alVolver = () => { if (document.visibilityState === 'visible' && Date.now() - ultima.current > 60000) cargar(); }; /* no más de una consulta por minuto */ document.addEventListener('visibilitychange', alVolver); window.addEventListener('online', cargar); return () => { document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('online', cargar); }; }, [cargar]);
  const actualizar = useCallback((parcial) => setYo((y) => { const n = { ...y, ...parcial }; sesion.yo = n; return n; }), []);
  const salir = async () => { try { await api('salir'); } catch { /* sin señal: se cierra localmente */ } sesion.cerrar(); alSalir(); };

  if (!yo) return <><Cabecera /><main className="contenido" id="contenido">{error ? <div className="pila"><Aviso tono="peligro">{error.message}</Aviso><Boton onClick={cargar}>Reintentar</Boton>{!sesion.yo?.kiosco && !guardado.leer('cj.kiosco') && <Boton variante="texto" onClick={salir}>Cerrar sesión</Boton>}</div> : <div className="pila" role="status"><span className="oculto-visual">Cargando tu información…</span><div className="esqueleto" style={{ height: 260, borderRadius: 16 }} /><Esqueleto lineas={4} /></div>}</main></>;
  if (!yo.kiosco && guardado.leer('cj.kiosco')) guardado.poner('cj.kiosco', null); // ya no es kiosco: se vuelve a mostrar «Cerrar sesión»
  if (yo.kiosco) return <main id="contenido"><Kiosco kiosco={yo.kiosco} empresa={yo.cfg?.empresa} alSalir={salir} /></main>;
  const u = yo.usuario, empresa = yo.cfg.empresa;
  const modo = modoSel || (u.rol === 'admin' && window.innerWidth > 900 ? 'admin' : 'yo'), esJefe = u.rol === 'admin' || u.rol === 'supervisor';
  const actualizarApp = () => {
    const ir = () => location.reload();
    if (!navigator.serviceWorker) return ir();
    navigator.serviceWorker.getRegistration().then((r) => {
      if (r?.waiting) { navigator.serviceWorker.addEventListener('controllerchange', ir, { once: true }); r.waiting.postMessage({ type: 'SKIP_WAITING' }); return; }
      return r?.update().then(ir, ir);
    }).catch(ir);
  };
  if (u.consVersion !== yo.cfg.versionLegal) return <Reconsentir empresa={empresa} alListo={cargar} />;
  if (u.estado !== 'activo') return <><Cabecera empresa={empresa}><Boton variante="texto" chico icono={LogOut} onClick={salir}>Salir</Boton></Cabecera>
    <main className="acceso" id="contenido"><div className="acceso-caja pila"><h1>Tu registro está en revisión</h1><p className="suave">Hola {u.nombre.split(' ')[0]}. El administrador de {empresa.nombre} debe aprobar tu usuario antes de que puedas marcar. Cuando lo haga, toca “Revisar de nuevo”.</p><Boton onClick={() => cargar().then((d) => d && d.usuario.estado !== 'activo' && avisos.info('Aún no ha sido aprobado.'))}>Revisar de nuevo</Boton></div></main></>;
  return <div className="app">
    <Cabecera empresa={empresa}>
      {esJefe && <Boton variante="texto" chico icono={modo === 'admin' ? UserRound : ShieldCheck} onClick={() => setModo(modo === 'admin' ? 'yo' : 'admin')}>{modo === 'admin' ? 'Mi jornada' : u.rol === 'admin' ? 'Administrar' : 'Mi equipo'}</Boton>}
    </Cabecera>
    {!enLinea && <div className="banda no-imprimir" role="status"><WifiOff size={16} style={{ display: 'inline', verticalAlign: '-3px' }} aria-hidden="true" /> Sin conexión. Puedes marcar: se guardará en tu celular y se enviará al volver la señal.</div>}
    {yo.version && cmpVer(yo.version, VERSION) > 0 && <div className="banda no-imprimir" role="status">Hay una versión nueva de la aplicación. <Boton chico variante="secundario" icono={RefreshCw} onClick={actualizarApp}>Actualizar</Boton></div>}
    {yo.version && cmpVer(yo.version, VERSION) < 0 && u.rol === 'admin' && <div className="banda no-imprimir" role="status">La página ya está en la versión {VERSION} y el servidor de tu empresa en la {yo.version}. Se pone al día solo esta noche, o ahora en Configuración → Licencia y versión.</div>}
    {modo === 'admin' && esJefe ? <Admin yo={yo} recargarYo={cargar} alSalir={salir} /> : <Trabajador yo={yo} actualizar={actualizar} recargar={cargar} alSalir={salir} />}
    <Ayuda rol={u.rol} />
  </div>;
}

export default function App() {
  const r = useRuta(), [token, setToken] = useState(() => sesion.token), [publico, setPublico] = useState(() => sesion.publico);
  useEffect(() => { alCaducarSesion(() => setToken(null)); }, []);
  useEffect(() => { aplicarMarca(publico?.empresa); if (!configurada()) return; api('publico').then((p) => { sesion.publico = p; setPublico(p); aplicarMarca(p.empresa); }).catch(() => {}); }, []); // eslint-disable-line
  let vista;
  if (r[0] === 'legal') vista = <Legal pagina={r[1]} empresa={publico?.empresa} />;
  else if (r[0] === 'c') vista = <Conectar codigo={r[1]} />;
  else if (r[0] === 'verificar') vista = configurada() ? <VerificarCertificado /> : <SinConfigurar />;
  else if (!configurada()) vista = <SinConfigurar />;
  else if (r[0] === 'firma') vista = <Firma codigo={r[1]} />;
  else if (!token) vista = <><Acceso publico={publico} alEntrar={(t, usuario, yo) => { sesion.token = t; sesion.yo = yo || null; sesion.yoFresco = !!yo; setToken(t); }} /><PieLegal /></>;
  else vista = <Principal alSalir={() => setToken(null)} />;
  return <Avisos>{vista}<span className="oculto-visual">Versión {VERSION}</span></Avisos>;
}
