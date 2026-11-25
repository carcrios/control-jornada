# Toma las pantallas reales de la demo para las guías y los videos.
# Cada captura: id, imagen JPEG y el texto que la explica.
import json, datetime, sys, traceback
from playwright.sync_api import sync_playwright

D = '/home/claude/guias/img/'; Z = datetime.timezone(datetime.timedelta(hours=-5))
URL = 'http://localhost:8791/demo.html'; META = json.load(open('/home/claude/guias/meta.json')); FALLAS = []
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
    c, m = abrir(p, b, 'Pedro Pérez', t(2026, 11, 20, 6, 55))
    def ayudaT():
        m.evaluate("()=>{const s=document.createElement('style');s.textContent='.permiso-hoy{display:none!important}';document.head.appendChild(s)}"); m.wait_for_timeout(1800)
        cap(m, 'w25', '¿Tienes una duda? Toca el botón «?» de Ayuda. Está siempre a la mano, en cualquier pantalla.', '.ayuda-flotante', arriba=True)
        m.click('.ayuda-flotante'); m.wait_for_timeout(900); m.click('.ayuda-lista button >> nth=0'); m.wait_for_timeout(2500)
        m.evaluate("() => new Promise((ok) => { const v = document.querySelector('.ayuda-video video'); if (!v) return ok(); v.muted = true; v.pause(); const f = () => ok(); v.addEventListener('seeked', f, { once: true }); v.currentTime = 9; setTimeout(ok, 6000); })"); m.wait_for_timeout(800)
        cap(m, 'w26', 'En «Videos» toca el tema y míralo ahí mismo: cada video dura menos de un minuto.', '.ayuda-lista button >> nth=0')
        m.click('[role=dialog] >> text=Preguntas'); m.wait_for_timeout(1200)
        cap(m, 'w27', 'En «Preguntas» escribe tu duda con tus palabras. Si no está la respuesta, envíala a nómina desde ahí.')
    paso('ayudaT', ayudaT); c.close()
    c, m = abrir(p, b, 'Andrea Rojas', t(2026, 11, 20, 7, 40), movil=False)
    def ayudaA():
        cap(m, 'a14', 'El botón «Ayuda» está abajo a la derecha en todas las pantallas del panel.', '.ayuda-flotante', arriba=True)
        m.click('.ayuda-flotante'); m.wait_for_timeout(1200)
        cap(m, 'a15', 'Los videos del administrador salen primero. En «Guías PDF» están esta guía, la del trabajador y el cartel para la obra.')
        m.keyboard.press('Escape'); m.wait_for_timeout(600)
        m.click('.admin-nav >> text=Configuración'); m.wait_for_timeout(2500)
        cap(m, 'a16', 'Escribe la razón social y el NIT en «Configuración → Empresa» y guarda. Con el NIT la empresa queda conectada a su licencia.', 'label:has-text("NIT")', arriba=True)
        m.click('text=Licencia y versión'); m.wait_for_timeout(2000)
        m.evaluate("scrollTo(0,0)"); cap(m, 'a17', '«Licencia y versión»: tu plan, los módulos incluidos, el vencimiento y la versión instalada. Cualquier cambio de tu proveedor llega solo.', '.tarjeta:has-text("Plan y módulos")')
    paso('ayudaA', ayudaA); c.close()
    b.close()
json.dump(META, open('/home/claude/guias/meta.json', 'w'), ensure_ascii=False, indent=1)
print('capturas:', len(META)); print('fallas:', *FALLAS, sep='\n')
