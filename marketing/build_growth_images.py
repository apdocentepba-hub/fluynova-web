from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math

OUT = Path("marketing/growth")
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1080, 1350

def ft(size, bold=False):
    paths = (["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"]
             if bold else
             ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"])
    for name in paths:
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()

def mix(a,b,p):
    return tuple(round(x*(1-p)+y*p) for x,y in zip(a,b))

def card(d, y, n, title, line, palette, height=138):
    x1,x2=74,1006
    d.rounded_rectangle((x1,y,x2,y+height),radius=24,fill=palette["card"],outline=palette["edge"],width=2)
    d.rounded_rectangle((x1+23,y+24,x1+120,y+height-24),radius=16,fill=palette["tint"])
    d.text((x1+38,y+height/2-25),n,font=ft(44,True),fill=palette["accent"])
    d.text((x1+150,y+19),title,font=ft(39,True),fill=palette["white"])
    d.text((x1+150,y+75),line,font=ft(26),fill=palette["muted"])

def render(filename, brand, headline, subtitle, items, footer, disclaimer, palette):
    im=Image.new("RGB",(W,H),palette["bg"])
    px=im.load()
    for y in range(H):
        p=y/H
        c=mix(palette["bg"],palette["bg_bottom"],p)
        for x in range(W): px[x,y]=c
    d=ImageDraw.Draw(im)
    # Subtle radial dots / technical grids, entirely decorative
    for ix in range(44,1060,47):
        for iy in range(28,520,47):
            if (ix+iy)//47%3!=0: continue
            d.ellipse((ix,iy,ix+3,iy+3),fill=palette["dot"])
    d.rounded_rectangle((74,68,480,132),radius=16,fill=palette["tint"],outline=palette["edge"],width=2)
    d.text((98,82),brand,font=ft(29,True),fill=palette["accent"])
    d.rounded_rectangle((75,169,101,175),radius=3,fill=palette["accent"])
    d.multiline_text((70,215),headline,font=ft(75,True),fill=palette["white"],spacing=2)
    d.text((74,432),subtitle,font=ft(33),fill=palette["muted"])
    if len(items)==4:
        for i,(name,desc) in enumerate(items):
            card(d,515+i*155,str(i+1).zfill(2),name,desc,palette,137)
        bot=1165
    else:
        for i,(name,desc) in enumerate(items):
            card(d,533+i*183,str(i+1).zfill(2),name,desc,palette,160)
        bot=1150
    d.rounded_rectangle((72,bot,1008,bot+87),radius=18,fill=palette["accent"])
    d.text((98,bot+26),footer,font=ft(31,True),fill=palette["button"])
    d.text((76,1265),disclaimer,font=ft(22),fill=palette["muted"])
    path=OUT/filename
    im.save(path,"JPEG",quality=90,optimize=True,progressive=True)
    print(f"{path} {path.stat().st_size} bytes")

flu={"bg":(10,19,28),"bg_bottom":(13,42,39),"white":(248,252,247),"muted":(188,204,197),"accent":(191,250,129),"button":(13,30,23),"card":(21,46,42),"tint":(35,71,57),"edge":(55,93,73),"dot":(37,64,62)}
apd={"bg":(11,25,52),"bg_bottom":(16,54,77),"white":(245,252,255),"muted":(183,212,233),"accent":(96,228,248),"button":(6,43,62),"card":(18,54,84),"tint":(29,80,108),"edge":(57,113,144),"dot":(36,76,103)}
render("fluynova-turnos-guia-20261109.jpg","FLUYNOVA  /  GUÍA PRÁCTICA",
       "¿PERDÉS TURNOS\\nEN WHATSAPP?",
       "Registrá estas 3 cosas antes de automatizar.",
       [("Nombre y contacto","Sabé a quién tenés que confirmar."),
        ("Fecha y horario","Evitá confusiones y superposiciones."),
        ("Estado del turno","Pendiente · confirmado · cancelado.")],
       "GUARDÁ ESTA GUÍA  ·  SEGUÍ @FLUYNOVA",
       "Más ideas de automatización  •  fluynova-web.onrender.com",flu)
render("apdocentepba-filtros-guia-20261029.jpg","APDOCENTEPBA  /  GUÍA DOCENTE",
       "¿TUS ALERTAS\\nNO COINCIDEN?",
       "Revisá tus preferencias en estos 4 pasos.",
       [("Distrito","Comprobá qué distritos elegiste."),
        ("Cargo o materia","Verificá código y denominación."),
        ("Nivel y modalidad","Revisá las opciones seleccionadas."),
        ("Turno","Confirmá que coincide con tu búsqueda.")],
       "GUARDALA  ·  SEGUÍ @APDOCENTEPBA",
       "Las postulaciones y datos oficiales se verifican en ABC / DGCyE.",apd)
