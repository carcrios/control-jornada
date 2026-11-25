# Guía de instalación: Control de jornada

> **Usa primero `INSTALACION.md`**: es la guía corta y ordenada por hoja (panel, plantilla, empresa). Esta guía queda como referencia del mapa de la aplicación y de los trabajadores.

Esta guía te indica **exactamente dónde hacer clic** en cada pantalla. Está dividida en:
* **Sección A (Solo para ti, como proveedor):** cómo subir la app a GitHub, crear tu plantilla y configurar tu Panel de Proveedor *(se hace una sola vez)*.
* **Sección B (Para cada empresa cliente):** cómo activar su copia en 10 minutos.

---

## Sección A: Publicación inicial en GitHub y Plantilla (solo una vez)

### A1. Subir la aplicación a GitHub y activar la página web
1. Entra a [github.com](https://github.com) e inicia sesión (o crea una cuenta gratuita).
2. Mira **arriba a la derecha**, haz clic en **`+`** → **New repository**.
3. En **Repository name** escribe `control-jornada`, déjalo en **Public** (obligatorio para GitHub Pages gratis) y clic en **Create repository**.
4. En la pantalla nueva, haz clic en el enlace azul **uploading an existing file** y arrastra los archivos de la carpeta `control-jornada`. Abajo haz clic en el botón verde **Commit changes**.
5. **Activa GitHub Pages:**
   * En la barra superior de tu repositorio, haz clic en **Settings**.
   * En el menú de la izquierda, haz clic en **Pages**.
   * En **Branch**, selecciona `main`, al lado cambia `/ (root)` por **`/docs`**, y haz clic en **Save**.
6. Espera 1–2 minutos y recarga la página: arriba aparecerá tu enlace público (ejemplo: `https://tu-usuario.github.io/control-jornada/`). **Copia ese enlace.**

### A2 y A3. Tu plantilla y tu panel de proveedor
Sigue **`GUIA-PROVEEDOR.md`**, partes A y B. Ahí creas el panel de proveedor, que te da tu clave y el archivo `Proveedor.gs`, y luego la plantilla con `ControlJornada.gs` y `Proveedor.gs`.

Para entregarla:
1. En la hoja de tu plantilla, toca el botón azul **Compartir** → **Cualquier persona con el enlace (Lector)** → **Copiar enlace**.
2. Cambia el final del enlace (`/edit...`) por **`/copy`**. Ese es el enlace que le envías a cada cliente.

**No ejecutes «Instalar» ni «Implementar» en la plantilla.**

---

## Sección B: Instalación en cada empresa cliente (10 minutos)

> **Importante:** haz la instalación desde un **computador** usando el correo de Google de tu empresa. Todo se guarda en tu propio Google Drive.

### Paso 1. Crear tu copia en Google Sheets
* **Dónde estás:** en el enlace que te enviamos (se abre en tu navegador).
* **Qué hacer:**
  1. Verás una pantalla blanca con un botón azul en el centro que dice **Hacer una copia**. Haz clic ahí.
  2. Espera unos segundos: se abrirá una hoja de cálculo de Google (parecida a Excel). **Esta ya es la hoja de tu empresa.**

### Paso 2. Instalar el sistema en la hoja
* **Dónde estás:** dentro de tu hoja de cálculo de Google.
* **Dónde mirar:** en la **barra de menús de arriba** (donde dice *Archivo · Editar · Ver · Insertar · Formato · Datos · Herramientas · Extensiones · Ayuda*).
* **Qué hacer:**
  1. Espera unos 10 segundos y verás que aparece un menú nuevo a la derecha de *Ayuda* llamado **Control de jornada**.
  2. Haz clic en **Control de jornada** → luego clic en **1. Instalar**.
  3. Se abrirá una ventana de Google pidiendo permiso:
     * Haz clic en la cuenta de correo de tu empresa.
     * Si aparece una advertencia que dice *"Google no ha verificado esta aplicación"*, busca abajo a la izquierda el enlace pequeño **Configuración avanzada** y haz clic.
     * Luego haz clic abajo en **Ir a Control de jornada (no seguro)** → y en la siguiente pantalla clic en **Permitir**.
  4. Al terminar saldrá un cuadrito con un código que empieza por `ADM-...` (ejemplo: `ADM-9F4K2L8P1Q`). **Anótalo o tómale foto**, lo vas a necesitar en el Paso 4.

### Paso 3. Publicar la aplicación web
* **Dónde estás:** sigues en tu hoja de cálculo de Google.
* **Dónde mirar:** en la **barra de menús de arriba**, busca **Extensiones**.
* **Qué hacer:**
  1. Haz clic en **Extensiones** → clic en **Apps Script** (se abrirá una pestaña nueva del navegador).
  2. En esa pestaña nueva, mira **arriba a la derecha**: hay un botón azul que dice **Implementar**. Haz clic ahí → elige **Nueva implementación**.
  3. Se abre una ventana. Mira **arriba a la izquierda** de esa ventana: hay un ícono de engranaje (**⚙**) al lado de *"Seleccionar tipo"*. Haz clic en el engranaje y elige **Aplicación web**.
  4. A la derecha verás dos listas desplegables. Déjalas así:
     * **Ejecutar como:** `Yo`
     * **Quién tiene acceso:** `Cualquier persona`
  5. Haz clic en el botón azul **Implementar** (abajo a la derecha). Si vuelve a pedir permisos, acéptalos igual que en el Paso 2.
  6. Cuando salga el mensaje de confirmación, haz clic en **Listo** y cierra esa pestaña.

### Paso 3b. Permitir las actualizaciones automáticas (una sola vez, 30 segundos)
* **Qué hacer:** con la misma cuenta de Google, abre **https://script.google.com/home/usersettings** y activa el interruptor **«API de Google Apps Script»**.
* **Para qué:** así tu aplicación se actualiza sola cada noche con las mejoras, sin que tengas que tocar nada y sin cambiar el enlace.

### Paso 4. Entrar por primera vez como administrador
* **Dónde estás:** de vuelta en tu hoja de cálculo de Google.
* **Dónde mirar:** en la **barra de menús de arriba**, clic en **Control de jornada**.
* **Qué hacer:**
  1. Haz clic en **Control de jornada** → **2. Ver el enlace de mi empresa**.
  2. Aparecerá un aviso con el enlace, que también queda escrito en la pestaña **«Enlace»** de la hoja. Ábrelo en Chrome o Edge.
  3. En la pantalla de ingreso:
     * Escribe tu **cédula**.
     * Donde pide **Código de activación**, pega el código `ADM-...` que anotaste en el Paso 2.
     * Crea tu **contraseña** (mínimo 6 caracteres) y acepta las casillas de políticas.
  4. ¡Listo! Ya entraste al panel de tu empresa.

---

## Mapa rápido: ¿Dónde encuentro cada cosa dentro de la aplicación?

Cuando entras como administrador, verás un **botón arriba a la derecha** que cambia entre **Mi jornada** (para marcar tú) y **Administrar** (el panel de la empresa).

Dentro de **Administrar**, usa el **menú de pestañas** (a la izquierda en computador, o arriba en celular):

| Si quieres… | Dónde entrar |
|---|---|
| Cambiar nombre, NIT, logo y correo de alertas | **Configuración → Empresa** |
| Ver tu plan, tus módulos, la versión y actualizar | **Configuración → Licencia y versión** |
| Crear obras / sedes, poner ubicación en mapa, horarios y radio GPS | **Centros** (o *Centros de trabajo*) |
| Agregar trabajadores, importarlos desde Excel o enviarles enlace por WhatsApp | **Personal** |
| Revisar entradas/salidas, tardanzas, fotos o corregir una marcación | **Marcaciones** |
| Aprobar o rechazar horas extra | **Horas extra** |
| Revisar permisos firmados por jefes o registrar incapacidades | **Permisos** / **Incapacidades** |
| Asignar turnos rotativos a trabajadores | **Turnos** |
| Ver nómina estimada, cerrar quincena/mes o descargar Excel | **Nómina** / **Informes** |
| Ver copias de seguridad, pruebas del sistema o errores | **Sistema y respaldo** |

---

## Parte 2: Cómo entran tus trabajadores (en el celular)

1. En el panel **Administrar → Personal**, busca al trabajador y toca el botón de **WhatsApp**. Eso le envía el enlace de tu empresa y su código de activación.
2. El trabajador abre el enlace en su celular, confirma el nombre de tu empresa, escribe su **cédula**, pega el **código** y crea su contraseña.
3. Para dejar el ícono instalado en el celular:
   * **Android (Chrome):** toca los **3 puntos (⋮)** arriba a la derecha → **Instalar aplicación**.
   * **iPhone (Safari):** toca el botón **Compartir** (cuadro con flecha abajo en el centro) → **Agregar a pantalla de inicio**.
4. Cuando la app pida permiso de **ubicación (GPS)** y **cámara**, debe tocar **Permitir**.
5. En la pantalla principal verá un solo botón grande: **Llegué** al llegar y **Me voy** al salir. El almuerzo no se marca: se descuenta solo según el horario de la obra.

---

## Solución rápida a problemas comunes

* **No aparece el menú «Control de jornada» en Google Sheets:** recarga la página (F5) y espera 10 segundos.
* **Olvidé el código `ADM-...`:** en tu hoja de Google Sheets, menú arriba **Control de jornada → Ver código del primer administrador**.
* **Un trabajador olvidó su contraseña:** entra a **Administrar → Personal**, busca a la persona y genera un **nuevo código de activación**.
* **Un trabajador cambió de celular:** en **Administrar → Personal**, busca a la persona y usa **Liberar dispositivo**.
* **¿Dónde están las copias de seguridad?** Abre tu **Google Drive** y busca la carpeta **«Control de jornada - Copias de seguridad»**.


## Si el enlace no abre («no puede conectarse al servidor … script.googleusercontent.com»)
Pasa con navegadores que bloquean los dominios de Google por privacidad (LibreWolf, Brave, Firefox en modo estricto, o un bloqueador de anuncios). No es un problema de la instalación.
1. El menú **Control de jornada → 2. Ver el enlace de mi empresa** ahora también escribe el enlace en la pestaña **«Enlace»** de la hoja. Cópialo de ahí.
2. Abre la hoja y la aplicación en **Chrome, Edge o Safari**, o desactiva el bloqueador o la protección estricta para `docs.google.com`, `script.google.com` y `script.googleusercontent.com`.
3. Los trabajadores deben usar el navegador normal del celular (Chrome en Android, Safari en iPhone).
