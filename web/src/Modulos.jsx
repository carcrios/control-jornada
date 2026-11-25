import { hablar } from './a11y.jsx';
import { BotonAccesibilidad } from './App.jsx';
// Pantallas de los módulos avanzados del panel (v1.7): en vivo, kiosco, préstamos, compensatorios, comunicados,
// provisiones, liquidación, presupuesto, expediente 360°, QR de obra y licencia.
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, ArrowLeft, Calculator, CheckCircle2, Download, KeyRound, Landmark, Megaphone, Plus, QrCode, RefreshCw, Tablet, X, Clock } from 'lucide-react';
import { api, bandeja, guardado, idDeTexto, sesion } from './api.js';
import { Aviso, Boton, Campo, Casilla, Confirmar, Estado, Hoja, Insignia, Pestanas, Tabla, Tarjeta, Vacio, useAvisos, useCarga, useForm } from './ui.jsx';
import { NOMBRE_TIPO, TIPOS, comprimirArchivo, fechaCorta, fechaHora, horas, horasDec, hoyISO, idNuevo, pesos, sumarDias, ubicar, fechaDoc, saludo } from './util.js';
import { Rango, Titulo, aExcel, periodoActual, useAccion } from './Admin.jsx';
import { Camara } from './Trabajador.jsx';
import { Certificado } from './Autoservicio.jsx';

export const moduloActivo = (yo, m) => !m || !yo?.licencia || (yo.licencia.modulos || []).includes(m);
const EST = { en_obra: ['En obra', 'ok'], almuerzo: ['Almuerzo', 'info'], salio: ['Salió', ''], ausente: ['Sin marcar', 'peligro'], cubierto: ['Permiso o incapacidad', 'info'] };

/* ---------- Licencia vencida o por vencer: aviso arriba del panel ---------- */
export function BandaLicencia({ yo, ir }) {
  const l = yo.licencia; if (!l || !l.vence) return null;
  const dias = Math.round((new Date(l.vence + 'T12:00') - new Date(hoyISO() + 'T12:00')) / 86400000);
  if (!l.vencida && !l.enGracia && dias > 7) return null;
  return <div className={`banda ${l.vencida ? 'peligro' : ''} no-imprimir`} role="status">{l.vencida ? 'La suscripción venció: el panel quedó en modo consulta. El personal sigue marcando con normalidad.' : l.enGracia ? `La suscripción venció el ${fechaCorta(l.vence)}. Quedan ${15 + dias} día(s) de gracia para renovar.` : `La suscripción vence en ${dias} día(s), el ${fechaCorta(l.vence)}.`}
    {yo.usuario.rol === 'admin' && <> <Boton chico variante="secundario" onClick={() => ir('config', 'licencia')}>Ingresar llave</Boton></>}</div>;
}

/* ---------- En vivo: quién está en obra ahora ---------- */
export function EnVivo({ cfg }) {
  const carga = useCarga(() => Promise.all([api('adminEnVivo'), api('adminTablero360').catch(() => null)]).then(([v, t]) => ({ ...v, t })), []), [centro, setCentro] = useState('');
  useEffect(() => { const i = setInterval(() => { if (document.visibilityState === 'visible') carga.recargar(true); }, 60000); return () => clearInterval(i); }, []); // eslint-disable-line
  return <><Titulo t="En vivo" accion={<Boton variante="secundario" icono={RefreshCw} cargando={carga.cargando} onClick={() => carga.recargar()}>Actualizar</Boton>}>Quién está en obra ahora mismo. Se actualiza cada minuto.</Titulo>
    <Estado carga={carga} lineas={8}>{(d) => { const centros = [...new Set(d.personas.map((p) => p.centro).filter(Boolean))]; return <div className="pila amplia">
      <div className="indicadores">{Object.keys(EST).map((k) => <div key={k} className={`indicador n-${EST[k][1] || ''}`}><span className="valor">{d.resumen[k] || 0}</span><span className="rotulo">{EST[k][0]}</span></div>)}</div>
      {d.t && (d.t.alertasOperativas.contratosPorVencer.length > 0 || d.t.alertasOperativas.obrasPresupuestoAlerta.length > 0) && <Tarjeta titulo="Para atender">
        <ul className="lista">{d.t.alertasOperativas.contratosPorVencer.map((c) => <li key={c.cedula}><AlertTriangle size={18} aria-hidden="true" /><span className="crece">Contrato de <strong>{c.nombre}</strong> vence el {fechaCorta(c.finContrato)}. Recuerda el preaviso de 30 días.</span></li>)}
          {d.t.alertasOperativas.obrasPresupuestoAlerta.map((o) => <li key={o.centroId}><AlertTriangle size={18} aria-hidden="true" /><span className="crece"><strong>{o.centro}</strong> va en {o.pctHoras ?? '—'} % de las horas y {o.pctCosto ?? '—'} % del costo presupuestado este mes.</span><Insignia tono={o.alerta === 'excedido' ? 'peligro' : 'aviso'}>{o.alerta}</Insignia></li>)}</ul></Tarjeta>}
      {centros.length > 1 && <div className="fila" role="group" aria-label="Filtrar por centro">{['', ...centros].map((c) => <button key={c} className="chip" aria-pressed={centro === c} onClick={() => setCentro(c)}>{c || 'Todos'}</button>)}</div>}
      <Tabla columnas={[{ k: 'nombre', t: 'Persona', render: (p) => <><strong>{p.nombre}</strong><div className="suave chico">{p.cargo}</div></> }, { k: 'centro', t: 'Centro' },
        { k: 'estado', t: 'Estado', render: (p) => <Insignia tono={EST[p.estado][1]}>{EST[p.estado][0]}</Insignia>, texto: (p) => EST[p.estado][0] }, { k: 'entrada', t: 'Entrada', num: true }, { k: 'salida', t: 'Salida', num: true },
        { k: 'horasTranscurridas', t: 'Horas hoy', num: true, render: (p) => (p.horasTranscurridas ? horasDec(p.horasTranscurridas) : '') }]} filas={d.personas.filter((p) => !centro || p.centro === centro)} clave={(p) => p.cedula} />
    </div>; }}</Estado></>;
}

/* ---------- Modo kiosco: tablet compartida en portería ----------
   La tablet recibe una sesión propia que solo sirve para marcar en un centro. Para salir hay que volver a
   ingresar con la cuenta de un supervisor: el personal nunca queda frente al panel. */
export function ActivarKiosco({ centros, alListo }) {
  const [centroId, setCentroId] = useState(centros[0]?.id || ''), [ocupado, setOcupado] = useState(false), avisos = useAvisos();
  const pendientes = bandeja.mias().length, ajenas = bandeja.ajenas().length;
  const activar = async () => {
    if (bandeja.mias().length) { avisos.error('Tienes marcaciones tuyas sin enviar en este equipo. Espera a que se envíen (con señal) antes de activar el kiosco.'); return; }
    setOcupado(true);
    try {
      const r = await api('kioscoIniciar', { centroId });
      try { await api('salir'); } catch { /* la sesión del supervisor se cierra igual en este equipo */ }
      sesion.cerrar(false); sesion.token = r.token; guardado.poner('cj.kiosco', true); alListo ? alListo() : location.reload();
    } catch (e) { avisos.error(e); setOcupado(false); }
  };
  return <><Titulo t="Modo kiosco" d="Convierte una tablet de portería en marcador compartido." />
    <Tarjeta><div className="pila">
      <p>El personal marca escribiendo su cédula y su contraseña; la tablet toma la foto y la ubicación. Sirve para quien no tiene celular o en obras donde no se permite usarlo.</p>
      <Aviso tono="info">Al activarlo se cierra tu sesión en este equipo. La tablet solo podrá marcar en el centro que elijas. Para salir del kiosco tendrás que ingresar otra vez con tu cédula y contraseña.</Aviso>
      <Campo como="select" etiqueta="Centro donde queda la tablet" value={centroId} onChange={(e) => setCentroId(e.target.value)} opciones={centros.map((c) => ({ v: c.id, t: c.nombre }))} />
      {ajenas > 0 && <Aviso tono="info">Este equipo guarda {ajenas} marcación(es) de otras personas sin enviar. Se conservan: cada una se envía cuando su dueño ingrese con su cuenta.</Aviso>}
      {pendientes > 0 && <Aviso tono="aviso">Hay {pendientes} marcación(es) tuyas sin enviar en este equipo. Se activará cuando se envíen.</Aviso>}
      <div className="fila fin"><Boton cargando={ocupado} disabled={!centroId} onClick={activar}>Activar el kiosco en esta tablet</Boton></div>
    </div></Tarjeta></>;
}

function RelojKiosco() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return <div className="kiosco-reloj" role="timer" aria-label="Hora actual"><strong>{t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong><span>{saludo(t)} · {t.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>;
}
export function Kiosco({ kiosco, empresa = {}, alSalir }) {
  const [f, setF] = useState({ cedula: '', clave: '' }), [tipo, setTipo] = useState(null), [fase, setFase] = useState(''), [res, setRes] = useState(null), [cam, setCam] = useState(null), [salida, setSalida] = useState(false), reloj = useRef(null), quieto = useRef(null);
  const [sup, setSup] = useState({ cedula: '', clave: '' }), [errSal, setErrSal] = useState(''), [apagando, setApagando] = useState(false);
  const apagar = async () => { setApagando(true); setErrSal(''); try { await api('kioscoSalir', sup); guardado.poner('cj.kiosco', null); alSalir(); } catch (e) { setErrSal(e.message); setSup((x) => ({ ...x, clave: '' })); } finally { setApagando(false); } };
  const limpiar = (todo = true) => { setF((x) => ({ cedula: todo ? '' : x.cedula, clave: '' })); setTipo(null); setFase(''); };
  useEffect(() => () => { clearTimeout(reloj.current); clearTimeout(quieto.current); }, []);
  // Si alguien escribe y se va sin marcar, los datos se borran a los 30 segundos.
  useEffect(() => { clearTimeout(quieto.current); if ((f.cedula || f.clave) && !fase) quieto.current = setTimeout(() => limpiar(true), 30000); }, [f, fase]);
  const marcar = async (t) => {
    setTipo(t); setRes(null); let todo = true;
    try {
      setFase('Ubicando la tablet…'); const pos = await ubicar();
      setFase('Foto de verificación…'); const foto = await new Promise((ok) => setCam({ ok })); if (!foto) { limpiar(); return; }
      setFase('Registrando…'); const r = await api('kioscoMarcar', { ...f, tipo: t, ...pos, foto, id: idNuevo() });
      hablar(r.resultado.repetida ? `${r.usuario}, esa marcación ya estaba registrada.` : `${r.usuario}, ${NOMBRE_TIPO[t]} registrada a las ${r.resultado.hora.slice(11)}.`, true); // el kiosco siempre confirma en voz alta
      setRes({ ok: true, texto: r.resultado.repetida ? `${r.usuario}: esta marcación ya estaba registrada.` : `${r.usuario}: ${NOMBRE_TIPO[t]} registrada a las ${r.resultado.hora.slice(11)}.` });
    } catch (e) {
      if (e.cod === 'RED' || e.cod === 'OCUPADO' || !navigator.onLine) { todo = false; setRes({ ok: false, texto: 'NO quedó registrada: no hay conexión. Intenta de nuevo en un momento (tu cédula quedó escrita). Si no vuelve la señal, marca después con «Se me olvidó marcar» en tu celular o avisa a tu supervisor.' }); }
      else setRes({ ok: false, texto: e.message });
      hablar('No quedó registrada. ' + (e.cod === 'RED' || e.cod === 'OCUPADO' ? 'No hay conexión.' : e.message), true);
    }
    limpiar(todo); clearTimeout(reloj.current); reloj.current = setTimeout(() => setRes(null), 8000);
  };
  return <div className="kiosco">
    <header className="kiosco-cab">
      <div className="kiosco-marca">{empresa.logo ? <img src={empresa.logo} alt="" /> : <Clock size={32} aria-hidden="true" />}<div><strong>{empresa.nombre || 'Control de jornada'}</strong><span>{kiosco.centro}</span></div></div>
      <div className="fila" style={{ gap: 12 }}><RelojKiosco /><BotonAccesibilidad claro /></div>
    </header>
    <div className="fila entre"><div><h1 style={{ color: 'inherit' }}>Marcar jornada</h1><p style={{ opacity: .85 }}>Escribe tu cédula y tu contraseña y elige qué vas a marcar.</p></div>
      <Boton variante="texto" chico onClick={() => setSalida(true)}>Salir del kiosco</Boton></div>
    {res && <div role="alert" className={`kiosco-resultado ${res.ok ? 'ok' : 'mal'}`}>{res.ok ? <CheckCircle2 size={36} aria-hidden="true" /> : <AlertTriangle size={36} aria-hidden="true" />}<span>{res.texto}</span></div>}
    <div className="kiosco-campos">
      <Campo etiqueta="Cédula" inputMode="numeric" autoComplete="off" value={f.cedula} onChange={(e) => setF({ ...f, cedula: e.target.value.replace(/\D/g, '') })} />
      <Campo etiqueta="Contraseña" type="password" autoComplete="off" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} />
    </div>
    {fase ? <p className="que" role="status" style={{ textAlign: 'center', fontSize: 'var(--t-5)' }}><span className="giro" aria-hidden="true" /> {fase}</p>
      : <div className="kiosco-botones">{TIPOS.map((t) => <button key={t} type="button" disabled={f.cedula.length < 5 || f.clave.length < 4} onClick={() => marcar(t)}>{NOMBRE_TIPO[t]}</button>)}</div>}
    {cam && <Camara tipo={tipo} alTerminar={(foto) => { cam.ok(foto); setCam(null); }} />}
    <Hoja abierta={salida} alCerrar={() => { setSalida(false); setSup({ cedula: '', clave: '' }); setErrSal(''); }} titulo="Apagar el kiosco" alto={0.7}><div className="pila">
      <p className="suave">Solo un supervisor de este centro o un administrador puede apagarlo.</p>
      <Campo etiqueta="Cédula del supervisor" inputMode="numeric" autoComplete="off" value={sup.cedula} onChange={(e) => setSup({ ...sup, cedula: e.target.value.replace(/\D/g, '') })} />
      <Campo etiqueta="Contraseña" type="password" autoComplete="off" value={sup.clave} onChange={(e) => setSup({ ...sup, clave: e.target.value })} />
      {errSal && <Aviso tono="peligro">{errSal}</Aviso>}
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setSalida(false)}>Cancelar</Boton><Boton cargando={apagando} disabled={sup.cedula.length < 5 || sup.clave.length < 4} onClick={apagar}>Apagar el kiosco</Boton></div></div></Hoja>
  </div>;
}

/* ---------- Préstamos y compensatorios ---------- */
export function Prestamos({ modulos }) {
  const [tab, setTab] = useState(modulos.prestamos ? 'prestamos' : 'compensatorios'), lista = useCarga(() => (modulos.prestamos ? api('adminPrestamos') : Promise.resolve([])), []), personas = useCarga(() => api('adminPersonal'), []);
  const [nuevo, setNuevo] = useState(false), [f, campo, setF] = useForm({}), [comp, setComp] = useState(false), [correr, ocupado] = useAccion();
  const activos = (personas.datos || []).filter((u) => u.estado === 'activo');
  const crear = async () => { if (await correr(() => api('adminPrestamoGuardar', { ...f, monto: +String(f.monto).replace(/\D/g, '') }), 'Préstamo registrado. Las cuotas se descuentan solas al cerrar cada nómina.')) { setNuevo(false); lista.recargar(true); } };
  const guardarComp = async () => { const min = Math.round((+String(f.horas).replace(',', '.') || 0) * 60) * (f.mov === 'disfrute' ? -1 : 1); if (await correr(() => api('adminCompensatorioGuardar', { cedula: f.cedula, minutos: min, fecha: f.fecha, motivo: f.motivo, soporte: f.soporte }), 'Movimiento registrado.')) setComp(false); };
  return <><Titulo t="Préstamos y compensatorios" accion={tab === 'prestamos' ? <Boton icono={Plus} onClick={() => { setF({ cedula: '', concepto: 'Adelanto de nómina', monto: '', cuotas: 2 }); setNuevo(true); }}>Nuevo préstamo</Boton> : <Boton icono={Plus} onClick={() => { setF({ cedula: '', mov: 'abono', horas: '', fecha: hoyISO(), motivo: '' }); setComp(true); }}>Registrar movimiento</Boton>}>
    {tab === 'prestamos' ? 'Las cuotas de los préstamos activos se descuentan automáticamente al cerrar cada nómina.' : 'Horas a favor del trabajador para tomar como descanso. Las horas extra se pueden abonar aquí al aprobarlas.'}</Titulo>
    {modulos.prestamos && modulos.nomina && <div style={{ marginBottom: 16 }}><Pestanas etiqueta="Vista" valor={tab} alCambiar={setTab} opciones={[{ v: 'prestamos', t: 'Préstamos' }, { v: 'compensatorios', t: 'Compensatorios' }]} /></div>}
    {tab === 'prestamos' ? <Estado carga={lista}>{(l) => <Tabla columnas={[{ k: 'nombre', t: 'Persona', render: (p) => <strong>{p.nombre}</strong> }, { k: 'concepto', t: 'Concepto' }, { k: 'monto', t: 'Monto', num: true, render: (p) => pesos(p.monto) },
      { k: 'cuotas', t: 'Cuotas', num: true, render: (p) => `${p.pagadas}/${p.cuotas} de ${pesos(p.cuotaValor)}` }, { k: 'saldo', t: 'Saldo', num: true, render: (p) => <strong>{pesos(p.saldo)}</strong> },
      { k: 'estado', t: 'Estado', render: (p) => <Insignia tono={p.estado === 'activo' ? 'aviso' : 'ok'}>{p.estado}</Insignia> }]} filas={l} clave={(p) => p.id} vacio="No hay préstamos registrados." />}</Estado>
      : <Aviso>Los saldos de cada persona aparecen en su expediente (Personal → Expediente) y en su celular, sección Más.</Aviso>}
    <Hoja abierta={nuevo} alCerrar={() => setNuevo(false)} titulo="Nuevo préstamo o adelanto">
      <Campo como="select" etiqueta="Persona" {...campo('cedula')}><option value="">Elige…</option>{activos.map((u) => <option key={u.cedula} value={u.cedula}>{u.nombre}</option>)}</Campo>
      <Campo etiqueta="Concepto" maxLength={80} {...campo('concepto')} />
      <div className="rejilla"><Campo etiqueta="Monto ($)" inputMode="numeric" {...campo('monto')} /><Campo etiqueta="Número de cuotas" type="number" min="1" max="60" {...campo('cuotas')} /></div>
      {+String(f.monto).replace(/\D/g, '') > 0 && <p className="suave">Cuota de {pesos(Math.round(+String(f.monto).replace(/\D/g, '') / Math.max(1, +f.cuotas || 1)))} por periodo de nómina.</p>}
      <div className="campo"><label htmlFor="autp">Autorización de descuento firmada por el trabajador (foto)</label><input id="autp" className="entrada" style={{ paddingTop: 10 }} type="file" accept="image/*" onChange={async (e) => { const a = e.target.files[0]; setF({ ...f, autorizacion: a ? await comprimirArchivo(a) : '' }); }} />
        <span className="ayuda">Obligatoria: sin autorización escrita no se puede descontar del salario (CST arts. 59 y 149).</span></div>
      <Aviso tono="info">La cuota se descuenta sola al cerrar cada nómina. Si el neto no alcanza sin bajar del mínimo vital o del 50 % del neto, se descuenta menos y el saldo sigue para el periodo siguiente.</Aviso>
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setNuevo(false)}>Cancelar</Boton><Boton cargando={ocupado} disabled={!f.cedula || !f.monto || !f.autorizacion} onClick={crear}>Registrar</Boton></div>
    </Hoja>
    <Hoja abierta={comp} alCerrar={() => setComp(false)} titulo="Movimiento de compensatorios">
      <Campo como="select" etiqueta="Persona" {...campo('cedula')}><option value="">Elige…</option>{activos.map((u) => <option key={u.cedula} value={u.cedula}>{u.nombre}</option>)}</Campo>
      <Campo como="select" etiqueta="Movimiento" opciones={[{ v: 'abono', t: 'Abonar horas a su favor' }, { v: 'disfrute', t: 'Descontar horas que tomó como descanso' }]} {...campo('mov')} />
      <div className="rejilla"><Campo etiqueta="Horas" inputMode="decimal" placeholder="Ej.: 2,5" {...campo('horas')} /><Campo etiqueta="Fecha" type="date" {...campo('fecha')} /></div>
      <Campo etiqueta={f.mov === 'abono' ? 'Origen del abono (acuerdo firmado)' : 'Motivo'} maxLength={160} {...campo('motivo')} />
      {f.mov === 'abono' && <div className="campo"><label htmlFor="sopc">Foto del acuerdo firmado con el trabajador</label><input id="sopc" className="entrada" style={{ paddingTop: 10 }} type="file" accept="image/*" onChange={async (e) => { const a = e.target.files[0]; setF({ ...f, soporte: a ? await comprimirArchivo(a) : '' }); }} /></div>}
      <p className="suave chico">{f.mov === 'disfrute' ? 'El día de descanso se paga como permiso remunerado: no cuenta como ausencia en la nómina. No se puede descontar más de lo que tiene a favor.' : 'Para horas extra, abónalas desde «Horas extra» al aprobarlas: así se calcula el descanso con su recargo.'}</p>
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setComp(false)}>Cancelar</Boton><Boton cargando={ocupado} disabled={!f.cedula || !f.horas || (f.mov === 'abono' && ((f.motivo || '').length < 5 || !f.soporte))} onClick={guardarComp}>Registrar</Boton></div>
    </Hoja></>;
}

/* ---------- Comunicados ---------- */
export function Comunicados({ centros }) {
  const carga = useCarga(() => api('adminComunicados'), []), personas = useCarga(() => api('adminPersonal'), []), [nuevo, setNuevo] = useState(false), [f, campo, setF] = useForm({}), [sel, setSel] = useState([]), [ver, setVer] = useState(null), [correr, ocupado] = useAccion();
  const nombres = Object.fromEntries((personas.datos || []).map((u) => [u.cedula, u]));
  const crear = async () => { if (await correr(() => api('adminComunicadoCrear', { ...f, centros: sel }), 'Comunicado publicado.')) { setNuevo(false); carga.recargar(true); } };
  return <><Titulo t="Comunicados" accion={<Boton icono={Plus} onClick={() => { setF({ titulo: '', cuerpo: '' }); setSel([]); setNuevo(true); }}>Nuevo comunicado</Boton>}>Circulares que el personal lee en su celular. Queda registrado quién lo leyó y cuándo.</Titulo>
    <Estado carga={carga}>{(l) => l.length === 0 ? <Vacio icono={Megaphone} titulo="Sin comunicados">Publica el primero: un simulacro, un cambio de horario, una capacitación.</Vacio> :
      <div className="pila">{l.map((c) => { const destino = (personas.datos || []).filter((u) => u.estado === 'activo' && (!c.centros.length || c.centros.includes(u.centroId))); return <Tarjeta key={c.id}>
        <div className="fila entre" style={{ alignItems: 'flex-start' }}><div><h3>{c.titulo}</h3><p className="suave chico">{fechaHora(c.creado)} · {c.centros.length ? c.centros.map((id) => centros.find((x) => x.id === id)?.nombre).filter(Boolean).join(', ') : 'Toda la empresa'}</p></div>
          <Insignia tono={c.totalLeidos >= destino.length ? 'ok' : 'aviso'}>Leído por {c.totalLeidos} de {destino.length}</Insignia></div>
        <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0' }}>{c.cuerpo}</p>
        <Boton chico variante="texto" onClick={() => setVer(ver === c.id ? null : c.id)} aria-expanded={ver === c.id}>{ver === c.id ? 'Ocultar lecturas' : 'Ver quién lo leyó'}</Boton>
        {ver === c.id && <ul className="lista chico">{destino.map((u) => <li key={u.cedula}><span className="crece">{u.nombre}</span>{c.leidos[u.cedula] ? <span className="num">{fechaHora(c.leidos[u.cedula])}</span> : <Insignia tono="aviso">sin leer</Insignia>}</li>)}</ul>}
      </Tarjeta>; })}</div>}</Estado>
    <Hoja abierta={nuevo} alCerrar={() => setNuevo(false)} titulo="Nuevo comunicado">
      <Campo etiqueta="Título" maxLength={120} {...campo('titulo')} /><Campo como="textarea" etiqueta="Mensaje" maxLength={2000} {...campo('cuerpo')} />
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="pila junta"><legend className="etiqueta">Para (sin marcar = toda la empresa)</legend>{centros.map((c) => <Casilla key={c.id} checked={sel.includes(c.id)} onChange={(e) => setSel(e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id))}>{c.nombre}</Casilla>)}</fieldset>
      <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setNuevo(false)}>Cancelar</Boton><Boton cargando={ocupado} disabled={!f.titulo || !f.cuerpo} onClick={crear}>Publicar</Boton></div>
    </Hoja></>;
}

/* ---------- Provisiones de prestaciones (pestaña de Nómina) ---------- */
export function Provisiones({ cfg }) {
  const [r, setR] = useState(() => periodoActual(cfg.periodoNomina)), carga = useCarga(() => api('adminProvisiones', r, { espera: 120000 }), [r.desde, r.hasta]), [correr, ocupado] = useAccion();
  return <div className="pila">
    <div className="fila entre" style={{ alignItems: 'flex-end' }}><Rango r={r} setR={setR} /><Boton variante="secundario" cargando={ocupado} disabled={!carga.datos} onClick={() => correr(() => aExcel({ Provisiones: carga.datos.filas.map((x) => ({ 'Cédula': x.cedula, Nombre: x.nombre, Centro: x.centro, Devengado: x.devengado, Prima: x.prima, 'Cesantías': x.cesantias, 'Intereses cesantías': x.intereses, Vacaciones: x.vacaciones, 'Total provisiones': x.totalProvisiones, 'Pensión (12 %)': x.aportesDet.pension, 'Salud (8,5 %)': x.aportesDet.salud, ARL: x.aportesDet.arl, 'Caja (4 %)': x.aportesDet.caja, SENA: x.aportesDet.sena, ICBF: x.aportesDet.icbf, 'Total aportes': x.aportes, 'Costo total': x.costoTotal })) }, `provisiones-${r.desde}-a-${r.hasta}.xlsx`))}>Excel</Boton></div>
    <p className="suave chico">Lo que la empresa debe reservar y pagar además del salario: prima y cesantías (8,33 % del salario más auxilio, sin pagos no salariales), intereses de cesantías (12 % anual), vacaciones (4,17 % sin auxilio ni horas extra) y aportes del empleador: pensión 12 %, ARL según la tarifa de Configuración, caja 4 % y, si la empresa no está exonerada, salud 8,5 %, SENA 2 % e ICBF 3 %. Es un estimado; la PILA es la que manda.</p>
    <Estado carga={carga}>{(d) => <>
      <div className="indicadores">{[['Devengado', d.total.devengado], ['Prima', d.total.prima], ['Cesantías', d.total.cesantias], ['Intereses', d.total.intereses], ['Vacaciones', d.total.vacaciones], ['Aportes', d.total.aportes], ['Costo total', d.total.costoTotal]].map(([t, v]) => <div key={t} className="indicador"><span className="valor" style={{ fontSize: 'var(--t-5)' }}>{pesos(v)}</span><span className="rotulo">{t}</span></div>)}</div>
      <Tabla columnas={[{ k: 'nombre', t: 'Persona', render: (x) => <strong>{x.nombre}</strong> }, { k: 'devengado', t: 'Devengado', num: true, render: (x) => pesos(x.devengado) }, { k: 'prima', t: 'Prima', num: true, render: (x) => pesos(x.prima) },
        { k: 'cesantias', t: 'Cesantías', num: true, render: (x) => pesos(x.cesantias) }, { k: 'intereses', t: 'Intereses', num: true, render: (x) => pesos(x.intereses) }, { k: 'vacaciones', t: 'Vacaciones', num: true, render: (x) => pesos(x.vacaciones) }, { k: 'aportes', t: 'Aportes', num: true, render: (x) => pesos(x.aportes) },
        { k: 'costoTotal', t: 'Costo total', num: true, render: (x) => <strong>{pesos(x.costoTotal)}</strong> }]} filas={d.filas} clave={(x) => x.cedula} /></>}</Estado>
    <PagarPrestaciones /></div>;
}
/* Pagar prima (junio/diciembre) o intereses de cesantías (enero): vista previa y registro */
function PagarPrestaciones() {
  const hoy = new Date(), y = hoy.getFullYear(), m = hoy.getMonth() + 1;
  const [tipo, setTipo] = useState(m === 1 ? 'intereses' : 'prima'), [periodo, setPeriodo] = useState(m === 1 ? String(y - 1) : `${y}-${m <= 6 ? 1 : 2}`), [d, setD] = useState(null), [correr, ocupado] = useAccion();
  const ver = (registrar) => correr(async () => setD(await api('adminPrestacionesPeriodicas', { tipo, periodo, registrar }, { espera: 120000 })));
  return <div className="tarjeta pila" style={{ marginTop: 16 }}>
    <h3>Pagar prima o intereses de cesantías</h3>
    <div className="fila" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <label className="campo"><span>Qué vas a pagar</span><select value={tipo} onChange={(e) => { const t = e.target.value; setTipo(t); setPeriodo(t === 'intereses' ? String(y - (m === 1 ? 1 : 0)) : `${y}-${m <= 6 ? 1 : 2}`); setD(null); }}><option value="prima">Prima de servicios (semestre)</option><option value="intereses">Intereses de cesantías (año)</option></select></label>
      <label className="campo"><span>{tipo === 'prima' ? 'Semestre (AAAA-1 o AAAA-2)' : 'Año'}</span><input value={periodo} onChange={(e) => { setPeriodo(e.target.value); setD(null); }} /></label>
      <Boton variante="secundario" cargando={ocupado} onClick={() => ver(false)}>Ver cálculo</Boton>
      {d && d.filas.some((f) => !f.yaRegistrado) && <Boton cargando={ocupado} onClick={() => ver(true)}>Registrar como pagado</Boton>}
      {d && <Boton variante="secundario" onClick={() => aExcel({ [tipo === 'prima' ? 'Prima' : 'Intereses']: d.filas.map((f) => ({ 'Cédula': f.cedula, Nombre: f.nombre, 'Días': f.dias, Base: f.base, Valor: f.valor, Registrado: f.yaRegistrado ? 'Sí' : 'No' })) }, `${tipo}-${periodo}.xlsx`)}>Excel</Boton>}
    </div>
    {d && <><p className="suave chico">{d.nota} Periodo {d.desde} a {d.hasta}. Total: <strong>{pesos(d.total)}</strong>{d.registrados ? ` · ${d.registrados} registrados ahora` : ''}.</p>
      <Tabla columnas={[{ k: 'nombre', t: 'Persona' }, { k: 'dias', t: 'Días', num: true }, { k: 'base', t: 'Base', num: true, render: (x) => pesos(x.base) }, { k: 'valor', t: 'Valor', num: true, render: (x) => <strong>{pesos(x.valor)}</strong> }, { k: 'yaRegistrado', t: 'Pagado', render: (x) => x.yaRegistrado ? 'Sí' : 'No' }]} filas={d.filas} clave={(x) => x.cedula} /></>}
  </div>;
}

/* ---------- Simulador de liquidación de contrato (pestaña de Nómina) ---------- */
export function LiquidacionContrato() {
  const personas = useCarga(() => api('adminPersonal'), []), [f, campo] = useForm({ cedula: '', fechaRetiro: hoyISO(), causa: 'renuncia', autorizaDescuento: false, primaPagadaHasta: '' }), [res, setRes] = useState(null), [correr, ocupado] = useAccion();
  const calcular = async (guardar) => { const r = await correr(() => api('adminLiquidacionContrato', { ...f, guardar }), guardar ? 'Liquidación registrada en la auditoría.' : undefined); if (r) setRes(r); return r; };
  const CAUSAS = [{ v: 'renuncia', t: 'Renuncia voluntaria' }, { v: 'sin_justa_causa', t: 'Despido sin justa causa' }, { v: 'justa_causa', t: 'Despido con justa causa' }, { v: 'mutuo_acuerdo', t: 'Mutuo acuerdo' }, { v: 'fin_plazo', t: 'Vencimiento del plazo (término fijo)' }, { v: 'fin_obra', t: 'Terminación de la obra o labor' }];
  const lineas = res ? [['Salario del último periodo', res.periodoPendiente || 'ya pagado en nómina', res.salarioPendiente], ['Cesantías', `${res.diasAnio} días del año · base ${pesos(res.baseCesantias)}`, res.cesantias], ['Intereses de cesantías', '12 % anual', res.interesesCesantias],
    ['Prima de servicios', `${res.diasSemestre} días del semestre · base ${pesos(res.basePrima)}`, res.prima], ['Vacaciones pendientes', `${res.diasVacacionesPendientes} días hábiles · base ${pesos(res.baseVacaciones)}`, res.vacaciones]].concat(res.indemnizacion ? [['Indemnización (CST art. 64)', res.indemnizacionDetalle, res.indemnizacion]] : []) : [];
  return <div className="pila">
    <p className="suave chico no-imprimir">Estimado con meses de 30 días: salario pendiente, cesantías e intereses, prima, vacaciones e indemnización si el despido es sin justa causa. Las licencias no remuneradas se descuentan del tiempo. Al registrarla, la persona sale de la nómina de ese periodo (ya se le paga aquí) y el préstamo descontado queda saldado. Revísala con tu contador antes de pagar.</p>
    <div className="rejilla no-imprimir"><Campo como="select" etiqueta="Persona" {...campo('cedula')}><option value="">Elige…</option>{(personas.datos || []).filter((u) => !/^Exempleado /.test(u.nombre)).map((u) => <option key={u.cedula} value={u.cedula}>{u.nombre}{u.estado === 'inactivo' ? ' (retirado)' : ''}</option>)}</Campo><Campo etiqueta="Fecha de retiro" type="date" {...campo('fechaRetiro')} /></div>
    <div className="no-imprimir pila"><Campo como="select" etiqueta="Causa de la terminación" opciones={CAUSAS} {...campo('causa')} />
    <Casilla {...campo('autorizaDescuento', 'check')}>Descontar el saldo de préstamos: la autorización firmada por el trabajador cubre expresamente el descuento de prestaciones al terminar el contrato</Casilla>
    <Campo etiqueta="Prima ya pagada hasta (opcional)" type="date" ayuda="Si ya le pagaste prima de este semestre, indica hasta qué fecha cubría." {...campo('primaPagadaHasta')} />
    <div className="fila"><Boton icono={Calculator} cargando={ocupado} disabled={!f.cedula} onClick={() => calcular(false)}>Calcular</Boton>
      {res && <Boton variante="secundario" cargando={ocupado} onClick={async () => { if (await calcular(true)) setTimeout(() => window.print(), 300); }}>Registrar e imprimir para firma</Boton>}</div></div>
    {res && <Tarjeta titulo={`Liquidación de contrato · ${res.nombre}`}>
      {res.empresa?.logo && <img src={res.empresa.logo} alt="" style={{ height: 48, marginBottom: 8 }} />}
      <p className="chico" style={{ marginBottom: 8 }}>{res.empresa?.nombre}{res.empresa?.nit ? ` · NIT ${res.empresa.nit}` : ''}<br />C.C. {res.cedula}{res.cargo ? ` · ${res.cargo}` : ''} · Contrato {res.tipoContrato} · del {fechaDoc(res.ingreso)} al {fechaDoc(res.retiro)} · {res.causaTexto}<br /><span className="suave">Elaborada el {fechaDoc(hoyISO())}</span></p>
      {lineas.map(([t, d, v]) => <div className="concepto" key={t}><span>{t}</span><span className="cant">{d}</span><span className="num">{pesos(v)}</span></div>)}
      {res.descuentoPrestamos > 0 && <div className="concepto"><span>Saldo de préstamos (autorizado)</span><span className="cant" /><span className="num neg">− {pesos(res.descuentoPrestamos)}</span></div>}
      <div className="total"><span>Total a pagar</span><span className="num" style={{ fontSize: 'var(--t-5)' }}>{pesos(res.totalEstimado)}</span></div>
      {res.saldoPrestamos > 0 && !res.descuentoPrestamos && <Aviso tono="aviso">Tiene un saldo de préstamos de {pesos(res.saldoPrestamos)}. Solo se descuenta con su autorización escrita registrada en el préstamo.</Aviso>}
      <ul className="chico suave" style={{ marginTop: 8, paddingLeft: 18 }}>{(res.avisos || []).map((a) => <li key={a}>{a}</li>)}</ul>
      <div className="solo-imprimir" style={{ marginTop: 56 }}><div className="rejilla"><div>____________________________<br />Firma del empleador</div><div>____________________________<br />Firma del trabajador · C.C. {res.cedula}</div></div></div>
    </Tarjeta>}
  </div>;
}

/* ---------- Presupuesto por obra (en Resumen por obra) ---------- */
export function Presupuesto() {
  const [r, setR] = useState(() => ({ desde: hoyISO().slice(0, 8) + '01', hasta: hoyISO() })), carga = useCarga(() => api('adminPresupuestoObras', r, { espera: 120000 }), [r.desde, r.hasta]);
  const barra = (pct) => <span className="barra-pista" style={{ display: 'inline-block', width: 120, background: 'var(--c-superficie-2)', borderRadius: 4, verticalAlign: 'middle' }}><span className="barra" style={{ width: `${Math.min(100, pct || 0)}%`, background: pct >= 100 ? 'var(--c-peligro)' : pct >= 80 ? 'var(--c-acento)' : 'var(--c-primario)' }} /></span>;
  return <div className="pila"><Rango r={r} setR={setR} />
    <p className="suave chico">El presupuesto de horas y de costo se pone en cada centro de trabajo. La alerta sale por correo al 80 % y al 100 % del mes.</p>
    <Estado carga={carga}>{(d) => <Tabla buscar={false} columnas={[{ k: 'centro', t: 'Obra', render: (o) => <strong>{o.centro}</strong> },
      { k: 'pctHoras', t: 'Horas', render: (o) => o.presupuestoHoras ? <span className="fila" style={{ flexWrap: 'nowrap' }}>{barra(o.pctHoras)}<span className="num">{horasDec(o.horas)} de {o.presupuestoHoras} h ({o.pctHoras} %)</span></span> : <span className="suave">{horasDec(o.horas)} · sin presupuesto</span> },
      { k: 'pctCosto', t: 'Costo', render: (o) => o.presupuestoCosto ? <span className="fila" style={{ flexWrap: 'nowrap' }}>{barra(o.pctCosto)}<span className="num">{pesos(o.costo)} de {pesos(o.presupuestoCosto)} ({o.pctCosto} %)</span></span> : <span className="suave">{pesos(o.costo)} · sin presupuesto</span> },
      { k: 'alerta', t: 'Estado', render: (o) => <Insignia tono={o.alerta === 'excedido' ? 'peligro' : o.alerta === 'aviso' ? 'aviso' : 'ok'}>{o.alerta === 'ok' ? 'en rango' : o.alerta}</Insignia> }]} filas={d.obras} clave={(o) => o.centroId} vacio="No hay actividad en ese rango." />}</Estado></div>;
}

/* ---------- Expediente 360° de una persona ---------- */
export function Expediente({ cedula, alCerrar, esAdmin }) {
  const carga = useCarga(() => (cedula ? api('adminExpediente360', { cedula }) : Promise.resolve(null)), [cedula]);
  return <Hoja abierta={!!cedula} alCerrar={alCerrar} titulo="Expediente" alto={0.92}><Estado carga={carga} lineas={8}>{(x) => x && <div className="pila">
    <div><h3>{x.usuario.nombre}</h3><p className="suave chico">C.C. {x.usuario.cedula} · {x.usuario.cargo}{x.usuario.ingreso ? ` · ingreso ${fechaCorta(x.usuario.ingreso)}` : ''}{x.usuario.finContrato ? ` · contrato hasta ${fechaCorta(x.usuario.finContrato)}` : ''}</p></div>
    <div className="mini-resumen">{[['Hoy', x.hoy.marcas.entrada ? `${x.hoy.marcas.entrada}${x.hoy.marcas.salida ? '–' + x.hoy.marcas.salida : ''}` : 'sin marcar'], ['Horas del periodo', horasDec(x.resumenPeriodo.horas.trabajadas)], ['Neto estimado', pesos(x.resumenPeriodo.neto)], ['Vacaciones', `${Math.round((x.vacaciones.causadas - x.vacaciones.tomadas) * 10) / 10} días`]].map(([t, v]) => <div key={t}><span className="suave chico">{t}</span><strong className="num" style={{ fontSize: 'var(--t-3)' }}>{v}</strong></div>)}</div>
    <div className="mini-resumen">{[['Tardanzas', x.resumenPeriodo.tardanzas], ['Ausencias', x.resumenPeriodo.ausencias], ['Compensatorios', horas(x.compensatorios.saldoMin)], ['Comunicados sin leer', x.comunicadosPendientes]].map(([t, v]) => <div key={t}><span className="suave chico">{t}</span><strong className="num" style={{ fontSize: 'var(--t-3)' }}>{v}</strong></div>)}</div>
    {x.prestamos.length > 0 && <Tarjeta titulo="Préstamos"><ul className="lista">{x.prestamos.map((p) => <li key={p.id}><span className="crece">{p.concepto} · {p.pagadas}/{p.cuotas} cuotas</span><strong className="num">{pesos(p.saldo)}</strong></li>)}</ul></Tarjeta>}
    {x.extras.length > 0 && <Tarjeta titulo="Últimas horas extra"><ul className="lista chico">{x.extras.map((e) => <li key={e.id}><span className="crece">{fechaCorta(e.fecha)} · {horas(e.minCalc)}</span><Insignia tono={e.estado === 'aprobada' ? 'ok' : e.estado === 'pendiente' ? 'aviso' : ''}>{e.estado}</Insignia></li>)}</ul></Tarjeta>}
    <Tarjeta titulo="Próximos días"><ul className="lista chico">{x.programacion.dias.slice(0, 7).map((d) => <li key={d.fecha}><span className="crece">{fechaCorta(d.fecha)}</span><span className="num">{d.novedad || (d.horario ? `${d.horario.e}–${d.horario.s}` : 'descanso')}</span></li>)}</ul></Tarjeta>
    {esAdmin && <details><summary className="etiqueta" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Certificado laboral</summary><Certificado cedula={x.usuario.cedula} /></details>}
    {x.ultimaNomina && <p className="suave chico">Último desprendible: {fechaCorta(x.ultimaNomina.desde)} – {fechaCorta(x.ultimaNomina.hasta)}, neto {pesos(x.ultimaNomina.neto)} · {x.ultimaNomina.acuse ? `recibido el ${fechaHora(x.ultimaNomina.acuse)}` : 'sin confirmar recibido'}.</p>}
  </div>}</Estado></Hoja>;
}

/* ---------- QR de obra que rota (para mostrar en una tablet en portería) ---------- */
export function QrObra({ centro, alCerrar }) {
  const [d, setD] = useState(null), [img, setImg] = useState(''), [err, setErr] = useState(''), [quedan, setQuedan] = useState(0);
  useEffect(() => {
    if (!centro) return; let vivo = true, t, c;
    const cargar = async () => { try { const r = await api('adminQrCentro', { centroId: centro.id }); if (!vivo) return; setD(r); setImg(await QRCode.toDataURL(r.qrPayload, { width: 360, margin: 1, errorCorrectionLevel: 'M' })); setQuedan(r.expiraEnSeg); t = setTimeout(cargar, (r.expiraEnSeg + 1) * 1000); } catch (e) { setErr(e.message); } };
    cargar(); c = setInterval(() => setQuedan((q) => Math.max(0, q - 1)), 1000);
    return () => { vivo = false; clearTimeout(t); clearInterval(c); };
  }, [centro]);
  return <Hoja abierta={!!centro} alCerrar={alCerrar} titulo={`QR de ${centro?.nombre || ''}`} alto={0.95}>
    {err ? <Aviso tono="peligro">{err}</Aviso> : !d ? <div className="esqueleto" style={{ height: 360 }} /> : <div className="pila" style={{ alignItems: 'center', textAlign: 'center' }}>
      <img src={img} alt={`Código QR de ${d.centro}. Cambia en ${quedan} segundos.`} style={{ width: 'min(360px, 80vw)', background: '#fff', padding: 12, borderRadius: 12 }} />
      <p>Cambia en <strong className="num">{quedan} s</strong>. Deja esta pantalla abierta en la portería.</p>
      <p className="suave">Código del día (para quien no pueda escanear): <strong className="num" style={{ fontSize: 'var(--t-5)', letterSpacing: '.1em' }}>{d.codigoDia}</strong></p>
    </div>}</Hoja>;
}

/* ---------- Licencia (pestaña de Configuración) ---------- */
export function Licencia({ yo, recargarYo }) {
  const [llave, setLlave] = useState(''), [correr, ocupado] = useAccion(), l = yo.licencia || {};
  const ver = useCarga(() => api('adminVersion'), []), [buscando, setBuscando] = useState(false), [act, setAct] = useState(false);
  const activar = async () => { if (await correr(() => api('adminLicenciaActivar', { llave: llave.trim() }), 'Licencia activada.')) { setLlave(''); recargarYo(); } };
  const buscar = async () => { setBuscando(true); const r = await correr(() => api('adminLicenciaSincronizar'), null); setBuscando(false); if (r) { r.cambio ? recargarYo() : null; ver.recargar(true); } };
  const actualizar = async () => { setAct(true); const r = await correr(() => api('adminActualizar'), null); setAct(false); ver.recargar(true); if (r && !r.sinCambios) setTimeout(() => location.reload(), 2500); };
  const auto = async (v) => { await correr(() => api('adminActualizar', { automatica: v }), v ? 'Se actualizará sola cada noche.' : 'Actualización automática desactivada.'); ver.recargar(true); };
  const NOMBRES = { asistencia: 'Asistencia', nomina: 'Nómina', permisos: 'Permisos', turnos: 'Turnos', prestamos: 'Préstamos', autoservicio: 'Autoservicio', kiosco: 'Kiosco', qr: 'QR de obra', presupuesto: 'Presupuesto', tablero360: 'En vivo y 360°', seguridadPro: 'Seguridad Pro' };
  return <div className="pila">
    <Tarjeta titulo="Plan y módulos"><div className="pila">
      <div className="rejilla"><div><span className="suave chico">Plan</span><div><strong style={{ textTransform: 'capitalize' }}>{l.plan || '—'}</strong></div></div><div><span className="suave chico">Hasta</span><div><strong>{l.maxUsuarios || '—'} personas</strong></div></div>
        <div><span className="suave chico">Vence</span><div><strong>{l.vence ? fechaCorta(l.vence) : 'sin vencimiento'}</strong> {l.vencida && <Insignia tono="peligro">vencida</Insignia>}{l.enGracia && <Insignia tono="aviso">en gracia</Insignia>}</div></div></div>
      {l.motivo && <Aviso tono="peligro">{l.motivo}</Aviso>}
      {l.enGracia && <Aviso tono="aviso">La suscripción venció el {fechaCorta(l.vence)}. Tienes 15 días de gracia con todo funcionando para renovar y cerrar la nómina.</Aviso>}
      <div><span className="suave chico">Módulos de tu plan</span><div className="fila" style={{ gap: 6, marginTop: 4 }}>{Object.keys(NOMBRES).map((m) => <Insignia key={m} tono={(l.modulos || []).includes(m) ? 'ok' : ''}>{(l.modulos || []).includes(m) ? '✓ ' : '✗ '}{NOMBRES[m]}</Insignia>)}</div></div>
      <p className="suave chico">Los módulos los define tu proveedor según el plan contratado. Para agregar uno, pídeselo: el cambio llega solo.</p>
      {ver.datos?.conPanel && <div className="fila" style={{ gap: 8 }}><Boton variante="secundario" icono={RefreshCw} cargando={buscando} onClick={buscar}>Buscar mi licencia ahora</Boton>{ver.datos.panelContacto && <span className="suave chico">Última revisión: {fechaHora(ver.datos.panelContacto)}</span>}</div>}
      <details><summary className="etiqueta" style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center' }}>Pegar una llave a mano</summary>
        <div className="pila junta"><Campo como="textarea" etiqueta="Nueva llave de licencia" ayuda="Solo si tu proveedor te envió una llave por mensaje." value={llave} onChange={(e) => setLlave(e.target.value)} />
        <div className="fila fin"><Boton icono={KeyRound} cargando={ocupado} disabled={llave.trim().split('.').length !== 2} onClick={activar}>Activar llave</Boton></div></div></details>
    </div></Tarjeta>
    <Tarjeta titulo="Versión y actualizaciones"><Estado carga={ver} lineas={3}>{(v) => <div className="pila">
      <div className="rejilla"><div><span className="suave chico">Versión instalada</span><div><strong>{v.version}</strong></div></div>
        <div><span className="suave chico">Última publicada</span><div><strong>{v.disponible || '—'}</strong> {v.disponible && v.disponible !== v.version && <Insignia tono="aviso">hay una nueva</Insignia>}</div></div>
        <div><span className="suave chico">Última revisión</span><div><strong>{v.revisada ? fechaHora(v.revisada) : 'todavía no'}</strong></div></div></div>
      {v.ultima?.a && <p className="chico">Última actualización: de {v.ultima.de} a {v.ultima.a}, el {fechaHora(v.ultima.fecha)}.</p>}
      {v.error && <Aviso tono="peligro">{v.error}</Aviso>}
      {!v.conPagina && <Aviso tono="aviso">Esta instalación no tiene la dirección de la página en Proveedor.gs, así que no puede buscar actualizaciones.</Aviso>}
      <Casilla checked={v.automatica} onChange={(e) => auto(e.target.checked)}>Actualizar sola cada noche (recomendado)</Casilla>
      <div className="fila" style={{ gap: 8 }}><Boton icono={Download} cargando={act} disabled={!v.conPagina} onClick={actualizar}>Buscar y actualizar ahora</Boton>
        {v.anterior && <Boton variante="secundario" onClick={async () => { if (window.confirm(`¿Volver a la versión ${v.anterior}? La actualización automática quedará apagada.`)) { const r = await correr(() => api('adminActualizar', { volver: true }), null); if (r) setTimeout(() => location.reload(), 2000); } }}>Volver a la versión {v.anterior}</Boton>}</div>
      {v.conPanel && <Casilla checked={v.reportar} onChange={async (e) => { await correr(() => api('adminActualizar', { reportar: e.target.checked }), null); ver.recargar(true); }}>Enviar cada noche a mi proveedor el NIT, la versión y el número de personas activas (para la licencia y el soporte). No se envían datos de los trabajadores.</Casilla>}
      <p className="suave chico">Solo se instalan versiones aprobadas por tu proveedor, y nunca entre el corte y el cierre de la nómina. La primera vez, la cuenta de Google dueña de la hoja debe activar «API de Google Apps Script» en script.google.com/home/usersettings. Si una versión pide permisos nuevos, el dueño la instala desde el menú de la hoja. El enlace de la empresa no cambia al actualizar.</p>
    </div>}</Estado></Tarjeta>
  </div>;
}
export { Landmark, Tablet, QrCode, ArrowLeft, idDeTexto, sumarDias };
