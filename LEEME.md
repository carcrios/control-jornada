# Control de jornada

Aplicación web instalable (PWA) para registrar entradas, salidas y almuerzo, tramitar permisos,
llevar incapacidades y horas extra, y ver desprendibles de pago. Normativa colombiana vigente a
noviembre de 2026. Los datos viven en **una hoja de Google Sheets de la empresa**; la página se
publica en **GitHub Pages**.

Una hoja de cálculo = una empresa. Nada de la empresa está escrito en el código: nombre, logo,
horarios, jefes, alertas y parámetros legales se configuran desde el panel del administrador.

```
instalacion/   ControlJornada.gs: archivo único para la plantilla de Google Sheets
herramientas/  empaquetar.js: genera el archivo único
apps-script/   Backend (se pega en el editor de Apps Script de la hoja)
docs/          Sitio ya compilado: es lo que publica GitHub Pages
web/           Código fuente de la página (React + InteraUI). Solo si vas a modificarla
tests/         Pruebas automáticas y servidor de demostración local
```

## Informes
Panel → **Informes**: elige periodo (hasta 90 días), cómo agrupar (persona, obra, cargo, día, semana, mes,
día de la semana o total), filtros y columnas. Todo se calcula con el mismo motor de la nómina, así que los
totales cuadran con ella. Hay seis informes listos y puedes guardar los tuyos. El costo incluye el factor
prestacional si lo configuras. Descarga a Excel o CSV con la fila de totales y los filtros usados.

## Cómo se instala (modelo de venta)

Tú publicas **una sola página** para todos tus clientes. Cada cliente tiene **su propia hoja de Google**
en su cuenta: sus datos nunca pasan por ti. El cliente no toca GitHub, código ni `config.js`.

### Una sola vez (tú, como proveedor)
1. **Página:** sube este repositorio a GitHub → Settings → Pages → rama `main`, carpeta `/docs`.
   Deja `docs/config.js` con `API_URL` vacío (así cada empresa entra con su propio enlace).
2. **Panel de proveedor y plantilla:** sigue `GUIA-PROVEEDOR.md` (partes A y B). La plantilla lleva dos archivos:
   `ControlJornada.gs` (el código, que se actualiza solo) y `Proveedor.gs` (tu página, tu clave de licencias
   y tu panel, que nunca se toca). **No instales ni implementes la plantilla.**
3. Comparte la plantilla como «Cualquier persona con el enlace: lector» y arma el enlace de copia:
   cambia el final `/edit…` por `/copy`. Ese enlace es el que entregas a cada cliente.

### Cada cliente (unos 10 minutos) → ver `GUIA-CLIENTE.md`
1. Abre tu enlace `/copy` con la cuenta de Google de la empresa → «Hacer una copia».
2. En su copia: menú **Control de jornada → 1. Instalar** → autoriza. Anota el código de administrador.
3. Extensiones → Apps Script → **Implementar → Nueva implementación → Aplicación web**
   (Ejecutar como: Yo · Acceso: Cualquier persona).
   Con la misma cuenta activa «API de Google Apps Script» en https://script.google.com/home/usersettings
   (una vez; es lo que permite la actualización automática).
4. Menú **Control de jornada → 2. Ver el enlace de mi empresa** → lo abre, entra con su cédula y el código,
   y lo comparte con su personal. El panel le muestra los «Primeros pasos».

La copia descarta automáticamente el secreto y las carpetas de la plantilla.

### Actualizar a los clientes
Desde la 1.8 no hay que pegar código en cada empresa. Subes `docs/` nuevo a GitHub y cada instalación se actualiza sola esa noche: código, versión y aplicación web, sin cambiar el enlace. También pueden hacerlo al instante con Configuración → Licencia y versión → «Buscar y actualizar ahora». Ver `GUIA-PROVEEDOR.md`.

## Pruebas de funcionamiento
```
node tests/motor.test.js     # 41 pruebas del cálculo de jornada y nómina
node tests/api.test.js       # 70 pruebas de extremo a extremo, incluidos intentos de ataque
node tests/modulos.test.js   # 44 pruebas de módulos, actualización automática y licencias
node tests/panel.test.js     # 3 pruebas del panel de proveedor con una instalación real
```
Corren solas en cada cambio (GitHub Actions). Dentro de la aplicación, **Sistema y respaldo**
ejecuta 8 comprobaciones sobre la instalación real.

Demostración local con datos de ejemplo:
`cd web && npm install && npm run build && cd .. && node tests/servidor-local.js` → http://localhost:8787
(administrador 79000001 / demo2026 · trabajador 1020333444 / demo2026 · clave de firma 482173).
Con `ENLACE=1 node tests/servidor-local.js` se prueba la conexión por enlace: abre http://localhost:8787/#/c/AKfycbDEMOdemoDEMOdemo1234567.

## Copias de seguridad y restauración
- Automática cada 7 días (configurable) en la carpeta «Control de jornada - Copias de seguridad»
  del Drive de la empresa; conserva las últimas 8. También manual desde el panel.
- **Restaurar:** abre la copia deseada → menú «1. Instalar» → Implementar → Nueva implementación →
  menú «2. Ver el enlace de mi empresa» y reenvía ese enlace. Los usuarios deben ingresar de nuevo. Prueba este procedimiento una vez antes de necesitarlo.

## Seguridad y datos
- Contraseñas y claves de firma: hash con sal; nunca en claro. Sesión de 90 días por dispositivo.
- Activación de cuenta con código de un solo uso (nadie puede reclamar la cédula de otro).
- Un permiso solo llega a la nómina con la firma de cada jefe (enlace + clave personal) y la
  aprobación final del administrador en pantalla.
- Límite de intentos en ingreso, códigos y claves de firma. Auditoría de todo cambio.
- Fotos comprimidas en el celular (≈ 100 kB), guardadas en carpeta privada y borradas a los
  30 días; coordenadas borradas a los 12 meses. Corre solo, sin abrir el panel.
- No se guarda el diagnóstico de las incapacidades.
- Periodo de nómina cerrado = inmutable.

## Monitoreo y errores
- Los errores del navegador y del servidor se guardan en la hoja `Errores` y se ven en
  **Sistema y respaldo → Errores**. Las fallas de tareas automáticas generan alerta por correo.
- El mismo panel muestra tareas activas, cupo diario de correo y capacidad usada.

## Límites que conviene conocer
- **Recordatorios:** con la aplicación abierta o en segundo plano, el aviso sale en el celular
  5 minutos antes de la entrada y 5 después de la salida (igual en almuerzo). Con la aplicación
  cerrada, un sitio en GitHub Pages no puede enviar notificaciones push; para eso activa el
  recordatorio por correo en **Alertas**.
- **WhatsApp:** la aplicación abre WhatsApp con el mensaje y el enlace de firma listos; quien
  envía es el trabajador. No hay envío automático (requeriría WhatsApp Business API, de pago).
- **Correo:** una cuenta de Gmail gratuita envía 100 correos al día; Google Workspace, 1.500.
- **Tamaño:** pensada para hasta unas 150 personas por hoja. Las respuestas tardan 1 a 3 segundos
  (es el tiempo normal de Apps Script).
- **Nómina:** es una liquidación estimada (salario, recargos, extras, auxilio de transporte,
  salud y pensión). No incluye prestaciones, retención en la fuente, embargos ni préstamos, y no
  reemplaza la nómina electrónica ante la DIAN.
- Los textos legales son modelos: deben ser revisados por un abogado antes de usarse.

## Parámetros legales por defecto (editables en Configuración)
| Concepto | Valor | Norma |
|---|---|---|
| Jornada máxima semanal | 42 h (divisor 210) | Ley 2101 de 2021 |
| Jornada nocturna | 19:00 a 06:00, recargo 35 % | Ley 2466 de 2025 |
| Hora extra diurna / nocturna | 25 % / 75 % | CST art. 168 |
| Dominical y festivo | 90 % hasta jun-2027, luego 100 % | Ley 2466 de 2025 |
| Tope de horas extra | 2 por día, 12 por semana | Ley 50 de 1990 |
| Salario mínimo / auxilio de transporte 2026 | $1.750.905 / $249.095 | Decretos de 2025 |
| Festivos | Calculados cada año | Ley 51 de 1983 |


## Licencia y planes

Cada empresa recibe una llave de licencia (Configuración → Licencia) que indica el plan, el número de personas,
los módulos y la fecha de vencimiento. Cuando vence, los trabajadores siguen marcando con normalidad y el panel
queda en modo consulta: se puede ver y descargar todo, pero no aprobar ni cambiar nada hasta pegar una llave nueva.

Para emitir llaves: pon tu clave secreta en `CLAVE_LICENCIA_PROVEEDOR` (apps-script/Base.gs) antes de empaquetar y genera cada llave con
`CLAVE=<tu clave> node herramientas/llave-licencia.js empresa <NIT del cliente> 2027-12-31`. La llave queda atada a ese NIT y siempre vence;
después del vencimiento hay 15 días de gracia. Si dejas la clave vacía, la instalación tiene todos los módulos sin llave.

Aclaración honesta: el código se instala en la cuenta de Google del cliente, así que alguien con conocimientos
técnicos podría modificarlo. La llave es un recordatorio y un control de planes, no una cerradura. La protección
real es el contrato de licencia de uso (ver la página de propiedad intelectual) y el soporte y las
actualizaciones, que solo recibe quien tiene la licencia al día.
