// Genera la llave de licencia de un cliente. Uso:
//   CLAVE=<tu clave de proveedor> node herramientas/llave-licencia.js <plan> <nit> <vence AAAA-MM-DD> [maxUsuarios] [modulo,modulo]
// La CLAVE es la misma que pones en CLAVE_LICENCIA_PROVEEDOR (Base.gs) del paquete que entregas. No la compartas.
const crypto = require('crypto');
const [plan, nit, vence, max, extra] = process.argv.slice(2), clave = process.env.CLAVE;
if (!clave || !plan || !nit || !/^\d{4}-\d\d-\d\d$/.test(vence || '')) { console.error('Uso: CLAVE=... node herramientas/llave-licencia.js basico|profesional|empresa <NIT> <AAAA-MM-DD> [maxUsuarios] [modulos extra]'); process.exit(1); }
const datos = { plan, nit: nit.replace(/\D/g, ''), vence, emitida: new Date().toISOString().slice(0, 10) };
if (max) datos.maxUsuarios = +max; if (extra) datos.modulosExtra = extra.split(',');
const p = Buffer.from(JSON.stringify(datos)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
console.log(p + '.' + crypto.createHmac('sha256', clave).update(p).digest('hex').slice(0, 32));
