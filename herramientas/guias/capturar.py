# Toma las pantallas reales de la demo para las guías y los videos.
# Cada captura: id, imagen JPEG y el texto que la explica.
import json, datetime, sys, traceback
from playwright.sync_api import sync_playwright

D = '/home/claude/guias/img/'; Z = datetime.timezone(datetime.timedelta(hours=-5))
URL = 'http://localhost:8791/demo.html'; META = {}; FALLAS = []
OCULTAR = ".avisos-flotantes{display:none!important} button[aria-controls=panel-demo]{display:none!important} body{padding-top:0!important} html body .cabecera{top:0!important} .flotante,[class*=toast]{transition:none!important}"
GPS = {'latitude': 4.6501, 'longitude': -74.1002, 'accuracy': 10}

def t(y, mo, d, h, mi): return datetime.datetime(y, mo, d, h, mi, tzinfo=Z)

def abrir(p, b, quien, cuando, movil=True):
    kw = dict(viewport={'width': 400, 'height': 860}, device_scale_factor=2, is_mobile=True, has_touch=True) if movil else dict(viewport={'width': 1280, 'height': 800}, device_scale_factor=1.5)
    c = b.new_context(permissions=['geolocation'], geolocation=GPS, locale='es-CO', **kw)
    m = c.new_page(); m.clock.install(time=cuando); m.goto(URL); m.wait_for_timeout(1300)
    persona(m, quien); return c, m

def persona(m, quien):
    m.evaluate("document.getElementById('ocultar-demo')?.remove()")
    if not m.locator('#panel-demo').count(): m.click('button[aria-controls=panel-demo]'); m.wait_for_timeout(300)
    m.click('#panel-demo >> text=%s' % quien); m.wait_for_timeout(4800)
    if m.locator('#panel-demo').count(): m.click('button[aria-controls=panel-demo]')
    m.evaluate("(c)=>{const s=document.createElement('style');s.id='ocultar-demo';s.textContent=c;document.head.appendChild(s)}", OCULTAR); m.wait_for_timeout(300)

def resaltar(m, sel):
    if not sel: return
    l = m.locator(sel).first; l.evaluate("e=>e.scrollIntoView({block:'center'})"); m.wait_for_timeout(200)
    l.evaluate("e=>{e.dataset.guia='1';e.style.outline='5px solid #E4002B';e.style.outlineOffset='4px';e.style.boxShadow='0 0 0 12px rgba(228,0,43,.18)'}")

def limpiar(m):
    m.evaluate("document.querySelectorAll('[data-guia]').forEach(e=>{e.style.outline='';e.style.boxShadow='';delete e.dataset.guia})")

def cap(m, id, texto, sel=None, arriba=False, espera=250):
    try:
        if arriba: m.evaluate("scrollTo(0,0)")
        resaltar(m, sel); m.wait_for_timeout(espera)
        m.screenshot(path=D + id + '.jpg', type='jpeg', quality=92); META[id] = texto; limpiar(m)
    except Exception as e: FALLAS.append((id, str(e)[:160]))

def paso(nombre, f):
    try: f()
    except Exception: FALLAS.append((nombre, traceback.format_exc()[-400:]))

def disparar(m):
    m.wait_for_timeout(1500)
    if m.locator('.camara').count(): m.wait_for_timeout(700); m.click('.camara .disparo'); m.wait_for_timeout(2000)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # ---------- TRABAJADOR: un día normal ----------
    c, m = abrir(p, b, 'Pedro Pérez', t(2026, 11, 20, 6, 55))
    m.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='.permiso-hoy{display:none!important}';document.head.appendChild(s)})")
    m.evaluate("()=>{const s=document.createElement('style');s.textContent='.permiso-hoy{display:none!important}';document.head.appendChild(s)}")
    def dia():
        cap(m, 'w01', 'Al abrir la aplicación ves la hora, tu obra y un solo botón grande con lo que toca ahora.', arriba=True)
        cap(m, 'w02', 'Al llegar a la obra toca «Llegué». Un solo toque.', '.boton-marcar')
        m.click('.boton-marcar'); m.wait_for_timeout(1500)
        if m.locator('.camara').count(): m.wait_for_timeout(800); cap(m, 'w03', 'Si la empresa lo pide, toma una foto rápida de tu cara para confirmar que eres tú.', '.camara .disparo'); m.click('.camara .disparo'); m.wait_for_timeout(2000)
        cap(m, 'w04', 'Pantalla verde con la hora en grande: tu llegada quedó registrada. El celular vibra.', espera=100)
        cap(m, 'w05', '¿Tocaste por error? Durante 2 minutos puedes tocar «Me equivoqué, deshacer».', '.confirmacion button:has-text("deshacer")', espera=100)
        m.click('.confirmacion button:has-text("Listo")'); m.wait_for_timeout(500)
        cap(m, 'w06', 'El almuerzo no se marca: se descuenta solo según el horario de tu obra.', '.reloj-tarjeta .chico', arriba=True)
        m.clock.set_system_time(t(2026, 11, 20, 12, 10)); m.reload(); m.wait_for_timeout(4000); persona_ocultar()
        cap(m, 'w07', 'Si te pidieron no salir a almorzar, toca «¿No saliste a almuerzo? Repórtalo».', 'button:has-text("No saliste a almuerzo")')
        m.click('button:has-text("No saliste a almuerzo")'); m.wait_for_timeout(700)
        dlg = m.locator('[role=dialog]')
        if dlg.locator('select').count(): dlg.locator('select').first.select_option(index=1)
        dlg.locator('textarea').first.fill('Terminamos el vaciado de la placa')
        cap(m, 'w08', 'Elige quién lo autorizó y escribe o dicta por qué. Tu jefe lo aprueba y ese tiempo cuenta como trabajado.', '[role=dialog] textarea')
        dlg.locator('button:has-text("Enviar"), button:has-text("Reportar")').last.click(); m.wait_for_timeout(2000)
        m.clock.set_system_time(t(2026, 11, 20, 16, 32)); m.reload(); m.wait_for_timeout(4000); persona_ocultar()
        cap(m, 'w09', 'Al terminar la jornada toca «Me voy».', '.boton-marcar')
        m.click('.boton-marcar'); disparar(m)
        cap(m, 'w10', 'Listo: salida registrada. Si no hay señal, se guarda en el celular y se envía sola.', espera=100)
        m.click('.confirmacion button:has-text("Listo")'); m.wait_for_timeout(500)
        cap(m, 'w11', 'En «Lo que llevas» ves primero cuánto va tu pago (ya con descuentos) y luego tus horas.', '.plata')
    def persona_ocultar():
        m.evaluate("(c)=>{if(!document.getElementById('ocultar-demo')){const s=document.createElement('style');s.id='ocultar-demo';s.textContent=c;document.head.appendChild(s)}}", OCULTAR)
    paso('dia', dia)

    def dudas():
        m.click('button:has-text("¿Dudas sobre tu pago?")'); m.wait_for_timeout(1500)
        caja = m.get_by_role('textbox', name='Escribe o dicta tu pregunta'); caja.fill('cuánto me pagan un domingo'); m.wait_for_timeout(400)
        cap(m, 'w12', '¿Dudas sobre tu pago? Escribe o dicta la pregunta con tus palabras y la guía responde con tus propios valores.', '.respuesta-guia')
        caja.fill('no me aparecen las extras del lunes'); m.wait_for_timeout(300)
        m.click('button:has-text("Envía tu duda")'); m.wait_for_timeout(400); m.click('.enviar-novedad .opciones-grandes >> text=Horas extra')
        cap(m, 'w13', 'Si no encuentras la respuesta, envía tu duda a nómina: eliges el tema, el día y lo cuentas. La respuesta te llega ahí mismo.', '.enviar-novedad textarea')
        m.click('.enviar-novedad button:has-text("Enviar"):not(:has-text("duda"))'); m.wait_for_timeout(1500); m.keyboard.press('Escape'); m.wait_for_timeout(500)
    paso('dudas', dudas)

    def permiso():
        m.click('nav.nav-inferior >> text=Permisos'); m.wait_for_timeout(1500)
        m.click('button:has-text("Pedir permiso"), button:has-text("Solicitar")'); m.wait_for_timeout(700)
        cap(m, 'w14', 'Pedir permiso, paso 1: toca para qué es.', '.opciones-grandes >> text=Cita médica')
        m.click('.opciones-grandes >> text=Cita médica'); m.wait_for_timeout(200)
        m.click('.opciones-grandes >> text=Hoy, salgo y no vuelvo'); m.locator('[role=dialog] input[type=time]').fill('15:00')
        cap(m, 'w15', 'Paso 2: cuándo. Si sales en la tarde y no vuelves ese día, elige «Hoy, salgo y no vuelvo» y pon la hora.', '.opciones-grandes >> text=Hoy, salgo y no vuelvo')
        cap(m, 'w16', 'Paso 3: «Enviar solicitud». Tu jefe la aprueba desde su celular.', 'button:has-text("3. Enviar")')
        m.click('button:has-text("3. Enviar")'); m.wait_for_timeout(2500)
        cap(m, 'w17', 'En «Permisos» ves el estado de cada solicitud y puedes avisarle a tu jefe por WhatsApp.', arriba=True)
    paso('permiso', permiso)

    def perfil():
        m.click('nav.nav-inferior >> text=Perfil'); m.wait_for_timeout(1200)
        m.get_by_role('textbox', name='PIN de 4 a 6 números').fill('7391'); m.get_by_role('textbox', name='Repite el PIN').fill('7391')
        cap(m, 'w18', 'En «Perfil» → «Entrar rápido» crea un PIN de 4 números o activa tu huella: no tendrás que escribir cédula ni contraseña.', 'button:has-text("Usar este PIN")')
        m.click('button:has-text("Usar este PIN")'); m.wait_for_timeout(1800)
        m.click('.btn-a11y'); m.wait_for_timeout(700)
        cap(m, 'w19', 'El botón de accesibilidad (arriba a la derecha) agranda la letra, lee la pantalla en voz alta y permite dictar.', arriba=False)
        m.keyboard.press('Escape'); m.wait_for_timeout(300)
        m.evaluate("localStorage.removeItem('cj.token')"); m.reload(); m.wait_for_timeout(4000); persona_ocultar()
        for d in '739': m.click('.teclado-pin button:text-is("%s")' % d)
        cap(m, 'w20', 'La próxima vez solo escribes tu PIN y entras.', '.teclado-pin')
    paso('perfil', perfil)
    c.close()

    # ---------- TRABAJADOR: salida olvidada ----------
    c, m = abrir(p, b, 'Pedro Pérez', t(2026, 11, 19, 6, 55))
    def olvido():
        if 'Llegu' in m.locator('.boton-marcar').inner_text():
            m.click('.boton-marcar'); disparar(m); m.click('.confirmacion button:has-text("Listo")')
        m.clock.set_system_time(t(2026, 11, 20, 6, 50)); m.reload(); m.wait_for_timeout(4500)
        m.evaluate("(c)=>{const s=document.createElement('style');s.id='ocultar-demo';s.textContent=c;document.head.appendChild(s)}", OCULTAR)
        cap(m, 'w21', '¿Se te olvidó marcar la salida ayer? La aplicación te avisa al día siguiente.', '.recordatorio', arriba=True)
        m.click('.boton-marcar'); m.wait_for_timeout(800)
        cap(m, 'w22', 'Al tocar «Llegué» te pregunta a qué hora saliste ayer. Lo corriges y se marca tu llegada de hoy de una vez.', '[role=dialog] input[type=time]')
    paso('olvido', olvido); c.close()

    # ---------- TRABAJADOR: salir a mi permiso ----------
    c = b.new_context(viewport={'width': 400, 'height': 860}, device_scale_factor=2, is_mobile=True, has_touch=True, permissions=['geolocation'], geolocation=GPS)
    m = c.new_page(); m.goto(URL); m.wait_for_timeout(1300); persona(m, 'Pedro Pérez')
    def salir():
        cap(m, 'w23', 'Cuando tienes un permiso aprobado para hoy, aparece la tarjeta con el botón «Salir a mi permiso».', '.permiso-hoy button')
        m.click('button:has-text("Salir a mi permiso")'); m.wait_for_timeout(600)
        cap(m, 'w24', 'Confirma y queda registrada la hora real de tu salida. Al volver, toca «Regresé del permiso».', 'button:has-text("Sí, salir ahora")')
    paso('salir', salir); c.close()

    # ---------- ADMINISTRADOR (escritorio) ----------
    c, m = abrir(p, b, 'Andrea Rojas', t(2026, 11, 20, 14, 10), movil=False)
    def admin():
        cap(m, 'a01', 'El panel abre en «Hoy»: la hora, quién está trabajando y cada obra en un vistazo.', arriba=True)
        cap(m, 'a02', '«Qué necesito atender hoy» lista los pendientes del día. Cada uno tiene su botón «Resolver».', '.atender')
        m.keyboard.press('Control+k'); m.keyboard.type('pedro'); m.wait_for_timeout(1500)
        cap(m, 'a03', 'Busca a cualquiera con Ctrl+K: por nombre, cédula u obra. Al elegirlo se abre su expediente.', '#res-busqueda')
        m.keyboard.press('Escape'); m.locator('.busqueda-global input').fill(''); m.wait_for_timeout(300)
        m.click('.admin-nav >> text=Personal'); m.wait_for_timeout(2500)
        m.locator('tr:has-text("Pedro Pérez") button:has-text("Acciones"), li:has-text("Pedro Pérez") button:has-text("Acciones")').first.click(); m.wait_for_timeout(700)
        cap(m, 'a04', 'En «Personal», el botón «Acciones» de cada persona: expediente, marcación olvidada, recordatorio, permisos.', '.acciones-rapidas')
        m.keyboard.press('Escape'); m.wait_for_timeout(300)
        m.click('.admin-nav >> text=Horas extra'); m.wait_for_timeout(2500)
        cap(m, 'a05', '«Horas extra»: aprueba, ajusta o rechaza. Solo lo aprobado entra a la nómina.', 'button:has-text("Aprobar")')
        m.click('.admin-nav >> text=Permisos'); m.wait_for_timeout(2500)
        if m.locator('button:has-text("Todos")').count(): m.locator('button:has-text("Todos")').first.click(); m.wait_for_timeout(1500)
        cap(m, 'a06', '«Permisos»: ves el tipo, las fechas, el soporte y las firmas. Apruebas o rechazas con un toque.', arriba=True)
        m.click('.admin-nav >> text=Nómina'); m.wait_for_timeout(3500)
        cap(m, 'a07', '«Nómina» es un flujo guiado de 4 pasos. Antes de cerrar te muestra lo que falta corregir.', '.flujo-nomina', arriba=True)
        if m.locator('.inconsistencias').count(): cap(m, 'a08', '«Antes de cerrar»: cada inconsistencia tiene un botón que te lleva a corregirla.', '.inconsistencias')
        m.click('.admin-nav >> text=Informes'); m.wait_for_timeout(2500)
        m.click('.tarjeta-clic:has-text("Extras por obra")'); m.wait_for_timeout(2500)
        cap(m, 'a09', '«Informes» de un clic: tardanzas, extras por obra, fatiga y presupuesto contra lo real.', '.un-clic', arriba=True)
        m.click('.admin-nav >> text=Guía de nómina'); m.wait_for_timeout(2500)
        cap(m, 'a10', '«Guía de nómina»: aquí respondes las dudas que te envían los trabajadores.', arriba=True)
        m.click('.admin-nav >> text=Obras'); m.wait_for_timeout(2500)
        cap(m, 'a11', '«Obras y sedes»: ubicación, radio, horario (con plantillas de 42 h), almuerzo y presupuesto de cada obra.', arriba=True)
        m.click('.admin-nav >> text=Asistente de inicio'); m.wait_for_timeout(2000)
        cap(m, 'a12', 'Empresa nueva: el «Asistente de inicio» la deja lista en 5 pasos.', arriba=True)
        m.click('.admin-nav >> text=Configuración'); m.wait_for_timeout(2500)
        cap(m, 'a13', '«Configuración»: reglas de marcación, nómina, parámetros legales y alertas.', arriba=True)
    paso('admin', admin); c.close()

    # ---------- SUPERVISOR (celular) ----------
    c, m = abrir(p, b, 'Sara', t(2026, 11, 20, 17, 10))
    def sup():
        m.click('text=Mi equipo'); m.wait_for_timeout(3000)
        sel = m.locator('select[aria-label="Sección de administración"], .admin-movil select').first
        sel.select_option('revision'); m.wait_for_timeout(2000)
        cap(m, 's01', 'El supervisor solo ve a su gente. En «Revisar el día» confirma las horas o marca «No vino».', '.revision', arriba=True)
        m.locator('.revision >> button:has-text("Novedad")').first.click(); m.wait_for_timeout(600)
        m.locator('[role=dialog] textarea').fill('Llegó 7:20 por trancón, avisó por WhatsApp')
        cap(m, 's02', 'Si algo pasó, deja una novedad. Nómina la ve sin preguntar.', '[role=dialog] textarea')
        m.keyboard.press('Escape'); m.wait_for_timeout(300)
        sel.select_option('ubicacion'); m.wait_for_timeout(1500)
        m.locator('.admin-cuerpo button:has-text("ubicación")').first.click(); m.wait_for_timeout(600)
        cap(m, 's03', 'Desde la obra, el supervisor toma la ubicación con su celular para que la marcación funcione bien.', 'button:has-text("Tomar mi ubicación")')
    paso('sup', sup); c.close()
    b.close()

json.dump(META, open('/home/claude/guias/meta.json', 'w'), ensure_ascii=False, indent=1)
print('capturas:', len(META)); print('fallas:', *FALLAS, sep='\n')
