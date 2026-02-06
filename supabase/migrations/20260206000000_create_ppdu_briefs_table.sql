-- Create ppdu_briefs table
CREATE TABLE public.ppdu_briefs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indices for common queries
CREATE INDEX idx_ppdu_briefs_created_at ON public.ppdu_briefs(created_at);
CREATE INDEX idx_ppdu_briefs_updated_at ON public.ppdu_briefs(updated_at);
CREATE INDEX idx_ppdu_briefs_created_by ON public.ppdu_briefs(created_by);

-- Enable RLS
ALTER TABLE public.ppdu_briefs ENABLE ROW LEVEL SECURITY;

-- PPDU Briefs RLS policies
-- All authenticated users can view ppdu_briefs
CREATE POLICY "Users can view ppdu_briefs"
ON public.ppdu_briefs
FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can create ppdu_briefs
CREATE POLICY "Users can create ppdu_briefs"
ON public.ppdu_briefs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Users can update their own ppdu_briefs
CREATE POLICY "Users can update their own ppdu_briefs"
ON public.ppdu_briefs
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by OR auth.uid() = updated_by);

-- Trigger to update updated_at
CREATE TRIGGER update_ppdu_briefs_updated_at
BEFORE UPDATE ON public.ppdu_briefs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for ppdu_briefs
ALTER PUBLICATION supabase_realtime ADD TABLE public.ppdu_briefs;
