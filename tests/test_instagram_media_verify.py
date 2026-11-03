import io
import importlib.util
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("ig_media", ROOT / "marketing/instagram_media_verify.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

GH = "https://raw.githubusercontent.com/apdocentepba-hub/fluynova-web/main/marketing/growth/fluynova-turnos-guia-20261109.jpg"
MET = "https://static.metricool.com/planner/202610/7583853-file-6716034308320785165.jpeg"


def picture(width=1080, height=1350, fmt="JPEG"):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, format=fmt)
    return buffer.getvalue()


def ok_fetch(url):
    return picture(), "image/jpeg", url


class TestMedia(unittest.TestCase):
    def test_acepta_url_propia_con_ruta_exacta(self):
        self.assertTrue(m.approved_media_url(GH))
        self.assertTrue(m.approved_media_url(MET))

    def test_verifica_jpeg_por_contenido_no_extension(self):
        result = m.verify_image(GH, fetcher=ok_fetch)
        self.assertEqual(result["status"], "VERIFIED")
        self.assertEqual((result["width"], result["height"]), (1080, 1350))

    def test_verifica_png_autentico(self):
        url = GH.replace(".jpg", ".png")
        result = m.verify_image(url, fetcher=lambda u: (picture(fmt="PNG"), "image/png", u))
        self.assertEqual(result["status"], "VERIFIED")

    def test_bloquea_mime_falsificado(self):
        result = m.verify_image(GH, fetcher=lambda u: (picture(), "image/png", u))
        self.assertEqual(result["status"], "BLOCKED")

    def test_bloquea_contenido_invalido(self):
        result = m.verify_image(GH, fetcher=lambda u: (b"not-a-jpeg", "image/jpeg", u))
        self.assertEqual(result["status"], "BLOCKED")

    def test_rechaza_redireccion(self):
        result = m.verify_image(GH, fetcher=lambda u: (picture(), "image/jpeg", MET))
        self.assertEqual(result["status"], "BLOCKED")

    def test_rechaza_archivo_excesivo(self):
        result = m.verify_image(GH, fetcher=lambda u: (b"x" * (m.MAX_BYTES+1), "image/jpeg", u))
        self.assertEqual(result["status"], "BLOCKED")

    def test_dimensiones_y_proporciones(self):
        for width, height in [(200, 200), (1080, 1920), (2000, 700)]:
            with self.subTest((width, height)):
                p = m.verify_image(GH, fetcher=lambda u: (picture(width, height), "image/jpeg", u))
                self.assertEqual(p["status"], "BLOCKED")

    def test_bloquea_dominios_rutas_credenciales_y_video(self):
        urls = [
            "http://static.metricool.com/planner/202610/7583853-file-1.jpeg",
            "https://static.metricool.com.evil.test/planner/202610/7583853-file-1.jpeg",
            "https://raw.githubusercontent.com.evil.test/apdocentepba-hub/fluynova-web/main/marketing/growth/img.jpg",
            "https://raw.githubusercontent.com/other/fluynova-web/main/marketing/growth/img.jpg",
            "https://raw.githubusercontent.com/apdocentepba-hub/fluynova-web/main/marketing/growth/../x.jpg",
            "https://static.metricool.com/planner/202610/1234567-file-1.jpeg",
            "https://static.metricool.com/planner/202610/7583853-file-1.mp4",
            "https://static.metricool.com/planner/202610/7583853-file-1.jpeg?token=private",
            "https://static.metricool.com@evil.test/planner/202610/7583853-file-1.jpeg",
            "https://static.metricool.com/planner/202610/7583853-file-1.jpeg#frag",
            "https://static.metricool.com/planner/202610/7583853-file-1%2e.jpeg",
        ]
        for u in urls:
            with self.subTest(url=u):
                self.assertFalse(m.approved_media_url(u))

    def test_error_red_no_equivale_a_verificado(self):
        def no_network(u):
            raise OSError("DNS failed")
        self.assertEqual(m.verify_image(GH, fetcher=no_network)["status"], "BLOCKED")

    def test_auditoria_no_modifica_ni_publica(self):
        rows = m.audit_candidates([{"id": "A", "media": [GH]}, {"id": "B", "media": []}], fetcher=ok_fetch)
        self.assertEqual([r["status"] for r in rows["posts"]], ["VERIFIED", "BLOCKED"])
        self.assertEqual(rows["mode"], "READ_ONLY")


if __name__ == "__main__":
    unittest.main()
