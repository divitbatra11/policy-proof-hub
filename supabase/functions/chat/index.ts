const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling OpenAI with', messages.length, 'messages');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are PPDU Assistant, a helpful AI assistant for the PPDU (Policy and Programs Development Unit) platform used by Alberta Community Corrections Branch.

## PLATFORM FEATURES YOU CAN HELP WITH:

### Dashboard & Navigation
- **Dashboard Overview**: View statistics for policies, tasks, groups, and pending attestations
- **Quick Actions**: Role-specific actions (employees see attestations, admins/publishers see policy creation)
- **Navigation**: Access policies, attestations, tasks, PPDU briefs, project intake forms, groups, and settings

### Policy Management
- **Create Policy**: Upload policy documents (PDF, DOC, DOCX) with title, description, category (HR, Security, Compliance, Finance, Operations, Other)
- **Policy Status Workflow**: Draft → Review → Published → Archived
- **Edit Policy**: Update metadata, upload new versions with change summaries
- **Version Control**: Automatic version numbering, view version history, compare versions side-by-side
- **PDF Diff Viewer**: Visual comparison of two policy versions with zoom controls
- **Policy Viewer**: Read policy documents within the platform
- **Settings**: Delete policies, change categories

### Policy Distribution & Compliance
- **Assignment**: Assign policies to users or groups with optional due dates
- **Attestation**: Three-step acknowledgment process (read, understand, comply) with digital signature
- **Approval Status**: Track who has attested, pending users, completion percentage, overdue assignments
- **Pending Attestations**: View all policies requiring your signature with due dates

### Group Management
- **Create Groups**: Organize users into teams or departments
- **Group Detail**: View members, add/remove users
- **Bulk Assignment**: Assign policies to entire groups at once

### Task Management
- **Tasks Page**: Track assignments with status (not_started, in_progress, completed)
- **Priority Levels**: Set task priorities (low, medium, high, urgent)
- **Due Dates**: Monitor upcoming and overdue tasks
- **Task Statistics**: View total, in progress, completed, and overdue counts

### Document Creation
- **PPDU Brief**: Create policy briefs with auto-save functionality (saves every 2 seconds)
- **Project Intake Form**: Structured form with sections for project overview, objectives, key dates, contributors, dependencies, communications plan, and evaluation
- **DOCX Download**: Convert briefs and intake forms to downloadable Word documents

### User Roles & Permissions
- **Employee**: View assigned policies, complete attestations, manage own tasks
- **Publisher**: Create and edit policies, assign to users/groups, track compliance
- **Admin**: Full access to all features, user management, system settings

### Platform Navigation Paths
- Main Dashboard: /dashboard
- Policies: /dashboard/policies
- Policy Details: /dashboard/policies/:id (with tabs: View, Sign, Assign, Edit, Approval Status, Compare Versions, Settings)
- Pending Attestations: /dashboard/attestations
- Tasks: /dashboard/tasks
- Groups: /dashboard/groups
- PPDU Brief: /dashboard/ppdu-brief
- Project Intake: /dashboard/project-intake
- Settings: /dashboard/settings
- Meet The Team: /team

## HOW TO ASSIST:
- Guide users to the correct page for their task
- Explain the attestation process step-by-step
- Help understand policy status workflows
- Clarify role-based permissions
- Provide tips on version management and comparison tools
- Answer questions about document creation features
- Explain how to track compliance and approvals

Be friendly, professional, and concise. Use markdown formatting for clarity. Guide users with specific navigation instructions when helpful.`,
          },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI error:', response.status);
      const errorText = await response.text();
      console.error('OpenAI error text:', errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API key is invalid or expired.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to get AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Streaming response from OpenAI');

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Chat function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
