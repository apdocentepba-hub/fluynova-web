"""Preflight integrado, estrictamente de solo lectura, para propuestas de @fluynova.

Cruza calendario y publicaciones de Metricool (JSON exportados), verificación
HTTP real de imágenes y recibos idempotentes persistentes suministrados.
No programa ni reserva ni publica.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from instagram_idempotency import ReceiptLedger, receipt_key
from instagram_media_verify import audit_candidates, fetch_public_image
from instagram_safe_plan import build_plan


def preflight(calendar: dict, published: dict, candidates: list[dict], *,
              now: datetime, fetcher=fetch_public_image,
              ledger: ReceiptLedger | None = None) -> dict:
    plan = build_plan(calendar, candidates, now=now, published=published)
    audited = audit_candidates(candidates, fetcher=fetcher)
    if len(audited["posts"]) != len(plan["proposals"]):
        raise ValueError("cantidad de candidatos inconsistente")
    for item, candidate, media in zip(plan["proposals"], candidates, audited["posts"]):
        reasons = set(item["reasons"])
        if media["status"] != "VERIFIED" or media["id"] != candidate.get("id"):
            reasons.add("media_sin_verificar")
        if ledger is None:
            reasons.add("idempotencia_sin_verificar")
        else:
            try:
                key = receipt_key(candidate)
                item["receipt_key"] = key
                old = ledger.status(key)
                if old:
                    reasons.add("recibo_ya_existente_" + old["status"].lower())
            except (TypeError, ValueError):
                reasons.add("recibo_invalido")
        item["media_status"] = media["status"]
        item["reasons"] = sorted(reasons)
        if reasons:
            item["decision"] = "REVISAR"
    plan["mode"] = "PREFLIGHT_READ_ONLY"
    plan["media_audit"] = audited
    plan["limits"].extend([
        "El reporte no crea ninguna reserva ni consulta periódicamente Metricool",
        "Ninguna decisión autoriza programar; se requiere revisión y reconsulta",
    ])
    return plan


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--calendar", type=Path, required=True)
    parser.add_argument("--published", type=Path, required=True)
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--ledger", type=Path, required=True,
                        help="Base SQLite existente en almacenamiento persistente; no crear en hosting efímero")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if not args.ledger.is_file():
        raise ValueError("No existe el registro persistente: se impide la revisión")
    calendar = json.loads(args.calendar.read_text(encoding="utf-8"))
    published = json.loads(args.published.read_text(encoding="utf-8"))
    candidates = json.loads(args.candidates.read_text(encoding="utf-8"))
    if not isinstance(candidates, list):
        raise ValueError("candidates debe ser una lista")
    with ReceiptLedger(args.ledger) as ledger:
        result = preflight(calendar, published, candidates, now=datetime.now(timezone.utc),
                           ledger=ledger)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Preflight de solo lectura: {args.out}")


if __name__ == "__main__":
    main()
