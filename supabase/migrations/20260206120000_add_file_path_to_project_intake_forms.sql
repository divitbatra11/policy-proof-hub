-- Add file_path column to project_intake_forms table
ALTER TABLE project_intake_forms ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Update existing records to extract path from file_url (optional, for existing data)
-- This is a best-effort update and may not work for all URLs
UPDATE project_intake_forms
SET file_path = substring(file_url from 'policy-documents/([^?]+)')
WHERE file_path IS NULL AND file_url IS NOT NULL;
