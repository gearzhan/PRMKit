/*
  Warnings:

  - You are about to drop the column `department` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `hourlyRate` on the `employees` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ARCHITECT',
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
