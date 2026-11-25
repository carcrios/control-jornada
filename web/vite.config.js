import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
// La versión del service worker sale de VERSION en Base.gs: cada versión nueva limpia la caché vieja de los celulares
const VER = (fs.readFileSync(new URL('../apps-script/Base.gs', import.meta.url), 'utf8').match(/var VERSION = '([^']+)'/) || [])[1] || 'dev';
const swVersion = { name: 'sw-version', writeBundle(o) { const f = o.dir + '/sw.js'; if (fs.existsSync(f)) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/jornada-v[\w.-]+/, 'jornada-v' + VER)); } };
// base relativa: el mismo paquete funciona en cualquier repositorio de GitHub Pages sin cambios.
export default defineConfig({
  base: './', plugins: [react(), swVersion],
  build: { outDir: '../docs', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { proxy: { '/api-local': 'http://localhost:8787' } }
});
