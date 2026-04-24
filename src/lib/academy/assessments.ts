import type { Prisma } from "@prisma/client";
import { GamificationAction, UserRole } from "@prisma/client";
import type { z } from "zod";
import { logAuditEvent } from "@/lib/audit";
import { ensureVisibleStudent, type ViewerContext } from "@/lib/academy/access";
import {
  awardPointsSafely,
  POINTS_PER_ASSESSMENT,
} from "@/lib/academy/gamification";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { buildOffsetPagination } from "@/lib/pagination";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type {
  createPhysicalAssessmentSchema,
  physicalAssessmentFiltersSchema,
  updatePhysicalAssessmentSchema,
} from "@/lib/validators";

type CreateInput = z.infer<typeof createPhysicalAssessmentSchema>;
type UpdateInput = z.infer<typeof updatePhysicalAssessmentSchema>;
type FiltersInput = z.infer<typeof physicalAssessmentFiltersSchema>;

type MutationContext = {
  viewer: ViewerContext;
  request?: Request;
};

const PAGE_SIZE = 20;

function assertCanView(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "viewPhysicalAssessments")) {
    throw new ForbiddenError("Sem permissao para ver avaliacoes fisicas.");
  }
}

function assertCanManage(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "managePhysicalAssessments")) {
    throw new ForbiddenError("Sem permissao para editar avaliacoes fisicas.");
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

function toData(input: CreateInput | UpdateInput) {
  return {
    assessedAt: input.assessedAt ? new Date(input.assessedAt) : undefined,
    weightKg: input.weightKg ?? null,
    heightCm: input.heightCm ?? null,
    bodyFatPercent: input.bodyFatPercent ?? null,
    muscleMassKg: input.muscleMassKg ?? null,
    chestCm: input.chestCm ?? null,
    waistCm: input.waistCm ?? null,
    hipCm: input.hipCm ?? null,
    leftArmCm: input.leftArmCm ?? null,
    rightArmCm: input.rightArmCm ?? null,
    leftThighCm: input.leftThighCm ?? null,
    rightThighCm: input.rightThighCm ?? null,
    restingHeartRate: input.restingHeartRate ?? null,
    bloodPressureSystolic: input.bloodPressureSystolic ?? null,
    bloodPressureDiastolic: input.bloodPressureDiastolic ?? null,
    notes: input.notes ?? null,
  } satisfies Prisma.PhysicalAssessmentUncheckedUpdateInput;
}

export async function listPhysicalAssessments(
  filters: FiltersInput,
  viewer: ViewerContext,
) {
  assertCanView(viewer);
  await assertStudentVisible(viewer, filters.studentId);

  const total = await prisma.physicalAssessment.count({
    where: { studentId: filters.studentId },
  });

  const pagination = buildOffsetPagination({
    page: filters.page ?? 1,
    pageSize: PAGE_SIZE,
    totalItems: total,
  });

  const items = await prisma.physicalAssessment.findMany({
    where: { studentId: filters.studentId },
    orderBy: [{ assessedAt: "desc" }, { createdAt: "desc" }],
    skip: pagination.skip,
    take: pagination.limit,
    include: {
      assessedBy: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  return { items, pagination };
}

export async function getPhysicalAssessment(
  id: string,
  viewer: ViewerContext,
) {
  assertCanView(viewer);

  const record = await prisma.physicalAssessment.findUnique({
    where: { id },
    include: {
      assessedBy: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
      student: { select: { id: true } },
    },
  });

  if (!record) {
    throw new NotFoundError("Avaliacao nao encontrada.");
  }

  await assertStudentVisible(viewer, record.student.id);

  return record;
}

export async function createPhysicalAssessment(
  input: CreateInput,
  context: MutationContext,
) {
  assertCanManage(context.viewer);
  await assertStudentVisible(context.viewer, input.studentId);

  const created = await prisma.physicalAssessment.create({
    data: {
      studentId: input.studentId,
      assessedById: context.viewer.teacherProfileId ?? null,
      ...toData(input),
    },
  });

  await logAuditEvent({
    actorId: context.viewer.userId,
    action: "physical_assessment.create",
    entityType: "PhysicalAssessment",
    entityId: created.id,
    summary: `Avaliacao fisica registrada para aluno ${input.studentId}.`,
    afterData: created,
    request: context.request,
  });

  await awardPointsSafely({
    studentId: input.studentId,
    action: GamificationAction.ASSESSMENT,
    basePoints: POINTS_PER_ASSESSMENT,
    reason: "Avaliacao fisica registrada.",
    metadata: { assessmentId: created.id },
  });

  return created;
}

export async function updatePhysicalAssessment(
  input: UpdateInput,
  context: MutationContext,
) {
  assertCanManage(context.viewer);

  const existing = await prisma.physicalAssessment.findUnique({
    where: { id: input.id },
    select: { id: true, studentId: true },
  });

  if (!existing) {
    throw new NotFoundError("Avaliacao nao encontrada.");
  }

  await assertStudentVisible(context.viewer, existing.studentId);

  const updated = await prisma.physicalAssessment.update({
    where: { id: input.id },
    data: toData(input),
  });

  await logAuditEvent({
    actorId: context.viewer.userId,
    action: "physical_assessment.update",
    entityType: "PhysicalAssessment",
    entityId: updated.id,
    summary: `Avaliacao fisica ${updated.id} atualizada.`,
    afterData: updated,
    request: context.request,
  });

  return updated;
}

export async function deletePhysicalAssessment(
  id: string,
  context: MutationContext,
) {
  assertCanManage(context.viewer);

  const existing = await prisma.physicalAssessment.findUnique({
    where: { id },
    select: { id: true, studentId: true },
  });

  if (!existing) {
    throw new NotFoundError("Avaliacao nao encontrada.");
  }

  await assertStudentVisible(context.viewer, existing.studentId);

  await prisma.physicalAssessment.delete({ where: { id } });

  await logAuditEvent({
    actorId: context.viewer.userId,
    action: "physical_assessment.delete",
    entityType: "PhysicalAssessment",
    entityId: id,
    summary: `Avaliacao fisica ${id} removida.`,
    beforeData: existing,
    request: context.request,
  });

  return { id };
}
