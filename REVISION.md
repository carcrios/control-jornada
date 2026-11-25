# Revisión por agentes — 16 y 17 de noviembre de 2026

Cuatro revisores independientes leyeron el código y probaron ataques y cálculos contra el simulador.
Las pruebas automáticas pasaron de 86 a 109 para cubrir lo corregido.

## Corregido en la versión 1.1.0
| Revisor | Hallazgo |
|---|---|
| Seguridad | Jornadas falsificadas: fecha libre en «Se me olvidó» y marcaciones viejas enviadas como «sin señal» (ahora van a revisión y bloquean el cierre de nómina) |
| Seguridad | Adivinar la clave de firma creando muchos permisos: bloqueo por jefe tras 5 fallos, aviso al jefe, clave de 6 dígitos |
| Seguridad | Rociado de contraseñas y adivinar el código de empresa: contador global de fallos, alerta, código alfanumérico de 8 |
| Seguridad | Bloquear la cuenta de otro: ahora solo cuentan los fallos |
| Seguridad | Contraseñas triviales; cambiar la clave no cerraba las otras sesiones |
| Seguridad | GPS en los correos de alerta; Alertas y Errores no caducaban |
| Seguridad | Cuenta pendiente veía los centros de la empresa; radio de GPS ampliable hasta 100 m (ahora 50) |
| Calidad móvil | Sin señal en la mañana mostraba la jornada de ayer y no dejaba marcar |
| Calidad móvil | Marcaciones pendientes se perdían al caducar la sesión o al enviarse dos veces a la vez |
| Calidad móvil | Las rechazadas desaparecían en 14 s; ahora quedan en pantalla con «Registrarla ahora» |
| Calidad móvil | Hora del celular mal puesta: se corrige con la del servidor |
| Calidad móvil | Reintento automático cada 45 s; volver a la app ya no «desmarca» |
| Calidad móvil | La app no abría sin señal en la primera visita; quedaba en blanco con señal débil |
| Calidad móvil | Celulares atrapados en versiones viejas: aviso «Actualizar» |
| Calidad móvil | Instrucciones de permisos para app instalada y iPhone; GPS bajo techo con segundo intento |
| Calidad móvil | Una falla técnica de la cámara se reportaba como bloqueo |
| Nómina y ley | Pago por día: sin descanso dominical remunerado, sin incapacidad ni vacaciones |
| Nómina y ley | Sábado no programado sin pagar; horarios de más de 9 h sin extras |
| Nómina y ley | Domingo habitual liquidado como ocasional (pagaba de más) |
| Nómina y ley | Fondo de solidaridad por salario y no por IBC, sin tramos; sin tope de 25 SMMLV |
| Nómina y ley | Sin fecha de retiro; incapacidad de más de 90 días al 66,67 %; día 31 |
| Nómina y ley | Permiso por horas sin asistir no era ausencia; licencias pagaban auxilio de transporte |
| Nómina y ley | Día de la familia y de la bicicleta pasaron a «por acuerdo»; dominical no causado configurable |
| Comprador | Bonos, auxilios y descuentos (novedades de pago), y ajustes de periodos cerrados |
| Comprador | Aprobar horas extra en lote; RRHH registra permisos y vacaciones a nombre del trabajador |
| Comprador | Importar de nuevo actualiza a quien ya existe; datos bancarios en el plano de pagos |
| Comprador | Saldos de vacaciones y ausentismo de toda la empresa en el Excel |

## Pendiente (no resuelto todavía)
- **Comprador:** atar la cuenta a un celular y comparar la foto con una de referencia; editar una
  incapacidad (hoy se elimina y se crea de nuevo); traslados masivos entre obras con fecha; costo por
  obra prorrateado con factor prestacional; resumen de alertas por hora en lugar de un correo por evento;
  tipo de contrato y vencimiento; constancia de recibido del desprendible.
- **Seguridad:** el hash de contraseñas (150 rondas de SHA-256) es débil frente a un robo de la hoja;
  los soportes de permisos e incapacidades no caducan; no hay supresión de exempleados a solicitud.
- **Nómina:** con un centro sin horario no se detectan ausencias; extras sin aprobar en un domingo
  ocasional no se pagan (discutible).
- **Calidad móvil:** las pantallas del administrador aún leen hojas completas; con más de 150 personas
  conviene un índice por fecha.

## Revisión 2026-11-20 — versión 1.7.0 (unión con la versión del aliado)

Corregido en esta versión: archivo histórico borrado por la rotación de copias, falta del permiso para Telegram,
regresión del orden de marcaciones, base de liquidación con salario variable, préstamos descontados sin
autorización en la liquidación, certificado sin verificación, licencia que bloqueaba a los trabajadores,
página y demo desactualizadas.

### Pendiente — bloquea la venta
1. «Salir del kiosco» abre el panel con la sesión del supervisor sin pedir clave (se pueden aprobar extras propias).
2. Kiosco: permite saber si la contraseña de cualquier persona, incluso del administrador, es correcta; sin bloqueo por intentos.
3. Préstamos: la cuota no tiene tope y deja el neto negativo; no guarda la autorización escrita; marca cuotas pagadas a retirados sin descontarlas; se puede aplicar dos veces.
4. Banco de compensatorios: abona 1:1 sin recargo, admite doble abono y saldo negativo; el día compensatorio se descuenta como ausencia.
5. Suprimir datos (Ley 1581) deja incapacidades, GPS, auditoría, salario y el histórico; el histórico conserva GPS para siempre.
6. 2FA de administradores se salta con «recuperar contraseña» o con un administrador sin correo; la recuperación guarda el hash viejo.
7. Pago por día: el domingo o festivo trabajado paga solo el recargo y pierde el descanso.

### Pendiente — importante
8. Liquidación de contrato: sin indemnización (arts. 64 y 65), días calendario en vez de 360, vacaciones sobre el básico, vacaciones a 15/365.
9. Vinculación de celular eludible sin identificador y bloqueo sin salida en iPhone; supervisor ve banco y salario en el expediente.
10. Marcación sin señal en obra con QR siempre rechazada; bandeja envía fuera de orden; posible pérdida si IndexedDB falla; bandeja vacía al arrancar.
11. Código del día del QR válido 24 h (se comparte por WhatsApp); kiosco inutilizable en obras con QR y bloqueado con licencia vencida.
12. Cadena de auditoría burlable borrando hashes; verificación de certificados bloqueable por cualquiera y sin salario.
13. Provisiones y presupuesto sin aportes del empleador y con bases mal filtradas.
14. Licencia compartible entre empresas y activable con la clave del proveedor vacía.

### Pendiente — deseable
15. Hora pico con 150 personas: bloqueo único y foto subida dentro del bloqueo; Telegram enviado dentro del bloqueo.
16. Telegram sin opción de enviar sin nombres; comunicados sin aviso al trabajador; reenviar código 2FA; caché del service worker con nombre fijo; periodo de gracia de licencia; certificado emitido por RRHH para retirados.

### Corregido el 2026-11-20 (segunda pasada, antes de vender)
- Kiosco con sesión propia que solo marca en un centro; para salir hay que ingresar de nuevo. Mismo error para clave mala, otra obra o administrador; cuenta en el bloqueo global. Funciona en obras con QR y con licencia vencida. Borra los datos a los 30 s y conserva la cédula si falla la red.
- Préstamos: autorización firmada obligatoria; cuotas automáticas al cerrar (una por periodo), solo a quien se liquida, con tope de mínimo vital y 50 % del neto; el saldo sigue al periodo siguiente. Sin descuento manual.
- Compensatorios: abono con recargo, sin duplicar al redecidir, acuerdo escrito obligatorio, sin saldo negativo; el disfrute se paga como permiso remunerado.
- Jornalero: el domingo o festivo trabajado conserva el descanso remunerado.
- Recuperar contraseña ya no entrega sesión (pasa por 2FA y celular vinculado) y usa el hash v2. 2FA no se activa con administradores sin correo; botón para reenviar código.
- Supresión: borra GPS, fotos, soportes y notas de salud, salario y datos de contacto; conserva lo que exige la ley laboral. El histórico se guarda sin GPS ni fotos.
- Liquidación: meses de 30 días, días no remunerados descontados, base promedio de año (cesantías), semestre (prima) y sin extras (vacaciones), indemnización art. 64 por tipo de contrato, salario pendiente, avisos de art. 65 y cesantías, registro e impresión para firma. Vacaciones a 15/360.
- QR: el código del día solo dentro de la geocerca; sin señal vale el QR de la hora de la marca; el QR se pide antes de guardar sin señal; olvidos de menos de 15 min piden QR.
- Bandeja: copia en IndexedDB y en localStorage (sin foto), envío en orden deteniéndose en el primer fallo, aviso si no se pudo guardar, reintento de rechazadas con su foto.
- Celular vinculado: sin identificador no entra; el administrador recibe el aviso. El supervisor no ve salario, cuenta ni préstamos en el expediente.
- Auditoría anclada fuera de la hoja (total y último eslabón): borrar firmas o filas se detecta.
- Certificados guardados tal como se emitieron, con salario verificable; límite por cédula; RRHH los emite para retirados.
- Provisiones con aportes del empleador (pensión, ARL, caja y, sin exoneración, salud, SENA, ICBF) y bases correctas; el presupuesto por obra usa el costo real.
- Licencia atada al NIT, con vencimiento obligatorio y 15 días de gracia; sin clave de proveedor no se activan llaves. Herramienta `herramientas/llave-licencia.js`.
- Telegram sale fuera del bloqueo, sin nombres por defecto, y recibe el resumen agrupado.
- Caché del service worker con la versión.

### Corregido el 2026-11-20 (tercera pasada, tras la segunda ronda de revisores)
- Jornaleros: la liquidación usa el jornal × 30; el certificado indica salario diario.
- Kiosco: solo marca a personas asignadas a ese centro; se apaga únicamente con cédula y clave de un supervisor del centro o un administrador; la sesión cae si el centro se desactiva o sale del alcance del supervisor; no se activa con marcaciones propias pendientes.
- Bandeja: cada marcación lleva la cédula y solo la envía su dueño; IndexedDB con tiempo límite y sin bloqueo; borrados recordados para que no reaparezcan; hasta 50 rechazadas; reintento sin doble toque y a la bandeja si no hay señal.
- Seguridad: el contador global de fallos solo alerta (nadie puede bloquear el ingreso de todos); límites por cédula y por tablet; un certificado auténtico siempre se verifica; con celular vinculado no se entra sin identificador y al vincular se cierran otras sesiones; QR presentado sin señal con más de 30 min de atraso queda sospechoso; NIT de la licencia fijado al activarla.
- Datos: la supresión limpia alertas, errores y el histórico; las alertas y Telegram ya no copian motivos; el histórico guarda los motivos como "[motivo no archivado]".
- Nómina: horas extra a compensatorio apagado por defecto (concepto MinTrabajo 36107) y con advertencia; no se puede cambiar una decisión ya disfrutada; base de vacaciones sin dominicales/festivos; sábado hábil si la persona trabaja sábados; ARL sin días de incapacidad ni vacaciones; exoneración evaluada sobre lo devengado; disfrute de compensatorio contra la jornada real del día; liquidación registrada excluye a la persona del cierre de ese periodo y salda el préstamo; descuento final solo de préstamos autorizados, sin tocar cesantías ni más de la mitad del salario; prima ya pagada y aviso de intereses en enero; ARL por obra y costo por obra con su propia carga.

### Corregido el 2026-11-20 (cuarta pasada)
- Bandeja por persona: `bandeja.mias(cedula)` para pantalla, contador, envío y reintentos; las rechazadas solo las ve su dueño; las marcaciones sin dueño (versiones anteriores) no se envían solas; el servidor rechaza con AJENA una marcación cuya cédula no es la de la sesión; la foto se lee de IndexedDB antes de enviar y, si no se puede, se espera en vez de enviarla sin foto; `cj.kiosco` se limpia al entrar como usuario normal; el kiosco se puede activar aunque haya marcaciones ajenas (se conservan).
- Liquidación: solo se registra con retiro de hoy o antes, una vez por persona; la persona queda inactiva y sale solo del cierre del periodo de su retiro; prima pagada hasta una fecha; préstamos solo a personas activas; la casilla de descuento exige que la autorización cubra prestaciones.
- Extras a compensatorio exige la foto del acuerdo. Exoneración de aportes apagada por defecto. El bloqueo de una tablet no impide que el supervisor la apague.
- Pendiente conocido, no bloqueante: bloqueo de una cédula concreta por 8 intentos fallidos durante 15 min; sábado hábil por centro y no por persona; la llave de licencia depende del NIT configurado (la protección real es contractual).

## Revisión del 2026-11-24 (v1.8.0, ocho revisores)
Revisores: comprador (RRHH, nómina y dirección de obra), seguridad y datos (Ley 1581), contador y abogado laboral, calidad móvil en campo, actualización automática y panel de proveedor, plataforma Apps Script (cuotas y tiempos), experiencia del trabajador y accesibilidad, y cazador de errores. Los hallazgos graves se verificaron en el código.

### Bloquea la venta (pendiente)
1. Seguridad: un administrador de la empresa puede instalar cualquier código cambiando `urlApp` y tocando «Actualizar ahora». `baseActualizacion_` cae a `cfg_().urlApp`.
2. La actualización no tiene firma independiente: la huella viene del mismo sitio y es opcional. El manifiesto (acceso y ejecución) se reemplaza sin control.
3. Una actualización a medias deja la aplicación web vieja para siempre. El ID de implementación es frágil. «Actualizar ahora» desde la web con permisos nuevos deja la aplicación sin autorización. No hay bloqueo propio y la actualización corre con el bloqueo general tomado. Hay un límite de 200 versiones.
4. La página nueva convive con un servidor viejo hasta la noche: el aviso «Actualizar» queda pegado y las acciones nuevas fallan.
5. Salida olvidada:
   - Sin señal, al día siguiente ofrece «Me voy» y se pierde la llegada.
   - Un turno rotativo queda como jornada de 15,5 h.
   - Abierta desde el recordatorio, marca una entrada que nadie pidió.
   - Dice «ayer» cuando fue el viernes.
6. Nómina:
   - El domingo o festivo ocasional (2 o menos al mes) se paga solo como recargo: paga de menos.
   - El almuerzo no se descuenta en días sin horario: paga de más.
   - El permiso por horas descuenta la hora de almuerzo.
   - Las prórrogas de incapacidad reinician el conteo de 90 días.
7. Rendimiento:
   - El ingreso del administrador lee unos 1,8 M de celdas y pide el tablero dos veces (12 a 18 s estimados).
   - El login va dentro del bloqueo.
   - Marcar lee 30.000 filas con el bloqueo tomado: a las 7:00 se satura.
   - Los recordatorios de las 7:05 se envían con el bloqueo tomado y agotan el cupo de Gmail.
   - Las alertas salen una por una por defecto.
8. Panel del proveedor abierto:
   - Entrega la llave de otro NIT.
   - Permite inyectar fórmulas en Empresa, Correo y Enlace.
   - Permite crear filas basura y sobrescribir los datos de otra empresa.
   - `doPost` y las ediciones del proveedor se pisan.
9. `a_comunicadosMios` corta los 50 mensajes antes de filtrar, así que los recordatorios personales ocultan los comunicados generales. `a_adminComunicados` mezcla los personales.
10. Comprador:
    - No hay pago de prima ni de intereses de cesantías en la nómina periódica.
    - No hay saldos iniciales (vacaciones disfrutadas, promedio previo).

### Importante (pendiente)
- El acceso rápido (PIN o huella) no se revoca al cambiar la clave, al cerrar todas las sesiones, al inactivar a la persona ni en la supresión. No exige el celular vinculado. La huella solo se verifica en el navegador.
- `a_comunicadoLeer` no verifica el destinatario. Los supervisores no tienen vinculación de celular.
- Datos que se envían al panel: correos de administradores y enlace. Hace falta minimizar, avisar e incluirlo en el contrato (Ley 1581).
- Móvil:
  - Una marcación se pierde si la sesión vence justo al marcar.
  - No se puede deshacer una marcación guardada sin señal, y el «deshacer» sin señal muestra un mensaje falso.
  - El mensaje de error de red promete guardar acciones que no se guardan.
  - El GPS en frío tarda más de 30 s.
  - La espera es de 45 s.
  - IndexedDB no tiene tiempo límite al escribir.
  - Los envíos pendientes solo se hacen desde la pestaña Jornada.
  - sw.js sigue en v1.7.0.
  - Los recordatorios dicen «activos» aunque Android los congele.
- Turno nocturno: los recordatorios dicen lo contrario.
- Accesibilidad:
  - La confirmación se cierra sola o con cualquier toque y no atrapa el foco (lo mismo la cámara).
  - Voz doble con TalkBack.
  - Palabras distintas para la misma acción.
  - El riel se entiende solo por color.
  - El PIN no se oye con el lector.
  - Objetivos táctiles de 36 px.
  - La guía de nómina se lee de corrido mientras se escribe.
- Textos legales de la guía y del PDF:
  - «Las extras no aprobadas no se pagan».
  - «Los 2 primeros días de incapacidad» (son al 66,67 %).
  - «La ARL paga desde el primer día».
  - «Hasta 9 h no es extra».
  - Domingo habitual u ocasional.
  - «Cita médica» sin matiz.
  - El recargo sin fecha en el PDF.
- Nómina:
  - Vacaciones e incapacidad sobre el básico con salario variable.
  - Pagos no salariales por encima del 40 % fuera del IBC.
  - Parámetros legales sin vigencia por fecha.
  - Incapacidad que cubre todo febrero.
- Datos:
  - Las firmas pueden pasar de 50.000 caracteres por celda.
  - La limpieza nocturna reescribe la hoja sin el apóstrofo (riesgo de fechas).
  - `tareaDiaria` puede pasar de 6 minutos.
  - El archivado conserva 12 meses y solo los periodos cerrados.
  - `diasDe_` recorre todas las filas por persona.
  - Varias consultas leen la hoja completa.
- Comprador:
  - Excel para la PILA.
  - Roles de nómina y de consulta.
  - Informes de un año.
  - El cupo cuenta a los preregistrados.
  - La guía no exige una cuenta institucional.

### Deseable
- Retención en la fuente y embargos (el LEEME se contradice).
- Novedades por Excel.
- Volver a la versión anterior.
- No actualizar entre el corte y el cierre de la nómina.
- Migración de la hoja vieja del panel.
- `onEdit` con varias filas.
- Textos más claros para el obrero.
- Aviso de GPS o foto junto al botón.

### Estado tras la corrección (2026-11-24)
**Corregido:** bloqueantes 1 a 9 completos y 10 en parte (pago de prima e intereses de cesantías por periodo). Del grupo importante: revocación del acceso rápido, comunicado ajeno, minimización de datos al panel, mensaje de red, espera de 15 s al marcar, versión del service worker, recordatorios de turno nocturno, confirmación accesible, voz doble, estado del riel, áreas táctiles, textos legales de la guía y del PDF.

**Sigue pendiente (siguiente versión):**
- Saldos iniciales (vacaciones disfrutadas antes de la aplicación, promedio previo) en el importador.
- Roles «nómina» y «consulta»; costos por obra para el director; campos de PILA y fondos; informes de hasta 366 días y exportación anual; cupo del plan sin contar preregistrados; importar novedades desde Excel; embargos con tope y retención como novedad.
- Acceso rápido atado al celular vinculado; vinculación de celular para supervisores.
- Rendimiento fino: `a_yo` liviano para el administrador; búsqueda de foto por identificador sin leer toda la hoja.
(Sin señal y lectura por fecha: corregidos el 2026-11-24.)
- Accesibilidad: conteo del PIN con lector, resumen de la guía de nómina al terminar de escribir.
