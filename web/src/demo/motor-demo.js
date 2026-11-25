import { crearBackend } from './backend.js';

const CLAVE = 'cj.demo.v1';
export const demo = { gps: 'obra', camara: 'normal', X: null };
const leerLS = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const ponerLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const bogota = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value])); return { fecha: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute }; };
export const guardar = () => ponerLS(CLAVE, demo.X.estado());
export function reiniciar() { try { Object.keys(localStorage).filter((k) => k.startsWith('cj.')).forEach((k) => localStorage.removeItem(k)); } catch { /* sin almacenamiento */ } location.hash = '#/'; location.reload(); }

function sembrar(X) {
  const { S, api } = X, M = S.Motor, ok = (r) => { if (!r.ok) throw new Error(r.e + ': ' + r.m); return r.d; };
  const hora = (f, h) => S.ahora(new Date(`${f}T${h}:00-05:00`).toISOString()), { fecha: hoy, min } = bogota();
  const dias = []; for (let f = M.sumar(hoy, -1); dias.length < 9; f = M.sumar(f, -1)) { const w = M.dow(f); if (w >= 1 && w <= 5 && !M.esFestivo(f)) dias.unshift(f); }
  let sig = M.sumar(hoy, 1); while (M.dow(sig) === 0 || M.dow(sig) === 6 || M.esFestivo(sig)) sig = M.sumar(sig, 1);
  const C = { datos: true, sensibles: true }, G1 = { lat: 4.65, lng: -74.1, prec: 12 }, G2 = { lat: 4.71, lng: -74.2, prec: 10 }, H = { e: '07:00', s: '16:24', ai: '12:00', af: '13:00' };
  hora(M.sumar(dias[0], -3), '06:00'); S.instalar();
  const adm = ok(api('registro', { cedula: '79000001', codigo: X.props.CODIGO_ADMIN, clave: 'demo2026', nombre: 'Andrea Rojas', salario: 5200000, consentimiento: C, email: 'andrea@montajesandinos.co' })).token;
  ok(api('adminConfigGuardar', { empresa: { nombre: 'Montajes Andinos S.A.S.', logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAADEElEQVR42u3bsVXcQBRGYekdYnKX4JQyKIESXJA7MB1AGbRBbAKnOCLB+BiDpDej/7sFsNLM1X1arVgWAAAApLGOcBCX1zfPtqKHp/vbNU5AwhHycAFJR8bDBSQdGf9FkQ+d+7kSD501LPKhc59X4qGzhkU+dO5/kQ+dEhb50ClhkQ+dEhb50ClhkQ+dEpblQielfuisYJEPnRIawRh7BKsf9qxgkQ+dEhrBmONbMHCogMYvjhjDCggjGAQ0ftEyhhUQRjAICIwhoPs/HHkfqIAwgkFAgIAgIEBAEBAgIAgIEBAEBAgIAsbw8+6HRSBgr3wkJCAImD16VZCAIGD2Fw8VJCAImP3YRQUJ2P7Mj4QEBAGzf/FQQQKCgNm/96ogAUHA7LddVJCA7fKQkIAgYPaLpipIQBAw+zV7FSQgCJj9T0Yq+DEuUk70193XAz7lilEK+CeP3x5O9TkEJB8JCQgCql/b556ltArowiLgGTdJBRXQhUXA7E3a+jje+nuzC6mAikVAG/6585r5nIt84x/XmStqBJ/koppV0lI/x0dAbCLtjJKX+o15nCnFVEBPAQiYtODvOd6k+8Ui3/me6c20LkYwCJj4WGPv33VnWR8FdEERMHWzXs5jr/OZYZ0UEARMHlV7n8/o61U2CwRE7IVbFhEEROwFXBYPBETshVwWDQRE7AVdFgsEJF/s2hrBIKD65a6xAoKA6pe71goIAqpf7pqXhQABEXvxl/pBAREbgVI/KCBiK1jqBwVEbAVL/RBXQPKpoBGMzAKqnwoqIDILqH4qqIDILKD6qeBbXBx1Il++X9lNGMEgIPB3AZ/ub1fLgr147ZcCwggGAYFxBHQfiCPu/xQQRjAIuBjD6Bi/CggjGARcjGF0jN93FZCE2Es+Ixhz3AOqIPao338VkITYWj4jGHM9hlFBbO1J7fnHQb5dRjAJsZUXdeSHgXybfgkhIT7rQXV+OLLlW5Zl2VSey+ubZ1tCvLa3YdSQfK0FVEPiDfM+oBqSr7WAiki6oQQkI+mGEZCQucIBAIAh+A1z3pffh/qoQAAAAABJRU5ErkJggg==', nit: '900.123.456-7', correoDatos: 'datos@montajesandinos.co', responsableDatos: 'Gestión Humana' }, correoAlertas: 'rrhh@montajesandinos.co', fotoProbabilidad: 0, recordatorioCorreo: true, factorPrestacional: 52, ...(location.protocol === 'https:' ? { urlApp: location.href.replace(/#.*$/, '') } : {}) }, adm));
  const c1 = ok(api('adminCentroGuardar', { presupuestoHoras: 900, presupuestoCosto: 32000000, nombre: 'Planta Tocancipá', cliente: 'Cervecería del Norte', direccion: 'Km 3 vía Briceño', lat: 4.65, lng: -74.1, radio: 150, horario: { 1: H, 2: H, 3: H, 4: H, 5: H }, tol: 5 }, adm));
  const c2 = ok(api('adminCentroGuardar', { presupuestoHoras: 300, presupuestoCosto: 9000000, nombre: 'Bodega Funza', cliente: 'Bebidas Andinas', direccion: 'Parque industrial Funza', lat: 4.71, lng: -74.2, radio: 200, horario: { 1: H, 2: H, 3: H, 4: H, 5: H, 6: { e: '07:00', s: '11:00' } }, tol: 10 }, adm));
  ok(api('adminJefeGuardar', { nombre: 'Jorge Medina', cargo: 'Director de obra', whatsapp: '3001234567', email: 'jorge@montajesandinos.co', pin: '482173' }, adm));
  ok(api('adminJefeGuardar', { nombre: 'Luz Dary Peña', cargo: 'Coordinadora HSEQ', whatsapp: '3009876543', email: 'luzdary@montajesandinos.co', pin: '482173' }, adm));
  ok(api('adminTurnoGuardar', { nombre: 'Noche 22–06', e: '22:00', s: '06:00', dias: [] }, adm));
  const gente = [['1020333444', 'Pedro Pérez Gómez', 'Soldador', c1.id, 1750905, 'trabajador'], ['52111222', 'Luisa Gómez Ruiz', 'Auxiliar HSEQ', c1.id, 2400000, 'trabajador'],
    ['80222333', 'Carlos Méndez', 'Mecánico montador', c2.id, 2100000, 'trabajador'], ['1033444555', 'Yeison Castro', 'Ayudante', c2.id, 1750905, 'trabajador'],
    ['39555666', 'Marta Quintero', 'Almacenista', c1.id, 1900000, 'trabajador'], ['80111000', 'Sara Vargas', 'Supervisora de obra', c1.id, 3600000, 'supervisor']];
  const SUP = { '1020333444': '80111000', '52111222': '80111000', '39555666': '79000001' }; // Sara revisa a Pedro y Luisa; Marta la revisa administración
  const tk = {};
  gente.forEach(([ced, nombre, cargo, centroId, salario, rol]) => {
    const r = ok(api('adminPersonaGuardar', { cedula: ced, nombre, cargo, centroId, salario, rol, supCentros: rol === 'supervisor' ? [c1.id] : [], supervisor: '', ingreso: '2025-03-10', email: nombre.split(' ')[0].toLowerCase() + '@correo.co', banco: 'Bancolombia', tipoCuenta: 'ahorros', cuenta: '0' + ced.slice(-9) }, adm));
    tk[ced] = ok(api('registro', { cedula: ced, codigo: r.codigo, clave: 'demo2026', consentimiento: C })).token;
  });
  ok(api('adminTrasladoMasivo', { supervisor: SUP['1020333444'], cedulas: ['1020333444', '52111222'] }, adm));
  ok(api('adminTrasladoMasivo', { supervisor: SUP['39555666'], cedulas: ['39555666'] }, adm));
  dias.forEach((f, i) => gente.slice(0, 5).forEach(([ced], j) => {
    if (j === 3 && i === 6) return; // una ausencia sin justificar
    const g = j === 2 || j === 3 ? G2 : G1;
    hora(f, j === 1 && i === 7 ? '07:24' : '06:5' + ((i + j) % 9)); ok(api('marcar', { tipo: 'entrada', ...g }, tk[ced]));
    if ((i + j) % 3) { hora(f, '12:02'); ok(api('marcar', { tipo: 'sal_alm', ...g }, tk[ced])); hora(f, '12:58'); ok(api('marcar', { tipo: 'ent_alm', ...g }, tk[ced])); }
    if (j === 2 && i === 8) return; // olvidó la salida
    hora(f, j === 0 && i % 3 === 1 ? '18:30' : '16:2' + (5 + ((i + j) % 4))); ok(api('marcar', { tipo: 'salida', ...g }, tk[ced]));
  }));
  const ayer = dias[dias.length - 1];
  hora(ayer, '17:10'); ok(api('permisoCrear', { tipo: 'cita_medica', fechaSalida: sig, horaSalida: '14:00', fechaRegreso: sig, horaRegreso: '16:24', motivo: 'Cita de control en la EPS' }, tk['52111222']));
  // Pedro tiene un permiso por horas aprobado para hoy: así se ve el botón «Salir a mi permiso»
  { const pp = ok(api('permisoCrear', { tipo: 'cita_medica', fechaSalida: hoy, horaSalida: '14:00', fechaRegreso: hoy, horaRegreso: '15:30', motivo: 'Exámenes de laboratorio' }, tk['1020333444']));
    ok(api('adminPermisoDecidir', { id: pp.id, decision: 'aprobar', obs: 'Aprobado por el jefe de obra por teléfono' }, adm)); }
  ok(api('adminIncapacidadGuardar', { cedula: '39555666', tipo: 'general', desde: hoy, hasta: sig, entidad: 'EPS Sanitas' }, adm));
  ok(api('adminNovedadGuardar', { cedulas: ['1020333444', '80222333'], fecha: ayer, concepto: 'Bono de trabajo en alturas', valor: 120000, tipo: 'salarial' }, adm));
  const FIRMA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  ok(api('adminPrestamoGuardar', { cedula: '80222333', concepto: 'Adelanto de nómina', monto: 400000, cuotas: 4, autorizacion: FIRMA }, adm));
  ok(api('adminCompensatorioGuardar', { cedula: '1020333444', minutos: 300, fecha: ayer, motivo: 'Acuerdo firmado: horas extra de la parada de planta', soporte: FIRMA }, adm));
  ok(api('adminComunicadoCrear', { titulo: 'Simulacro de evacuación', cuerpo: 'El jueves a las 10:00 a. m. haremos simulacro. Sigue las rutas señalizadas y reúnete en el punto de encuentro.', centros: [] }, adm));
  const laboral = M.dow(hoy) >= 1 && M.dow(hoy) <= 5 && !M.esFestivo(hoy);
  if (laboral && min >= 7 * 60 + 35) {
    hora(hoy, '06:55'); ok(api('marcar', { tipo: 'entrada', ...G1 }, tk['1020333444']));
    hora(hoy, '07:31'); ok(api('marcar', { tipo: 'entrada', ...G1 }, tk['52111222']));
    hora(hoy, '06:58'); ok(api('marcar', { tipo: 'entrada', ...G2 }, tk['80222333']));
  }
  S.ahora(null);
  ok(api('adminConfigGuardar', { fotoProbabilidad: 35 }, adm));
  S.tareaCada15();
}

export function arrancar() {
  const previo = leerLS(CLAVE);
  demo.X = crearBackend(previo);
  if (!previo) { try { sembrar(demo.X); } catch (e) { console.error('Semilla de la demostración', e); } guardar(); }
  // Red: lo que la aplicación envía a "demo:api" lo atiende el backend local, con una pequeña espera realista.
  const original = window.fetch.bind(window);
  window.fetch = async (url, init) => {
    if (!String(url).startsWith('demo:')) return original(url, init);
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 350));
    demo.X.S.limpiar(); const texto = demo.X.S.doPost({ postData: { contents: init.body } }).texto; guardar();
    return new Response(texto, { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  // GPS simulado: en la obra asignada, fuera de ella o bloqueado.
  const centro = () => { const y = leerLS('cj.yo'); const l = (y && y.centros) || []; return l.find((c) => c.id === y?.usuario?.centroId && c.lat !== null) || l.find((c) => c.lat !== null) || { lat: 4.65, lng: -74.1 }; };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    getCurrentPosition(ok, mal) { setTimeout(() => { if (demo.gps === 'bloqueado') return mal({ code: 1, message: 'denegado' }); const c = centro(), d = demo.gps === 'fuera' ? 0.02 : 0.0004 * (Math.random() - 0.5);
      ok({ coords: { latitude: c.lat + d, longitude: c.lng + d, accuracy: 12 }, timestamp: Date.now() }); }, 500); },
    watchPosition() { return 0; }, clearWatch() { } } });
  // Cámara simulada: un retrato dibujado con la hora, para no pedir la cámara real.
  const md = navigator.mediaDevices || {}; if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: md });
  md.getUserMedia = async () => {
    if (demo.camara === 'bloqueada') throw new DOMException('Permiso denegado', 'NotAllowedError');
    const c = document.createElement('canvas'); c.width = 480; c.height = 640; const x = c.getContext('2d');
    const dibujar = () => { const t = new Date(); const g = x.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#9fb8c0'); g.addColorStop(1, '#4b6870'); x.fillStyle = g; x.fillRect(0, 0, 480, 640);
      x.fillStyle = '#f2c9a5'; x.beginPath(); x.arc(240, 270, 110, 0, 7); x.fill(); x.fillStyle = '#f2a900'; x.beginPath(); x.ellipse(240, 185, 128, 62, 0, Math.PI, 0); x.fill(); x.fillRect(100, 180, 280, 22);
      x.fillStyle = '#14242a'; x.beginPath(); x.arc(200, 260, 10, 0, 7); x.arc(280, 260, 10, 0, 7); x.fill(); x.fillRect(205, 320, 70, 8); x.fillStyle = '#0e4a5a'; x.fillRect(90, 400, 300, 240);
      x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.fillText('FOTO DE DEMOSTRACIÓN', 240, 470); x.font = '20px sans-serif'; x.fillText(t.toLocaleTimeString('es-CO'), 240, 505); };
    dibujar(); const i = setInterval(dibujar, 500), s = c.captureStream(10); s.getTracks().forEach((tr) => { const st = tr.stop.bind(tr); tr.stop = () => { clearInterval(i); st(); }; }); return s;
  };
}
