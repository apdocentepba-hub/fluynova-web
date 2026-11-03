"""Planificador local de Instagram FLUYNOVA (solo lectura; NO publica).

Entradas: exportación JSON de calendario Metricool y propuestas JSON.
Salidas: decisión auditada por propuesta; no usa credenciales ni red.

Uso:
  python marketing/instagram_safe_plan.py --calendar calendar.json \
      --candidates candidates.json --out plan.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

BRAND = "fluynova"
TZ = ZoneInfo("America/Argentina/Buenos_Aires")
NEAR_DAYS = 21
ALLOWED_MEDIA_HOSTS = {"raw.githubusercontent.com", "static.metricool.com"}
BLOCKED_TOPICS = {"apdocentepba", "apd", "volve", "eestn6avellaneda"}


def normalized(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", text))


def tokens(text: str) -> set[str]:
    ignored = {"para", "como", "que", "con", "esta", "este", "desde", "sobre", "esta", "tenes", "fluynova", "guia", "tres", "estas", "cada", "por", "una", "uno", "los", "las", "del", "y", "en", "un", "de", "la", "el", "a", "tu", "se", "si", "no", "mas", "antes"}
    return {word for word in normalized(text).split() if len(word) >= 4 and word not in ignored}


def similarity(a: str, b: str) -> float:
    x, y = tokens(a), tokens(b)
    return len(x & y) / len(x | y) if x and y else 0.0


def parse_date(value: str) -> datetime:
    """Acepta fecha ISO con offset o fecha y zona como en Metricool."""
    if not isinstance(value, str):
        raise ValueError("Fecha inválida")
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ)


def calendar_items(obj: dict) -> list[dict]:
    data = obj.get("data", obj.get("posts", []))
    if not isinstance(data, list):
        raise ValueError("El calendario debe contener una lista data/posts")
    result = []
    for row in data:
        if not isinstance(row, dict):
            continue
        stamp = row.get("publicationDate", {})
        when = stamp.get("dateTime") if isinstance(stamp, dict) else stamp
        if not when:
            continue
        providers = row.get("providers", [])
        if not any(p.get("network") == "instagram" for p in providers if isinstance(p, dict)):
            continue
        result.append({
            "date": parse_date(when),
            "text": row.get("text", ""),
            "topic": row.get("topic", ""),
            "status": ",".join(p.get("status", "") for p in providers),
            "id": row.get("id", "unknown"),
        })
    return result



BRAND_ID = "7583853"
HISTORY_FIELDS = ("IGPO01", "IGPO03", "IGPO06")


def assert_snapshot(source: dict, *, now: datetime, source_name: str) -> None:
    """Datos sin marca o caducados bloquean por completo la planificación."""
    if not isinstance(source, dict) or str(source.get("brandId")) != BRAND_ID:
        raise ValueError(f"{source_name}: marca de Metricool ausente o equivocada")
    try:
        fetched = parse_date(source["fetchedAt"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"{source_name}: fetchedAt inválido") from exc
    age = now.astimezone(TZ) - fetched
    if not timedelta(0) <= age <= timedelta(minutes=60):
        raise ValueError(f"{source_name}: consulta ausente, futura o desactualizada")


def published_items(history: dict, *, now: datetime) -> list[dict]:
    """Adapta la respuesta real 'rows' del endpoint de métricas IGPO.

    El API devuelve fechas YYYYMMDD, copys y enlaces sin una hora exacta.
    Los nombres de columnas se suministran en fieldIds en el mismo orden
    utilizado en la solicitud; sin ellos se falla cerrado.
    """
    assert_snapshot(history, now=now, source_name="historial")
    field_ids = history.get("fieldIds")
    rows = history.get("rows")
    if (not isinstance(field_ids, list) or len(field_ids) != len(set(field_ids))
            or not set(HISTORY_FIELDS).issubset(set(field_ids)) or not isinstance(rows, list)):
        raise ValueError("historial: columnas o filas sin contrato válido")
    try:
        start = parse_date(history["from"])
        end = parse_date(history["to"])
    except (KeyError, ValueError, TypeError) as exc:
        raise ValueError("historial: cobertura temporal inválida") from exc
    local_now = now.astimezone(TZ)
    if start.date() > (local_now - timedelta(days=NEAR_DAYS)).date() or end.date() < local_now.date():
        raise ValueError("historial: faltan fechas para prevenir duplicados")
    idx = {field: i for i, field in enumerate(field_ids)}
    result = []
    for count, row in enumerate(rows):
        if not isinstance(row, list) or len(row) != len(field_ids):
            raise ValueError(f"historial: fila {count} incompleta")
        raw_date = row[idx["IGPO01"]]
        caption = row[idx["IGPO03"]]
        link = row[idx["IGPO06"]]
        if not isinstance(raw_date, str) or not re.fullmatch(r"\\d{8}", raw_date):
            raise ValueError(f"historial: fecha inválida en fila {count}")
        try:
            date = datetime.strptime(raw_date, "%Y%m%d").replace(tzinfo=TZ)
        except ValueError as exc:
            raise ValueError(f"historial: fecha inexistente en fila {count}") from exc
        if not isinstance(caption, str) or not isinstance(link, str):
            raise ValueError(f"historial: tipo de columna inesperado en fila {count}")
        parsed = urlparse(link)
        if (parsed.scheme != "https" or parsed.hostname not in {"instagram.com", "www.instagram.com"}
                or parsed.username or parsed.password or parsed.port
                or not re.fullmatch(r"/(p|reel|tv)/[A-Za-z0-9_-]+/?", parsed.path)):
            raise ValueError(f"historial: enlace de Instagram inválido en fila {count}")
        result.append({"date": date, "day_only": True, "text": caption,
                       "topic": "", "status": "PUBLISHED", "id": parsed.path.strip("/").split("/")[-1],
                       "url": link})
    return result


def safe_media(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except (TypeError, ValueError):
        return False
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_MEDIA_HOSTS:
        return False
    if parsed.username or parsed.password or parsed.port:
        return False
    return parsed.path.lower().endswith((".jpeg", ".jpg", ".png", ".mp4"))


def check_candidate(candidate: dict, current: list[dict], *, now: datetime) -> dict:
    ident = str(candidate.get("id", "unnamed"))
    reasons = []
    topic = str(candidate.get("topic", ""))
    caption = str(candidate.get("caption", ""))
    brand = candidate.get("brand")
    when = None
    try:
        when = parse_date(candidate["date"])
    except (KeyError, TypeError, ValueError):
        reasons.append("fecha_invalida")
    if brand != BRAND:
        reasons.append("marca_no_autorizada")
    if not topic.strip() or not caption.strip():
        reasons.append("contenido_incompleto")
    if BLOCKED_TOPICS.intersection(set(normalized(topic + " " + caption).split())):
        reasons.append("mezcla_de_proyectos")
    media = candidate.get("media")
    if not isinstance(media, list) or not media or not all(isinstance(u, str) and safe_media(u) for u in media):
        reasons.append("media_no_verificada")
    if when:
        if when <= now.astimezone(TZ):
            reasons.append("fecha_pasada")
        for item in current:
            delta = abs(when - item["date"])
            if item.get("day_only") and when.date() == item["date"].date():
                reasons.append("dia_ya_publicado_" + str(item["id"]))
            elif not item.get("day_only") and delta <= timedelta(hours=3):
                reasons.append("colision_horaria_" + str(item["id"]))
            if delta <= timedelta(days=NEAR_DAYS):
                if topic and normalized(topic) == normalized(item["topic"]) and item["topic"]:
                    reasons.append("tema_repetido_" + str(item["id"]))
                elif caption and similarity(caption, item["text"]) >= 0.44:
                    reasons.append("contenido_similar_" + str(item["id"]))
    fingerprint = hashlib.sha256((BRAND + "|" + normalized(topic) + "|" + (when.isoformat() if when else "invalid")).encode()).hexdigest()[:16]
    return {"id": ident, "fingerprint": fingerprint, "date": when.isoformat() if when else None,
            "decision": "REVISAR" if reasons else "APTA_PARA_REVISION_MANUAL",
            "reasons": sorted(set(reasons)), "notice": "No se publicó ni programó contenido"}


def build_plan(calendar: dict, candidates: list[dict], *, now: datetime, published: dict | None = None) -> dict:
    if not isinstance(candidates, list):
        raise ValueError("Las propuestas deben ser una lista")
    assert_snapshot(calendar, now=now, source_name="calendario")
    if published is None:
        raise ValueError("Falta historial publicado: ninguna propuesta puede aprobarse")
    items = calendar_items(calendar) + published_items(published, now=now)
    results = []
    fingerprints = set()
    for candidate in candidates:
        item = check_candidate(candidate, items, now=now)
        if item["fingerprint"] in fingerprints:
            item["reasons"].append("propuesta_duplicada_en_lote")
            item["decision"] = "REVISAR"
        fingerprints.add(item["fingerprint"])
        results.append(item)
    return {"brand": BRAND, "mode": "DRY_RUN_ONLY", "checked_at": now.astimezone(TZ).isoformat(),
            "calendar_count": len(calendar_items(calendar)), "published_count": len(items) - len(calendar_items(calendar)), "proposals": results,
            "limits": ["No consulta Meta/Metricool directamente", "No verifica que el archivo remoto sea descargable", "El filtro semántico no reemplaza una revisión editorial"]}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--calendar", type=Path, required=True)
    ap.add_argument("--published", type=Path, required=True, help="Metricool IGPO rows con fieldIds/brandId/fetchedAt/from/to")
    ap.add_argument("--candidates", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    plan = build_plan(json.loads(args.calendar.read_text(encoding="utf-8")),
                      json.loads(args.candidates.read_text(encoding="utf-8")), now=datetime.now(timezone.utc),
                      published=json.loads(args.published.read_text(encoding="utf-8")))
    args.out.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Plan sin publicar: {args.out}")


if __name__ == "__main__":
    main()
