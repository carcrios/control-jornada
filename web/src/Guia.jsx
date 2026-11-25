// Guía de nómina: se le pregunta con palabras propias (escritas o dictadas) y responde con las reglas
// vigentes que usa el motor de nómina y, al trabajador, con sus propios valores.
import React, { useMemo, useState } from 'react';
import { BookOpen, Send, Volume2 } from 'lucide-react';
import { hablar } from './a11y.jsx';
import { api } from './api.js';
import { Aviso, Boton, Campo, Estado, Insignia, Tarjeta, useAvisos, useCarga } from './ui.jsx';
import { fechaCorta, fechaHora, hoyISO, pesos } from './util.js';

const pc = (x) => `${Math.round(x * 1000) / 10} %`.replace('.', ',');
const CATS = [['pago', 'Mi pago'], ['horas', 'Horas, extras y recargos'], ['marcar', 'Marcar y corregir'], ['permisos', 'Permisos, incapacidades y licencias'], ['prestaciones', 'Prima, cesantías y vacaciones'], ['admin', 'Para el administrador']];

export function preguntas(g) {
  const y = g.yo || {}, vh = y.valorHora || 0, rd = g.recargoDominical, quin = g.periodicidad === 'mensual' ? 'mes' : g.periodicidad === 'semanal' ? 'semana' : 'quincena';
  const tuHora = vh ? ` En tu caso, la hora ordinaria vale ${pesos(vh)}.` : '';
  const L = [
    // Mi pago
    { c: 'pago', p: '¿Cuánto vale mi hora de trabajo?', k: 'valor hora vale cuanto me pagan por hora divisor', r: `El valor de la hora es el salario mensual dividido entre ${g.divisorMensual} (la jornada de ${g.jornadaSemanalH} horas semanales llevada al mes). Si te pagan por día (jornal), es el jornal dividido entre ${Math.round(g.jornadaSemanalH / 6 * 10) / 10}.${tuHora}` },
    { c: 'pago', p: '¿Cuándo me pagan?', k: 'cuando pagan fecha pago dia quincena nomina', r: `La empresa paga por ${quin}. El valor exacto de cada pago está en tu desprendible, en la sección «Pagos», cuando el administrador cierra la nómina.` },
    { c: 'pago', p: '¿Por qué me descuentan salud y pensión?', k: 'descuento descuentan salud pension eps fondo deduccion por que me quitan', r: `La ley obliga a aportar a salud y pensión. A ti te descuentan ${pc(g.pctSalud)} para salud y ${pc(g.pctPension)} para pensión; la empresa pone una parte mayor. Si ganas 4 salarios mínimos o más, también se descuenta el fondo de solidaridad pensional (desde 1 %). El auxilio de transporte no tiene estos descuentos.` },
    { c: 'pago', p: '¿Tengo derecho a auxilio de transporte?', k: 'auxilio transporte subsidio pasaje bus', r: `Lo reciben quienes ganan hasta ${g.topeAuxSmmlv} salarios mínimos (${pesos(g.smmlv * g.topeAuxSmmlv)}). Este año es de ${pesos(g.auxTransporte)} al mes, proporcional a los días trabajados.${y.salario ? (y.conAuxilio ? ' Según tu salario, sí te corresponde.' : ' Según tu salario, no te corresponde.') : ''}` },
    { c: 'pago', p: '¿Cuál es el salario mínimo?', k: 'salario minimo smmlv smlv cuanto es el minimo', r: `El salario mínimo vigente es ${pesos(g.smmlv)} al mes, más ${pesos(g.auxTransporte)} de auxilio de transporte.` },
    { c: 'pago', p: '¿Qué es el «estimado» que veo en la aplicación?', k: 'estimado aproximado llevo ganado proyeccion cuanto llevo', r: 'Es un cálculo con lo que has marcado hasta hoy, con las mismas reglas de la nómina y ya con descuentos. Puede cambiar si te aprueban o rechazan extras, si hay permisos, préstamos o novedades. El valor oficial es el del desprendible.' },
    { c: 'pago', p: 'Mi pago llegó incompleto o creo que hay un error, ¿qué hago?', k: 'error mal pago incompleto me pagaron menos falta plata reclamo reclamar', r: 'Abre tu desprendible en «Pagos» y mira el detalle: horas, extras aprobadas, ausencias y descuentos. Si algo no cuadra, díselo a tu supervisor o al administrador con la fecha. Si la nómina ya se cerró, el ajuste se hace en el siguiente pago como bono o descuento.' },
    { c: 'pago', p: '¿Qué es el desprendible y para qué lo confirmo?', k: 'desprendible colilla volante comprobante confirmar recibido', r: 'Es el comprobante de tu pago: lo que ganaste, lo que te descontaron y lo que te consignaron. Al confirmarlo dejas constancia de que lo viste; si no estás de acuerdo, avísale al administrador antes de confirmarlo.' },
    { c: 'pago', p: '¿Me descuentan si falto?', k: 'falto faltar ausencia no fui no vine descuentan dia dominical', r: 'Un día que no trabajas sin permiso ni incapacidad no se paga. La ley también permite que la empresa descuente el descanso del domingo de esa semana; eso depende de la política de tu empresa. Si faltaste por enfermedad, entrega la incapacidad para que no se cuente como ausencia.' },
    { c: 'pago', p: '¿Qué es un préstamo o libranza y cómo se descuenta?', k: 'prestamo libranza adelanto anticipo cuota descuento', r: 'Si la empresa te prestó dinero, la cuota acordada se descuenta en cada pago y aparece en el desprendible con el saldo que queda. La ley no permite descontar sin tu autorización por escrito.' },
    // Horas, extras, recargos
    { c: 'horas', p: '¿Cuántas horas es la jornada?', k: 'jornada horas semana maxima cuantas horas trabajo 42 ley 2101', r: `La jornada máxima es de ${g.jornadaSemanalH} horas a la semana (Ley 2101 de 2021, vigente desde el 15 de julio de 2026). Es hora extra lo que trabajes por encima de tu horario del día (por ejemplo, después de tu hora de salida) o de las ${g.jornadaSemanalH} horas de la semana.` },
    { c: 'horas', p: '¿Cuánto me pagan una hora extra?', k: 'extra extras hora extra cuanto pagan valor recargo extra diurna nocturna', r: `La hora extra de día se paga con ${pc(g.extraDiurna)} más y la de noche con ${pc(g.extraNocturna)} más.${vh ? ` Para ti: extra de día ${pesos(vh * (1 + g.extraDiurna))} y extra de noche ${pesos(vh * (1 + g.extraNocturna))}.` : ''} Se pagan las extras que te pidieron o que tu jefe sabía que estabas trabajando; la aprobación en la aplicación es para verificarlas.` },
    { c: 'horas', p: '¿Por qué mis horas extra dicen «por aprobar»?', k: 'por aprobar pendiente extras no aprobadas aprobacion rechazo', r: 'Tu jefe revisa las extras para verificarlas. Mientras no las revise aparecen «por aprobar» y todavía no entran al pago. Si te las rechazan y tú sí las trabajaste porque te lo pidieron, envía tu duda a nómina con el día y quién te lo pidió.' },
    { c: 'horas', p: '¿Cuántas horas extra puedo hacer?', k: 'limite maximo extras cuantas extras puedo dia semana', r: `Máximo ${g.maxExtraDiaH} horas extra al día y ${g.maxExtraSemanaH} a la semana. Más que eso es riesgo de fatiga: la aplicación te avisa y le avisa a tu supervisor.` },
    { c: 'horas', p: '¿Desde qué hora es nocturno?', k: 'nocturno noche recargo nocturno desde que hora 7 pm 19', r: `El trabajo nocturno va de ${g.nocheInicio} a ${g.nocheFin} (Ley 2466 de 2025). Cada hora ordinaria en ese horario tiene un recargo de ${pc(g.recargoNocturno)}.${vh ? ` Para ti son ${pesos(vh * g.recargoNocturno)} adicionales por hora.` : ''}` },
    { c: 'horas', p: '¿Cuánto me pagan si trabajo domingo o festivo?', k: 'domingo dominical festivo feriado recargo pagan trabajar domingo', r: `Hoy el recargo por domingo o festivo es de ${pc(rd)} (Ley 2466: 80 % desde el 1 de julio de 2025, 90 % desde el 1 de julio de 2026 y 100 % desde el 1 de julio de 2027). Si trabajas hasta 2 domingos o festivos en el mes (ocasional), se te paga la hora más el recargo, o puedes pedir un día de descanso compensatorio en su lugar.${vh ? ` Para ti, esa hora vale cerca de ${pesos(vh * (1 + rd))}.` : ''} Si trabajas 3 o más en el mes (habitual), se paga el recargo y tienes derecho a un día de descanso compensatorio remunerado en la semana siguiente.` },
    { c: 'horas', p: '¿El almuerzo cuenta como trabajado?', k: 'almuerzo cuenta trabajado no sali a almuerzo descanso comida', r: 'No: el tiempo de almuerzo no se paga. Si no saliste a almorzar porque te lo pidieron, repórtalo con «No salí a almuerzo» y quién lo autorizó; si tu jefe lo aprueba, ese tiempo cuenta como trabajado.' },
    { c: 'horas', p: 'Llegué antes de la hora, ¿me lo cuentan?', k: 'llegue antes temprano antes de la hora cuenta tiempo', r: 'Normalmente no: las horas cuentan desde la hora de entrada del horario, salvo que tu jefe te haya pedido llegar antes y lo apruebe como extra.' },
    { c: 'horas', p: '¿Qué pasa si llego tarde?', k: 'tarde tardanza llegue tarde retraso tolerancia', r: 'La tardanza queda registrada y tu jefe la ve. El tiempo que no trabajaste no suma horas. Hay unos minutos de tolerancia definidos por la obra. Si fue por algo justificado, avísale a tu supervisor.' },
    // Marcar y corregir
    { c: 'marcar', p: 'Se me olvidó marcar, ¿qué hago?', k: 'olvide olvido no marque se me olvido marcar salida entrada corregir', r: 'Usa el botón «Se me olvidó marcar» debajo del botón grande: eliges qué te faltó, la hora y el motivo. Queda como marcación digitada y la revisa tu jefe. Sin la salida, ese día no suma horas.' },
    { c: 'marcar', p: 'Marqué por error, ¿cómo lo deshago?', k: 'error equivoque marque mal deshacer borrar marcacion', r: 'Durante 2 minutos después de marcar aparece «Deshacer». Pasado ese tiempo, pídele el ajuste a tu supervisor o usa «Se me olvidó marcar» si te faltó otra marca.' },
    { c: 'marcar', p: 'No tengo señal, ¿puedo marcar?', k: 'senal internet datos sin conexion offline guardado', r: 'Sí. La marcación queda guardada en tu celular con la hora real y se envía sola cuando vuelva la señal. Verás «Guardado en tu celular». No borres la aplicación ni los datos del navegador mientras haya marcas por enviar.' },
    { c: 'marcar', p: '¿Por qué me pide foto o ubicación?', k: 'foto camara gps ubicacion por que pide', r: 'La ubicación confirma que marcaste en la obra; la foto, que eres tú. Solo se toman al marcar, no te siguen durante el día. Si estás en la obra y dice que estás fuera, avísale a tu supervisor.' },
    { c: 'marcar', p: '¿Quién ve mis datos?', k: 'datos privacidad quien ve informacion habeas data', r: 'Tu información la ven tú, tu supervisor y los administradores de la empresa, para calcular la nómina. Se maneja según la Ley 1581 de 2012; puedes pedir consultar o corregir tus datos al administrador.' },
    // Permisos, incapacidades, licencias
    { c: 'permisos', p: '¿Qué permisos son pagados?', k: 'permiso pagado remunerado cita medica calamidad luto votar', r: 'Por ley son pagados, entre otros: cita médica de urgencia o con especialista, calamidad doméstica, licencia de luto (5 días hábiles), votar (media jornada), jurado de votación, citación judicial y reuniones escolares como acudiente. Una cita médica general o un permiso personal por otra razón normalmente no se paga, salvo acuerdo con la empresa.' },
    { c: 'permisos', p: '¿Cómo pido un permiso?', k: 'pedir permiso solicitar como pido', r: 'En «Permisos» → «Pedir permiso»: eliges para qué, cuándo y envías. Tu jefe lo aprueba; cuando llegue el día, aparece el botón «Salir a mi permiso».' },
    { c: 'permisos', p: 'Estoy incapacitado, ¿cuánto me pagan?', k: 'incapacidad enfermo enfermedad incapacitado eps arl accidente', r: `Por enfermedad general se paga el ${pc(g.pctIncapGeneral)} del salario (nunca menos del mínimo diario): los dos primeros días los paga la empresa y desde el tercero la EPS. Desde el día 91 (contando las prórrogas seguidas) es el 50 %. Si es accidente de trabajo o enfermedad laboral, el día del accidente lo paga la empresa y desde el día siguiente la ARL al 100 %. Entrega la incapacidad al administrador para que no cuente como ausencia.` },
    { c: 'permisos', p: '¿Cuánto dura la licencia de maternidad y la de paternidad?', k: 'maternidad paternidad licencia bebe hijo nacimiento', r: 'La de maternidad es de 18 semanas y la de paternidad de 2 semanas (Ley 2114 de 2021), pagadas por la EPS. Avísale al administrador con tiempo y entrega el registro civil o la certificación médica.' },
    { c: 'permisos', p: '¿Qué es la calamidad doméstica?', k: 'calamidad domestica grave familia emergencia casa', r: 'Es un hecho grave que te obliga a atender a tu familia o tu casa: enfermedad grave de un familiar, inundación, incendio, etc. Es un permiso pagado; puedes pedirlo aunque ya haya pasado y entregar el soporte después.' },
    // Prestaciones
    { c: 'prestaciones', p: '¿Cuándo me pagan la prima?', k: 'prima servicios junio diciembre cuando pagan', r: 'La prima es un mes de salario por año, pagado en dos partes: la primera a más tardar el 30 de junio y la segunda antes del 20 de diciembre. Si trabajaste menos tiempo, se paga en proporción. Incluye el auxilio de transporte si te corresponde.' },
    { c: 'prestaciones', p: '¿Qué son las cesantías?', k: 'cesantias fondo intereses febrero', r: 'Son un mes de salario por cada año trabajado. La empresa las consigna en tu fondo de cesantías antes del 14 de febrero. Además te paga directamente los intereses (12 % al año) antes del 31 de enero. Sirven para vivienda, estudio o cuando termina el contrato.' },
    { c: 'prestaciones', p: '¿Cuántos días de vacaciones tengo?', k: 'vacaciones dias descanso cuantos', r: 'Son 15 días hábiles pagados por cada año trabajado. Se piden con tu jefe y se pueden pedir en «Permisos» → Vacaciones. Si sales de la empresa sin haberlas tomado, te las pagan en la liquidación.' },
    { c: 'prestaciones', p: '¿Me dan dotación?', k: 'dotacion ropa botas uniforme overol', r: 'Si ganas hasta 2 salarios mínimos y llevas más de 3 meses, la empresa te entrega dotación (ropa y calzado de trabajo) tres veces al año: hasta el 30 de abril, el 31 de agosto y el 20 de diciembre.' },
    { c: 'prestaciones', p: '¿Qué me pagan si me retiro o me despiden?', k: 'liquidacion retiro renuncia despido terminar contrato salir de la empresa indemnizacion', r: 'En la liquidación te pagan lo que falte de salario, cesantías e intereses, prima y vacaciones no tomadas, en proporción al tiempo. Si te despiden sin justa causa también hay indemnización. Deben pagarte al terminar; si se demoran, la ley castiga el retraso.' },
    { c: 'prestaciones', p: '¿Cómo saco un certificado laboral?', k: 'certificado laboral constancia carta trabajo', r: 'En «Más» → Certificado laboral lo descargas tú mismo, con un código para que quien lo reciba pueda verificarlo.' },
    // Admin
    { c: 'admin', a: 1, p: '¿Cómo cierro la nómina?', k: 'cerrar nomina pasos cierre quincena', r: 'En «Nómina» sigue los pasos 1 a 4: revisa «Antes de cerrar» y resuelve lo marcado en rojo (jornadas sin salida, extras o almuerzos sin decidir, permisos pendientes, salarios sin validar), revisa la vista previa y cierra. Al cerrar se generan los desprendibles.' },
    { c: 'admin', a: 1, p: 'Ya cerré la nómina y hay un error, ¿qué hago?', k: 'error despues cerrar nomina cerrada corregir reabrir ajuste', r: 'Los días de una nómina cerrada no se cambian, para que coincidan con lo pagado. Registra la diferencia como bono o descuento en la siguiente quincena, con la explicación; queda en la auditoría.' },
    { c: 'admin', a: 1, p: '¿Cómo apruebo las horas extra?', k: 'aprobar extras horas extra aprobacion jefe', r: 'En «Horas extra» ves las calculadas por persona y día. Apruébalas completas, en parte o recházalas. Solo lo aprobado entra a la nómina. Puedes pagarlas o pasarlas a descanso compensatorio.' },
    { c: 'admin', a: 1, p: '¿Cómo le paso la nómina al contador?', k: 'contador exportar excel nomina electronica pila', r: 'En «Nómina», en «Periodos cerrados», descarga el Excel con devengados, deducciones y neto por persona (abre el periodo y toca «Excel»). Ese archivo es la base para la nómina electrónica y la planilla PILA que hace tu contador o tu software contable.' },
    { c: 'admin', a: 1, p: '¿De dónde salen las cifras legales (mínimo, recargos)?', k: 'cifras legales actualizar minimo recargos configuracion enero', r: `De «Configuración» → «Parámetros legales». Hoy: mínimo ${pesos(g.smmlv)}, auxilio ${pesos(g.auxTransporte)}, jornada ${g.jornadaSemanalH} h, recargo dominical ${pc(rd)}. Cada enero actualiza el mínimo y el auxilio cuando salga el decreto.` },
    { c: 'admin', a: 1, p: '¿Cómo hago la liquidación de alguien que se retira?', k: 'liquidacion retiro trabajador final contrato terminar', r: 'En «Nómina» → «Liquidación de contrato»: eliges la persona, la fecha y la causa, y la aplicación calcula salario pendiente, cesantías, intereses, prima, vacaciones e indemnización si aplica. Revísala con tu contador antes de pagar.' }
  ];
  return L.filter((x) => !x.a || y.rol === 'admin' || y.rol === 'supervisor');
}

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ');
const VACIAS = new Set('el la los las de del que y o a en mi me por para con un una es se si no cuanto como cual cuando que porque hay tengo puedo lo le al'.split(' '));
const raiz = (w) => w.slice(0, 5);
export function buscarRespuesta(lista, q) {
  const pal = norm(q).split(/\s+/).filter((w) => w.length > 2 && !VACIAS.has(w)).map(raiz); if (!pal.length) return [];
  return lista.map((x) => { const t = new Set(norm(x.p + ' ' + x.k).split(/\s+/).filter(Boolean).map(raiz)); return { x, s: pal.filter((w) => t.has(w)).length / pal.length }; })
    .filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map((r) => r.x);
}

function Respuesta({ x, abierta }) {
  return <details className="respuesta-guia" open={abierta}><summary>{x.p}</summary><p>{x.r}</p>
    <Boton chico variante="texto" icono={Volume2} onClick={() => hablar(x.p + '. ' + x.r, true)}>Leer en voz alta</Boton></details>;
}
const TEMAS = [['pago', 'Mi pago no cuadra'], ['extras', 'Horas extra'], ['descuento', 'Un descuento'], ['marcacion', 'Una marcación'], ['otro', 'Otra duda o novedad']];
// El trabajador le escribe a la persona de nómina y ve la respuesta aquí mismo
function EnviarNovedad({ inicial }) {
  const [abierto, setAbierto] = useState(false), [f, setF] = useState({ tema: '', fecha: '', texto: '' }), [env, setEnv] = useState(false), avisos = useAvisos();
  const mias = useCarga(() => api('consultasMias'), []);
  const abrir = () => { setF({ tema: '', fecha: '', texto: inicial && inicial.trim().length > 2 ? inicial.trim() : '' }); setAbierto(true); };
  const enviar = async () => { setEnv(true); try { await api('consultaCrear', f); avisos.ok('Enviado a la persona de nómina. La respuesta te llega aquí y en «Más» → Comunicados.', 8000); setAbierto(false); mias.recargar(true); } catch (e) { avisos.error(e); } finally { setEnv(false); } };
  return <section className="pila enviar-novedad" aria-label="Enviar a nómina">
    {!abierto ? <Boton ancho variante="secundario" icono={Send} onClick={abrir}>¿No encontraste la respuesta? Envía tu duda o novedad a nómina</Boton>
      : <Tarjeta titulo="Enviar a la persona de nómina"><div className="pila">
        <fieldset><legend className="etiqueta">¿Sobre qué es?</legend><div className="opciones-grandes">{TEMAS.map(([k, t]) => <button key={k} type="button" aria-pressed={f.tema === k} onClick={() => setF({ ...f, tema: k })}>{t}</button>)}</div></fieldset>
        <Campo etiqueta="Día al que se refiere (opcional)" type="date" max={hoyISO()} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        <Campo como="textarea" rows={4} maxLength={800} etiqueta="Cuéntalo con tus palabras" ayuda="Puedes dictarlo con el micrófono. Ej.: el lunes trabajé 2 horas extra y no me aparecen." value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} />
        <div className="acciones-hoja"><Boton variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Boton><Boton icono={Send} cargando={env} disabled={!f.tema || f.texto.trim().length < 8} onClick={enviar}>Enviar</Boton></div>
      </div></Tarjeta>}
    {(mias.datos || []).length > 0 && <div className="pila junta"><h3 className="etiqueta">Lo que has enviado</h3>{mias.datos.map((x) => <div key={x.id} className="respuesta-guia" style={{ padding: 12 }}>
      <div className="fila entre"><strong>{x.tema}{x.fecha ? ` · ${fechaCorta(x.fecha)}` : ''}</strong><Insignia tono={x.estado === 'respondida' ? 'ok' : 'aviso'}>{x.estado === 'respondida' ? 'Respondida' : 'Esperando respuesta'}</Insignia></div>
      <p className="suave chico">{x.texto}</p>{x.respuesta && <Aviso tono="ok"><strong>Respuesta:</strong> {x.respuesta}</Aviso>}</div>)}</div>}
  </section>;
}
// Bandeja de la persona de nómina: responde y la respuesta le llega al trabajador
export function ConsultasAdmin() {
  const [todas, setTodas] = useState(false), carga = useCarga(() => api('adminConsultas', { todas }), [todas]), [resp, setResp] = useState({}), [env, setEnv] = useState(''), avisos = useAvisos();
  const responder = async (id) => { setEnv(id); try { await api('adminConsultaResponder', { id, respuesta: resp[id] }); avisos.ok('Respuesta enviada al trabajador.'); setResp({ ...resp, [id]: '' }); carga.recargar(true); } catch (e) { avisos.error(e); } finally { setEnv(''); } };
  return <Tarjeta titulo="Dudas de trabajadores" accion={<Boton chico variante="texto" onClick={() => setTodas(!todas)}>{todas ? 'Ver solo las abiertas' : 'Ver también las respondidas'}</Boton>}>
    <Estado carga={carga} lineas={3}>{(l) => !l.length ? <p className="suave">{todas ? 'No hay dudas enviadas.' : 'No hay dudas por responder.'}</p> : <div className="pila">{l.map((x) => <div key={x.id} className="respuesta-guia" style={{ padding: 12 }}>
      <div className="fila entre"><strong>{x.nombre}</strong><span className="suave chico">{fechaHora(x.creado)}</span></div>
      <div className="chico"><Insignia tono="info">{x.tema}</Insignia>{x.fecha ? ` Día ${fechaCorta(x.fecha)}` : ''}</div>
      <p>{x.texto}</p>
      {x.estado === 'respondida' ? <Aviso tono="ok"><strong>Respondida:</strong> {x.respuesta}</Aviso> : <>
        <Campo como="textarea" rows={2} maxLength={800} etiqueta={`Respuesta para ${x.nombre.split(' ')[0]}`} value={resp[x.id] || ''} onChange={(e) => setResp({ ...resp, [x.id]: e.target.value })} />
        <div className="fila fin"><Boton chico icono={Send} cargando={env === x.id} disabled={(resp[x.id] || '').trim().length < 3} onClick={() => responder(x.id)}>Responder</Boton></div></>}
    </div>)}</div>}</Estado>
  </Tarjeta>;
}
export default function Guia({ enviar }) {
  const carga = useCarga(() => api('guiaNomina'), []), [q, setQ] = useState(''), [cat, setCat] = useState('');
  return <><Estado carga={carga} lineas={6}>{(g) => <GuiaContenido g={g} q={q} setQ={setQ} cat={cat} setCat={setCat} />}</Estado>{enviar && <div style={{ marginTop: 16 }}><EnviarNovedad inicial={q} /></div>}</>;
}
function GuiaContenido({ g, q, setQ, cat, setCat }) {
  const lista = useMemo(() => preguntas(g), [g]), res = useMemo(() => (q.trim().length > 2 ? buscarRespuesta(lista, q) : null), [lista, q]);
  const cats = CATS.filter(([k]) => lista.some((x) => x.c === k));
  return <div className="pila guia">
    <Campo etiqueta="Escribe o dicta tu pregunta" placeholder="Ej.: ¿cuánto me pagan un domingo?" value={q} onChange={(e) => setQ(e.target.value)} />
    {res && (res.length ? <section aria-live="polite" aria-label="Respuestas"><h3 className="etiqueta">Esto puede responder tu pregunta</h3>{res.map((x, i) => <Respuesta key={x.p} x={x} abierta={i === 0} />)}</section>
      : <p className="suave" role="status">No encontré esa pregunta. Prueba con otras palabras (por ejemplo «extras», «prima», «incapacidad») o pregúntale al administrador.</p>)}
    {!res && <>
      <div className="fila" role="group" aria-label="Temas">{cats.map(([k, t]) => <Boton key={k} chico variante={cat === k ? 'primario' : 'secundario'} aria-pressed={cat === k} onClick={() => setCat(cat === k ? '' : k)}>{t}</Boton>)}</div>
      {(cat ? lista.filter((x) => x.c === cat) : lista.filter((x) => x.c === 'pago').concat(lista.filter((x) => x.c === 'horas').slice(0, 3))).map((x) => <Respuesta key={x.p} x={x} />)}
    </>}
    <p className="suave chico"><BookOpen size={14} aria-hidden="true" /> Respuestas generales con las reglas vigentes en la configuración de la empresa. Para tu caso exacto manda tu desprendible y lo que diga el administrador.</p>
  </div>;
}
