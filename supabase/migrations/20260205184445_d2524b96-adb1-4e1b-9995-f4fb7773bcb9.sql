-- Create enums for task status and priority
CREATE TYPE public.task_status AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');

-- Create tasks table
CREATE TABLE public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 120),
    description TEXT,
    status task_status NOT NULL DEFAULT 'not_started',
    priority task_priority NOT NULL DEFAULT 'medium',
    due_date TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE -- soft delete
);

-- Create task assignees join table (many-to-many)
CREATE TABLE public.task_assignees (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    UNIQUE(task_id, user_id)
);

-- Create indices for common queries
CREATE INDEX idx_tasks_status ON public.tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_created_at ON public.tasks(created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_priority ON public.tasks(priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_task_assignees_user_id ON public.task_assignees(user_id);
CREATE INDEX idx_task_assignees_task_id ON public.task_assignees(task_id);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Tasks RLS policies
-- All authenticated users can view non-deleted tasks
CREATE POLICY "Users can view tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

-- Admin/Publisher can create tasks
CREATE POLICY "Admin/Publisher can create tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'publisher')
);

-- Admin/Publisher can update tasks
CREATE POLICY "Admin/Publisher can update tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'publisher')
);

-- Admin/Publisher can delete (soft delete) tasks
CREATE POLICY "Admin/Publisher can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'publisher')
);

-- Task assignees RLS policies
CREATE POLICY "Users can view task assignees"
ON public.task_assignees
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin/Publisher can manage task assignees"
ON public.task_assignees
FOR ALL
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'publisher')
);

-- Trigger to update updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;