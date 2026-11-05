"""Pruebas locales de seguridad de IA externa. Nunca llaman al proveedor."""
import os
import unittest
from unittest.mock import patch

import guardian_ai


class GuardianPrivacyTests(unittest.TestCase):
    def test_credenciales_no_activan_proveedor_sin_permiso(self):
        with patch.dict(os.environ, {
            "GUARDIAN_AI_KEY": "clave-ficticia",
            "GUARDIAN_AI_MODEL": "modelo-ficticio",
        }, clear=True):
            self.assertFalse(guardian_ai._enabled())
            self.assertFalse(guardian_ai.capabilities()["external_ai_enabled"])

    def test_permiso_explicitamente_autorizado_se_requiere_junto_a_credenciales(self):
        with patch.dict(os.environ, {
            "GUARDIAN_EXTERNAL_AI_ALLOWED": "1",
            "GUARDIAN_AI_KEY": "",
            "GUARDIAN_AI_MODEL": "modelo-ficticio",
        }, clear=True):
            self.assertFalse(guardian_ai._enabled())
        with patch.dict(os.environ, {
            "GUARDIAN_EXTERNAL_AI_ALLOWED": "1",
            "GUARDIAN_AI_KEY": "clave-ficticia",
            "GUARDIAN_AI_MODEL": "modelo-ficticio",
        }, clear=True):
            self.assertTrue(guardian_ai._enabled())

    def test_rechaza_datos_sensibles_antes_de_enviar(self):
        samples = [
            "mi DNI es 12345678",
            "mi email es persona@ejemplo.com",
            "token secreto",
            "mi tarjeta de crédito es 4111111111111111",
            "password: prueba",
        ]
        for sample in samples:
            with self.subTest(sample=sample):
                self.assertTrue(guardian_ai._contains_sensitive(sample))

    def test_tarea_comercial_normal_no_se_bloquea(self):
        samples = [
            "Respondo consultas por WhatsApp todos los días",
            "Quiero avisos automáticos",
            "Quiero una aplicación de turnos",
        ]
        for sample in samples:
            with self.subTest(sample=sample):
                self.assertFalse(guardian_ai._contains_sensitive(sample))


if __name__ == "__main__":
    unittest.main()
