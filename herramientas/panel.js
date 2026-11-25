// Mete instalacion/consola.html dentro de PanelProveedor.gs (un solo archivo para pegar en Apps Script)
const fs = require('fs'), p = __dirname + '/../instalacion/PanelProveedor.gs';
const html = fs.readFileSync(__dirname + '/../instalacion/consola.html', 'utf8');
let s = fs.readFileSync(p, 'utf8').replace(/\n\/\* ---------- Consola: página \(generada por herramientas\/panel\.js\) ---------- \*\/[\s\S]*$/, '');
fs.writeFileSync(p, s.trimEnd() + '\n\n/* ---------- Consola: página (generada por herramientas/panel.js) ---------- */\nvar CONSOLA_HTML = ' + JSON.stringify(html) + ';\n');
console.log('PanelProveedor.gs con la consola:', Math.round(fs.statSync(p).size / 1024), 'KB');
