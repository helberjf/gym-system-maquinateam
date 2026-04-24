import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  prisma: {
    physicalAssessment: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  ensureVisibleStudent: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/academy/access", () => ({
  ensureVisibleStudent: mocks.ensureVisibleStudent,
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("@/lib/academy/gamification", () => ({
  awardPointsSafely: vi.fn(async () => undefined),
  POINTS_PER_ASSESSMENT: 30,
}));

import {
  createPhysicalAssessment,
  deletePhysicalAssessment,
  getPhysicalAssessment,
  listPhysicalAssessments,
  updatePhysicalAssessment,
} from "@/lib/academy/assessments";

const adminViewer = {
  userId: "user-admin",
  role: UserRole.ADMIN,
  teacherProfileId: null,
  studentProfileId: null,
} as const;

const studentViewer = {
  userId: "user-student",
  role: UserRole.ALUNO,
  teacherProfileId: null,
  studentProfileId: "student-1",
} as const;

const otherStudentViewer = {
  userId: "user-other-student",
  role: UserRole.ALUNO,
  teacherProfileId: null,
  studentProfileId: "student-2",
} as const;

describe("physical assessments service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureVisibleStudent.mockResolvedValue({ id: "student-1" });
  });

  it("lists assessments with pagination for an authorized viewer", async () => {
    mocks.prisma.physicalAssessment.count.mockResolvedValue(2);
    mocks.prisma.physicalAssessment.findMany.mockResolvedValue([
      { id: "a1" },
      { id: "a2" },
    ]);

    const result = await listPhysicalAssessments(
      { studentId: "student-1", page: 1 },
      adminViewer,
    );

    expect(result.items).toHaveLength(2);
    expect(result.pagination.totalItems).toBe(2);
    expect(mocks.prisma.physicalAssessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "student-1" },
      }),
    );
  });

  it("lets a student list their own assessments without visibility helper", async () => {
    mocks.prisma.physicalAssessment.count.mockResolvedValue(0);
    mocks.prisma.physicalAssessment.findMany.mockResolvedValue([]);

    await listPhysicalAssessments(
      { studentId: "student-1", page: 1 },
      studentViewer,
    );

    expect(mocks.ensureVisibleStudent).not.toHaveBeenCalled();
  });

  it("prevents a student from listing assessments of another student", async () => {
    await expect(
      listPhysicalAssessments(
        { studentId: "student-1", page: 1 },
        otherStudentViewer,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns not found when assessment is missing", async () => {
    mocks.prisma.physicalAssessment.findUnique.mockResolvedValue(null);

    await expect(
      getPhysicalAssessment("missing", adminViewer),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates assessment with viewer teacher profile as evaluator", async () => {
    mocks.prisma.physicalAssessment.create.mockResolvedValue({
      id: "new-assessment",
      studentId: "student-1",
    });

    const teacherViewer = {
      userId: "user-prof",
      role: UserRole.PROFESSOR,
      teacherProfileId: "teacher-1",
      studentProfileId: null,
    } as const;

    const created = await createPhysicalAssessment(
      { studentId: "student-1", weightKg: 80 },
      { viewer: teacherViewer },
    );

    expect(created.id).toBe("new-assessment");
    expect(mocks.prisma.physicalAssessment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: "student-1",
          assessedById: "teacher-1",
          weightKg: 80,
        }),
      }),
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "physical_assessment.create" }),
    );
  });

  it("blocks ALUNO role from creating assessments", async () => {
    await expect(
      createPhysicalAssessment(
        { studentId: "student-1", weightKg: 80 },
        { viewer: studentViewer },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("updates assessment and logs audit event", async () => {
    mocks.prisma.physicalAssessment.findUnique.mockResolvedValue({
      id: "assessment-1",
      studentId: "student-1",
    });
    mocks.prisma.physicalAssessment.update.mockResolvedValue({
      id: "assessment-1",
    });

    await updatePhysicalAssessment(
      { id: "assessment-1", weightKg: 82 },
      { viewer: adminViewer },
    );

    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "physical_assessment.update" }),
    );
  });

  it("deletes assessment and logs audit event", async () => {
    mocks.prisma.physicalAssessment.findUnique.mockResolvedValue({
      id: "assessment-1",
      studentId: "student-1",
    });

    await deletePhysicalAssessment("assessment-1", { viewer: adminViewer });

    expect(mocks.prisma.physicalAssessment.delete).toHaveBeenCalledWith({
      where: { id: "assessment-1" },
    });
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "physical_assessment.delete" }),
    );
  });
});
