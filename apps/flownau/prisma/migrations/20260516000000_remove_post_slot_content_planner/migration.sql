-- Remove PostSlot: all scheduling now lives directly on Post.scheduledAt
DROP TABLE IF EXISTS "PostSlot";

-- Remove ContentPlanner: superseded by PostSchedule-based fill logic
DROP TABLE IF EXISTS "ContentPlanner";
