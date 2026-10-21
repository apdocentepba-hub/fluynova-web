"""Fluynova MVP: public site, private lead inbox, optional email alerts."""
from __future__ import annotations

import csv
import html
import io
import os
import re
import secrets
import smtplib
import sqlite3
import time
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import parse_qs

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles

BASE = Path(__file__).resolve().parent
STATIC = BASE / "static"
DATA = Path(os.getenv("DATA_DIR", str(BASE / "data")))
DATA.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA / "consultas.db"
STATUSES = {"Nuevo", "En análisis", "Presupuestado", "En desarrollo", "Cerrado", "Descartado"}
ALLOWED_CATEGORIES = {
    "Automatizar tareas", "Desarrollar software", "Conectar herramientas / datos",
    "Inteligencia artificial", "Otro / no estoy seguro",
}
EMAIL = re.compile(r"^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$")
security = HTTPBasic(auto_error=False)
app = FastAPI(title="Fluynova — Solicitudes", docs_url=None, redoc_url=None, openapi_url=None)


def db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=12)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=12000")
    return conn


def init_db():
    with db_connection() as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("""CREATE TABLE IF NOT EXISTS consultas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            organization TEXT NOT NULL DEFAULT '',
            category TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Nuevo'
        )""")


init_db()
_attempts: dict[str, list[float]] = {}


def admin_login(credentials: HTTPBasicCredentials | None = Depends(security)):
    expected_user = os.getenv("ADMIN_USER", "admin")
    expected_pass = os.getenv("ADMIN_PASSWORD", "")
    if not expected_pass or len(expected_pass) < 12 or expected_pass.lower() in {"changeme", "cambiame", "password", "123456"} or expected_pass.upper().startswith("CAMBIAR-"):
        raise HTTPException(503, detail="Configurá un ADMIN_PASSWORD seguro antes de usar el panel.")
    if (credentials is None
        or not secrets.compare_digest(credentials.username.encode(), expected_user.encode())
        or not secrets.compare_digest(credentials.password.encode(), expected_pass.encode())):
        raise HTTPException(401, detail="Acceso restringido", headers={"WWW-Authenticate": 'Basic realm="Fluynova privado"'})
    return True


@app.middleware("http")
async def secure_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path.startswith("/admin"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return response


def optional_notification(name: str, email: str, organization: str, category: str, message: str):
    """Best-effort alert. Always persist before attempting to email."""
    host = os.getenv("SMTP_HOST", "")
    recipient = os.getenv("SMTP_TO", "")
    sender = os.getenv("SMTP_FROM", "")
    if not all([host, recipient, sender]):
        return
    mail = EmailMessage()
    mail["Subject"] = f"[FLUYNOVA] Nueva consulta: {category}"
    mail["From"] = sender
    mail["To"] = recipient
    mail["Reply-To"] = email
    mail.set_content(f"Nombre: {name}\nCorreo: {email}\nOrganización: {organization}\nTipo: {category}\n\n{message}\n")
    try:
        port = int(os.getenv("SMTP_PORT", "465"))
        with smtplib.SMTP_SSL(host, port, timeout=15) as smtp:
            username = os.getenv("SMTP_USER", "")
            if username:
                smtp.login(username, os.getenv("SMTP_PASSWORD", ""))
            smtp.send_message(mail)
    except Exception as exc:
        print(f"SMTP notification failed: {type(exc).__name__}")


@app.post("/api/contact")
async def send_contact(request: Request, background: BackgroundTasks):
    if int(request.headers.get("content-length", "0") or "0") > 16384:
        raise HTTPException(413, detail="El mensaje es demasiado extenso.")
    body = await request.body()
    if len(body) > 16384:
        raise HTTPException(413, detail="El mensaje es demasiado extenso.")
    try:
        import json
        payload = json.loads(body)
        if not isinstance(payload, dict):
            raise ValueError("Invalid object")
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, detail="Solicitud inválida.")

    def string(key: str) -> str:
        value = payload.get(key, "")
        return value.strip() if isinstance(value, str) else ""

    if string("website"):
        return JSONResponse({"ok": True}, status_code=201)

    # Never accept real customer data without durable storage configured.
    if os.getenv("CONTACT_STORAGE_READY", "0") != "1":
        raise HTTPException(503, detail="El formulario está en preparación. Pronto habilitaremos las consultas.")

    name, email = string("name"), string("email")
    org, category, message = string("organization"), string("category"), string("message")
    if not (2 <= len(name) <= 100 and len(email) <= 180 and EMAIL.fullmatch(email)
            and len(org) <= 120 and category in ALLOWED_CATEGORIES
            and 15 <= len(message) <= 5000 and payload.get("consent") is True):
        raise HTTPException(422, detail="Revisá los datos: faltan campos obligatorios o hay valores inválidos.")

    remote = request.client.host if request.client else "unknown"
    if os.getenv("TRUST_PROXY", "0") == "1":
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            remote = forwarded
    now = time.monotonic()
    recent = [t for t in _attempts.get(remote, []) if now - t < 3600]
    if len(recent) >= 5:
        raise HTTPException(429, detail="Demasiadas consultas recientes. Probá nuevamente más tarde.")
    recent.append(now)
    _attempts[remote] = recent
    if len(_attempts) > 5000:
        for key in list(_attempts):
            if all(now - t >= 3600 for t in _attempts[key]):
                del _attempts[key]

    with db_connection() as conn:
        conn.execute("""INSERT INTO consultas
        (created_at,name,email,organization,category,message,status)
        VALUES (?,?,?,?,?,?,?)""", (
            datetime.now(timezone.utc).isoformat(timespec="seconds"),
            name, email, org, category, message, "Nuevo",
        ))
    background.add_task(optional_notification, name, email, org, category, message)
    return JSONResponse({"ok": True, "message": "Consulta recibida"}, status_code=201)


@app.get("/api/config")
def config():
    return {"contact_enabled": os.getenv("CONTACT_STORAGE_READY", "0") == "1"}


@app.get("/api/health")
def health():
    return {"ok": True}


def e(value) -> str:
    return html.escape(str(value), quote=True)


ADMIN_CSS = """
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0c1219;color:#eef5ee;font:14px/1.6 system-ui,sans-serif}header{background:#17222a;border-bottom:1px solid #33454a;padding:22px max(22px,calc((100% - 1160px)/2))}header h1{margin:0;font-size:24px}header p{margin:2px 0 0;color:#a9bcbb}main{width:min(1160px,calc(100% - 44px));margin:30px auto}a{color:#c8ff87}nav{margin:20px 0}nav a{margin-right:16px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;color:#c8ff87;background:#16262b}th,td{border-bottom:1px solid #304049;padding:14px 11px;vertical-align:top}td{color:#c7d5d4;overflow-wrap:anywhere}.message{white-space:pre-wrap;max-width:360px}.small{font-size:11px;color:#9cafae}.empty{background:#17222a;border:1px solid #33454a;padding:28px;border-radius:10px}.table-scroll{overflow-x:auto;background:#111c24;border:1px solid #35444e;border-radius:10px}select,button{background:#263a35;color:#d7ffd1;border:1px solid #6d9877;border-radius:5px;padding:7px}button{cursor:pointer}strong{color:#fff}footer{color:#819395;margin-top:30px;font-size:11px}
"""


@app.get("/admin", response_class=HTMLResponse)
def admin(_=Depends(admin_login)):
    with db_connection() as conn:
        leads = conn.execute("SELECT * FROM consultas ORDER BY id DESC LIMIT 500").fetchall()
        total = conn.execute("SELECT COUNT(*) FROM consultas").fetchone()[0]
    rows = []
    for lead in leads:
        options = "".join(f'<option value="{e(s)}" {"selected" if s == lead["status"] else ""}>{e(s)}</option>' for s in sorted(STATUSES))
        rows.append(f'<tr><td>#{lead["id"]}<div class="small">{e(lead["created_at"][:16])} UTC</div></td>'
                    f'<td><strong>{e(lead["name"])}</strong><div class="small">{e(lead["organization"])}</div>'
                    f'<a href="mailto:{e(lead["email"])}">{e(lead["email"])}</a></td>'
                    f'<td>{e(lead["category"])}</td><td class="message">{e(lead["message"])}</td>'
                    f'<td><form method="post" action="/admin/status/{lead["id"]}"><select name="status" aria-label="Estado consulta {lead["id"]}">{options}</select> <button type="submit">Guardar</button></form><form method="post" action="/admin/delete/{lead["id"]}" onsubmit="return confirm(&quot;¿Eliminar definitivamente esta consulta?&quot;)"><button type="submit" style="margin-top:8px;color:#ffcab8;border-color:#ac716e">Eliminar</button></form></td></tr>')
    table = ('<div class="table-scroll"><table><thead><tr><th>ID / Fecha</th><th>Contacto</th><th>Necesita</th><th>Mensaje</th><th>Estado</th></tr></thead><tbody>'
             + "".join(rows) + '</tbody></table></div>') if rows else '<div class="empty">No hay consultas todavía.</div>'
    return HTMLResponse(f'''<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Panel de consultas — Fluynova</title><style>{ADMIN_CSS}</style></head><body><header><h1>✳ FLUYNOVA / Panel privado</h1><p>Bandeja de consultas recibidas</p></header><main><h2>{total} consultas en total</h2><nav><a href="/admin/export.csv">↓ Exportar todas a CSV</a> <a href="/">↗ Ver el sitio público</a></nav>{table}<footer>Se muestran las últimas 500 consultas. Para acceder a todas, exportá el archivo CSV. Protegé tus credenciales y usá siempre HTTPS.</footer></main></body></html>''')


def require_same_origin(request: Request):
    """Additional check for mutations in HTTP Basic admin interface."""
    origin = request.headers.get("origin")
    if origin:
        from urllib.parse import urlsplit
        source = urlsplit(origin)
        target = urlsplit(str(request.base_url))
        if source.scheme != target.scheme or source.netloc != target.netloc:
            raise HTTPException(403, detail="Origen no autorizado.")


@app.post("/admin/status/{lead_id}")
async def update_status(lead_id: int, request: Request, _=Depends(admin_login)):
    require_same_origin(request)
    if int(request.headers.get("content-length", "0") or "0") > 512:
        raise HTTPException(413)
    data = parse_qs((await request.body()).decode("utf-8", errors="replace"))
    new_status = data.get("status", [""])[0]
    if new_status not in STATUSES:
        raise HTTPException(422, detail="Estado no admitido")
    with db_connection() as conn:
        conn.execute("UPDATE consultas SET status=? WHERE id=?", (new_status, lead_id))
    return Response(status_code=303, headers={"Location": "/admin"})


@app.post("/admin/delete/{lead_id}")
def delete_lead(lead_id: int, request: Request, _=Depends(admin_login)):
    require_same_origin(request)
    with db_connection() as conn:
        conn.execute("DELETE FROM consultas WHERE id=?", (lead_id,))
    return Response(status_code=303, headers={"Location": "/admin"})


@app.get("/admin/export.csv")
def export_csv(_=Depends(admin_login)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "fecha_utc", "nombre", "correo", "organizacion", "categoria", "mensaje", "estado"])
    with db_connection() as conn:
        for r in conn.execute("SELECT * FROM consultas ORDER BY id DESC"):
            def safe_csv(v):
                s = str(v)
                return "'" + s if s.lstrip().startswith(("=", "+", "-", "@")) else s
            writer.writerow([safe_csv(r[k]) for k in ("id", "created_at", "name", "email", "organization", "category", "message", "status")])
    content = '\ufeff' + output.getvalue()
    return Response(content, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=fluynova-consultas.csv"})


@app.get("/privacidad")
def privacidad():
    return FileResponse(STATIC / "privacidad.html")


@app.get("/robots.txt")
def robots():
    return Response("User-agent: *\nDisallow: /admin\nDisallow: /api\n", media_type="text/plain")


app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")
