# FLUYNOVA — Puerta de confirmación de entrega

**Fecha: 05/11/2026. Estado: rama de desarrollo, NO desplegado.**

## Riesgo comprobado
Antes, la ruta /api/config habilitaba el envío en la interfaz solamente con FORMSUBMIT_ACTIVE=1. Esa bandera no demuestra que FormSubmit esté activado ni que las consultas lleguen a Gmail.

## Corrección
Ahora contact_enabled es verdadero exclusivamente cuando se configuran, ambas en 1:
- FORMSUBMIT_ACTIVE=1: se desea utilizar el proveedor.
- FORMSUBMIT_DELIVERY_VERIFIED=1: el responsable deja constancia, DESPUÉS de verificar un correo de prueba realmente recibido.

Si falta cualquiera, el envío automático permanece deshabilitado. No se divulgan variables internas en el JSON. El contrato de /api/config conserva contact_enabled y contact_method, y el respaldo manual por correo sigue disponible.

La segunda bandera NO monitorea Gmail ni garantiza entregas futuras. Es una confirmación operativa revocable, no una prueba automática. Si la entrega vuelve a fallar, debe desactivarse la confirmación.

## Lista de validación pendiente
1. Comprobar que el buzón de destino es el de FLUYNOVA.
2. Activar FormSubmit mediante su mensaje oficial de confirmación.
3. Con autorización, enviar una única consulta ficticia desde la web y comprobar que llegó a Gmail.
4. Revisar remitente, asunto, categoría, atribución y consentimiento.
5. Solo después de aprobación de despliegue, configurar las dos banderas en el entorno real.
6. Mantener alternativa manual visible y posibilidad de desactivar inmediatamente.

## Evidencia
- 25/25 tests pytest PASS, FastAPI real y SQLite temporal, sin SMTP ni FormSubmit.
- 9 combinaciones de ambas banderas y una prueba del aislamiento de la API alternativa /api/contact.
- 3/3 escenarios Chromium PASS: bandera ausente, en 0 y en 1, frontend real, respuestas FastAPI y red bloqueada.
- El script de navegador es tests/browser_delivery_gate.py y las pruebas pytest están en tests/test_contact_delivery_gate.py.
- app.py y los dos archivos de pruebas reproducen exactamente los contenidos comprobados en laboratorio.

## Restricciones
No se efectuaron envíos a terceros, no se modificaron variables de Render, no se fusionó el PR, no se activó almacenamiento no duradero, ni se publicaron cambios.

La verificación de entrega real sigue pendiente. No usar este gate como excusa para declarar que el formulario comercial ya funciona.
