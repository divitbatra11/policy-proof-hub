-- Add multiple versions to each policy to showcase version control

-- Remote Work Policy - Add versions 2 and 3
INSERT INTO policy_versions (
  id,
  policy_id,
  version_number,
  file_name,
  file_url,
  file_size,
  change_summary,
  published_at,
  published_by
) VALUES 
(
  '30000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000001',
  2,
  'remote_work_v2.pdf',
  'https://objkmarvzsqqukzhtlda.supabase.co/storage/v1/object/public/policy-documents/remote_work_v2.pdf',
  267000,
  'Updated remote work hours policy to include flexible scheduling options and clarified equipment reimbursement procedures.',
  '2025-10-15T10:00:00Z',
  '4e68283d-e3f5-4ab7-a680-c488e633efd5'
),
(
  '30000000-0000-0000-0000-000000000005',
  '20000000-0000-0000-0000-000000000001',
  3,
  'remote_work_v3.pdf',
  'https://objkmarvzsqqukzhtlda.supabase.co/storage/v1/object/public/policy-documents/remote_work_v3.pdf',
  289000,
  'Added hybrid work model guidelines, updated cybersecurity requirements for home networks, and expanded section on international remote work considerations.',
  '2025-12-20T14:30:00Z',
  '4e68283d-e3f5-4ab7-a680-c488e633efd5'
);

-- Data Security Policy - Add versions 2 and 3
INSERT INTO policy_versions (
  id,
  policy_id,
  version_number,
  file_name,
  file_url,
  file_size,
  change_summary,
  published_at,
  published_by
) VALUES 
(
  '30000000-0000-0000-0000-000000000006',
  '20000000-0000-0000-0000-000000000002',
  2,
  'data_security_v2.pdf',
  'https://objkmarvzsqqukzhtlda.supabase.co/storage/v1/object/public/policy-documents/data_security_v2.pdf',
  543000,
  'Enhanced encryption standards to AES-256, added multi-factor authentication requirements, and updated incident response procedures.',
  '2025-09-10T09:00:00Z',
  '4e68283d-e3f5-4ab7-a680-c488e633efd5'
),
(
  '30000000-0000-0000-0000-000000000007',
  '20000000-0000-0000-0000-000000000002',
  3,
  'data_security_v3.pdf',
  'https://objkmarvzsqqukzhtlda.supabase.co/storage/v1/object/public/policy-documents/data_security_v3.pdf',
  578000,
  'Updated to comply with GDPR and CCPA requirements, added data classification framework, strengthened password policies, and included AI/ML data handling guidelines.',
  '2025-11-05T11:15:00Z',
  '4e68283d-e3f5-4ab7-a680-c488e633efd5'
);

-- Code of Conduct - Add version 2
INSERT INTO policy_versions (
  id,
  policy_id,
  version_number,
  file_name,
  file_url,
  file_size,
  change_summary,
  published_at,
  published_by
) VALUES 
(
  '30000000-0000-0000-0000-000000000008',
  '20000000-0000-0000-0000-000000000003',
  2,
  'code_of_conduct_v2.pdf',
  'https://objkmarvzsqqukzhtlda.supabase.co/storage/v1/object/public/policy-documents/code_of_conduct_v2.pdf',
  412000,
  'Expanded anti-harassment policies, added social media guidelines, updated conflict of interest disclosures, and included DEI commitments.',
  '2025-10-01T13:00:00Z',
  '4e68283d-e3f5-4ab7-a680-c488e633efd5'
);

-- Expense Reimbursement - Add versions 1, 2, and 3
INSERT INTO policy_versions (
  id,
  policy_id,
  version_number,
  file_name,
  file_url,
  file_size,
  change_summary,
  published_at,
  published_by
) VALUES 
(
  '30000000-0000-0000-0000-000000000009',
  '20000000-0000-0000-0000-000000000004',
  1,
  'expense_reimbursement_v1.pdf',
  'https://objkmarvzsqqukzhtlda.supabase.co/storage/v1/object/public/policy-documents/expense_reimbursement_v1.pdf',
  198000,
  'Initial expense reimbursement policy covering travel, meals, and office supplies.',
  '2025-06-15T10:00:00Z',
  '4e68283d-e3f5-4ab7-a680-c488e633efd5'
),
(
  '30000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000004',
  2,
  'expense_reimbursement_v2.pdf',
  'https://objkmarvzsqqukzhtlda.supabase.co/storage/v1/object/public/policy-documents/expense_reimbursement_v2.pdf',
  215000,
  'Increased daily meal allowance, added remote work equipment budget, and streamlined approval process for expenses under $500.',
  '2025-09-20T14:00:00Z',
  '4e68283d-e3f5-4ab7-a680-c488e633efd5'
),
(
  '30000000-0000-0000-0000-000000000011',
  '20000000-0000-0000-0000-000000000004',
  3,
  'expense_reimbursement_v3.pdf',
  'https://objkmarvzsqqukzhtlda.supabase.co/storage/v1/object/public/policy-documents/expense_reimbursement_v3.pdf',
  234000,
  'Added corporate credit card program, updated international travel per diem rates, included wellness and professional development expense categories.',
  '2025-12-10T16:30:00Z',
  '4e68283d-e3f5-4ab7-a680-c488e633efd5'
);

-- Update policies to point to their latest versions
UPDATE policies 
SET current_version_id = '30000000-0000-0000-0000-000000000005',
    status = 'published'
WHERE id = '20000000-0000-0000-0000-000000000001';

UPDATE policies 
SET current_version_id = '30000000-0000-0000-0000-000000000007',
    status = 'published'
WHERE id = '20000000-0000-0000-0000-000000000002';

UPDATE policies 
SET current_version_id = '30000000-0000-0000-0000-000000000008',
    status = 'published'
WHERE id = '20000000-0000-0000-0000-000000000003';

UPDATE policies 
SET current_version_id = '30000000-0000-0000-0000-000000000011',
    status = 'published'
WHERE id = '20000000-0000-0000-0000-000000000004';