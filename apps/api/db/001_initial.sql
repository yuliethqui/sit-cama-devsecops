-- SIT-CAMA: ESQUEMA DE DEMOSTRACIÓN. No cargar datos reales de pacientes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK(role IN ('ENFERMERO','MEDICO','ADMISIONES','COORDINADOR','SERVICIOS','AUDITOR')),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_hmac text UNIQUE,
  identity_ciphertext bytea, provisional boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS triage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES patients(id),
  level text CHECK(level IN ('I','II','III','IV','V')), max_wait_minutes integer,
  clinical_payload_ciphertext bytea NOT NULL, requires_clinical_review boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_triage_patient_time ON triage_records(patient_id, created_at DESC);
CREATE TABLE IF NOT EXISTS beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, service text NOT NULL,
  status text NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE','OCCUPIED','CLEANING','BLOCKED')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_beds_service_status ON beds(service,status);
CREATE TABLE IF NOT EXISTS bed_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bed_id uuid NOT NULL REFERENCES beds(id),
  patient_id uuid NOT NULL REFERENCES patients(id), assigned_by uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(), released_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_patient_per_bed ON bed_assignments(bed_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_bed_per_patient ON bed_assignments(patient_id) WHERE released_at IS NULL;
CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY, actor_id uuid REFERENCES users(id), entity_type text NOT NULL,
  entity_id text NOT NULL, action text NOT NULL, previous_state jsonb, new_state jsonb,
  request_ip text, recorded_at timestamptz NOT NULL DEFAULT now()
);
-- Impide UPDATE/DELETE normales, pero NO garantiza inmutabilidad frente a superusuarios.
CREATE OR REPLACE FUNCTION audit_prohibit_changes() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_events es de solo anexado'; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_no_audit_mutation ON audit_events;
CREATE TRIGGER trg_no_audit_mutation BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION audit_prohibit_changes();
-- 38 camas: 15 urgencias adultos, 8 pediátricas, 12 observación y 3 aislamiento.
INSERT INTO beds(code,service,status)
SELECT 'UA-' || lpad(i::text,2,'0'), 'URGENCIAS_ADULTOS','AVAILABLE' FROM generate_series(1,15) i
UNION ALL SELECT 'UP-' || lpad(i::text,2,'0'),'URGENCIAS_PEDIATRICAS','AVAILABLE' FROM generate_series(1,8) i
UNION ALL SELECT 'OBS-' || lpad(i::text,2,'0'),'OBSERVACION','AVAILABLE' FROM generate_series(1,12) i
UNION ALL SELECT 'AIS-' || lpad(i::text,2,'0'),'AISLAMIENTO','AVAILABLE' FROM generate_series(1,3) i
ON CONFLICT(code) DO NOTHING;
