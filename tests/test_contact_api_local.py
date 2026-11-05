"""FLUYNOVA contact API: actual FastAPI ASGI tests, isolated SQLite + fictitious data.
No real SMTP, no production Render, no FormSubmit, no customer information.
Run: python -m pytest -q tests/test_contact_api_local.py
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def app_with_isolated_storage(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "isolated_db"))
    for key in ("CONTACT_STORAGE_READY", "FORMSUBMIT_ACTIVE", "SMTP_HOST", "SMTP_TO", "SMTP_FROM", "TRUST_PROXY", "ADMIN_PANEL_ENABLED"):
        monkeypatch.delenv(key, raising=False)
    guardian = ModuleType("guardian_ai")
    guardian.router = APIRouter()
    monkeypatch.setitem(sys.modules, "guardian_ai", guardian)
    spec = importlib.util.spec_from_file_location("fluynova_app_test", ROOT / "app.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    delivered = []
    # Prevent any delivery to third parties even if environment is misconfigured.
    monkeypatch.setattr(module, "optional_notification", lambda *args: delivered.append(args))
    return module, delivered


def lead(**changes):
    base = {
        "name": "Cliente Ficticio",
        "email": "test@example.invalid",
        "organization": "Negocio simulado",
        "category": "Crear página web / catálogo digital",
        "message": "Quiero una web de prueba para mi negocio ficticio.",
        "consent": True,
        "website": "",
    }
    base.update(changes)
    return base


def count_leads(mod):
    with mod.db_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM consultas").fetchone()[0]


def test_form_closed_by_default_and_no_db_write(app_with_isolated_storage):
    mod, delivered = app_with_isolated_storage
    with TestClient(mod.app) as client:
        result = client.post("/api/contact", json=lead())
        assert result.status_code == 503
        assert client.get("/api/config").json() == {"contact_enabled": False, "contact_method": "formsubmit"}
    assert count_leads(mod) == 0
    assert delivered == []


def test_valid_request_creates_single_sqlite_record_without_real_email(app_with_isolated_storage, monkeypatch):
    mod, delivered = app_with_isolated_storage
    monkeypatch.setenv("CONTACT_STORAGE_READY", "1")  # isolated local test only
    with TestClient(mod.app) as client:
        r = client.post("/api/contact", json=lead())
        assert r.status_code == 201, r.text
        assert r.json()["ok"] is True
    assert count_leads(mod) == 1
    with mod.db_connection() as conn:
        row = conn.execute("SELECT name, category, message, status FROM consultas").fetchone()
    assert row["name"] == "Cliente Ficticio"
    assert row["category"] == "Crear página web / catálogo digital"
    assert row["status"] == "Nuevo"
    assert len(delivered) == 1  # intercepted stub, no real SMTP


@pytest.mark.parametrize("bad", [
    {"consent": False},
    {"email": "not-email"},
    {"category": "Una categoria inventada"},
    {"message": "corto"},
    {"name": "x"},
])
def test_invalid_contact_rejected_without_persistence(app_with_isolated_storage, monkeypatch, bad):
    mod, delivered = app_with_isolated_storage
    monkeypatch.setenv("CONTACT_STORAGE_READY", "1")
    with TestClient(mod.app) as client:
        r = client.post("/api/contact", json=lead(**bad))
        assert r.status_code == 422
    assert count_leads(mod) == 0
    assert delivered == []


def test_honeypot_does_not_persist_or_send(app_with_isolated_storage, monkeypatch):
    mod, delivered = app_with_isolated_storage
    monkeypatch.setenv("CONTACT_STORAGE_READY", "1")
    with TestClient(mod.app) as client:
        r = client.post("/api/contact", json=lead(website="bot-filled"))
        assert r.status_code == 201
    assert count_leads(mod) == 0
    assert delivered == []


def test_body_size_limit_without_db_write(app_with_isolated_storage, monkeypatch):
    mod, delivered = app_with_isolated_storage
    monkeypatch.setenv("CONTACT_STORAGE_READY", "1")
    with TestClient(mod.app) as client:
        r = client.post("/api/contact", json=lead(message="Z" * 17000))
        assert r.status_code == 413
    assert count_leads(mod) == 0
    assert delivered == []


def test_bad_json_cannot_reach_db(app_with_isolated_storage, monkeypatch):
    mod, delivered = app_with_isolated_storage
    monkeypatch.setenv("CONTACT_STORAGE_READY", "1")
    with TestClient(mod.app) as client:
        r = client.post("/api/contact", content=b"{bad", headers={"content-type": "application/json"})
        assert r.status_code == 400
    assert count_leads(mod) == 0
    assert delivered == []


def test_rate_limit_per_client_blocks_sixth(app_with_isolated_storage, monkeypatch):
    mod, delivered = app_with_isolated_storage
    monkeypatch.setenv("CONTACT_STORAGE_READY", "1")
    with TestClient(mod.app) as client:
        results = [client.post("/api/contact", json=lead()) for _ in range(6)]
        assert [r.status_code for r in results] == [201, 201, 201, 201, 201, 429]
    assert count_leads(mod) == 5
    assert len(delivered) == 5


def test_admin_disabled_and_health_public(app_with_isolated_storage):
    mod, _ = app_with_isolated_storage
    with TestClient(mod.app) as client:
        assert client.get("/admin").status_code == 404
        assert client.get("/api/health").json() == {"ok": True}
        assert client.get("/api/contact").status_code == 404  # StaticFiles catches unmatched GET; still no contact write


def test_chunked_body_over_limit_rejected_without_db_write(app_with_isolated_storage, monkeypatch):
    mod, delivered = app_with_isolated_storage
    monkeypatch.setenv("CONTACT_STORAGE_READY", "1")

    def chunks():
        yield b"{" + b"x" * 9000
        yield b"y" * 9000 + b"}"

    with TestClient(mod.app) as client:
        result = client.post("/api/contact", content=chunks(), headers={"content-type": "application/json"})
        assert result.status_code == 413
    assert count_leads(mod) == 0
    assert delivered == []


def test_invalid_content_length_is_rejected_without_db_write(app_with_isolated_storage, monkeypatch):
    mod, delivered = app_with_isolated_storage
    monkeypatch.setenv("CONTACT_STORAGE_READY", "1")
    with TestClient(mod.app) as client:
        result = client.post("/api/contact", content=b"{}", headers={"content-length": "not-a-number"})
        assert result.status_code == 400
    assert count_leads(mod) == 0
    assert delivered == []


def test_spoofed_forwarded_ip_cannot_bypass_rate_limit(app_with_isolated_storage, monkeypatch):
    mod, delivered = app_with_isolated_storage
    monkeypatch.setenv("CONTACT_STORAGE_READY", "1")
    monkeypatch.setenv("TRUST_PROXY", "1")  # legacy option must not trust headers
    with TestClient(mod.app) as client:
        statuses = []
        for n in range(6):
            result = client.post("/api/contact", json=lead(), headers={"x-forwarded-for": f"192.0.2.{n+1}"})
            statuses.append(result.status_code)
        assert statuses == [201, 201, 201, 201, 201, 429]
    assert count_leads(mod) == 5
    assert len(delivered) == 5
