-- Verify SecCompanyCache table exists and has correct structure

-- Check table exists
SELECT COUNT(*) as table_exists
FROM information_schema.tables
WHERE table_schema = 'opportunity_tracker'
  AND table_name = 'SecCompanyCache';

-- Check columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'opportunity_tracker'
  AND table_name = 'SecCompanyCache'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'opportunity_tracker'
  AND tablename = 'SecCompanyCache';

-- Check row count (should be 0 or ~13,000 if already populated)
SELECT COUNT(*) as total_rows
FROM "opportunity_tracker"."SecCompanyCache";
