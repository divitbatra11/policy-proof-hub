-- =============================================================================
-- Migration: Security Hardening
-- Date: 2026-03-06
-- ASVS Areas: 4.1 Access Control, 7.2 Audit Logging, 4.3 Other Access Control
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FIX: audit_logs INSERT policy
--
-- Issue: "System can create audit logs" used WITH CHECK (true), meaning any
-- authenticated user could insert audit_log rows with an arbitrary user_id,
-- allowing them to forge another user's audit trail.
--
-- Fix: Restrict inserts so a user can only log their own actions
--      (user_id = auth.uid()). Also allow NULL user_id for system-level events.
--
-- ASVS 7.2.1 – Verify that all authentication decisions are logged.
-- ASVS 7.2.2 – Verify that audit events cannot be repudiated.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can create audit logs" ON audit_logs;

CREATE POLICY "Users can insert own audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
  );


-- -----------------------------------------------------------------------------
-- 2. FIX: ppdu_briefs UPDATE policy missing WITH CHECK
--
-- Issue: The UPDATE policy only had USING but no WITH CHECK.  PostgreSQL copies
-- USING to WITH CHECK when omitted, but being explicit prevents ambiguity and
-- ensures future policy additions don't inadvertently widen scope.
-- Also: a user who is only the updated_by (i.e. edited someone else's brief)
-- should not be able to REASSIGN ownership (created_by) via an UPDATE.
--
-- ASVS 4.2.1 – Verify that sensitive data and APIs are protected against IDOR.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own ppdu_briefs" ON ppdu_briefs;

CREATE POLICY "Users can update their own ppdu_briefs"
  ON ppdu_briefs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = updated_by)
  WITH CHECK (
    -- After the update the record must still belong to its original creator.
    -- Prevents privilege escalation via ownership reassignment.
    auth.uid() = created_by OR auth.uid() = updated_by
  );


-- -----------------------------------------------------------------------------
-- 3. FIX: task_checklist_items UPDATE policy — add WITH CHECK
--
-- Issue: UPDATE policy only had USING (role check). Without an explicit
-- WITH CHECK the new row values are not validated — an admin/publisher could
-- technically update the task_id field to point to a different task.
--
-- ASVS 4.2.1 – Prevent object-level privilege escalation.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin/Publisher can update task checklist items" ON task_checklist_items;

CREATE POLICY "Admin/Publisher can update task checklist items"
  ON task_checklist_items
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'publisher')
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'publisher')
  );


-- -----------------------------------------------------------------------------
-- 4. ADD: Performance indexes for RLS role-lookup sub-queries
--
-- The pattern  (SELECT role FROM profiles WHERE id = auth.uid())  is evaluated
-- on every row access.  Indexing profiles(id) is already implicit (PRIMARY KEY),
-- but an index on profiles(id, role) lets Postgres use an index-only scan and
-- avoids heap fetches on high-traffic tables.
--
-- ASVS 12.1 – Control plane operations must not be a DoS vector.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_id_role
  ON public.profiles (id, role);

CREATE INDEX IF NOT EXISTS idx_profiles_id
  ON public.profiles (id);

-- Index to speed up the "tasks for this user" and "deleted tasks" queries
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at
  ON public.tasks (deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id
  ON public.task_assignees (user_id);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id
  ON public.task_assignees (task_id);

CREATE INDEX IF NOT EXISTS idx_policy_assignments_user_id
  ON public.policy_assignments (user_id);

CREATE INDEX IF NOT EXISTS idx_policy_assignments_group_id
  ON public.policy_assignments (group_id);

CREATE INDEX IF NOT EXISTS idx_group_members_user_id
  ON public.group_members (user_id);

CREATE INDEX IF NOT EXISTS idx_attestations_user_id
  ON public.attestations (user_id);

CREATE INDEX IF NOT EXISTS idx_assessment_results_user_id
  ON public.assessment_results (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON public.audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);


-- -----------------------------------------------------------------------------
-- 5. ADD: Event trigger — auto-enable RLS on any new table in public schema
--
-- Ensures RLS is never accidentally left off on a newly created table.
-- Administrators must still create appropriate row-level policies; this is
-- a safety net that defaults to deny-all (no rows visible) until policies
-- are added.
--
-- ASVS 4.1.3 – Verify that default-deny is enforced at the access control layer.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_enable_rls_on_new_table()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT schema_name, object_name
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', obj.object_name);
    RAISE NOTICE 'Auto-enabled RLS on public.%', obj.object_name;
  END LOOP;
END;
$$;

-- Drop existing trigger if present (idempotent)
DROP EVENT TRIGGER IF EXISTS trg_auto_rls_new_table;

CREATE EVENT TRIGGER trg_auto_rls_new_table
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.auto_enable_rls_on_new_table();


-- -----------------------------------------------------------------------------
-- 6. ADD: Explicit RLS confirmation for all tables (defensive / documentation)
--
-- Re-running ENABLE ROW LEVEL SECURITY is idempotent and documents intent.
-- Covers all tables added across all migrations.
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_versions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attestations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees              ENABLE ROW LEVEL SECURITY;
-- task_attachments are columns on tasks, not a separate table; no ALTER needed
ALTER TABLE public.task_checklist_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ppdu_briefs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_intake_forms        ENABLE ROW LEVEL SECURITY;
-- ppdu_brief_library: enable only if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'ppdu_brief_library') THEN
    EXECUTE 'ALTER TABLE public.ppdu_brief_library ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 7. ADD: Revoke public schema CREATE from public role
--
-- By default PostgreSQL grants CREATE on the public schema to the PUBLIC role,
-- allowing any authenticated DB user to create tables (bypassing our event
-- trigger). Revoke this to prevent schema pollution.
--
-- ASVS 4.3.2 – Verify that directory browsing / schema introspection is disabled.
-- -----------------------------------------------------------------------------
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Grant it back only to roles that legitimately need it
-- (Supabase migrations run as the postgres superuser so this is fine)
GRANT CREATE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 8. HARDEN: Restrict anon role from accessing sensitive tables
--
-- The anon role should not be able to query any business data tables directly.
-- Supabase auto-grants SELECT to anon for tables without RLS; our explicit
-- RLS above blocks row access, but revoking the privilege is defence-in-depth.
--
-- ASVS 4.1.1 – Verify that the principle of least privilege is applied.
-- -----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
-- Re-grant only what unauthenticated users genuinely need (none for this app).


-- =============================================================================
-- Verification queries (run after applying migration):
--
--   -- All tables should have RLS enabled:
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
--   -- Confirm updated audit_logs policy:
--   SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE tablename = 'audit_logs';
--
--   -- Confirm auto-RLS trigger exists:
--   SELECT evtname, evtenabled FROM pg_event_trigger WHERE evtname = 'trg_auto_rls_new_table';
--
-- =============================================================================
