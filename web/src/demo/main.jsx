import './configurar.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@elizabthpazp/intera-ui/dist/globals.css';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/public-sans/wght.css';
import '../estilos.css';
import { arrancar } from './motor-demo.js';
import App from '../App.jsx';
import { Limite } from '../ui.jsx';
import PanelDemo from './PanelDemo.jsx';

arrancar();
createRoot(document.getElementById('raiz')).render(<Limite><App /><PanelDemo /></Limite>);
