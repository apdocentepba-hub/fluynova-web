"""Fail-closed form delivery gate: genuine FastAPI TestClient, no outbound emails."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from test_contact_api_local import app_with_isolated_storage


@pytest.mark.parametrize("provider,verified,expected", [
    (None,None,False),
    ("0",None,False),
    ("1",None,False),
    ("1","0",False),
    (None,"1",False),
    ("0","1",False),
    ("1","true",False),
    ("true","1",False),
    ("1","1",True),
])
def test_config_does_not_claim_availability_from_one_flag(app_with_isolated_storage,monkeypatch,provider,verified,expected):
    mod, delivered=app_with_isolated_storage
    for name,value in (("FORMSUBMIT_ACTIVE",provider),("FORMSUBMIT_DELIVERY_VERIFIED",verified)):
        if value is None: monkeypatch.delenv(name,raising=False)
        else: monkeypatch.setenv(name,value)
    with TestClient(mod.app) as client:
        r=client.get("/api/config")
        assert r.status_code==200
        assert r.json()=={"contact_enabled":expected,"contact_method":"formsubmit"}
        assert r.headers["cache-control"]=="no-store"
    assert delivered==[]


def test_manual_acknowledgement_cannot_activate_private_contact_api(app_with_isolated_storage,monkeypatch):
    mod,delivered=app_with_isolated_storage
    monkeypatch.setenv("FORMSUBMIT_ACTIVE","1")
    monkeypatch.setenv("FORMSUBMIT_DELIVERY_VERIFIED","1")
    with TestClient(mod.app) as client:
        assert client.get("/api/config").json()["contact_enabled"] is True
        response=client.post("/api/contact",json={"name":"Persona Prueba"})
        assert response.status_code==503
    assert delivered==[]
