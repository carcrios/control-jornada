# Videos cortos a partir de las pantallas reales: una escena por paso, con el texto en grande.
# Verticales (1080x1920) para el trabajador y el supervisor; horizontales (1920x1080) para el administrador.
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

M = json.load(open('/home/claude/guias/meta.json'))
OUT = '/home/claude/guias/videos/'; TMP = '/home/claude/guias/tmp/'; os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
F = '/usr/share/fonts/opentype/inter/Inter-'
f = lambda w, s: ImageFont.truetype(F + w + '.otf', s)
PRI, ACE, BLANCO = (14, 74, 90), (242, 169, 0), (255, 255, 255)

VIDEOS = [
  ('01-marcar-llegada-y-salida', 'Marcar llegada y salida', 'v', ['w01', 'w02', 'w04', 'w05', 'w06', 'w09', 'w10']),
  ('02-no-sali-a-almuerzo', '¿No saliste a almorzar?', 'v', ['w06', 'w07', 'w08']),
  ('03-se-me-olvido-la-salida', 'Se me olvidó marcar la salida', 'v', ['w21', 'w22']),
  ('04-pedir-permiso', 'Pedir permiso y salir a él', 'v', ['w14', 'w15', 'w16', 'w17', 'w23', 'w24']),
  ('05-mi-pago-y-dudas', 'Mi pago y mis dudas', 'v', ['w11', 'w12', 'w13']),
  ('06-entrar-rapido-y-accesibilidad', 'Entrar con PIN y accesibilidad', 'v', ['w18', 'w20', 'w19']),
  ('07-supervisor-revisar-el-dia', 'Supervisor: revisar el día', 'v', ['s01', 's02', 's03']),
  ('08-admin-el-dia-a-dia', 'Administrador: el día a día', 'h', ['a01', 'a02', 'a03', 'a04']),
  ('09-admin-aprobar-y-cerrar-nomina', 'Aprobar y cerrar la nómina', 'h', ['a05', 'a06', 'a07', 'a08']),
  ('10-admin-informes-y-dudas', 'Informes y dudas de trabajadores', 'h', ['a09', 'a10']),
  ('11-admin-poner-en-marcha', 'Poner en marcha la empresa', 'h', ['a12', 'a11', 'a13']),
]

def envolver(d, txt, fuente, ancho):
    lin, act = [], ''
    for w in txt.split():
        p = (act + ' ' + w).strip()
        if d.textlength(p, font=fuente) <= ancho: act = p
        else: lin.append(act); act = w
    lin.append(act); return lin

def redondear(im, r):
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], r, fill=255); o = Image.new('RGBA', im.size); o.paste(im, (0, 0), m); return o

def sombra(fondo, caja, r, rad=28):
    s = Image.new('RGBA', fondo.size, (0, 0, 0, 0)); ImageDraw.Draw(s).rounded_rectangle(caja, r, fill=(0, 0, 0, 110)); fondo.alpha_composite(s.filter(ImageFilter.GaussianBlur(rad)))

def portada(titulo, sub, orient, n):
    W, H = (1080, 1920) if orient == 'v' else (1920, 1080)
    im = Image.new('RGB', (W, H), PRI); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 14], fill=ACE)
    ft = f('ExtraBold', 96 if orient == 'v' else 104); lin = envolver(d, titulo, ft, W - 200)
    y = H // 2 - len(lin) * 60 - 60
    d.text((100, y - 90), 'Control de jornada · Video %d' % n, font=f('SemiBold', 40), fill=ACE)
    for l in lin: d.text((100, y), l, font=ft, fill=BLANCO); y += 118
    d.text((100, y + 30), sub, font=f('Regular', 44), fill=(200, 225, 230)); return im

def escena(img, texto, i, n, titulo, orient):
    sc = Image.open(img).convert('RGB')
    if orient == 'v':
        W, H = 1080, 1920; fondo = Image.new('RGBA', (W, H), PRI + (255,)); d = ImageDraw.Draw(fondo)
        d.text((60, 56), titulo, font=f('Bold', 44), fill=BLANCO); d.text((W - 60, 60), '%d / %d' % (i, n), font=f('SemiBold', 40), fill=ACE, anchor='ra')
        ft = f('Bold', 54); lin = envolver(d, texto, ft, W - 140); alto_txt = len(lin) * 70 + 80
        disp = H - 150 - alto_txt - 60; s = min(disp / sc.height, 900 / sc.width); sc = sc.resize((int(sc.width * s), int(sc.height * s)), Image.LANCZOS)
        x = (W - sc.width) // 2; y = 150; sombra(fondo, [x, y + 16, x + sc.width, y + sc.height + 16], 40); fondo.alpha_composite(redondear(sc, 40), (x, y))
        ty = y + sc.height + 50; d = ImageDraw.Draw(fondo); d.rounded_rectangle([40, ty - 20, W - 40, ty + len(lin) * 70 + 30], 28, fill=BLANCO)
        for k, l in enumerate(lin): d.text((W // 2, ty + 8 + k * 70), l, font=ft, fill=PRI, anchor='ma')
    else:
        W, H = 1920, 1080; fondo = Image.new('RGBA', (W, H), PRI + (255,)); d = ImageDraw.Draw(fondo)
        s = min(1340 / sc.width, 940 / sc.height); sc = sc.resize((int(sc.width * s), int(sc.height * s)), Image.LANCZOS)
        x, y = 50, (H - sc.height) // 2; sombra(fondo, [x, y + 12, x + sc.width, y + sc.height + 12], 18); fondo.alpha_composite(redondear(sc, 18), (x, y))
        px = x + sc.width + 50; aw = W - px - 50; d = ImageDraw.Draw(fondo)
        d.text((px, 90), titulo, font=f('Bold', 36), fill=(200, 225, 230)); d.text((px, 150), 'Paso %d de %d' % (i, n), font=f('ExtraBold', 44), fill=ACE)
        ft = f('Bold', 48); yy = 260
        for l in envolver(d, texto, ft, aw): d.text((px, yy), l, font=ft, fill=BLANCO); yy += 64
    return fondo.convert('RGB')

def codificar(png, seg, salida):
    tmp = salida[:-4] + '.tmp.mp4'
    r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', png, '-vf', 'format=yuv420p,loop=-1:1,trim=duration=%.2f,fade=t=in:st=0:d=0.3:color=0x0E4A5A' % seg,
                        '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', tmp])
    if r.returncode == 0: os.replace(tmp, salida)
    else: sys.exit('falló ' + salida)

solo = sys.argv[1:]
for n, (nom, titulo, orient, pasos) in enumerate(VIDEOS, 1):
    if solo and nom[:2] not in solo: continue
    partes = []
    p = TMP + nom + '-00.png'; portada(titulo, '%d pasos · %s' % (len(pasos), 'para el celular' if orient == 'v' else 'panel del administrador'), orient, n).save(p)
    codificar(p, 2.6, TMP + nom + '-00.mp4'); partes.append(nom + '-00.mp4')
    for i, k in enumerate(pasos, 1):
        p = TMP + '%s-%02d.png' % (nom, i); escena('/home/claude/guias/img/%s.jpg' % k, M[k], i, len(pasos), titulo, orient).save(p)
        seg = max(4.2, min(8.5, 2.4 + len(M[k].split()) * 0.27))  # tiempo para leer con calma
        codificar(p, seg, TMP + '%s-%02d.mp4' % (nom, i)); partes.append('%s-%02d.mp4' % (nom, i))
    open(TMP + nom + '.txt', 'w').write(''.join("file '%s'\n" % x for x in partes))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', TMP + nom + '.txt', '-c', 'copy', '-movflags', '+faststart', OUT + nom + '.mp4'], check=True)
    print('listo', nom)
