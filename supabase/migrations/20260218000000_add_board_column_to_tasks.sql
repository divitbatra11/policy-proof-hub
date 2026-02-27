-- Add board_column to tasks for the Kanban board view.
-- The column stores the bucket the task lives in; the status field remains unchanged.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS board_column TEXT NOT NULL DEFAULT 'General';

CREATE INDEX IF NOT EXISTS idx_tasks_board_column
  ON public.tasks(board_column)
  WHERE deleted_at IS NULL;
