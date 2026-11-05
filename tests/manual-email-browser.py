"""Chromium real, URL aislada y red bloqueada. No envía correos ni datos."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
BASE=Path(__file__).resolve().parents[1]/'static'
HTML=(BASE/'index.html').read_text()
JS=(BASE/'main.js').read_text()

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=await browser.new_page(viewport={'width':390,'height':844})
        errors=[];calls=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        await page.route('**/*',lambda route:route.abort())
        await page.goto('about:blank?utm_source=laboratorio&utm_medium=portfolio&utm_campaign=demostraciones_202611&utm_content=pasteleria')
        await page.set_content(HTML)
        await page.evaluate("""(()=>{
          window.__calls=[];
          window.fetch=async function(url){ window.__calls.push(String(url));
            if(url==='/api/config')return {ok:true,json:async()=>({contact_enabled:false,contact_method:'formsubmit'})};
            throw Error('Unexpected request');
          };
          Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:async()=>{throw Error('Clipboard denied intentionally');}}});
        })()""")
        await page.add_script_tag(content=JS)
        await page.wait_for_timeout(60)
        results=[]
        async def check(name,value):
            results.append((name,bool(value)))
            print(('PASS ' if value else 'FAIL ')+name)
        await check('formulario automático deshabilitado sin servidor',await page.locator('#contact-form button[type=submit]').is_disabled())
        await check('alternativa manual disponible',await page.locator('#prepare-email').is_visible())
        await page.locator('#prepare-email').click()
        await check('vacío no genera borrador',await page.locator('#manual-email-panel').is_hidden())
        await page.locator('input[name=name]').fill('Cliente Ficticio')
        await page.locator('input[name=email]').fill('ficticio@example.invalid')
        await page.locator('select[name=category]').select_option(label='Crear página web / catálogo digital')
        await page.locator('textarea[name=message]').fill('Me interesa una web demostrativa para negocio simulado.')
        await page.locator('input[name=consent]').check()
        await page.locator('#prepare-email').click()
        await check('borrador con datos válido',await page.locator('#manual-email-panel').is_visible() and 'Cliente Ficticio' in await page.locator('#manual-email-text').input_value())
        href=await page.locator('#open-email-client').get_attribute('href')
        await check('mailto explícito, no un POST a FormSubmit',href.startswith('mailto:contacto.fluynova@gmail.com?subject=') and '&body=' in href)
        await page.locator('#copy-email-text').click()
        await check('clipboard denegado conserva texto seleccionable','Ctrl+C' in await page.locator('#manual-email-status').inner_text())
        await page.locator('textarea[name=message]').fill('Texto actualizado para no usar borradores antiguos en el negocio.')
        await check('edición del formulario descarta copia obsoleta',await page.locator('#manual-email-panel').is_hidden())
        await page.locator('textarea[name=message]').fill('Z'*4000)
        await page.locator('#prepare-email').click()
        href=await page.locator('#open-email-client').get_attribute('href')
        await check('mensaje largo no se trunca en enlace mailto','&body=' not in href and len(await page.locator('#manual-email-text').input_value())>4000)
        await check('sin requests ni errores',await page.evaluate('window.__calls')==['/api/config'] and not errors)
        w=await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        await check('sin desborde horizontal móvil',w)
        # Escenario adicional: el endpoint de configuración lanza error (503/red).
        page2=await browser.new_page(viewport={'width':1366,'height':850})
        errors2=[]
        page2.on('pageerror',lambda err:errors2.append(str(err)))
        await page2.route('**/*',lambda route:route.abort())
        await page2.goto('about:blank')
        await page2.set_content(HTML)
        await page2.evaluate("(()=>{window.__calls=[]; window.fetch=async function(url){window.__calls.push(String(url));throw Error('Simulated 503');};return null;})()")
        await page2.add_script_tag(content=JS)
        await page2.wait_for_timeout(40)
        await check('error de API no habilita enviar por FormSubmit',await page2.locator('#contact-form button[type=submit]').is_disabled())
        await page2.locator('input[name=name]').fill('Prueba de Escritorio')
        await page2.locator('input[name=email]').fill('correo-invalido')
        await page2.locator('select[name=category]').select_option(label='Automatizar tareas')
        await page2.locator('textarea[name=message]').fill('Necesito automatizar un proceso de pruebas, sin datos reales.')
        await page2.locator('input[name=consent]').check()
        await page2.locator('#prepare-email').click()
        await check('correo inválido rechazado en modo alternativo',await page2.locator('#manual-email-panel').is_hidden())
        await page2.locator('input[name=email]').fill('validado@example.invalid')
        await page2.locator('input[name=consent]').uncheck()
        await page2.locator('#prepare-email').click()
        await check('consentimiento obligatorio en modo alternativo',await page2.locator('#manual-email-panel').is_hidden())
        await page2.locator('input[name=consent]').check()
        await page2.locator('#prepare-email').click()
        await check('borrador manual funciona aun con API caída',await page2.locator('#manual-email-panel').is_visible() and not errors2)
        await check('nunca se hizo envío POST en los dos escenarios',await page2.evaluate('window.__calls')==['/api/config'])
        await page2.close()
        await browser.close()
        assert all(ok for _,ok in results),f'Fail: {[name for name,ok in results if not ok]}'
        print(f'{len(results)}/{len(results)} PASS')
asyncio.run(main())
