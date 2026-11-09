-- FLUYNOVA: bandeja de salida, SOLO LABORATORIO / migra en D1 remoto con permiso aparte.
-- No almacena correos ni mensajes, solo ID de la consulta y estado.
-- Esta migración NO forma parte de idempotency.schema.sql ni la modifica.
CREATE TABLE IF NOT EXISTS lead_mail_outbox (
  lead_id TEXT PRIMARY KEY NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','sending','accepted','uncertain','delivered','bounced')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  provider_message_id TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
CREATE INDEX IF NOT EXISTS lead_mail_outbox_state_created
  ON lead_mail_outbox(state,created_at);
