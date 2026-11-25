-- LC Sync — index upgrade for databases created from an earlier schema.sql.
-- Run once in the Supabase SQL Editor. Safe to run more than once.
-- New installs get the same indexes from schema.sql and can skip this file.

-- The extension now finds a saved problem by id, slug or title in a single
-- request: or=(problem_id.eq.…,problem_slug.eq.…,problem_title.eq.…).
-- With every branch indexed, Postgres can combine the indexes instead of
-- scanning the whole table.
CREATE INDEX IF NOT EXISTS idx_submissions_problem_slug  ON public.submissions (problem_slug);
CREATE INDEX IF NOT EXISTS idx_submissions_problem_title ON public.submissions (problem_title);

-- No query filters on these JSONB columns. Postgres still had to update both
-- GIN indexes (one entry per key and value, including saved code) whenever a
-- row was rewritten: saving an alternate approach, editing notes, or marking
-- a problem as revised.
DROP INDEX IF EXISTS public.idx_submissions_page_blocks;
DROP INDEX IF EXISTS public.idx_submissions_alt_codes;
