-- Add checklist support for tasks

CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  item_text text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task_id
  ON public.task_checklist_items(task_id);

CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task_id_sort
  ON public.task_checklist_items(task_id, sort_order);

-- Enable RLS
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view checklist items for non-deleted tasks
CREATE POLICY "Users can view task checklist items"
ON public.task_checklist_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND t.deleted_at IS NULL
  )
);

-- Admin/Publisher can create checklist items
CREATE POLICY "Admin/Publisher can create task checklist items"
ON public.task_checklist_items
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'publisher')
  AND EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND t.deleted_at IS NULL
  )
);

-- Admin/Publisher can update checklist items
CREATE POLICY "Admin/Publisher can update task checklist items"
ON public.task_checklist_items
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'publisher')
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'publisher')
);

-- Admin/Publisher can delete checklist items
CREATE POLICY "Admin/Publisher can delete task checklist items"
ON public.task_checklist_items
FOR DELETE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'publisher')
);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_task_checklist_items_updated_at ON public.task_checklist_items;
CREATE TRIGGER update_task_checklist_items_updated_at
BEFORE UPDATE ON public.task_checklist_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for checklist items
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_checklist_items;