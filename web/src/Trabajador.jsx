import { PanelAccesibilidad, hablar } from './a11y.jsx';
import { createPortal } from 'react-dom';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, Camera, Check, Clock, Download, FileText, History, KeyRound, LogOut, MapPin, MessageCircle, Plus, Printer, ArrowLeft, UserRound, Wallet, LayoutGrid, QrCode, ScanLine, CheckCircle2, CalendarCheck, LogIn, UtensilsCrossed, Undo2, CloudOff, HelpCircle } from 'lucide-react';
import { api, bandeja, reintentable, reloj } from './api.js';
import { Aviso, Boton, Campo, Estado, Hoja, Insignia, Tarjeta, Vacio, useAvisos, useCarga, useForm, Confirmar, recordarTexto } from './ui.jsx';
import { ErrorPermiso, NOMBRE_TIPO, CORTO_TIPO, TIPOS, ahoraISO, comoPermitir, comprimir, comprimirArchivo, fechaCorta, fechaLarga, horas, horasDec, hoyISO, idNuevo, notificacionesActivas, pedirNotificaciones, pesos, programarRecordatorios, sumarDias, ubicar, saludo } from './util.js';
import { DetallePermiso, nombreEstado, tonoPermiso } from './Firma.jsx';
import { PieLegal } from './Legal.jsx';
import { rangoRapido } from './Informes.jsx';
import Mas, { tiene } from './Autoservicio.jsx';
import { ConfigRapido } from './Rapido.jsx';
import Guia from './Guia.jsx';

/* ---------- Botón único: lo que toca ahora, con palabras de obra ---------- */
const PROG = { entrada: 'e', sal_alm: 'ai', ent_alm: 'af', salida: 's' };
export const BOTON = { entrada: ['Llegué', LogIn], sal_alm: ['Salgo a almorzar', UtensilsCrossed], ent_alm: ['Volví del almuerzo', LogIn], salida: ['Me voy', LogOut] };
const HECHO = { entrada: 'Entrada registrada', sal_alm: 'Salida a almuerzo registrada', ent_alm: 'Regreso de almuerzo registrado', salida: 'Salida registrada' };
// Confirmación que no deja dudas: pantalla completa, hora en grande, vibración y voz (si la persona la activó)
function Confirmacion({ c, alCerrar, alDeshacer }) {
  const ref = useRef(null);
  useEffect(() => { if (!c) return; const antes = document.activeElement; ref.current?.focus(); try { navigator.vibrate?.(c.offline ? [200] : [90, 60, 90]); } catch { /* sin vibración */ }
    hablar(c.offline ? `Guardado en tu celular. ${HECHO[c.tipo]} a las ${c.hora}. Se envía cuando haya señal.` : `${HECHO[c.tipo]}, ${c.hora}.`);
    // Escape cierra y Tab no se sale del aviso; al cerrar el foco vuelve a donde estaba
    const tecla = (e) => { if (e.key === 'Escape') alCerrar();
      if (e.key === 'Tab' && ref.current) { const b = ref.current.querySelectorAll('button'); if (!b.length) return; const p = b[0], u = b[b.length - 1];
        if (e.shiftKey && document.activeElement === p) { e.preventDefault(); u.focus(); } else if (!e.shiftKey && document.activeElement === u) { e.preventDefault(); p.focus(); } } };
    document.addEventListener('keydown', tecla);
    const t = setTimeout(alCerrar, c.fuera || c.offline ? 12000 : 8000);
    return () => { clearTimeout(t); document.removeEventListener('keydown', tecla); try { antes?.focus?.(); } catch { /* ya no existe */ } }; }, [c]); // eslint-disable-line
  if (!c) return null;
  return <div className={`confirmacion ${c.offline ? 'sin-senal' : c.fuera ? 'fuera' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="conf-t" tabIndex={-1} ref={ref}>
    <div className="conf-icono" aria-hidden="true">{c.offline ? <CloudOff size={64} /> : <Check size={72} strokeWidth={3} />}</div>
    <h2 id="conf-t">{c.offline ? 'Guardado en tu celular' : HECHO[c.tipo]}</h2>
    <div className="conf-hora num">{c.hora}</div>
    {c.offline && <p>{c.sesion ? 'Tu sesión se cerró, pero la marcación quedó guardada. Vuelve a entrar y se envía sola.' : `No hay señal. ${HECHO[c.tipo]} quedó guardada y se envía sola cuando vuelva la señal.`}</p>}
    {c.fuera > 0 && <p>Quedó fuera de la obra ({c.fuera} m). Si estás en la obra, avísale a tu supervisor.</p>}
    <div className="fila" style={{ justifyContent: 'center', marginTop: 16 }}>
      {c.seg > 0 && <Boton variante="secundario" icono={Undo2} onClick={alDeshacer}>Me equivoqué, deshacer</Boton>}
      <Boton onClick={alCerrar}>Listo</Boton></div>
  </div>;
}
function useCuenta(hasta) { const [, t] = useState(0); useEffect(() => { if (!hasta) return; const i = setInterval(() => { t((x) => x + 1); if (Date.now() > hasta) clearInterval(i); }, 1000); return () => clearInterval(i); }, [hasta]); return hasta ? Math.max(0, Math.round((hasta - Date.now()) / 1000)) : 0; }

/* ---------- Cámara: la foto se toma en el momento y se comprime en el celular ---------- */
export function Camara({ tipo, alTerminar }) {
  const video = useRef(null), flujo = useRef(null), [lista, setLista] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: 'NotSupportedError' });
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 } }, audio: false });
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        flujo.current = s; video.current.srcObject = s; await video.current.play(); setLista(true);
      } catch (e) { setError(e.name === 'NotAllowedError' ? 'bloqueo' : 'falla'); }
    })();
    return () => { vivo = false; flujo.current?.getTracks().forEach((t) => t.stop()); };
  }, []);
  // Se dibuja directo en el cuerpo de la página (portal): así ocupa toda la pantalla aunque esté dentro de una tarjeta
  return createPortal(<div className="camara" role="dialog" aria-modal="true" aria-label="Tomar foto para la marcación">
    {error ? <div className="cam-barra" style={{ flex: 1, justifyContent: 'center' }}><Camera size={40} aria-hidden="true" /><p role="alert">{error === 'bloqueo' ? 'La cámara está bloqueada y esta marcación pide foto. ' + comoPermitir('Cámara') : 'No se pudo abrir la cámara de este dispositivo. Cierra otras aplicaciones que la estén usando e intenta de nuevo.'}</p><Boton variante="acento" onClick={() => alTerminar(null, error)}>Entendido</Boton></div> : <>
      <video ref={video} playsInline muted aria-label="Vista de la cámara frontal" />
      <div className="cam-arriba"><strong>Foto para «{BOTON[tipo]?.[0] || NOMBRE_TIPO[tipo]}»</strong><span>Pon tu cara dentro del óvalo, con buena luz</span></div>
      <div className="cam-guia" aria-hidden="true" />
      <div className="cam-barra">
        <button className="disparo" disabled={!lista} aria-label="Tomar la foto" onClick={() => alTerminar(comprimir(video.current))}><Camera size={30} aria-hidden="true" /></button>
        <span className="cam-ayuda">{lista ? 'Toca el botón para tomar la foto' : 'Abriendo la cámara…'}</span>
        <button type="button" className="cam-cancelar" onClick={() => alTerminar(null, 'cancelo')}>Cancelar · no se registra la marcación</button></div></>}
  </div>, document.body);
}

function Reloj() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  const p = (n) => String(n).padStart(2, '0');
  return <div className="reloj" role="timer" aria-label={`Son las ${p(t.getHours())} y ${p(t.getMinutes())}`}><span>{p(t.getHours())}:{p(t.getMinutes())}</span><small>{p(t.getSeconds())}</small></div>;
}

/* ---------- Inicio: tarjeta de tiempo + resumen de horas y dinero ---------- */
function Inicio({ yo, actualizar, recargar }) {
  const { resumen, centros, usuario, cfg } = yo, avisos = useAvisos();
  const [fase, setFase] = useState(null), [vuelta, setVuelta] = useState(0), [bloqueo, setBloqueo] = useState(null), [camara, setCamara] = useState(null), [olvido, setOlvido] = useState(false), [detalle, setDetalle] = useState(false);
  const [centroSel, setCentroSel] = useState(yo.hoy.centroId || usuario.centroId || ''), [pend, setPend] = useState(() => bandeja.mias(usuario.cedula).length), [rech, setRech] = useState(() => bandeja.rechazadas(usuario.cedula));
  // Estado del día: si lo guardado es de ayer (se abrió sin señal) se empieza un día nuevo, y se superpone lo que espera en la bandeja.
  const hoy = useMemo(() => {
    let h = yo.hoy; const abierta = h.marcas?.entrada && !h.marcas?.salida;
    if (h.fecha !== hoyISO()) { // los datos guardados son de otro día (por ejemplo, sin señal al llegar)
      const ms = (f, hm) => new Date(`${f}T${hm}:00-05:00`).getTime(), ya = reloj.ahora().getTime(), hr = h.horario;
      const sigue = abierta && ya - ms(h.fecha, h.marcas.entrada) < 16 * 3600e3 && (hr && hr.e && hr.s ? (hr.s <= hr.e || ya <= ms(h.fecha, hr.s) + 4 * 3600e3) : h.marcas.entrada >= '14:00');
      if (!sigue) {
        const yaCorregida = bandeja.mias(usuario.cedula).some((m) => m.manual && m.tipo === 'salida' && m.fecha === h.fecha);
        const pendiente = abierta && !yaCorregida ? { fecha: h.fecha, entrada: h.marcas.entrada, horaSalidaHorario: (hr && hr.s) || '' } : null;
        h = { ...h, fecha: hoyISO(), marcas: {}, fotoPlan: {}, festivo: false, viejo: true, horario: null, ayerSinSalida: pendiente };
      }
    }
    const marcas = { ...h.marcas }; bandeja.mias(usuario.cedula).forEach((m) => { if (!m.manual && m.hora.slice(0, 10) >= h.fecha && !marcas[m.tipo]) marcas[m.tipo] = m.hora.slice(11); });
    const sinAlm = h.sinAlmuerzo && h.sinAlmuerzo.estado !== 'rechazado' && !marcas.sal_alm; // reportó que no salió a almuerzo
    const almManual = !!cfg.marcarAlmuerzo || (!!marcas.sal_alm && !marcas.ent_alm); // por defecto el almuerzo sale del horario de la obra
    return { ...h, marcas, almManual, siguiente: !marcas.entrada ? 'entrada' : marcas.salida ? null : (sinAlm || !almManual) && !(marcas.sal_alm && !marcas.ent_alm) ? 'salida' : !marcas.sal_alm ? 'sal_alm' : !marcas.ent_alm ? 'ent_alm' : 'salida' };
  }, [yo.hoy, pend]);
  const pedirFoto = (tipo) => new Promise((ok) => setCamara({ tipo, ok }));
  const [qr, setQr] = useState(null), pedirQr = () => new Promise((ok) => setQr({ ok }));

  const enviarPendientes = useCallback(async () => {
    if (!bandeja.mias(usuario.cedula).length || !navigator.onLine) return;
    const r = await bandeja.enviar(); setPend(r.pendientes); setRech(bandeja.rechazadas(usuario.cedula));
    if (r.enviadas) { avisos.ok(`${r.enviadas} marcación(es) guardada(s) en tu celular ya se enviaron.`); recargar(); }
    if (r.rechazadas.length) avisos.error('Una marcación guardada no fue aceptada. Mira el aviso en esta pantalla.', 10000);
  }, [avisos, recargar]);
  useEffect(() => { // se reintenta al abrir, al volver la señal, al volver a la aplicación y cada 45 s mientras haya pendientes
    enviarPendientes(); const v = () => { if (document.visibilityState === 'visible') enviarPendientes(); };
    window.addEventListener('online', enviarPendientes); document.addEventListener('visibilitychange', v); const i = pend > 0 ? setInterval(enviarPendientes, 45000) : null;
    return () => { window.removeEventListener('online', enviarPendientes); document.removeEventListener('visibilitychange', v); if (i) clearInterval(i); };
  }, [enviarPendientes, pend]);
  useEffect(() => { programarRecordatorios(hoy, cfg.recordatorioMin); }, [hoy, cfg.recordatorioMin]);

  const reintentando = useRef(false);
  async function reintentarRech(r) {
    if (reintentando.current) return; reintentando.current = true;
    try {
      let extra = {};
      if (r.codRechazo === 'QR_REQUERIDO') { const c = await pedirQr(); if (!c) return; extra = { qrCodigo: c }; }
      const m = await bandeja.reintentar(r.id, extra); if (!m) return;
      setFase('enviando');
      try { const x = await api('marcar', { ...m, offline: true }); bandeja.descartarRechazada(r.id); actualizar({ hoy: x.hoy, resumen: x.resumen }); avisos.ok(`${NOMBRE_TIPO[m.tipo]} de las ${m.hora.slice(11)} quedó registrada.`); }
      catch (e) {
        if (reintentable(e)) { await bandeja.agregar(m); bandeja.descartarRechazada(r.id); setPend(bandeja.mias(usuario.cedula).length); avisos.info('Sin señal: quedó en la bandeja de tu celular y se enviará sola.'); }
        else avisos.error(e);
      }
      setRech(bandeja.rechazadas(usuario.cedula));
    } finally { setFase(null); reintentando.current = false; }
  }
  const [ayer, setAyer] = useState(null), [guia, setGuia] = useState(false), [conf, setConf] = useState(null), [deshacer, setDeshacer] = useState(null);
  const [confPerm, setConfPerm] = useState(false), [sinAlm, setSinAlm] = useState(null), [autoriz, setAutoriz] = useState(null), [envSA, setEnvSA] = useState(false);
  const abrirSinAlm = async () => { let ult = ''; try { ult = localStorage.getItem('cj.ultAutoriza') || ''; } catch { /* sin almacenamiento */ } setSinAlm({ autoriza: ult, otro: '', razon: '' }); if (!autoriz) { try { setAutoriz(await api('autorizadores')); } catch { setAutoriz([]); } } };
  const enviarSinAlm = async () => {
    setEnvSA(true);
    try { try { localStorage.setItem('cj.ultAutoriza', sinAlm.autoriza === 'otro' ? '' : sinAlm.autoriza); } catch { /* sin almacenamiento */ } recordarTexto('sinAlmuerzo', sinAlm.razon); const r = await api('sinAlmuerzo', { autoriza: sinAlm.autoriza === 'otro' ? 'otro:' + sinAlm.otro : sinAlm.autoriza, razon: sinAlm.razon }); actualizar({ hoy: r.hoy, resumen: r.resumen }); setSinAlm(null); avisos.ok('Quedó reportado que hoy no saliste a almuerzo. Tu jefe lo aprueba; el siguiente paso es tu salida.', 8000); }
    catch (e) { avisos.error(e); } finally { setEnvSA(false); }
  };
  const hAlm = hoy.horario && hoy.horario.ai, ahoraHM = reloj.ahora().toTimeString().slice(0, 5);
  const yaPasoAlm = hAlm && (hoy.almManual ? ahoraHM > hoy.horario.af : ahoraHM >= hoy.horario.ai);
  const puedeSinAlm = !hoy.sinAlmuerzo && !hoy.marcas?.sal_alm && hoy.marcas?.entrada && !hoy.marcas?.salida && (hoy.siguiente === 'sal_alm' || (hoy.siguiente === 'salida' && !hoy.almManual));
  async function usarPermiso() {
    const p = hoy.permiso; if (!p) return; setConfPerm(false);
    setBloqueo(null); setFase('gps'); let pos;
    try { pos = await ubicar(); }
    catch (e) { setFase(null); const b = e instanceof ErrorPermiso ? e : new ErrorPermiso('gps', 'No se pudo obtener la ubicación.', false); setBloqueo(b); return; }
    setFase('enviando');
    try {
      const r = await api(p.fase === 'salir' ? 'permisoSalir' : 'permisoRegresar', { id: p.id, ...pos });
      actualizar({ hoy: r.hoy, resumen: r.resumen });
      avisos.ok(p.fase === 'salir'
        ? `Salida a tu permiso registrada a las ${r.hora}.${r.cerroJornada ? ' Tu jornada de hoy quedó cerrada.' : r.regresaHoy ? ' Cuando vuelvas, toca «Regresé del permiso».' : ''}`
        : `Regreso del permiso registrado a las ${r.hora}.${r.tarde > 0 ? ` Llegaste ${r.tarde} min después de lo aprobado.` : ''}`, 8000);
    } catch (e) { if (reintentable(e)) avisos.error('Sin conexión: el uso del permiso necesita señal. Intenta de nuevo en un momento.'); else avisos.error(e); }
    finally { setFase(null); }
  }
  async function marcar(tipo, extra = {}) {
    const fin = () => { setFase(null); setVuelta((v) => v + 1); };
    setBloqueo(null); setFase('gps');
    let pos;
    try { pos = await ubicar(); }
    catch (e) { fin(); const b = e instanceof ErrorPermiso ? e : new ErrorPermiso('gps', 'No se pudo obtener la ubicación.', false); setBloqueo(b); if (extra.manual) avisos.error(b.message, 12000); if (e.bloqueado) api('bloqueo', { que: 'gps', tipo }).catch(() => {}); return false; }
    const m = { id: idNuevo(), cedula: usuario.cedula, tipo, ...pos, centroId: centroSel, hora: ahoraISO(reloj.ahora()), ...extra };
    const tomar = async () => {
      setFase('foto'); const { foto, motivo } = await pedirFoto(tipo);
      if (!foto) { fin(); const avisa = motivo !== 'falla'; // una falla técnica de la cámara no se reporta como bloqueo
        setBloqueo(new ErrorPermiso('camara', 'Sin la foto no se puede registrar esta marcación. Toca de nuevo el botón y toma la foto.', avisa)); if (avisa) api('bloqueo', { que: 'camara', tipo }).catch(() => {}); return false; }
      m.foto = foto; return true;
    };
    if (!extra.manual && hoy.fotoPlan?.[tipo] && !(await tomar())) return false;
    // Obra con QR: se pide antes de enviar, para que la marcación también sirva si queda guardada sin señal
    if (!extra.manual && !m.qrCodigo && yo.centros?.find((c) => c.id === centroSel)?.exigirQr) { setFase('qr'); const c = await pedirQr(); if (!c) { fin(); return false; } m.qrCodigo = c; }
    for (let intento = 0; intento < 3; intento++) {
      setFase('enviando');
      try {
        const r = await api('marcar', m, { espera: 15000, reintentos: 1 }); actualizar({ hoy: r.hoy, resumen: r.resumen }); fin();
        if (extra.manual) avisos.ok(`${NOMBRE_TIPO[tipo]} registrada a las ${r.hora.slice(11)}.`);
        else { setConf({ tipo, hora: r.hora.slice(11), fuera: r.enZona === '0' ? r.dist : 0, seg: r.deshacerSeg || 0 }); setDeshacer(r.deshacerSeg ? { id: r.id, tipo, hasta: Date.now() + r.deshacerSeg * 1000 - 3000 } : null); }
        return true;
      } catch (e) {
        if (e.cod === 'FOTO_REQUERIDA' && !m.foto) { if (!(await tomar())) return false; continue; }
        if (e.cod === 'QR_REQUERIDO' && !m.qrCodigo) { setFase('qr'); const c = await pedirQr(); if (!c) { fin(); return false; } m.qrCodigo = c; continue; }
        if (reintentable(e) || e.cod === 'SESION') { // sin señal o sesión vencida justo al marcar: se guarda y sale al volver a entrar
          const guardada = await bandeja.agregar(m); setPend(bandeja.mias(usuario.cedula).length);
          if (!guardada) { fin(); avisos.error('Sin señal y el celular no tiene espacio para guardar la marcación. Libera espacio o marca con «Se me olvidó marcar» cuando vuelva la señal.', 12000); return false; }
          if (!extra.manual) { const marcas = { ...hoy.marcas, [tipo]: m.hora.slice(11) }; actualizar({ hoy: { ...hoy, marcas, siguiente: tipo === 'salida' ? null : TIPOS[TIPOS.indexOf(tipo) + 1] } }); }
          fin(); if (extra.manual) avisos.info(`Sin señal: “${NOMBRE_TIPO[tipo]}” de las ${m.hora.slice(11)} quedó guardada en tu celular y se enviará sola en un momento.`, 8000); else { setConf({ tipo, hora: m.hora.slice(11), offline: true, seg: 120, sesion: e.cod === 'SESION' }); setDeshacer({ id: m.id, tipo, local: true, antes: hoy, hasta: Date.now() + 117000 }); } return true;
        }
        fin(); avisos.error(e); return false;
      }
    }
    fin(); return false;
  }

  const sig = hoy.siguiente, m = hoy.marcas || {}, ocupado = !!fase, h = hoy.horario, quedan = useCuenta(deshacer?.hasta);
  async function hacerDeshacer() {
    const x = deshacer; setConf(null); if (!x) return; setDeshacer(null);
    if (x.local) { // guardada sin señal: se borra del celular, nada llegó al servidor
      if (!bandeja.mias(usuario.cedula).some((b) => b.id === x.id)) { avisos.info('Esa marcación ya se envió. Pide al administrador que la corrija.', 7000); return; }
      bandeja.quitar(x.id); setPend(bandeja.mias(usuario.cedula).length); actualizar({ hoy: x.antes }); avisos.info(`Listo: se borró «${BOTON[x.tipo][0]}» del celular.`, 7000); return; }
    setFase('enviando');
    try { const r = await api('marcarDeshacer', { id: x.id }); actualizar({ hoy: r.hoy, resumen: r.resumen }); avisos.info(`Listo: se borró «${BOTON[r.tipo][0]}». Márcalo de nuevo cuando corresponda.`, 7000); }
    catch (e) { avisos.error(e); } finally { setFase(null); setVuelta((v) => v + 1); }
  }
  const textoFase = { gps: 'Obteniendo tu ubicación…', foto: 'Esperando la foto…', qr: 'Esperando el código de la obra…', enviando: 'Registrando…' }[fase];
  return <div className="pila">
    <Recordatorios hoy={hoy} sig={sig} reloj={reloj} alOlvido={(o) => (hoy.ayerSinSalida && o.tipo === 'salida' && o.fecha === hoy.ayerSinSalida.fecha ? setAyer({ hora: hoy.ayerSinSalida.horaSalidaHorario || (h && h.s) || '17:00', conEntrada: false }) : setOlvido(o))} />
    {hoy.permiso && <section className={`permiso-hoy ${hoy.permiso.fase}`} aria-label="Permiso aprobado para hoy">
      <div className="fila" style={{ gap: 10, alignItems: 'flex-start' }}><CalendarCheck size={26} aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
        <div className="crece"><strong>{hoy.permiso.fase === 'salir' ? 'Tienes un permiso aprobado hoy' : 'Estás en tu permiso'}</strong>
          <div>{hoy.permiso.tipoNombre}</div>
          <div className="chico">{hoy.permiso.fase === 'salir'
            ? <>Sales {hoy.permiso.horaSalida ? `a las ${hoy.permiso.horaSalida}` : 'hoy'} · {hoy.permiso.regresaHoy ? `regresas hoy a las ${hoy.permiso.horaRegreso}` : `regresas el ${fechaCorta(hoy.permiso.fechaRegreso)}${hoy.permiso.horaRegreso ? ` a las ${hoy.permiso.horaRegreso}` : ''}`}</>
            : <>Saliste a las {hoy.permiso.salidaReal} · debes regresar a las {hoy.permiso.horaRegreso}</>}</div></div></div>
      <Boton ancho icono={hoy.permiso.fase === 'salir' ? LogOut : LogIn} disabled={!!fase} cargando={fase === 'enviando'} onClick={() => (hoy.permiso.fase === 'salir' ? setConfPerm(true) : usarPermiso())}>
        {hoy.permiso.fase === 'salir' ? 'Salir a mi permiso' : 'Regresé del permiso'}</Boton>
    </section>}
    <Hoja abierta={!!sinAlm} alCerrar={() => setSinAlm(null)} titulo="No salí a almuerzo">{sinAlm && <div className="pila">
      <p className="suave">Cuéntanos quién te autorizó a trabajar sin salir a almuerzo y por qué. Tu jefe lo revisa: si lo aprueba, ese tiempo cuenta como trabajado.</p>
      <Campo como="select" etiqueta="¿Quién lo autorizó?" value={sinAlm.autoriza} onChange={(e) => setSinAlm({ ...sinAlm, autoriza: e.target.value })}>
        <option value="">{autoriz ? 'Elige…' : 'Cargando…'}</option>{(autoriz || []).map((x) => <option key={x.id} value={x.id}>{x.nombre} · {x.cargo}</option>)}<option value="otro">Otra persona</option></Campo>
      {sinAlm.autoriza === 'otro' && <Campo etiqueta="Nombre de quien autorizó" value={sinAlm.otro} maxLength={60} onChange={(e) => setSinAlm({ ...sinAlm, otro: e.target.value })} />}
      <Campo como="textarea" rows={3} etiqueta="¿Por qué no saliste a almuerzo?" ayuda="Puedes dictarlo con el micrófono o tocar una razón que ya usaste." recordar="sinAlmuerzo" maxLength={300} value={sinAlm.razon} onChange={(e) => setSinAlm({ ...sinAlm, razon: e.target.value })} />
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setSinAlm(null)}>Cancelar</Boton>
        <Boton cargando={envSA} disabled={!sinAlm.autoriza || (sinAlm.autoriza === 'otro' && sinAlm.otro.trim().length < 3) || sinAlm.razon.trim().length < 5} onClick={enviarSinAlm}>Enviar</Boton></div>
    </div>}</Hoja>
    <Confirmar abierta={confPerm} titulo="Salir a tu permiso" texto="Sí, salir ahora" alConfirmar={usarPermiso} alCerrar={() => setConfPerm(false)}>
      {hoy.permiso && <>Vas a registrar que sales ahora a tu permiso de <strong>{hoy.permiso.tipoNombre}</strong>. {hoy.permiso.regresaHoy ? 'Cuando vuelvas, toca «Regresé del permiso».' : hoy.permiso && hoy.marcas?.entrada && !hoy.marcas?.salida ? 'Como no regresas hoy, también se marca tu salida del día.' : ''} Se guarda la hora y tu ubicación.</>}
    </Confirmar>
    <section className="reloj-tarjeta" aria-label="Tarjeta de tiempo de hoy">
      <p className="saludo">{saludo()}, {usuario.nombre.split(' ')[0]}</p>
      <div className="fecha">{fechaLarga(hoy.fecha)}{hoy.festivo ? ' · festivo' : ''}</div>
      {h && h.ai && h.af && <div className="chico" style={{ opacity: .85 }}>Almuerzo {h.ai}–{h.af}{hoy.almManual ? '' : hoy.sinAlmuerzo ? ' (no salió)' : ' · se descuenta solo'}</div>}
      <Reloj />
      <ol className={`riel${hoy.almManual ? '' : ' dos'}`} aria-label="Marcaciones de la jornada">{TIPOS.filter((t) => hoy.almManual || t === 'entrada' || t === 'salida').map((t) => { const sinA = hoy.sinAlmuerzo && hoy.sinAlmuerzo.estado !== 'rechazado' && (t === 'sal_alm' || t === 'ent_alm') && !m[t]; const omit = sinA || (!m[t] && TIPOS.some((x) => TIPOS.indexOf(x) > TIPOS.indexOf(t) && m[x]));
        return <li key={t} className={m[t] ? 'hecho' : t === sig ? 'sigue' : omit ? 'omitido' : ''} aria-current={t === sig ? 'step' : undefined}><span className="marca-p">{m[t] && <Check size={13} strokeWidth={3.5} aria-hidden="true" />}</span><span>{CORTO_TIPO[t]}</span><span className="oculto-visual">{m[t] ? ', hecha' : t === sig ? ', es la siguiente' : omit ? ', sin marcar' : ', pendiente'}</span>{(() => { const prog = !m[t] && !sinA && !omit && h && h[PROG[t]]; return <><span className={`hora-p${prog ? ' prog' : ''}`}>{m[t] || (sinA ? (t === 'sal_alm' ? 'no salió' : '') : omit ? 'sin marcar' : prog ? h[PROG[t]] : '')}</span><span className="hora-prog">{m[t] ? 'marcada' : prog ? 'programada' : ''}</span></>; })()}</li>; })}</ol>
      <div className="zona-marcar">
        {sig ? <>
          {centros.length > 1 && !m.entrada && <label className="fila chico" style={{ gap: 8 }}><MapPin size={16} aria-hidden="true" />Estoy en
            <select className="entrada" style={{ width: 'auto', minHeight: 36, maxWidth: 220 }} value={centroSel} onChange={(e) => setCentroSel(e.target.value)}>{centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>}
          {!ocupado && h && (sig === 'entrada' ? h.e : sig === 'salida' ? h.s : null) && (() => { const meta = sig === 'entrada' ? h.e : h.s, [hh, mm] = meta.split(':').map(Number), d = reloj.ahora(), dif = hh * 60 + mm - (d.getHours() * 60 + d.getMinutes());
            const nota = sig === 'entrada' ? (dif > 0 ? `faltan ${dif < 60 ? dif + ' min' : Math.floor(dif / 60) + ' h ' + (dif % 60) + ' min'}` : dif === 0 ? 'es ahora' : `vas ${-dif} min tarde`) : (dif > 0 ? `faltan ${dif < 60 ? dif + ' min' : Math.floor(dif / 60) + ' h ' + (dif % 60) + ' min'}` : 'ya es tu hora de salida');
            return <p className={`hora-debe${sig === 'entrada' && dif < 0 ? ' tarde' : ''}`}>{sig === 'entrada' ? 'Debes ingresar a las' : 'Tu salida es a las'} <strong>{meta}</strong> <span>{nota.charAt(0).toUpperCase() + nota.slice(1)}</span></p>; })()}
          {ocupado ? <div className="fila" role="status" aria-live="polite" style={{ minHeight: 68 }}><span className="giro" aria-hidden="true" /><span className="que">{textoFase}</span></div>
            : (() => { const [txt, I] = BOTON[sig]; return <button key={vuelta + sig} type="button" className={`boton-marcar ${sig}`} onClick={() => (sig === 'entrada' && hoy.ayerSinSalida ? setAyer({ hora: hoy.ayerSinSalida.horaSalidaHorario || (h && h.s) || '17:00', conEntrada: true }) : marcar(sig))}><I size={34} aria-hidden="true" /><span>{txt}</span></button>; })()}
        </> : <p className="que" role="status">Jornada de hoy completa. ¡Buen descanso!</p>}
        {deshacer && quedan > 0 && !ocupado && <Boton variante="texto" icono={Undo2} className="btn-deshacer" onClick={hacerDeshacer}>¿Te equivocaste? Deshacer «{BOTON[deshacer.tipo][0]}» ({Math.floor(quedan / 60)}:{String(quedan % 60).padStart(2, '0')})</Boton>}
        {!ocupado && puedeSinAlm && yaPasoAlm && <Boton variante="secundario" icono={UtensilsCrossed} className="btn-sin-alm" onClick={abrirSinAlm}>¿No saliste a almuerzo? Repórtalo</Boton>}
        {hoy.sinAlmuerzo && <p className="chico" role="status" style={{ marginTop: 10, textAlign: 'center' }}>Hoy sin almuerzo · autoriza {hoy.sinAlmuerzo.autorizaNombre} · {hoy.sinAlmuerzo.estado === 'aprobado' ? 'aprobado' : 'pendiente de aprobación'}</p>}
        {!ocupado && <div className="acciones-sec">
            {puedeSinAlm && !yaPasoAlm && <Boton variante="secundario" icono={UtensilsCrossed} onClick={abrirSinAlm}>No salí a almuerzo</Boton>}
            {sig === 'sal_alm' && <Boton variante="secundario" onClick={() => marcar('salida')}>Salir por hoy</Boton>}
            {sig === 'ent_alm' && <Boton variante="secundario" onClick={() => marcar('salida')}>No regreso: marcar salida</Boton>}
            <Boton variante="secundario" icono={History} onClick={() => setOlvido({ tipo: sig || 'salida', fecha: hoy.fecha })}>Se me olvidó marcar</Boton>
          </div>}
      </div>
    </section>

    {bloqueo && <Aviso tono="peligro"><strong>{bloqueo.que === 'camara' ? 'Falta la foto' : 'Falta la ubicación'}.</strong> {bloqueo.message}{bloqueo.bloqueado && ' Se avisó al administrador de este intento.'}</Aviso>}
    {hoy.viejo && <Aviso tono="aviso">No se pudo actualizar con el servidor. Puedes marcar: se guardará en tu celular.</Aviso>}
    {rech.map((m) => <Aviso key={m.id} tono="peligro"><strong>No se aceptó “{NOMBRE_TIPO[m.tipo]}” del {fechaCorta(m.hora)} a las {m.hora.slice(11)}.</strong> {m.rechazo} Si de verdad marcaste a esa hora, regístrala con «Se me olvidó marcar» o pide el ajuste al administrador.
      <div className="fila" style={{ marginTop: 8 }}><Boton chico onClick={() => reintentarRech(m)}>{m.codRechazo === 'QR_REQUERIDO' ? 'Escanear el QR y reintentar' : 'Reintentar'}</Boton><Boton chico variante="secundario" onClick={() => { setOlvido({ tipo: m.tipo, fecha: m.hora.slice(0, 10) }); }}>Registrarla con otra hora</Boton><Boton chico variante="texto" onClick={() => { bandeja.descartarRechazada(m.id); setRech(bandeja.rechazadas(usuario.cedula)); }}>Descartar</Boton></div></Aviso>)}
    {pend > 0 && <Aviso tono="aviso"><strong>{pend} marcación(es) por enviar.</strong> Están guardadas en este celular; se envían solas al volver la señal. <Boton chico variante="secundario" onClick={enviarPendientes}>Enviar ahora</Boton></Aviso>}
    {resumen.incompletos?.length > 0 && <Aviso tono="aviso"><strong>Te faltó marcar la salida</strong> el {resumen.incompletos.map(fechaCorta).join(', ')}. Mientras no la completes, ese día no suma horas. <Boton chico variante="secundario" onClick={() => setOlvido({ tipo: 'salida', fecha: resumen.incompletos[0] })}>Poner la hora en que salí</Boton></Aviso>}

    <Tarjeta titulo="Lo que llevas este periodo" accion={<span className="suave chico">{fechaCorta(resumen.periodo.desde)} – {fechaCorta(resumen.periodo.hasta)}</span>}>
      <div className="plata"><span className="suave chico">Tu pago va en (aproximado, ya con descuentos)</span><span className="plata-valor">{pesos(resumen.neto)}</span></div>
      <p className="frase-pago" aria-live="polite">Llevas <strong>{horasDec(resumen.horas.trabajadas)}</strong> trabajadas{resumen.horas.extras > 0 ? <> y <strong>{horasDec(resumen.horas.extras)}</strong> extra aprobadas</> : ''} esta {yo.cfg?.periodoNomina === 'mensual' ? 'nómina' : 'quincena'}.</p>
      {(() => { const d0 = new Date(resumen.periodo.desde + 'T12:00:00'), d1 = new Date(resumen.periodo.hasta + 'T12:00:00'), hoyD = new Date(hoy.fecha + 'T12:00:00');
        const total = Math.round((d1 - d0) / 864e5) + 1, va = Math.min(total, Math.max(0, Math.round((hoyD - d0) / 864e5) + 1));
        return <div className="avance" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={va} aria-label={`Día ${va} de ${total} del periodo`}>
          <div className="avance-barra"><span style={{ width: `${(va / total) * 100}%` }} /></div>
          <div className="fila entre chico suave"><span>Día {va} de {total}</span><span>{horasDec(resumen.horas.trabajadas)} trabajadas</span></div></div>; })()}
      <p className="suave chico" style={{ marginTop: 12 }}>Si completas el periodo sin novedades te pueden llegar cerca de <strong className="num" style={{ color: 'var(--c-texto)' }}>{pesos(resumen.proyeccion)}</strong>. Es un estimado; el valor oficial es el del desprendible.{!usuario.salarioOk && ' Tu salario aún no ha sido validado por el administrador.'}</p>
      <div className="fila" style={{ marginTop: 12 }}>
        {resumen.horas.extras > 0 && <Insignia tono="ok">{horasDec(resumen.horas.extras)} extra aprobadas</Insignia>}
        {resumen.horas.extrasSinAprobar > 0 && <Insignia tono="aviso">{horasDec(resumen.horas.extrasSinAprobar)} extra por aprobar</Insignia>}
        {resumen.tardanzas > 0 && <Insignia tono="aviso">{resumen.tardanzas} llegada(s) tarde</Insignia>}
        {resumen.ausencias > 0 && <Insignia tono="peligro">{resumen.ausencias} ausencia(s)</Insignia>}
        <Boton variante="texto" chico onClick={() => setDetalle(true)}>Ver cómo se calcula</Boton>
        <Boton variante="texto" chico icono={HelpCircle} onClick={() => setGuia(true)}>¿Dudas sobre tu pago? Pregunta aquí</Boton>
      </div>
    </Tarjeta>

    <MisJornadas resumen={resumen} />

    <Hoja abierta={guia} alCerrar={() => setGuia(false)} titulo="Dudas sobre la nómina" alto={0.92}>{guia && <Guia enviar />}</Hoja>
    <Hoja abierta={!!ayer} alCerrar={() => setAyer(null)} titulo={hoy.ayerSinSalida ? `Falta la salida del ${fechaCorta(hoy.ayerSinSalida.fecha)}` : 'Falta una salida'} alto={0.7}>{ayer && hoy.ayerSinSalida && <div className="pila">
      <p className="frase-pago">El {fechaCorta(hoy.ayerSinSalida.fecha)} marcaste tu llegada a las <strong>{hoy.ayerSinSalida.entrada}</strong> pero no marcaste la salida. ¿A qué hora saliste?</p>
      <Campo etiqueta="Hora en que salí" type="time" value={ayer.hora} onChange={(e) => setAyer({ ...ayer, hora: e.target.value })} />
      <p className="suave chico">Tu jefe lo revisa. Sin esa hora, ese día no suma horas.</p>
      <Boton ancho cargando={ocupado} disabled={!ayer.hora} onClick={async () => { const d = hoy.ayerSinSalida, nocturno = ayer.hora < d.entrada; const ok = await marcar('salida', { manual: true, fecha: d.fecha, hora: `${nocturno ? sumarDias(d.fecha, 1) : d.fecha}T${ayer.hora}`, motivo: 'Olvidé marcar la salida; la registré al llegar al día siguiente' }); if (ok) { const conE = ayer.conEntrada && !m.entrada; setAyer(null); await recargar(); if (conE) await marcar('entrada'); } }}>{ayer.conEntrada && !m.entrada ? 'Guardar y marcar mi llegada de hoy' : 'Guardar'}</Boton>
      <Boton variante="texto" onClick={() => { const conE = ayer.conEntrada && !m.entrada; setAyer(null); if (conE) marcar('entrada'); }}>{ayer.conEntrada && !m.entrada ? 'Ahora no, solo marcar mi llegada' : 'Ahora no'}</Boton>
    </div>}</Hoja>
    <Confirmacion c={conf} alCerrar={() => setConf(null)} alDeshacer={hacerDeshacer} />
    {camara && <Camara tipo={camara.tipo} alTerminar={(foto, motivo) => { camara.ok({ foto, motivo }); setCamara(null); }} />}
    <PedirQr abierta={!!qr} alTerminar={(c) => { qr?.ok(c); setQr(null); }} />
    <Olvido abierta={!!olvido} inicial={olvido || {}} cfg={cfg} hoy={hoy} alCerrar={() => setOlvido(false)} alEnviar={async (d) => { const ok = await marcar(d.tipo, { manual: true, fecha: d.fecha, hora: `${d.fechaHora}T${d.hora}`, motivo: d.motivo }); if (ok) { setOlvido(false); recargar(); } }} ocupado={ocupado} />
    <Hoja abierta={detalle} alCerrar={() => setDetalle(false)} titulo="Cómo se calcula tu estimado"><Liquidacion l={resumen} /><p className="suave chico">Valor de tu hora ordinaria: {pesos(resumen.valorHora)} (salario ÷ divisor mensual vigente). Las horas extra solo se pagan cuando el administrador las aprueba.</p></Hoja>
  </div>;
}

function Olvido({ abierta, inicial, cfg, hoy, alCerrar, alEnviar, ocupado }) {
  const [f, campo, setF] = useForm({ tipo: 'salida', fecha: hoy.fecha, hora: '', motivo: '', otroDia: false }), [err, setErr] = useState('');
  useEffect(() => { if (abierta) { setF({ tipo: inicial.tipo || 'salida', fecha: inicial.fecha || hoy.fecha, hora: '', motivo: '', otroDia: false }); setErr(''); } }, [abierta]); // eslint-disable-line
  const dias = Array.from({ length: (cfg.diasAtrasManual || 3) + 1 }, (_, i) => sumarDias(hoyISO(), -i));
  const enviar = () => { if (!f.hora) return setErr('Indica la hora.'); if (f.motivo.trim().length < 5) return setErr('Explica brevemente por qué no marcaste a tiempo.'); setErr('');
    alEnviar({ tipo: f.tipo, fecha: f.fecha, fechaHora: f.otroDia ? sumarDias(f.fecha, 1) : f.fecha, hora: f.hora, motivo: f.motivo.trim() }); };
  return <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Se me olvidó marcar">
    <p className="suave">Escribe la hora real. La marcación queda señalada como digitada y el administrador la revisa.</p>
    <Campo como="select" etiqueta="¿Qué te faltó marcar?" opciones={TIPOS.map((t) => ({ v: t, t: NOMBRE_TIPO[t] }))} {...campo('tipo')} />
    <div className="rejilla"><Campo como="select" etiqueta="Día de la jornada" opciones={dias.map((d) => ({ v: d, t: fechaLarga(d) }))} {...campo('fecha')} /><Campo etiqueta="Hora real" type="time" {...campo('hora')} /></div>
    {f.tipo !== 'entrada' && <label className="fila chico"><input type="checkbox" {...campo('otroDia', 'check')} style={{ width: 20, height: 20 }} />El turno terminó después de medianoche (día siguiente)</label>}
    <Campo como="textarea" etiqueta="Motivo" recordar="olvido" maxLength={200} placeholder="Ej.: se me descargó el celular" {...campo('motivo')} />
    {err && <Aviso tono="peligro">{err}</Aviso>}
    <div className="acciones-hoja"><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={ocupado} onClick={enviar}>Registrar hora</Boton></div>
  </Hoja>;
}

/* Código de la obra: escaneo del QR con la cámara (si el navegador lo permite) o el código escrito */
function PedirQr({ abierta, alTerminar }) {
  const [v, setV] = useState(''), [esc, setEsc] = useState(false), video = useRef(null), puede = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  useEffect(() => { if (!abierta) { setV(''); setEsc(false); } }, [abierta]);
  useEffect(() => {
    if (!esc) return; let flujo, vivo = true, t;
    (async () => { try {
      flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); video.current.srcObject = flujo; await video.current.play();
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      const mirar = async () => { if (!vivo) return; try { const r = await det.detect(video.current); if (r[0]?.rawValue) { alTerminar(r[0].rawValue); return; } } catch { /* sigue */ } t = setTimeout(mirar, 300); }; mirar();
    } catch { setEsc(false); } })();
    return () => { vivo = false; clearTimeout(t); flujo?.getTracks().forEach((x) => x.stop()); };
  }, [esc]); // eslint-disable-line
  return <Hoja abierta={abierta} alCerrar={() => alTerminar(null)} titulo="Código de la obra" alto={0.7}>
    <p className="suave">Esta obra pide el código QR de portería o el código del día que te da tu supervisor.</p>
    {esc ? <video ref={video} playsInline muted style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: 280, objectFit: 'cover' }} aria-label="Cámara para leer el QR" />
      : puede && <Boton variante="secundario" icono={ScanLine} onClick={() => setEsc(true)}>Escanear el QR</Boton>}
    <Campo etiqueta="O escribe el código" autoCapitalize="characters" autoComplete="off" maxLength={40} value={v} onChange={(e) => setV(e.target.value.toUpperCase())} />
    <div className="acciones-hoja"><Boton variante="secundario" onClick={() => alTerminar(null)}>Cancelar</Boton><Boton icono={QrCode} disabled={v.trim().length < 4} onClick={() => alTerminar(v.trim())}>Usar código</Boton></div>
  </Hoja>;
}

export function Liquidacion({ l }) {
  return <div>
    {l.conceptos.map((c, i) => <div className="concepto" key={i}><span>{c.concepto}</span><span className="cant num">{c.cantidad}</span><span className={`num ${c.valor < 0 ? 'neg' : ''}`}>{pesos(c.valor)}</span></div>)}
    <div className="total" style={{ borderTopWidth: 1, fontWeight: 600 }}><span>Total devengado</span><span className="num">{pesos(l.devengado)}</span></div>
    {l.deduccionesDet.map((c, i) => <div className="concepto" key={i}><span>{c.concepto}</span><span className="cant num">{c.cantidad}</span><span className="num neg">− {pesos(c.valor)}</span></div>)}
    <div className="total" style={{ marginTop: 8 }}><span>Neto</span><span className="num" style={{ fontSize: 'var(--t-5)' }}>{pesos(l.neto)}</span></div>
  </div>;
}

export function Desprendible({ n, alVolver, confirmable }) {
  const d = n.detalle, p = d.persona || {}, e = d.empresa || {}, [acuse, setAcuse] = useState(n.acuse || ''), [c, setC] = useState(false), avisos = useAvisos();
  const confirmar = async () => { setC(true); try { const r = await api('confirmarDesprendible', { id: n.id }); setAcuse(r.acuse); n.acuse = r.acuse; avisos.ok('Recibido confirmado.'); } catch (x) { avisos.error(x); } finally { setC(false); } };
  return <div className="pila">
    <div className="fila entre no-imprimir"><Boton variante="texto" icono={ArrowLeft} onClick={alVolver}>Volver</Boton><Boton variante="secundario" icono={Printer} onClick={() => window.print()}>Imprimir o guardar PDF</Boton></div>
    {acuse ? <Aviso tono="ok">Recibido{confirmable ? '' : ' por el trabajador'} el {fechaLarga(acuse)} a las {acuse.slice(11, 16)}.</Aviso>
      : confirmable ? <Aviso>Revisa los valores. Si están bien, confirma que recibiste el desprendible. <Boton chico icono={CheckCircle2} cargando={c} onClick={confirmar}>Confirmar recibido</Boton></Aviso> : <Aviso tono="aviso">El trabajador aún no confirma el recibido.</Aviso>}
    <Tarjeta>
      <div className="fila entre" style={{ alignItems: 'flex-start', marginBottom: 16 }}><div><h2>Desprendible de pago</h2><p className="suave">{e.nombre}{e.nit ? ` · NIT ${e.nit}` : ''}</p></div><div className="derecha"><strong>{fechaCorta(n.desde)} – {fechaCorta(n.hasta)}</strong><div className="suave chico">Generado {fechaCorta(n.generado)}</div></div></div>
      <div className="rejilla" style={{ marginBottom: 16 }}>
        <div><span className="suave chico">Trabajador</span><div><strong>{p.nombre}</strong></div><div className="chico">C.C. {p.cedula}{p.cargo ? ` · ${p.cargo}` : ''}</div></div>
        <div><span className="suave chico">Salario base</span><div className="num"><strong>{pesos(p.salario)}</strong> {p.tipoPago === 'dia' ? 'por día' : 'mensual'}</div><div className="chico">{p.centro}</div></div>
        <div><span className="suave chico">Jornada</span><div className="chico">{d.diasNomina} días liquidados · {horasDec(d.horas?.trabajadas)} trabajadas · {horasDec(d.horas?.extras)} extra</div><div className="chico">{d.ausencias} ausencia(s) · {d.tardanzas} tardanza(s)</div></div>
      </div>
      <Liquidacion l={d} />
    </Tarjeta>
  </div>;
}

function Pagos({ yo }) {
  const carga = useCarga(() => api('desprendibles'), []), [sel, setSel] = useState(null);
  if (sel) return <Desprendible n={sel} confirmable={tiene(yo, 'nomina')} alVolver={() => setSel(null)} />;
  return <div className="pila">
    <Tarjeta titulo="Periodo en curso (estimado)" accion={<span className="suave chico">{fechaCorta(yo.resumen.periodo.desde)} – {fechaCorta(yo.resumen.periodo.hasta)}</span>}><Liquidacion l={yo.resumen} /></Tarjeta>
    <Tarjeta titulo="Mis desprendibles"><Estado carga={carga} lineas={3}>{(l) => l.length === 0 ? <Vacio icono={FileText} titulo="Aún no hay desprendibles">Aparecen aquí cuando la empresa cierra cada periodo de nómina.</Vacio> :
      <ul className="lista tocable">{l.map((n) => <li key={n.id}><button onClick={() => setSel(n)}><FileText size={22} aria-hidden="true" /><span className="crece"><strong>{fechaCorta(n.desde)} – {fechaCorta(n.hasta)}</strong>{!n.acuse && tiene(yo, 'nomina') && <span className="suave chico" style={{ display: 'block' }}>Sin confirmar recibido</span>}</span><span className="num"><strong>{pesos(n.neto)}</strong></span></button></li>)}</ul>}</Estado></Tarjeta>
    <Tarjeta titulo="¿Dudas sobre tu pago? Pregunta aquí"><Guia enviar /></Tarjeta>
  </div>;
}

/* ---------- Mis jornadas en el periodo que la persona elija ---------- */
const PERIODOS_YO = [['periodo', 'Periodo de pago'], ['semana', 'Esta semana'], ['semanaPasada', 'Semana pasada'], ['mes', 'Este mes'], ['mesPasado', 'Mes pasado'], ['30', 'Últimos 30 días']];
function MisJornadas({ resumen }) {
  const [k, setK] = useState('periodo'), carga = useCarga(() => (k === 'periodo' ? Promise.resolve(resumen) : api('miResumen', rangoRapido(k))), [k, k === 'periodo' ? resumen : null]);
  return <Tarjeta titulo="Mis jornadas" accion={<select className="entrada" style={{ width: 'auto', minHeight: 36 }} aria-label="Periodo a consultar" value={k} onChange={(e) => setK(e.target.value)}>{PERIODOS_YO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
    <Estado carga={carga} lineas={4}>{(r) => <div className="pila">
      <div className="mini-resumen">{[['Trabajadas', horasDec(r.horas.trabajadas)], ['Extra', horasDec(r.horas.extras + r.horas.extrasSinAprobar)], ['Llegadas tarde', r.tardanzas], ['Ausencias', r.ausencias]].map(([t, v]) => <div key={t}><span className="suave chico">{t}</span><strong className="num">{v}</strong></div>)}</div>
      {k !== 'periodo' && <p className="suave chico">Neto estimado de esas fechas: <strong className="num" style={{ color: 'var(--c-texto)' }}>{pesos(r.neto)}</strong></p>}
      {r.dias.length === 0 ? <Vacio icono={CalendarDays} titulo="Sin jornadas en estas fechas">Cuando marques, tus días aparecerán aquí.</Vacio> :
        <ul className="lista">{[...r.dias].reverse().map((d) => <li key={d.fecha}><div className="crece"><strong>{fechaCorta(d.fecha)}</strong>
          <div className="suave chico num">{d.entrada || '—'} → {d.salida || (d.incompleto ? 'sin salida' : 'en curso')}{d.salAlm ? ` · almuerzo ${d.salAlm}${d.entAlm ? '–' + d.entAlm : ''}` : ''}</div></div>
          <div className="derecha"><span className="num">{d.incompleto ? '—' : horas(d.min)}</span><div className="fila fin" style={{ gap: 4 }}>{d.tarde > 0 && <Insignia tono="aviso">+{d.tarde} min</Insignia>}{d.extra > 0 && <Insignia tono="info">{horas(d.extra)} extra</Insignia>}{d.incompleto && <Insignia tono="peligro">incompleta</Insignia>}</div></div></li>)}</ul>}
    </div>}</Estado></Tarjeta>;
}

/* ---------- Permisos ---------- */
const CATS = { ley: 'Remunerados por ley', calamidad: 'Calamidad doméstica', vacaciones: 'Vacaciones', acuerdo: 'Por acuerdo con la empresa', voluntario: 'Voluntario (no remunerado)' };
export function enlaceWhatsApp(numero, texto) { const n = String(numero || '').replace(/\D/g, ''); return `https://wa.me/${n.length === 10 ? '57' + n : n}?text=${encodeURIComponent(texto)}`; }
export function textoPermiso(p, f) { return `Hola ${f.nombre.split(' ')[0]}, soy ${p.nombre} (C.C. ${p.cedula}). Solicito: ${p.tipoNombre}.\nSalida: ${p.fechaSalida} ${p.horaSalida || ''}\nRegreso: ${p.fechaRegreso} ${p.horaRegreso || ''}\nMotivo: ${p.motivo}\n\nPara firmar o rechazar entra aquí con tu clave de firma:\n${f.enlace}`; }

function Permisos({ yo }) {
  const carga = useCarga(() => api('permisosMios'), []), [nuevo, setNuevo] = useState(false), [cancelar, setCancelar] = useState(null), [c, setC] = useState(false), avisos = useAvisos(), v = yo.vacaciones;
  const hacerCancelar = async () => { setC(true); try { await api('permisoCancelar', { id: cancelar.id }); avisos.ok('Solicitud cancelada.'); setCancelar(null); carga.recargar(true); } catch (e) { avisos.error(e); } finally { setC(false); } };
  return <div className="pila">
    <Tarjeta className="hundida"><div className="fila entre"><div className="dato-grande"><span className="suave chico">Vacaciones disponibles</span><span className="valor">{Math.max(0, Math.round((v.causadas - v.tomadas) * 10) / 10).toLocaleString('es-CO')} días hábiles</span></div>
      <span className="suave chico derecha">{yo.usuario.ingreso ? <>Causadas {v.causadas.toLocaleString('es-CO')}<br />Disfrutadas {v.tomadas}</> : 'Falta tu fecha de ingreso'}</span></div></Tarjeta>
    <Boton icono={Plus} onClick={() => setNuevo(true)}>Solicitar permiso o vacaciones</Boton>
    <Estado carga={carga}>{(l) => l.length === 0 ? <Vacio icono={CalendarDays} titulo="No has pedido permisos">Aquí verás el estado de cada solicitud y quién falta por firmar.</Vacio> :
      <div className="pila">{l.map((p) => <Tarjeta key={p.id}>
        <div className="fila entre" style={{ alignItems: 'flex-start' }}><div><h3>{p.tipoNombre}</h3><p className="suave chico">{fechaCorta(p.fechaSalida)} {p.horaSalida} → {fechaCorta(p.fechaRegreso)} {p.horaRegreso}</p></div><Insignia tono={tonoPermiso[p.estado]}>{nombreEstado[p.estado]}</Insignia></div>
        <p style={{ margin: '8px 0' }}>{p.motivo}</p>{p.obs && <p className="suave chico">{p.obs}</p>}
        {p.firmas.length > 0 && <ul className="lista">{p.firmas.map((f) => <li key={f.id}><div className="crece"><strong>{f.nombre}</strong><div className="suave chico">{f.cargo}{f.obs ? ` · ${f.obs}` : ''}</div></div>
          {f.estado === 'pendiente' && p.estado === 'en_firmas' && f.enlace ? (f.whatsapp ? <a className="btn secundario chico" href={enlaceWhatsApp(f.whatsapp, textoPermiso(p, f))} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" />Enviar por WhatsApp</a> : <Insignia tono="aviso">pendiente (aviso por correo)</Insignia>)
            : <Insignia tono={f.estado === 'aprobado' ? 'ok' : f.estado === 'rechazado' ? 'peligro' : 'aviso'}>{f.estado}</Insignia>}</li>)}</ul>}
        {['en_firmas', 'firmado', 'vencido'].includes(p.estado) && <div className="fila fin" style={{ marginTop: 8 }}><Boton variante="texto" chico onClick={() => setCancelar(p)}>Cancelar solicitud</Boton></div>}
      </Tarjeta>)}</div>}</Estado>
    <NuevoPermiso abierta={nuevo} yo={yo} alCerrar={() => setNuevo(false)} alCrear={() => { setNuevo(false); carga.recargar(true); }} />
    <Confirmar abierta={!!cancelar} titulo="Cancelar la solicitud" texto="Sí, cancelar" variante="peligro" cargando={c} alCerrar={() => setCancelar(null)} alConfirmar={hacerCancelar}>Los jefes ya no podrán firmarla. Si la necesitas, tendrás que crear una nueva.</Confirmar>
  </div>;
}

// Permiso en 3 toques: para qué, cuándo, enviar. El formulario completo queda a un toque.
const MOTIVOS_RAPIDOS = [['cita_medica', 'Cita médica', 'Cita médica'], ['personal', 'Diligencia personal', 'Diligencia personal'], ['calamidad', 'Calamidad (algo grave en casa)', 'Calamidad doméstica'], ['escolar', 'Reunión del colegio', 'Reunión en el colegio de mi hijo o hija']];
const CUANDO = [['horas', 'Hoy, unas horas y vuelvo'], ['tarde', 'Hoy, salgo y no vuelvo'], ['hoy', 'Hoy, todo el día'], ['manana', 'Mañana, todo el día'], ['otra', 'Otra fecha u otra duración']];
function PermisoRapido({ yo, alCompleto, alEnviar, env }) {
  const [tipo, setTipo] = useState(null), [cuando, setCuando] = useState(null), [hs, setHs] = useState(''), [hr, setHr] = useState('');
  // día en que vuelve: el siguiente día con horario en su obra (si mañana es sábado sin turno, vuelve el lunes)
  const hor = (yo.centros.find((c) => c.id === yo.usuario.centroId) || yo.centros[0] || {}).horario || {};
  const vuelve = (f) => { let d = sumarDias(f, 1); for (let i = 0; i < 7; i++) { const dw = new Date(d + 'T12:00:00').getDay(); if (!Object.keys(hor).length || hor[dw]) return d; d = sumarDias(d, 1); } return sumarDias(f, 1); };
  const motivos = MOTIVOS_RAPIDOS.filter(([id]) => yo.permisosCat.some((p) => p.id === id)), h = hoyISO();
  useEffect(() => { const d = reloj.ahora(), mm = Math.ceil((d.getHours() * 60 + d.getMinutes()) / 30) * 30 + 30, f = (x) => `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; setHs(f(mm)); setHr(f(mm + 120)); }, []);
  const datos = () => { const m = MOTIVOS_RAPIDOS.find((x) => x[0] === tipo);
    const fechas = cuando === 'horas' ? { fechaSalida: h, fechaRegreso: h, horaSalida: hs, horaRegreso: hr } : cuando === 'tarde' ? { fechaSalida: h, horaSalida: hs, fechaRegreso: vuelve(h) } : cuando === 'hoy' ? { fechaSalida: h, fechaRegreso: vuelve(h) } : { fechaSalida: sumarDias(h, 1), fechaRegreso: vuelve(sumarDias(h, 1)) };
    return { tipo, motivo: m[2], horaSalida: '', horaRegreso: '', ...fechas }; };
  return <div className="pila permiso-rapido">
    <fieldset><legend className="etiqueta-grande">1. ¿Para qué es el permiso?</legend>
      <div className="opciones-grandes">{motivos.map(([id, t]) => <button key={id} type="button" aria-pressed={tipo === id} onClick={() => setTipo(id)}>{t}</button>)}
        <button type="button" onClick={() => alCompleto({})}>Otro motivo</button></div></fieldset>
    {tipo && <fieldset><legend className="etiqueta-grande">2. ¿Cuándo?</legend>
      <div className="opciones-grandes">{CUANDO.map(([k, t]) => <button key={k} type="button" aria-pressed={cuando === k} onClick={() => (k === 'otra' ? alCompleto({ tipo, motivo: MOTIVOS_RAPIDOS.find((x) => x[0] === tipo)[2] }) : setCuando(k))}>{t}</button>)}</div>
      {cuando === 'tarde' && <><Campo etiqueta="Salgo a las" type="time" value={hs} onChange={(e) => setHs(e.target.value)} /><p className="suave chico">Vuelves al trabajo el {fechaCorta(vuelve(h))}. Cuando salgas, toca «Salir a mi permiso»: queda marcada tu salida del día.</p></>}
      {cuando === 'horas' && <div className="rejilla"><Campo etiqueta="Salgo a las" type="time" value={hs} onChange={(e) => setHs(e.target.value)} /><Campo etiqueta="Vuelvo a las" type="time" value={hr} onChange={(e) => setHr(e.target.value)} /></div>}</fieldset>}
    {tipo && cuando && <Boton ancho cargando={env} disabled={(cuando === 'horas' && (!hs || !hr || hr <= hs)) || (cuando === 'tarde' && !hs)} onClick={() => alEnviar(datos())}>3. Enviar solicitud</Boton>}
    <Boton variante="texto" onClick={() => alCompleto({})}>Llenar el formulario completo (con soporte)</Boton>
  </div>;
}
function NuevoPermiso({ abierta, yo, alCerrar, alCrear }) {
  const [rapido, setRapido] = useState(true);
  const [f, campo, setF] = useForm({ tipo: '', fechaSalida: hoyISO(), horaSalida: '', fechaRegreso: hoyISO(), horaRegreso: '', motivo: '' }), [soporte, setSoporte] = useState(''), [env, setEnv] = useState(false), [err, setErr] = useState(''), avisos = useAvisos();
  useEffect(() => { if (abierta) { setRapido(true); setF({ tipo: '', fechaSalida: hoyISO(), horaSalida: '', fechaRegreso: hoyISO(), horaRegreso: '', motivo: '' }); setSoporte(''); setErr(''); } }, [abierta]); // eslint-disable-line
  const cat = yo.permisosCat.find((p) => p.id === f.tipo), mismo = f.fechaSalida === f.fechaRegreso;
  const enviar = async (dir) => {
    if (dir && dir.tipo) { setEnv(true); setErr(''); try { const p = await api('permisoCrear', { ...dir, soporte: '' }); avisos.ok(p.firmas.length ? 'Solicitud enviada. Avísale a tu jefe por WhatsApp desde «Permisos» para que la firme.' : 'Solicitud enviada. Te avisamos cuando la respondan.', 8000); alCrear(); } catch (e) { setErr(e.message); } finally { setEnv(false); } return; }
    if (!cat) return setErr('Elige el tipo de permiso.'); if (f.fechaRegreso < f.fechaSalida) return setErr('El regreso no puede ser antes de la salida.');
    if (mismo && (!f.horaSalida || !f.horaRegreso)) return setErr('Para un permiso dentro del mismo día indica la hora de salida y la de regreso.'); if (f.motivo.trim().length < 5) return setErr('Escribe el motivo.');
    setEnv(true); setErr('');
    try { const p = await api('permisoCrear', { ...f, soporte }); avisos.ok(p.firmas.length ? 'Solicitud creada. Envíala a tus jefes por WhatsApp para que la firmen.' : 'Solicitud creada. Queda a la espera del administrador.', 8000); alCrear(); }
    catch (e) { setErr(e.message); } finally { setEnv(false); }
  };
  if (rapido) return <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Pedir permiso"><PermisoRapido yo={yo} env={env} alEnviar={enviar} alCompleto={(x) => { setF((y) => ({ ...y, ...x })); setRapido(false); }} />{err && <Aviso tono="peligro">{err}</Aviso>}</Hoja>;
  return <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Solicitar permiso">
    <Campo como="select" etiqueta="Tipo de permiso" {...campo('tipo')}><option value="">Elige…</option>{Object.keys(CATS).map((k) => <optgroup key={k} label={CATS[k]}>{yo.permisosCat.filter((p) => p.cat === k).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</optgroup>)}</Campo>
    {cat && <Aviso tono={cat.rem ? 'ok' : 'aviso'}><strong>{cat.rem ? 'Remunerado' : 'No remunerado'}.</strong> Fundamento: {cat.norma}.{cat.cat === 'calamidad' && ' Puedes pedirlo aunque ya haya ocurrido; adjunta el soporte cuando lo tengas.'}</Aviso>}
    <div className="rejilla"><Campo etiqueta="Fecha de salida" type="date" {...campo('fechaSalida')} /><Campo etiqueta="Hora de salida" type="time" {...campo('horaSalida')} /></div>
    <div className="rejilla"><Campo etiqueta="Fecha de regreso" type="date" min={f.fechaSalida} ayuda="Día en que vuelves al trabajo." {...campo('fechaRegreso')} /><Campo etiqueta="Hora de regreso" type="time" {...campo('horaRegreso')} /></div>
    <Campo como="textarea" etiqueta="Motivo" recordar="permiso" maxLength={500} {...campo('motivo')} />
    <div className="campo"><label htmlFor="sop">Soporte (opcional)</label><input id="sop" className="entrada" style={{ paddingTop: 10 }} type="file" accept="image/*" onChange={async (e) => { const a = e.target.files[0]; if (!a) return setSoporte(''); try { setSoporte(await comprimirArchivo(a)); } catch (x) { avisos.error(x); } }} /><span className="ayuda">Foto de la cita, citación o constancia. Se comprime antes de enviarse.</span></div>
    {err && <Aviso tono="peligro">{err}</Aviso>}
    <p className="suave chico">Debe ser firmado por todos tus jefes. Tienen {yo.cfg.horasLimitePermiso} horas para responder.</p>
    <div className="acciones-hoja"><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={env} onClick={() => enviar()}>Crear solicitud</Boton></div>
  </Hoja>;
}

/* ---------- Perfil ---------- */
let instalador = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); instalador = e; });
function Perfil({ yo, recargar, alSalir }) {
  const u = yo.usuario, avisos = useAvisos(), [f, campo] = useForm({ email: u.email, telefono: u.telefono, salario: u.salario }), [cl, cCampo, setCl] = useForm({ actual: '', nueva: '' });
  const [g, setG] = useState(false), [gc, setGc] = useState(false), [notif, setNotif] = useState(notificacionesActivas()), [salir, setSalir] = useState(false);
  const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone, ios = /iphone|ipad/i.test(navigator.userAgent);
  const guardar = async () => { setG(true); try { await api('misDatos', { email: f.email, telefono: f.telefono, ...(u.salarioOk ? {} : { salario: +String(f.salario).replace(/\D/g, '') }) }); avisos.ok('Datos guardados.'); recargar(); } catch (e) { avisos.error(e); } finally { setG(false); } };
  const clave = async () => { setGc(true); try { await api('cambiarClave', cl); avisos.ok('Contraseña cambiada.'); setCl({ actual: '', nueva: '' }); } catch (e) { avisos.error(e); } finally { setGc(false); } };
  const centro = yo.centros.find((c) => c.id === u.centroId);
  return <div className="pila">
    <Tarjeta><h2>{u.nombre}</h2><p className="suave">C.C. {u.cedula}{u.cargo ? ` · ${u.cargo}` : ''}</p><p className="suave chico">{centro ? centro.nombre : 'Sin centro de trabajo asignado'}{u.ingreso ? ` · ingreso ${fechaCorta(u.ingreso)}` : ''}</p></Tarjeta>
    <Tarjeta titulo="Mis datos"><div className="pila">
      <Campo etiqueta="Correo" type="email" autoComplete="email" {...campo('email')} /><Campo etiqueta="Celular" type="tel" inputMode="numeric" autoComplete="tel" {...campo('telefono')} />
      <Campo etiqueta="Salario mensual" inputMode="numeric" disabled={u.salarioOk} ayuda={u.salarioOk ? 'Validado por el administrador. Para cambiarlo, habla con él.' : 'Pendiente de validación por el administrador.'} {...campo('salario')} />
      <Boton cargando={g} onClick={guardar}>Guardar datos</Boton></div></Tarjeta>
    <Tarjeta titulo="Entrar rápido (PIN o huella)"><ConfigRapido u={u} /></Tarjeta>
    <Tarjeta titulo="Accesibilidad"><PanelAccesibilidad /></Tarjeta>
    <Tarjeta titulo="Recordatorios e instalación"><div className="pila">
      <p className="suave chico">Te avisa {yo.cfg.recordatorioMin} minutos antes de iniciar la jornada y {yo.cfg.recordatorioMin} minutos después de la hora de salida; lo mismo con el almuerzo. Con la aplicación cerrada, el aviso llega por correo si la empresa lo tiene activo.</p>
      {notif ? <Aviso tono="ok">Los recordatorios están activos en este celular.</Aviso> : <Boton variante="secundario" icono={Bell} onClick={async () => { const r = await pedirNotificaciones(); setNotif(r === 'granted'); if (r === 'granted') { programarRecordatorios(yo.hoy, yo.cfg.recordatorioMin); avisos.ok('Recordatorios activados.'); } else avisos.error(r === 'denied' ? 'Las notificaciones están bloqueadas en los ajustes del navegador.' : 'Este navegador no permite notificaciones.'); }}>Activar recordatorios</Boton>}
      {instalada ? <Aviso tono="ok">La aplicación está instalada en este dispositivo.</Aviso> : instalador ? <Boton variante="secundario" icono={Download} onClick={async () => { instalador.prompt(); await instalador.userChoice; instalador = null; }}>Instalar en este celular</Boton>
        : <p className="suave chico">{ios ? 'Para instalarla en iPhone: botón Compartir de Safari → «Agregar a inicio».' : 'Para instalarla: menú del navegador (⋮) → «Instalar aplicación» o «Agregar a pantalla principal».'}</p>}
    </div></Tarjeta>
    <Tarjeta titulo="Cambiar contraseña"><div className="pila"><Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password" {...cCampo('actual')} /><Campo etiqueta="Contraseña nueva" type="password" autoComplete="new-password" ayuda="Mínimo 6 caracteres." {...cCampo('nueva')} /><Boton variante="secundario" icono={KeyRound} cargando={gc} disabled={!cl.actual || cl.nueva.length < 6} onClick={clave}>Cambiar contraseña</Boton></div></Tarjeta>
    <Boton variante="secundario" icono={LogOut} onClick={() => setSalir(true)}>Cerrar sesión</Boton>
    <PieLegal />
    <Confirmar abierta={salir} titulo="Cerrar sesión" texto="Cerrar sesión" alCerrar={() => setSalir(false)} alConfirmar={alSalir}>Tendrás que ingresar de nuevo con tu cédula y contraseña.{bandeja.mias(u.cedula).length > 0 && <strong> Tienes marcaciones sin enviar: quedan guardadas en este celular y se enviarán cuando vuelvas a ingresar con tu cuenta (nunca a nombre de otra persona). Mejor espera a tener señal antes de salir.</strong>}</Confirmar>
  </div>;
}

/* Recordatorios calculados con el horario de la obra y lo marcado hoy */
const aM = (t) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null);
const hm = (m) => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`; };
const ORDEN_TONO = { peligro: 0, aviso: 1, info: 2, neutro: 3 };
function Recordatorios({ hoy, sig, reloj, alOlvido }) {
  const [, tic] = useState(0);
  useEffect(() => { const i = setInterval(() => tic((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  const ahora = reloj.ahora(), h = hoy.horario || {}, m = hoy.marcas || {}, lista = [];
  // Turnos que cruzan la medianoche: todo se mide en minutos desde el inicio del día de la jornada (después de medianoche, +1440)
  let n = ahora.getHours() * 60 + ahora.getMinutes(); if (hoy.fecha && hoy.fecha < hoyISO()) n += 1440;
  const base = aM(m.entrada || h.e), rel = (t) => { const x = aM(t); return x == null ? null : base != null && x < base - 60 ? x + 1440 : x; };
  if (hoy.ayerSinSalida) lista.push({ tono: 'peligro', t: `El ${fechaCorta(hoy.ayerSinSalida.fecha)} marcaste entrada a las ${hoy.ayerSinSalida.entrada} pero no la salida. Sin salida ese día no cuenta horas.`, accion: ['Registrar mi salida de ese día', () => alOlvido({ tipo: 'salida', fecha: hoy.ayerSinSalida.fecha })] });
  let trab = 0;
  if (m.entrada) { trab = (rel(m.sal_alm) ?? (m.salida ? rel(m.salida) : n)) - rel(m.entrada); if (m.ent_alm) trab += (rel(m.salida) ?? n) - rel(m.ent_alm); }
  if (sig === 'sal_alm' && h.ai) { const f = rel(h.ai) - n; if (f > 0 && f <= 30) lista.push({ tono: 'info', t: `Te quedan ${hm(f)} para el almuerzo (${h.ai}).` }); else if (f <= 0 && -f <= 90) lista.push({ tono: 'aviso', t: `Ya es la hora de almuerzo (${h.ai}). Marca tu salida a almuerzo, o repórtalo si no vas a salir.` }); }
  if (sig === 'ent_alm' && h.af) { const f = rel(h.af) - n; if (f > 0 && f <= 15) lista.push({ tono: 'info', t: `Tu almuerzo termina en ${hm(f)} (${h.af}).` }); else if (f <= 0) lista.push({ tono: 'aviso', t: `Tu almuerzo terminó hace ${hm(-f)}. Marca el regreso.` }); }
  if (sig === 'salida' && h.s) { const f = rel(h.s) - n; if (f > 0 && f <= 30) lista.push({ tono: 'info', t: `Te quedan ${hm(f)} para terminar la jornada (${h.s}).` }); else if (f < -15) lista.push({ tono: 'aviso', t: `Tu hora de salida era a las ${h.s}. Si sigues trabajando, son horas extra que tu jefe debe aprobar; si ya saliste, marca la salida.` }); }
  const max = (hoy.fatigaHorasMax || 10) * 60;
  if (trab >= max - 60 && sig) lista.push({ tono: 'peligro', t: `Llevas ${hm(trab)} trabajadas hoy. El máximo de la empresa es ${hoy.fatigaHorasMax || 10} h: descansa y avisa a tu supervisor.` });
  else if (m.entrada && sig) lista.push({ tono: 'neutro', t: `Llevas ${hm(trab)} trabajadas hoy${m.sal_alm && !m.ent_alm ? ' (estás en almuerzo)' : ''}.` });
  if (!lista.length) return null;
  const item = (x, i) => <div key={i} className={`recordatorio ${x.tono}`}><span className="crece">{x.t}</span>{x.accion && <Boton chico onClick={x.accion[1]}>{x.accion[0]}</Boton>}</div>;
  const [primero, ...resto] = lista.sort((a, b) => ORDEN_TONO[a.tono] - ORDEN_TONO[b.tono]);
  return <section className="recordatorios" aria-label="Recordatorios" aria-live="polite">{item(primero, 0)}
    {resto.length > 0 && <details className="mas-avisos"><summary>{resto.length === 1 ? 'Ver 1 aviso más' : `Ver ${resto.length} avisos más`}</summary>{resto.map((x, i) => item(x, i + 1))}</details>}</section>;
}

export default function Trabajador({ yo, actualizar, recargar, alSalir }) {
  const [tab, setTab] = useState('inicio'), com = useCarga(() => (tiene(yo, 'autoservicio') ? api('comunicadosMios') : Promise.resolve([])), []);
  const sinLeer = (com.datos || []).filter((c) => !c.leidoEl).length;
  const tabs = [['inicio', 'Jornada', Clock], ['permisos', 'Permisos', CalendarDays], ['pagos', 'Pagos', Wallet], ['mas', 'Más', LayoutGrid, sinLeer], ['perfil', 'Perfil', UserRound]];
  return <>
    <main className="contenido" id="contenido" tabIndex={-1}>
      <h1 className="oculto-visual">{tabs.find((t) => t[0] === tab)[1]}</h1>
      {tab === 'inicio' && <Inicio yo={yo} actualizar={actualizar} recargar={recargar} />}
      {tab === 'permisos' && <Permisos yo={yo} />}
      {tab === 'pagos' && <Pagos yo={yo} />}
      {tab === 'perfil' && <Perfil yo={yo} recargar={recargar} alSalir={alSalir} />}
      {tab === 'mas' && <Mas yo={yo} pendientesComunicados={sinLeer} alCambiar={() => com.recargar(true)} alSalir={alSalir} />}
    </main>
    <nav className="nav-inferior no-imprimir" aria-label="Secciones"><ul>{tabs.map(([k, t, I, n]) => <li key={k}><button aria-current={tab === k ? 'page' : undefined} onClick={() => { setTab(k); window.scrollTo(0, 0); }}><I size={22} aria-hidden="true" />{t}{n > 0 && <span className="punto" aria-label={`${n} sin leer`}>{n}</span>}</button></li>)}</ul></nav>
  </>;
}
