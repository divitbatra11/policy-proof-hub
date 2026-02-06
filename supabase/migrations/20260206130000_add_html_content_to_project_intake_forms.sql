-- Add html_content column to store original formatted HTML
ALTER TABLE project_intake_forms ADD COLUMN IF NOT EXISTS html_content TEXT;
