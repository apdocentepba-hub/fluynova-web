# FLUYNOVA — Presupuestador interno, 05/11/2026

Objetivo: preparar una estimación rápida de los tres paquetes web ya publicados, sin contactos, cobros ni cambios a la web oficial.

## Uso

```bash
node scripts/presupuesto-web.cjs catalogo 2
node --test tests/presupuesto-web.test.cjs
```

Planes: Esencial $290.000 ARS, Catálogo $450.000 ARS y Profesional desde $650.000 ARS. Secciones adicionales: de 0 a 3, $70.000 cada una. Anticipo y saldo orientativos: 50% cada uno.

Los importes provienen de `static/webs/index.html`. Una prueba compara las cifras con ese archivo y falla si cambian. No hay red, correo, CRM, persistencia, pagos, FormSubmit ni datos personales. Estimación no vinculante: impuestos y alcance por definir. El dominio se registra y abona por separado, a nombre del cliente.

No integrar en producción sin aceptación específica.
