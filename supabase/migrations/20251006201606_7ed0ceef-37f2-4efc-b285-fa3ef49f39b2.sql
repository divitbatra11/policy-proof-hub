-- Insert 798 sample policies with actual content
DO $$
DECLARE
  admin_user_id uuid;
  policy_templates jsonb := '[
    {"category": "Information Security", "title": "Password Security Policy", "description": "Requirements for creating and managing secure passwords"},
    {"category": "Information Security", "title": "Data Classification Policy", "description": "Guidelines for classifying and handling organizational data"},
    {"category": "Human Resources", "title": "Code of Conduct", "description": "Expected behaviors and ethical standards for all employees"},
    {"category": "Human Resources", "title": "Expense Reimbursement Policy", "description": "Guidelines for submitting and approving business expenses"},
    {"category": "Data Privacy", "title": "GDPR Compliance Policy", "description": "Compliance with General Data Protection Regulation"},
    {"category": "Workplace Safety", "title": "Emergency Evacuation Procedures", "description": "Steps to follow during emergency evacuations"},
    {"category": "IT Operations", "title": "Acceptable Use Policy", "description": "Proper use of company IT resources and systems"},
    {"category": "Remote Work", "title": "Remote Work Policy", "description": "Guidelines and requirements for remote work arrangements"}
  ]'::jsonb;
  
  template_idx int;
  policy_id uuid;
  version_id uuid;
  policy_count int := 0;
  target_count int := 798;
  template jsonb;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id FROM profiles WHERE email = 'divitbatra1102@gmail.com';
  
  -- Insert policies
  WHILE policy_count < target_count LOOP
    -- Cycle through templates
    template_idx := policy_count % jsonb_array_length(policy_templates);
    template := policy_templates->template_idx;
    
    -- Generate IDs
    policy_id := gen_random_uuid();
    version_id := gen_random_uuid();
    
    -- Insert policy WITHOUT current_version_id first
    INSERT INTO policies (
      id,
      title,
      description,
      category,
      status,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      policy_id,
      (template->>'title') || ' v' || ((policy_count / jsonb_array_length(policy_templates)) + 1),
      template->>'description',
      template->>'category',
      'published',
      admin_user_id,
      now() - (random() * interval '180 days'),
      now() - (random() * interval '90 days')
    );
    
    -- Insert policy version
    INSERT INTO policy_versions (
      id,
      policy_id,
      version_number,
      file_name,
      file_url,
      file_size,
      change_summary,
      published_at,
      published_by,
      created_at
    ) VALUES (
      version_id,
      policy_id,
      1,
      lower(replace(template->>'title', ' ', '_')) || '_v1.pdf',
      '/temp/' || lower(replace(template->>'title', ' ', '_')) || '.pdf',
      50000 + (random() * 100000)::int,
      'Initial version - ' || (template->>'description'),
      now() - (random() * interval '180 days'),
      admin_user_id,
      now() - (random() * interval '180 days')
    );
    
    -- Now update policy with current_version_id
    UPDATE policies SET current_version_id = version_id WHERE id = policy_id;
    
    policy_count := policy_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Created % policies', policy_count;
END $$;