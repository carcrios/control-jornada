# Guía del proveedor: manejar muchas empresas sin trabajo repetido

> **Para instalar, usa `INSTALACION.md`** (pasos por hoja y revisión automática). Esta guía explica cómo funciona el modelo de proveedor.

Con la versión 1.8 tienes tres piezas:

| Pieza | Dónde vive | Para qué |
|---|---|---|
| **Página** (`docs/`) | Tu GitHub Pages | La aplicación que abren los celulares. También publica la última versión del código (`docs/actualizacion/`). |
| **Plantilla** | Una hoja de Google tuya | La que copian tus clientes con el enlace `/copy`. Lleva `ControlJornada.gs` y `Proveedor.gs`. |
| **Panel de proveedor** | Otra hoja de Google tuya | Ves a todas las empresas, marcas sus módulos, renuevas licencias y ves qué versión tiene cada una. |

Después de configurarlas una vez:
- **Actualizar a todas:** subes `docs/` a GitHub. Cada empresa se actualiza sola esa noche, sin cambiar su enlace.
- **Cambiar módulos o renovar:** editas la fila de la empresa en el panel. La licencia le llega sola esa noche.
- **Empresas nuevas:** aparecen solas en el panel cuando instalan. Solo les asignas el plan.

---

## A. Una sola vez: el panel de proveedor
1. Crea una hoja de Google nueva y llámala «Panel de proveedor».
2. Abre Extensiones → Apps Script, borra lo que haya, pega `instalacion/PanelProveedor.gs` y guarda.
3. Publícalo con Implementar → Nueva implementación → tipo «Aplicación web» → Ejecutar como: **Yo** · Quién tiene acceso: **Cualquier persona** → Implementar. Autoriza los permisos.
4. Vuelve a la hoja y recárgala. Aparece el menú **Panel de proveedor**.
5. Elige **0. Configurar** y pega la dirección de tu página (`https://carcrios.github.io/control-jornada/`). En la pestaña «Proveedor.gs» queda el bloque con tu página, tu clave de licencias y el enlace del panel.
6. Elige **1. Preparar la hoja de clientes**.
7. Opcional: **Avisarme cada mañana por correo**. Te llega un resumen si hay empresas nuevas, por vencer, vencidas o sin reportar.

> La clave que muestra el panel firma las licencias. No la compartas. Si la cambias, las licencias anteriores dejan de servir.

## B. Una sola vez: la plantilla
1. Abre tu plantilla → Extensiones → Apps Script.
2. Reemplaza el código del archivo principal por `instalacion/ControlJornada.gs`. Si quieres, renómbralo «ControlJornada».
3. Crea un archivo nuevo con **+** → Script, nómbralo **Proveedor** y pega el bloque de la pestaña «Proveedor.gs» del panel.
4. En ⚙ Configuración del proyecto, activa «Mostrar el archivo de manifiesto appsscript.json» y pega el contenido de `instalacion/appsscript.json` en ese archivo.
5. Guarda. El enlace `/copy` no cambia: las empresas nuevas copian todo esto, incluido `Proveedor.gs`.

## C. Una sola vez por empresa que ya tienes instalada
Haz los pasos B.1 a B.4 en la hoja de esa empresa. Después:
1. Abre Implementar → Administrar implementaciones → lápiz → Versión: **Nueva versión** → Implementar.
2. En la hoja, abre el menú Control de jornada → **1. Instalar** y acepta los permisos nuevos. Son los que permiten que se actualice sola.
3. Con la cuenta de Google dueña de esa hoja, abre https://script.google.com/home/usersettings y activa **«API de Google Apps Script»**.
4. En el panel de la empresa, ve a Configuración → Licencia y versión → **Buscar mi licencia ahora**. La empresa aparece en tu panel.

Desde ese momento no vuelves a pegar código en esa empresa.

## D. Empresa nueva (unos 10 minutos)
1. El cliente sigue `GUIA-CLIENTE.md`: copia, instala, publica, activa la API de Apps Script y entra.
2. Esa noche, o en cuanto toque «Buscar mi licencia ahora», aparece en tu panel con estado «Nueva: asigna plan y vencimiento».
3. En su fila, elige el **Plan**. Sus módulos se marcan solos. Si vendiste algo distinto, elige «personalizado» y marca las casillas a mano.
4. Revisa «Personas máx.» y «Vence». Al elegir el plan, el vencimiento queda a 30 días.
5. Listo. La licencia le llega sola.

## E. Módulos por empresa
Cada empresa tiene en su fila una casilla por módulo:
- **Asistencia:** siempre incluido.
- **Nómina, Permisos, Turnos, Préstamos, Autoservicio, Kiosco, QR de obra, Presupuesto, En vivo y 360° y Seguridad Pro:** se activan o se quitan con su casilla.

Para cambiarlos, marca o desmarca la casilla y espera a la noche, o pídele al cliente que toque «Buscar mi licencia ahora». El cliente ve sus módulos en Configuración → Licencia y versión, pero no puede cambiarlos.

> Si `clave` está vacía en `Proveedor.gs`, la instalación funciona con **todos** los módulos y sin licencia. Es el modo de demostración, y por eso hasta ahora no veías dónde configurarlos.

## F. Renovar, suspender y cobrar
- **Renovar:** selecciona la fila → menú **Renovar la empresa seleccionada…** → escribe 1, 3, 6 o 12 meses.
- **Si no paga:** al vencer tiene 15 días de gracia con todo funcionando. Después el panel de la empresa queda en modo consulta, pero los trabajadores siguen marcando.
- **Suspender de inmediato:** marca la casilla «Suspendida».
- **Recalcular todo:** usa **2. Calcular estados y llaves** para revisar los estados de todas las empresas de una vez.

## G. Sacar una versión nueva para todas
1. Haz los cambios y anótalos en `CAMBIOS.md`, bajo `## X.Y.Z`. Sube `VERSION` en `apps-script/Base.gs` y en `web/src/api.js`.
2. Corre `node herramientas/empaquetar.js https://carcrios.github.io/control-jornada/` y luego `npm run build` dentro de `web/`.
3. Sube `docs/` a GitHub.
4. Esa noche, a las 2 a. m., cada empresa se actualiza sola, y sus administradores reciben un correo con las novedades. En el panel, la columna «Versión» muestra quién ya se actualizó.
5. Actualiza también tu plantilla (paso B.2) para que las empresas nuevas arranquen con la versión nueva.

Detalles de la actualización:
- **Permisos nuevos de Google:** si la versión nueva los pide, la empresa no se actualiza sola. Sus administradores reciben un correo para hacerlo con un clic desde el menú de la hoja.
- **Quitar la actualización automática:** cada empresa puede desactivarla en Configuración → Licencia y versión.
- **Empresas sin reportar:** si una empresa lleva más de 3 días sin reportar, aparece en el resumen del panel. Suele ser que no activó la API de Apps Script.

## Aclaración honesta
El código vive en la cuenta de Google de cada cliente. Por eso:
- **Sus datos son suyos:** nunca pasan por ti. El panel solo recibe el nombre de la empresa, el NIT, la versión, el número de personas activas, el correo de sus administradores y su enlace.
- **La licencia no es una cerradura:** alguien con conocimientos técnicos podría modificar el código. Es un control de planes y un recordatorio. La protección real es el contrato de licencia de uso y que solo quien está al día recibe actualizaciones y soporte.
