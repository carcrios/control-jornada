// Servidor de demostración local: sirve el sitio compilado y el backend real sobre el simulador (datos en memoria).
// Uso: (cd web && npm run build) && node tests/servidor-local.js  →  http://localhost:8787
// Administrador: cédula 79000001 / clave demo2026 · Trabajador: cédula 1020333444 / clave demo2026 · Clave de firma del jefe: 482173
const http = require('http'), fs = require('fs'), path = require('path'), { crear } = require('./simulador');
const X = crear(), { S, api } = X, sitio = path.join(__dirname, '../docs');
const AHORA = process.env.AHORA; // opcional: fija la hora del servidor, ej. 2026-11-13T10:40:00-05:00
const hora = (f, h) => S.ahora(new Date(f + 'T' + h + ':00-05:00').toISOString());
const ok = (r) => { if (!r.ok) throw new Error(r.e + ' ' + r.m); return r.d; };
(function sembrar() {
  const C = { datos: true, sensibles: true }, G = { lat: 4.65, lng: -74.1, prec: 12 }, H = { e: '07:00', s: '16:24', ai: '12:00', af: '13:00' };
  hora('2026-11-02', '06:00'); S.instalar();
  const adm = ok(api('registro', { cedula: '79000001', codigo: X.props.CODIGO_ADMIN, clave: 'demo2026', nombre: 'Andrea Rojas', salario: 5200000, consentimiento: C })).token;
  ok(api('adminConfigGuardar', { empresa: { nombre: 'Montajes Andinos S.A.S.', nit: '900.123.456-7', correoDatos: 'datos@montajesandinos.co' }, correoAlertas: 'rrhh@montajesandinos.co', fotoProbabilidad: 0, urlApp: 'http://localhost:8787/' }, adm));
  const c1 = ok(api('adminCentroGuardar', { nombre: 'Planta Tocancipá', cliente: 'Cervecería', lat: 4.65, lng: -74.1, radio: 150, horario: { 1: H, 2: H, 3: H, 4: H, 5: H }, tol: 5 }, adm));
  const c2 = ok(api('adminCentroGuardar', { nombre: 'Bodega Funza', cliente: 'Bebidas', lat: 4.71, lng: -74.2, radio: 200, horario: { 1: H, 2: H, 3: H, 4: H, 5: H, 6: { e: '07:00', s: '11:00' } }, tol: 10 }, adm));
  ok(api('adminJefeGuardar', { nombre: 'Jorge Medina', cargo: 'Director de obra', whatsapp: '3001234567', email: 'jorge@montajesandinos.co', pin: '482173' }, adm));
  ok(api('adminJefeGuardar', { nombre: 'Luz Dary Peña', cargo: 'Coordinadora HSEQ', whatsapp: '3009876543', pin: '482173' }, adm));
  const gente = [['1020333444', 'Pedro Pérez Gómez', 'Soldador', c1.id, 1750905], ['52111222', 'Luisa Gómez Ruiz', 'Auxiliar HSEQ', c1.id, 2400000], ['80222333', 'Carlos Méndez', 'Mecánico montador', c2.id, 2100000], ['1033444555', 'Yeison Castro', 'Ayudante', c2.id, 1750905], ['39555666', 'Marta Quintero', 'Almacenista', c1.id, 1900000]];
  const tk = {};
  gente.forEach(([ced, nombre, cargo, centroId, salario]) => { const r = ok(api('adminPersonaGuardar', { cedula: ced, nombre, cargo, centroId, salario, ingreso: '2025-03-10' }, adm)); tk[ced] = ok(api('registro', { cedula: ced, codigo: r.codigo, clave: 'demo2026', consentimiento: C })).token; });
  const dias = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'];
  dias.forEach((f, i) => gente.forEach(([ced], j) => {
    if (j === 3 && i === 5) return; // una ausencia
    const g = j >= 2 && j !== 4 ? { lat: 4.71, lng: -74.2, prec: 10 } : G;
    hora(f, j === 0 && i === 6 ? '07:22' : '06:5' + ((i + j) % 9)); ok(api('marcar', { tipo: 'entrada', ...g }, tk[ced]));
    if ((i + j) % 3) { hora(f, '12:02'); ok(api('marcar', { tipo: 'sal_alm', ...g }, tk[ced])); hora(f, '12:58'); ok(api('marcar', { tipo: 'ent_alm', ...g }, tk[ced])); }
    if (j === 2 && i === 7) return; // olvidó la salida
    hora(f, j === 0 && i % 4 === 1 ? '18:30' : '16:2' + (5 + (i + j) % 4)); ok(api('marcar', { tipo: 'salida', ...g }, tk[ced]));
  }));
  hora('2026-11-12', '17:00');
  ok(api('permisoCrear', { tipo: 'cita_medica', fechaSalida: '2026-11-13', horaSalida: '14:00', fechaRegreso: '2026-11-13', horaRegreso: '16:24', motivo: 'Cita de control en la EPS' }, tk['52111222']));
  ok(api('adminIncapacidadGuardar', { cedula: '39555666', tipo: 'general', desde: '2026-11-13', hasta: '2026-11-14', entidad: 'EPS Sanitas' }, adm));
  hora('2026-11-13', '06:55'); ok(api('marcar', { tipo: 'entrada', ...G }, tk['1020333444']));
  hora('2026-11-13', '07:31'); ok(api('marcar', { tipo: 'entrada', ...G }, tk['52111222']));
  hora('2026-11-13', '06:58'); ok(api('marcar', { tipo: 'entrada', lat: 4.71, lng: -74.2, prec: 9 }, tk['80222333']));
  S.ahora(AHORA ? new Date(AHORA).toISOString() : new Date('2026-11-13T10:40:00-05:00').toISOString());
  S.tareaCada15();
})();
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.json': 'application/json' };
http.createServer((req, res) => {
  if (req.method === 'POST') { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(S.doPost({ postData: { contents: b } }).texto); }); return; }
  const u = req.url.split('?')[0];
  if (u === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(process.env.ENLACE ? "window.CONFIG={BASE_API:'/s/'};" : "window.CONFIG={API_URL:'/api'};"); }
  const f = path.join(sitio, u === '/' ? 'index.html' : u);
  if (!f.startsWith(sitio) || !fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8787, () => console.log('Demostración en http://localhost:8787'));
