# Manual de uso: Control de jornada

Este manual explica **cómo funciona la aplicación en el día a día** para cada tipo de usuario: **Trabajador**, **Supervisor/Jefe**, **Administrador (RRHH)** y **Proveedor**.

---

## 1. ¿Cómo funciona para el Trabajador? (desde el celular)

### Marcar jornada (Entrada, Almuerzo y Salida)
1. Abre la aplicación instalada en tu celular.
2. Toca el botón principal (**Marcar Entrada**, **Salida a almuerzo**, **Regreso de almuerzo** o **Marcar Salida**).
3. La app toma tu **ubicación GPS** automáticamente:
   * Si el centro exige **QR dinámico o código del día**, te pedirá escanear el QR de portería o escribir el código que entregó el supervisor.
   * Si sale foto aleatoria (o estás fuera de zona / con señal GPS débil), se abrirá la cámara para tomar una foto de verificación.
4. **¿Qué pasa si no hay internet en la obra?**
   Marca igual: el registro (con hora corregida, GPS y foto) se guarda en tu celular y se envía automáticamente apenas vuelvas a tener señal.
5. **¿Se te olvidó marcar?**
   Usa la opción **Se me olvidó marcar**, escribe la hora y el motivo. Ese registro queda en revisión para que el administrador lo valide.

### Qué más puede ver y hacer el trabajador
* **Mi horario (`miProgramacion`):** ver qué turno, obra, festivo, descanso, permiso o incapacidad tiene en los próximos 14 días.
* **Permisos:** solicitar permisos o vacaciones, adjuntar soporte y enviar el enlace de firma por WhatsApp a su jefe.
* **Incapacidades (`incapacidadReportar`):** subir la foto de su incapacidad médica con fechas para que RRHH la valide.
* **Desprendibles de pago:** consultar sus quincenas/meses cerrados y tocar **Confirmar recibido** (acuse de recibo).
* **Horas extra, préstamos y compensatorios:** consultar sus horas extra aprobadas/pendientes, el saldo de sus préstamos/cuotas y su banco de horas compensatorias.
* **Certificado laboral:** generar su carta laboral (con o sin salario) con código de verificación en 1 clic.
* **Comunicados y emergencias:** leer circulares de la empresa (con confirmación de lectura) y consultar en 1 toque su ARL, EPS y teléfonos de emergencia.
* **Seguridad de su cuenta:** cambiar contraseña o cerrar sesión en todos sus dispositivos.

---

## 2. ¿Cómo funciona para el Supervisor / Jefe?

* **Firmar permisos desde WhatsApp:** cuando un trabajador pide permiso, al jefe le llega un enlace. Al abrirlo, ingresa su **clave de firma (PIN de 6–8 dígitos)** y aprueba o rechaza.
* **Vista en vivo («Quién está en obra ahora»):** ve en tiempo real quién ya entró, quién está en almuerzo, quién ya salió, quién no ha llegado y cuántas horas lleva cada persona de sus centros asignados.
* **QR dinámico / Código del día:** puede mostrar en una tablet el QR que rota cada 60 segundos o ver el código diario para dárselo al personal presente en obra.
* **Modo Kiosco:** si hay una tablet compartida en portería, el supervisor la deja abierta para que los trabajadores sin celular marquen con su cédula, clave y foto.
* **Aprobar horas extra:** revisa las horas extra de su equipo y decide si se **aprueban para pago**, se **rechazan** o se **abonan al banco de compensatorios**.

---

## 3. ¿Cómo funciona para el Administrador / RRHH?

### Gestión diaria
* **Personal:** crear trabajadores, importarlos desde Excel, enviarles su enlace por WhatsApp, registrar tipo y fecha de vencimiento de contrato (la app avisa 35 días antes), trasladar grupos entre obras, liberar dispositivos bloqueados o anonimizar exempleados (Ley 1581).
* **Centros de trabajo / Obras:** configurar ubicación en mapa, geocerca circular o por **polígono**, horario por día, si exige QR y **presupuesto de horas y costo** (alerta automática al 80 % y 100 %).
* **Turnos:** crear turnos rotativos y programarlos por rango de fechas.
* **Marcaciones:** revisar tardanzas, fotos, alertas de GPS sospechoso y corregir o anular registros (todo queda en auditoría).

### Nómina, finanzas y analítica
* **Novedades y Préstamos:** registrar bonos, auxilios, descuentos y préstamos en cuotas. Al **cerrar la nómina**, las cuotas de préstamos activos se descuentan automáticamente.
* **Cierre de nómina:** calcula salario, recargos nocturnos, dominicales/festivos, horas extra aprobadas, auxilio de transporte, salud, pensión y fondo de solidaridad bajo normativa colombiana. Un periodo cerrado queda inmutable y genera el desprendible de cada trabajador.
* **Provisiones y Liquidación de contrato:** calcula las provisiones de prestaciones sociales (prima, cesantías, intereses y vacaciones) y permite simular la liquidación final al retirar a un empleado.
* **Informes y Tablero 360°:** exportar a Excel/CSV y consultar el **Expediente 360°** de cualquier trabajador o el **Tablero gerencial 360°** de toda la empresa.

### Seguridad y respaldos
* **Alertas:** configurables por correo (inmediatas o agrupadas cada hora) y por **Telegram** (gratis e ilimitado).
* **Copias de seguridad:** automáticas cada 7 días en Google Drive (se conservan las últimas 8).
* **Auditoría íntegra:** cada cambio queda encadenado con hash criptográfico para detectar manipulaciones manuales en Sheets.

---

## 4. ¿Cómo funciona para ti como Proveedor? (Planes y Cobro)

Desde tu hoja privada con `PanelProveedor.gs` controlas a todos tus clientes:

| Plan | Tope usuarios | Módulos incluidos |
|---|---|---|
| **Básico** | 25 | Control de asistencia, GPS, fotos, horarios y exportación. |
| **Profesional** | 80 | Todo lo de Básico + Nómina, Permisos, Turnos, Préstamos, Compensatorios, Certificado laboral y Comunicados. |
| **Empresa** | 150 | Todo lo de Profesional + Modo Kiosco, QR dinámico, Polígonos, Presupuesto por obra, Tablero/Expediente 360° y Seguridad Pro (2FA, bloqueo de dispositivo, auditoría encadenada). |

* **Si un cliente paga o renueva:** en tu hoja `Clientes`, seleccionas su fila → **Panel de Proveedor → 3. Renovar cliente (+30 días)** → le envías la nueva llave por WhatsApp.
* **Si un cliente deja de pagar:** al pasar la fecha de vencimiento, la aplicación **se bloquea automáticamente** y solo permite al administrador ingresar para pegar la nueva llave de renovación.

## Novedades de la versión 1.7

**Trabajador — pestaña «Más».** Mi horario de la semana, comunicados de la empresa (con confirmación de lectura),
préstamos y días compensatorios, mis horas extra, reportar una incapacidad con foto del soporte, certificado
laboral (se imprime y trae un código que cualquiera verifica en la página de la empresa, opción «verificar»),
contactos de emergencia y «cerrar sesión en todos mis celulares». En «Pago», cada desprendible tiene el botón
«Confirmar recibido».

**Panel del administrador.**
- *En vivo*: quién está trabajando en cada obra en este momento.
- *Modo kiosco*: convierte una tablet en marcador de portería para un centro (cédula + contraseña + foto). Al activarlo se
  cierra tu sesión en ese equipo. Solo marcan las personas asignadas a ese centro. Para apagarlo, «Salir del kiosco» pide
  la cédula y contraseña de un supervisor del centro o de un administrador.
- *Centros de trabajo → QR*: QR que cambia solo cada minuto; si activas «Exigir QR», el trabajador debe
  escanearlo en la obra. También se puede dibujar el polígono de la obra y fijar un presupuesto de horas y costo.
- *Préstamos y compensatorios*: cada préstamo exige la foto de la autorización firmada. La cuota se descuenta sola al cerrar
  la nómina, sin dejar a la persona por debajo del mínimo vital ni descontar más del 50 % del neto; lo que falte pasa al
  periodo siguiente. Los abonos de compensatorio exigen la foto del acuerdo y el descanso se paga como permiso remunerado.
  Abonar horas extra a compensatorio viene apagado (Configuración → Reglas): el Ministerio del Trabajo considera que se pagan.
- *Comunicados*: mensajes a toda la empresa, a una obra o a un cargo, con informe de quién los leyó.
- *Nómina → Provisiones*: prestaciones y aportes del empleador (la tarifa de ARL se fija por empresa y por obra; la
  exoneración de salud, SENA e ICBF viene apagada: actívala solo si tu contador lo confirma).
- *Nómina → Liquidación de contrato*: elige persona, fecha y causa. Calcula salario pendiente, cesantías, intereses, prima,
  vacaciones e indemnización. «Registrar e imprimir para firma» la guarda (una vez por persona, con retiro de hoy o antes),
  deja a la persona inactiva, la saca de la nómina de esa quincena y salda el préstamo descontado.
- *Personal → Expediente*: todo lo de una persona en una sola hoja. *Personal → Trasladar*: mover a varias
  personas de obra a la vez.
- *Configuración → Seguridad*: celular vinculado, código por correo para administradores, precisión de GPS,
  foto en marcaciones dudosas. *Configuración → Licencia*: plan y llave.
- *Alertas*: resumen por hora y Telegram opcional. *Sistema → Verificar auditoría*: confirma que nadie editó
  a mano el registro de cambios.

## Para el trabajador: lo más fácil posible
- **Marcar:** un solo botón grande dice lo que toca: «Llegué» o «Me voy». El almuerzo no se marca: se descuenta la hora de almuerzo del horario de la obra. Si no salió a almorzar, toca «¿No saliste a almuerzo? Repórtalo».
- **Se me olvidó la salida:** al llegar al otro día y tocar «Llegué», la aplicación pregunta a qué hora salió ayer, lo guarda y marca la llegada. Al tocarlo, la pantalla se pone verde con la hora en grande y el celular vibra.
- **Me equivoqué:** durante 2 minutos aparece «Deshacer». Después hay que pedir el ajuste al supervisor.
- **Sin señal:** la pantalla dice «Guardado en tu celular» y la marcación se envía sola.
- **Entrar sin clave:** en Perfil → «Entrar rápido», crea un PIN o activa la huella. Si la sesión se cierra, entra con eso.
- **Pedir permiso:** Permisos → Pedir permiso → para qué → cuándo → Enviar. Si sale en la tarde y no vuelve ese día, elige «Hoy, salgo y no vuelvo» y pon la hora de salida.
- **Dudas del pago:** en Pagos, o en «¿Dudas sobre tu pago?», escribe o dicta la pregunta (por ejemplo «¿cuánto me pagan un domingo?»). Si no aparece la respuesta, toca «Envía tu duda o novedad a nómina»: eliges el tema, el día si aplica y lo cuentas. La respuesta aparece ahí mismo.

## Trabajar más rápido (atajos del administrador)
- **Qué necesito atender hoy** (en «Hoy»): la lista de pendientes del día con un botón «Resolver» en cada uno. Si dice «Todo al día», no hay nada urgente.
- **Buscar cualquier cosa:** presiona Ctrl+K (o toca el buscador de arriba) y escribe un nombre, una cédula o una obra. Al elegir a una persona se abre su expediente.
- **Acciones rápidas:** en Personal, el botón «Acciones» de cada fila permite registrar una marcación olvidada (fecha, qué faltó, hora y motivo), enviarle un recordatorio, revisar permisos o editar sus datos.
- **Informes de un clic:** en Informes, las cuatro tarjetas de arriba dan el informe listo con su periodo: tardanzas de la semana, extras por obra de la quincena, riesgo de fatiga y presupuesto contra lo real del mes. Para el último, cada obra necesita su presupuesto de horas y costo (Obras y sedes → Editar).
- **Nómina guiada:** sigue los pasos 1 a 4. Antes de cerrar, resuelve lo marcado en rojo en «Antes de cerrar».

## Accesibilidad y dictado
- El ícono de accesibilidad (figura humana) está arriba a la derecha en todas las pantallas, también en el ingreso y en el kiosco. En el celular del trabajador también está en Perfil.
- Opciones: tamaño de letra, alto contraste (útil a pleno sol), leer los avisos en voz alta, reducir el movimiento, subrayar enlaces y usar siempre el tema claro. Se guardan en ese equipo.
- Dictar: toca el micrófono al lado de cualquier casilla de texto, habla y toca otra vez para terminar. Funciona en Chrome y Edge (Android y computador) y en Safari del iPhone; la primera vez el navegador pide permiso para el micrófono. Si el navegador no lo permite, el micrófono del teclado del celular sirve igual.
- El kiosco confirma en voz alta cada marcación («Pedro, Entrada registrada a las 06:55»).

## Salir a un permiso aprobado
- El día del permiso, al trabajador le aparece arriba de su jornada «Tienes un permiso aprobado hoy» con el botón **Salir a mi permiso**. Confirma, y queda guardada la hora real de salida con su ubicación.
- Si el permiso es por horas (vuelve el mismo día), el botón cambia a **Regresé del permiso**; al tocarlo se guarda la hora de regreso.
- Si no vuelve ese día, la salida a permiso también marca la salida de la jornada.
- Si sale antes de la hora aprobada o regresa tarde, llega la alerta «Salida o regreso de permiso fuera de la hora aprobada». En el panel, Permisos muestra la columna «Uso real».

## Almuerzo por obra y jornadas sin almuerzo
- En *Obras y sedes → Editar*, sección «Almuerzo de esta obra»: escribe desde y hasta y toca «Aplicar a todos los días». Un día distinto se ajusta en el horario por día.
- Si un trabajador no sale a almuerzo, en su jornada toca «¿No saliste a almuerzo? Repórtalo» (aparece pasada la hora de almuerzo) o el botón «No salí a almuerzo» debajo del botón grande. Elige quién lo autorizó y escribe o dicta la razón. Después solo le queda marcar la salida.
- El jefe lo ve en *Horas extra → Jornadas sin almuerzo* con quién autorizó y la razón. Si lo aprueba, ese día no se descuenta el almuerzo y las horas extra se recalculan; si lo rechaza (con motivo), se descuenta el almuerzo programado.

## Supervisores
- Asignar: *Personal → Editar → Supervisor que lo revisa*, o *Personal → Trasladar o asignar supervisor* para varias personas. Si se deja «El de su obra», lo ve el supervisor de esa obra.
- El supervisor solo ve a su gente. En *Revisión del día* (Hoy, Ayer u otra fecha) confirma «Horas correctas», «No vino» o «Novedad» con una nota; con un botón confirma de una vez todas las jornadas completas sin novedad.
- En *Ubicación de obras* el supervisor, parado en la obra a cielo abierto, toca «Tomar mi ubicación», revisa la precisión y guarda. Se avisa al administrador.
- *Informes → Revisión de supervisores* muestra por supervisor los días trabajados, revisados, no vino, novedades y días sin almuerzo.

## Hablar por mí y lectura de pantalla
- En el ícono de accesibilidad: «Leer esta pantalla en voz alta» lee lo que está en pantalla; «Leer en voz alta lo que toque» dice cada botón o texto al tocarlo.
- «Hablar por mí» es para quien no puede hablar: toca una frase («Necesito ayuda», «Ya marqué mi entrada»…) o escribe la tuya; el celular la dice en voz alta y la muestra en letra gigante para enseñarla. Las frases propias quedan guardadas.
