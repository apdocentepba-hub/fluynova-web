-- FLUYNOVA, migración FUTURA separada para el receptor público.
-- NO aplicar remotamente hasta inventario D1, Time Travel y aprobación explícita.
-- Esta tabla no existe confirmada en D1 remoto; los tests la crean SOLO en local.
CREATE TABLE IF NOT EXISTS lead_idempotency (
  request_id TEXT PRIMARY KEY NOT NULL,
  payload_mac TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  lead_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
CREATE INDEX IF NOT EXISTS lead_idempotency_created_at ON lead_idempotency(created_at);
