CREATE TABLE "physical_assessments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessedById" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION,
    "heightCm" INTEGER,
    "bodyFatPercent" DOUBLE PRECISION,
    "muscleMassKg" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipCm" DOUBLE PRECISION,
    "leftArmCm" DOUBLE PRECISION,
    "rightArmCm" DOUBLE PRECISION,
    "leftThighCm" DOUBLE PRECISION,
    "rightThighCm" DOUBLE PRECISION,
    "restingHeartRate" INTEGER,
    "bloodPressureSystolic" INTEGER,
    "bloodPressureDiastolic" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "physical_assessments_studentId_assessedAt_idx"
    ON "physical_assessments"("studentId", "assessedAt");

CREATE INDEX "physical_assessments_assessedById_idx"
    ON "physical_assessments"("assessedById");

ALTER TABLE "physical_assessments"
ADD CONSTRAINT "physical_assessments_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "physical_assessments"
ADD CONSTRAINT "physical_assessments_assessedById_fkey"
FOREIGN KEY ("assessedById") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "physical_assessments" ENABLE ROW LEVEL SECURITY;
