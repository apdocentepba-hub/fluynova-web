-- FLUYNOVA — esquema conceptual exclusivo para Cloudflare D1.
-- No ejecutar en APDocentePBA, Supabase u otra base compartida.
-- En un proyecto D1 propio usar wrangler d1 migrations create y aplicar tras validar.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY NOT NULL,
  received_at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  deadline TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  budget TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  medium TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  creative TEXT NOT NULL DEFAULT '',
  consent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Nuevo'
    CHECK (status IN ('Nuevo','En análisis','Respondido','Descartado'))
);

CREATE INDEX IF NOT EXISTS leads_received_at ON leads(received_at);
CREATE INDEX IF NOT EXISTS leads_status ON leads(status,received_at);

-- Solo fingerprint HMAC del IP (jamás IP en claro). Limpiar periódicamente
-- ventanas anteriores a 48 horas por cron interno antes de producción.
CREATE TABLE IF NOT EXISTS lead_rate_limit (
  fingerprint TEXT NOT NULL,
  hour_bucket INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (fingerprint, hour_bucket)
);
CREATE INDEX IF NOT EXISTS lead_rate_limit_hour ON lead_rate_limit(hour_bucket);
