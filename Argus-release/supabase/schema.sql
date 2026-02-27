-- ========================================
-- ARGUS PROJECT VISIBILITY COPILOT SCHEMA
-- ========================================

-- Run this SQL in the Supabase SQL Editor to set up your database
-- URL: https://ybjscpyxaauwntdxazbt.supabase.co/project/ybjscpyxaauwntdxazbt/sql

-- ========================================
-- TABLES
-- ========================================

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  client TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active',
  currency TEXT DEFAULT 'AED',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- File uploads tracking
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  period_date DATE,
  row_count INTEGER,
  sheet_names TEXT[],
  column_map JSONB,
  parse_status TEXT DEFAULT 'pending',
  parse_error TEXT,
  uploaded_by UUID,
  upload_date TIMESTAMPTZ DEFAULT now()
);

-- Manpower records
CREATE TABLE IF NOT EXISTS manpower_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES file_uploads(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  period_date DATE,
  discipline TEXT,
  company TEXT,
  nationality TEXT,
  planned_count INTEGER DEFAULT 0,
  actual_count INTEGER DEFAULT 0,
  variance INTEGER GENERATED ALWAYS AS (actual_count - planned_count) STORED,
  raw_row JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Equipment records
CREATE TABLE IF NOT EXISTS equipment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES file_uploads(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  period_date DATE,
  equipment_type TEXT,
  equipment_id TEXT,
  discipline TEXT,
  status TEXT,
  planned_count INTEGER DEFAULT 0,
  actual_count INTEGER DEFAULT 0,
  idle_count INTEGER DEFAULT 0,
  breakdown_count INTEGER DEFAULT 0,
  utilisation_rate NUMERIC(5,2),
  raw_row JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Progress records
CREATE TABLE IF NOT EXISTS progress_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES file_uploads(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  period_date DATE,
  activity_id TEXT,
  activity_name TEXT,
  discipline TEXT,
  wbs_code TEXT,
  planned_progress NUMERIC(5,2),
  actual_progress NUMERIC(5,2),
  variance NUMERIC(5,2) GENERATED ALWAYS AS (actual_progress - planned_progress) STORED,
  weight NUMERIC(10,4) DEFAULT 1.0,
  start_date DATE,
  finish_date DATE,
  status TEXT,
  raw_row JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cost records
CREATE TABLE IF NOT EXISTS cost_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES file_uploads(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  period_date DATE,
  cost_code TEXT,
  description TEXT,
  discipline TEXT,
  category TEXT,
  budget_amount NUMERIC(15,2) DEFAULT 0,
  committed_amount NUMERIC(15,2) DEFAULT 0,
  actual_amount NUMERIC(15,2) DEFAULT 0,
  forecast_amount NUMERIC(15,2) DEFAULT 0,
  variance NUMERIC(15,2) GENERATED ALWAYS AS (actual_amount - budget_amount) STORED,
  currency TEXT DEFAULT 'AED',
  raw_row JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- KPI snapshots
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  period_date DATE,
  kpi_key TEXT NOT NULL,
  kpi_value NUMERIC,
  kpi_text TEXT,
  kpi_unit TEXT,
  upload_id UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
  computed_at TIMESTAMPTZ DEFAULT now()
);

-- Agent conversation history
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  context_modules TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE manpower_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Demo mode - public read/write for development)
-- In production, replace these with authenticated-only policies

-- Projects
CREATE POLICY IF NOT EXISTS "Public read projects" ON projects FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public insert projects" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Public update projects" ON projects FOR UPDATE USING (true);

-- File uploads
CREATE POLICY IF NOT EXISTS "Public read file_uploads" ON file_uploads FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public insert file_uploads" ON file_uploads FOR INSERT WITH CHECK (true);

-- Manpower records
CREATE POLICY IF NOT EXISTS "Public read manpower" ON manpower_records FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public insert manpower" ON manpower_records FOR INSERT WITH CHECK (true);

-- Equipment records
CREATE POLICY IF NOT EXISTS "Public read equipment" ON equipment_records FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public insert equipment" ON equipment_records FOR INSERT WITH CHECK (true);

-- Progress records
CREATE POLICY IF NOT EXISTS "Public read progress" ON progress_records FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public insert progress" ON progress_records FOR INSERT WITH CHECK (true);

-- Cost records
CREATE POLICY IF NOT EXISTS "Public read cost" ON cost_records FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public insert cost" ON cost_records FOR INSERT WITH CHECK (true);

-- KPI snapshots
CREATE POLICY IF NOT EXISTS "Public read kpi" ON kpi_snapshots FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public insert kpi" ON kpi_snapshots FOR INSERT WITH CHECK (true);

-- Agent messages
CREATE POLICY IF NOT EXISTS "Public read messages" ON agent_messages FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public insert messages" ON agent_messages FOR INSERT WITH CHECK (true);

-- ========================================
-- STORAGE
-- ========================================

-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-files', 'project-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY IF NOT EXISTS "Public read project files" ON storage.objects 
FOR SELECT USING (bucket_id = 'project-files');

CREATE POLICY IF NOT EXISTS "Public upload project files" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'project-files');

-- ========================================
-- SEED DATA
-- ========================================

-- Seed demo project
INSERT INTO projects (name, code, client, location, currency)
VALUES ('Demo Project', 'DEMO-001', 'Argus Demo Client', 'Abu Dhabi, UAE', 'AED')
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- PERFORMANCE INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_file_uploads_project ON file_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_module ON file_uploads(module);
CREATE INDEX IF NOT EXISTS idx_manpower_project_period ON manpower_records(project_id, period_date);
CREATE INDEX IF NOT EXISTS idx_equipment_project_period ON equipment_records(project_id, period_date);
CREATE INDEX IF NOT EXISTS idx_progress_project_period ON progress_records(project_id, period_date);
CREATE INDEX IF NOT EXISTS idx_cost_project_period ON cost_records(project_id, period_date);
CREATE INDEX IF NOT EXISTS idx_kpi_project_module ON kpi_snapshots(project_id, module);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(project_id, session_id);
