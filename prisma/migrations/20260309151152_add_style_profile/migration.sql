-- CreateTable
CREATE TABLE "style_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "preferred_language" TEXT,
    "preferred_orientation" TEXT,
    "preferred_max_screens" INTEGER,
    "detail_level" TEXT NOT NULL DEFAULT 'standard',
    "video_theme" TEXT NOT NULL DEFAULT 'modern',
    "include_annotations" BOOLEAN NOT NULL DEFAULT true,
    "analyzed_pipeline_count" INTEGER NOT NULL DEFAULT 0,
    "last_analyzed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "style_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "style_profiles_user_id_key" ON "style_profiles"("user_id");
