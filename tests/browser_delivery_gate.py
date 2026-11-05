"""Chromium QA of FormSubmit double-acknowledgement gate, no network or sends."""
import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import app as app_module  # noqa: E402


async def main():
    import os
    html = (ROOT/'static/index.html').read_text(encoding='utf8')
    js = (ROOT/'static/main.js').read_text(encoding='utf8')
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        async def scenario(ack, expected):
            os.environ['FORMSUBMIT_ACTIVE'] = '1'
            if ack is None:
                os.environ.pop('FORMSUBMIT_DELIVERY_VERIFIED', None)
            else:
                os.environ['FORMSUBMIT_DELIVERY_VERIFIED'] = ack
            with TestClient(app_module.app) as client:
                config = client.get('/api/config').json()
            assert config['contact_enabled'] == expected
            page = await browser.new_page(viewport={'width':390,'height':844})
            await page.route('**/*', lambda route: route.abort())
            await page.goto('about:blank')
            await page.set_content(html)
            await page.evaluate('''cfg => {window.__requests=[];window.fetch=async (url,options)=>{window.__requests.push(String(url)); if(url!='/api/config')throw Error('Unexpected request');return {ok:true,json:async()=>cfg};};}''', config)
            errors=[]
            page.on('pageerror',lambda err: errors.append(str(err)))
            await page.add_script_tag(content=js)
            await page.wait_for_timeout(60)
            is_disabled=await page.locator('#contact-form button[type=submit]').is_disabled()
            fallback_visible=await page.locator('#prepare-email').is_visible()
            calls=await page.evaluate('window.__requests')
            no_errors=not errors
            assert is_disabled is not expected, (ack,is_disabled,expected)
            assert fallback_visible and calls == ['/api/config'] and no_errors, (ack,fallback_visible,calls,errors)
            results.append((ack,config['contact_enabled'],is_disabled,fallback_visible))
            await page.close()
        await scenario(None,False)
        await scenario('0',False)
        await scenario('1',True)
        await browser.close()
    for a,enabled,disabled,fallback in results:
        print('PASS',a,'enabled',enabled,'button_disabled',disabled,'manual_fallback',fallback)
    print(f'{len(results)}/{len(results)} Chromium scenarios PASS')

if __name__ == '__main__':
    asyncio.run(main())
