/*
  Warnings:

  - You are about to drop the column `stage` on the `projects` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nickname" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_projects" ("createdAt", "description", "endDate", "id", "name", "nickname", "projectCode", "startDate", "status", "updatedAt") SELECT "createdAt", "description", "endDate", "id", "name", "nickname", "projectCode", "startDate", "status", "updatedAt" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE UNIQUE INDEX "projects_projectCode_key" ON "projects"("projectCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
