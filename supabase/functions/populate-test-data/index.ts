import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Policy categories and sample titles
const policyCategories = [
  'Code of Conduct',
  'Data Security',
  'Remote Work',
  'Expense Reimbursement',
  'Leave Policy',
  'Health & Safety',
  'IT Security',
  'Procurement',
  'Training & Development',
  'Performance Management',
  'Client Relations',
  'Conflict of Interest',
  'Confidentiality',
  'Workplace Harassment',
  'Emergency Procedures'
]

const generatePolicyTitle = (index: number, category: string) => {
  return `${category} Policy - Version ${Math.floor(index / policyCategories.length) + 1}`
}

const generatePolicyDescription = (category: string) => {
  return `This policy outlines the guidelines and procedures for ${category.toLowerCase()} within the organization. All employees must review and acknowledge this policy.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Starting user population...')

    // Get existing groups
    const { data: existingGroups, error: groupsError } = await supabaseAdmin
      .from('groups')
      .select('*')
      .in('name', ['Directors', 'Executive Directors', 'Admin', 'SPO', 'PO'])
    
    if (groupsError) throw groupsError
    
    if (!existingGroups || existingGroups.length === 0) {
      throw new Error('Groups not found. Please create the groups first.')
    }

    console.log(`Found ${existingGroups.length} groups`)

    // Map groups to their user counts
    const groupConfig = [
      { name: 'Directors', userCount: 15 },
      { name: 'Executive Directors', userCount: 5 },
      { name: 'Admin', userCount: 20 },
      { name: 'SPO', userCount: 50 },
      { name: 'PO', userCount: 250 }
    ]

    const groupsWithCounts = existingGroups.map(group => {
      const config = groupConfig.find(g => g.name === group.name)
      return { ...group, userCount: config?.userCount || 0 }
    })

    // Create Users and assign to groups
    console.log('Creating users...')
    let userIndex = 1
    const allUserIds: string[] = []

    for (const group of groupsWithCounts) {
      const userIds: string[] = []
      
      for (let i = 0; i < group.userCount; i++) {
        const email = `user${userIndex}@apex-demo.com`
        const password = 'Demo123!'
        const fullName = `${group.name} User ${i + 1}`
        
        // Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName
          }
        })

        if (authError) {
          // If user already exists, fetch their ID instead of failing
          if (authError.message?.includes('already been registered')) {
            console.log(`User ${email} already exists, fetching ID...`)
            const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
            const foundUser = existingUser.users.find(u => u.email === email)
            if (foundUser) {
              userIds.push(foundUser.id)
              allUserIds.push(foundUser.id)
              
              // Update profile for existing user
              await supabaseAdmin
                .from('profiles')
                .update({
                  full_name: fullName,
                  department: group.name,
                  role: group.name === 'Admin' ? 'admin' : 'employee'
                })
                .eq('id', foundUser.id)
            }
            userIndex++
            continue
          }
          console.error(`Error creating user ${email}:`, authError)
          userIndex++
          continue
        }

        const userId = authData.user.id
        userIds.push(userId)
        allUserIds.push(userId)

        // Update profile
        await supabaseAdmin
          .from('profiles')
          .update({
            full_name: fullName,
            department: group.name,
            role: group.name === 'Admin' ? 'admin' : 'employee'
          })
          .eq('id', userId)

        userIndex++
        
        if (userIndex % 10 === 0) {
          console.log(`Created ${userIndex} users...`)
        }
      }

      // Add users to group
      const groupMembers = userIds.map(userId => ({
        group_id: group.id,
        user_id: userId
      }))

      const { error: memberError } = await supabaseAdmin
        .from('group_members')
        .insert(groupMembers)

      if (memberError) throw memberError
      console.log(`Added ${userIds.length} members to ${group.name}`)
    }

    console.log(`Total users created: ${allUserIds.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Users populated successfully',
        stats: {
          users: allUserIds.length
        },
        loginInfo: {
          message: 'You can login with any user. All passwords are: Demo123!',
          exampleUsers: [
            'user1@apex-demo.com (Directors)',
            'user16@apex-demo.com (Executive Directors)',
            'user21@apex-demo.com (Admin)',
            'user41@apex-demo.com (SPO)',
            'user91@apex-demo.com (PO)'
          ]
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
