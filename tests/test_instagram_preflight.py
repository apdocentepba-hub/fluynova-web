import importlib.util
import io
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "marketing"))
spec = importlib.util.spec_from_file_location("ig_preflight", ROOT / "marketing/instagram_preflight.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

NOW = datetime(2026, 11, 3, 10, 36, tzinfo=timezone.utc)
GOOD = "https://static.metricool.com/planner/202610/7583853-file-6716034308320785165.jpeg"
PENDING = {"brandId": "7583853", "fetchedAt": "2026-11-03T07:35:00-03:00",
           "from": "2026-11-03T00:00:00-03:00", "to": "2026-11-30T23:59:59-03:00",
           "data": [{"id": 406052874, "publicationDate": {"dateTime": "2026-11-04T10:00:00"},
                     "providers": [{"network": "instagram", "status": "PENDING"}],
                     "text": "Evaluá una idea antes de escribir código"}]}
PUBLISHED = {"brandId": "7583853", "fetchedAt": "2026-11-03T07:35:00-03:00",
             "from": "2026-10-01T00:00:00-03:00", "to": "2026-11-03T23:59:59-03:00",
             "fieldIds": ["IGPO01", "IGPO03", "IGPO06"], "rows": []}


def candidate(**kwargs):
    x = {"id": "c1", "brand": "fluynova", "topic": "Control de documentos",
         "date": "2026-11-10T10:00:00-03:00",
         "caption": "¿Cuántos documentos vencen sin que lo sepas? Registrá fechas responsables y próximas revisiones.",
         "media": [GOOD]}
    x.update(kwargs)
    return x


def jpeg():
    out = io.BytesIO()
    Image.new("RGB", (1080, 1350), "white").save(out, "JPEG")
    return out.getvalue()


def fake_fetch(url):
    return jpeg(), "image/jpeg", url


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.ledger_path = Path(self.dir.name) / "receipts.sqlite"

    def tearDown(self):
        self.dir.cleanup()

    def test_requiere_ledger_persistente_para_dictamen(self):
        result = m.preflight(PENDING, PUBLISHED, [candidate()], now=NOW, fetcher=fake_fetch)
        self.assertEqual(result["proposals"][0]["decision"], "REVISAR")
        self.assertIn("idempotencia_sin_verificar", result["proposals"][0]["reasons"])

    def test_acepta_solo_para_revision_con_las_tres_fuentes(self):
        with m.ReceiptLedger(self.ledger_path) as ledger:
            result = m.preflight(PENDING, PUBLISHED, [candidate()], now=NOW,
                                 fetcher=fake_fetch, ledger=ledger)
        self.assertEqual(result["proposals"][0]["decision"], "APTA_PARA_REVISION_MANUAL")
        self.assertEqual(result["media_audit"]["posts"][0]["status"], "VERIFIED")
        self.assertEqual(result["mode"], "PREFLIGHT_READ_ONLY")

    def test_recibo_reservado_bloquea(self):
        with m.ReceiptLedger(self.ledger_path) as ledger:
            ledger.reserve(m.receipt_key(candidate()))
            result = m.preflight(PENDING, PUBLISHED, [candidate()], now=NOW,
                                 fetcher=fake_fetch, ledger=ledger)
        self.assertIn("recibo_ya_existente_reserved", result["proposals"][0]["reasons"])

    def test_red_caida_bloquea(self):
        def network_error(url):
            raise OSError("offline")
        with m.ReceiptLedger(self.ledger_path) as ledger:
            result = m.preflight(PENDING, PUBLISHED, [candidate()], now=NOW,
                                 fetcher=network_error, ledger=ledger)
        self.assertEqual(result["proposals"][0]["decision"], "REVISAR")
        self.assertIn("media_sin_verificar", result["proposals"][0]["reasons"])

    def test_texto_repetido_bloquea_aun_con_imagen_valida(self):
        text = candidate()["caption"]
        calendar = {**PENDING, "data": [{
            "id": 14, "publicationDate": {"dateTime": "2026-11-09T10:00:00"},
            "providers": [{"network": "instagram", "status": "PENDING"}],
            "text": text
        }]}
        with m.ReceiptLedger(self.ledger_path) as ledger:
            result = m.preflight(calendar, PUBLISHED, [candidate()], now=NOW,
                                 fetcher=fake_fetch, ledger=ledger)
        self.assertEqual(result["proposals"][0]["decision"], "REVISAR")
        self.assertTrue(any(r.startswith("contenido_similar_") for r in result["proposals"][0]["reasons"]))

    def test_preflight_no_hace_reserva(self):
        item = candidate()
        key = m.receipt_key(item)
        with m.ReceiptLedger(self.ledger_path) as ledger:
            m.preflight(PENDING, PUBLISHED, [item], now=NOW, fetcher=fake_fetch, ledger=ledger)
            self.assertIsNone(ledger.status(key))


if __name__ == "__main__":
    unittest.main()
