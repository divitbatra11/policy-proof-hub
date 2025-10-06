-- ONE-TIME DATA CLEANUP - Delete all users and policies (correct order)

-- Delete attestations
DELETE FROM attestations WHERE user_id IN (
  SELECT id FROM profiles WHERE email != 'divitbatra1102@gmail.com'
);

-- Delete assessment results  
DELETE FROM assessment_results WHERE user_id IN (
  SELECT id FROM profiles WHERE email != 'divitbatra1102@gmail.com'
);

-- Delete policy assignments
DELETE FROM policy_assignments WHERE user_id IN (
  SELECT id FROM profiles WHERE email != 'divitbatra1102@gmail.com'
) OR assigned_by IN (
  SELECT id FROM profiles WHERE email != 'divitbatra1102@gmail.com'
);

-- Delete group members
DELETE FROM group_members WHERE user_id IN (
  SELECT id FROM profiles WHERE email != 'divitbatra1102@gmail.com'
);

-- Remove current_version_id references first
UPDATE policies SET current_version_id = NULL;

-- Delete assessments
DELETE FROM assessments;

-- Delete policy versions
DELETE FROM policy_versions;

-- Delete all policies
DELETE FROM policies;

-- Delete all groups
DELETE FROM groups;

-- Delete profiles (except current user)
DELETE FROM profiles WHERE email != 'divitbatra1102@gmail.com';
