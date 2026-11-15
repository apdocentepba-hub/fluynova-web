import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../static/diagnostico/index.html', import.meta.url), 'utf8');
const email = 'contacto.fluynova@gmail.com';

test('conserva los dos CTA originales con atribución', () => {
  assert.equal((html.match(/data-diagnostic-cta/g) || []).length, 2);
  assert.match(html, /src="\/diagnostico\/attribution\.js"/);
  assert.match(html, /utm_source=diagnostico&(?:amp;)?utm_medium=landing/);
});

test('ofrece correo directo en el inicio y cierre', () => {
  const links = [...html.matchAll(/<a\b[^>]*href="(mailto:[^"]+)"[^>]*>/g)];
  assert.equal(links.length, 2);
  for (const [, href] of links) {
    const url = new URL(href.replaceAll('&amp;', '&'));
    assert.equal(url.protocol, 'mailto:');
    assert.equal(url.pathname, email);
    assert.match(url.searchParams.get('subject') || '', /FLUYNOVA.*evaluación inicial/i);
    const body = url.searchParams.get('body') || '';
    assert.match(body, /tarea que repito/i);
    assert.match(body, /Cuántas veces por semana/i);
    assert.doesNotMatch(body, /contraseña\s*:/i);
    assert.ok(href.length < 1200);
  }
});

test('explica que enviar correo depende del visitante', () => {
  assert.match(html, /vos decidís si enviarlo/);
  assert.match(html, /¿No te funciona el formulario\?/);
  assert.match(html, />contacto\.fluynova@gmail\.com<\/a>/);
});

test('sin scripts de terceros nuevos ni cambios en el flujo de formulario', () => {
  assert.equal((html.match(/<script\b[^>]*src=/g) || []).length, 1);
  assert.match(html, /src="\/diagnostico\/attribution\.js"/);
  assert.doesNotMatch(html, /fetch\s*\(/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|document\.cookie/);
});

test('el enlace alternativo es usable con teclado y en pantalla angosta', () => {
  assert.match(html, /\.email-cta:focus-visible/);
  assert.match(html, /\.email-cta\{[^}]*min-height:48px/);
  assert.match(html, /@media\(max-width:730px\)/);
});
