// Entrar rápido: PIN de 4 a 6 números o huella del celular, en vez de cédula y contraseña.
// El celular guarda un secreto largo que el servidor reconoce; el PIN o la huella lo desbloquean.
import React, { useEffect, useState } from 'react';
import { Delete, Fingerprint, KeyRound } from 'lucide-react';
import { api, guardado, info } from './api.js';
import { Aviso, Boton, Campo, useAvisos } from './ui.jsx';

const K = 'cj.rapido';
export const rapido = { leer: () => guardado.leer(K, null), poner: (x) => guardado.poner(K, x), quitar: () => guardado.poner(K, null) };
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))), deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const azar = (n) => crypto.getRandomValues(new Uint8Array(n));
export async function hayHuella() { try { return !!window.PublicKeyCredential && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; } }
async function crearHuella(u) {
  const c = await navigator.credentials.create({ publicKey: { challenge: azar(32), rp: { name: 'Control de jornada' }, user: { id: azar(16), name: u.cedula, displayName: u.nombre },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000 } });
  return b64(c.rawId);
}
async function pedirHuella(credId) { await navigator.credentials.get({ publicKey: { challenge: azar(32), allowCredentials: [{ type: 'public-key', id: deB64(credId) }], userVerification: 'required', timeout: 60000 } }); }

/* Configuración en «Mi perfil» */
export function ConfigRapido({ u }) {
  const [act, setAct] = useState(() => rapido.leer()), [pin, setPin] = useState(''), [pin2, setPin2] = useState(''), [huella, setHuella] = useState(false), [ocup, setOcup] = useState(false), avisos = useAvisos();
  useEffect(() => { hayHuella().then(setHuella); }, []);
  const activa = act && act.cedula === u.cedula;
  const crear = async (modo) => {
    setOcup(true);
    try {
      let credId = ''; if (modo === 'huella') credId = await crearHuella(u);
      const r = await api('accesoCrear', { modo, pin: modo === 'pin' ? pin : '', ...info() });
      const x = { id: r.id, secreto: r.secreto, modo, cedula: u.cedula, nombre: u.nombre.split(' ')[0], credId }; rapido.poner(x); setAct(x); setPin(''); setPin2('');
      avisos.ok(modo === 'huella' ? 'Listo: la próxima vez entras con tu huella.' : 'Listo: la próxima vez entras con tu PIN.');
    } catch (e) { avisos.error(e.name === 'NotAllowedError' ? 'No se pudo leer la huella. Intenta otra vez o usa un PIN.' : e); } finally { setOcup(false); }
  };
  const quitar = async () => { setOcup(true); try { await api('accesoBorrar'); } catch { /* igual se quita del celular */ } rapido.quitar(); setAct(null); setOcup(false); avisos.ok('Acceso rápido quitado de este celular.'); };
  if (activa) return <div className="pila"><Aviso tono="ok">En este celular entras con {act.modo === 'huella' ? 'tu huella' : 'tu PIN'}. Tu sesión además queda abierta: casi nunca te lo pedirá.</Aviso>
    <Boton variante="secundario" cargando={ocup} onClick={quitar}>Quitar el acceso rápido</Boton></div>;
  if (u.rol === 'admin') return <p className="suave chico">Los administradores entran siempre con su contraseña.</p>;
  return <div className="pila">
    <p className="suave chico">Si tu sesión se cierra, entras sin escribir cédula ni contraseña. Funciona solo en este celular.</p>
    {huella && <Boton icono={Fingerprint} cargando={ocup} onClick={() => crear('huella')}>Entrar con mi huella</Boton>}
    <div className="rejilla"><Campo etiqueta="PIN de 4 a 6 números" inputMode="numeric" type="password" autoComplete="new-password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      <Campo etiqueta="Repite el PIN" inputMode="numeric" type="password" autoComplete="new-password" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} error={pin2 && pin2.length >= pin.length && pin2 !== pin ? 'No coincide.' : ''} /></div>
    <Boton variante="secundario" icono={KeyRound} cargando={ocup} disabled={pin.length < 4 || pin !== pin2} onClick={() => crear('pin')}>Usar este PIN</Boton>
  </div>;
}

/* Pantalla de entrada rápida */
export function EntrarRapido({ acc, alEntrar, alOtro }) {
  const [pin, setPin] = useState(''), [err, setErr] = useState(''), [ocup, setOcup] = useState(false);
  const entrar = async (p) => {
    setOcup(true); setErr('');
    try {
      if (acc.modo === 'huella') await pedirHuella(acc.credId);
      const r = await api('loginRapido', { id: acc.id, secreto: acc.secreto, pin: p || '', base: location.origin + location.pathname, ...info() }); alEntrar(r.token, r.usuario, r.yo);
    } catch (e) {
      if (e.cod === 'ACCESO_RAPIDO') { rapido.quitar(); setErr(e.message); setTimeout(alOtro, 3500); }
      else setErr(e.name === 'NotAllowedError' ? 'No se leyó la huella. Toca otra vez.' : e.message); setPin('');
    } finally { setOcup(false); }
  };
  const tecla = (d) => { if (ocup) return; const n = (pin + d).slice(0, 6); setPin(n); setErr(''); };
  return <div className="pila entrar-rapido">
    <h1>Hola, {acc.nombre}</h1>
    {acc.modo === 'huella' ? <><p className="suave">Toca el botón y pon tu dedo en el lector.</p><Boton icono={Fingerprint} cargando={ocup} onClick={() => entrar('')}>Entrar con mi huella</Boton></>
      : <><p className="suave">Escribe tu PIN.</p>
        <div className="puntos-pin" aria-live="polite" aria-label={`${pin.length} números escritos`}>{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={i < pin.length ? 'lleno' : ''} />)}</div>
        <div className="teclado-pin" role="group" aria-label="Teclado del PIN">{['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} type="button" onClick={() => tecla(d)}>{d}</button>)}
          <button type="button" aria-label="Borrar" onClick={() => setPin(pin.slice(0, -1))}><Delete size={24} aria-hidden="true" /></button><button type="button" onClick={() => tecla('0')}>0</button>
          <button type="button" className="ok" disabled={pin.length < 4 || ocup} onClick={() => entrar(pin)}>{ocup ? '…' : 'Entrar'}</button></div></>}
    {err && <Aviso tono="peligro">{err}</Aviso>}
    <Boton variante="texto" onClick={alOtro}>Entrar con cédula y contraseña</Boton>
  </div>;
}
