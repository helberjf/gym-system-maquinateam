import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingAssignmentStatus, UserRole } from "@prisma/client";
import { ConflictError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  prisma: {
    trainingTemplate: {
      findFirst: vi.fn(),
    },
    studentProfile: {
      findMany: vi.fn(),
    },
    trainingAssignment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/training/access", () => ({
  getTrainingTemplateVisibilityWhere: vi.fn(() => ({})),
  getTrainingAssignmentVisibilityWhere: vi.fn(() => ({})),
  ensureVisibleTrainingAssignment: vi.fn(),
}));

vi.mock("@/lib/academy/access", () => ({
  getStudentVisibilityWhere: vi.fn(() => ({})),
  getTeacherVisibilityWhere: vi.fn(() => ({})),
  getModalityVisibilityWhere: vi.fn(() => ({})),
  requireTeacherViewerContext: vi.fn((viewer) => viewer.teacherProfileId),
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: vi.fn(),
}));

import { createTrainingAssignments } from "@/lib/training/service";

describe("training assignment smoke tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.trainingTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      name: "Boxe Iniciante",
      objective: "Base tecnica",
      teacherProfileId: null,
      content: {
        aquecimento: ["Pular corda"],
      },
    });
    mocks.prisma.studentProfile.findMany.mockResolvedValue([
      {
        id: "student-1",
        registrationNumber: "ALU-0001",
        user: {
          name: "Alice",
        },
      },
    ]);
  });

  it("blocks duplicate active assignments for the same student and template", async () => {
    mocks.prisma.trainingAssignment.findMany.mockResolvedValue([
      {
        studentProfileId: "student-1",
      },
    ]);

    await expect(
      createTrainingAssignments(
        {
          trainingTemplateId: "template-1",
          studentIds: ["student-1"],
          title: "Plano da semana",
          instructions: "Seguir rounds base",
          objective: "Melhorar base",
          observacoesProfessor: "Olhar postura",
          assignedAt: "2026-03-31",
          dueAt: "2026-04-07",
          status: TrainingAssignmentStatus.ASSIGNED,
        },
        {
          viewer: {
            userId: "teacher-1",
            role: UserRole.ADMIN,
            studentProfileId: null,
            teacherProfileId: null,
          },
          request: new Request("http://localhost/api/training-assignments"),
        },
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
