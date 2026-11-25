// Autoservicio del trabajador: horario, comunicados, préstamos y compensatorios, extras, incapacidad, certificado, emergencias.
import React, { useState } from 'react';
import { ArrowLeft, Award, Bell, CalendarClock, ChevronRight, HeartPulse, Landmark, LogOut, Megaphone, Phone, Printer, ShieldAlert, Timer } from 'lucide-react';
import { api } from './api.js';
import { Aviso, Boton, Campo, Estado, Insignia, Tarjeta, Vacio, useAvisos, useCarga, useForm } from './ui.jsx';
import { comprimirArchivo, fechaCorta, fechaHora, fechaLarga, horas, hoyISO, pesos } from './util.js';

export const tiene = (yo, m) => !yo.licencia || (yo.licencia.modulos || []).includes(m);

function Volver({ alVolver, titulo }) {
  return <div className="fila" style={{ marginBottom: 8 }}><Boton variante="texto" icono={ArrowLeft} onClick={alVolver}>Volver</Boton><h2 style={{ fontSize: 'var(--t-4)' }}>{titulo}</h2></div>;
}

function MiHorario() {
  const carga = useCarga(() => api('miProgramacion', { dias: 14 }), []);
  return <Estado carga={carga}>{(d) => <ul className="lista">{d.dias.map((x) => <li key={x.fecha}>
    <div className="crece"><strong>{fechaCorta(x.fecha)}</strong>{x.festivo && <Insignia tono="info">festivo</Insignia>}<div className="suave chico">{x.centro}</div></div>
    <div className="derecha num">{x.novedad ? <Insignia tono="info">{x.novedad}</Insignia> : x.horario ? <>{x.horario.e}–{x.horario.s}{x.horario.ai && <div className="suave chico">almuerzo {x.horario.ai}–{x.horario.af}</div>}</> : <span className="suave">Descanso</span>}</div></li>)}</ul>}</Estado>;
}

function Comunicados({ alCambiar }) {
  const carga = useCarga(() => api('comunicadosMios'), []), [abierto, setAbierto] = useState(null);
  const abrir = async (c) => { setAbierto(abierto === c.id ? null : c.id); if (!c.leidoEl) { try { await api('comunicadoLeer', { id: c.id }); carga.recargar(true); alCambiar?.(); } catch { /* se marcará luego */ } } };
  return <Estado carga={carga}>{(l) => l.length === 0 ? <Vacio icono={Megaphone} titulo="Sin comunicados">Las circulares de la empresa aparecerán aquí.</Vacio> :
    <ul className="lista tocable">{l.map((c) => <li key={c.id} style={{ display: 'block' }}><button onClick={() => abrir(c)} aria-expanded={abierto === c.id}>
      <span className="crece"><strong>{c.titulo}</strong><span className="suave chico" style={{ display: 'block' }}>{fechaHora(c.creado)}</span></span>{!c.leidoEl && <Insignia tono="aviso">nuevo</Insignia>}</button>
      {abierto === c.id && <div style={{ padding: '0 0 12px', whiteSpace: 'pre-wrap' }}>{c.cuerpo}<p className="suave chico" style={{ marginTop: 8 }}>Leído el {fechaHora(c.leidoEl || new Date().toISOString())}</p></div>}</li>)}</ul>}</Estado>;
}

function PrestamosCompensatorios({ yo }) {
  const p = useCarga(() => (tiene(yo, 'prestamos') ? api('misPrestamos') : Promise.resolve([])), []), c = useCarga(() => (tiene(yo, 'nomina') ? api('misCompensatorios') : Promise.resolve(null)), []);
  return <div className="pila">
    {tiene(yo, 'nomina') && <Tarjeta titulo="Banco de horas compensatorias"><Estado carga={c} lineas={2}>{(d) => d && <>
      <div className="dato-grande"><span className="suave chico">Saldo a tu favor</span><span className="valor">{horas(d.saldoMin)}</span></div>
      {d.movimientos.length > 0 && <ul className="lista chico" style={{ marginTop: 8 }}>{d.movimientos.slice(0, 10).map((m) => <li key={m.id}><span className="crece">{fechaCorta(m.fecha)} · {m.motivo || m.tipo}</span><span className="num">{+m.minutos > 0 ? '+' : '−'}{horas(Math.abs(+m.minutos))}</span></li>)}</ul>}</>}</Estado></Tarjeta>}
    {tiene(yo, 'prestamos') && <Tarjeta titulo="Préstamos y adelantos"><Estado carga={p} lineas={2}>{(l) => l.length === 0 ? <p className="suave">No tienes préstamos.</p> :
      <ul className="lista">{l.map((x) => <li key={x.id}><div className="crece"><strong>{x.concepto}</strong><div className="suave chico">{pesos(x.monto)} en {x.cuotas} cuotas de {pesos(x.cuotaValor)} · pagadas {x.pagadas}</div></div>
        <div className="derecha"><strong className="num">{pesos(x.saldo)}</strong><div><Insignia tono={x.estado === 'activo' ? 'aviso' : 'ok'}>{x.estado === 'activo' ? 'saldo' : 'pagado'}</Insignia></div></div></li>)}</ul>}</Estado></Tarjeta>}
  </div>;
}

function MisExtras() {
  const carga = useCarga(() => api('misExtras'), []), E = { pendiente: ['por aprobar', 'aviso'], aprobada: ['aprobada', 'ok'], rechazada: ['rechazada', 'peligro'], sin_extra: ['sin extra', ''] };
  return <Estado carga={carga}>{(l) => l.length === 0 ? <Vacio icono={Timer} titulo="Sin horas extra">Cuando trabajes más de tu jornada, aparecerán aquí con su estado.</Vacio> :
    <ul className="lista">{l.filter((x) => x.estado !== 'sin_extra').map((x) => <li key={x.id}><div className="crece"><strong>{fechaCorta(x.fecha)}</strong><div className="suave chico">calculadas {horas(x.minCalc)}{x.minAprob !== null ? ` · aprobadas ${horas(x.minAprob)}` : ''}{x.obs ? ` · ${x.obs}` : ''}</div></div><Insignia tono={E[x.estado]?.[1]}>{E[x.estado]?.[0] || x.estado}</Insignia></li>)}</ul>}</Estado>;
}

function ReportarIncapacidad({ alListo }) {
  const [f, campo] = useForm({ tipo: 'general', desde: hoyISO(), hasta: hoyISO(), entidad: '', nota: '' }), [foto, setFoto] = useState(''), [env, setEnv] = useState(false), avisos = useAvisos();
  const enviar = async () => { setEnv(true); try { await api('incapacidadReportar', { ...f, foto }); avisos.ok('Incapacidad enviada. Gestión Humana la verificará.'); alListo(); } catch (e) { avisos.error(e); } finally { setEnv(false); } };
  return <div className="pila">
    <Aviso>Envía la incapacidad apenas la tengas. No escribas el diagnóstico: basta con las fechas y la foto del certificado.</Aviso>
    <Campo como="select" etiqueta="Tipo" opciones={[{ v: 'general', t: 'Enfermedad general' }, { v: 'laboral', t: 'Accidente o enfermedad laboral' }, { v: 'maternidad', t: 'Licencia de maternidad' }, { v: 'paternidad', t: 'Licencia de paternidad' }]} {...campo('tipo')} />
    <div className="rejilla"><Campo etiqueta="Desde" type="date" {...campo('desde')} /><Campo etiqueta="Hasta (incluido)" type="date" min={f.desde} {...campo('hasta')} /></div>
    <Campo etiqueta="Entidad que la expidió" placeholder="EPS, ARL o IPS" {...campo('entidad')} />
    <div className="campo"><label htmlFor="incfoto">Foto del certificado</label><input id="incfoto" className="entrada" style={{ paddingTop: 10 }} type="file" accept="image/*" capture="environment" onChange={async (e) => { const a = e.target.files[0]; if (!a) return setFoto(''); try { setFoto(await comprimirArchivo(a)); } catch (x) { avisos.error(x); } }} />{foto && <img src={foto} alt="Vista previa del certificado" style={{ maxHeight: 160, borderRadius: 8, marginTop: 8 }} />}</div>
    <Boton cargando={env} disabled={!foto} onClick={enviar}>Enviar incapacidad</Boton>
  </div>;
}

export function Certificado({ yo, cedula }) { // con cédula: lo emite Gestión Humana (también para retirados)
  const [con, setCon] = useState(false), [d, setD] = useState(null), [c, setC] = useState(false), avisos = useAvisos();
  const generar = async () => { setC(true); try { setD(await api(cedula ? 'adminCertificadoLaboral' : 'certificadoLaboral', { conSalario: con, cedula })); } catch (e) { avisos.error(e); } finally { setC(false); } };
  if (!d) return <div className="pila"><p className="suave">{cedula ? 'Certificado laboral de esta persona, activa o retirada. Queda registrado y se puede verificar con el código.' : 'Genera tu certificado laboral al instante. Quien lo reciba puede verificar que es auténtico con el código.'}</p>
    <label className="casilla"><input type="checkbox" checked={con} onChange={(e) => setCon(e.target.checked)} /><span>Incluir el salario</span></label>
    <Boton icono={Award} cargando={c} onClick={generar}>Generar certificado</Boton></div>;
  const e = d.empleado, meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const larga = (f) => { const [y, m, dd] = f.split('-'); return `${+dd} de ${meses[+m - 1]} de ${y}`; };
  return <div className="pila">
    <div className="fila entre no-imprimir"><Boton variante="texto" icono={ArrowLeft} onClick={() => setD(null)}>Otro certificado</Boton><Boton variante="secundario" icono={Printer} onClick={() => window.print()}>Imprimir o guardar PDF</Boton></div>
    <Tarjeta><article className="pila" style={{ fontSize: 'var(--t-3)', lineHeight: 1.7 }}>
      <header><strong style={{ fontFamily: 'var(--f-titulo)', fontSize: 'var(--t-5)' }}>{d.empresa}</strong><div className="suave chico">NIT {d.nit}{d.direccion ? ` · ${d.direccion}` : ''}{d.telefono ? ` · ${d.telefono}` : ''}</div></header>
      <h2 style={{ textAlign: 'center', fontSize: 'var(--t-4)', margin: '16px 0' }}>CERTIFICA QUE</h2>
      <p><strong>{e.nombre}</strong>, identificado(a) con cédula de ciudadanía n.º {Number(e.cedula).toLocaleString('es-CO')}, {e.estado === 'activo' ? 'labora' : 'laboró'} en esta empresa desde el {e.ingreso ? larga(e.ingreso) : '—'}, desempeñando el cargo de <strong>{e.cargo}</strong>{e.tipoContrato ? `, con contrato ${e.tipoContrato === 'obra' ? 'por obra o labor' : e.tipoContrato === 'fijo' ? 'a término fijo' : e.tipoContrato === 'indefinido' ? 'a término indefinido' : e.tipoContrato}` : ''}{e.salario ? `, con un salario ${e.salarioTipo === 'diario' ? 'diario (jornal)' : 'mensual'} de ${pesos(e.salario)}` : ''}.</p>
      <p>Se expide a solicitud del interesado el {larga(d.fecha)}.</p>
      <p className="suave chico" style={{ marginTop: 16 }}>Código de verificación: <strong className="num">{d.codigoVerificacion}</strong>{d.verificarEn && <> · Verifíquelo en {d.verificarEn} con la cédula, la fecha ({d.fecha}) y este código.</>}</p>
    </article></Tarjeta></div>;
}

function Emergencias() {
  const carga = useCarga(() => api('contactosEmergencia'), []);
  return <Estado carga={carga}>{(d) => <div className="pila">
    <Aviso tono="peligro"><strong>En una emergencia llama primero al 123.</strong> Luego avisa a tu jefe inmediato.</Aviso>
    <div className="rejilla"><Tarjeta className="hundida"><span className="suave chico">ARL</span><div><strong>{d.arl || 'Pregunta a Gestión Humana'}</strong></div></Tarjeta><Tarjeta className="hundida"><span className="suave chico">EPS</span><div><strong>{d.eps || 'Pregunta a Gestión Humana'}</strong></div></Tarjeta></div>
    <ul className="lista">{[{ nombre: 'Línea de emergencias', rol: 'Policía, bomberos, ambulancia', telefono: '123' }].concat(d.contactos).map((c, i) => <li key={i}><div className="crece"><strong>{c.nombre}</strong><div className="suave chico">{c.rol}</div></div>
      <a className="btn secundario chico" href={`tel:${c.telefono}`}><Phone size={16} aria-hidden="true" />{c.telefono}</a></li>)}</ul></div>}</Estado>;
}

const SECCIONES = [
  ['horario', 'Mi horario', CalendarClock, 'turnos', 'Los próximos 14 días'], ['comunicados', 'Comunicados', Megaphone, 'autoservicio', 'Circulares de la empresa'],
  ['saldos', 'Préstamos y compensatorios', Landmark, ['prestamos', 'nomina'], 'Saldos y movimientos'], ['extras', 'Mis horas extra', Timer, 'nomina', 'Estado de cada día'],
  ['incapacidad', 'Reportar incapacidad', HeartPulse, 'permisos', 'Envía la foto del certificado'], ['certificado', 'Certificado laboral', Award, 'autoservicio', 'Al instante y verificable'],
  ['emergencias', 'Emergencias', ShieldAlert, null, 'ARL, EPS y teléfonos'], ['sesiones', 'Cerrar sesión en todos mis celulares', LogOut, null, 'Si perdiste un equipo']
];
export default function Mas({ yo, pendientesComunicados, alCambiar, alSalir }) {
  const [v, setV] = useState(null), avisos = useAvisos();
  const vis = SECCIONES.filter(([, , , m]) => !m || (Array.isArray(m) ? m.some((x) => tiene(yo, x)) : tiene(yo, m)));
  if (v === 'sesiones') return <div className="pila"><Volver alVolver={() => setV(null)} titulo="Cerrar sesión en todos" /><p className="suave">Se cerrará tu sesión en todos los celulares y computadores, incluido este. Tendrás que ingresar de nuevo con tu cédula y contraseña.</p>
    <Boton variante="peligro" icono={LogOut} onClick={async () => { try { await api('salirTodas'); avisos.ok('Sesiones cerradas.'); alSalir(); } catch (e) { avisos.error(e); } }}>Cerrar todas las sesiones</Boton></div>;
  if (v) { const s = SECCIONES.find((x) => x[0] === v); return <div className="pila"><Volver alVolver={() => setV(null)} titulo={s[1]} />
    {v === 'horario' && <MiHorario />}{v === 'comunicados' && <Comunicados alCambiar={alCambiar} />}{v === 'saldos' && <PrestamosCompensatorios yo={yo} />}{v === 'extras' && <MisExtras />}
    {v === 'incapacidad' && <ReportarIncapacidad alListo={() => setV(null)} />}{v === 'certificado' && <Certificado yo={yo} />}{v === 'emergencias' && <Emergencias />}</div>; }
  return <Tarjeta><ul className="lista tocable">{vis.map(([k, t, I, , d]) => <li key={k}><button onClick={() => { setV(k); window.scrollTo(0, 0); }}><I size={22} aria-hidden="true" /><span className="crece"><strong>{t}</strong><span className="suave chico" style={{ display: 'block' }}>{d}</span></span>
    {k === 'comunicados' && pendientesComunicados > 0 && <Insignia tono="aviso">{pendientesComunicados} sin leer</Insignia>}<ChevronRight size={18} aria-hidden="true" /></button></li>)}</ul></Tarjeta>;
}

/* Página pública para quien recibe un certificado */
export function VerificarCertificado() {
  const [f, campo] = useForm({ cedula: '', fecha: hoyISO(), codigo: '' }), [r, setR] = useState(null), [c, setC] = useState(false), [err, setErr] = useState('');
  const ver = async (e) => { e.preventDefault(); setC(true); setErr(''); try { setR(await api('certificadoVerificar', f)); } catch (x) { setErr(x.message); } finally { setC(false); } };
  return <main className="acceso" id="contenido"><form className="acceso-caja pila" onSubmit={ver} noValidate>
    <h1>Verificar un certificado laboral</h1><p className="suave">Escribe los datos tal como aparecen en el certificado.</p>
    <Campo etiqueta="Cédula del trabajador" inputMode="numeric" {...campo('cedula')} /><Campo etiqueta="Fecha del certificado" type="date" {...campo('fecha')} /><Campo etiqueta="Código de verificación" autoCapitalize="characters" maxLength={10} {...campo('codigo')} />
    <Boton type="submit" cargando={c}>Verificar</Boton>
    {err && <Aviso tono="peligro">{err}</Aviso>}
    {r && (r.valido ? <Aviso tono="ok"><strong>Certificado auténtico</strong> expedido por {r.empresa} a nombre de {r.nombre}{r.cargo ? `, ${r.cargo}` : ''}. Al {r.fecha} la persona {r.vigente ? 'estaba vinculada' : 'ya no estaba vinculada'}{r.ingreso ? ` (ingreso ${r.ingreso}${r.retiro ? `, retiro ${r.retiro}` : ''})` : ''}. {r.salario !== null && r.salario !== undefined ? `Salario ${r.salarioTipo === 'diario' ? 'diario (jornal)' : 'mensual'} certificado: $ ${Number(r.salario).toLocaleString('es-CO')}.` : 'El certificado no incluye salario.'} Si el documento que tienes dice otra cosa, fue alterado.</Aviso>
      : <Aviso tono="peligro"><strong>No coincide.</strong> Ese código no corresponde a esa cédula y fecha en {r.empresa}.</Aviso>)}
  </form></main>;
}
export { Bell };
