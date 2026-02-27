-- PPDU Brief Library — stores saved snapshots of PPDU briefs.
CREATE TABLE public.ppdu_brief_library (
    id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title       TEXT NOT NULL,
    content     TEXT,
    notes       TEXT,
    saved_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_ppdu_brief_library_created_at ON public.ppdu_brief_library(created_at);
CREATE INDEX idx_ppdu_brief_library_saved_by   ON public.ppdu_brief_library(saved_by);

-- Enable RLS
ALTER TABLE public.ppdu_brief_library ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read library entries
CREATE POLICY "Users can view ppdu_brief_library"
ON public.ppdu_brief_library FOR SELECT TO authenticated
USING (true);

-- Authenticated users can save (insert) their own entries
CREATE POLICY "Users can insert ppdu_brief_library"
ON public.ppdu_brief_library FOR INSERT TO authenticated
WITH CHECK (auth.uid() = saved_by);

-- Creator or admin can delete entries
CREATE POLICY "Creator or admin can delete ppdu_brief_library"
ON public.ppdu_brief_library FOR DELETE TO authenticated
USING (
    saved_by = auth.uid() OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ppdu_brief_library;
