from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math
import random

OUT = Path("static/marketing")
OUT.mkdir(parents=True, exist_ok=True)
random.seed(1234)

def font(size, bold=False):
    paths = [
       "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
       "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"
    ]
    for p in paths:
        if Path(p).exists(): return ImageFont.truetype(p,size)
    return ImageFont.load_default()

INK=(9,16,24); WHITE=(239,249,246); LIME=(196,255,138); MUTED=(172,194,188)
W=1080; H=1080

topics = [
 ("presentacion", "AUTOMATIZAR\nES AVANZAR.", "Si lo hacés mil veces,\npodemos hacer que se haga solo.", "AUTOMATIZACIÓN · SOFTWARE A MEDIDA"),
 ("planillas", "MENOS COPIAR.\nMÁS CREAR.", "Planillas, registros y reportes.\nReducí tareas repetitivas.", "EXCEL · GOOGLE SHEETS · REPORTES"),
 ("gestion", "¿DÓNDE QUEDÓ\nESE PEDIDO?", "Organizá consultas, estados\ny presupuestos en un solo lugar.", "GESTIÓN · CONSULTAS · SEGUIMIENTO"),
 ("software", "TU PROCESO,\nTU SOFTWARE.", "Diseñamos herramientas a medida\npara desafíos concretos.", "SISTEMAS · INTEGRACIONES · AUTOMATIZACIÓN")
]
for idx, (slug,title,desc,kicker) in enumerate(topics):
    img=Image.new("RGB",(W,H), INK); d=ImageDraw.Draw(img)
    # outlined flowing data lanes, intentionally abstract
    for j in range(9):
        cy=70+j*54
        points=[]
        for x in range(0,W+1,10):
            y=int(cy+34*math.sin(x/134+j*.62))
            points.append((x,y))
        d.line(points,fill=(22,49,43),width=2)
    d.rounded_rectangle((60,65,1020,1010),radius=30,outline=(63,91,80),width=2)
    d.rounded_rectangle((90,93,320,142),radius=12,fill=(32,58,47))
    d.text((109,105),"FLUYNOVA  /  0"+str(idx+1),font=font(19,True),fill=LIME)
    d.text((92,245),title,font=font(71,True),fill=WHITE,spacing=22,stroke_width=0)
    d.rounded_rectangle((93,480,165,489),radius=4,fill=LIME)
    d.multiline_text((94,545),desc,font=font(33),fill=MUTED,spacing=18)
    d.rounded_rectangle((93,795,984,880),radius=12,fill=(25,46,40),outline=(51,83,69),width=2)
    d.text((117,818),kicker,font=font(22,True),fill=LIME)
    d.text((93,925),"fluynova-web.onrender.com",font=font(26),fill=WHITE)
    # visual dots
    for m in range(5):
        x=820+m*40;y=155+(m%2)*24
        d.ellipse((x-7,y-7,x+7,y+7),fill=LIME if m%2 else (52,93,69))
    img.save(OUT/(slug+".jpg"),"JPEG",quality=88,optimize=True,progressive=True)
    print(OUT/(slug+".jpg"))

# Asset build version 1: Instagram organic campaign.
