import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/permissions";

export type ViewerContext = {
  userId: string;
  role: UserRole;
  studentProfileId: string | null;
  teacherProfileId: string | null;
};

function impossibleWhere(): Prisma.StudentProfileWhereInput & {
  id: string;
} {
  return { id: "__no_access__" };
}

export function combineWhere(
  ...clauses: Array<Prisma.StudentProfileWhereInput | undefined>
) {
  const filtered = clauses.filter(
    (clause): clause is Prisma.StudentProfileWhereInput => Boolean(clause),
  );

  if (filtered.length === 0) {
    return {} satisfies Prisma.StudentProfileWhereInput;
  }

  if (filtered.length === 1) {
    return filtered[0] as Prisma.StudentProfileWhereInput;
  }

  return {
    AND: filtered,
  } satisfies Prisma.StudentProfileWhereInput;
}

export async function getViewerContextFromSession(session: Session) {
  const role = session.user.role;
  const userId = session.user.id;
  let studentProfileId: string | null = null;
  let teacherProfileId: string | null = null;

  if (role === UserRole.ALUNO || role === UserRole.PROFESSOR) {
    const [studentProfile, teacherProfile] = await Promise.all([
      role === UserRole.ALUNO
        ? prisma.studentProfile.findUnique({
            where: {
              userId,
            },
            select: {
              id: true,
            },
          })
        : null,
      role === UserRole.PROFESSOR
        ? prisma.teacherProfile.findUnique({
            where: {
              userId,
            },
            select: {
              id: true,
            },
          })
        : null,
    ]);

    studentProfileId = studentProfile?.id ?? null;
    teacherProfileId = teacherProfile?.id ?? null;
  }

  return {
    userId,
    role,
    studentProfileId,
    teacherProfileId,
  } satisfies ViewerContext;
}

export async function getCurrentViewerContext(callbackUrl = "/dashboard") {
  const session = await requireAuthenticatedSession(callbackUrl);
  return getViewerContextFromSession(session);
}

export function requireTeacherViewerContext(viewer: ViewerContext) {
  if (!viewer.teacherProfileId) {
    throw new ForbiddenError("Perfil de professor nao encontrado para esta conta.");
  }

  return viewer.teacherProfileId;
}

export function requireStudentViewerContext(viewer: ViewerContext) {
  if (!viewer.studentProfileId) {
    throw new ForbiddenError("Perfil de aluno nao encontrado para esta conta.");
  }

  return viewer.studentProfileId;
}

export function getStudentVisibilityWhere(
  viewer: ViewerContext,
): Prisma.StudentProfileWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
    case UserRole.RECEPCAO:
      return {};
    case UserRole.PROFESSOR: {
      if (!viewer.teacherProfileId) {
        return impossibleWhere();
      }

      return {
        OR: [
          {
            responsibleTeacherId: viewer.teacherProfileId,
          },
          {
            enrollments: {
              some: {
                isActive: true,
                classSchedule: {
                  teacherProfileId: viewer.teacherProfileId,
                },
              },
            },
          },
          {
            attendances: {
              some: {
                classSchedule: {
                  teacherProfileId: viewer.teacherProfileId,
                },
              },
            },
          },
        ],
      };
    }
    case UserRole.ALUNO:
      return viewer.studentProfileId
        ? {
            id: viewer.studentProfileId,
          }
        : impossibleWhere();
    default:
      return impossibleWhere();
  }
}

export function getTeacherVisibilityWhere(
  viewer: ViewerContext,
): Prisma.TeacherProfileWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
    case UserRole.RECEPCAO:
      return {};
    case UserRole.PROFESSOR:
      return viewer.teacherProfileId
        ? {
            id: viewer.teacherProfileId,
          }
        : {
            id: "__no_access__",
          };
    default:
      return {
        id: "__no_access__",
      };
  }
}

export function getModalityVisibilityWhere(
  viewer: ViewerContext,
): Prisma.ModalityWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
    case UserRole.RECEPCAO:
      return {};
    case UserRole.PROFESSOR:
      return viewer.teacherProfileId
        ? {
            OR: [
              {
                teachers: {
                  some: {
                    id: viewer.teacherProfileId,
                  },
                },
              },
              {
                classSchedules: {
                  some: {
                    teacherProfileId: viewer.teacherProfileId,
                  },
                },
              },
            ],
          }
        : {
            id: "__no_access__",
          };
    case UserRole.ALUNO:
      return viewer.studentProfileId
        ? {
            OR: [
              {
                primaryStudents: {
                  some: {
                    id: viewer.studentProfileId,
                  },
                },
              },
              {
                classEnrollments: {
                  some: {
                    isActive: true,
                    studentProfileId: viewer.studentProfileId,
                  },
                },
              },
            ],
          }
        : {
            id: "__no_access__",
          };
    default:
      return {
        id: "__no_access__",
      };
  }
}

export function getClassScheduleVisibilityWhere(
  viewer: ViewerContext,
): Prisma.ClassScheduleWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
    case UserRole.RECEPCAO:
      return {};
    case UserRole.PROFESSOR:
      return viewer.teacherProfileId
        ? {
            teacherProfileId: viewer.teacherProfileId,
          }
        : {
            id: "__no_access__",
          };
    case UserRole.ALUNO:
      return viewer.studentProfileId
        ? {
            enrollments: {
              some: {
                isActive: true,
                studentProfileId: viewer.studentProfileId,
              },
            },
          }
        : {
            id: "__no_access__",
          };
    default:
      return {
        id: "__no_access__",
      };
  }
}

export function getAttendanceVisibilityWhere(
  viewer: ViewerContext,
): Prisma.AttendanceWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
    case UserRole.RECEPCAO:
      return {};
    case UserRole.PROFESSOR:
      return viewer.teacherProfileId
        ? {
            classSchedule: {
              teacherProfileId: viewer.teacherProfileId,
            },
          }
        : {
            id: "__no_access__",
          };
    case UserRole.ALUNO:
      return viewer.studentProfileId
        ? {
            studentProfileId: viewer.studentProfileId,
          }
        : {
            id: "__no_access__",
          };
    default:
      return {
        id: "__no_access__",
      };
  }
}

export async function ensureVisibleStudent(
  viewer: ViewerContext,
  studentProfileId: string,
) {
  const record = await prisma.studentProfile.findFirst({
    where: combineWhere(
      getStudentVisibilityWhere(viewer),
      {
        id: studentProfileId,
      },
    ),
    select: {
      id: true,
    },
  });

  if (!record) {
    throw new NotFoundError("Aluno nao encontrado ou indisponivel.");
  }

  return record;
}

export async function ensureVisibleTeacher(
  viewer: ViewerContext,
  teacherProfileId: string,
) {
  const record = await prisma.teacherProfile.findFirst({
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
    },
  });

  if (!record) {
    throw new NotFoundError("Professor nao encontrado ou indisponivel.");
  }

  return record;
}

export async function ensureVisibleClassSchedule(
  viewer: ViewerContext,
  classScheduleId: string,
) {
  const record = await prisma.classSchedule.findFirst({
    where: {
      AND: [
        getClassScheduleVisibilityWhere(viewer),
        {
          id: classScheduleId,
        },
      ],
    },
    select: {
      id: true,
    },
  });

  if (!record) {
    throw new NotFoundError("Turma nao encontrada ou indisponivel.");
  }

  return record;
}
