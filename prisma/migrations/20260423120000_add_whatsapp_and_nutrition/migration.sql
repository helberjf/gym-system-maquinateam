CREATE TYPE "NutritionPlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "student_profiles"
ADD COLUMN "whatsappOptIn" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "nutrition_plans" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "status" "NutritionPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" JSONB NOT NULL,
    "startsAt" DATE,
    "endsAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutrition_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nutrition_plans_studentProfileId_status_idx"
    ON "nutrition_plans"("studentProfileId", "status");

CREATE INDEX "nutrition_plans_createdByUserId_idx"
    ON "nutrition_plans"("createdByUserId");

ALTER TABLE "nutrition_plans"
ADD CONSTRAINT "nutrition_plans_studentProfileId_fkey"
FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nutrition_plans"
ADD CONSTRAINT "nutrition_plans_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "nutrition_plans" ENABLE ROW LEVEL SECURITY;
