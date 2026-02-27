import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  'https://dev.ppdu.int.gov.ab.ca',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:5173',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonError(req: Request, status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
interface JWTPayload {
  sub?: string;
  role?: string;
  exp?: number;
  email?: string;
}

/**
 * Decode a Supabase JWT payload without making any network call.
 * We check: valid format, authenticated role (not anon), not expired.
 * The Supabase gateway already verified the apikey header, so we only
 * need to confirm this is a real signed-in user token, not the anon key.
 */
function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64url → Base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    return JSON.parse(atob(padded)) as JWTPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  board_column: string | null;
  tags: string[] | null;
  assignees?: { user?: { full_name?: string | null } | null }[] | null;
}

interface PolicyRow {
  id: string;
  title: string;
  status: string;
  category: string | null;
}

interface ProfileRow {
  full_name: string | null;
  email: string | null;
  role: string | null;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------
function buildSystemPrompt(
  profile: ProfileRow | null,
  tasks: TaskRow[],
  policies: PolicyRow[],
  now: Date
): string {
  const todayStr = now.toISOString().split('T')[0];

  const tasksDueToday = tasks.filter(
    (t) => t.due_date?.startsWith(todayStr) && t.status !== 'completed'
  );
  const overdueTasks = tasks.filter(
    (t) => t.due_date && t.due_date < todayStr && t.status !== 'completed'
  );

  const taskLines = tasks
    .map((t) => {
      const assignees =
        t.assignees?.map((a) => a.user?.full_name).filter(Boolean).join(', ') || 'Unassigned';
      return `- [${t.status.toUpperCase()}][${t.priority.toUpperCase()}] "${t.title}" | Due: ${t.due_date ?? 'none'} | Assignees: ${assignees} | Column: ${t.board_column ?? 'General'}`;
    })
    .join('\n');

  const policyLines = policies
    .map((p) => `- [${p.status.toUpperCase()}] "${p.title}" | Category: ${p.category ?? 'N/A'}`)
    .join('\n');

  const dateLabel = now.toLocaleDateString('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `You are APEX Assistant, the AI assistant for the APEX (Alberta Policy EXchange) platform used by Alberta Community Corrections Branch — Policy and Programs Development Unit (PPDU).

## LIVE APP DATA (as of ${dateLabel}, Mountain Time)

### Current User
- Name: ${profile?.full_name ?? 'Unknown'}
- Email: ${profile?.email ?? 'Unknown'}
- Role: ${profile?.role ?? 'employee'}

### Task Statistics
- Total Active Tasks: ${tasks.length}
- Due Today: ${tasksDueToday.length}
- Overdue: ${overdueTasks.length}
- Not Started: ${tasks.filter((t) => t.status === 'not_started').length}
- In Progress: ${tasks.filter((t) => t.status === 'in_progress').length}
- Completed: ${tasks.filter((t) => t.status === 'completed').length}

### All Tasks (${tasks.length})
${taskLines || 'No tasks found.'}

### Policies (${policies.length} total)
${policyLines || 'No policies found.'}

---

## HOW TO USE LIVE DATA
When answering data questions, use the LIVE APP DATA above directly:
- "How many tasks are due today?" → use the Due Today count
- "Tasks for [name]?" → filter All Tasks by Assignees
- "Overdue tasks?" → use the Overdue count
- "Policies in review?" → filter Policies by [REVIEW]
- "Tasks assigned to me?" → match Current User name against Assignees
- Always cite specific titles when relevant. State clearly when nothing matches.

## PLATFORM FEATURES

### Policy Management
- Create: Upload PDF/DOC/DOCX. Categories: HR, Security, Compliance, Finance, Operations, Other
- Workflow: Draft → Review → Published → Archived
- Version control with side-by-side PDF diff viewer
- Assign to users or groups with due dates
- Attestation: read + understand + comply, digital signature

### Task Management
- Status: not_started, in_progress, completed | Priority: low, medium, high
- Kanban board columns, due dates, tags, attachments, checklists
- Assign to multiple team members

### Document Creation
- PPDU Brief: collaborative editor with auto-save
- Project Intake Form: structured form with DOCX export → Project Library

### User Roles
- Employee: view assigned policies, complete attestations, own tasks
- Publisher: create/edit policies, assign, track compliance
- Admin: full access + user management

### Navigation
/dashboard | /dashboard/policies | /dashboard/attestations | /dashboard/tasks
/dashboard/groups | /dashboard/ppdu-brief | /dashboard/ppdu-brief-library
/dashboard/project-intake | /dashboard/project-library | /dashboard/settings

Be friendly, professional, concise. Use markdown. Give navigation paths when helpful.`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonError(req, 405, 'Method not allowed');
  }

  // ── 1. Auth: decode JWT, confirm it's a signed-in user ───────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(req, 401, 'Missing Authorization header');
  }
  const token = authHeader.slice(7).trim();

  const payload = decodeJWT(token);
  if (!payload) {
    return jsonError(req, 401, 'Malformed token');
  }
  // Reject the anon key and any expired token
  if (payload.role !== 'authenticated') {
    return jsonError(req, 401, 'Sign in required');
  }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return jsonError(req, 401, 'Session expired. Please sign in again.');
  }
  if (!payload.sub) {
    return jsonError(req, 401, 'Invalid token: missing subject');
  }
  const userId = payload.sub;

  // ── 2. Parse & sanitise body ──────────────────────────────────────────────
  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(req, 400, 'Invalid JSON body');
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError(req, 400, 'messages must be a non-empty array');
  }

  const messages = (body.messages as { role: string; content: string }[])
    .slice(-20)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: typeof m.content === 'string' ? m.content.slice(0, 500) : '',
    }))
    .filter((m) => m.content.length > 0);

  if (messages.length === 0) {
    return jsonError(req, 400, 'No valid messages');
  }

  // ── 3. Fetch live context from DB ─────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [profileResult, tasksResult, policiesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, role')
      .eq('id', userId)
      .single(),

    supabase
      .from('tasks')
      .select(`
        id, title, status, priority, due_date, board_column, tags,
        assignees:task_assignees(
          user:profiles!task_assignees_user_id_fkey(full_name)
        )
      `)
      .is('deleted_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(150),

    supabase
      .from('policies')
      .select('id, title, status, category')
      .order('updated_at', { ascending: false })
      .limit(100),
  ]);

  const profile = profileResult.data as ProfileRow | null;
  const tasks = (tasksResult.data ?? []) as TaskRow[];
  const policies = (policiesResult.data ?? []) as PolicyRow[];

  // ── 4. Build system prompt ────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(profile, tasks, policies, new Date());

  // ── 5. Stream from OpenAI ─────────────────────────────────────────────────
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    return jsonError(req, 500, 'AI service is not configured');
  }

  const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!openAIResponse.ok) {
    const status = openAIResponse.status;
    const errorBody = await openAIResponse.text();
    console.error(`OpenAI error ${status}:`, errorBody);
    if (status === 429) return jsonError(req, 429, 'Rate limit exceeded. Try again shortly.');
    return new Response(
      JSON.stringify({ error: `OpenAI error ${status}`, detail: errorBody }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }

  return new Response(openAIResponse.body, {
    headers: { ...getCorsHeaders(req), 'Content-Type': 'text/event-stream' },
  });
});
