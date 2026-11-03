import unittest
from datetime import datetime, timezone
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("ig_safe", ROOT / "marketing/instagram_safe_plan.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

NOW = datetime(2026, 11, 3, 10, 36, tzinfo=timezone.utc)
GOOD_MEDIA = "https://raw.githubusercontent.com/apdocentepba-hub/fluynova-web/main/marketing/growth/fluynova-turnos-guia-20261109.jpg"
PENDING = {"data": [{"id": 406052874, "publicationDate": {"dateTime": "2026-11-04T10:00:00", "timezone": "America/Buenos_Aires"}, "providers": [{"network": "instagram", "status": "PENDING"}], "text": "Evaluá tu idea antes de escribir código."}]}


def proposal(**kwargs):
    x = {"id": "test", "brand": "fluynova", "topic": "Control de vencimientos", "date": "2026-11-10T10:00:00-03:00", "caption": "¿Vencen documentos de tus proveedores sin que te enteres? Centralizá fechas, responsables y alertas para revisar a tiempo.", "media": [GOOD_MEDIA]}
    x.update(kwargs)
    return x


class SafePlan(unittest.TestCase):
    def test_reconoce_publicacion_pendiente(self):
        self.assertEqual(m.calendar_items(PENDING)[0]["status"], "PENDING")

    def test_acepta_plan_nuevo_sin_publicar(self):
        p = m.build_plan(PENDING, [proposal()], now=NOW)
        self.assertEqual(p["proposals"][0]["decision"], "APTA_PARA_REVISION_MANUAL")
        self.assertEqual(p["mode"], "DRY_RUN_ONLY")

    def test_bloquea_misma_hora(self):
        p = m.build_plan(PENDING, [proposal(date="2026-11-04T11:00:00-03:00")], now=NOW)
        self.assertIn("colision_horaria_406052874", p["proposals"][0]["reasons"])

    def test_bloquea_fecha_pasada(self):
        p = m.build_plan(PENDING, [proposal(date="2026-11-01T11:00:00-03:00")], now=NOW)
        self.assertIn("fecha_pasada", p["proposals"][0]["reasons"])

    def test_bloquea_otras_marcas(self):
        p = m.build_plan(PENDING, [proposal(brand="apdocentepba")], now=NOW)
        self.assertIn("marca_no_autorizada", p["proposals"][0]["reasons"])

    def test_bloquea_referencias_otro_proyecto(self):
        p = m.build_plan(PENDING, [proposal(caption="Usá APD como ejemplo", topic="Consulta docente")], now=NOW)
        self.assertIn("mezcla_de_proyectos", p["proposals"][0]["reasons"])

    def test_rechaza_media_insegura(self):
        for url in ["http://example.com/a.jpg", "https://evil.com/photo.jpg", "https://static.metricool.com@evil.com/post.jpg", "data:image/jpeg;base64,hi"]:
            with self.subTest(url=url):
                self.assertFalse(m.safe_media(url))

    def test_detecta_contenido_similar(self):
        calendar = {"data": [{"id": 100, "publicationDate": {"dateTime": "2026-11-01T10:00:00"}, "providers": [{"network": "instagram"}], "text": "Vencen documentos de tus proveedores sin que te enteres? Centralizá fechas responsables alertas para revisar a tiempo"}]}
        p = m.build_plan(calendar, [proposal()], now=NOW)
        self.assertTrue(any(s.startswith("contenido_similar_") for s in p["proposals"][0]["reasons"]))

    def test_texto_real_turnos_repetidos(self):
        real = {"data": [{"id": "DfBCgNNAGOn", "publicationDate": {"dateTime": "2026-10-27T10:00:00"},
            "providers": [{"network": "instagram", "status": "PUBLISHED"}],
            "text": "¿Los turnos de tu negocio llegan por WhatsApp y después cuesta encontrar cada uno? Antes de pagar un sistema, probá organizar tres datos: Nombre y contacto de la persona. Fecha y horario del turno. Estado: pendiente, confirmado o cancelado."}]}
        actual = proposal(topic="Turnos WhatsApp: tres datos", date="2026-11-09T10:00:00-03:00", caption="¿Perdés turnos en WhatsApp? Guardá tres datos: nombre y contacto, fecha y horario, estado del turno. Pendiente, confirmado o cancelado. Guardá esta guía.")
        plan = m.build_plan(real, [actual], now=NOW)
        self.assertIn("contenido_similar_DfBCgNNAGOn", plan["proposals"][0]["reasons"])

    def test_detecta_duplicado_interno(self):
        p = m.build_plan(PENDING, [proposal(), proposal(id="other")], now=NOW)
        self.assertIn("propuesta_duplicada_en_lote", p["proposals"][1]["reasons"])

    def test_no_confunde_otras_redes(self):
        cal = {"data": [{"publicationDate": {"dateTime": "2026-11-04T10:00:00"}, "providers": [{"network": "facebook"}], "text": "Hola"}]}
        self.assertEqual(m.calendar_items(cal), [])


if __name__ == "__main__":
    unittest.main()
