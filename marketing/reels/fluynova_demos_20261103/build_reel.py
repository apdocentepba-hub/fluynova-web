"""FLUYNOVA: Reel vertical original with genuine screenshots of public DEMO pages.

Runs in GitHub Actions only; no passwords, keys, customer data, cookies
or posting. Never present fictitious demonstration sites as client work.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parent
CAP = OUT / "captures"
SCENES = OUT / "frames"
WIDTH, HEIGHT = 1080, 1920
FPS = 30
SCENE_LEN = 3.6
FADE = 0.5
BG = (9, 19, 23)
MINT = (184, 248, 132)
WHITE = (246, 249, 243)
MUTED = (188, 211, 204)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
DEMOS = {
    "pasteleria": "https://fluynova-demo-pasteleria.pages.dev/",
    "distribuidora": "https://fluynova-demo-distribuidora.pages.dev/",
}


def face(size: int, bold: bool = False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


async def capture_websites():
    CAP.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox"])
        try:
            for name, url in DEMOS.items():
                page = await browser.new_page(
                    viewport={"width": 390, "height": 844},
                    device_scale_factor=1.5,
                    is_mobile=True,
                    has_touch=True,
                    locale="es-AR",
                    reduced_motion="reduce",
                )
                response = await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                if not response or response.status >= 400:
                    raise RuntimeError(f"Screenshot blocked: {name} HTTP {response.status if response else 'no response'}")
                await page.wait_for_timeout(2100)
                await page.screenshot(path=str(CAP / f"{name}_inicio.png"), full_page=False, animations="disabled")
                await page.evaluate("window.scrollTo({top: 1050, behavior: 'instant'})")
                await page.wait_for_timeout(1100)
                await page.screenshot(path=str(CAP / f"{name}_interior.png"), full_page=False, animations="disabled")
                await page.close()
        finally:
            await browser.close()
    for p in sorted(CAP.glob("*.png")):
        with Image.open(p) as im:
            im.load()
            stat = ImageStat.Stat(im.convert("RGB"))
            if im.width < 390 or im.height < 800 or max(stat.stddev) < 9:
                raise RuntimeError(f"Screenshot unusable or blank: {p.name} {im.size}")
            print("REAL_SITE_CAPTURE_OK", p.name, im.size, tuple(round(n,1) for n in stat.stddev), flush=True)


def background(index: int):
    im = Image.new("RGB", (WIDTH, HEIGHT), BG)
    pix = im.load()
    tint = [(11, 27, 27), (34, 25, 30), (41, 30, 37), (16, 28, 33), (17, 31, 34), (14, 32, 25)][index]
    for y in range(HEIGHT):
        t = y / HEIGHT
        base = tuple(round(tint[k] * (1-t) + BG[k]*t) for k in range(3))
        for x in range(WIDTH):
            # Very subtle, static gradient gives compressed video a clean background.
            pix[x,y] = base
    d = ImageDraw.Draw(im)
    for y in range(195, 1615, 78):
        for x in range(45, 1050, 78):
            d.ellipse((x, y, x+2, y+2), fill=(52, 71, 65))
    d.rounded_rectangle((60, 50, 1020, 1875), radius=50, outline=(50, 78, 68), width=3)
    d.text((93,95), "✳ FLUYNOVA", font=face(46,True), fill=MINT, stroke_width=0)
    d.text((91,1772), "AUTOMATIZACIÓN  /  PÁGINAS WEB  /  SOFTWARE", font=face(22,True), fill=MUTED)
    d.text((90,1819), "DEMOS FICTICIAS · SIN CLIENTES NI PAGOS REALES", font=face(20,True), fill=(145,177,167))
    return im


def headline(d, lines, y, size=74, highlight=None):
    for ln in lines:
        col = MINT if ln == highlight else WHITE
        d.text((92,y), ln, font=face(size,True), fill=col)
        y += size + 20
    return y


def badge(d, text, x=92, y=470, tone=MINT):
    f=face(24,True)
    tw=d.textbbox((0,0),text,font=f)[2]
    d.rounded_rectangle((x,y,x+tw+50,y+60),radius=17, fill=(25,49,42),outline=(79,112,80),width=2)
    d.text((x+25,y+13),text,font=f,fill=tone)


def text_lines(d,lines,y=1540,fontsize=32):
    for x in lines:
        d.text((95,y),x,font=face(fontsize,True),fill=WHITE)
        y+=fontsize+23


def fit_image(image, width, height):
    ratio = max(width/image.width,height/image.height)
    new = image.resize((round(image.width*ratio),round(image.height*ratio)), Image.Resampling.LANCZOS)
    x=(new.width-width)//2
    y=(new.height-height)//2
    return new.crop((x,y,x+width,y+height))


def phone(base, screenshot, x=220,y=520,w=640,h=990):
    screen = fit_image(screenshot.convert("RGB"), w-32, h-42)
    frame = Image.new("RGBA", (w+64, h+76),(0,0,0,0))
    shadow=Image.new("RGBA",frame.size,(0,0,0,0))
    sd=ImageDraw.Draw(shadow)
    sd.rounded_rectangle((32,28,w+32,h+45), radius=56, fill=(0,0,0,135))
    shadow=shadow.filter(ImageFilter.GaussianBlur(22))
    frame.alpha_composite(shadow)
    pd=ImageDraw.Draw(frame)
    pd.rounded_rectangle((20,10,w+44,h+64), radius=62, fill=(12,16,19,255),outline=(98,122,111,255),width=5)
    mask=Image.new("L",(w-32,h-42),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,w-33,h-43),radius=30,fill=255)
    frame.paste(screen, (51,46), mask)
    pd.rounded_rectangle((int(w*.44),24,int(w*.61),37),radius=6,fill=(73,83,86))
    base.paste(frame,(x-32,y-30),frame)


def scene_intro(a, b):
    im=background(0)
    d=ImageDraw.Draw(im)
    headline(d,["¿TU NEGOCIO","NECESITA UNA","WEB ASÍ?"],242,78,highlight="WEB ASÍ?")
    badge(d,"2 EJEMPLOS PARA PROBAR",y=565)
    phone(im,a,x=66,y=690,w=465,h=735)
    phone(im,b,x=555,y=740,w=465,h=735)
    d=ImageDraw.Draw(im)
    text_lines(d,["No son plantillas vacías.","Entrá y explorá las demos."],1542,35)
    return im


def scene_pastry(a, inner=False):
    im=background(2 if inner else 1)
    d=ImageDraw.Draw(im)
    if inner:
        headline(d,["PRODUCTOS","ORDENADOS","POR CATEGORÍA"],222,65,highlight="POR CATEGORÍA")
        badge(d,"PASTELERÍA · DEMO FICTICIA",y=498)
    else:
        headline(d,["UNA WEB PARA","MOSTRAR LO","QUE VENDÉS"],220,70,highlight="QUE VENDÉS")
        badge(d,"ALBA & MIGA · DEMO FICTICIA",y=502)
    phone(im,a,x=220,y=628,w=640,h=945)
    d=ImageDraw.Draw(im)
    text_lines(d,["Diseño adaptable al celular.","Consultas de ejemplo, sin compras."],1602,28)
    return im


def scene_distributor(a, inner=False):
    im=background(4 if inner else 3)
    d=ImageDraw.Draw(im)
    if inner:
        headline(d,["CATÁLOGO","CON FILTROS Y","COTIZACIÓN"],226,72,highlight="COTIZACIÓN")
        badge(d,"NÓRDICA PRO · DEMO FICTICIA",y=503)
    else:
        headline(d,["TUS PRODUCTOS","EN UN SOLO","LUGAR"],230,75,highlight="LUGAR")
        badge(d,"DISTRIBUIDORA · DEMO FICTICIA",y=510)
    phone(im,a,x=220,y=632,w=640,h=950)
    d=ImageDraw.Draw(im)
    text_lines(d,["Búsqueda y productos ilustrativos.","Sin pagos ni pedidos reales."],1604,27)
    return im


def scene_final(a,b):
    im=background(5)
    d=ImageDraw.Draw(im)
    headline(d,["¿Y SI TU","NEGOCIO TUVIERA","SU PROPIA WEB?"],228,66,highlight="SU PROPIA WEB?")
    phone(im,a,x=76,y=640,w=438,h=730)
    phone(im,b,x=570,y=640,w=438,h=730)
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((89,1495,990,1614),radius=26,fill=MINT)
    d.text((128,1528),"PROBÁ LAS DEMOS EN LA BIO",font=face(40,True),fill=(13,30,23))
    d.text((118,1664),"@fluynova  ·  enlace del perfil",font=face(33,True),fill=WHITE)
    return im


def render_scenes():
    SCENES.mkdir(parents=True,exist_ok=True)
    get=lambda n: Image.open(CAP / n).convert("RGB")
    pastry_top=get("pasteleria_inicio.png")
    pastry_mid=get("pasteleria_interior.png")
    dist_top=get("distribuidora_inicio.png")
    dist_mid=get("distribuidora_interior.png")
    images = [
        scene_intro(pastry_top,dist_top),
        scene_pastry(pastry_top),
        scene_pastry(pastry_mid,True),
        scene_distributor(dist_top),
        scene_distributor(dist_mid,True),
        scene_final(pastry_top,dist_top),
    ]
    for i,im in enumerate(images):
        p=SCENES/f"scene_{i:02d}.jpg"
        im.save(p, quality=92, subsampling=0)
        print("SCENE_CREATED",p.name,p.stat().st_size,flush=True)
    board=Image.new("RGB",(960,1140),BG)
    for i,im in enumerate(images):
        thumb=im.resize((300,533),Image.Resampling.LANCZOS)
        board.paste(thumb,((i%3)*320+10,(i//3)*560+10))
    board.save(OUT/"contact_sheet.jpg",quality=89)
    return images


def original_audio(duration):
    sr=32000
    count=int((duration+0.25)*sr)
    t=np.arange(count,dtype=np.float64)/sr
    out=np.zeros(count,dtype=np.float64)
    # Original sparse synth progression, not a sampled or copied song.
    chords=[(220,261.63,329.63),(174.61,220,261.63),(196,246.94,293.66),(164.81,196,246.94)]
    for i, chord in enumerate(chords):
        start=i*4.7
        end=min((i+1)*4.7,len(out)/sr)
        mask=(t>=start)&(t<end)
        local=t[mask]-start
        sound=sum(np.sin(2*np.pi*f*local+0.2)*0.12 + np.sin(2*np.pi*(f/2)*local)*0.085 for f in chord)
        env=np.minimum(1,local/0.17)*np.minimum(1,(end-start-local)/0.4)
        out[mask]+=sound*np.clip(env,0,1)
    beat=60/104
    rng=np.random.default_rng(20261103)
    for k in range(int(duration/beat)+2):
        st=int(k*beat*sr)
        if st>=count:break
        length=min(int(.20*sr),count-st)
        lt=np.arange(length)/sr
        kick=.55*np.sin(2*np.pi*(70-34*lt)*lt)*np.exp(-lt*22)
        out[st:st+length]+=kick
        if k%2==1:
            snare=(rng.standard_normal(length)*.09)*np.exp(-lt*35)
            out[st:st+length]+=snare
    fadein=np.minimum(1,t/.35)
    fadeout=np.minimum(1,np.maximum(0,duration-t)/.9)
    out=np.tanh(out*0.8)*fadein*fadeout
    # stereo, subtle different channels, peak safely below -6 dBFS.
    audio=np.column_stack((out,out*.96))
    if float(np.max(np.abs(audio)))>0.63:audio*=.63/float(np.max(np.abs(audio)))
    audio16=(audio*32767).astype(np.int16)
    p=OUT/"original_soundtrack.wav"
    with wave.open(str(p),"wb") as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(audio16.tobytes())
    return p


def video():
    pieces=6
    duration=pieces*SCENE_LEN-(pieces-1)*FADE
    audio=original_audio(duration)
    inputs=[]
    chains=[]
    for i in range(pieces):
        path=SCENES/f"scene_{i:02d}.jpg"
        inputs += ["-loop","1","-framerate",str(FPS),"-t",str(SCENE_LEN),"-i",str(path)]
        chains.append(
            f"[{i}:v]scale=1080:1920,zoompan=z='min(zoom+0.00055,1.07)':d=1:"
            f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps={FPS},"
            f"trim=duration={SCENE_LEN},setpts=PTS-STARTPTS,format=yuv420p[v{i}]"
        )
    left="v0"
    for i in range(1,pieces):
        right=f"v{i}"
        target=f"x{i}"
        offset=(SCENE_LEN-FADE)*i
        chains.append(
            f"[{left}][{right}]xfade=transition=fade:duration={FADE}:offset={offset:.2f}[{target}]"
        )
        left=target
    dest=OUT/"fluynova_demos_reel.mp4"
    cmd=["ffmpeg","-y","-hide_banner","-loglevel","error",*inputs,"-i",str(audio),
        "-filter_complex",";".join(chains),"-map",f"[{left}]","-map",f"{pieces}:a",
        "-c:v","libx264","-preset","veryfast","-crf","23","-pix_fmt","yuv420p",
        "-r",str(FPS),"-c:a","aac","-b:a","128k","-ar","44100",
        "-movflags","+faststart","-t",f"{duration:.2f}",str(dest)]
    subprocess.run(cmd,check=True,timeout=240)
    info=json.loads(subprocess.check_output(
      ["ffprobe","-v","error","-show_format","-show_streams","-of","json",str(dest)],text=True))
    streams=info["streams"]
    videostream=next(x for x in streams if x["codec_type"]=="video")
    audio_stream=next(x for x in streams if x["codec_type"]=="audio")
    assert int(videostream["width"])==WIDTH and int(videostream["height"])==HEIGHT
    assert videostream["codec_name"]=="h264" and audio_stream["codec_name"]=="aac"
    seconds=float(info["format"]["duration"])
    assert duration-0.35<=seconds<=duration+0.3,(duration,seconds)
    assert 1_000_000<=dest.stat().st_size<=70_000_000
    manifest={
      "brand":"FLUYNOVA",
      "content":"authentic screenshots of two own published fictitious demo sites",
      "captured_demo_urls":DEMOS,
      "instagram_network":"instagram","post_type":"REEL",
      "width":WIDTH,"height":HEIGHT,"fps":FPS,
      "duration_seconds":round(seconds,3),
      "audio":"self-composed instrumental, no copyrighted samples",
      "is_ai_generated_or_significantly_altered":True,
      "sha256":hashlib.sha256(dest.read_bytes()).hexdigest(),
      "bytes":dest.stat().st_size,
      "warnings":["demo brands and products are fictional; no customer work claims",
                  "source websites may change; screenshots captured only for this asset"]
    }
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("VIDEO_VERIFIED",json.dumps(manifest,ensure_ascii=False),flush=True)


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    asyncio.run(capture_websites())
    render_scenes()
    video()


if __name__=="__main__":
    main()
