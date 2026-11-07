"""Prueba aislada del recorrido comercial: sin red ni envío de correos."""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright
BASE=Path(__file__).resolve().parents[1]/'static'
html=(BASE/'index.html').read_text()
script=(BASE/'main.js').read_text()
CASES=[
 ('pasteleria','?utm_source=laboratorio&utm_medium=portfolio&utm_campaign=demostraciones_202611&utm_content=pasteleria','Crear página web / catálogo digital'),
 ('distribuidora','?utm_source=laboratorio&utm_medium=portfolio&utm_campaign=demostraciones_202611&utm_content=distribuidora','Crear página web / catálogo digital'),
 ('crm','?utm_source=laboratorio&utm_medium=portfolio&utm_campaign=demostraciones_202611&utm_content=crm',''),
 ('falsificada','?utm_source=laboratorio&utm_medium=spam&utm_campaign=demostraciones_202611&utm_content=pasteleria',''),
 ('instagram','?utm_source=instagram&utm_campaign=perfil_ig_202611&utm_content=webs','Crear página web / catálogo digital'),
 ('webs','?utm_source=webs&utm_campaign=webs_202611','Crear página web / catálogo digital'),
 ('directa','',''),
]
async def main():
 results=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path=__import__('shutil').which('chromium') or __import__('shutil').which('google-chrome'),args=['--no-sandbox'])
  for name,query,expected in CASES:
   page=await browser.new_page(viewport={'width':390 if name=='distribuidora' else 1366,'height':850})
   errors=[]
   page.on('pageerror',lambda error:errors.append(str(error)))
   # Cortar toda salida de red, incluyendo CSS, scripts remotos y FormSubmit.
   await page.route('**/*',lambda route:route.abort())
   await page.goto('about:blank'+query)
   # Evitar que los scripts remotos del HTML se ejecuten en esta prueba.
   await page.set_content(html)
   await page.evaluate("(()=>{ window.__outbound=[]; window.fetch=async function(url,options){ window.__outbound.push(String(url)); if(url==='/api/config')return {ok:true,json:async()=>({contact_enabled:false,contact_method:'formsubmit'})}; throw new Error('Blocked test request'); }; return null; })()")
   await page.add_script_tag(content=script)
   await page.wait_for_timeout(65)
   got=await page.locator('[name="category"]').input_value()
   disabled=await page.locator('#contact-form button[type="submit"]').is_disabled()
   outgoing=await page.evaluate('window.__outbound')
   count=await page.locator('script[src*="guardian"]',).count()
   rec={'case':name,'selected':got,'expected':expected,'disabled_without_contact':disabled,'script_tags_guardian':count,'fetches':outgoing,'page_errors':errors}
   rec['pass']=got==expected and disabled and count==2 and outgoing==['/api/config'] and not errors
   results.append(rec)
   await page.close()
  await browser.close()
 # No guardar datos personales ni generar archivos residuales.
 for x in results: print(('PASS' if x['pass'] else 'FAIL'),x['case'],repr(x['selected']),x['fetches'],x['page_errors'][:1])
 assert all(x['pass'] for x in results), 'Browser QA failed'
 print('7/7 Chromium pruebas PASS')
asyncio.run(main())
