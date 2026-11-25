# Instalación de Control de jornada, paso a paso

> **Versión con imágenes:** `guias-clientes/Guia-de-instalacion.pdf` (9 páginas, con la consola y cada pantalla).

## Antes de empezar: son 3 hojas de Google distintas

Casi todos los errores vienen de hacer un paso en la hoja equivocada. Cada paso de esta guía empieza diciendo **en qué hoja estás**.

| Hoja | De quién es | Archivo de código que lleva | Se publica (Implementar) |
|---|---|---|---|
| 🟦 **PANEL** | Tuya, solo una | `PanelProveedor.gs` | Sí, una vez |
| 🟨 **PLANTILLA** | Tuya, solo una | `ControlJornada.gs` + `Proveedor.gs` | **Nunca** |
| 🟩 **EMPRESA** | Una por cada cliente | `ControlJornada.gs` + `Proveedor.gs` | Sí, una vez por empresa |

Cada hoja publicada tiene su propio enlace `…/exec`. **No se mezclan:**
- El enlace del 🟦 PANEL, al abrirlo, dice «Panel de proveedor de Control de jornada: activo». Solo va dentro de `Proveedor.gs`. **Nunca va en un celular.**
- El enlace de una 🟩 EMPRESA, al abrirlo, dice «Control de jornada · versión…». Es el que usan los celulares de esa empresa.

Para saber en qué hoja estás, abre **Extensiones → Apps Script** y mira los archivos de la izquierda.

---

## Parte 1. Tu página en GitHub (una sola vez)

📍 **Estás en:** github.com

1. Crea el repositorio `control-jornada`. Debe ser **Public**.
2. Sube los archivos. GitHub deja subir máximo 100 a la vez desde la página: sube primero `subir-parte-1-de-2.zip` descomprimido y después la parte 2.
3. Activa la página: ve a **Settings → Pages**. En Branch elige `main`, en la carpeta elige **`/docs`** y toca **Save**.
4. Espera 2 minutos y abre `https://TU-USUARIO.github.io/control-jornada/`. Debe abrir la aplicación.

**Cada vez que yo te entregue una versión nueva:** basta con reemplazar la carpeta `docs`.

---

## Parte 2. 🟦 El PANEL (una sola vez)

📍 **Estás en:** una hoja de Google **nueva**, llamada «Panel de proveedor».

1. Ve a **Extensiones → Apps Script**, borra lo que haya, pega `instalacion/PanelProveedor.gs` y guarda (ícono de disquete).
2. Ve a **Implementar → Nueva implementación**, toca ⚙ y elige **Aplicación web**. Pon **Ejecutar como: Yo** y **Quién tiene acceso: Cualquier persona**, toca **Implementar** y acepta los permisos.
3. Copia la **URL de la aplicación web** que aparece. Ábrela en otra pestaña: debe decir *«Panel de proveedor de Control de jornada: activo»*.
4. Vuelve a la hoja y recárgala con F5. Aparece el menú **Panel de proveedor**.
5. Elige **Panel de proveedor → 0. Configurar**:
   - Primero pide la dirección de tu página: `https://TU-USUARIO.github.io/control-jornada/`.
   - Después pide la dirección del panel: pega la URL del punto 3.
6. Elige **1. Preparar la hoja de clientes**.
7. En la pestaña **«Proveedor.gs»**, la celda A3 tiene un bloque así:
   ```
   var PROVEEDOR = { app: "…github.io…", clave: "…", panel: "…/exec" };
   ```
   Revisa que `panel` sea **la misma URL del punto 3**. Ese bloque lo usas en la Parte 3.
8. Elige **Panel de proveedor → Contraseña de la consola web…** y crea una contraseña de mínimo 8 caracteres.
9. Abre la URL del punto 3 y guárdala en favoritos: **esa es tu consola**. Desde ahí manejas todo sin tocar la hoja:
   - Ves todas las empresas, con su estado, versión, personas y último reporte.
   - Asignas el **plan** y los **módulos** de cada empresa con casillas, las personas máximo y el vencimiento.
   - Renuevas con un toque (+1, +3, +6 o +12 meses) o suspendes una empresa.
   - Agregas una empresa por su NIT antes de que se instale.
   - Apruebas la versión nueva para que todas se actualicen.

> ⚠️ **No uses «Nueva implementación» otra vez en el panel.** Si cambias el código del panel, ve a **Implementar → Administrar implementaciones → ✏️ lápiz → Versión: Nueva versión → Implementar**. Así la URL no cambia.

---

## Parte 3. 🟨 La PLANTILLA (una sola vez)

📍 **Estás en:** la hoja que vas a entregar a tus clientes, la plantilla.

1. Ve a **Extensiones → Apps Script**. En el archivo `Código.gs` (o `ControlJornada.gs`), borra todo, pega `instalacion/ControlJornada.gs` y guarda.
2. Toca **+ → Script**, ponle el nombre **Proveedor** y pega el bloque de la celda A3 del panel. Guarda.
3. Ve a **⚙ Configuración del proyecto** y activa **«Mostrar el archivo de manifiesto appsscript.json»**. Vuelve al editor, abre `appsscript.json`, reemplaza todo por `instalacion/appsscript.json` y guarda.
4. **No toques «Instalar» ni «Implementar» en la plantilla.**
5. Para entregarla: toca **Compartir → Cualquier persona con el enlace (Lector) → Copiar enlace**. Cambia el final `/edit…` por **`/copy`**. Ese es el enlace que le mandas a cada cliente.

---

## Parte 4. 🟩 Cada EMPRESA (unos 10 minutos)

📍 **Estás en:** el enlace `/copy` que recibió el cliente. Hazlo desde un **computador** y con **Chrome o Edge**, porque LibreWolf y Brave bloquean a Google.

1. Toca **Hacer una copia**. Esa copia ya es la 🟩 hoja de la empresa.
2. Espera 10 segundos a que aparezca el menú **Control de jornada**. Elige **Control de jornada → 1. Instalar** y acepta los permisos:
   - Elige tu cuenta.
   - Toca **Configuración avanzada → Ir a Control de jornada (no seguro) → Permitir**.
   - Anota el código **ADM-…** que aparece.
3. Ve a **Extensiones → Apps Script → Implementar → Nueva implementación → ⚙ Aplicación web**. Pon **Ejecutar como: Yo** y **Quién tiene acceso: Cualquier persona**, y toca **Implementar**.
4. Con la misma cuenta, abre https://script.google.com/home/usersettings y activa **«API de Google Apps Script»**. Esto permite que la empresa se actualice sola.
5. Entra a la aplicación como administrador (paso 6) y en **Configuración → Empresa** escribe el **nombre y el NIT** y guarda. En ese momento la empresa aparece en tu consola como «Nueva: asigna plan». Ahí le eliges el plan y los módulos.
6. En la hoja, elige **Control de jornada → 3. Revisar instalación**. Si te pide un enlace, pega la URL de la aplicación web del paso 3. Revisa la pestaña **«Revisión»**:
   - Si todo sale con ✅, arriba está **el enlace de la empresa**.
   - Si algo sale con ❌, la columna B dice exactamente qué hacer. Hazlo y vuelve a usar **3. Revisar instalación**.
7. Abre el enlace de la empresa y entra con tu cédula, el código **ADM-…** y una contraseña nueva.
8. Para agregar trabajadores: entra a **Administrar → Personal → botón de WhatsApp**, que le envía a cada uno su enlace y su código.

> ⚠️ **Igual que en el panel: nunca hagas una segunda «Nueva implementación» en una empresa**, porque cambia el enlace y todos los celulares dejan de conectar. Para publicar cambios usa **Administrar implementaciones → ✏️ → Nueva versión**.

---

## Parte 5. ¿Está funcionando? (cuando quieras)

En la 🟩 hoja de la empresa, elige **Control de jornada → 3. Revisar instalación**. Esto prueba de verdad:
1. Que el servidor esté publicado y abierto a cualquier persona.
2. Que el enlace de los celulares esté bien.
3. Que tu página de GitHub esté en línea.
4. Que las tareas automáticas estén instaladas.
5. Que exista el primer administrador.
6. Que la empresa llegue a tu panel.

Si todo sale con ✅, funciona.

---

## Parte 6. Sacar una versión nueva para todas las empresas

1. Sube la carpeta `docs` nueva a GitHub.
2. En tu **consola**, toca **Versión y actualizaciones → Aprobar esta versión** (o en la hoja del panel: **Aprobar la versión publicada…**). Sin este paso ninguna empresa se actualiza.
3. Esa noche cada empresa se actualiza sola y conserva su enlace.
4. Actualiza también la 🟨 PLANTILLA (Parte 3, paso 1) para que las empresas nuevas empiecen con la versión nueva.

### Empresa instalada antes de la versión 1.8.0 (una sola vez)

📍 **Estás en:** la 🟩 hoja de esa empresa.

1. Haz los pasos 1, 2 y 3 de la Parte 3, pero en esta hoja.
2. Ve a **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**.
3. Elige **Control de jornada → 1. Instalar** y acepta los permisos nuevos.
4. Haz el paso 4 de la Parte 4 (activar la API).
5. Elige **3. Revisar instalación**.

---

## Problemas frecuentes

| Lo que ves | Qué pasa | Qué hacer |
|---|---|---|
| «Sorry, the file you have requested does not exist» | Ese enlace es de una implementación borrada. | Usa **3. Revisar instalación**: te pide la URL buena y la guarda. |
| El celular dice «No pudimos conectar con el servidor» | Puede ser el enlace equivocado (por ejemplo el del panel), el acceso que no está en «Cualquier persona», o un navegador que bloquea a Google. | Usa **3. Revisar instalación** en la hoja de la empresa y prueba en Chrome. |
| Google pide iniciar sesión al abrir el enlace | El acceso quedó en «Cualquier persona con cuenta de Google». | Ve a **Administrar implementaciones → ✏️ → Quién tiene acceso: Cualquier persona → Implementar**. |
| No aparece el menú Control de jornada | La hoja todavía no carga el menú. | Recarga con F5 y espera 10 segundos. |
| Olvidé el código ADM | — | En la hoja, elige **Control de jornada → Ver código del primer administrador**. |
| La empresa no aparece en mi consola | Le falta el NIT (Configuración → Empresa), o el `panel` de `Proveedor.gs` está mal. | Usa **3. Revisar instalación**: lo indica en la última fila. |
