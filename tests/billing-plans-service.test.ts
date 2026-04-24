import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "@/lib/errors";

const mocks = vi.hoisted(() => {
  const tx = {
    plan: {
      create: vi.fn(),
      update: vi.fn(),
    },
    modality: {
      findUnique: vi.fn(),
    },
  };

  return {
    tx,
    prisma: {
      plan: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        update: vi.fn(),
      },
      subscription: {
        count: vi.fn(),
      },
      modality: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    logAuditEvent: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/audit", () => ({ logAuditEvent: mocks.logAuditEvent }));

import { createPlan, updatePlan, archivePlan, getPlansIndexData } from "@/lib/billing/service";

const adminViewer = {
  userId: "admin-1",
  role: "ADMIN" as const,
  studentProfileId: null,
  teacherProfileId: null,
};

const adminContext = { viewer: adminViewer };

const basePlanInput = {
  name: "Mensal 2x na Semana",
  slug: "mensal-2x-na-semana",
  description: "Plano mensal para evoluir tecnica e condicionamento.",
  benefits: ["2 treinos por semana", "Acesso ao app"],
  priceCents: 15900,
  billingIntervalMonths: 1,
  durationMonths: 1,
  sessionsPerWeek: 2,
  isUnlimited: false,
  enrollmentFeeCents: 0,
  active: true,
};

describe("createPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === "function") {
        return fn(mocks.tx);
      }
      if (Array.isArray(fn)) {
        return Promise.all(fn);
      }
      return fn;
    });
    mocks.tx.plan.create.mockResolvedValue({
      id: "plan-1",
      name: basePlanInput.name,
      slug: basePlanInput.slug,
    });
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it("cria um plano e registra auditoria", async () => {
    const result = await createPlan(basePlanInput, adminContext);

    expect(result.id).toBe("plan-1");
    expect(mocks.tx.plan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Mensal 2x na Semana",
          slug: "mensal-2x-na-semana",
          priceCents: 15900,
          billingIntervalMonths: 1,
          isUnlimited: false,
        }),
      }),
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PLAN_CREATED",
        entityId: "plan-1",
      }),
    );
  });

  it("gera slug a partir do nome quando slug nao é fornecido", async () => {
    await createPlan({ ...basePlanInput, slug: undefined }, adminContext);

    expect(mocks.tx.plan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: expect.stringMatching(/^[a-z0-9-]+$/),
        }),
      }),
    );
  });

  it("valida modalidade ativa quando modalityId é fornecido", async () => {
    mocks.tx.modality.findUnique.mockResolvedValue({
      id: "mod-1",
      isActive: true,
    });

    await createPlan({ ...basePlanInput, modalityId: "mod-1" }, adminContext);

    expect(mocks.tx.modality.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mod-1" } }),
    );
  });

  it("lança ConflictError se modalidade estiver inativa", async () => {
    mocks.tx.modality.findUnique.mockResolvedValue({
      id: "mod-inactive",
      isActive: false,
    });

    await expect(
      createPlan({ ...basePlanInput, modalityId: "mod-inactive" }, adminContext),
    ).rejects.toThrow(ConflictError);
  });

  it("lança NotFoundError se modalidade nao existe", async () => {
    mocks.tx.modality.findUnique.mockResolvedValue(null);

    await expect(
      createPlan({ ...basePlanInput, modalityId: "mod-ghost" }, adminContext),
    ).rejects.toThrow(NotFoundError);
  });

  it("cria plano ilimitado sem sessoes por semana", async () => {
    mocks.tx.plan.create.mockResolvedValue({
      id: "plan-full",
      name: "Plano Full",
      slug: "plano-full",
    });

    const result = await createPlan(
      {
        ...basePlanInput,
        name: "Plano Full",
        slug: "plano-full",
        isUnlimited: true,
        sessionsPerWeek: undefined,
        priceCents: 25000,
      },
      adminContext,
    );

    expect(result.id).toBe("plan-full");
    expect(mocks.tx.plan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isUnlimited: true,
          sessionsPerWeek: null,
        }),
      }),
    );
  });
});

describe("updatePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === "function") return fn(mocks.tx);
      if (Array.isArray(fn)) return Promise.all(fn);
      return fn;
    });
    mocks.prisma.plan.findUnique.mockResolvedValue({
      id: "plan-1",
      name: "Mensal 2x na Semana",
      slug: "mensal-2x-na-semana",
      active: true,
    });
    mocks.prisma.subscription.count.mockResolvedValue(0);
    mocks.tx.plan.update.mockResolvedValue({
      id: "plan-1",
      name: "Mensal 2x na Semana Atualizado",
      slug: "mensal-2x-na-semana",
      active: true,
    });
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it("atualiza plano e registra auditoria", async () => {
    const result = await updatePlan(
      { ...basePlanInput, id: "plan-1", name: "Mensal 2x na Semana Atualizado" },
      adminContext,
    );

    expect(result.id).toBe("plan-1");
    expect(mocks.tx.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "plan-1" },
        data: expect.objectContaining({
          name: "Mensal 2x na Semana Atualizado",
        }),
      }),
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PLAN_UPDATED",
        entityId: "plan-1",
      }),
    );
  });

  it("lança NotFoundError quando plano nao existe", async () => {
    mocks.prisma.plan.findUnique.mockResolvedValue(null);

    await expect(
      updatePlan({ ...basePlanInput, id: "ghost" }, adminContext),
    ).rejects.toThrow(NotFoundError);
  });

  it("impede inativar plano com assinaturas vigentes", async () => {
    mocks.prisma.subscription.count.mockResolvedValue(3);

    await expect(
      updatePlan({ ...basePlanInput, id: "plan-1", active: false }, adminContext),
    ).rejects.toThrow(ConflictError);
  });

  it("permite inativar plano sem assinaturas vigentes", async () => {
    mocks.prisma.subscription.count.mockResolvedValue(0);
    mocks.tx.plan.update.mockResolvedValue({
      id: "plan-1",
      name: "Mensal 2x na Semana",
      slug: "mensal-2x-na-semana",
      active: false,
    });

    const result = await updatePlan(
      { ...basePlanInput, id: "plan-1", active: false },
      adminContext,
    );

    expect(result.active).toBe(false);
  });
});

describe("archivePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.plan.findUnique.mockResolvedValue({
      id: "plan-1",
      name: "Mensal 2x na Semana",
      active: true,
    });
    mocks.prisma.subscription.count.mockResolvedValue(0);
    mocks.prisma.plan.update.mockResolvedValue({ id: "plan-1", active: false });
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it("arquiva plano sem assinaturas vigentes", async () => {
    await archivePlan("plan-1", adminContext);

    expect(mocks.prisma.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "plan-1" },
        data: { active: false },
      }),
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PLAN_ARCHIVED",
        entityId: "plan-1",
      }),
    );
  });

  it("lança NotFoundError quando plano nao existe", async () => {
    mocks.prisma.plan.findUnique.mockResolvedValue(null);

    await expect(archivePlan("ghost", adminContext)).rejects.toThrow(NotFoundError);
  });

  it("lança ConflictError quando plano tem assinaturas vigentes", async () => {
    mocks.prisma.subscription.count.mockResolvedValue(2);

    await expect(archivePlan("plan-1", adminContext)).rejects.toThrow(ConflictError);
  });

  it("nao chama update nem audit quando há assinaturas vigentes", async () => {
    mocks.prisma.subscription.count.mockResolvedValue(1);

    await expect(archivePlan("plan-1", adminContext)).rejects.toThrow();
    expect(mocks.prisma.plan.update).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("getPlansIndexData", () => {
  const planRow = {
    id: "plan-1",
    name: "Mensal 2x na Semana",
    slug: "mensal-2x-na-semana",
    description: "Plano mensal",
    benefits: ["2 treinos"],
    priceCents: 15900,
    billingIntervalMonths: 1,
    durationMonths: 1,
    sessionsPerWeek: 2,
    isUnlimited: false,
    enrollmentFeeCents: 0,
    active: true,
    modality: null,
    _count: { subscriptions: 3 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.plan.count.mockResolvedValue(12);
    mocks.prisma.plan.aggregate.mockResolvedValue({
      _avg: { priceCents: 17900 },
    });
    mocks.prisma.plan.findMany.mockResolvedValue([planRow]);
    mocks.prisma.modality.findMany.mockResolvedValue([]);
  });

  it("retorna lista de planos com summary e paginacao", async () => {
    const data = await getPlansIndexData(adminViewer, { page: 1 });

    expect(data.plans).toHaveLength(1);
    expect(data.plans[0].name).toBe("Mensal 2x na Semana");
    expect(data.summary.totalPlans).toBe(12);
    expect(data.pagination).toBeDefined();
  });

  it("calcula averagePriceCents corretamente no summary", async () => {
    const data = await getPlansIndexData(adminViewer, { page: 1 });

    expect(data.summary.averagePriceCents).toBe(17900);
  });

  it("retorna inactivePlans = totalPlans - activePlans", async () => {
    mocks.prisma.plan.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(8);

    const data = await getPlansIndexData(adminViewer, { page: 1 });

    expect(data.summary.inactivePlans).toBe(4);
  });

  it("canManage é true para ADMIN", async () => {
    const data = await getPlansIndexData(adminViewer, { page: 1 });

    expect(data.canManage).toBe(true);
  });

  it("canManage é false para PROFESSOR", async () => {
    const professorViewer = {
      ...adminViewer,
      role: "PROFESSOR" as const,
    };
    const data = await getPlansIndexData(professorViewer, { page: 1 });

    expect(data.canManage).toBe(false);
  });

  it("filtra planos por active=true quando filtro está ativo", async () => {
    await getPlansIndexData(adminViewer, { active: true, page: 1 });

    expect(mocks.prisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ active: true }),
          ]),
        }),
      }),
    );
  });
});
