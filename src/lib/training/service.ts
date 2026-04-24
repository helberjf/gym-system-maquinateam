import type { z } from "zod";
import {
  AttendanceStatus,
  Prisma,
  TrainingAssignmentStatus,
  UserRole,
} from "@prisma/client";
import {
  slugify,
  startOfDay,
} from "@/lib/academy/constants";
import {
  getModalityVisibilityWhere,
  getStudentVisibilityWhere,
  getTeacherVisibilityWhere,
  requireStudentViewerContext,
  requireTeacherViewerContext,
  type ViewerContext,
} from "@/lib/academy/access";
import { logAuditEvent } from "@/lib/audit";
import { notifyTrainingPlanCreated } from "@/lib/messaging/events";
import { captureException } from "@/lib/observability/capture";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { buildOffsetPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  buildTrainingStructure,
  countFilledTrainingBlocks,
  extractTrainingStructure,
} from "@/lib/training/constants";
import {
  ensureVisibleTrainingAssignment,
  ensureVisibleTrainingTemplate,
  getTrainingAssignmentVisibilityWhere,
  getTrainingTemplateVisibilityWhere,
} from "@/lib/training/access";
import {
  announcementFiltersSchema,
  createAnnouncementSchema,
  createTrainingAssignmentSchema,
  createTrainingTemplateSchema,
  trainingAssignmentFiltersSchema,
  trainingTemplateFiltersSchema,
  updateAnnouncementSchema,
  updateTrainingAssignmentSchema,
  updateTrainingTemplateSchema,
} from "@/lib/validators";

type TrainingTemplateFiltersInput = z.infer<typeof trainingTemplateFiltersSchema>;
type TrainingAssignmentFiltersInput = z.infer<typeof trainingAssignmentFiltersSchema>;
type AnnouncementFiltersInput = z.infer<typeof announcementFiltersSchema>;
type CreateTrainingTemplateInput = z.infer<typeof createTrainingTemplateSchema>;
type UpdateTrainingTemplateInput = z.infer<typeof updateTrainingTemplateSchema>;
type CreateTrainingAssignmentInput = z.infer<typeof createTrainingAssignmentSchema>;
type UpdateTrainingAssignmentInput = z.infer<typeof updateTrainingAssignmentSchema>;
type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

type MutationContext = {
  viewer: ViewerContext;
  request?: Request;
};

function parseDateOnly(value?: string | Date | null) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return startOfDay(value);
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function normalizeOptionalString(value?: string | null) {
  return value?.trim() || null;
}

function normalizeLevel(value?: string | null) {
  return value?.trim() || null;
}

async function ensureTeacherProfileVisible(
  viewer: ViewerContext,
  teacherProfileId: string,
) {
  const teacher = await prisma.teacherProfile.findFirst({
    where: {
      AND: [
        getTeacherVisibilityWhere(viewer),
        {
          id: teacherProfileId,
          isActive: true,
          user: {
            isActive: true,
          },
        },
      ],
    },
    select: {
      id: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!teacher) {
    throw new NotFoundError("Professor nao encontrado ou indisponivel.");
  }

  return teacher;
}

async function ensureModalityVisible(
  viewer: ViewerContext,
  modalityId: string,
) {
  const modality = await prisma.modality.findFirst({
    where: {
      AND: [
        getModalityVisibilityWhere(viewer),
        {
          id: modalityId,
          isActive: true,
        },
      ],
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!modality) {
    throw new NotFoundError("Modalidade nao encontrada ou indisponivel.");
  }

  return modality;
}

async function ensureVisibleStudentsForAssignments(
  viewer: ViewerContext,
  studentIds: string[],
) {
  const students = await prisma.studentProfile.findMany({
    where: {
      AND: [
        getStudentVisibilityWhere(viewer),
        {
          id: {
            in: studentIds,
          },
          user: {
            isActive: true,
          },
        },
      ],
    },
    select: {
      id: true,
      registrationNumber: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (students.length !== studentIds.length) {
    throw new ConflictError(
      "Um ou mais alunos selecionados nao estao disponiveis para este professor.",
    );
  }

  return students;
}

async function generateUniqueTemplateSlug(baseSlug: string, templateId?: string) {
  let currentSlug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.trainingTemplate.findFirst({
      where: {
        slug: currentSlug,
        ...(templateId
          ? {
              id: {
                not: templateId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return currentSlug;
    }

    currentSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function assertCanManageTemplate(
  viewer: ViewerContext,
  template: {
    teacherProfileId: string | null;
  },
) {
  if (viewer.role === UserRole.ADMIN) {
    return;
  }

  const teacherProfileId = requireTeacherViewerContext(viewer);

  if (template.teacherProfileId && template.teacherProfileId !== teacherProfileId) {
    throw new ForbiddenError("Voce so pode editar modelos de treino vinculados ao seu perfil.");
  }
}

function assertCanManageAnnouncement(
  viewer: ViewerContext,
  announcement: { createdByUserId: string },
) {
  if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.RECEPCAO) {
    return;
  }

  if (announcement.createdByUserId !== viewer.userId) {
    throw new ForbiddenError("Voce so pode gerenciar avisos criados pela sua conta.");
  }
}

function resolveTemplateTeacherProfileId(
  input: { teacherProfileId?: string | null },
  context: MutationContext,
) {
  if (context.viewer.role === UserRole.PROFESSOR) {
    return requireTeacherViewerContext(context.viewer);
  }

  return input.teacherProfileId ?? null;
}

function resolveAssignmentTeacherProfileId(
  input: { teacherProfileId?: string | null },
  context: MutationContext,
) {
  if (context.viewer.role === UserRole.PROFESSOR) {
    return requireTeacherViewerContext(context.viewer);
  }

  return input.teacherProfileId ?? null;
}

async function getTrainingLevels(viewer: ViewerContext) {
  const templates = await prisma.trainingTemplate.findMany({
    where: getTrainingTemplateVisibilityWhere(viewer),
    distinct: ["level"],
    orderBy: {
      level: "asc",
    },
    select: {
      level: true,
    },
  });

  return templates
    .map((template) => template.level)
    .filter((level): level is string => Boolean(level));
}

async function generateUniqueAnnouncementSlug(
  baseSlug: string,
  announcementId?: string,
) {
  let currentSlug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.announcement.findFirst({
      where: {
        slug: currentSlug,
        ...(announcementId
          ? {
              id: {
                not: announcementId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return currentSlug;
    }

    currentSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function getClassScheduleDays(schedule: {
  dayOfWeek: number;
  daysOfWeek: number[];
}) {
  return schedule.daysOfWeek.length > 0 ? schedule.daysOfWeek : [schedule.dayOfWeek];
}

function buildNextClassOccurrence(
  schedule: {
    dayOfWeek: number;
    daysOfWeek: number[];
    startTime: string;
  },
  referenceDate = new Date(),
) {
  const [hours, minutes] = schedule.startTime.split(":").map(Number);
  const weekdays = getClassScheduleDays(schedule);
  let nextOccurrence: Date | null = null;

  for (const weekday of weekdays) {
    const candidate = new Date(referenceDate);
    const offset = (weekday - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);

    if (candidate < referenceDate) {
      candidate.setDate(candidate.getDate() + 7);
    }

    if (!nextOccurrence || candidate < nextOccurrence) {
      nextOccurrence = candidate;
    }
  }

  return nextOccurrence;
}

function buildPublishedAnnouncementWhere(referenceDate = new Date()) {
  return {
    isPublished: true,
    OR: [{ publishedAt: null }, { publishedAt: { lte: referenceDate } }],
    AND: [
      {
        OR: [{ expiresAt: null }, { expiresAt: { gt: referenceDate } }],
      },
    ],
  } satisfies Prisma.AnnouncementWhereInput;
}

async function getStudentAnnouncementTeacherIds(viewer: ViewerContext) {
  const studentProfileId = requireStudentViewerContext(viewer);
  const student = await prisma.studentProfile.findFirst({
    where: {
      AND: [
        getStudentVisibilityWhere(viewer),
        {
          id: studentProfileId,
        },
      ],
    },
    select: {
      responsibleTeacherId: true,
      enrollments: {
        where: {
          isActive: true,
          classSchedule: {
            isActive: true,
          },
        },
        select: {
          classSchedule: {
            select: {
              teacherProfileId: true,
            },
          },
        },
      },
    },
  });

  if (!student) {
    return [];
  }

  const teacherIds = new Set<string>();

  if (student.responsibleTeacherId) {
    teacherIds.add(student.responsibleTeacherId);
  }

  for (const enrollment of student.enrollments) {
    teacherIds.add(enrollment.classSchedule.teacherProfileId);
  }

  return Array.from(teacherIds);
}

export async function getTrainingOptions(viewer: ViewerContext) {
  const [modalities, levels] = await Promise.all([
    prisma.modality.findMany({
      where: {
        AND: [getModalityVisibilityWhere(viewer), { isActive: true }],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
    getTrainingLevels(viewer),
  ]);

  if (!hasPermission(viewer.role, "manageTrainings")) {
    return {
      modalities,
      levels,
      templates: [],
      students: [],
      teachers: [],
    };
  }

  const [templates, students, teachers] = await Promise.all([
    prisma.trainingTemplate.findMany({
      where: {
        AND: [getTrainingTemplateVisibilityWhere(viewer), { isActive: true }],
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        level: true,
        modality: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.studentProfile.findMany({
      where: {
        AND: [
          getStudentVisibilityWhere(viewer),
          {
            user: {
              isActive: true,
            },
          },
        ],
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
      select: {
        id: true,
        registrationNumber: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.teacherProfile.findMany({
      where: {
        AND: [
          getTeacherVisibilityWhere(viewer),
          {
            isActive: true,
          },
        ],
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
      select: {
        id: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    modalities,
    levels,
    templates,
    students,
    teachers,
  };
}

export async function getTrainingHubData(
  viewer: ViewerContext,
  filters: {
    templateFilters: TrainingTemplateFiltersInput;
    assignmentFilters: TrainingAssignmentFiltersInput;
  },
) {
  const canManage = hasPermission(viewer.role, "manageTrainings");

  const templateWhere: Prisma.TrainingTemplateWhereInput = {
    AND: [
      getTrainingTemplateVisibilityWhere(viewer),
      filters.templateFilters.search
        ? {
            OR: [
              {
                name: {
                  contains: filters.templateFilters.search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: filters.templateFilters.search,
                  mode: "insensitive",
                },
              },
              {
                objective: {
                  contains: filters.templateFilters.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
      filters.templateFilters.modalityId
        ? {
            modalityId: filters.templateFilters.modalityId,
          }
        : {},
      filters.templateFilters.level
        ? {
            level: {
              contains: filters.templateFilters.level,
              mode: "insensitive",
            },
          }
        : {},
      filters.templateFilters.onlyInactive
        ? {
            isActive: false,
          }
        : {},
    ],
  };

  const assignmentWhere: Prisma.TrainingAssignmentWhereInput = {
    AND: [
      getTrainingAssignmentVisibilityWhere(viewer),
      filters.assignmentFilters.search
        ? {
            OR: [
              {
                title: {
                  contains: filters.assignmentFilters.search,
                  mode: "insensitive",
                },
              },
              {
                instructions: {
                  contains: filters.assignmentFilters.search,
                  mode: "insensitive",
                },
              },
              {
                studentProfile: {
                  is: {
                    user: {
                      name: {
                        contains: filters.assignmentFilters.search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
              {
                trainingTemplate: {
                  is: {
                    name: {
                      contains: filters.assignmentFilters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {},
      filters.assignmentFilters.studentId
        ? {
            studentProfileId: filters.assignmentFilters.studentId,
          }
        : {},
      filters.assignmentFilters.teacherId
        ? {
            teacherProfileId: filters.assignmentFilters.teacherId,
          }
        : {},
      filters.assignmentFilters.status
        ? {
            status: filters.assignmentFilters.status,
          }
        : {},
      filters.assignmentFilters.modalityId
        ? {
            trainingTemplate: {
              is: {
                modalityId: filters.assignmentFilters.modalityId,
              },
            },
          }
        : {},
      filters.assignmentFilters.level
        ? {
            trainingTemplate: {
              is: {
                level: {
                  contains: filters.assignmentFilters.level,
                  mode: "insensitive",
                },
              },
            },
          }
        : {},
    ],
  };

  const [templates, assignments, options] = await Promise.all([
    canManage
      ? prisma.trainingTemplate.findMany({
          where: templateWhere,
          orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
          take: 12,
          select: {
            id: true,
            name: true,
            slug: true,
            level: true,
            description: true,
            objective: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            modality: {
              select: {
                id: true,
                name: true,
              },
            },
            teacherProfile: {
              select: {
                id: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            content: true,
            _count: {
              select: {
                assignments: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.trainingAssignment.findMany({
      where: assignmentWhere,
      orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
      take: canManage ? 20 : 24,
      select: {
        id: true,
        title: true,
        status: true,
        assignedAt: true,
        dueAt: true,
        completedAt: true,
        instructions: true,
        studentNotes: true,
        feedback: true,
        studentProfile: {
          select: {
            id: true,
            registrationNumber: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        teacherProfile: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        trainingTemplate: {
          select: {
            id: true,
            name: true,
            level: true,
            objective: true,
            modality: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        content: true,
      },
    }),
    getTrainingOptions(viewer),
  ]);

  const summary = {
    templateCount: templates.length,
    activeTemplateCount: templates.filter((template) => template.isActive).length,
    assignedCount: assignments.filter(
      (assignment) =>
        assignment.status === TrainingAssignmentStatus.ASSIGNED ||
        assignment.status === TrainingAssignmentStatus.IN_PROGRESS,
    ).length,
    completedCount: assignments.filter(
      (assignment) => assignment.status === TrainingAssignmentStatus.COMPLETED,
    ).length,
  };

  return {
    templates,
    assignments,
    activeAssignments: assignments.filter(
      (assignment) =>
        assignment.status === TrainingAssignmentStatus.ASSIGNED ||
        assignment.status === TrainingAssignmentStatus.IN_PROGRESS,
    ),
    historyAssignments: assignments.filter(
      (assignment) =>
        assignment.status === TrainingAssignmentStatus.COMPLETED ||
        assignment.status === TrainingAssignmentStatus.MISSED ||
        assignment.status === TrainingAssignmentStatus.CANCELLED,
    ),
    summary,
    options,
    canManage,
  };
}

export async function getTrainingTemplateDetailData(
  viewer: ViewerContext,
  templateId: string,
) {
  await ensureVisibleTrainingTemplate(viewer, templateId);

  const template = await prisma.trainingTemplate.findFirst({
    where: {
      AND: [getTrainingTemplateVisibilityWhere(viewer), { id: templateId }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
      description: true,
      objective: true,
      durationMinutes: true,
      isActive: true,
      updatedAt: true,
      teacherProfileId: true,
      content: true,
      modality: {
        select: {
          id: true,
          name: true,
        },
      },
      teacherProfile: {
        select: {
          id: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      assignments: {
        where: getTrainingAssignmentVisibilityWhere(viewer),
        orderBy: [{ assignedAt: "desc" }],
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          assignedAt: true,
          dueAt: true,
          studentProfile: {
            select: {
              id: true,
              registrationNumber: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!template) {
    throw new NotFoundError("Modelo de treino nao encontrado.");
  }

  return {
    template,
    structure: extractTrainingStructure(template.content),
    options: await getTrainingOptions(viewer),
    canManage: hasPermission(viewer.role, "manageTrainings"),
  };
}

export async function getTrainingAssignmentDetailData(
  viewer: ViewerContext,
  assignmentId: string,
) {
  await ensureVisibleTrainingAssignment(viewer, assignmentId);

  const assignment = await prisma.trainingAssignment.findFirst({
    where: {
      AND: [getTrainingAssignmentVisibilityWhere(viewer), { id: assignmentId }],
    },
    select: {
      id: true,
      title: true,
      status: true,
      assignedAt: true,
      startAt: true,
      dueAt: true,
      completedAt: true,
      instructions: true,
      studentNotes: true,
      feedback: true,
      content: true,
      studentProfile: {
        select: {
          id: true,
          registrationNumber: true,
          status: true,
          primaryModality: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      teacherProfile: {
        select: {
          id: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      trainingTemplate: {
        select: {
          id: true,
          name: true,
          level: true,
          objective: true,
          modality: {
            select: {
              id: true,
              name: true,
            },
          },
          content: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new NotFoundError("Treino atribuido nao encontrado.");
  }

  return {
    assignment,
    structure: extractTrainingStructure(
      assignment.content ?? assignment.trainingTemplate?.content ?? null,
    ),
    canManage: hasPermission(viewer.role, "manageTrainings"),
    isStudentOwner:
      viewer.role === UserRole.ALUNO &&
      viewer.studentProfileId === assignment.studentProfile.id,
  };
}

export async function createTrainingTemplate(
  input: CreateTrainingTemplateInput,
  context: MutationContext,
) {
  const teacherProfileId = resolveTemplateTeacherProfileId(input, context);

  await ensureModalityVisible(context.viewer, input.modalityId);

  if (teacherProfileId) {
    await ensureTeacherProfileVisible(context.viewer, teacherProfileId);
  }

  const slug = await generateUniqueTemplateSlug(
    slugify(input.slug ?? input.name),
  );
  const content = buildTrainingStructure(input);

  const template = await prisma.trainingTemplate.create({
    data: {
      name: input.name,
      slug,
      modalityId: input.modalityId,
      teacherProfileId,
      level: normalizeLevel(input.level),
      description: normalizeOptionalString(input.description),
      objective: normalizeOptionalString(input.objective),
      durationMinutes: input.durationMinutes ?? null,
      content,
      isActive: input.isActive ?? true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "TRAINING_TEMPLATE_CREATED",
    entityType: "TrainingTemplate",
    entityId: template.id,
    summary: `Modelo de treino ${template.name} criado.`,
    afterData: {
      slug: template.slug,
      level: template.level,
      modalityId: input.modalityId,
      teacherProfileId,
      blocks: countFilledTrainingBlocks(content),
    },
  });

  return template;
}

export async function updateTrainingTemplate(
  input: UpdateTrainingTemplateInput,
  context: MutationContext,
) {
  const existing = await prisma.trainingTemplate.findUnique({
    where: {
      id: input.id,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      teacherProfileId: true,
      modalityId: true,
      level: true,
      objective: true,
      description: true,
      durationMinutes: true,
      content: true,
      isActive: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Modelo de treino nao encontrado.");
  }

  assertCanManageTemplate(context.viewer, existing);
  await ensureModalityVisible(context.viewer, input.modalityId);

  const teacherProfileId = resolveTemplateTeacherProfileId(input, context);

  if (teacherProfileId) {
    await ensureTeacherProfileVisible(context.viewer, teacherProfileId);
  }

  const slug = await generateUniqueTemplateSlug(
    slugify(input.slug ?? input.name),
    input.id,
  );
  const content = buildTrainingStructure(input);

  const template = await prisma.trainingTemplate.update({
    where: {
      id: input.id,
    },
    data: {
      name: input.name,
      slug,
      modalityId: input.modalityId,
      teacherProfileId,
      level: normalizeLevel(input.level),
      description: normalizeOptionalString(input.description),
      objective: normalizeOptionalString(input.objective),
      durationMinutes: input.durationMinutes ?? null,
      content,
      isActive: input.isActive ?? true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "TRAINING_TEMPLATE_UPDATED",
    entityType: "TrainingTemplate",
    entityId: template.id,
    summary: `Modelo de treino ${template.name} atualizado.`,
    beforeData: existing,
    afterData: {
      slug: template.slug,
      level: template.level,
      modalityId: input.modalityId,
      teacherProfileId,
      blocks: countFilledTrainingBlocks(content),
      isActive: input.isActive ?? true,
    },
  });

  return template;
}

export async function archiveTrainingTemplate(
  templateId: string,
  context: MutationContext,
) {
  const existing = await prisma.trainingTemplate.findUnique({
    where: {
      id: templateId,
    },
    select: {
      id: true,
      name: true,
      teacherProfileId: true,
      isActive: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Modelo de treino nao encontrado.");
  }

  assertCanManageTemplate(context.viewer, existing);

  await prisma.trainingTemplate.update({
    where: {
      id: templateId,
    },
    data: {
      isActive: false,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "TRAINING_TEMPLATE_ARCHIVED",
    entityType: "TrainingTemplate",
    entityId: existing.id,
    summary: `Modelo de treino ${existing.name} arquivado.`,
    beforeData: existing,
    afterData: {
      isActive: false,
    },
  });
}

export async function duplicateTrainingTemplate(
  templateId: string,
  context: MutationContext,
) {
  const sourceTemplate = await prisma.trainingTemplate.findUnique({
    where: {
      id: templateId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      modalityId: true,
      teacherProfileId: true,
      level: true,
      description: true,
      objective: true,
      durationMinutes: true,
      content: true,
      isActive: true,
    },
  });

  if (!sourceTemplate) {
    throw new NotFoundError("Modelo de treino nao encontrado.");
  }

  assertCanManageTemplate(context.viewer, sourceTemplate);

  const teacherProfileId =
    context.viewer.role === UserRole.PROFESSOR
      ? requireTeacherViewerContext(context.viewer)
      : sourceTemplate.teacherProfileId;

  if (teacherProfileId) {
    await ensureTeacherProfileVisible(context.viewer, teacherProfileId);
  }

  const slug = await generateUniqueTemplateSlug(
    slugify(`${sourceTemplate.slug}-copia`),
  );

  const duplicated = await prisma.trainingTemplate.create({
    data: {
      name: `${sourceTemplate.name} (Copia)`,
      slug,
      modalityId: sourceTemplate.modalityId,
      teacherProfileId,
      level: sourceTemplate.level,
      description: sourceTemplate.description,
      objective: sourceTemplate.objective,
      durationMinutes: sourceTemplate.durationMinutes,
      content: sourceTemplate.content as Prisma.InputJsonValue,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "TRAINING_TEMPLATE_DUPLICATED",
    entityType: "TrainingTemplate",
    entityId: duplicated.id,
    summary: `Modelo de treino ${duplicated.name} duplicado.`,
    afterData: {
      sourceTemplateId: sourceTemplate.id,
      slug: duplicated.slug,
      teacherProfileId,
    },
  });

  return duplicated;
}

export async function createTrainingAssignments(
  input: CreateTrainingAssignmentInput,
  context: MutationContext,
) {
  const template = await prisma.trainingTemplate.findFirst({
    where: {
      AND: [
        getTrainingTemplateVisibilityWhere(context.viewer),
        {
          id: input.trainingTemplateId,
          isActive: true,
        },
      ],
    },
    select: {
      id: true,
      name: true,
      objective: true,
      teacherProfileId: true,
      content: true,
    },
  });

  if (!template) {
    throw new NotFoundError("Modelo de treino nao encontrado ou indisponivel.");
  }

  const teacherProfileId =
    resolveAssignmentTeacherProfileId(input, context) ??
    template.teacherProfileId ??
    null;

  if (teacherProfileId) {
    await ensureTeacherProfileVisible(context.viewer, teacherProfileId);
  }

  const students = await ensureVisibleStudentsForAssignments(
    context.viewer,
    input.studentIds,
  );
  const assignedAt = parseDateOnly(input.assignedAt) ?? startOfDay();
  const dueAt = parseDateOnly(input.dueAt) ?? null;
  const objective = normalizeOptionalString(input.objective) ?? template.objective;
  const teacherNotes = normalizeOptionalString(input.observacoesProfessor);
  const instructions = normalizeOptionalString(input.instructions);
  const templateStructure = extractTrainingStructure(template.content);

  const duplicatedAssignments = await prisma.trainingAssignment.findMany({
    where: {
      studentProfileId: {
        in: input.studentIds,
      },
      trainingTemplateId: template.id,
      status: {
        in: [
          TrainingAssignmentStatus.ASSIGNED,
          TrainingAssignmentStatus.IN_PROGRESS,
        ],
      },
    },
    select: {
      studentProfileId: true,
    },
  });

  if (duplicatedAssignments.length > 0) {
    const duplicatedIds = new Set(
      duplicatedAssignments.map((assignment) => assignment.studentProfileId),
    );
    const duplicatedStudent = students.find((student) => duplicatedIds.has(student.id));

    throw new ConflictError(
      `Ja existe um treino em andamento para ${duplicatedStudent?.user.name ?? "um dos alunos selecionados"} com este modelo.`,
    );
  }

  const createdAssignments = await prisma.$transaction(
    students.map((student) =>
      prisma.trainingAssignment.create({
        data: {
          studentProfileId: student.id,
          teacherProfileId,
          trainingTemplateId: template.id,
          status: input.status,
          title: normalizeOptionalString(input.title) ?? template.name,
          instructions,
          content: {
            ...templateStructure,
            objective,
            observacoesProfessor: teacherNotes,
          } satisfies Prisma.InputJsonObject,
          assignedAt,
          startAt:
            input.status === TrainingAssignmentStatus.IN_PROGRESS ? assignedAt : null,
          dueAt,
        },
        select: {
          id: true,
          title: true,
          studentProfileId: true,
          status: true,
        },
      }),
    ),
  );

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "TRAINING_ASSIGNMENTS_CREATED",
    entityType: "TrainingAssignment",
    summary: `${createdAssignments.length} treino(s) atribuido(s) a partir do modelo ${template.name}.`,
    afterData: {
      templateId: template.id,
      teacherProfileId,
      studentIds: createdAssignments.map((assignment) => assignment.studentProfileId),
      dueAt,
      status: input.status,
    },
  });

  for (const assignment of createdAssignments) {
    try {
      await notifyTrainingPlanCreated({
        studentProfileId: assignment.studentProfileId,
        planTitle: assignment.title,
      });
    } catch (error) {
      captureException(error, {
        source: "training assignment notification",
        extras: {
          assignmentId: assignment.id,
          studentProfileId: assignment.studentProfileId,
        },
      });
    }
  }

  return createdAssignments;
}

export async function updateTrainingAssignment(
  input: UpdateTrainingAssignmentInput,
  context: MutationContext,
) {
  const existing = await prisma.trainingAssignment.findUnique({
    where: {
      id: input.id,
    },
    select: {
      id: true,
      title: true,
      status: true,
      instructions: true,
      dueAt: true,
      startAt: true,
      completedAt: true,
      studentNotes: true,
      feedback: true,
      content: true,
      studentProfileId: true,
      teacherProfileId: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Treino atribuido nao encontrado.");
  }

  const isStudentOwner =
    context.viewer.role === UserRole.ALUNO &&
    context.viewer.studentProfileId === existing.studentProfileId;
  const canManage = hasPermission(context.viewer.role, "manageTrainings");

  if (!isStudentOwner && !canManage) {
    throw new ForbiddenError("Acesso negado.");
  }

  if (canManage && !isStudentOwner) {
    await ensureVisibleTrainingAssignment(context.viewer, input.id);
  }

  if (
    isStudentOwner &&
    (input.title !== undefined ||
      input.instructions !== undefined ||
      input.dueAt !== undefined ||
      input.feedback !== undefined)
  ) {
    throw new ForbiddenError(
      "Alunos podem apenas atualizar anotacoes pessoais e o status do proprio treino.",
    );
  }

  if (isStudentOwner && input.status) {
    const allowedTransitions: Partial<
      Record<TrainingAssignmentStatus, TrainingAssignmentStatus[]>
    > = {
      [TrainingAssignmentStatus.ASSIGNED]: [
        TrainingAssignmentStatus.ASSIGNED,
        TrainingAssignmentStatus.IN_PROGRESS,
      ],
      [TrainingAssignmentStatus.IN_PROGRESS]: [
        TrainingAssignmentStatus.IN_PROGRESS,
        TrainingAssignmentStatus.COMPLETED,
      ],
      [TrainingAssignmentStatus.COMPLETED]: [
        TrainingAssignmentStatus.COMPLETED,
      ],
    };

    const nextStatuses = allowedTransitions[existing.status] ?? [];

    if (!nextStatuses.includes(input.status)) {
      throw new ConflictError("Transicao de status nao permitida para o aluno.");
    }
  }

  const nextStatus = input.status ?? existing.status;
  const dueAt = input.dueAt === undefined ? existing.dueAt : parseDateOnly(input.dueAt);
  const nextContent =
    existing.content &&
    typeof existing.content === "object" &&
    !Array.isArray(existing.content)
      ? (existing.content as Prisma.InputJsonObject)
      : ({} as Prisma.InputJsonObject);

  const updated = await prisma.trainingAssignment.update({
    where: {
      id: input.id,
    },
    data: {
      title:
        !isStudentOwner && input.title !== undefined
          ? normalizeOptionalString(input.title) ?? existing.title
          : undefined,
      instructions:
        !isStudentOwner && input.instructions !== undefined
          ? normalizeOptionalString(input.instructions)
          : undefined,
      dueAt,
      status: nextStatus,
      startAt:
        nextStatus === TrainingAssignmentStatus.IN_PROGRESS
          ? existing.startAt ?? new Date()
          : existing.startAt,
      completedAt:
        nextStatus === TrainingAssignmentStatus.COMPLETED
          ? existing.completedAt ?? new Date()
          : nextStatus === TrainingAssignmentStatus.ASSIGNED ||
              nextStatus === TrainingAssignmentStatus.IN_PROGRESS
            ? null
            : existing.completedAt,
      studentNotes:
        input.studentNotes !== undefined
          ? normalizeOptionalString(input.studentNotes)
          : undefined,
      feedback:
        !isStudentOwner && input.feedback !== undefined
          ? normalizeOptionalString(input.feedback)
          : undefined,
      content:
        !isStudentOwner && input.instructions !== undefined
          ? {
              ...nextContent,
              instructions: normalizeOptionalString(input.instructions),
            }
          : undefined,
    },
    select: {
      id: true,
      title: true,
      status: true,
      studentProfileId: true,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: isStudentOwner
      ? "TRAINING_ASSIGNMENT_SELF_UPDATED"
      : "TRAINING_ASSIGNMENT_UPDATED",
    entityType: "TrainingAssignment",
    entityId: updated.id,
    summary: `Treino atribuido ${updated.title} atualizado.`,
    beforeData: existing,
    afterData: {
      status: updated.status,
      dueAt,
      studentNotes: input.studentNotes,
      feedback: input.feedback,
    },
  });

  return updated;
}

export async function getStudentTrainingSnapshot(viewer: ViewerContext) {
  const studentProfileId = requireStudentViewerContext(viewer);
  const now = new Date();
  const startOfMonth = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

  const [
    studentProfile,
    attendances,
    assignments,
    enrollments,
    monthPresentCount,
    monthNoShowCount,
  ] = await prisma.$transaction([
    prisma.studentProfile.findFirst({
      where: {
        AND: [
          getStudentVisibilityWhere(viewer),
          {
            id: studentProfileId,
          },
        ],
      },
      select: {
        id: true,
        registrationNumber: true,
        status: true,
        primaryModality: {
          select: {
            id: true,
            name: true,
          },
        },
        responsibleTeacher: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.attendance.findMany({
      where: {
        studentProfileId,
      },
      orderBy: [{ classDate: "desc" }, { createdAt: "desc" }],
      take: 24,
      select: {
        id: true,
        classDate: true,
        status: true,
        classSchedule: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            modality: {
              select: {
                name: true,
              },
            },
            teacherProfile: {
              select: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.trainingAssignment.findMany({
      where: {
        studentProfileId,
      },
      orderBy: [{ assignedAt: "desc" }],
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        assignedAt: true,
        dueAt: true,
        trainingTemplate: {
          select: {
            id: true,
            name: true,
            level: true,
            modality: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.classEnrollment.findMany({
      where: {
        studentProfileId,
        isActive: true,
        classSchedule: {
          isActive: true,
        },
      },
      select: {
        id: true,
        classSchedule: {
          select: {
            id: true,
            title: true,
            dayOfWeek: true,
            daysOfWeek: true,
            startTime: true,
            endTime: true,
            room: true,
            modality: {
              select: {
                name: true,
              },
            },
            teacherProfile: {
              select: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.attendance.count({
      where: {
        studentProfileId,
        classDate: {
          gte: startOfMonth,
        },
        status: {
          in: [AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT],
        },
      },
    }),
    prisma.attendance.count({
      where: {
        studentProfileId,
        classDate: {
          gte: startOfMonth,
        },
        status: AttendanceStatus.NO_SHOW,
      },
    }),
  ]);

  if (!studentProfile) {
    throw new NotFoundError("Aluno nao encontrado.");
  }

  const presentAttendances = attendances.filter(
    (attendance) =>
      attendance.status === AttendanceStatus.CHECKED_IN ||
      attendance.status === AttendanceStatus.CHECKED_OUT,
  );
  const distinctPresentDays = Array.from(
    new Set(
      presentAttendances.map((attendance) => attendance.classDate.toISOString().slice(0, 10)),
    ),
  );
  let currentStreak = 0;

  for (let index = 0; index < distinctPresentDays.length; index += 1) {
    const currentDate = new Date(`${distinctPresentDays[index]}T00:00:00.000Z`);

    if (index === 0) {
      currentStreak = 1;
      continue;
    }

    const previousDate = new Date(`${distinctPresentDays[index - 1]}T00:00:00.000Z`);
    const differenceInDays =
      (previousDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000);

    if (differenceInDays === 1) {
      currentStreak += 1;
      continue;
    }

    break;
  }

  const nextClasses = enrollments
    .map((enrollment) => {
      const nextOccurrence = buildNextClassOccurrence(enrollment.classSchedule, now);

      return {
        ...enrollment.classSchedule,
        nextOccurrence,
      };
    })
    .filter(
      (
        schedule,
      ): schedule is typeof schedule & {
        nextOccurrence: Date;
      } => Boolean(schedule.nextOccurrence),
    )
    .sort(
      (left, right) =>
        left.nextOccurrence.getTime() - right.nextOccurrence.getTime(),
    )
    .slice(0, 4);

  return {
    studentProfile,
    attendanceSummary: {
      monthPresentCount,
      monthNoShowCount,
      frequencyPercent:
        monthPresentCount + monthNoShowCount > 0
          ? Math.round(
              (monthPresentCount / (monthPresentCount + monthNoShowCount)) * 100,
            )
          : null,
      currentStreak,
    },
    recentAttendance: attendances.slice(0, 8),
    nextClasses,
    activeAssignments: assignments.filter(
      (assignment) =>
        assignment.status === TrainingAssignmentStatus.ASSIGNED ||
        assignment.status === TrainingAssignmentStatus.IN_PROGRESS,
    ),
    historyAssignments: assignments.filter(
      (assignment) =>
        assignment.status === TrainingAssignmentStatus.COMPLETED ||
        assignment.status === TrainingAssignmentStatus.MISSED ||
        assignment.status === TrainingAssignmentStatus.CANCELLED,
    ),
  };
}

export async function getTeacherTrainingSnapshot(viewer: ViewerContext) {
  const teacherProfileId = requireTeacherViewerContext(viewer);
  const now = new Date();
  const todayWeekday = now.getDay();
  const startToday = startOfDay(now);

  const [teacherProfile, todayClasses, recentAttendance, recentAssignments, summary] =
    await Promise.all([
      prisma.teacherProfile.findFirst({
        where: {
          AND: [
            getTeacherVisibilityWhere(viewer),
            {
              id: teacherProfileId,
            },
          ],
        },
        select: {
          id: true,
          registrationNumber: true,
          isActive: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.classSchedule.findMany({
        where: {
          teacherProfileId,
          isActive: true,
          OR: [
            {
              dayOfWeek: todayWeekday,
            },
            {
              daysOfWeek: {
                has: todayWeekday,
              },
            },
          ],
        },
        orderBy: [{ startTime: "asc" }],
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          room: true,
          dayOfWeek: true,
          daysOfWeek: true,
          modality: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              enrollments: {
                where: {
                  isActive: true,
                },
              },
            },
          },
        },
      }),
      prisma.attendance.findMany({
        where: {
          classSchedule: {
            teacherProfileId,
          },
        },
        orderBy: [{ classDate: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          classDate: true,
          status: true,
          studentProfile: {
            select: {
              registrationNumber: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          classSchedule: {
            select: {
              title: true,
              modality: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.trainingAssignment.findMany({
        where: {
          teacherProfileId,
        },
        orderBy: [{ assignedAt: "desc" }],
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          assignedAt: true,
          dueAt: true,
          studentProfile: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          trainingTemplate: {
            select: {
              name: true,
              modality: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.$transaction([
        prisma.trainingTemplate.count({
          where: {
            teacherProfileId,
            isActive: true,
          },
        }),
        prisma.trainingAssignment.count({
          where: {
            teacherProfileId,
            status: {
              in: [
                TrainingAssignmentStatus.ASSIGNED,
                TrainingAssignmentStatus.IN_PROGRESS,
              ],
            },
          },
        }),
        prisma.studentProfile.count({
          where: getStudentVisibilityWhere(viewer),
        }),
        prisma.attendance.count({
          where: {
            classSchedule: {
              teacherProfileId,
            },
            classDate: {
              gte: startToday,
            },
            status: {
              in: [AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT],
            },
          },
        }),
      ]),
    ]);

  if (!teacherProfile) {
    throw new NotFoundError("Professor nao encontrado.");
  }

  return {
    teacherProfile,
    todayClasses,
    recentAttendance,
    recentAssignments,
    summary: {
      activeTemplates: summary[0],
      activeAssignments: summary[1],
      linkedStudents: summary[2],
      todaysCheckIns: summary[3],
    },
  };
}

function mergeAnnouncementsById<
  TAnnouncement extends {
    id: string;
    isPinned: boolean;
    publishedAt: Date | null;
    createdAt: Date;
  },
>(announcements: TAnnouncement[]) {
  return Array.from(
    new Map(announcements.map((announcement) => [announcement.id, announcement])).values(),
  ).sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return Number(right.isPinned) - Number(left.isPinned);
    }

    const leftDate = left.publishedAt ?? left.createdAt;
    const rightDate = right.publishedAt ?? right.createdAt;
    return rightDate.getTime() - leftDate.getTime();
  });
}

function isAnnouncementVisibleToStudent(
  announcement: {
    targetRole: UserRole | null;
    createdByUser: {
      role: UserRole;
      teacherProfile: {
        id: string;
      } | null;
    };
  },
  teacherIds: string[],
) {
  if (
    announcement.targetRole !== null &&
    announcement.targetRole !== UserRole.ALUNO
  ) {
    return false;
  }

  if (
    announcement.createdByUser.role === UserRole.ADMIN ||
    announcement.createdByUser.role === UserRole.RECEPCAO
  ) {
    return true;
  }

  const teacherProfileId = announcement.createdByUser.teacherProfile?.id;
  return Boolean(teacherProfileId && teacherIds.includes(teacherProfileId));
}

async function getVisiblePublishedAnnouncements(
  viewer: ViewerContext,
  input?: {
    search?: string;
    targetRole?: UserRole;
    take?: number;
  },
) {
  const baseWhere: Prisma.AnnouncementWhereInput = {
    AND: [
      buildPublishedAnnouncementWhere(),
      input?.search
        ? {
            OR: [
              {
                title: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
              {
                excerpt: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
              {
                content: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
    ],
  };

  if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.RECEPCAO) {
    return prisma.announcement.findMany({
      where: {
        AND: [
          baseWhere,
          input?.targetRole
            ? {
                targetRole: input.targetRole,
              }
            : {},
        ],
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      take: input?.take,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        targetRole: true,
        isPinned: true,
        isPublished: true,
        publishedAt: true,
        expiresAt: true,
        createdAt: true,
        createdByUserId: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            role: true,
            teacherProfile: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });
  }

  if (viewer.role === UserRole.PROFESSOR) {
    return prisma.announcement.findMany({
      where: {
        AND: [
          baseWhere,
          {
            OR: [{ targetRole: null }, { targetRole: UserRole.PROFESSOR }],
          },
        ],
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      take: input?.take,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        targetRole: true,
        isPinned: true,
        isPublished: true,
        publishedAt: true,
        expiresAt: true,
        createdAt: true,
        createdByUserId: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            role: true,
            teacherProfile: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });
  }

  const teacherIds = await getStudentAnnouncementTeacherIds(viewer);
  const announcements = await prisma.announcement.findMany({
    where: {
      AND: [
        baseWhere,
        {
          OR: [{ targetRole: null }, { targetRole: UserRole.ALUNO }],
        },
      ],
    },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: input?.take ? input.take * 2 : undefined,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      targetRole: true,
      isPinned: true,
      isPublished: true,
      publishedAt: true,
      expiresAt: true,
      createdAt: true,
      createdByUserId: true,
      createdByUser: {
        select: {
          id: true,
          name: true,
          role: true,
          teacherProfile: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  return announcements
    .filter((announcement) =>
      isAnnouncementVisibleToStudent(announcement, teacherIds),
    )
    .slice(0, input?.take);
}

export async function getAnnouncementsIndexData(
  viewer: ViewerContext,
  filters: AnnouncementFiltersInput,
) {
  const canManage = hasPermission(viewer.role, "manageAnnouncements");
  const isPublishedFilter =
    filters.isPublished === undefined ? undefined : filters.isPublished;
  const now = Date.now();

  const buildAnnouncementSummary = (
    announcements: Array<{ isPublished: boolean; isPinned: boolean; expiresAt: Date | null }>,
  ) => ({
    total: announcements.length,
    published: announcements.filter((announcement) => announcement.isPublished).length,
    pinned: announcements.filter((announcement) => announcement.isPinned).length,
    expiringSoon: announcements.filter((announcement) => {
      if (!announcement.expiresAt) {
        return false;
      }

      return (
        announcement.expiresAt.getTime() > now &&
        announcement.expiresAt.getTime() <= now + 7 * 24 * 60 * 60 * 1000
      );
    }).length,
  });

  if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.RECEPCAO) {
    const adminWhere = {
      AND: [
        filters.search
          ? {
              OR: [
                {
                  title: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  excerpt: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  content: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {},
        filters.targetRole === undefined
          ? {}
          : filters.targetRole === null
            ? {
                targetRole: null,
              }
            : {
                targetRole: filters.targetRole,
              },
        isPublishedFilter === undefined
          ? {}
          : {
              isPublished: isPublishedFilter,
            },
      ],
    } satisfies Prisma.AnnouncementWhereInput;
    const [totalAnnouncements, publishedAnnouncements, pinnedAnnouncements, expiringSoonAnnouncements] =
      await Promise.all([
        prisma.announcement.count({ where: adminWhere }),
        prisma.announcement.count({
          where: {
            AND: [adminWhere, { isPublished: true }],
          },
        }),
        prisma.announcement.count({
          where: {
            AND: [adminWhere, { isPinned: true }],
          },
        }),
        prisma.announcement.count({
          where: {
            AND: [
              adminWhere,
              {
                expiresAt: {
                  gt: new Date(now),
                  lte: new Date(now + 7 * 24 * 60 * 60 * 1000),
                },
              },
            ],
          },
        }),
      ]);
    const pagination = buildOffsetPagination({
      page: filters.page,
      totalItems: totalAnnouncements,
    });
    const announcements = await prisma.announcement.findMany({
      where: adminWhere,
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        targetRole: true,
        isPinned: true,
        isPublished: true,
        publishedAt: true,
        expiresAt: true,
        createdAt: true,
        createdByUserId: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            role: true,
            teacherProfile: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    return {
      announcements,
      pagination,
      summary: {
        total: totalAnnouncements,
        published: publishedAnnouncements,
        pinned: pinnedAnnouncements,
        expiringSoon: expiringSoonAnnouncements,
      },
      canManage,
    };
  }

  if (viewer.role === UserRole.PROFESSOR) {
    const ownAnnouncements = await prisma.announcement.findMany({
      where: {
        AND: [
          {
            createdByUserId: viewer.userId,
          },
          filters.search
            ? {
                OR: [
                  {
                    title: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                  {
                    excerpt: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                  {
                    content: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {},
          filters.targetRole === undefined
            ? {}
            : filters.targetRole === null
              ? {
                  targetRole: null,
                }
              : {
                  targetRole: filters.targetRole,
                },
          isPublishedFilter === undefined
            ? {}
            : {
                isPublished: isPublishedFilter,
              },
        ],
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        targetRole: true,
        isPinned: true,
        isPublished: true,
        publishedAt: true,
        expiresAt: true,
        createdAt: true,
        createdByUserId: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            role: true,
            teacherProfile: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    const publicAnnouncements =
      isPublishedFilter === false
        ? []
        : await getVisiblePublishedAnnouncements(viewer, {
            search: filters.search,
            targetRole:
              filters.targetRole === UserRole.PROFESSOR ||
              filters.targetRole === undefined ||
              filters.targetRole === null
                ? filters.targetRole ?? undefined
                : undefined,
          });

    const mergedAnnouncements = mergeAnnouncementsById([
      ...ownAnnouncements,
      ...publicAnnouncements,
    ]);
    const pagination = buildOffsetPagination({
      page: filters.page,
      totalItems: mergedAnnouncements.length,
    });
    const announcements = mergedAnnouncements.slice(
      pagination.skip,
      pagination.skip + pagination.limit,
    );

    return {
      announcements,
      pagination,
      summary: buildAnnouncementSummary(mergedAnnouncements),
      canManage,
    };
  }

  const visibleAnnouncements = await getVisiblePublishedAnnouncements(viewer, {
    search: filters.search,
  });
  const pagination = buildOffsetPagination({
    page: filters.page,
    totalItems: visibleAnnouncements.length,
  });
  const announcements = visibleAnnouncements.slice(
    pagination.skip,
    pagination.skip + pagination.limit,
  );

  return {
    announcements,
    pagination,
    summary: buildAnnouncementSummary(visibleAnnouncements),
    canManage,
  };
}

export async function getDashboardAnnouncements(
  viewer: ViewerContext,
  take = 4,
) {
  return getVisiblePublishedAnnouncements(viewer, { take });
}

export async function getAnnouncementDetailData(
  viewer: ViewerContext,
  announcementId: string,
) {
  const announcement = await prisma.announcement.findUnique({
    where: {
      id: announcementId,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      targetRole: true,
      isPinned: true,
      isPublished: true,
      publishedAt: true,
      expiresAt: true,
      createdAt: true,
      createdByUserId: true,
      createdByUser: {
        select: {
          id: true,
          name: true,
          role: true,
          teacherProfile: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!announcement) {
    throw new NotFoundError("Aviso nao encontrado.");
  }

  if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.RECEPCAO) {
    return {
      announcement,
      canManage: true,
    };
  }

  if (viewer.role === UserRole.PROFESSOR) {
    const isPublishedAndActive =
      announcement.isPublished &&
      (!announcement.publishedAt || announcement.publishedAt <= new Date()) &&
      (!announcement.expiresAt || announcement.expiresAt > new Date());

    if (
      announcement.createdByUserId !== viewer.userId &&
      !(
        isPublishedAndActive &&
        (announcement.targetRole === null ||
          announcement.targetRole === UserRole.PROFESSOR)
      )
    ) {
      throw new NotFoundError("Aviso nao encontrado.");
    }

    return {
      announcement,
      canManage: true,
    };
  }

  const teacherIds = await getStudentAnnouncementTeacherIds(viewer);
  const isPublishedAndActive =
    announcement.isPublished &&
    (!announcement.publishedAt || announcement.publishedAt <= new Date()) &&
    (!announcement.expiresAt || announcement.expiresAt > new Date());

  if (
    !isPublishedAndActive ||
    (announcement.targetRole !== null &&
      announcement.targetRole !== UserRole.ALUNO) ||
    !isAnnouncementVisibleToStudent(announcement, teacherIds)
  ) {
    throw new NotFoundError("Aviso nao encontrado.");
  }

  return {
    announcement,
    canManage: false,
  };
}

export async function createAnnouncement(
  input: CreateAnnouncementInput,
  context: MutationContext,
) {
  if (
    context.viewer.role === UserRole.PROFESSOR &&
    input.targetRole !== UserRole.ALUNO
  ) {
    throw new ForbiddenError(
      "Professores podem publicar avisos apenas para alunos vinculados.",
    );
  }

  const slug = await generateUniqueAnnouncementSlug(
    slugify(input.slug ?? input.title),
  );
  const publishedAt = input.isPublished
    ? parseDateOnly(input.publishedAt) ?? new Date()
    : null;
  const expiresAt = parseDateOnly(input.expiresAt) ?? null;

  const announcement = await prisma.announcement.create({
    data: {
      title: input.title,
      slug,
      excerpt: normalizeOptionalString(input.excerpt),
      content: input.content.trim(),
      targetRole:
        context.viewer.role === UserRole.PROFESSOR
          ? UserRole.ALUNO
          : input.targetRole ?? null,
      isPinned: input.isPinned ?? false,
      isPublished: input.isPublished ?? true,
      publishedAt,
      expiresAt,
      createdByUserId: context.viewer.userId,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      targetRole: true,
      isPublished: true,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "ANNOUNCEMENT_CREATED",
    entityType: "Announcement",
    entityId: announcement.id,
    summary: `Aviso ${announcement.title} criado.`,
    afterData: {
      slug: announcement.slug,
      targetRole: announcement.targetRole,
      isPublished: announcement.isPublished,
      publishedAt,
      expiresAt,
    },
  });

  return announcement;
}

export async function updateAnnouncement(
  input: UpdateAnnouncementInput,
  context: MutationContext,
) {
  const existing = await prisma.announcement.findUnique({
    where: {
      id: input.id,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      targetRole: true,
      isPinned: true,
      isPublished: true,
      publishedAt: true,
      expiresAt: true,
      createdByUserId: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Aviso nao encontrado.");
  }

  assertCanManageAnnouncement(context.viewer, existing);

  if (
    context.viewer.role === UserRole.PROFESSOR &&
    input.targetRole !== UserRole.ALUNO
  ) {
    throw new ForbiddenError(
      "Professores podem publicar avisos apenas para alunos vinculados.",
    );
  }

  const slug = await generateUniqueAnnouncementSlug(
    slugify(input.slug ?? input.title),
    input.id,
  );
  const isPublished = input.isPublished ?? true;
  const publishedAt = isPublished
    ? parseDateOnly(input.publishedAt) ?? existing.publishedAt ?? new Date()
    : null;
  const expiresAt = parseDateOnly(input.expiresAt) ?? null;

  const announcement = await prisma.announcement.update({
    where: {
      id: input.id,
    },
    data: {
      title: input.title,
      slug,
      excerpt: normalizeOptionalString(input.excerpt),
      content: input.content.trim(),
      targetRole:
        context.viewer.role === UserRole.PROFESSOR
          ? UserRole.ALUNO
          : input.targetRole ?? null,
      isPinned: input.isPinned ?? false,
      isPublished,
      publishedAt,
      expiresAt,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      targetRole: true,
      isPublished: true,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "ANNOUNCEMENT_UPDATED",
    entityType: "Announcement",
    entityId: announcement.id,
    summary: `Aviso ${announcement.title} atualizado.`,
    beforeData: existing,
    afterData: {
      slug: announcement.slug,
      targetRole: announcement.targetRole,
      isPublished: announcement.isPublished,
      publishedAt,
      expiresAt,
    },
  });

  return announcement;
}

export async function unpublishAnnouncement(
  announcementId: string,
  context: MutationContext,
) {
  const existing = await prisma.announcement.findUnique({
    where: {
      id: announcementId,
    },
    select: {
      id: true,
      title: true,
      isPublished: true,
      createdByUserId: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Aviso nao encontrado.");
  }

  assertCanManageAnnouncement(context.viewer, existing);

  await prisma.announcement.update({
    where: {
      id: announcementId,
    },
    data: {
      isPublished: false,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "ANNOUNCEMENT_UNPUBLISHED",
    entityType: "Announcement",
    entityId: existing.id,
    summary: `Aviso ${existing.title} despublicado.`,
    beforeData: existing,
    afterData: {
      isPublished: false,
    },
  });
}

export async function getStudentPerformanceSnapshot(viewer: ViewerContext) {
  return getStudentTrainingSnapshot(viewer);
}

export async function getTeacherOperationalSnapshot(viewer: ViewerContext) {
  return getTeacherTrainingSnapshot(viewer);
}
