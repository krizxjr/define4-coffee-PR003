-- Open Attic per-user data isolation migration (PostgreSQL / Supabase)
-- Run in Supabase SQL Editor BEFORE restarting the owner-scoped Flask backend.
-- Safe to re-run. Existing records remain unassigned (owner_id NULL) until you
-- deliberately claim them for an account using the optional backfill at the end.

BEGIN;

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS owner_id VARCHAR(36);
ALTER TABLE topics ADD COLUMN IF NOT EXISTS owner_id VARCHAR(36);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS owner_id VARCHAR(36);

-- Remove the old global subject-name uniqueness, since different users may
-- independently create a subject with the same name.
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_name_key;
DROP INDEX IF EXISTS ix_subjects_name;
-- Keep the non-unique lookup index expected by the application model.
CREATE INDEX IF NOT EXISTS ix_subjects_name ON subjects(name);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_subject_owner_name'
      AND conrelid = 'subjects'::regclass
  ) THEN
    ALTER TABLE subjects
      ADD CONSTRAINT uq_subject_owner_name UNIQUE (owner_id, name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_subjects_owner_id ON subjects(owner_id);
CREATE INDEX IF NOT EXISTS ix_topics_owner_id ON topics(owner_id);
CREATE INDEX IF NOT EXISTS ix_resources_owner_id ON resources(owner_id);

-- Repair ownership chains where a previous partial migration already assigned
-- a parent owner. These statements do not expose or assign currently-unowned
-- legacy records by themselves.
UPDATE topics AS t
SET owner_id = s.owner_id
FROM subjects AS s
WHERE t.subject_id = s.id
  AND s.owner_id IS NOT NULL
  AND t.owner_id IS DISTINCT FROM s.owner_id;

UPDATE resources AS r
SET owner_id = t.owner_id
FROM topics AS t
WHERE r.topic_id = t.id
  AND t.owner_id IS NOT NULL
  AND r.owner_id IS DISTINCT FROM t.owner_id;

COMMIT;

-- OPTIONAL: to transfer all pre-existing library records to your first account,
-- replace YOUR_SUPABASE_AUTH_USER_UUID with that user's id from Supabase
-- Authentication -> Users, then run these statements separately in SQL Editor:
--
-- UPDATE subjects SET owner_id = 'YOUR_SUPABASE_AUTH_USER_UUID' WHERE owner_id IS NULL;
-- UPDATE topics t SET owner_id = s.owner_id
--   FROM subjects s WHERE t.subject_id = s.id AND t.owner_id IS NULL;
-- UPDATE resources r SET owner_id = t.owner_id
--   FROM topics t WHERE r.topic_id = t.id AND r.owner_id IS NULL;
--
-- Only do this if all legacy content should belong to that one account. If some
-- records belong to different users, assign each group explicitly instead.
