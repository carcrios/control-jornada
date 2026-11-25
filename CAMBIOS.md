# Cambios

## 1.8.0 — 2026-11-24 (actualización automática y panel de proveedor)
- Actualización automática: cada noche la instalación de cada empresa revisa si hay una versión nueva en tu página y se actualiza sola (código, versión y aplicación web, sin cambiar el enlace). También con «Actualizar ahora» en Configuración → Licencia y versión, o en el menú de la hoja. Requiere activar una vez la API de Apps Script en la cuenta de la empresa.
- Proveedor.gs: la dirección de la página, la clave de licencias y el enlace del panel van en un archivo aparte que la actualización nunca toca.
- Panel de proveedor 2: las empresas aparecen solas, los módulos se marcan con casillas por empresa, la licencia le llega sola a cada una cada noche, y se ve la versión, el último reporte y las personas activas de cada empresa. Aviso diario por correo de empresas nuevas, por vencer, vencidas o sin reportar.
- Configuración → «Licencia y versión»: módulos activos, plan, vencimiento, «Buscar mi licencia ahora», versión instalada, «Actualizar ahora» y actualización automática sí/no.
- Corregido: el panel de proveedor anterior emitía llaves sin NIT, que la aplicación rechazaba.
- Foto al marcar: la cámara ocupa toda la pantalla (antes un estilo de las gráficas la deformaba y se veía la aplicación de fondo), con el obturador grande abajo, instrucciones arriba y un óvalo para ubicar la cara.
- Horario de la semana en un paso: en cada obra se pone entrada y salida, se marcan los días que se trabaja (y la salida del sábado si es distinta) y «Aplicar» lo pone en todos con el almuerzo de la obra. El ajuste día por día queda en «Ajustar un día puntual».
- Ingreso más rápido: el servidor devuelve los datos de la pantalla junto con el ingreso (una consulta menos) y la verificación de la contraseña es más liviana (formato v3, sigue protegida con el secreto del servidor). Las contraseñas anteriores se aceptan y se migran solas al siguiente ingreso.
- Encima del botón grande: «Debes ingresar a las 07:00 · faltan 8 min» (o «vas 9 min tarde», resaltado) y, después de llegar, «Tu salida es a las 16:24 · faltan…».
- Pantalla principal: debajo de Entrada y Salida se ve la hora programada y, al marcar, la hora marcada. Se quitó «Otras opciones»: «Se me olvidó marcar» (y «No salí a almuerzo» antes de la hora de almuerzo) quedan visibles debajo del botón grande.
- Color de la empresa siempre legible: si se elige un color claro (gris, pastel, amarillo), se oscurece en el mismo tono hasta que la letra blanca se lea bien (contraste 7:1). En Configuración hay 6 colores sugeridos y una vista previa «Así se verá».
- «Conectar este celular»: si no conecta, muestra un botón para probar el servidor y explica qué hacer en cada caso.
- «Ver el enlace de mi empresa» escribe el enlace en la pestaña «Enlace» de la hoja (algunos navegadores bloquean la ventana emergente).

### Guías ilustradas al día (1.8.0)
- Nueva «Guía de instalación» en PDF (9 páginas). Explica las 3 hojas y qué enlace va dónde, con la consola, la pestaña «Revisión», la regla de «Nueva versión» y los problemas frecuentes.
- Guía del trabajador: nueva sección «El botón de Ayuda».
- Guía del administrador: secciones nuevas «Ayuda para todos» y «Empresa, licencia y módulos».

### Botón de Ayuda (1.8.0)
- Botón flotante «Ayuda» en la aplicación de cada empresa, para trabajadores, supervisores y administradores. Tiene tres pestañas: videos cortos, guías en PDF y preguntas frecuentes de nómina. Cada quien ve lo suyo: el trabajador ve sus 6 videos y el administrador también los de manejo del panel.
- En el celular el botón es pequeño y sube a la esquina de arriba mientras se ve el botón de marcar, para no taparlo nunca.
- Los videos y PDF se publican con la aplicación (docs/ayuda), así que no hay que mandarlos por aparte.

### Consola web del proveedor (1.8.0)
- La URL del panel ahora abre una consola con contraseña. Desde ahí se ven todas las empresas con contadores (nuevas, por vencer, vencidas, sin reportar), se asignan plan, módulos, personas y vencimiento, se renueva con un toque, se suspende, se agrega una empresa por NIT y se aprueba la versión nueva.
- La empresa se reporta al panel apenas su administrador guarda el NIT, y también en «3. Revisar instalación». Ya no hay que esperar a la noche.
- Arreglado: renovar desde un 31 sumaba días de más (31 de enero + 1 mes daba 3 de marzo; ahora da 28 de febrero).

### Instalación más clara (1.8.0)
- Nueva guía INSTALACION.md, ordenada por hoja (panel, plantilla, empresa) para no mezclar enlaces.
- Menú «3. Revisar instalación»: prueba el servidor, el acceso, el enlace de los celulares, GitHub Pages, las tareas, el administrador y el panel, y dice cómo arreglar cada cosa.
- «2. Ver el enlace de mi empresa» comprueba que el enlace responda antes de mostrarlo. Si Google entrega una implementación vieja o borrada, pide la URL buena y la guarda.
- Panel: «0. Configurar» pide la URL real del panel (Google a veces entrega una vieja).

### Sin señal y velocidad (1.8.0)
- Sin señal: la marcación se guarda primero en la memoria rápida del celular (si el teléfono se apaga ya, no se pierde) y la copia con foto tiene tiempo límite de 3 s.
- Si la sesión vence justo al marcar, la marcación queda guardada y se envía sola al volver a entrar.
- «Me equivoqué, deshacer» también funciona con marcaciones guardadas sin señal (2 minutos).
- Las marcaciones pendientes se envían desde cualquier pantalla (Pagos, Perfil…), al volver la señal y cada minuto.
- GPS en frío: tercer intento de 30 s que acepta una ubicación de hasta 5 minutos. Una marcación sin señal con GPS impreciso ya no se rechaza: queda para revisión.
- Velocidad: informes, nómina, historial, cierre y presupuesto de obras leen solo las filas desde la fecha pedida (con verificación: si no alcanza, leen todo). La tarea de la madrugada hace limpieza y archivo en bloqueos separados, y la limpieza reescribe solo las columnas de foto y GPS de las filas que cambian.

### Correcciones de la revisión con ocho revisores (1.8.0)
- Actualización segura: solo desde la página del proveedor (Proveedor.gs), con versión aprobada en el panel y huella sha256; no cambia acceso ni permisos sin pasar por la hoja; retoma una actualización a medias; bloqueo propio; no actualiza en cierre de nómina; «Volver a la versión anterior».
- Panel de proveedor: cada empresa firma sus reportes (HMAC), no se puede pedir la llave de otro NIT, se neutralizan fórmulas, bloqueo contra escrituras cruzadas; solo se envía NIT, empresa, versión, personas y contacto.
- Salida olvidada: funciona sin señal, respeta turnos de noche y no marca entradas que nadie pidió; dice la fecha real («Falta la salida del viernes 20»).
- Nómina: domingo/festivo ocasional paga hora + recargo; almuerzo descontado en días sin horario; permisos por horas sin la hora de almuerzo; prórrogas de incapacidad encadenadas; febrero a 30 días; bases de vacaciones e incapacidad con promedio; excedente no salarial del 40 % al IBC.
- Nuevo: «Pagar prima o intereses de cesantías» en Nómina → Provisiones: vista previa por semestre o año, Excel y registro como pagado (no se duplica).
- Rendimiento: lectura de marcaciones según el tamaño de la empresa, índice por persona, ingreso fuera del bloqueo general, foto subida a Drive antes del bloqueo, correos y Telegram después de soltarlo, tablero en caché 60 s y una sola llamada al entrar, alertas agrupadas siempre con más de 30 personas, recordatorios con reserva de cupo de correo.
- Comunicados: los personales ya no ocultan los generales; no se puede marcar como leído un mensaje ajeno.
- Seguridad: cerrar todas las sesiones (cambio de clave, salir de todos los equipos, inactivar, liberar celular) también anula el acceso rápido con PIN o huella.
- Celular: marcar espera máximo 15 s antes de guardar en el celular; mensaje sin señal neutral; versión del service worker la pone la compilación.
- Accesibilidad: la confirmación ya no se cierra con cualquier toque, dura 8–12 s, se cierra con Escape, atrapa el foco y lo devuelve; sin voz doble al dictar; aviso de micrófono en pantalla (no ventana emergente); estados de la jornada leídos por el lector; áreas táctiles de 44 px.

## 1.7.0 — 2026-11-20 (unión con las mejoras de la versión del aliado)
- Permiso en la tarde sin volver: en el permiso rápido, «Hoy, salgo y no vuelvo» pide solo la hora de salida; el regreso queda para el siguiente día con turno en su obra (si es viernes y no se trabaja sábado, el lunes). Al tocar «Salir a mi permiso» se marca la salida del día y no aparece como salida olvidada al día siguiente.
- Dudas y novedades de nómina: desde «¿Dudas sobre tu pago?» el trabajador envía su duda a la persona de nómina (tema, día opcional y texto escrito o dictado) y ve ahí mismo la respuesta. Nómina las responde en Pago → Guía de nómina → «Dudas de trabajadores» (también las ve el supervisor de esa persona). Aparecen en «Qué necesito atender hoy», llegan como alerta y la respuesta le llega al trabajador en la aplicación y por correo.
- El almuerzo ya no se marca: el trabajador solo marca «Llegué» y «Me voy», y se descuenta la hora de almuerzo del horario de la obra. Se mantiene «No salí a almuerzo», visible desde la hora de inicio del almuerzo. Si una empresa quiere que se marque, lo activa en Configuración → Reglas de marcación.
- Salida olvidada: al llegar al día siguiente y tocar «Llegué», la aplicación pregunta primero a qué hora salió el día anterior (sugiere la hora de salida del horario), la registra y marca la llegada. También desde el aviso rojo «Registrar mi salida de ese día».
- Se quitó el texto «toca una vez» debajo del botón, que parecía otro botón.
- Trabajador más fácil: un solo botón grande con lo que toca ahora («Llegué», «Salgo a almorzar», «Volví del almuerzo», «Me voy»); los recordatorios en una línea y el resto plegado.
- Confirmación a pantalla completa: verde con la hora en grande, vibración y voz si está activada; ámbar si quedó fuera de la obra o guardada sin señal.
- Deshacer un toque equivocado durante 2 minutos (solo la última marcación propia hecha en línea; queda en auditoría y recalcula las extras).
- Entrar rápido con PIN (4 a 6 números, no se aceptan PIN fáciles) o con la huella del celular. Funciona solo en ese celular, se desactiva tras 5 intentos fallidos y no aplica a administradores.
- Pedir permiso en 3 toques: para qué, cuándo y enviar. El formulario completo con soporte sigue a un toque.
- «Mi pago» en una frase: horas, extras aprobadas y cuánto va el pago, ya con descuentos.
- Guía de nómina: se le pregunta con palabras propias, escritas o dictadas, y responde con las reglas vigentes de la configuración y con los valores de la persona (su hora, sus extras, si le corresponde auxilio). También lee la respuesta en voz alta. La tienen el trabajador (Pagos y tarjeta de pago) y el administrador (Pago → Guía de nómina, con preguntas propias del cierre).
- Asistente de puesta en marcha: una empresa nueva queda lista en 5 pasos (empresa, primera obra, horario, personal y enlace para compartir), sin saber dónde está cada menú.
- Plantillas de horario de 42 h (lunes a viernes de obra, con sábado, oficina, corrido, etc.) al crear o editar una obra.
- Importar personal desde Excel con revisión previa: detecta las columnas solo y marca cédulas inválidas, repetidas, sin salario o sin obra antes de importar.
- «Qué necesito atender hoy» en el tablero: quién no ha marcado, quién no marcó salida ayer, días sin revisar, permisos, extras, almuerzos, riesgo de fatiga y salarios sin validar, cada uno con su botón «Resolver».
- Errores en lenguaje claro: los mensajes técnicos del servidor (cuota, tiempo agotado, bloqueo, nómina cerrada) se explican con qué hacer.
- Nómina como flujo guiado: pasos 1-2-3-4 y lista de inconsistencias antes de cerrar (jornadas sin salida, extras o almuerzos sin decidir, permisos pendientes, salarios o cuentas faltantes), cada una con el botón que lleva a corregirla.
- Recordatorios con cálculo para el trabajador: «te quedan 10 minutos para el almuerzo», «ayer no marcaste salida» (con botón para registrarla), fin de jornada, horas trabajadas y aviso de fatiga.
- Acciones rápidas en Personal: ver expediente, registrar una marcación olvidada, enviar un recordatorio personal (llega en la aplicación y por correo), revisar permisos y editar, sin salir de la lista.
- Búsqueda global (Ctrl+K) arriba del panel: personas por nombre o cédula (abre su expediente), obras y secciones.
- Informes de un clic con su periodo ya puesto: Tardanzas de la semana, Extras por obra, Riesgo de fatiga (jornadas que superan el límite configurado) y Presupuesto contra lo real (horas y costo de cada obra frente a su presupuesto prorrateado).
- Supervisor con gente asignada: cada persona puede tener su supervisor (Personal → Editar, o a varias a la vez con «Trasladar o asignar supervisor»). El supervisor ve solo a su gente asignada y a quien no tiene supervisor en sus obras; ya no ve a todos.
- «Revisión del día» para el supervisor: ve entrada, almuerzo, salida, horas trabajadas, tardanzas, extras y marcas fuera de la obra de cada persona; confirma «Horas correctas» (una por una o todas las completas a la vez), «No vino» o «Novedad» con nota (dictable). Las novedades le llegan al administrador. Informes nuevos: «Revisión de supervisores» y agrupar por supervisor.
- «Ubicación de obras» para el supervisor: fija la ubicación y el radio de su obra con el GPS del celular, parado en la obra (rechaza GPS impreciso; queda en auditoría y se avisa al administrador).
- Menos digitación: los formularios recuerdan los textos usados antes (motivos, razones, notas) y los ofrecen para tocar; se recuerda el último autorizador del almuerzo.
- Accesibilidad: «Leer esta pantalla en voz alta», «Leer en voz alta lo que toque» y «Hablar por mí» para quien no puede hablar (frases rápidas o texto escrito que el celular dice en voz alta y muestra en letra gigante).
- Almuerzo por obra: en cada obra se define la hora de almuerzo y se aplica a todos los días con un botón (cada día se puede ajustar). El trabajador ve su horario y su almuerzo.
- «No salí a almuerzo»: el trabajador lo reporta eligiendo quién lo autorizó (supervisores, administradores y jefes de su obra, u otra persona) y escribiendo o dictando la razón. Su siguiente paso pasa a ser la salida. El jefe lo aprueba o rechaza en Horas extra; aprobado, el tiempo de almuerzo cuenta como trabajado y se recalculan las extras.
- «Salir a mi permiso»: cuando el trabajador tiene un permiso aprobado para hoy, aparece arriba de su jornada con el botón para salir. Guarda la hora real y la ubicación; si no regresa ese día, cierra la jornada con la salida. En permisos por horas aparece después «Regresé del permiso». Si sale antes o regresa después de lo aprobado, llega una alerta. El panel muestra la salida y el regreso reales en Permisos.
- Accesibilidad: botón en todas las pantallas (también ingreso y kiosco) con tamaño de letra (normal, grande, muy grande), alto contraste, lectura de avisos en voz alta, reducir movimiento, subrayar enlaces y tema claro fijo. Dictado por voz con micrófono en todas las casillas de texto y buscadores (para números se pueden decir dígito por dígito). El kiosco confirma cada marcación en voz alta. Revisión automática WCAG 2.1 AA (axe) sin errores en las 27 pantallas principales.
- Diseño: saludo con el nombre y la hora para el trabajador, el administrador y el kiosco; una sola acción de marcar (las demás en «Otras opciones»); pasos de la jornada más claros; lo ganado en grande con barra de avance del periodo; menú del panel con buscador, nombres cortos y grupos plegables; indicadores que resaltan lo que pide atención; gráfica «Cómo va cada obra hoy»; kiosco con logo, obra y reloj grande; fechas con año en documentos para firma.
- Revisada en cuatro rondas por cuatro revisores (comprador de Gestión Humana, seguridad y Ley 1581, nómina y ley laboral, calidad móvil) hasta que ninguno encontró algo que impida venderla. Detalle en REVISION.md.
- Kiosco con sesión propia por centro, que solo se apaga con la clave de un supervisor.
- Préstamos con autorización firmada y tope legal automático; liquidación de contrato completa (indemnización art. 64, base 360, jornaleros, registro e impresión para firma).
- Bandeja sin señal por persona: en un celular compartido nadie envía ni ve marcaciones de otro.
- Módulos nuevos con pantalla propia: tablero en vivo, modo kiosco para tablet de portería, QR rotativo por obra,
  préstamos y anticipos, banco de compensatorios, comunicados con confirmación de lectura, presupuesto por obra,
  provisiones de prestaciones, liquidación de contrato, expediente por persona y traslado masivo entre obras.
- Autoservicio del trabajador (pestaña «Más»): mi horario, comunicados, préstamos y compensatorios, mis extras,
  reportar incapacidad, certificado laboral imprimible y verificable en línea, contactos de emergencia y cerrar
  todas las sesiones. Acuse de recibo de desprendibles.
- Seguridad: polígono de obra, precisión mínima de GPS, foto obligatoria en marcaciones dudosas, celular
  vinculado por cuenta, código por correo para administradores (2FA), sesión de administrador de 24 h,
  auditoría encadenada con verificación, supresión de datos personales.
- Alertas agrupadas por hora y alertas opcionales por Telegram.
- Licencia por planes (básico, profesional, empresa). Al vencer, el panel queda en modo consulta; los
  trabajadores siguen marcando con normalidad.
- Correcciones sobre la versión del aliado: el archivo histórico ya no lo borra la rotación de copias; permiso
  de conexión externa para Telegram; la liquidación usa el promedio del último año cuando el salario es variable
  y no descuenta préstamos sin autorización escrita; el certificado tiene página pública de verificación; se
  restauró la validación del orden de las marcaciones; página y demo reconstruidas en 1.7.0.

## 1.2.0 — 2026-11-17
- Informes versátiles: cualquier rango de hasta 90 días; agrupar por persona, centro, cargo, día, semana, mes,
  día de la semana o total; filtros por centro, cargo y persona; 20 medidas a elegir (horas, extras, nocturnas,
  dominicales, tardanzas, ausencias, ausentismo, permisos, incapacidades, marcaciones digitadas o fuera de zona,
  costo); gráfica y tabla con totales; seis informes listos; informes guardados; descarga a Excel y CSV.
- El costo por obra ahora se reparte según las horas trabajadas en cada obra, y se puede sumar un factor
  prestacional (Configuración → Reglas). Los supervisores ven los informes de su gente sin costos.
- El trabajador consulta sus jornadas, horas, extras, tardanzas y neto estimado por semana, mes o periodo.

## 1.1.0 — 2026-11-17
- Instalación desde plantilla: el cliente copia una hoja, usa «Instalar», publica y recibe el enlace de su
  empresa. Una sola página para todos los clientes; cada celular se conecta con el enlace de su empresa.
- Rol de supervisor por obra, turnos rotativos con programación por fechas, recuperar contraseña por correo.
- Bonos, auxilios y descuentos; extras en lote; permisos registrados por RRHH; datos bancarios; fecha de retiro.
- Primeros pasos en el panel. Correcciones de seguridad, nómina y uso sin señal: ver REVISION.md.

## 1.0.1 — 2026-11-15
- Corregido: tras crear la cuenta la aplicación se quedaba en «Actualizamos las políticas». Google Sheets
  convertía la versión «2026-11» en fecha; ahora todo valor se guarda como texto literal.
- Nuevo: control de fatiga (alerta al acercarse al máximo de horas continuas, configurable en Alertas).
- Nuevo: archivos planos CSV por nómina cerrada (conceptos con códigos contables configurables, y pagos).
- Las hojas técnicas (Sesiones, Auditoria, Errores) quedan ocultas al instalar.

## 1.0.0 — 2026-11-15
- Primera versión: marcación con GPS y foto al azar, olvido de marcación, permisos con firma de jefes
  y envío por WhatsApp, incapacidades, horas extra con aprobación, nómina estimada y desprendibles,
  resumen por obra, exportación a Excel, alertas por correo, configuración por empresa, páginas
  legales, copias de seguridad, retención automática y monitoreo.
