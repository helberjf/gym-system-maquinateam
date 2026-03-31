import type { Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import {
  getStudentVisibilityWhere,
  type ViewerContext,
} from "@/lib/academy/access";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

function impossibleId() {
  return "__no_access__";
}

export function getTrainingTemplateVisibilityWhere(
  viewer: ViewerContext,
): Prisma.TrainingTemplateWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
      return {};
    case UserRole.PROFESSOR:
      return viewer.teacherProfileId
        ? {
            OR: [
              {
                teacherProfileId: viewer.teacherProfileId,
              },
              {
                teacherProfileId: null,
              },
            ],
          }
        : {
            id: impossibleId(),
          };
    default:
      return {
        id: impossibleId(),
      };
  }
}

export function getTrainingAssignmentVisibilityWhere(
  viewer: ViewerContext,
): Prisma.TrainingAssignmentWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
      return {};
    case UserRole.PROFESSOR:
      return viewer.teacherProfileId
        ? {
            OR: [
              {
                teacherProfileId: viewer.teacherProfileId,
              },
              {
                studentProfile: {
                  is: getStudentVisibilityWhere(viewer),
                },
              },
            ],
          }
        : {
            id: impossibleId(),
          };
    case UserRole.ALUNO:
      return viewer.studentProfileId
        ? {
            studentProfileId: viewer.studentProfileId,
          }
        : {
            id: impossibleId(),
          };
    default:
      return {
        id: impossibleId(),
      };
  }
}

export async function ensureVisibleTrainingTemplate(
  viewer: ViewerContext,
  templateId: string,
) {
  const template = await prisma.trainingTemplate.findFirst({
    where: {
      AND: [getTrainingTemplateVisibilityWhere(viewer), { id: templateId }],
    },
    select: {
      id: true,
    },
  });

  if (!template) {
    throw new NotFoundError("Modelo de treino nao encontrado ou indisponivel.");
  }

  return template;
}

export async function ensureVisibleTrainingAssignment(
  viewer: ViewerContext,
  assignmentId: string,
) {
  const assignment = await prisma.trainingAssignment.findFirst({
    where: {
      AND: [
        getTrainingAssignmentVisibilityWhere(viewer),
        {
          id: assignmentId,
        },
      ],
    },
    select: {
      id: true,
    },
  });

  if (!assignment) {
    throw new NotFoundError("Treino atribuido nao encontrado ou indisponivel.");
  }

  return assignment;
}
