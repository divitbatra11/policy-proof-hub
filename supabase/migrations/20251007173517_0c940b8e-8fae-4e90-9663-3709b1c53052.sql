-- Step 1: Create a mapping of base policy names to keep the most recent policy record
-- We'll consolidate all policies with the same base name (without version numbers)

-- First, let's create a temporary table to track which policy IDs to keep
CREATE TEMP TABLE policy_consolidation AS
WITH base_policies AS (
  -- Extract base policy names by removing version numbers
  SELECT 
    id,
    REGEXP_REPLACE(title, '\s+v\d+$', '', 'i') AS base_title,
    title,
    description,
    category,
    status,
    created_by,
    created_at,
    updated_at,
    -- Rank policies by creation date (most recent first)
    ROW_NUMBER() OVER (
      PARTITION BY REGEXP_REPLACE(title, '\s+v\d+$', '', 'i')
      ORDER BY created_at DESC
    ) AS rn
  FROM policies
)
SELECT 
  id AS keep_policy_id,
  base_title,
  ARRAY_AGG(id) AS all_policy_ids
FROM base_policies
WHERE rn = 1
GROUP BY id, base_title;

-- Step 2: Update policy_versions to point to the consolidated policy
-- For each version that belongs to a policy that will be deleted, update it to point to the kept policy
UPDATE policy_versions pv
SET policy_id = pc.keep_policy_id
FROM policy_consolidation pc
WHERE pv.policy_id = ANY(pc.all_policy_ids)
  AND pv.policy_id != pc.keep_policy_id;

-- Step 3: Update the kept policies to have the base title (without version numbers)
UPDATE policies p
SET title = pc.base_title
FROM policy_consolidation pc
WHERE p.id = pc.keep_policy_id
  AND p.title != pc.base_title;

-- Step 4: Update policy_assignments to point to the consolidated policy
UPDATE policy_assignments pa
SET policy_id = pc.keep_policy_id
FROM policy_consolidation pc
WHERE pa.policy_id = ANY(pc.all_policy_ids)
  AND pa.policy_id != pc.keep_policy_id;

-- Step 5: Update assessments to point to the consolidated policy
UPDATE assessments a
SET policy_id = pc.keep_policy_id
FROM policy_consolidation pc
WHERE a.policy_id = ANY(pc.all_policy_ids)
  AND a.policy_id != pc.keep_policy_id;

-- Step 6: Delete duplicate policy records (keeping only the consolidated ones)
DELETE FROM policies
WHERE id NOT IN (SELECT keep_policy_id FROM policy_consolidation);