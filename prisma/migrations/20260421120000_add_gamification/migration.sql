-- CreateEnum
CREATE TYPE "BadgeRequirementType" AS ENUM ('TOTAL_POINTS', 'CHECKIN_COUNT', 'CURRENT_STREAK', 'ASSESSMENT_COUNT');

-- CreateEnum
CREATE TYPE "GamificationAction" AS ENUM ('CHECKIN', 'STREAK_BONUS', 'ASSESSMENT', 'MANUAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE "student_gamification" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "checkinCount" INTEGER NOT NULL DEFAULT 0,
    "assessmentCount" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_gamification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_gamification_studentId_key" ON "student_gamification"("studentId");

-- CreateTable
CREATE TABLE "gamification_badges" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconName" TEXT,
    "requirementType" "BadgeRequirementType" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gamification_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gamification_badges_code_key" ON "gamification_badges"("code");

-- CreateIndex
CREATE INDEX "gamification_badges_requirementType_idx" ON "gamification_badges"("requirementType");

-- CreateTable
CREATE TABLE "student_badges" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_badges_studentId_badgeId_key" ON "student_badges"("studentId", "badgeId");

-- CreateIndex
CREATE INDEX "student_badges_badgeId_idx" ON "student_badges"("badgeId");

-- CreateTable
CREATE TABLE "gamification_events" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "action" "GamificationAction" NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gamification_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gamification_events_studentId_createdAt_idx" ON "gamification_events"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "student_gamification"
ADD CONSTRAINT "student_gamification_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges"
ADD CONSTRAINT "student_badges_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges"
ADD CONSTRAINT "student_badges_badgeId_fkey"
FOREIGN KEY ("badgeId") REFERENCES "gamification_badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_events"
ADD CONSTRAINT "gamification_events_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security
ALTER TABLE "student_gamification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gamification_badges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_badges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gamification_events" ENABLE ROW LEVEL SECURITY;

-- Seed catalog of starter badges
INSERT INTO "gamification_badges" ("id", "code", "name", "description", "iconName", "requirementType", "threshold", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('badge-first-checkin', 'FIRST_CHECKIN', 'Primeira aula', 'Registrou o primeiro check-in na academia.', 'trophy', 'CHECKIN_COUNT', 1, 10, true, NOW(), NOW()),
  ('badge-streak-3', 'STREAK_3', 'Ritmo inicial', 'Treinou em tres dias consecutivos.', 'flame', 'CURRENT_STREAK', 3, 20, true, NOW(), NOW()),
  ('badge-streak-7', 'STREAK_7', 'Semana perfeita', 'Sete dias consecutivos de treino.', 'flame', 'CURRENT_STREAK', 7, 30, true, NOW(), NOW()),
  ('badge-streak-30', 'STREAK_30', 'Dedicacao maxima', 'Trinta dias consecutivos de treino.', 'flame', 'CURRENT_STREAK', 30, 40, true, NOW(), NOW()),
  ('badge-checkin-20', 'CHECKIN_20', 'Presenca recorrente', 'Acumulou 20 check-ins registrados.', 'medal', 'CHECKIN_COUNT', 20, 50, true, NOW(), NOW()),
  ('badge-checkin-100', 'CHECKIN_100', 'Veterano', 'Alcancou a marca de 100 check-ins.', 'medal', 'CHECKIN_COUNT', 100, 60, true, NOW(), NOW()),
  ('badge-first-assessment', 'FIRST_ASSESSMENT', 'Avaliacao inicial', 'Registrou a primeira avaliacao fisica.', 'clipboard', 'ASSESSMENT_COUNT', 1, 70, true, NOW(), NOW()),
  ('badge-assessment-5', 'ASSESSMENT_5', 'Evolucao acompanhada', 'Cinco avaliacoes fisicas registradas.', 'clipboard', 'ASSESSMENT_COUNT', 5, 80, true, NOW(), NOW()),
  ('badge-points-500', 'POINTS_500', 'Meio caminho', 'Atingiu 500 pontos de jornada.', 'star', 'TOTAL_POINTS', 500, 90, true, NOW(), NOW()),
  ('badge-points-2000', 'POINTS_2000', 'Atleta completo', 'Atingiu 2000 pontos de jornada.', 'star', 'TOTAL_POINTS', 2000, 100, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
