import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { ensureVisibleStudent, type ViewerContext } from "@/lib/academy/access";
import { logAuditEvent } from "@/lib/audit";
import { notifyNutritionPlanCreated } from "@/lib/messaging/events";
import { captureException } from "@/lib/observability/capture";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { buildOffsetPagination } from "@/lib/pagination";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type {
  createNutritionPlanSchema,
  nutritionPlanFiltersSchema,
  updateNutritionPlanSchema,
} from "@/lib/validators";
import { UserRole } from "@prisma/client";

type CreateInput = z.infer<typeof createNutritionPlanSchema>;
type UpdateInput = z.infer<typeof updateNutritionPlanSchema>;
type FiltersInput = z.infer<typeof nutritionPlanFiltersSchema>;

type MutationContext = {
  viewer: ViewerContext;
  request?: Request;
};

const PAGE_SIZE = 20;

function assertCanView(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "viewNutritionPlans")) {
    throw new ForbiddenError("Sem permissao para ver planos alimentares.");
  }
}

function assertCanManage(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "manageNutritionPlans")) {
    throw new ForbiddenError("Sem permissao para editar planos alimentares.");
  }
}

async function assertStudentVisible(
  viewer: ViewerContext,
  studentId: string,
) {
  if (viewer.role === UserRole.ALUNO) {
    if (viewer.studentProfileId !== studentId) {
      throw new ForbiddenError("Acesso negado.");
    }
    return;
  }
  await ensureVisibleStudent(viewer, studentId);
}

function parseDateOnly(value?: string | null) {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toContent(value: CreateInput["content"]) {
  return value as unknown as Prisma.InputJsonValue;
}

export async function listNutritionPlans(
  filters: FiltersInput,
  viewer: ViewerContext,
) {
  assertCanView(viewer);
  await assertStudentVisible(viewer, filters.studentId);

  const where: Prisma.NutritionPlanWhereInput = {
    studentProfileId: filters.studentId,
    ...(filters.status ? { status: filters.status } : {}),
  };

  const total = await prisma.nutritionPlan.count({ where });
  const pagination = buildOffsetPagination({
    page: filters.page ?? 1,
    pageSize: PAGE_SIZE,
    totalItems: total,
  });

  const items = await prisma.nutritionPlan.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip: pagination.skip,
    take: pagination.limit,
    include: {
      createdByUser: { select: { id: true, name: true } },
    },
  });

  return { items, pagination };
}

export async function getNutritionPlan(id: string, viewer: ViewerContext) {
  assertCanView(viewer);

  const plan = await prisma.nutritionPlan.findUnique({
    where: { id },
    include: {
      createdByUser: { select: { id: true, name: true } },
    },
  });

  if (!plan) {
    throw new NotFoundError("Plano alimentar nao encontrado.");
  }

  await assertStudentVisible(viewer, plan.studentProfileId);
  return plan;
}

export async function createNutritionPlan(
  input: CreateInput,
  context: MutationContext,
) {
  assertCanManage(context.viewer);
  await assertStudentVisible(context.viewer, input.studentId);

  const created = await prisma.nutritionPlan.create({
    data: {
      studentProfileId: input.studentId,
      createdByUserId: context.viewer.userId,
      status: input.status,
      title: input.title,
      description: input.description ?? null,
      content: toContent(input.content),
      startsAt: parseDateOnly(input.startsAt) ?? undefined,
      endsAt: parseDateOnly(input.endsAt) ?? undefined,
    },
  });

  await logAuditEvent({
    actorId: context.viewer.userId,
    action: "nutrition_plan.create",
    entityType: "NutritionPlan",
    entityId: created.id,
    summary: `Plano alimentar registrado para aluno ${input.studentId}.`,
    afterData: created,
    request: context.request,
  });

  try {
    await notifyNutritionPlanCreated({
      studentProfileId: input.studentId,
      planTitle: input.title,
    });
  } catch (error) {
    captureException(error, {
      source: "nutrition plan notification",
      extras: { nutritionPlanId: created.id },
    });
  }

  return created;
}

export async function updateNutritionPlan(
  input: UpdateInput,
  context: MutationContext,
) {
  assertCanManage(context.viewer);

  const existing = await prisma.nutritionPlan.findUnique({
    where: { id: input.id },
    select: { id: true, studentProfileId: true },
  });

  if (!existing) {
    throw new NotFoundError("Plano alimentar nao encontrado.");
  }

  await assertStudentVisible(context.viewer, existing.studentProfileId);

  const updated = await prisma.nutritionPlan.update({
    where: { id: input.id },
    data: {
      title: input.title ?? undefined,
      description: input.description !== undefined
        ? input.description ?? null
        : undefined,
      content: input.content ? toContent(input.content) : undefined,
      status: input.status ?? undefined,
      startsAt:
        input.startsAt !== undefined
          ? parseDateOnly(input.startsAt)
          : undefined,
      endsAt:
        input.endsAt !== undefined ? parseDateOnly(input.endsAt) : undefined,
    },
  });

  await logAuditEvent({
    actorId: context.viewer.userId,
    action: "nutrition_plan.update",
    entityType: "NutritionPlan",
    entityId: updated.id,
    summary: `Plano alimentar ${updated.id} atualizado.`,
    beforeData: existing,
    afterData: updated,
    request: context.request,
  });

  return updated;
}

export async function deleteNutritionPlan(id: string, context: MutationContext) {
  assertCanManage(context.viewer);

  const existing = await prisma.nutritionPlan.findUnique({
    where: { id },
    select: { id: true, studentProfileId: true },
  });

  if (!existing) {
    throw new NotFoundError("Plano alimentar nao encontrado.");
  }

  await assertStudentVisible(context.viewer, existing.studentProfileId);

  await prisma.nutritionPlan.delete({ where: { id } });

  await logAuditEvent({
    actorId: context.viewer.userId,
    action: "nutrition_plan.delete",
    entityType: "NutritionPlan",
    entityId: id,
    summary: `Plano alimentar ${id} removido.`,
    beforeData: existing,
    request: context.request,
  });

  return { id };
}
