"""Recibos de idempotencia de programaciones Instagram FLUYNOVA.

No llama a Metricool. Un recibo reservado requiere reconciliación manual si la
respuesta del proveedor es incierta. No utilizar SQLite en hosting efímero.
"""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import unicodedata
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

BRAND = "fluynova"
TZ = ZoneInfo("America/Argentina/Buenos_Aires")


def canonical_date(date: str) -> str:
    if not isinstance(date, str):
        raise ValueError("fecha requerida")
    try:
        parsed = datetime.fromisoformat(date.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("fecha requiere zona horaria explícita")
        return parsed.astimezone(TZ).isoformat(timespec="seconds")
    except (TypeError, ValueError) as exc:
        raise ValueError("fecha con offset requerida") from exc


def canonical_caption(text: str) -> str:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("copy requerido")
    text = unicodedata.normalize("NFKD", text.casefold())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(text.split())


def receipt_key(candidate: dict) -> str:
    if not isinstance(candidate, dict) or candidate.get("brand") != BRAND:
        raise ValueError("marca no autorizada")
    media = candidate.get("media")
    if not isinstance(media, list) or not media or not all(isinstance(x, str) and x.startswith("https://") for x in media):
        raise ValueError("medios incompletos")
    payload = [BRAND, canonical_date(candidate.get("date")), canonical_caption(candidate.get("caption")), media]
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


class ReceiptLedger:
    def __init__(self, path: str | Path):
        self.path = str(path)
        self.db = sqlite3.connect(self.path, timeout=8, isolation_level=None)
        self.db.execute("PRAGMA busy_timeout = 8000")
        self.db.execute("PRAGMA journal_mode = WAL")
        self.db.execute("""CREATE TABLE IF NOT EXISTS ig_receipts (
            receipt_key TEXT PRIMARY KEY,
            status TEXT NOT NULL CHECK(status IN ('RESERVED','PENDING','PUBLISHED')),
            provider_post_id TEXT UNIQUE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )""")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.db.close()

    def status(self, key: str) -> dict | None:
        row = self.db.execute("SELECT status, provider_post_id FROM ig_receipts WHERE receipt_key = ?", (key,)).fetchone()
        return {"status": row[0], "provider_post_id": row[1]} if row else None

    def reserve(self, key: str) -> bool:
        """True solo para el primer intento; atómico frente a procesos concurrentes."""
        if not re.fullmatch("[0-9a-f]{64}", key):
            raise ValueError("recibo inválido")
        try:
            self.db.execute("BEGIN IMMEDIATE")
            cursor = self.db.execute("INSERT OR IGNORE INTO ig_receipts (receipt_key,status) VALUES (?, 'RESERVED')", (key,))
            added = cursor.rowcount == 1
            self.db.execute("COMMIT")
            return added
        except BaseException:
            if self.db.in_transaction:
                self.db.execute("ROLLBACK")
            raise

    def confirm_pending(self, key: str, provider_post_id: str) -> bool:
        """Confirmar únicamente tras respuesta verificable de Metricool."""
        if not isinstance(provider_post_id, str) or not re.fullmatch(r"[0-9]{1,24}", provider_post_id):
            raise ValueError("ID de Metricool inválido")
        try:
            self.db.execute("BEGIN IMMEDIATE")
            cur = self.db.execute(
                """UPDATE ig_receipts
                   SET status='PENDING', provider_post_id=?, updated_at=CURRENT_TIMESTAMP
                   WHERE receipt_key=? AND status='RESERVED'""", (provider_post_id, key)
            )
            self.db.execute("COMMIT")
            return cur.rowcount == 1
        except BaseException:
            if self.db.in_transaction:
                self.db.execute("ROLLBACK")
            raise

    def confirm_published(self, key: str, provider_post_id: str) -> bool:
        """No inferir PUBLISHED solo porque desapareció del calendario."""
        if not isinstance(provider_post_id, str) or not re.fullmatch(r"[0-9]{1,24}", provider_post_id):
            raise ValueError("ID de Metricool inválido")
        try:
            self.db.execute("BEGIN IMMEDIATE")
            cur = self.db.execute(
                """UPDATE ig_receipts SET status='PUBLISHED', updated_at=CURRENT_TIMESTAMP
                   WHERE receipt_key=? AND provider_post_id=? AND status='PENDING'""",
                (key, provider_post_id)
            )
            self.db.execute("COMMIT")
            return cur.rowcount == 1
        except BaseException:
            if self.db.in_transaction:
                self.db.execute("ROLLBACK")
            raise
