-- Add attachment columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_path text;

-- Create a dedicated bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for task attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can view task attachments'
  ) THEN
    CREATE POLICY "Authenticated users can view task attachments"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'task-attachments');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own task attachments'
  ) THEN
    CREATE POLICY "Users can upload own task attachments"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'task-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update own task attachments'
  ) THEN
    CREATE POLICY "Users can update own task attachments"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'task-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own task attachments'
  ) THEN
    CREATE POLICY "Users can delete own task attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'task-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END
$$;
