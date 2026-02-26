-- =========================================================
-- ARGUS DATABASE SCHEMA
-- =========================================================
-- NOTE: RLS is enabled but PUBLIC access is granted for now.
-- Tighten these policies when authentication is added.

-- Uploads table
CREATE TABLE IF NOT EXISTS uploads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  module text NOT NULL CHECK (module IN ('manpower','equipment','progress','cost')),
  storage_path text NOT NULL,
  original_name text NOT NULL,
  uploaded_at timestamptz DEFAULT now() NOT NULL
);

-- Manpower records
CREATE TABLE IF NOT EXISTS manpower_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  discipline text NOT NULL,
  planned_headcount integer NOT NULL,
  actual_headcount integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Equipment records
CREATE TABLE IF NOT EXISTS equipment_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp timestamptz NOT NULL,
  discipline text NOT NULL,
  equipment_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('Active','Idle','Breakdown','active','idle','breakdown')),
  hours_idle numeric,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Progress records
CREATE TABLE IF NOT EXISTS progress_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  discipline text NOT NULL,
  planned_progress_pct numeric NOT NULL,
  actual_progress_pct numeric NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Dashboard specs (one per module — upserted on each upload)
CREATE TABLE IF NOT EXISTS dashboard_specs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  module text NOT NULL UNIQUE,
  spec_json jsonb NOT NULL,
  meta_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_manpower_date ON manpower_records(date);
CREATE INDEX IF NOT EXISTS idx_manpower_discipline ON manpower_records(discipline);
CREATE INDEX IF NOT EXISTS idx_equipment_discipline ON equipment_records(discipline);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment_records(status);
CREATE INDEX IF NOT EXISTS idx_progress_date ON progress_records(date);
CREATE INDEX IF NOT EXISTS idx_progress_discipline ON progress_records(discipline);
CREATE INDEX IF NOT EXISTS idx_specs_module ON dashboard_specs(module);

-- =========================================================
-- Row Level Security (public mode - tighten later)
-- =========================================================

ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE manpower_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_specs ENABLE ROW LEVEL SECURITY;

-- PUBLIC policies (replace with auth-based policies when auth is added)
-- avoid errors if policies already exist
DROP POLICY IF EXISTS "public_select_uploads" ON uploads;
DROP POLICY IF EXISTS "public_insert_uploads" ON uploads;
CREATE POLICY "public_select_uploads" ON uploads FOR SELECT USING (true);
CREATE POLICY "public_insert_uploads" ON uploads FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_manpower" ON manpower_records;
DROP POLICY IF EXISTS "public_insert_manpower" ON manpower_records;
CREATE POLICY "public_select_manpower" ON manpower_records FOR SELECT USING (true);
CREATE POLICY "public_insert_manpower" ON manpower_records FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_equipment" ON equipment_records;
DROP POLICY IF EXISTS "public_insert_equipment" ON equipment_records;
CREATE POLICY "public_select_equipment" ON equipment_records FOR SELECT USING (true);
CREATE POLICY "public_insert_equipment" ON equipment_records FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_progress" ON progress_records;
DROP POLICY IF EXISTS "public_insert_progress" ON progress_records;
CREATE POLICY "public_select_progress" ON progress_records FOR SELECT USING (true);
CREATE POLICY "public_insert_progress" ON progress_records FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_specs" ON dashboard_specs;
DROP POLICY IF EXISTS "public_insert_specs" ON dashboard_specs;
DROP POLICY IF EXISTS "public_update_specs" ON dashboard_specs;
CREATE POLICY "public_select_specs" ON dashboard_specs FOR SELECT USING (true);
CREATE POLICY "public_insert_specs" ON dashboard_specs FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_specs" ON dashboard_specs FOR UPDATE USING (true);

-- Cost records table (added in update)
CREATE TABLE IF NOT EXISTS cost_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  discipline text NOT NULL,
  budget_amount numeric NOT NULL,
  actual_spend numeric NOT NULL,
  cost_code text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cost_date ON cost_records(date);
CREATE INDEX IF NOT EXISTS idx_cost_discipline ON cost_records(discipline);

ALTER TABLE cost_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_select_cost" ON cost_records;
DROP POLICY IF EXISTS "public_insert_cost" ON cost_records;
CREATE POLICY "public_select_cost" ON cost_records FOR SELECT USING (true);
CREATE POLICY "public_insert_cost" ON cost_records FOR INSERT WITH CHECK (true);
