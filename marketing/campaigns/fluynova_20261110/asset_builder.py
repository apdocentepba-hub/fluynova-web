"""FLUYNOVA — carrusel original para una campaña comercial educativa.

Genera tres JPEG 1080x1350 sin datos de clientes, recursos ajenos ni promesas
de resultados. Solo produce archivos; no publica ni se conecta a Metricool.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
W, H = 1080, 1350
BG_TOP=(11,20,27)
BG_BOTTOM=(14,46,39)
PALE=(243,252,245)
MUTED=(182,208,193)
LIME=(191,249,124)
DARK=(14,40,29)
CARD=(24,53,47)
BORDER=(61,108,76)


def font(size: int, bold=False):
    options = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for item in options:
        if Path(item).exists():
            return ImageFont.truetype(item, size)
    raise RuntimeError("No hay fuente serif/sans instalada: abortar creación")


def canvas(page):
    image=Image.new("RGB",(W,H),BG_TOP)
    d=ImageDraw.Draw(image)
    for y in range(H):
        t=y/(H-1)
        rgb=tuple(round(BG_TOP[k]*(1-t)+BG_BOTTOM[k]*t) for k in range(3))
        d.line((0,y,W,y), fill=rgb)
    for x in range(50,W,76):
        for y in range(180,1080,76):
            d.ellipse((x,y,x+3,y+3),fill=(45,86,69))
    d.rounded_rectangle((64,61,1016,1290),radius=35,outline=(63,95,76),width=3)
    d.rounded_rectangle((89,87,373,149),radius=16,fill=DARK,outline=BORDER,width=2)
    d.text((115,105),"FLUYNOVA",font=font(28,True),fill=LIME)
    d.text((785,105),f"GUÍA / {page:02d} DE 03",font=font(22,True),fill=MUTED)
    d.rounded_rectangle((91,1208,989,1263),radius=16,fill=DARK)
    d.text((121,1222),"AUTOMATIZACIÓN  ·  SOFTWARE A MEDIDA",font=font(20,True),fill=MUTED)
    return image,d


def multiline(draw, lines, x,y, size=68, line_gap=15,fill=PALE):
    f=font(size,True)
    for line in lines:
        draw.text((x,y),line,font=f,fill=fill)
        y+=size+line_gap
    return y


def rule(draw,x,y,w=896):
    draw.rounded_rectangle((x,y,x+w,y+6),radius=3,fill=(87,142,101))


def label(draw,text,y):
    draw.rounded_rectangle((94,y,985,y+96),radius=19,fill=CARD,outline=BORDER,width=2)
    draw.text((121,y+23),text,font=font(35,True),fill=PALE)


def page1():
    im,d=canvas(1)
    multiline(d,["¿CUÁNTO TIEMPO","TE LLEVA ESA","TAREA REPETIDA?"],94,225,61,15)
    d.text((98,505),"Ejemplo ilustrativo, no un caso de cliente",font=font(25),fill=MUTED)
    d.rounded_rectangle((93,577,987,968),radius=30,fill=CARD,outline=BORDER,width=2)
    d.text((149,632),"10 MIN  ×  20 VECES",font=font(46,True),fill=LIME)
    rule(d,150,718,777)
    d.text((149,764),"200 MINUTOS",font=font(67,True),fill=PALE)
    d.text((149,854),"3 h 20 min por semana",font=font(37),fill=MUTED)
    d.text((100,1040),"El primer paso es medir, no comprar software.",font=font(27),fill=PALE)
    d.text((100,1093),"No todo proceso conviene automatizar.",font=font(26),fill=MUTED)
    return im


def page2():
    im,d=canvas(2)
    multiline(d,["¿CUÁNDO VALE","LA PENA","AUTOMATIZAR?"],94,225,65,15)
    d.text((98,505),"Revisá estas cuatro condiciones:",font=font(32),fill=MUTED)
    entries=[
      ("01","SE REPITE","La misma tarea varias veces por semana"),
      ("02","LOS DATOS EXISTEN","Están en planillas, formularios o sistemas"),
      ("03","HAY REGLAS","Se puede describir qué hacer en cada caso"),
      ("04","EXISTE CONTROL","Alguien puede revisar errores y excepciones"),
    ]
    for i,(n,title,desc) in enumerate(entries):
        y=580+i*149
        d.rounded_rectangle((93,y,987,y+126),radius=20,fill=CARD,outline=BORDER,width=2)
        d.rounded_rectangle((113,y+17,199,y+109),radius=14,fill=DARK)
        d.text((129,y+41),n,font=font(34,True),fill=LIME)
        d.text((221,y+15),title,font=font(29,True),fill=PALE)
        d.text((221,y+68),desc,font=font(22),fill=MUTED)
    d.text((100,1180),"Si no se cumplen, primero hay que ordenar.",font=font(25),fill=MUTED)
    return im


def page3():
    im,d=canvas(3)
    multiline(d,["¿Y SI LO","EVALUAMOS","EN FLUYNOVA?"],94,225,70,15)
    d.text((100,536),"Contanos tres datos:",font=font(34),fill=MUTED)
    label(d,"1  ¿Qué tarea repetís?",610)
    label(d,"2  ¿Cuántas veces la hacés?",726)
    label(d,"3  ¿Qué sistema o planilla usás?",842)
    d.rounded_rectangle((94,988,986,1093),radius=22,fill=LIME)
    d.text((129,1018),"EVALUACIÓN ORIENTATIVA SIN CARGO",font=font(28,True),fill=DARK)
    d.text((100,1130),"fluynova-web.onrender.com/diagnostico/",font=font(27),fill=PALE)
    d.text((100,1172),"No prometemos ahorro sin revisar el proceso.",font=font(22),fill=MUTED)
    return im


def main():
    ROOT.mkdir(parents=True,exist_ok=True)
    index=[]
    for name,render in [
        ("01_tiempo.jpg",page1),
        ("02_condiciones.jpg",page2),
        ("03_diagnostico.jpg",page3),
    ]:
        path=ROOT/name
        im=render()
        assert im.size==(1080,1350) and im.mode=="RGB"
        im.save(path,format="JPEG",quality=89,optimize=True,progressive=True,subsampling=0)
        with Image.open(path) as check:
            check.verify()
        raw=path.read_bytes()
        index.append({"file":name,"width":W,"height":H,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()})
        print(f"VALIDATED {name} {len(raw)} bytes")
    (ROOT/"manifest.json").write_text(json.dumps({"brand":"fluynova","campaign":"2026-11-10-tiempo","files":index},indent=2)+"\\n",encoding="utf-8")


if __name__=="__main__":
    main()
