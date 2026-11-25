/* ---------- Puesta en marcha: plantillas de horario, importación con revisión previa y asistente de 5 pasos ---------- */
import React, { useMemo, useState } from 'react';
import { Building2, CheckCircle2, ClipboardList, Download, PartyPopper, Upload, Users } from 'lucide-react';
import { api, conexion } from './api.js';
import { Aviso, Boton, Campo, Insignia } from './ui.jsx';
import { aExcel, useAccion } from './Admin.jsx';

/* Plantillas que cumplen la jornada de 42 h semanales (Ley 2101 de 2021) */
const LV = [1, 2, 3, 4, 5], LS = [1, 2, 3, 4, 5, 6];
const arma = (dias, e, s, ai, af) => Object.fromEntries(dias.map((d) => [d, { e, s, ...(ai ? { ai, af } : {}) }]));
export const PLANTILLAS = [
  { id: 'lv-obra', nombre: 'Lunes a viernes 7:00 a 4:24 p. m.', detalle: 'Almuerzo de 12 a 1 · 42 h', horario: arma(LV, '07:00', '16:24', '12:00', '13:00') },
  { id: 'ls-obra', nombre: 'Lunes a sábado 7:00 a 3:00 p. m.', detalle: 'Almuerzo de 12 a 1 · 42 h', horario: arma(LS, '07:00', '15:00', '12:00', '13:00') },
  { id: 'lv-oficina', nombre: 'Oficina lunes a viernes 8:00 a 5:24 p. m.', detalle: 'Almuerzo de 12:30 a 1:30 · 42 h', horario: arma(LV, '08:00', '17:24', '12:30', '13:30') },
  { id: 'ls-corrido', nombre: 'Jornada corrida lunes a sábado 6:00 a 1:00 p. m.', detalle: 'Sin almuerzo · 42 h', horario: arma(LS, '06:00', '13:00') },
  { id: 'lv-sab', nombre: 'Lunes a viernes 7 a 4 y sábado 7 a 11', detalle: 'Almuerzo de 12 a 1 entre semana · 42 h', horario: { ...arma(LV, '07:00', '15:36', '12:00', '13:00'), 6: { e: '07:00', s: '11:00' } } }
];
export function SelectorPlantilla({ alElegir, compacto }) {
  return <div className={compacto ? '' : 'pila junta'}>
    <Campo como="select" etiqueta="Usar una plantilla de horario" value="" onChange={(e) => { const p = PLANTILLAS.find((x) => x.id === e.target.value); if (p) alElegir(JSON.parse(JSON.stringify(p.horario)), p); }}>
      <option value="">Elige una plantilla…</option>{PLANTILLAS.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.detalle})</option>)}</Campo>
  </div>;
}

/* Importación desde Excel con revisión antes de guardar: detecta columnas, duplicados y datos incompletos */
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const COLS = { cedula: ['cedula', 'documento', 'identificacion', 'cc', 'nit'], nombre: ['nombre', 'trabajador', 'empleado', 'colaborador'], cargo: ['cargo', 'oficio', 'puesto'],
  salario: ['salario', 'sueldo', 'basico', 'jornal'], email: ['correo', 'email', 'e-mail'], telefono: ['telefono', 'celular', 'movil', 'whatsapp'], ingreso: ['ingreso', 'fecha de ingreso', 'inicio'], centro: ['centro', 'obra', 'sede', 'proyecto'] };
export async function leerExcelPersonas(archivo, centros, existentes = []) {
  const XLSX = await import('xlsx'), wb = XLSX.read(await archivo.arrayBuffer(), { cellDates: true }), crudo = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  if (!crudo.length) return { error: 'El archivo está vacío.' };
  const cabeceras = Object.keys(crudo[0]), mapa = {};
  Object.entries(COLS).forEach(([k, alias]) => { const c = cabeceras.find((h) => alias.some((a) => norm(h) === a)) || cabeceras.find((h) => alias.some((a) => norm(h).includes(a))); if (c) mapa[k] = c; });
  if (!mapa.cedula || !mapa.nombre) return { error: `No encontré las columnas de cédula y nombre. Columnas del archivo: ${cabeceras.join(', ')}.` };
  const vistos = {}, yaExiste = new Set(existentes.map((u) => u.cedula));
  const filas = crudo.map((o, i) => {
    const v = (k) => (mapa[k] ? o[mapa[k]] : ''), ced = String(v('cedula')).replace(/\D/g, ''), centroTxt = String(v('centro')).trim();
    const centro = centros.find((c) => norm(c.nombre) === norm(centroTxt)) || (centros.length === 1 ? centros[0] : null);
    let ing = v('ingreso'); ing = ing instanceof Date ? ing.toISOString().slice(0, 10) : /^\d{4}-\d\d-\d\d/.test(String(ing)) ? String(ing).slice(0, 10) : '';
    const f = { fila: i + 2, cedula: ced, nombre: String(v('nombre')).trim().replace(/\s+/g, ' '), cargo: String(v('cargo')).trim(), salario: +String(v('salario')).replace(/[^\d]/g, '') || 0,
      email: String(v('email')).trim(), telefono: String(v('telefono')).replace(/\D/g, ''), ingreso: ing, centroId: centro?.id || '', centroTxt };
    const avisos = [];
    if (ced.length < 5 || ced.length > 12) avisos.push('cédula no válida');
    if (f.nombre.split(' ').length < 2) avisos.push('falta el apellido');
    if (vistos[ced]) avisos.push(`repetida (también en la fila ${vistos[ced]})`); else vistos[ced] = f.fila;
    if (!f.salario) avisos.push('sin salario');
    if (!f.centroId) avisos.push(centroTxt ? `la obra «${centroTxt}» no existe` : 'sin obra');
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) avisos.push('correo no válido');
    return { ...f, avisos, grave: avisos.some((a) => a.startsWith('cédula') || a.startsWith('repetida')), actualiza: yaExiste.has(ced) };
  }).filter((f) => f.cedula || f.nombre);
  return { filas, columnas: mapa };
}
export function RevisionImportacion({ datos, alImportar, alCancelar, ocupado }) {
  const validas = datos.filas.filter((f) => !f.grave), conAviso = datos.filas.filter((f) => f.avisos.length);
  return <div className="pila">
    <p>Reconocí estas columnas: {Object.entries(datos.columnas).map(([k, v]) => <Insignia key={k} tono="info">{k} ← {v}</Insignia>)}</p>
    <div className="fila" style={{ gap: 8 }}><Insignia tono="ok">{validas.filter((f) => !f.actualiza).length} nuevas</Insignia><Insignia tono="info">{validas.filter((f) => f.actualiza).length} ya existen (se actualizan)</Insignia>
      {conAviso.length > 0 && <Insignia tono="aviso">{conAviso.length} con avisos</Insignia>}{datos.filas.length - validas.length > 0 && <Insignia tono="peligro">{datos.filas.length - validas.length} no se importan</Insignia>}</div>
    {conAviso.length > 0 && <ul className="lista">{conAviso.slice(0, 40).map((f) => <li key={f.fila}><span className="crece"><strong>Fila {f.fila}: {f.nombre || '(sin nombre)'}</strong> <span className="suave">{f.cedula}</span>
      <div className="chico" style={{ color: f.grave ? 'var(--c-peligro)' : 'var(--c-texto-2)' }}>{f.grave ? 'No se importa: ' : ''}{f.avisos.join(' · ')}</div></span></li>)}</ul>}
    {conAviso.some((f) => !f.grave) && <p className="suave chico">Las filas con avisos menores se importan igual; completa lo que falte después en Personal.</p>}
    <div className="acciones-hoja"><Boton variante="secundario" onClick={alCancelar}>Cancelar</Boton><Boton icono={Upload} cargando={ocupado} disabled={!validas.length} onClick={() => alImportar(validas.map(({ fila, avisos, grave, actualiza, centroTxt, ...x }) => x))}>Importar {validas.length} persona(s)</Boton></div>
  </div>;
}
export function plantillaExcel() {
  aExcel({ Personal: [{ 'Cédula': '1020333444', Nombre: 'Pedro Pérez Gómez', Cargo: 'Oficial de obra', Salario: 1750905, Celular: '3001234567', Correo: '', 'Fecha de ingreso': '2026-01-15', Obra: 'Nombre de la obra' }] }, 'plantilla-personal.xlsx');
}

/* Asistente de puesta en marcha: aparece mientras la empresa no tenga obras o personas */
export function Asistente({ yo, centros, alTerminar, alSaltar }) {
  const [paso, setPaso] = useState(centros.length ? 2 : 0), [correr, ocupado] = useAccion();
  const [emp, setEmp] = useState({ nombre: yo?.cfg?.empresa?.nombre === 'Mi empresa' ? '' : yo?.cfg?.empresa?.nombre || '', nit: yo?.cfg?.empresa?.nit || '', telefono: yo?.cfg?.empresa?.telefono || '' });
  const [obra, setObra] = useState({ nombre: '', direccion: '', plantilla: PLANTILLAS[0].id, tol: 5 });
  const [obraId, setObraId] = useState(centros[0]?.id || ''), [imp, setImp] = useState(null), [creados, setCreados] = useState([]), [manual, setManual] = useState({ cedula: '', nombre: '', cargo: '', salario: '' });
  const PASOS = [['Empresa', Building2], ['Primera obra', ClipboardList], ['Horario', ClipboardList], ['Personal', Users], ['Listo', CheckCircle2]];
  const plant = useMemo(() => PLANTILLAS.find((p) => p.id === obra.plantilla), [obra.plantilla]);
  const guardarEmpresa = async () => { if (await correr(() => api('adminConfigGuardar', { empresa: { ...(yo?.cfg?.empresa || {}), ...emp } }))) setPaso(1); };
  const guardarObra = async () => { const r = await correr(() => api('adminCentroGuardar', { nombre: obra.nombre, direccion: obra.direccion, radio: 150, tol: +obra.tol || 5, horario: plant.horario, activo: true })); if (r) { setObraId(r.id || r.centro?.id || ''); setPaso(3); } };
  const importar = async (filas) => { const r = await correr(() => api('adminPersonaImportar', { filas: filas.map((f) => ({ ...f, centroId: f.centroId || obraId })) }, { espera: 120000 })); if (r) { setCreados((c) => [...c, ...r.filter((x) => x.codigo)]); setImp(null); } };
  const agregar = async () => { const r = await correr(() => api('adminPersonaGuardar', { ...manual, salario: +manual.salario || 0, centroId: obraId, rol: 'trabajador' })); if (r) { setCreados((c) => [...c, { cedula: manual.cedula, nombre: manual.nombre, codigo: r.codigo }]); setManual({ cedula: '', nombre: '', cargo: '', salario: '' }); } };
  return <div className="asistente">
    <ol className="asistente-pasos" aria-label="Pasos de la puesta en marcha">{PASOS.map(([t, I], i) => <li key={t} className={i < paso ? 'hecho' : i === paso ? 'actual' : ''} aria-current={i === paso ? 'step' : undefined}><span>{i < paso ? '✓' : i + 1}</span>{t}</li>)}</ol>
    <section className="tarjeta asistente-cuerpo">
      {paso === 0 && <div className="pila"><h2>Datos de tu empresa</h2><p className="suave">Aparecen en desprendibles, certificados y en la pantalla de ingreso.</p>
        <Campo etiqueta="Nombre de la empresa" value={emp.nombre} onChange={(e) => setEmp({ ...emp, nombre: e.target.value })} />
        <div className="rejilla"><Campo etiqueta="NIT" value={emp.nit} onChange={(e) => setEmp({ ...emp, nit: e.target.value })} /><Campo etiqueta="Teléfono" type="tel" value={emp.telefono} onChange={(e) => setEmp({ ...emp, telefono: e.target.value })} /></div>
        <div className="fila fin"><Boton cargando={ocupado} disabled={emp.nombre.trim().length < 3} onClick={guardarEmpresa}>Siguiente</Boton></div></div>}
      {paso === 1 && <div className="pila"><h2>Tu primera obra o sede</h2><p className="suave">Donde marca la gente. Luego puedes agregar más y su ubicación exacta (el supervisor la puede fijar desde su celular parado en la obra).</p>
        <Campo etiqueta="Nombre de la obra" placeholder="Ej.: Torre Calle 80" value={obra.nombre} onChange={(e) => setObra({ ...obra, nombre: e.target.value })} />
        <Campo etiqueta="Dirección (opcional)" value={obra.direccion} onChange={(e) => setObra({ ...obra, direccion: e.target.value })} />
        <div className="fila entre"><Boton variante="texto" onClick={() => setPaso(0)}>Atrás</Boton><Boton disabled={obra.nombre.trim().length < 3} onClick={() => setPaso(2)}>Siguiente</Boton></div></div>}
      {paso === 2 && <div className="pila"><h2>Horario de la obra</h2><p className="suave">Elige el más parecido; después lo ajustas día por día en Obras y sedes.</p>
        <div className="plantillas" role="radiogroup" aria-label="Plantillas de horario">{PLANTILLAS.map((p) => <button type="button" key={p.id} role="radio" aria-checked={obra.plantilla === p.id} className={`plantilla ${obra.plantilla === p.id ? 'activa' : ''}`} onClick={() => setObra({ ...obra, plantilla: p.id })}><strong>{p.nombre}</strong><span>{p.detalle}</span></button>)}</div>
        <Campo etiqueta="Minutos de tolerancia para llegar" type="number" min="0" max="60" value={obra.tol} onChange={(e) => setObra({ ...obra, tol: e.target.value })} ayuda="Llegar dentro de esta tolerancia no cuenta como tarde." />
        {centros.length > 0 && !obra.nombre && <Aviso tono="info">Ya tienes obras creadas: este paso se salta.</Aviso>}
        <div className="fila entre"><Boton variante="texto" onClick={() => setPaso(1)}>Atrás</Boton>{centros.length > 0 && !obra.nombre ? <Boton onClick={() => setPaso(3)}>Siguiente</Boton> : <Boton cargando={ocupado} onClick={guardarObra}>Crear la obra</Boton>}</div></div>}
      {paso === 3 && <div className="pila"><h2>Tu personal</h2><p className="suave">Sube tu Excel (la app reconoce las columnas y te avisa de cédulas repetidas o datos incompletos antes de guardar) o agrega personas una por una.</p>
        {imp ? (imp.error ? <><Aviso tono="peligro">{imp.error}</Aviso><Boton variante="secundario" onClick={() => setImp(null)}>Intentar con otro archivo</Boton></> : <RevisionImportacion datos={imp} ocupado={ocupado} alImportar={importar} alCancelar={() => setImp(null)} />) : <>
          <div className="fila" style={{ gap: 8 }}><label className="btn"><Upload size={20} aria-hidden="true" />Subir Excel<input type="file" accept=".xlsx,.xls,.csv" className="oculto-visual" onChange={async (e) => { const a = e.target.files[0]; e.target.value = ''; if (a) setImp(await leerExcelPersonas(a, centros.length ? centros : [{ id: obraId, nombre: obra.nombre }], [])); }} /></label>
            <Boton variante="secundario" icono={Download} onClick={plantillaExcel}>Descargar plantilla de Excel</Boton></div>
          <details><summary className="etiqueta" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>O agrégalas una por una</summary>
            <div className="rejilla"><Campo etiqueta="Cédula" inputMode="numeric" value={manual.cedula} onChange={(e) => setManual({ ...manual, cedula: e.target.value.replace(/\D/g, '') })} /><Campo etiqueta="Nombre completo" value={manual.nombre} onChange={(e) => setManual({ ...manual, nombre: e.target.value })} />
              <Campo etiqueta="Cargo" value={manual.cargo} onChange={(e) => setManual({ ...manual, cargo: e.target.value })} /><Campo etiqueta="Salario mensual" inputMode="numeric" value={manual.salario} onChange={(e) => setManual({ ...manual, salario: e.target.value.replace(/\D/g, '') })} /></div>
            <Boton variante="secundario" cargando={ocupado} disabled={manual.cedula.length < 5 || manual.nombre.trim().split(' ').length < 2} onClick={agregar}>Agregar</Boton></details>
          {creados.length > 0 && <Aviso tono="ok">{creados.length} persona(s) listas para activar su cuenta.</Aviso>}
          <div className="fila entre"><Boton variante="texto" onClick={() => setPaso(2)}>Atrás</Boton><Boton onClick={() => setPaso(4)}>{creados.length ? 'Siguiente' : 'Lo hago después'}</Boton></div></>}</div>}
      {paso === 4 && <div className="pila" style={{ textAlign: 'center' }}><PartyPopper size={48} aria-hidden="true" style={{ margin: '0 auto', color: 'var(--c-primario)' }} /><h2>¡Listo para marcar!</h2>
        <p>Comparte este enlace con tu personal. Cada persona entra con su cédula y el código de activación{creados.length ? ' (descárgalos abajo)' : ''}.</p>
        <p className="tarjeta hundida" style={{ wordBreak: 'break-all' }}><strong>{conexion.enlace()}</strong></p>
        <div className="fila" style={{ justifyContent: 'center', gap: 8 }}>
          {creados.length > 0 && <Boton variante="secundario" icono={Download} onClick={() => aExcel({ 'Códigos': creados.map((r) => ({ 'Cédula': r.cedula, Nombre: r.nombre, 'Código de activación': r.codigo })) }, 'codigos-activacion.xlsx')}>Descargar códigos</Boton>}
          <a className="btn secundario" href={`https://wa.me/?text=${encodeURIComponent('Para marcar tu jornada entra aquí: ' + conexion.enlace())}`} target="_blank" rel="noreferrer">Compartir por WhatsApp</a>
          <Boton onClick={alTerminar}>Ir al panel</Boton></div></div>}
    </section>
    {paso < 4 && <p style={{ textAlign: 'center' }}><Boton variante="texto" chico onClick={alSaltar}>Saltar el asistente (lo puedo configurar yo mismo)</Boton></p>}
  </div>;
}
