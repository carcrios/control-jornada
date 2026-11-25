// Prepara lo que se entrega y lo que descargan las instalaciones para actualizarse solas.
// Uso: node herramientas/empaquetar.js [https://TU-USUARIO.github.io/TU-REPOSITORIO/]
//
// Genera:
//  instalacion/ControlJornada.gs   código para pegar en la plantilla (no lleva datos tuyos)
//  instalacion/Proveedor.gs        modelo del archivo con tu página, tu clave y tu panel (va aparte en la plantilla)
//  instalacion/appsscript.json     manifiesto (permisos)
//  web/public/actualizacion/       lo mismo + version.json: al compilar la página queda en docs/actualizacion/,
//                                  y de ahí lo toman las empresas cada noche para actualizarse solas.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const raiz = path.join(__dirname, '..'), url = (process.argv[2] || '').trim();
if (url && !/^https:\/\/[^\s"']+\/$/.test(url)) { console.error('La dirección debe empezar por https:// y terminar en /'); process.exit(1); }
const ARCHIVOS = ['Motor.gs', 'Base.gs', 'Servicios.gs', 'Turnos.gs', 'Informes.gs', 'Modulos.gs', 'Tareas.gs', 'Actualizar.gs'];
const partes = ARCHIVOS.map((f) => {
  let s = fs.readFileSync(path.join(raiz, 'apps-script', f), 'utf8');
  if (f === 'Motor.gs') s = s.replace("if (typeof module !== 'undefined') module.exports = Motor;", '');
  return `// ===================== ${f} =====================\n` + s;
});
const version = /var VERSION = '([^']+)'/.exec(partes.join(''))[1];
const codigo = `/* Control de jornada ${version} — pega este archivo en Apps Script (Extensiones → Apps Script) con el nombre ControlJornada.\n   Tus datos de proveedor van aparte, en Proveedor.gs. Generado por herramientas/empaquetar.js: no lo edites a mano. */\n\n` + partes.join('\n');
const manifiesto = fs.readFileSync(path.join(raiz, 'apps-script', 'appsscript.json'), 'utf8');
const proveedor = `// Datos del proveedor. La actualización automática NUNCA cambia este archivo.\n// app: dirección de tu página (GitHub Pages) · clave: firma de licencias (la da tu panel) · panel: enlace de tu panel de proveedor\nvar PROVEEDOR = {\n  app: ${JSON.stringify(url)},\n  clave: '',\n  panel: ''\n};\n`;

// Novedades de esta versión (para el correo que reciben los administradores al actualizarse)
const cambios = fs.readFileSync(path.join(raiz, 'CAMBIOS.md'), 'utf8'), sec = new RegExp('## ' + version.replace(/\./g, '\\.') + '[^\\n]*\\n([\\s\\S]*?)(\\n## |$)').exec(cambios);
const notas = sec ? sec[1].split('\n').filter((l) => l.startsWith('- ')).map((l) => l.replace(/\*\*/g, '')).slice(0, 12).join('\n') : '';

const inst = path.join(raiz, 'instalacion'), pub = path.join(raiz, 'web', 'public', 'actualizacion');
[inst, pub].forEach((d) => fs.mkdirSync(d, { recursive: true }));
fs.writeFileSync(path.join(inst, 'ControlJornada.gs'), codigo);
fs.writeFileSync(path.join(inst, 'appsscript.json'), manifiesto);
fs.writeFileSync(path.join(inst, 'Proveedor.gs'), proveedor);
fs.writeFileSync(path.join(pub, 'ControlJornada.gs'), codigo);
fs.writeFileSync(path.join(pub, 'appsscript.json'), manifiesto);
fs.writeFileSync(path.join(pub, 'version.json'), JSON.stringify({ version, sha256: crypto.createHash('sha256').update(codigo, 'utf8').digest('hex'), fecha: new Date().toISOString().slice(0, 10), notas }, null, 1));
console.log(`Listo: versión ${version}. instalacion/ (ControlJornada.gs, Proveedor.gs, appsscript.json) y web/public/actualizacion/ para la actualización automática.`);
