import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Demostración en un solo archivo HTML: el backend real corre en el navegador. Salida: ../demo/demo.html
export default defineConfig({
  base: './', plugins: [react(), viteSingleFile()], publicDir: false,
  build: { outDir: '../demo', emptyOutDir: true, assetsInlineLimit: 100000000, chunkSizeWarningLimit: 5000, rollupOptions: { input: 'demo.html' } }
});
