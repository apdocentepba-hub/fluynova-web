"""Verificador previo de medios para IG FLUYNOVA.

No publica, no registra credenciales y no modifica el calendario.
Las URLs son fijas a orígenes propios/Metricool; los redirects están prohibidos.
Solo valida imágenes; vídeo requiere una comprobación separada.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 35_000_000
READ_TIMEOUT = 8
IMAGE_MIMES = {"image/jpeg": "JPEG", "image/png": "PNG"}
GH_PATTERN = re.compile(
    r"/apdocentepba-hub/fluynova-web/(?:main|[0-9a-f]{40})/"
    r"(?:marketing/(?:growth|instagram)|static/marketing)/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png)$"
)
METRICOOL_PATTERN = re.compile(
    r"/planner/20\d{4}/7583853-file-\d+\.(?:jpg|jpeg|png)$"
)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ValueError("redirección prohibida")


def approved_media_url(url: str) -> bool:
    if not isinstance(url, str) or len(url) > 650 or "%" in url:
        return False
    try:
        parsed = urlsplit(url)
        if (parsed.scheme != "https" or parsed.username or parsed.password
                or parsed.port is not None or parsed.query or parsed.fragment):
            return False
        if parsed.hostname == "raw.githubusercontent.com":
            return bool(GH_PATTERN.fullmatch(parsed.path))
        if parsed.hostname == "static.metricool.com":
            return bool(METRICOOL_PATTERN.fullmatch(parsed.path))
        return False
    except ValueError:
        return False


def fetch_public_image(url: str) -> tuple[bytes, str, str]:
    """Descarga acotada sin redirects: bytes, MIME declarado y URL final."""
    opener = urllib.request.build_opener(_NoRedirect())
    req = urllib.request.Request(
        url, headers={"User-Agent": "FLUYNOVA-MediaSafety/1.0", "Accept": "image/jpeg,image/png"}
    )
    with opener.open(req, timeout=READ_TIMEOUT) as response:
        length = response.headers.get("Content-Length")
        if length and int(length) > MAX_BYTES:
            raise ValueError("archivo supera el límite")
        mime = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("archivo supera el límite")
        return data, mime, response.geturl()


def verify_image(url: str, *, fetcher=fetch_public_image) -> dict:
    """Devuelve un dict verificable, nunca una afirmación implícita de publicación."""
    result = {"url": url, "status": "BLOCKED", "reason": None}
    if not approved_media_url(url):
        result["reason"] = "url_no_autorizada"
        return result
    try:
        body, mime, final_url = fetcher(url)
        if final_url != url or not approved_media_url(final_url):
            raise ValueError("url_final_distinta")
        if mime not in IMAGE_MIMES:
            raise ValueError("mime_no_autorizado")
        if not isinstance(body, bytes) or not (0 < len(body) <= MAX_BYTES):
            raise ValueError("tamano_invalido")
        Image.MAX_IMAGE_PIXELS = MAX_PIXELS
        with Image.open(io.BytesIO(body)) as img:
            fmt = img.format
            if fmt != IMAGE_MIMES[mime]:
                raise ValueError("mime_no_coincide_con_archivo")
            img.verify()
        with Image.open(io.BytesIO(body)) as img:
            img = ImageOps.exif_transpose(img)
            w, h = img.size
            if w < 320 or h < 320 or w * h > MAX_PIXELS:
                raise ValueError("dimensiones_fuera_de_rango")
            ratio = w / h
            if ratio < 0.8 or ratio > 1.91:
                raise ValueError("proporcion_fuera_de_rango")
        result.update(status="VERIFIED", reason=None, width=w, height=h,
                      bytes=len(body), mime=mime)
    except (ValueError, OSError, OverflowError, urllib.error.URLError, UnidentifiedImageError):
        # Los mensajes de error HTTP o DNS no se copian al informe: podrían incluir datos externos.
        result["reason"] = "descarga_o_validacion_fallida"
    return result


def audit_candidates(candidates: list[dict], *, fetcher=fetch_public_image) -> dict:
    findings = []
    for candidate in candidates:
        if not isinstance(candidate, dict):
            findings.append({"id": None, "status": "BLOCKED", "reason": "propuesta_invalida"})
            continue
        media = candidate.get("media")
        checks = ([verify_image(u, fetcher=fetcher) for u in media]
                  if isinstance(media, list) and media and all(isinstance(u, str) for u in media)
                  else [])
        valid = bool(checks) and all(c["status"] == "VERIFIED" for c in checks)
        findings.append({"id": candidate.get("id"), "status": "VERIFIED" if valid else "BLOCKED",
                         "reason": None if valid else "recursos_no_verificados",
                         "media": checks})
    return {"brand": "fluynova", "mode": "READ_ONLY", "posts": findings,
            "note": "VERIFIED indica comprobación de imagen, no revisión editorial ni autorización a programar"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    candidates = json.loads(args.candidates.read_text(encoding="utf-8"))
    if not isinstance(candidates, list):
        raise ValueError("Las propuestas deben ser una lista JSON")
    data = audit_candidates(candidates)
    args.out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Auditoría de medios: {args.out} ({sum(p['status']=='VERIFIED' for p in data['posts'])} verificadas)")


if __name__ == "__main__":
    main()
