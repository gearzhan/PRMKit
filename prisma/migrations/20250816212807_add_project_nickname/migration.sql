/*
  Warnings:

  - You are about to drop the `budgets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `budget` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `budget` on the `stages` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `stages` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `stages` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `stages` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `stages` table. All the data in the column will be lost.
  - Added the required column `category` to the `stages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `taskId` to the `stages` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "project_members_projectId_employeeId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "budgets";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "project_members";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'DIRECTOR',
    "position" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_employees" ("createdAt", "email", "employeeId", "id", "isActive", "name", "password", "position", "role", "updatedAt") SELECT "createdAt", "email", "employeeId", "id", "isActive", "name", "password", "position", "role", "updatedAt" FROM "employees";
DROP TABLE "employees";
ALTER TABLE "new_employees" RENAME TO "employees";
CREATE UNIQUE INDEX "employees_employeeId_key" ON "employees"("employeeId");
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");
CREATE TABLE "new_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nickname" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_projects" ("createdAt", "description", "endDate", "id", "name", "projectCode", "startDate", "status", "updatedAt") SELECT "createdAt", "description", "endDate", "id", "name", "projectCode", "startDate", "status", "updatedAt" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE UNIQUE INDEX "projects_projectCode_key" ON "projects"("projectCode");
CREATE TABLE "new_stages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_stages" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "stages";
DROP TABLE "stages";
ALTER TABLE "new_stages" RENAME TO "stages";
CREATE UNIQUE INDEX "stages_taskId_key" ON "stages"("taskId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
