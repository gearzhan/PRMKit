-- 更新工时表唯一约束，允许同一项目不同阶段的多个记录
-- Update timesheet unique constraint to allow multiple records for same project with different stages

-- 删除旧的唯一约束
DROP INDEX IF EXISTS "timesheets_employeeId_projectId_date_key";

-- 创建新的唯一约束，包含 stageId
CREATE UNIQUE INDEX "timesheets_employeeId_projectId_stageId_date_key" 
ON "timesheets" ("employeeId", "projectId", "stageId", "date");