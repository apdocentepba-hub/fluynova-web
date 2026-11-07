import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("ig_receipts", ROOT / "marketing/instagram_idempotency.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def candidate(**kwargs):
    item = {"brand": "fluynova", "date": "2026-11-10T10:00:00-03:00",
            "caption": "Control de fechas y vencimientos de proveedores",
            "media": ["https://static.metricool.com/planner/202610/7583853-file-1.jpeg"]}
    item.update(kwargs)
    return item


class TestReceipts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "receipts.sqlite"

    def tearDown(self):
        self.tmp.cleanup()

    def test_clave_estable_entre_tipos_de_zona(self):
        a = m.receipt_key(candidate())
        b = m.receipt_key(candidate(date="2026-11-10T13:00:00+00:00", caption="  control de fechas y vencimientos de proveedores  "))
        self.assertEqual(a, b)

    def test_mismo_copy_otra_fecha_no_comparte_recibo(self):
        self.assertNotEqual(m.receipt_key(candidate()),
                            m.receipt_key(candidate(date="2026-11-11T10:00:00-03:00")))

    def test_rechaza_marca_ajena(self):
        with self.assertRaisesRegex(ValueError, "marca"):
            m.receipt_key(candidate(brand="apdocentepba"))

    def test_rechaza_fecha_sin_zona(self):
        with self.assertRaises(ValueError):
            m.receipt_key(candidate(date="2026-11-10T10:00:00"))

    def test_primera_reserva_unica(self):
        key = m.receipt_key(candidate())
        with m.ReceiptLedger(self.path) as ledger:
            self.assertTrue(ledger.reserve(key))
            self.assertFalse(ledger.reserve(key))
            self.assertEqual(ledger.status(key)["status"], "RESERVED")

    def test_reinicio_conserva_la_reserva_en_volumen_local(self):
        key = m.receipt_key(candidate())
        with m.ReceiptLedger(self.path) as first:
            self.assertTrue(first.reserve(key))
        with m.ReceiptLedger(self.path) as second:
            self.assertFalse(second.reserve(key))

    def test_doble_conexion_comparte_bloqueo_transaccional(self):
        key = m.receipt_key(candidate())
        with m.ReceiptLedger(self.path) as first, m.ReceiptLedger(self.path) as second:
            self.assertTrue(first.reserve(key))
            self.assertFalse(second.reserve(key))

    def test_confirmar_pending_solo_tras_reserva(self):
        key = m.receipt_key(candidate())
        with m.ReceiptLedger(self.path) as ledger:
            self.assertFalse(ledger.confirm_pending(key, "406052874"))
            ledger.reserve(key)
            self.assertTrue(ledger.confirm_pending(key, "406052874"))
            self.assertFalse(ledger.confirm_pending(key, "406052874"))
            self.assertEqual(ledger.status(key)["provider_post_id"], "406052874")

    def test_no_confirma_publicada_desde_reserva(self):
        key = m.receipt_key(candidate())
        with m.ReceiptLedger(self.path) as ledger:
            ledger.reserve(key)
            self.assertFalse(ledger.confirm_published(key, "406052874"))

    def test_transicion_de_estados_estricta(self):
        key = m.receipt_key(candidate())
        with m.ReceiptLedger(self.path) as ledger:
            ledger.reserve(key)
            ledger.confirm_pending(key, "406052874")
            self.assertFalse(ledger.confirm_published(key, "999"))
            self.assertTrue(ledger.confirm_published(key, "406052874"))
            self.assertEqual(ledger.status(key)["status"], "PUBLISHED")
            self.assertFalse(ledger.confirm_published(key, "406052874"))
            self.assertFalse(ledger.reserve(key))

    def test_no_comparte_id_externo_entre_dos_recibos(self):
        first = m.receipt_key(candidate())
        second = m.receipt_key(candidate(date="2026-11-11T10:00:00-03:00"))
        with m.ReceiptLedger(self.path) as ledger:
            ledger.reserve(first)
            ledger.reserve(second)
            ledger.confirm_pending(first, "406052874")
            with self.assertRaises(Exception):
                ledger.confirm_pending(second, "406052874")
            self.assertEqual(ledger.status(second)["status"], "RESERVED")

    def test_reserva_invalida_rechazada(self):
        with m.ReceiptLedger(self.path) as ledger:
            with self.assertRaises(ValueError):
                ledger.reserve("not-sha256")
            with self.assertRaises(ValueError):
                ledger.confirm_pending(m.receipt_key(candidate()), "not-numeric")


if __name__ == "__main__":
    unittest.main()
