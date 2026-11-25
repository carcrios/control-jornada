import { BotonAccesibilidad } from './App.jsx';
import React, { useState } from 'react';
import { ArrowLeft, Clock, Eye, EyeOff } from 'lucide-react';
import { api, info } from './api.js';
import { Aviso, Boton, Campo, Casilla, useAvisos, useForm } from './ui.jsx';
import { EntrarRapido, rapido } from './Rapido.jsx';

function Clave({ etiqueta, ...p }) {
  const [ver, setVer] = useState(false);
  return <div style={{ position: 'relative' }}><Campo etiqueta={etiqueta} type={ver ? 'text' : 'password'} {...p} />
    <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver} style={{ all: 'unset', position: 'absolute', right: 6, top: 27, width: 44, height: 44, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--c-texto-2)' }}>{ver ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>;
}

export default function Acceso({ publico, alEntrar }) {
  const [acc] = useState(() => rapido.leer());
  const [paso, setPaso] = useState(acc ? 'rapido' : 'cedula'), [f, campo, setF] = useForm({ cedula: '', clave: '', clave2: '', codigo: '', nombre: '', salario: '', email: '', telefono: '', datos: false, sensibles: false });
  const [carga, setCarga] = useState(false), [pista, setPista] = useState(null), [err, setErr] = useState({}), avisos = useAvisos(), empresa = publico?.empresa;
  const correr = async (fn) => { setCarga(true); setErr({}); try { await fn(); } catch (e) { setErr({ general: e.message, cod: e.cod }); } finally { setCarga(false); } };
  const ced = f.cedula.replace(/\D/g, '');

  const consultar = (e) => { e.preventDefault(); if (ced.length < 5) return setErr({ cedula: 'Escribe tu número de cédula completo, sin puntos.' });
    correr(async () => { const r = await api('consultarCedula', { cedula: ced }); if (r.inactivo) throw new Error('Tu usuario está inactivo. Habla con el administrador.'); setPaso(r.existe ? 'clave' : 'nuevo'); }); };
  const ingresar = async (clave, codigo2fa) => {
    try { const r = await api('login', { cedula: ced, clave, base: location.origin + location.pathname, ...info(), ...(codigo2fa ? { codigo2fa } : {}) }); alEntrar(r.token, r.usuario, r.yo); }
    catch (x) { if (x.cod === '2FA_REQUERIDO') { setF((y) => ({ ...y, clave, codigo: '' })); setPaso('dosPasos'); avisos.info(x.message); return; } throw x; } };
  const entrar = (e) => { e.preventDefault(); correr(() => ingresar(f.clave, paso === 'dosPasos' ? f.codigo.trim() : '')); };
  const validarNuevo = (e) => { e.preventDefault(); const x = {};
    if (!f.codigo.trim()) x.codigo = 'Escribe el código que te dio el administrador.';
    if (f.nombre.trim().length < 5) x.nombre = 'Escribe tu nombre completo.';
    if (!(+String(f.salario).replace(/\D/g, '') > 0)) x.salario = 'Escribe tu salario mensual en pesos.';
    if (f.clave.length < 6) x.clave = 'Mínimo 6 caracteres.'; else if (f.clave !== f.clave2) x.clave2 = 'Las contraseñas no coinciden.';
    setErr(x); if (!Object.keys(x).length) setPaso('permisos'); };
  const registrar = () => correr(async () => {
    try { const r = await api('registro', { cedula: ced, codigo: f.codigo.trim(), clave: f.clave, nombre: f.nombre.trim(), salario: +String(f.salario).replace(/\D/g, ''), email: f.email.trim(), telefono: f.telefono, consentimiento: { datos: f.datos, sensibles: f.sensibles }, ...info() });
      avisos.ok('Cuenta creada. ¡Bienvenido!'); alEntrar(r.token, r.usuario); }
    catch (e) { if (e.cod === 'CODIGO' || e.cod === 'DATOS' || e.cod === 'EXISTE') setPaso(e.cod === 'EXISTE' ? 'clave' : 'nuevo'); throw e; } });

  const pedirCodigo = () => correr(async () => { const r = await api('recuperarPedir', { cedula: ced }); setPista(r); if (r.enviado) setPaso('codigo'); });
  const cambiarConCodigo = (e) => { e.preventDefault(); if (f.clave.length < 6) return setErr({ clave: 'Mínimo 6 caracteres.' }); if (f.clave !== f.clave2) return setErr({ clave2: 'Las contraseñas no coinciden.' });
    correr(async () => { await api('recuperarCambiar', { cedula: ced, codigo: f.codigo.trim(), clave: f.clave, ...info() }); avisos.ok('Contraseña cambiada. Ingresando…'); await ingresar(f.clave, ''); }); };
  const n = { cedula: 1, clave: 2, nuevo: 2, permisos: 3 }[paso];
  return <main className="acceso" id="contenido"><div className="a11y-flotante"><BotonAccesibilidad claro /></div><div className="acceso-caja">
    <div className="logo"><div className="sello">{empresa?.logo ? <img src={empresa.logo} alt="" /> : <Clock size={28} aria-hidden="true" />}</div>
      <div><strong style={{ fontFamily: 'var(--f-titulo)', fontSize: 'var(--t-4)' }}>{empresa?.nombre || 'Control de jornada'}</strong><div className="suave chico">Control de jornada</div></div></div>
    {(paso === 'nuevo' || paso === 'permisos') && <div className="pasos" role="img" aria-label={`Paso ${n} de 3`}>{[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'hecho' : ''} />)}</div>}
    {err.general && <div style={{ marginBottom: 16 }}><Aviso tono="peligro">{err.general}</Aviso></div>}

    {paso === 'rapido' && acc && <EntrarRapido acc={acc} alEntrar={alEntrar} alOtro={() => setPaso('cedula')} />}
    {paso === 'cedula' && <form className="pila" onSubmit={consultar} noValidate>
      <h1>Ingresa con tu cédula</h1><p className="suave">Si es tu primera vez, aquí mismo creas tu contraseña.</p>
      <Campo etiqueta="Número de cédula" inputMode="numeric" autoComplete="username" autoFocus placeholder="Sin puntos ni espacios" error={err.cedula} {...campo('cedula')} />
      <Boton type="submit" cargando={carga}>Continuar</Boton></form>}

    {paso === 'clave' && <form className="pila" onSubmit={entrar} noValidate>
      <h1>Tu contraseña</h1><p className="suave">Cédula {ced}. La sesión queda abierta en este celular hasta que la cierres.</p>
      <Clave etiqueta="Contraseña" autoComplete="current-password" autoFocus {...campo('clave')} />
      <Boton type="submit" cargando={carga}>Entrar</Boton>
      <Boton variante="texto" icono={ArrowLeft} onClick={() => { setPaso('cedula'); setErr({}); setF((x) => ({ ...x, clave: '' })); }}>Usar otra cédula</Boton>
      <Boton variante="texto" onClick={() => { setErr({}); setPista(null); setF((x) => ({ ...x, clave: '', clave2: '', codigo: '' })); setPaso('olvido'); }}>Olvidé mi contraseña</Boton></form>}

    {paso === 'dosPasos' && <form className="pila" onSubmit={entrar} noValidate>
      <h1>Verificación en dos pasos</h1><p className="suave">Enviamos un código de 6 números a tu correo. Vence en 5 minutos. Si pides otro, solo sirve el último que llegue.</p>
      <Campo etiqueta="Código de verificación" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} {...campo('codigo')} />
      <Boton type="submit" cargando={carga} disabled={f.codigo.trim().length < 6}>Entrar</Boton>
      <Boton variante="secundario" disabled={carga} onClick={() => correr(() => ingresar(f.clave, ''))}>Enviarme otro código</Boton>
      <Boton variante="texto" icono={ArrowLeft} onClick={() => { setPaso('clave'); setErr({}); }}>Volver</Boton></form>}

    {paso === 'olvido' && <div className="pila">
      <h1>Recuperar contraseña</h1><p className="suave">Cédula {ced}. Te enviamos un código de 6 números al correo que tienes registrado. Vence en 15 minutos.</p>
      {pista && !pista.enviado && <Aviso tono="aviso">{pista.sinCorreo ? 'Tu usuario no tiene un correo registrado.' : 'No fue posible enviarte el código.'} Pide al administrador un código nuevo de activación: con él creas otra contraseña.</Aviso>}
      <Boton cargando={carga} onClick={pedirCodigo}>Enviarme el código</Boton>
      <Boton variante="texto" icono={ArrowLeft} onClick={() => { setPaso('clave'); setErr({}); }}>Volver</Boton></div>}

    {paso === 'codigo' && <form className="pila" onSubmit={cambiarConCodigo} noValidate>
      <h1>Escribe el código</h1><p className="suave">Lo enviamos a {pista?.pista}. Revisa también la carpeta de correo no deseado.</p>
      <Campo etiqueta="Código de 6 números" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} {...campo('codigo')} />
      <Clave etiqueta="Contraseña nueva" autoComplete="new-password" ayuda="Mínimo 6 caracteres. No uses tu cédula ni 123456." error={err.clave} {...campo('clave')} />
      <Clave etiqueta="Repite la contraseña" autoComplete="new-password" error={err.clave2} {...campo('clave2')} />
      <Boton type="submit" cargando={carga} disabled={f.codigo.trim().length < 6}>Cambiar contraseña y entrar</Boton>
      <Boton variante="texto" icono={ArrowLeft} onClick={() => { setPaso('olvido'); setErr({}); }}>Pedir otro código</Boton></form>}

    {paso === 'nuevo' && <form className="pila" onSubmit={validarNuevo} noValidate>
      <h1>Crea tu cuenta</h1><p className="suave">Cédula {ced}. Solo se hace una vez.</p>
      <Campo etiqueta="Código de activación" ayuda="Te lo entrega el administrador. Es de un solo uso." autoComplete="one-time-code" autoFocus error={err.codigo} {...campo('codigo')} />
      <Campo etiqueta="Nombre completo" autoComplete="name" error={err.nombre} {...campo('nombre')} />
      <Campo etiqueta="Salario mensual" inputMode="numeric" placeholder="Ej.: 1750905" ayuda="Se usa para estimar lo que llevas ganado. El administrador lo valida." error={err.salario} {...campo('salario')} />
      <Campo etiqueta="Correo (opcional)" type="email" autoComplete="email" ayuda="Para recordatorios y respuesta de tus permisos." {...campo('email')} />
      <Clave etiqueta="Crea tu contraseña" autoComplete="new-password" ayuda="Mínimo 6 caracteres. No uses tu cédula ni 123456." error={err.clave} {...campo('clave')} />
      <Clave etiqueta="Repite la contraseña" autoComplete="new-password" error={err.clave2} {...campo('clave2')} />
      <Boton type="submit">Continuar</Boton><Boton variante="texto" icono={ArrowLeft} onClick={() => { setPaso('cedula'); setErr({}); }}>Volver</Boton></form>}

    {paso === 'permisos' && <div className="pila">
      <h1>Tus datos y permisos</h1>
      <p className="suave">Para registrar tu jornada la aplicación necesita lo siguiente. Puedes leer el detalle antes de autorizar.</p>
      <Casilla {...campo('datos', 'check')}>Leí y acepto la <a href="#/legal/privacidad" target="_blank" rel="noreferrer">política de privacidad</a> y los <a href="#/legal/terminos" target="_blank" rel="noreferrer">términos de uso</a>. Autorizo el tratamiento de mis datos para controlar mi jornada y liquidar mi pago.</Casilla>
      <Casilla {...campo('sensibles', 'check')}>Autorizo de forma expresa que al marcar se registre mi <strong>ubicación</strong> y, algunas veces al azar, una <strong>fotografía de mi rostro</strong> (dato sensible). Sé que no estoy obligado a autorizar datos sensibles; sin ellos no podré marcar en la aplicación y deberé usar el registro alterno de la empresa. <a href="#/legal/permisos" target="_blank" rel="noreferrer">Ver detalle</a>.</Casilla>
      <Boton cargando={carga} disabled={!f.datos || !f.sensibles} onClick={registrar}>Autorizar y crear mi cuenta</Boton>
      <Boton variante="texto" icono={ArrowLeft} onClick={() => setPaso('nuevo')}>Volver</Boton></div>}
  </div></main>;
}
