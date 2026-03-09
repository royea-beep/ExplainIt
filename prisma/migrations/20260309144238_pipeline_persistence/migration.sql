/*
  Warnings:

  - Added the required column `updated_at` to the `pipelines` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pipelines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'intake',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL DEFAULT '',
    "current_agent" TEXT NOT NULL DEFAULT '',
    "input" TEXT NOT NULL DEFAULT '{}',
    "result" TEXT,
    "error" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pipelines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_pipelines" ("created_at", "id", "user_id") SELECT "created_at", "id", "user_id" FROM "pipelines";
DROP TABLE "pipelines";
ALTER TABLE "new_pipelines" RENAME TO "pipelines";
CREATE INDEX "pipelines_user_id_idx" ON "pipelines"("user_id");
CREATE INDEX "pipelines_user_id_created_at_idx" ON "pipelines"("user_id", "created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
