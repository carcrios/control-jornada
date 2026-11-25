import React from 'react';
import { createRoot } from 'react-dom/client';
import '@elizabthpazp/intera-ui/dist/globals.css';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/public-sans/wght.css';
import './estilos.css';
import { aplicarPreferencias } from './a11y.jsx';
aplicarPreferencias();
import App from './App.jsx';
import { vigilarErrores, reportarError } from './api.js';
import { Limite } from './ui.jsx';

vigilarErrores();
createRoot(document.getElementById('raiz')).render(<Limite alFallar={reportarError}><App /></Limite>);
if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
