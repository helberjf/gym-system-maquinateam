import { beforeEach, describe, expect, it, vi } from "vitest";
import { NutritionPlanStatus, UserRole } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  prisma: {
    nutritionPlan: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  logAuditEvent: vi.fn(),
  notifyNutritionPlanCreated: vi.fn(async () => ({ ok: true })),
  ensureVisibleStudent: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/audit", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));
vi.mock("@/lib/messaging/events", () => ({
  notifyNutritionPlanCreated: mocks.notifyNutritionPlanCreated,
}));
vi.mock("@/lib/academy/access", () => ({
  ensureVisibleStudent: mocks.ensureVisibleStudent,
}));
vi.mock("@/lib/observability/capture", () => ({
  captureException: mocks.captureException,
}));

import {
  createNutritionPlan,
  deleteNutritionPlan,
  listNutritionPlans,
} from "@/lib/nutrition/service";

const adminViewer = {
  userId: "user-admin",
  role: UserRole.ADMIN,
  teacherProfileId: null,
  studentProfileId: null,
} as const;

const receptionViewer = {
  userId: "user-recep",
  role: UserRole.RECEPCAO,
  teacherProfileId: null,
  studentProfileId: null,
} as const;

const otherStudent = {
  userId: "user-other",
  role: UserRole.ALUNO,
  teacherProfileId: null,
  studentProfileId: "student-other",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ensureVisibleStudent.mockResolvedValue({ id: "student-1" });
  mocks.prisma.nutritionPlan.count.mockResolvedValue(0);
  mocks.prisma.nutritionPlan.findMany.mockResolvedValue([]);
});

describe("listNutritionPlans", () => {
  it("allows RECEPCAO to view", async () => {
    await listNutritionPlans({ studentId: "student-1", page: 1 }, receptionViewer);
    expect(mocks.prisma.nutritionPlan.findMany).toHaveBeenCalled();
  });

  it("denies ALUNO viewing other students", async () => {
    await expect(
      listNutritionPlans({ studentId: "student-1", page: 1 }, otherStudent),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("createNutritionPlan", () => {
  it("denies RECEPCAO (only ADMIN/PROFESSOR manages)", async () => {
    await expect(
      createNutritionPlan(
        {
          studentId: "student-1",
          title: "Cutting",
          description: undefined,
          status: NutritionPlanStatus.ACTIVE,
          startsAt: undefined,
          endsAt: undefined,
          content: { meals: [] },
        },
        { viewer: receptionViewer },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("persists plan, audits and triggers notification", async () => {
    mocks.prisma.nutritionPlan.create.mockResolvedValue({
      id: "plan-1",
      studentProfileId: "student-1",
      title: "Cutting",
    });

    const created = await createNutritionPlan(
      {
        studentId: "student-1",
        title: "Cutting",
        description: "Deficit leve",
        status: NutritionPlanStatus.ACTIVE,
        startsAt: "2026-05-01",
        endsAt: "2026-06-01",
        content: {
          caloriesTarget: 1800,
          objective: "Emagrecimento",
          meals: [
            {
              title: "Cafe da manha",
              items: ["2 ovos", "1 pao"],
              time: "07:00",
              notes: undefined,
            },
          ],
        },
      },
      { viewer: adminViewer },
    );

    expect(created.id).toBe("plan-1");
    expect(mocks.prisma.nutritionPlan.create).toHaveBeenCalled();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "nutrition_plan.create" }),
    );
    expect(mocks.notifyNutritionPlanCreated).toHaveBeenCalledWith({
      studentProfileId: "student-1",
      planTitle: "Cutting",
    });
  });

  it("swallows notification errors without failing the create", async () => {
    mocks.prisma.nutritionPlan.create.mockResolvedValue({
      id: "plan-2",
      studentProfileId: "student-1",
      title: "X",
    });
    mocks.notifyNutritionPlanCreated.mockRejectedValueOnce(
      new Error("zapi timeout"),
    );

    const created = await createNutritionPlan(
      {
        studentId: "student-1",
        title: "X",
        description: undefined,
        status: NutritionPlanStatus.ACTIVE,
        startsAt: undefined,
        endsAt: undefined,
        content: { meals: [] },
      },
      { viewer: adminViewer },
    );

    expect(created.id).toBe("plan-2");
    expect(mocks.captureException).toHaveBeenCalled();
  });
});

describe("deleteNutritionPlan", () => {
  it("throws NotFound when plan does not exist", async () => {
    mocks.prisma.nutritionPlan.findUnique.mockResolvedValue(null);
    await expect(
      deleteNutritionPlan("missing", { viewer: adminViewer }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
