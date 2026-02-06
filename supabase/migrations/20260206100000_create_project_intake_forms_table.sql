-- Create project_intake_forms table
CREATE TABLE project_intake_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  project_name TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  form_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

-- Add indexes for better query performance
CREATE INDEX idx_project_intake_forms_created_by ON project_intake_forms(created_by);
CREATE INDEX idx_project_intake_forms_updated_at ON project_intake_forms(updated_at);

-- Enable Row Level Security
ALTER TABLE project_intake_forms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all project intake forms" ON project_intake_forms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create their own project intake forms" ON project_intake_forms
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own project intake forms" ON project_intake_forms
  FOR UPDATE TO authenticated 
  USING (auth.uid() = created_by OR auth.uid() = updated_by)
  WITH CHECK (auth.uid() = updated_by);

CREATE POLICY "Admins can delete project intake forms" ON project_intake_forms
  FOR DELETE TO authenticated 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Add trigger for auto-updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_intake_forms_updated_at
  BEFORE UPDATE ON project_intake_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE project_intake_forms;
