-- Add partial unique index on (userId, taskSource) where taskSource IS NOT NULL
-- This allows multiple NULL values (manual tasks) while enforcing uniqueness for auto-created tasks
CREATE UNIQUE INDEX IF NOT EXISTS "Task_userId_taskSource_key"
ON "opportunity_tracker"."Task" ("userId", "taskSource")
WHERE "taskSource" IS NOT NULL;
