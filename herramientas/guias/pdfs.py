# Guías ilustradas en PDF (trabajador, administrador y supervisor) y cartel para la obra.
import json, base64, os
from playwright.sync_api import sync_playwright

G = '/home/claude/guias/'; M = json.load(open(G + 'meta.json')); OUT = G + 'pdf/'; os.makedirs(OUT, exist_ok=True)
img = lambda k: 'data:image/jpeg;base64,' + base64.b64encode(open(G + 'img/%s.jpg' % k, 'rb').read()).decode()

CSS = """
@page { size: letter; margin: 14mm 14mm 16mm; }
* { box-sizing: border-box; } body { font-family: Inter, sans-serif; color: #1B2B30; margin: 0; font-size: 11.5pt; line-height: 1.45; }
h1, h2, h3 { color: #0E4A5A; margin: 0; } h2 { font-size: 22pt; margin-bottom: 4mm; } h3 { font-size: 13.5pt; }
.portada { height: 245mm; background: #0E4A5A; color: #fff; border-radius: 6mm; padding: 22mm 18mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
.portada h1 { color: #fff; font-size: 40pt; line-height: 1.08; margin: 6mm 0; } .portada .eti { color: #F2A900; font-weight: 700; font-size: 14pt; letter-spacing: .02em; }
.portada p { font-size: 15pt; color: #CFE3E8; max-width: 140mm; } .portada .barra { height: 3mm; width: 40mm; background: #F2A900; border-radius: 2mm; }
.seccion { page-break-before: always; } .intro { color: #4A5D63; font-size: 12pt; margin: 0 0 6mm; max-width: 170mm; }
.pasos { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm 10mm; }
.paso { break-inside: avoid; display: flex; flex-direction: column; gap: 3mm; }
.paso .num { display: inline-flex; width: 9mm; height: 9mm; border-radius: 50%; background: #F2A900; color: #0E4A5A; font-weight: 800; align-items: center; justify-content: center; font-size: 13pt; flex: none; }
.paso .txt { display: flex; gap: 3mm; align-items: flex-start; font-size: 12pt; font-weight: 600; }
.paso img.cel { width: 72mm; border-radius: 4mm; border: 1px solid #C9D6D9; align-self: center; }
.ancho .paso img { width: 160mm; align-self: center; border-radius: 2.5mm; border: 1px solid #C9D6D9; } .ancho { grid-template-columns: 1fr; gap: 6mm; }
.consejo { background: #FFF6DC; border-left: 4px solid #F2A900; border-radius: 2mm; padding: 3mm 4mm; margin-top: 6mm; font-size: 11pt; break-inside: avoid; }
.resumen { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5mm; margin-top: 4mm; }
.resumen div { border: 1px solid #C9D6D9; border-radius: 3mm; padding: 5mm; break-inside: avoid; } .resumen b { display: block; color: #0E4A5A; font-size: 13pt; margin-bottom: 1.5mm; }
.pf { break-inside: avoid; border-bottom: 1px solid #E1E8EA; padding: 3mm 0; } .pf b { color: #0E4A5A; display: block; margin-bottom: 1mm; }
table { width: 100%; border-collapse: collapse; font-size: 10.5pt; } td, th { border-bottom: 1px solid #E1E8EA; padding: 2.5mm 2mm; text-align: left; vertical-align: top; } th { color: #0E4A5A; background: #EEF4F5; }
.check li { margin-bottom: 2mm; } .videos li { margin-bottom: 1.2mm; }
"""

def doc(titulo, cuerpo): return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>%s</title><style>%s</style></head><body>%s</body></html>' % (titulo, CSS, cuerpo)
def portada(eti, t, sub): return '<div class="portada"><div><div class="barra"></div><div class="eti" style="margin-top:8mm">%s</div><h1>%s</h1><p>%s</p></div><div style="font-size:11pt;color:#CFE3E8">Control de jornada · versión 1.8</div></div>' % (eti, t, sub)
def pasos(ids, ancho=False, textos=None):
    h = ''
    for n, k in enumerate(ids, 1):
        t = (textos or {}).get(k, M[k])
        h += '<div class="paso"><div class="txt"><span class="num">%d</span><span>%s</span></div><img class="%s" src="%s"></div>' % (n, t, '' if ancho else 'cel', img(k))
    return '<div class="pasos%s">%s</div>' % (' ancho' if ancho else '', h)
def sec(titulo, intro, cuerpo, video=None):
    v = ' <b style="color:#0E4A5A">▶ %s</b>' % video if video else ''
    return '<section class="seccion"><h2>%s</h2><p class="intro">%s%s</p>%s</section>' % (titulo, intro, v, cuerpo)
def consejo(t): return '<div class="consejo">%s</div>' % t

# ---------------- Guía del trabajador ----------------
T = portada('Guía para el trabajador', 'Marca tu jornada en un toque', 'Todo lo que necesitas para marcar, pedir permisos y entender tu pago. Con fotos de la aplicación, paso a paso.')
T += '<section><h2>En un minuto</h2><p class="intro">Esto es lo único que necesitas recordar. El resto de la guía lo explica con calma.</p><div class="resumen">'
for a, b in [('1. Llegué', 'Al llegar a la obra abre la aplicación y toca el botón amarillo «Llegué».'), ('2. El almuerzo no se marca', 'Se descuenta solo según el horario de tu obra. Si no saliste a almorzar, repórtalo.'),
             ('3. Me voy', 'Al terminar toca «Me voy». Si se te olvida, al día siguiente la aplicación te pregunta a qué hora saliste.'), ('4. ¿Dudas?', 'Toca el botón redondo «?» de Ayuda: videos cortos, esta guía y preguntas frecuentes. Si no encuentras la respuesta, envía tu duda a nómina.'),
             ('¿Te equivocaste?', 'Tienes 2 minutos para tocar «Deshacer».'), ('¿Sin señal?', 'Marca igual: queda guardado en tu celular y se envía solo.')]:
    T += '<div><b>%s</b>%s</div>' % (a, b)
T += '</div>' + consejo('<b>Primera vez:</b> abre el enlace que te dio la empresa, escribe tu cédula y el código de activación, crea tu contraseña y toca «Instalar» o «Agregar a pantalla de inicio». Así queda como una aplicación más en tu celular.') + '</section>'
T += sec('Marcar llegada y salida', 'Un solo botón grande te dice lo que toca: «Llegué» o «Me voy». Tócalo una vez.', pasos(['w01', 'w02', 'w04', 'w05', 'w06', 'w09']) + consejo('Si la pantalla sale <b>ámbar</b>, marcaste fuera de la obra o sin señal. No pasa nada: queda registrado. Si estás en la obra y dice que estás fuera, avísale a tu supervisor.'), 'Video 1 · Marcar llegada y salida')
T += sec('¿No saliste a almorzar?', 'El almuerzo se descuenta solo. Si te pidieron trabajar durante el almuerzo, repórtalo para que ese tiempo se pague.', pasos(['w07', 'w08']), 'Video 2 · ¿No saliste a almorzar?')
T += sec('Se me olvidó marcar la salida', 'No tienes que llamar a nadie. Al día siguiente la aplicación te lo pregunta.', pasos(['w21', 'w22']) + consejo('Sin la hora de salida, ese día no suma horas. Por eso la aplicación te la pide antes de marcar tu llegada.'), 'Video 3 · Se me olvidó marcar la salida')
T += sec('Pedir permiso', 'En tres toques: para qué, cuándo y enviar. Tu jefe lo aprueba desde su celular.', pasos(['w14', 'w15', 'w16', 'w17']), 'Video 4 · Pedir permiso y salir a él')
T += sec('Salir a tu permiso', 'El día del permiso aparece una tarjeta para registrar la hora real en que sales y vuelves.', pasos(['w23', 'w24']) + consejo('Si sales en la tarde y no vuelves ese día, al tocar «Salir a mi permiso» también queda marcada tu salida del día.'))
T += sec('Tu pago y tus dudas', 'Mira cuánto va tu pago y resuelve tus dudas sin tener que preguntar en la oficina.', pasos(['w11', 'w12', 'w13']) + consejo('El valor oficial es el de tu desprendible, en «Pagos». Allí también lo confirmas.'), 'Video 5 · Mi pago y mis dudas')
T += sec('Entrar rápido y accesibilidad', 'Entra sin escribir cédula ni contraseña, y ajusta la aplicación a como te sirve mejor.', pasos(['w18', 'w20', 'w19']), 'Video 6 · Entrar con PIN y accesibilidad')
T += sec('El botón de Ayuda', 'En cualquier pantalla hay un botón redondo con un «?». Ahí encuentras los videos, esta guía y las respuestas a las dudas más comunes.', pasos(['w25', 'w26', 'w27']) + consejo('Los videos duran menos de un minuto. Si tu plan de datos es limitado, míralos cuando tengas wifi.'))
PF = [('¿Cuánto vale mi hora?', 'Tu salario mensual dividido entre 210 (jornada de 42 horas). Si te pagan por día, tu jornal dividido entre 7. La guía de la aplicación te dice el valor exacto de la tuya.'),
      ('¿Cuánto me pagan una hora extra?', 'De día 25 % más; de noche 75 % más. Se pagan las extras que te pidieron o que tu jefe sabía que trabajabas; la aprobación en la aplicación es para verificarlas.'),
      ('¿Desde qué hora es nocturno?', 'De 7:00 p. m. a 6:00 a. m. (desde el 25 de diciembre de 2025). Cada hora tiene un recargo del 35 %.'),
      ('¿Y si trabajo domingo o festivo?', 'Recargo del 90 % desde el 1 de julio de 2026 (100 % desde el 1 de julio de 2027). Hasta 2 en el mes: se paga la hora más el recargo, o un día de descanso si lo prefieres. 3 o más: recargo y un día de descanso compensatorio.'),
      ('¿Por qué me descuentan salud y pensión?', 'Es obligatorio: 4 % salud y 4 % pensión. La empresa aporta una parte mayor.'),
      ('¿Me pagan si estoy incapacitado?', 'Por enfermedad general, el 66,67 % del salario (nunca menos del mínimo diario): los 2 primeros días los paga la empresa y desde el tercero la EPS. Por accidente de trabajo, el día del accidente lo paga la empresa y desde el siguiente la ARL al 100 %. Entrega la incapacidad.'),
      ('¿Qué permisos son pagados?', 'Cita médica de urgencia o con especialista, calamidad doméstica, luto (5 días hábiles), votar, jurado, citaciones judiciales y reuniones escolares, entre otros.'),
      ('¿Cuándo pagan la prima?', 'Antes del 30 de junio y antes del 20 de diciembre: medio mes de salario cada vez, en proporción al tiempo trabajado.'),
      ('¿Qué pasa si no tengo señal?', 'Marca igual. Queda guardado con la hora real y se envía solo cuando vuelva la señal.'),
      ('¿Quién ve mis datos?', 'Tú, tu supervisor y los administradores, solo para la nómina (Ley 1581 de 2012).')]
T += '<section class="seccion"><h2>Preguntas frecuentes</h2><p class="intro">Hay más respuestas en la aplicación: «Pagos» → «¿Dudas sobre tu pago? Pregunta aquí». Si no está tu pregunta, envíala a nómina desde ahí mismo.</p>' + ''.join('<div class="pf"><b>%s</b>%s</div>' % x for x in PF)
T += '<h3 style="margin-top:8mm">Si algo no funciona</h3><table><tr><th>Lo que pasa</th><th>Qué hacer</th></tr>' + ''.join('<tr><td>%s</td><td>%s</td></tr>' % x for x in [
     ('Dice que estoy fuera de la obra', 'Sal a cielo abierto, espera unos segundos y vuelve a tocar. Si sigue, avísale al supervisor.'), ('No me pide la ubicación o la cámara', 'Revisa en los ajustes del celular que el navegador tenga permiso de ubicación y cámara.'),
     ('Olvidé mi contraseña', 'Pídele al administrador un código nuevo de activación.'), ('El botón no responde', 'Cierra la aplicación por completo y ábrela de nuevo. Revisa que tengas la última versión (Perfil).'),
     ('Marqué por error', 'Toca «Deshacer» en los 2 minutos siguientes. Después, pídele el ajuste a tu supervisor.')]) + '</table></section>'

# ---------------- Guía del administrador y supervisor ----------------
A = portada('Guía para el administrador y el supervisor', 'Del día a día al cierre de la nómina', 'Cómo poner en marcha la empresa, qué revisar cada día y cómo cerrar la quincena sin sorpresas.')
A += '<section><h2>Tu rutina</h2><p class="intro">Con esto la aplicación funciona sola y los trabajadores casi no te preguntan.</p><div class="resumen">'
for a, b in [('Una sola vez', 'Asistente de inicio: empresa, obras con su ubicación y horario, personal (desde Excel) y envío del enlace por WhatsApp.'), ('Cada día (5 minutos)', 'Abre «Hoy» y resuelve lo que diga «Qué necesito atender hoy». El supervisor revisa el día de su gente.'),
             ('Cada semana', 'Aprueba horas extra y permisos. Mira el informe de tardanzas y el de riesgo de fatiga.'), ('Cada quincena', 'Nómina: sigue los pasos 1 a 4, resuelve «Antes de cerrar», cierra y descarga el Excel para el contador.')]:
    A += '<div><b>%s</b>%s</div>' % (a, b)
A += '</div>' + consejo('<b>Para que no te pregunten:</b> los videos y las guías ya están dentro de la aplicación, en el botón «Ayuda». Igual puedes compartir la «Guía para el trabajador» por WhatsApp. Las dudas que igual les queden te llegan ordenadas en «Guía de nómina».') + '</section>'
A += sec('Poner en marcha la empresa', 'El asistente te lleva en orden. Después todo se ajusta en «Obras y sedes» y «Configuración».', pasos(['a12', 'a11', 'a13'], ancho=True), 'Video 11 · Poner en marcha la empresa')
A += sec('El día a día', 'Todo lo urgente en una sola pantalla, con un botón para resolver cada cosa.', pasos(['a01', 'a02', 'a03', 'a04'], ancho=True), 'Video 8 · Administrador: el día a día')
A += sec('Aprobar y cerrar la nómina', 'Solo entra a la nómina lo aprobado. El cierre te avisa lo que falta antes de pagar.', pasos(['a05', 'a06', 'a07', 'a08'], ancho=True) + consejo('Una nómina cerrada no se cambia. Si encuentras un error después, regístralo como bono o descuento en la quincena siguiente.'), 'Video 9 · Aprobar y cerrar la nómina')
A += sec('Informes y dudas de los trabajadores', 'Los informes más usados están a un clic; las dudas de los trabajadores te llegan en un solo lugar.', pasos(['a09', 'a10'], ancho=True), 'Video 10 · Informes y dudas de trabajadores')
A += sec('Ayuda para todos, en la misma aplicación', 'Tú y tus trabajadores tienen un botón «Ayuda» con los videos, las guías en PDF y las preguntas frecuentes. Cada quien ve lo suyo.', pasos(['a14', 'a15'], ancho=True) + consejo('Antes de responder una duda, pídele a la persona que mire el botón «?» de Ayuda: casi todo está ahí.'))
A += sec('Empresa, licencia y módulos', 'El NIT conecta la empresa con su licencia. Los módulos y el plan los define tu proveedor; el cambio te llega solo.', pasos(['a16', 'a17'], ancho=True))
A += sec('Para el supervisor', 'El supervisor usa su celular. Solo ve a las personas que tiene asignadas.', pasos(['s01', 's02', 's03']), 'Video 7 · Supervisor: revisar el día')
A += '<section class="seccion"><h2>Lista de arranque</h2><p class="intro">Marca cada punto antes de pedirle a la gente que empiece a marcar.</p><ul class="check">' + ''.join('<li>☐ %s</li>' % x for x in [
     'Datos de la empresa, logo y color en Configuración → Empresa.', 'Cada obra con su ubicación tomada en el sitio (el supervisor puede hacerlo desde su celular) y su radio.',
     'Horario de cada obra (usa una plantilla de 42 h) y su franja de almuerzo.', 'Personal importado desde Excel, revisado antes de importar (cédulas, salario, obra).', 'Salarios validados y supervisores asignados a su gente.',
     'Jefes que firman permisos y su clave de firma.', 'Alertas: a qué correo llegan las novedades.', 'Parámetros legales del año (mínimo y auxilio de transporte) revisados.',
     'Enlace enviado por WhatsApp con los códigos de activación.', 'Guía y videos compartidos con los trabajadores.']) + '</ul>'
A += '<h3 style="margin-top:8mm">Videos incluidos</h3><ul class="videos">' + ''.join('<li>%s</li>' % x for x in ['1 · Marcar llegada y salida', '2 · ¿No saliste a almorzar?', '3 · Se me olvidó marcar la salida', '4 · Pedir permiso y salir a él', '5 · Mi pago y mis dudas',
     '6 · Entrar con PIN y accesibilidad', '7 · Supervisor: revisar el día', '8 · Administrador: el día a día', '9 · Aprobar y cerrar la nómina', '10 · Informes y dudas de trabajadores', '11 · Poner en marcha la empresa']) + '</ul></section>'

# ---------------- Cartel para la obra ----------------
C = """<style>@page{size:letter;margin:10mm} .cart{height:250mm;border:3mm solid #0E4A5A;border-radius:6mm;padding:10mm;display:flex;flex-direction:column}
.cart h1{font-size:34pt;text-align:center} .cart .sub{text-align:center;font-size:15pt;color:#4A5D63;margin:2mm 0 8mm}
.tres{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;flex:1} .tres div{display:flex;flex-direction:column;align-items:center;gap:3mm;text-align:center;font-size:14pt;font-weight:700;color:#0E4A5A}
.tres img{width:100%;border-radius:3mm;border:1px solid #C9D6D9;height:100mm;object-fit:cover;object-position:top} .n{width:14mm;height:14mm;border-radius:50%;background:#F2A900;font-size:20pt;display:flex;align-items:center;justify-content:center}
.pie{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:7mm} .pie div{background:#EEF4F5;border-radius:3mm;padding:4mm;font-size:12.5pt}</style>
<div class="cart"><h1>Así marcas tu jornada</h1><div class="sub">Abre la aplicación en tu celular. Un toque y listo.</div><div class="tres">"""
for n, (k, t) in enumerate([('w02', 'Al llegar toca «Llegué»'), ('w04', 'Verde = quedó registrado'), ('w09', 'Al terminar toca «Me voy»')], 1):
    C += '<div><span class="n">%d</span><img src="%s"><span>%s</span></div>' % (n, img(k), t)
C += """</div><div class="pie"><div><b>El almuerzo no se marca.</b> Si no saliste a almorzar, toca «¿No saliste a almuerzo? Repórtalo».</div><div><b>¿Se te olvidó la salida?</b> Mañana, al tocar «Llegué», te pregunta a qué hora saliste.</div>
<div><b>¿Sin señal?</b> Marca igual: se envía sola cuando vuelva la señal.</div><div><b>¿Dudas del pago?</b> En «Pagos» pregunta o envía tu duda a nómina.</div></div></div>"""


# ---------------- Guía de instalación (proveedor) ----------------
def ruta(*p): return '<div class="ruta">' + '<span class="flecha">→</span>'.join('<span class="chip">%s</span>' % x for x in p) + '</div>'
def paso_t(n, t, extra=''): return '<div class="pt"><span class="num">%d</span><div><b>%s</b>%s</div></div>' % (n, t, extra)
def fig(k, pie, cls=''): return '<figure class="%s"><img src="%s"><figcaption>%s</figcaption></figure>' % (cls, img(k), pie)
EST = """<style>.ruta{display:flex;flex-wrap:wrap;gap:1.5mm;align-items:center;margin:1.5mm 0 0}.chip{background:#E6EFF1;color:#0E4A5A;border:1px solid #B9CDD2;border-radius:2mm;padding:.8mm 2.4mm;font-weight:700;font-size:10pt}
.flecha{color:#7A8C91;font-weight:700}.pt{display:flex;gap:3.5mm;margin:0 0 4mm;break-inside:avoid}.pt .num{flex:none;width:8mm;height:8mm;border-radius:50%;background:#F2A900;color:#0E4A5A;font-weight:800;display:flex;align-items:center;justify-content:center}
.pt>div>b:first-child{display:block;font-size:11.5pt}.pt p{margin:1mm 0 0;color:#4A5D63;font-size:10.5pt}figure{margin:4mm 0;break-inside:avoid}figure img{width:100%;border:1px solid #C9D6D9;border-radius:2.5mm}figcaption{font-size:10pt;color:#4A5D63;margin-top:1.5mm}
figure.media img{width:62%;display:block;margin:0 auto}figure.medio img{width:78%;display:block;margin:0 auto}figure.medio figcaption{width:78%;margin:1.5mm auto 0}.pt{margin-bottom:3mm}.hojas{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin:5mm 0}.hoja{border-radius:3mm;padding:5mm;border:2px solid}.hoja h3{font-size:14pt;margin-bottom:2mm}
.hoja ul{margin:2mm 0 0;padding-left:4.5mm;font-size:10.5pt}.az{border-color:#2457A6;background:#EEF3FC}.am{border-color:#C99400;background:#FFF8E3}.ve{border-color:#1B7A3E;background:#ECF7F0}
.dos{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.dos figure img{max-height:70mm;object-fit:cover;object-position:top}.nav{border:1px solid #C9D6D9;border-radius:3mm;overflow:hidden;font-size:10.5pt}.nav .barra{background:#E9EEEF;padding:2mm 3mm;font-family:monospace;font-size:9pt;color:#4A5D63;word-break:break-all}
.nav .cuerpo{padding:5mm;min-height:22mm}.si{border:2px solid #1B7A3E;border-radius:3mm;padding:4mm;background:#ECF7F0}.no{border:2px solid #B3261E;border-radius:3mm;padding:4mm;background:#FCE8E6}
.hojacal{width:100%;border-collapse:collapse;font-size:10pt;border:1px solid #B9C4C6}.hojacal td{border:1px solid #D5DCDD;padding:1.3mm 2.5mm}.hojacal .cab td{background:#F1F3F4;font-weight:700}.hojacal .ttl td{font-weight:800;color:#1B7A3E;font-size:12pt}
.pestana{display:inline-block;background:#fff;border:1px solid #B9C4C6;border-bottom:3px solid #1B7A3E;padding:1mm 4mm;font-size:9.5pt;font-weight:700;margin-top:1.5mm}</style>"""
I = EST + portada('Guía de instalación', 'Instala sin enredos', 'Tu página, tu panel con la consola, la plantilla y cada empresa. Paso a paso, diciendo siempre en qué hoja estás.')
I += '<section><h2>Antes de empezar: son 3 hojas distintas</h2><p class="intro">Casi todos los errores vienen de hacer un paso en la hoja equivocada. En esta guía cada paso tiene el color de su hoja.</p><div class="hojas">'
I += '<div class="hoja az"><h3>🟦 PANEL</h3><b>Tuya, solo una.</b><ul><li>Código: PanelProveedor.gs</li><li>Se publica una vez</li><li>Su enlace abre tu <b>consola</b></li><li>Nunca va en un celular</li></ul></div>'
I += '<div class="hoja am"><h3>🟨 PLANTILLA</h3><b>Tuya, solo una.</b><ul><li>Código: ControlJornada.gs + Proveedor.gs</li><li><b>Nunca</b> se instala ni se publica</li><li>Tus clientes la copian con /copy</li></ul></div>'
I += '<div class="hoja ve"><h3>🟩 EMPRESA</h3><b>Una por cada cliente.</b><ul><li>Es la copia de la plantilla</li><li>Se instala y se publica una vez</li><li>Su enlace es el de los celulares</li></ul></div></div>'
I += '<h3>¿Qué enlace es cuál? Ábrelo en el navegador y mira qué dice</h3><div class="dos" style="margin-top:3mm">'
I += '<div class="nav"><div class="barra">https://script.google.com/macros/s/AKfy…/exec</div><div class="cuerpo"><b style="color:#2457A6">🟦 Panel de proveedor · Control de jornada</b><p style="margin:1mm 0 0">Pide la contraseña de la consola.</p><p class="suave" style="font-size:9.5pt;color:#4A5D63">Va solo dentro de Proveedor.gs.</p></div></div>'
I += '<div class="nav"><div class="barra">https://script.google.com/macros/s/AKfy…/exec</div><div class="cuerpo"><b style="color:#1B7A3E">🟩 Control de jornada · versión 1.8.0</b><p style="margin:1mm 0 0">Servicio activo.</p><p class="suave" style="font-size:9.5pt;color:#4A5D63">Es el enlace de la empresa: el de los celulares.</p></div></div></div>'
I += consejo('<b>Si dice «Sorry, the file you have requested does not exist»</b>, ese enlace es de una implementación borrada: no sirve para nada. Usa el de «Administrar implementaciones».') + '</section>'
I += '<section class="seccion"><h2>1. Tu página en GitHub</h2><p class="intro">Una sola vez. Es la aplicación que abren los celulares.</p>'
I += paso_t(1, 'Crea el repositorio «control-jornada» como Public.', ruta('github.com', '+', 'New repository'))
I += paso_t(2, 'Sube los archivos.', '<p>GitHub deja subir máximo 100 a la vez: sube primero la parte 1 descomprimida y después la parte 2.</p>' + ruta('Add file', 'Upload files', 'Commit changes'))
I += paso_t(3, 'Activa la página.', ruta('Settings', 'Pages', 'Branch: main', 'Carpeta: /docs', 'Save'))
I += paso_t(4, 'Espera 2 minutos y abre tu dirección.', '<p>https://TU-USUARIO.github.io/control-jornada/ debe abrir la aplicación.</p>')
I += consejo('<b>Cada versión nueva:</b> solo reemplazas la carpeta <b>docs</b>. Las empresas se actualizan solas esa noche después de que apruebes la versión en tu consola.') + '</section>'
I += '<section class="seccion"><h2>2. 🟦 El PANEL y tu consola</h2><p class="intro">Una sola vez. 📍 Estás en una hoja de Google nueva llamada «Panel de proveedor».</p>'
I += paso_t(1, 'Pega el código del panel.', ruta('Extensiones', 'Apps Script', 'borra todo', 'pega PanelProveedor.gs', 'Guardar'))
I += paso_t(2, 'Publícalo.', ruta('Implementar', 'Nueva implementación', '⚙ Aplicación web', 'Ejecutar como: Yo', 'Acceso: Cualquier persona', 'Implementar') + '<p>Copia la «URL de la aplicación web». Ábrela: debe pedir la contraseña de la consola.</p>')
I += paso_t(3, 'Configúralo.', '<p>Recarga la hoja (F5). En el menú nuevo:</p>' + ruta('Panel de proveedor', '0. Configurar') + '<p>Pega primero tu dirección de GitHub y después la URL del paso 2. En la pestaña «Proveedor.gs», la celda A3 queda con el bloque para la plantilla.</p>')
I += paso_t(4, 'Crea la contraseña de la consola.', ruta('Panel de proveedor', 'Contraseña de la consola web…') + '<p>Mínimo 8 caracteres. Guárdala: no se puede ver después.</p>')
I += consejo('<b>Nunca hagas otra «Nueva implementación» en el panel:</b> cambia la URL y las empresas dejan de reportar. Para publicar cambios usa «Administrar implementaciones → ✏️ → Nueva versión».')
I += '<div class="dos">' + fig('c00', 'Abre la URL del panel y entra con tu contraseña. Guárdala en favoritos.') + fig('c01', 'Arriba ves cuántas empresas hay, cuáles esperan plan, cuáles vencen y cuáles no reportan. Toca un número para filtrar.') + '</div>'
I += '</section>'
I += '<section class="seccion"><h2>3. Manejar las empresas desde la consola</h2><p class="intro">Todo lo de tus clientes se hace aquí: plan, módulos, personas, vencimiento, renovaciones y versiones. Los cambios le llegan a la empresa en su próximo reporte: cada noche, o al instante si su administrador abre «Configuración → Licencia y versión».</p>'
I += fig('c02', '<b>Toca una empresa.</b> Al elegir el plan se marcan solos sus módulos. Si cambias una casilla queda «Personalizado». Ajusta las personas máximo y el vencimiento, y toca «Guardar».', 'medio')
I += '<div class="dos">' + fig('c03', '<b>Renovar:</b> +1, +3, +6 o +12 meses en un toque, desde el vencimiento actual. «Suspender ya» deja el panel de la empresa en consulta; sus trabajadores siguen marcando.') + fig('c04', '<b>Versión nueva:</b> «Versión y actualizaciones» muestra las novedades. Al aprobarla, todas las empresas conectadas se actualizan esa noche.') + '</div>'
I += '</section>'
I += '<section class="seccion"><h2>4. 🟨 La PLANTILLA</h2><p class="intro">Una sola vez. 📍 Estás en la hoja que vas a entregar a tus clientes.</p>'
I += paso_t(1, 'Pega el código de la aplicación.', ruta('Extensiones', 'Apps Script', 'Código.gs', 'borra todo', 'pega ControlJornada.gs', 'Guardar'))
I += paso_t(2, 'Crea el archivo Proveedor.', ruta('+', 'Script', 'nombre: Proveedor', 'pega el bloque de A3 del panel', 'Guardar'))
I += paso_t(3, 'Pega el manifiesto.', ruta('⚙ Configuración del proyecto', 'Mostrar appsscript.json') + ruta('appsscript.json', 'borra todo', 'pega appsscript.json', 'Guardar'))
I += paso_t(4, 'Comparte el enlace de copia.', ruta('Compartir', 'Cualquier persona con el enlace: Lector', 'Copiar enlace') + '<p>Cambia el final <b>/edit…</b> por <b>/copy</b>. Ese enlace le mandas a cada cliente.</p>')
I += '<div class="no" style="margin-top:4mm"><b>En la plantilla NO toques «1. Instalar» ni «Implementar».</b> Si lo haces, todas las copias heredan datos de prueba.</div></section>'
I += '<section class="seccion"><h2>5. 🟩 Cada EMPRESA (10 minutos)</h2><p class="intro">📍 Desde un computador con Chrome o Edge (LibreWolf y Brave bloquean a Google), con la cuenta de Google de la empresa.</p>'
I += paso_t(1, 'Haz la copia.', '<p>Abre el enlace /copy y toca «Hacer una copia». Esa copia ya es la hoja de la empresa.</p>')
I += paso_t(2, 'Instala.', ruta('Control de jornada', '1. Instalar') + '<p>Elige la cuenta → «Configuración avanzada» → «Ir a Control de jornada (no seguro)» → «Permitir». Anota el código <b>ADM-…</b>.</p>')
I += paso_t(3, 'Publica.', ruta('Extensiones', 'Apps Script', 'Implementar', 'Nueva implementación', '⚙ Aplicación web', 'Yo', 'Cualquier persona', 'Implementar'))
I += paso_t(4, 'Permite las actualizaciones automáticas.', '<p>Con la misma cuenta abre script.google.com/home/usersettings y activa «API de Google Apps Script».</p>')
I += paso_t(5, 'Revisa que todo funcione.', ruta('Control de jornada', '3. Revisar instalación') + '<p>Si te pide un enlace, pega la URL del paso 3. Queda una pestaña «Revisión» así:</p>')
I += '<div style="break-inside:avoid"><table class="hojacal"><tr class="ttl"><td colspan="2">TODO ESTÁ BIEN. Enlace para los celulares:</td></tr><tr><td colspan="2" style="color:#2457A6;text-decoration:underline">https://tu-usuario.github.io/control-jornada/#/c/AKfy…</td></tr><tr class="cab"><td>Revisión</td><td>Cómo arreglarlo</td></tr>'
I += ''.join('<tr><td>✅ %s</td><td></td></tr>' % x for x in ['Servidor publicado y abierto a cualquier persona', 'Enlace para los celulares', 'Página de GitHub Pages en línea', 'Tareas automáticas instaladas (5)', 'Primer administrador registrado', 'Reportada al panel del proveedor'])
I += '</table><span class="pestana">Revisión</span></div><p style="font-size:10pt;color:#4A5D63">Si algo sale con ❌, la columna «Cómo arreglarlo» dice exactamente qué hacer. Hazlo y vuelve a usar «3. Revisar instalación».</p></section>'
I += '<section class="seccion"><h2>6. 🟩 Primer ingreso y NIT</h2><p class="intro">Con esto la empresa aparece en tu consola como «Nueva: asigna plan».</p>'
I += paso_t(1, 'Entra como administrador.', '<p>Abre el enlace de la pestaña «Revisión», escribe tu cédula, el código ADM-… y crea tu contraseña.</p>')
I += paso_t(2, 'Escribe el nombre y el NIT, y guarda.', ruta('Configuración', 'Empresa'))
I += '<div class="dos">' + fig('a16', 'Al guardar el NIT la empresa se reporta de una vez a tu consola.')
I += fig('a17', 'Después de que le asignas el plan, el administrador lo ve en «Configuración → Licencia y versión».') + '</div>'
I += paso_t(3, 'En tu consola, asígnale el plan y los módulos (sección 3).', '<p>Le llegan a la empresa de inmediato o esa misma noche.</p>') + '</section>'
I += '<section class="seccion"><h2>7. Publicar cambios sin perder el enlace</h2><p class="intro">Esta es la regla más importante de todas.</p><div class="dos">'
I += '<div class="si"><h3 style="color:#1B7A3E">✅ Así sí</h3>' + ruta('Implementar', 'Administrar implementaciones', '✏️', 'Versión: Nueva versión', 'Implementar') + '<p>El enlace sigue igual. Los celulares no notan nada.</p></div>'
I += '<div class="no"><h3 style="color:#B3261E">❌ Así no</h3>' + ruta('Implementar', 'Nueva implementación') + '<p>Crea un enlace distinto. Todos los celulares dejan de conectar y el enlace viejo puede quedar borrado.</p></div></div>'
I += '<h3 style="margin-top:8mm">Problemas frecuentes</h3><table><tr><th>Lo que ves</th><th>Qué hacer</th></tr>' + ''.join('<tr><td>%s</td><td>%s</td></tr>' % x for x in [
     ('«Sorry, the file you have requested does not exist»', 'Ese enlace está borrado. En la hoja de la empresa usa «3. Revisar instalación»: te pide la URL buena y la guarda.'),
     ('El celular dice «No pudimos conectar con el servidor»', 'Revisa que pegaste el enlace de la EMPRESA (no el del panel). Usa «3. Revisar instalación» y prueba en Chrome.'),
     ('Google pide iniciar sesión al abrir el enlace', 'Administrar implementaciones → ✏️ → Quién tiene acceso: «Cualquier persona» → Implementar.'),
     ('La empresa no aparece en mi consola', 'Falta el NIT en Configuración → Empresa, o el «panel» de su Proveedor.gs está mal. «3. Revisar instalación» lo dice en la última fila.'),
     ('No aparece el menú Control de jornada', 'Recarga la hoja (F5) y espera 10 segundos.'),
     ('Olvidé el código ADM', 'Control de jornada → Ver código del primer administrador.')]) + '</table></section>'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg = b.new_page()
    for nom, html in [('Guia-del-trabajador.pdf', doc('Guía para el trabajador', T)), ('Guia-del-administrador-y-supervisor.pdf', doc('Guía para el administrador y el supervisor', A)), ('Cartel-para-la-obra.pdf', doc('Así marcas tu jornada', C)), ('Guia-de-instalacion.pdf', doc('Guía de instalación', I))]:
        pg.set_content(html, wait_until='load'); pg.wait_for_timeout(500)
        pg.pdf(path=OUT + nom, prefer_css_page_size=True, print_background=True, display_header_footer=nom != 'Cartel-para-la-obra.pdf',
               header_template='<span></span>', footer_template='<div style="font-size:8pt;color:#7A8C91;width:100%;text-align:center;font-family:Inter">Control de jornada · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>')
        print(nom)
    b.close()
