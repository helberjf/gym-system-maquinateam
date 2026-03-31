import type { z } from "zod";
import {
  AttendanceStatus,
  Prisma,
  StudentStatus,
  UserRole,
} from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { logAuditEvent } from "@/lib/audit";
import {
  buildRegistrationNumber,
  slugify,
  startOfDay,
} from "@/lib/academy/constants";
import {
  combineWhere,
  ensureVisibleClassSchedule,
  ensureVisibleStudent,
  getAttendanceVisibilityWhere,
  getClassScheduleVisibilityWhere,
  getModalityVisibilityWhere,
  getStudentVisibilityWhere,
  getTeacherVisibilityWhere,
  type ViewerContext,
} from "@/lib/academy/access";
import {
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  attendanceFiltersSchema,
  checkInSchema,
  checkOutSchema,
  classScheduleFiltersSchema,
  createClassScheduleSchema,
  createModalitySchema,
  createStudentSchema,
  createTeacherSchema,
  modalityFiltersSchema,
  studentFiltersSchema,
  teacherFiltersSchema,
  updateClassScheduleSchema,
  updateModalitySchema,
  updateStudentSchema,
  updateTeacherSchema,
} from "@/lib/validators";

type StudentFiltersInput = z.infer<typeof studentFiltersSchema>;
type TeacherFiltersInput = z.infer<typeof teacherFiltersSchema>;
type ModalityFiltersInput = z.infer<typeof modalityFiltersSchema>;
type ClassScheduleFiltersInput = z.infer<typeof classScheduleFiltersSchema>;
type AttendanceFiltersInput = z.infer<typeof attendanceFiltersSchema>;
type CreateStudentInput = z.infer<typeof createStudentSchema>;
type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
type CreateModalityInput = z.infer<typeof createModalitySchema>;
type UpdateModalityInput = z.infer<typeof updateModalitySchema>;
type CreateClassScheduleInput = z.infer<typeof createClassScheduleSchema>;
type UpdateClassScheduleInput = z.infer<typeof updateClassScheduleSchema>;
type CheckInInput = z.infer<typeof checkInSchema>;
type CheckOutInput = z.infer<typeof checkOutSchema>;

type MutationContext = {
  viewer: ViewerContext;
  request?: Request;
};

function parseDateOnly(value?: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function normalizeOptionalString(value?: string | null) {
  return value?.trim() || null;
}

function normalizeOptionalUppercase(value?: string | null) {
  return value?.trim().toUpperCase() || null;
}

function normalizeStudentUserActive(status: StudentStatus) {
  return status !== StudentStatus.INACTIVE;
}

async function ensureActiveModality(
  tx: Prisma.TransactionClient,
  modalityId: string,
) {
  const modality = await tx.modality.findUnique({
    where: {
      id: modalityId,
    },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  });

  if (!modality) {
    throw new NotFoundError("Modalidade nao encontrada.");
  }

  if (!modality.isActive) {
    throw new ConflictError("Selecione uma modalidade ativa.");
  }

  return modality;
}

async function ensureTeacherExists(
  tx: Prisma.TransactionClient,
  teacherProfileId: string,
) {
  const teacher = await tx.teacherProfile.findUnique({
    where: {
      id: teacherProfileId,
    },
    select: {
      id: true,
      isActive: true,
      user: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
      modalities: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!teacher) {
    throw new NotFoundError("Professor nao encontrado.");
  }

  if (!teacher.isActive || !teacher.user.isActive) {
    throw new ConflictError("Selecione um professor ativo.");
  }

  return teacher;
}

async function ensureStudentsAvailable(
  tx: Prisma.TransactionClient,
  studentIds: string[],
) {
  if (studentIds.length === 0) {
    return [];
  }

  const students = await tx.studentProfile.findMany({
    where: {
      id: {
        in: studentIds,
      },
      user: {
        isActive: true,
      },
      status: {
        not: StudentStatus.INACTIVE,
      },
    },
    select: {
      id: true,
      registrationNumber: true,
      status: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (students.length !== studentIds.length) {
    throw new ConflictError(
      "Um ou mais alunos selecionados nao estao ativos para matricula.",
    );
  }

  return students;
}

async function ensureTeacherTeachesModality(
  tx: Prisma.TransactionClient,
  teacherProfileId: string,
  modalityId: string,
) {
  const teacher = await ensureTeacherExists(tx, teacherProfileId);
  const teachesModality = teacher.modalities.some(
    (modality) => modality.id === modalityId,
  );

  if (!teachesModality) {
    throw new ConflictError(
      "O professor selecionado ainda nao esta vinculado a esta modalidade.",
    );
  }

  return teacher;
}

async function getStudentOptions(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "manageStudents")) {
    return null;
  }

  const [modalities, teachers] = await prisma.$transaction([
    prisma.modality.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.teacherProfile.findMany({
      where: {
        isActive: true,
        user: {
          isActive: true,
        },
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

  return { modalities, teachers };
}

async function getTeacherOptions(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "manageTeachers")) {
    return null;
  }

  const modalities = await prisma.modality.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
    },
  });

  return { modalities };
}

async function getClassScheduleOptions(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "manageClassSchedules")) {
    return null;
  }

  const [modalities, teachers, students] = await prisma.$transaction([
    prisma.modality.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.teacherProfile.findMany({
      where: {
        isActive: true,
        user: {
          isActive: true,
        },
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
        modalities: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.studentProfile.findMany({
      where: {
        user: {
          isActive: true,
        },
        status: {
          not: StudentStatus.INACTIVE,
        },
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
  ]);

  return { modalities, teachers, students };
}

function buildDateRangeWhere(filters: AttendanceFiltersInput) {
  if (!filters.dateFrom && !filters.dateTo) {
    return undefined;
  }

  return {
    classDate: {
      ...(filters.dateFrom ? { gte: parseDateOnly(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: parseDateOnly(filters.dateTo) } : {}),
    },
  } satisfies Prisma.AttendanceWhereInput;
}

async function syncScheduleEnrollments(params: {
  tx: Prisma.TransactionClient;
  classScheduleId: string;
  modalityId: string;
  studentIds: string[];
  actorId: string;
}) {
  const existing = await params.tx.classEnrollment.findMany({
    where: {
      classScheduleId: params.classScheduleId,
    },
    select: {
      id: true,
      studentProfileId: true,
      isActive: true,
    },
  });

  const desiredIds = new Set(params.studentIds);
  const existingByStudentId = new Map(
    existing.map((record) => [record.studentProfileId, record]),
  );

  for (const studentId of params.studentIds) {
    const current = existingByStudentId.get(studentId);

    if (!current) {
      await params.tx.classEnrollment.create({
        data: {
          studentProfileId: studentId,
          classScheduleId: params.classScheduleId,
          modalityId: params.modalityId,
          createdByUserId: params.actorId,
          startsAt: startOfDay(),
          isActive: true,
        },
      });
      continue;
    }

    if (!current.isActive) {
      await params.tx.classEnrollment.update({
        where: {
          id: current.id,
        },
        data: {
          isActive: true,
          startsAt: startOfDay(),
          endsAt: null,
          modalityId: params.modalityId,
        },
      });
    } else {
      await params.tx.classEnrollment.update({
        where: {
          id: current.id,
        },
        data: {
          modalityId: params.modalityId,
        },
      });
    }
  }

  const removableIds = existing
    .filter((record) => record.isActive && !desiredIds.has(record.studentProfileId))
    .map((record) => record.id);

  if (removableIds.length > 0) {
    await params.tx.classEnrollment.updateMany({
      where: {
        id: {
          in: removableIds,
        },
      },
      data: {
        isActive: false,
        endsAt: startOfDay(),
      },
    });
  }
}

export async function getStudentsIndexData(
  viewer: ViewerContext,
  filters: StudentFiltersInput,
) {
  const where = combineWhere(
    getStudentVisibilityWhere(viewer),
    filters.search
      ? {
          OR: [
            {
              user: {
                name: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            },
            {
              user: {
                email: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            },
            {
              registrationNumber: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
          ],
        }
      : undefined,
    filters.status
      ? {
          status: filters.status,
        }
      : undefined,
    filters.modalityId
      ? {
          primaryModalityId: filters.modalityId,
        }
      : undefined,
    filters.teacherId
      ? {
          responsibleTeacherId: filters.teacherId,
        }
      : undefined,
    filters.onlyInactive === true
      ? {
          user: {
            isActive: false,
          },
        }
      : filters.onlyInactive === false
        ? {
            user: {
              isActive: true,
            },
          }
        : undefined,
  );

  const [students, options] = await Promise.all([
    prisma.studentProfile.findMany({
      where,
      orderBy: [
        {
          user: {
            name: "asc",
          },
        },
      ],
      select: {
        id: true,
        registrationNumber: true,
        status: true,
        joinedAt: true,
        primaryModality: {
          select: {
            id: true,
            name: true,
            colorHex: true,
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
        enrollments: {
          where: {
            isActive: true,
          },
          take: 2,
          orderBy: {
            enrolledAt: "desc",
          },
          select: {
            id: true,
            classSchedule: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        _count: {
          select: {
            attendances: true,
            enrollments: true,
          },
        },
      },
    }),
    getStudentOptions(viewer),
  ]);

  return {
    students,
    options,
    canManage: hasPermission(viewer.role, "manageStudents"),
  };
}

export async function getStudentDetailData(
  viewer: ViewerContext,
  studentProfileId: string,
) {
  const student = await prisma.studentProfile.findFirst({
    where: combineWhere(getStudentVisibilityWhere(viewer), {
      id: studentProfileId,
    }),
    select: {
      id: true,
      registrationNumber: true,
      status: true,
      birthDate: true,
      cpf: true,
      city: true,
      state: true,
      joinedAt: true,
      beltLevel: true,
      weightKg: true,
      heightCm: true,
      goals: true,
      notes: true,
      medicalNotes: true,
      primaryModalityId: true,
      responsibleTeacherId: true,
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
              email: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
        },
      },
      enrollments: {
        where: {
          ...(viewer.role === UserRole.PROFESSOR && viewer.teacherProfileId
            ? {
                classSchedule: {
                  teacherProfileId: viewer.teacherProfileId,
                },
              }
            : {}),
        },
        orderBy: [{ isActive: "desc" }, { enrolledAt: "desc" }],
        select: {
          id: true,
          isActive: true,
          startsAt: true,
          endsAt: true,
          notes: true,
          classSchedule: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              dayOfWeek: true,
              daysOfWeek: true,
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
      },
      attendances: {
        where:
          viewer.role === UserRole.PROFESSOR && viewer.teacherProfileId
            ? {
                classSchedule: {
                  teacherProfileId: viewer.teacherProfileId,
                },
              }
            : undefined,
        take: 12,
        orderBy: [{ classDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          classDate: true,
          status: true,
          checkedInAt: true,
          checkedOutAt: true,
          classSchedule: {
            select: {
              id: true,
              title: true,
              modality: {
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

  if (!student) {
    throw new NotFoundError("Aluno nao encontrado ou indisponivel.");
  }

  return {
    student,
    options: await getStudentOptions(viewer),
    canManage: hasPermission(viewer.role, "manageStudents"),
  };
}

export async function getTeachersIndexData(
  viewer: ViewerContext,
  filters: TeacherFiltersInput,
) {
  const where: Prisma.TeacherProfileWhereInput = {
    AND: [
      getTeacherVisibilityWhere(viewer),
      filters.search
        ? {
            OR: [
              {
                user: {
                  name: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              },
              {
                user: {
                  email: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {},
      filters.modalityId
        ? {
            modalities: {
              some: {
                id: filters.modalityId,
              },
            },
          }
        : {},
      filters.onlyInactive === true
        ? {
            OR: [{ isActive: false }, { user: { isActive: false } }],
          }
        : filters.onlyInactive === false
          ? {
              isActive: true,
              user: {
                isActive: true,
              },
            }
          : {},
    ],
  };

  const [teachers, options] = await Promise.all([
    prisma.teacherProfile.findMany({
      where,
      orderBy: {
        user: {
          name: "asc",
        },
      },
      select: {
        id: true,
        registrationNumber: true,
        specialties: true,
        experienceYears: true,
        isActive: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
        modalities: {
          select: {
            id: true,
            name: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        _count: {
          select: {
            classes: true,
            responsibleStudents: true,
          },
        },
      },
    }),
    getTeacherOptions(viewer),
  ]);

  return {
    teachers,
    options,
    canManage: hasPermission(viewer.role, "manageTeachers"),
  };
}

export async function getTeacherDetailData(
  viewer: ViewerContext,
  teacherProfileId: string,
) {
  const teacher = await prisma.teacherProfile.findFirst({
    where: {
      AND: [getTeacherVisibilityWhere(viewer), { id: teacherProfileId }],
    },
    select: {
      id: true,
      registrationNumber: true,
      cpf: true,
      specialties: true,
      experienceYears: true,
      hireDate: true,
      beltLevel: true,
      notes: true,
      bio: true,
      isActive: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
        },
      },
      modalities: {
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      classes: {
        orderBy: [{ isActive: "desc" }, { startTime: "asc" }],
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          dayOfWeek: true,
          daysOfWeek: true,
          isActive: true,
          modality: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
      },
      responsibleStudents: {
        take: 8,
        orderBy: {
          joinedAt: "desc",
        },
        select: {
          id: true,
          registrationNumber: true,
          status: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!teacher) {
    throw new NotFoundError("Professor nao encontrado ou indisponivel.");
  }

  return {
    teacher,
    options: await getTeacherOptions(viewer),
    canManage: hasPermission(viewer.role, "manageTeachers"),
  };
}

export async function getModalitiesIndexData(
  viewer: ViewerContext,
  filters: ModalityFiltersInput,
) {
  const where: Prisma.ModalityWhereInput = {
    AND: [
      getModalityVisibilityWhere(viewer),
      filters.search
        ? {
            OR: [
              {
                name: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
      filters.onlyInactive === true
        ? {
            isActive: false,
          }
        : filters.onlyInactive === false
          ? {
              isActive: true,
            }
          : {},
    ],
  };

  const modalities = await prisma.modality.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      colorHex: true,
      sortOrder: true,
      isActive: true,
      _count: {
        select: {
          classSchedules: true,
          teachers: true,
          primaryStudents: true,
        },
      },
    },
  });

  return {
    modalities,
    canManage: hasPermission(viewer.role, "manageModalities"),
  };
}

export async function getModalityDetailData(
  viewer: ViewerContext,
  modalityId: string,
) {
  const modality = await prisma.modality.findFirst({
    where: {
      AND: [getModalityVisibilityWhere(viewer), { id: modalityId }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      colorHex: true,
      sortOrder: true,
      isActive: true,
      teachers: {
        select: {
          id: true,
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          user: {
            name: "asc",
          },
        },
      },
      classSchedules: {
        where:
          viewer.role === UserRole.ALUNO
            ? {
                enrollments: {
                  some: {
                    studentProfileId: viewer.studentProfileId ?? "__no_access__",
                    isActive: true,
                  },
                },
              }
            : viewer.role === UserRole.PROFESSOR
              ? {
                  teacherProfileId: viewer.teacherProfileId ?? "__no_access__",
                }
              : undefined,
        orderBy: [{ isActive: "desc" }, { startTime: "asc" }],
        select: {
          id: true,
          title: true,
          isActive: true,
          startTime: true,
          endTime: true,
          dayOfWeek: true,
          daysOfWeek: true,
          teacherProfile: {
            select: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
      },
      primaryStudents: {
        take: 10,
        select: {
          id: true,
          registrationNumber: true,
          status: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!modality) {
    throw new NotFoundError("Modalidade nao encontrada ou indisponivel.");
  }

  return {
    modality,
    canManage: hasPermission(viewer.role, "manageModalities"),
  };
}

export async function getClassSchedulesIndexData(
  viewer: ViewerContext,
  filters: ClassScheduleFiltersInput,
) {
  const where: Prisma.ClassScheduleWhereInput = {
    AND: [
      getClassScheduleVisibilityWhere(viewer),
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
                room: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
      filters.modalityId
        ? {
            modalityId: filters.modalityId,
          }
        : {},
      filters.teacherId
        ? {
            teacherProfileId: filters.teacherId,
          }
        : {},
      filters.dayOfWeek !== undefined
        ? {
            OR: [
              {
                dayOfWeek: filters.dayOfWeek,
              },
              {
                daysOfWeek: {
                  has: filters.dayOfWeek,
                },
              },
            ],
          }
        : {},
      filters.onlyInactive === true
        ? {
            isActive: false,
          }
        : filters.onlyInactive === false
          ? {
              isActive: true,
            }
          : {},
    ],
  };

  const [classSchedules, options] = await Promise.all([
    prisma.classSchedule.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { startTime: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        dayOfWeek: true,
        daysOfWeek: true,
        startTime: true,
        endTime: true,
        room: true,
        capacity: true,
        isActive: true,
        modality: {
          select: {
            id: true,
            name: true,
            colorHex: true,
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
        _count: {
          select: {
            enrollments: {
              where: {
                isActive: true,
              },
            },
            attendances: true,
          },
        },
      },
    }),
    getClassScheduleOptions(viewer),
  ]);

  return {
    classSchedules,
    options,
    canManage: hasPermission(viewer.role, "manageClassSchedules"),
  };
}

export async function getClassScheduleDetailData(
  viewer: ViewerContext,
  classScheduleId: string,
) {
  const classSchedule = await prisma.classSchedule.findFirst({
    where: {
      AND: [getClassScheduleVisibilityWhere(viewer), { id: classScheduleId }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      modalityId: true,
      teacherProfileId: true,
      dayOfWeek: true,
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      room: true,
      capacity: true,
      isActive: true,
      validFrom: true,
      validUntil: true,
      modality: {
        select: {
          id: true,
          name: true,
          colorHex: true,
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
      enrollments: {
        orderBy: [{ isActive: "desc" }, { enrolledAt: "desc" }],
        select: {
          id: true,
          isActive: true,
          startsAt: true,
          endsAt: true,
          studentProfile: {
            select: {
              id: true,
              registrationNumber: true,
              status: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      attendances: {
        take: 12,
        orderBy: [{ classDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          classDate: true,
          status: true,
          checkedInAt: true,
          checkedOutAt: true,
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

  if (!classSchedule) {
    throw new NotFoundError("Turma nao encontrada ou indisponivel.");
  }

  return {
    classSchedule,
    options: await getClassScheduleOptions(viewer),
    canManage: hasPermission(viewer.role, "manageClassSchedules"),
  };
}

export async function getAttendancePageData(
  viewer: ViewerContext,
  filters: AttendanceFiltersInput,
) {
  const today = startOfDay();
  const attendanceWhere: Prisma.AttendanceWhereInput = {
    AND: [
      getAttendanceVisibilityWhere(viewer),
      buildDateRangeWhere(filters) ?? {},
      filters.studentId
        ? {
            studentProfileId: filters.studentId,
          }
        : {},
      filters.classScheduleId
        ? {
            classScheduleId: filters.classScheduleId,
          }
        : {},
      filters.status
        ? {
            status: filters.status,
          }
        : {},
      filters.modalityId
        ? {
            classSchedule: {
              modalityId: filters.modalityId,
            },
          }
        : {},
      filters.teacherId
        ? {
            classSchedule: {
              teacherProfileId: filters.teacherId,
            },
          }
        : {},
    ],
  };

  const [records, todayClasses, classSchedules, modalities, teachers, students] =
    await prisma.$transaction([
      prisma.attendance.findMany({
        where: attendanceWhere,
        take: 120,
        orderBy: [{ classDate: "desc" }, { checkedInAt: "desc" }],
        select: {
          id: true,
          classDate: true,
          status: true,
          notes: true,
          checkedInAt: true,
          checkedOutAt: true,
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
          classSchedule: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
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
            },
          },
        },
      }),
      prisma.classSchedule.findMany({
        where: {
          AND: [
            getClassScheduleVisibilityWhere(viewer),
            {
              isActive: true,
            },
            filters.classScheduleId
              ? {
                  id: filters.classScheduleId,
                }
              : {},
            filters.modalityId
              ? {
                  modalityId: filters.modalityId,
                }
              : {},
            filters.teacherId
              ? {
                  teacherProfileId: filters.teacherId,
                }
              : {},
          ],
        },
        orderBy: [{ startTime: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          dayOfWeek: true,
          daysOfWeek: true,
          room: true,
          capacity: true,
          modality: {
            select: {
              id: true,
              name: true,
              colorHex: true,
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
          enrollments: {
            where: {
              isActive: true,
              ...(filters.studentId
                ? {
                    studentProfileId: filters.studentId,
                  }
                : {}),
            },
            orderBy: {
              enrolledAt: "asc",
            },
            select: {
              id: true,
              studentProfile: {
                select: {
                  id: true,
                  registrationNumber: true,
                  status: true,
                  user: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          attendances: {
            where: {
              classDate: today,
            },
            select: {
              id: true,
              studentProfileId: true,
              status: true,
              checkedInAt: true,
              checkedOutAt: true,
            },
          },
        },
      }),
      prisma.classSchedule.findMany({
        where: {
          AND: [getClassScheduleVisibilityWhere(viewer), { isActive: true }],
        },
        orderBy: [{ startTime: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
        },
      }),
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
      prisma.teacherProfile.findMany({
        where: {
          AND: [
            getTeacherVisibilityWhere(viewer),
            {
              isActive: true,
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
          user: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.studentProfile.findMany({
        where: combineWhere(getStudentVisibilityWhere(viewer), {
          user: {
            isActive: true,
          },
          status: {
            not: StudentStatus.INACTIVE,
          },
        }),
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
    ]);

  const summary = records.reduce(
    (accumulator, record) => {
      accumulator.total += 1;
      accumulator.byStatus[record.status] += 1;
      accumulator.byClass[record.classSchedule.title] =
        (accumulator.byClass[record.classSchedule.title] ?? 0) + 1;
      accumulator.byModality[record.classSchedule.modality.name] =
        (accumulator.byModality[record.classSchedule.modality.name] ?? 0) + 1;
      accumulator.byTeacher[record.classSchedule.teacherProfile.user.name] =
        (accumulator.byTeacher[record.classSchedule.teacherProfile.user.name] ?? 0) + 1;
      return accumulator;
    },
    {
      total: 0,
      byStatus: {
        PENDING: 0,
        CHECKED_IN: 0,
        CHECKED_OUT: 0,
        NO_SHOW: 0,
        CANCELLED: 0,
      } as Record<AttendanceStatus, number>,
      byClass: {} as Record<string, number>,
      byModality: {} as Record<string, number>,
      byTeacher: {} as Record<string, number>,
    },
  );

  return {
    today,
    records,
    todayClasses,
    options: {
      classSchedules,
      modalities,
      teachers,
      students,
    },
    summary,
    canManage: hasPermission(viewer.role, "manageAttendance"),
  };
}

export async function createStudent(
  input: CreateStudentInput,
  context: MutationContext,
) {
  const passwordHash = await hashPassword(input.password);
  const joinedAt = parseDateOnly(input.joinedAt) ?? startOfDay();

  const result = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: {
        email: input.email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictError("Ja existe um usuario com este e-mail.");
    }

    if (input.cpf) {
      const existingCpf = await tx.studentProfile.findUnique({
        where: {
          cpf: input.cpf,
        },
        select: {
          id: true,
        },
      });

      if (existingCpf) {
        throw new ConflictError("Ja existe um aluno com este CPF.");
      }
    }

    if (input.primaryModalityId) {
      await ensureActiveModality(tx, input.primaryModalityId);
    }

    if (input.responsibleTeacherId) {
      await ensureTeacherExists(tx, input.responsibleTeacherId);
    }

    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: normalizeOptionalString(input.phone),
        role: UserRole.ALUNO,
        isActive: normalizeStudentUserActive(input.status),
        emailVerified: new Date(),
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const student = await tx.studentProfile.create({
      data: {
        userId: user.id,
        registrationNumber:
          normalizeOptionalUppercase(input.registrationNumber) ??
          buildRegistrationNumber("ALU", user.id),
        status: input.status,
        primaryModalityId: input.primaryModalityId ?? null,
        responsibleTeacherId: input.responsibleTeacherId ?? null,
        birthDate: parseDateOnly(input.birthDate),
        cpf: input.cpf ?? null,
        city: normalizeOptionalString(input.city),
        state: normalizeOptionalUppercase(input.state),
        joinedAt,
        beltLevel: normalizeOptionalString(input.beltLevel),
        weightKg: input.weightKg ?? null,
        heightCm: input.heightCm ?? null,
        goals: normalizeOptionalString(input.goals),
        notes: normalizeOptionalString(input.notes),
      },
      select: {
        id: true,
        registrationNumber: true,
      },
    });

    return { user, student };
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "STUDENT_CREATED",
    entityType: "StudentProfile",
    entityId: result.student.id,
    summary: `Aluno ${result.user.name} criado pela operacao interna.`,
    afterData: {
      email: result.user.email,
      registrationNumber: result.student.registrationNumber,
      status: input.status,
    },
  });

  return result;
}

export async function updateStudent(
  input: UpdateStudentInput,
  context: MutationContext,
) {
  const existing = await prisma.studentProfile.findUnique({
    where: {
      id: input.id,
    },
    select: {
      id: true,
      registrationNumber: true,
      status: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Aluno nao encontrado.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const emailOwner = await tx.user.findUnique({
      where: {
        email: input.email,
      },
      select: {
        id: true,
      },
    });

    if (emailOwner && emailOwner.id !== existing.user.id) {
      throw new ConflictError("Ja existe um usuario com este e-mail.");
    }

    if (input.cpf) {
      const cpfOwner = await tx.studentProfile.findUnique({
        where: {
          cpf: input.cpf,
        },
        select: {
          id: true,
        },
      });

      if (cpfOwner && cpfOwner.id !== input.id) {
        throw new ConflictError("Ja existe um aluno com este CPF.");
      }
    }

    if (input.primaryModalityId) {
      await ensureActiveModality(tx, input.primaryModalityId);
    }

    if (input.responsibleTeacherId) {
      await ensureTeacherExists(tx, input.responsibleTeacherId);
    }

    await tx.user.update({
      where: {
        id: existing.user.id,
      },
      data: {
        name: input.name,
        email: input.email,
        phone: normalizeOptionalString(input.phone),
        isActive: normalizeStudentUserActive(input.status),
      },
    });

    const student = await tx.studentProfile.update({
      where: {
        id: input.id,
      },
      data: {
        registrationNumber:
          normalizeOptionalUppercase(input.registrationNumber) ??
          existing.registrationNumber,
        status: input.status,
        primaryModalityId: input.primaryModalityId ?? null,
        responsibleTeacherId: input.responsibleTeacherId ?? null,
        birthDate: parseDateOnly(input.birthDate) ?? null,
        cpf: input.cpf ?? null,
        city: normalizeOptionalString(input.city),
        state: normalizeOptionalUppercase(input.state),
        joinedAt: parseDateOnly(input.joinedAt) ?? undefined,
        beltLevel: normalizeOptionalString(input.beltLevel),
        weightKg: input.weightKg ?? null,
        heightCm: input.heightCm ?? null,
        goals: normalizeOptionalString(input.goals),
        notes: normalizeOptionalString(input.notes),
      },
      select: {
        id: true,
        registrationNumber: true,
        status: true,
      },
    });

    if (input.status === StudentStatus.INACTIVE) {
      await tx.classEnrollment.updateMany({
        where: {
          studentProfileId: input.id,
          isActive: true,
        },
        data: {
          isActive: false,
          endsAt: startOfDay(),
        },
      });
    }

    return student;
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "STUDENT_UPDATED",
    entityType: "StudentProfile",
    entityId: result.id,
    summary: `Aluno ${input.name} atualizado pela operacao interna.`,
    beforeData: {
      email: existing.user.email,
      registrationNumber: existing.registrationNumber,
      status: existing.status,
    },
    afterData: {
      email: input.email,
      registrationNumber: result.registrationNumber,
      status: result.status,
    },
  });

  return result;
}

export async function deactivateStudent(
  studentProfileId: string,
  context: MutationContext,
) {
  const existing = await prisma.studentProfile.findUnique({
    where: {
      id: studentProfileId,
    },
    select: {
      id: true,
      status: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Aluno nao encontrado.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: existing.user.id,
      },
      data: {
        isActive: false,
      },
    }),
    prisma.studentProfile.update({
      where: {
        id: studentProfileId,
      },
      data: {
        status: StudentStatus.INACTIVE,
      },
    }),
    prisma.classEnrollment.updateMany({
      where: {
        studentProfileId,
        isActive: true,
      },
      data: {
        isActive: false,
        endsAt: startOfDay(),
      },
    }),
  ]);

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "STUDENT_DEACTIVATED",
    entityType: "StudentProfile",
    entityId: studentProfileId,
    summary: `Aluno ${existing.user.name} inativado.`,
    beforeData: {
      status: existing.status,
    },
    afterData: {
      status: StudentStatus.INACTIVE,
    },
  });
}

export async function createTeacher(
  input: CreateTeacherInput,
  context: MutationContext,
) {
  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: {
        email: input.email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictError("Ja existe um usuario com este e-mail.");
    }

    if (input.cpf) {
      const existingCpf = await tx.teacherProfile.findUnique({
        where: {
          cpf: input.cpf,
        },
        select: {
          id: true,
        },
      });

      if (existingCpf) {
        throw new ConflictError("Ja existe um professor com este CPF.");
      }
    }

    const validModalities = await tx.modality.findMany({
      where: {
        id: {
          in: input.modalityIds,
        },
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (validModalities.length !== input.modalityIds.length) {
      throw new ConflictError("Selecione apenas modalidades ativas para o professor.");
    }

    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: normalizeOptionalString(input.phone),
        role: UserRole.PROFESSOR,
        isActive: input.isActive ?? true,
        emailVerified: new Date(),
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const teacher = await tx.teacherProfile.create({
      data: {
        userId: user.id,
        registrationNumber:
          normalizeOptionalUppercase(input.registrationNumber) ??
          buildRegistrationNumber("PROF", user.id),
        cpf: input.cpf ?? null,
        specialties: normalizeOptionalString(input.specialties),
        bio: normalizeOptionalString(input.notes),
        experienceYears: input.experienceYears ?? null,
        hireDate: parseDateOnly(input.hireDate),
        beltLevel: normalizeOptionalString(input.beltLevel),
        notes: normalizeOptionalString(input.notes),
        isActive: input.isActive ?? true,
        modalities: {
          connect: input.modalityIds.map((id) => ({ id })),
        },
      },
      select: {
        id: true,
        registrationNumber: true,
      },
    });

    return { user, teacher };
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "TEACHER_CREATED",
    entityType: "TeacherProfile",
    entityId: result.teacher.id,
    summary: `Professor ${result.user.name} criado pela operacao interna.`,
    afterData: {
      email: result.user.email,
      registrationNumber: result.teacher.registrationNumber,
    },
  });

  return result;
}

export async function updateTeacher(
  input: UpdateTeacherInput,
  context: MutationContext,
) {
  const existing = await prisma.teacherProfile.findUnique({
    where: {
      id: input.id,
    },
    select: {
      id: true,
      registrationNumber: true,
      isActive: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Professor nao encontrado.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const emailOwner = await tx.user.findUnique({
      where: {
        email: input.email,
      },
      select: {
        id: true,
      },
    });

    if (emailOwner && emailOwner.id !== existing.user.id) {
      throw new ConflictError("Ja existe um usuario com este e-mail.");
    }

    if (input.cpf) {
      const cpfOwner = await tx.teacherProfile.findUnique({
        where: {
          cpf: input.cpf,
        },
        select: {
          id: true,
        },
      });

      if (cpfOwner && cpfOwner.id !== input.id) {
        throw new ConflictError("Ja existe um professor com este CPF.");
      }
    }

    if (input.isActive === false) {
      const activeClasses = await tx.classSchedule.count({
        where: {
          teacherProfileId: input.id,
          isActive: true,
        },
      });

      if (activeClasses > 0) {
        throw new ConflictError(
          "Reatribua ou inative as turmas deste professor antes de inativa-lo.",
        );
      }
    }

    const validModalities = await tx.modality.findMany({
      where: {
        id: {
          in: input.modalityIds,
        },
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (validModalities.length !== input.modalityIds.length) {
      throw new ConflictError("Selecione apenas modalidades ativas para o professor.");
    }

    await tx.user.update({
      where: {
        id: existing.user.id,
      },
      data: {
        name: input.name,
        email: input.email,
        phone: normalizeOptionalString(input.phone),
        isActive: input.isActive ?? true,
      },
    });

    const teacher = await tx.teacherProfile.update({
      where: {
        id: input.id,
      },
      data: {
        registrationNumber:
          normalizeOptionalUppercase(input.registrationNumber) ??
          existing.registrationNumber,
        cpf: input.cpf ?? null,
        specialties: normalizeOptionalString(input.specialties),
        bio: normalizeOptionalString(input.notes),
        experienceYears: input.experienceYears ?? null,
        hireDate: parseDateOnly(input.hireDate) ?? null,
        beltLevel: normalizeOptionalString(input.beltLevel),
        notes: normalizeOptionalString(input.notes),
        isActive: input.isActive ?? true,
        modalities: {
          set: input.modalityIds.map((id) => ({ id })),
        },
      },
      select: {
        id: true,
        registrationNumber: true,
        isActive: true,
      },
    });

    return teacher;
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "TEACHER_UPDATED",
    entityType: "TeacherProfile",
    entityId: result.id,
    summary: `Professor ${input.name} atualizado pela operacao interna.`,
    beforeData: {
      email: existing.user.email,
      registrationNumber: existing.registrationNumber,
      isActive: existing.isActive,
    },
    afterData: {
      email: input.email,
      registrationNumber: result.registrationNumber,
      isActive: result.isActive,
    },
  });

  return result;
}

export async function deactivateTeacher(
  teacherProfileId: string,
  context: MutationContext,
) {
  const existing = await prisma.teacherProfile.findUnique({
    where: {
      id: teacherProfileId,
    },
    select: {
      id: true,
      isActive: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Professor nao encontrado.");
  }

  const activeClasses = await prisma.classSchedule.count({
    where: {
      teacherProfileId,
      isActive: true,
    },
  });

  if (activeClasses > 0) {
    throw new ConflictError(
      "Reatribua ou inative as turmas deste professor antes de inativa-lo.",
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: existing.user.id,
      },
      data: {
        isActive: false,
      },
    }),
    prisma.teacherProfile.update({
      where: {
        id: teacherProfileId,
      },
      data: {
        isActive: false,
      },
    }),
  ]);

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "TEACHER_DEACTIVATED",
    entityType: "TeacherProfile",
    entityId: teacherProfileId,
    summary: `Professor ${existing.user.name} inativado.`,
    beforeData: {
      isActive: existing.isActive,
    },
    afterData: {
      isActive: false,
    },
  });
}

export async function createModality(
  input: CreateModalityInput,
  context: MutationContext,
) {
  const slug = input.slug ?? slugify(input.name);

  const modality = await prisma.modality.create({
    data: {
      name: input.name,
      slug,
      description: normalizeOptionalString(input.description),
      colorHex: normalizeOptionalUppercase(input.colorHex),
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "MODALITY_CREATED",
    entityType: "Modality",
    entityId: modality.id,
    summary: `Modalidade ${modality.name} criada.`,
    afterData: {
      slug: modality.slug,
    },
  });

  return modality;
}

export async function updateModality(
  input: UpdateModalityInput,
  context: MutationContext,
) {
  const existing = await prisma.modality.findUnique({
    where: {
      id: input.id,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Modalidade nao encontrada.");
  }

  if (input.isActive === false) {
    const activeClasses = await prisma.classSchedule.count({
      where: {
        modalityId: input.id,
        isActive: true,
      },
    });

    if (activeClasses > 0) {
      throw new ConflictError(
        "Inative ou mova as turmas ativas desta modalidade antes de arquiva-la.",
      );
    }
  }

  const modality = await prisma.modality.update({
    where: {
      id: input.id,
    },
    data: {
      name: input.name,
      slug: input.slug ?? existing.slug,
      description: normalizeOptionalString(input.description),
      colorHex: normalizeOptionalUppercase(input.colorHex),
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "MODALITY_UPDATED",
    entityType: "Modality",
    entityId: modality.id,
    summary: `Modalidade ${modality.name} atualizada.`,
    beforeData: {
      slug: existing.slug,
      isActive: existing.isActive,
    },
    afterData: {
      slug: modality.slug,
      isActive: modality.isActive,
    },
  });

  return modality;
}

export async function archiveModality(
  modalityId: string,
  context: MutationContext,
) {
  const modality = await prisma.modality.findUnique({
    where: {
      id: modalityId,
    },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  });

  if (!modality) {
    throw new NotFoundError("Modalidade nao encontrada.");
  }

  const activeClasses = await prisma.classSchedule.count({
    where: {
      modalityId,
      isActive: true,
    },
  });

  if (activeClasses > 0) {
    throw new ConflictError(
      "Inative ou mova as turmas ativas desta modalidade antes de arquiva-la.",
    );
  }

  await prisma.modality.update({
    where: {
      id: modalityId,
    },
    data: {
      isActive: false,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "MODALITY_ARCHIVED",
    entityType: "Modality",
    entityId: modalityId,
    summary: `Modalidade ${modality.name} arquivada.`,
    beforeData: {
      isActive: modality.isActive,
    },
    afterData: {
      isActive: false,
    },
  });
}

export async function createClassSchedule(
  input: CreateClassScheduleInput,
  context: MutationContext,
) {
  const actorId = context.viewer.userId;

  const result = await prisma.$transaction(async (tx) => {
    await ensureActiveModality(tx, input.modalityId);
    await ensureTeacherTeachesModality(
      tx,
      input.teacherProfileId,
      input.modalityId,
    );
    await ensureStudentsAvailable(tx, input.studentIds);

    const classSchedule = await tx.classSchedule.create({
      data: {
        title: input.title,
        description: normalizeOptionalString(input.description),
        modalityId: input.modalityId,
        teacherProfileId: input.teacherProfileId,
        dayOfWeek: input.daysOfWeek[0],
        daysOfWeek: input.daysOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        room: normalizeOptionalString(input.room),
        capacity: input.capacity ?? null,
        validFrom: parseDateOnly(input.validFrom),
        validUntil: parseDateOnly(input.validUntil),
        isActive: input.isActive ?? true,
      },
      select: {
        id: true,
        title: true,
      },
    });

    await syncScheduleEnrollments({
      tx,
      classScheduleId: classSchedule.id,
      modalityId: input.modalityId,
      studentIds: input.studentIds,
      actorId,
    });

    return classSchedule;
  });

  await logAuditEvent({
    request: context.request,
    actorId,
    action: "CLASS_SCHEDULE_CREATED",
    entityType: "ClassSchedule",
    entityId: result.id,
    summary: `Turma ${result.title} criada.`,
    afterData: {
      modalityId: input.modalityId,
      teacherProfileId: input.teacherProfileId,
      studentCount: input.studentIds.length,
    },
  });

  return result;
}

export async function updateClassSchedule(
  input: UpdateClassScheduleInput,
  context: MutationContext,
) {
  const existing = await prisma.classSchedule.findUnique({
    where: {
      id: input.id,
    },
    select: {
      id: true,
      title: true,
      modalityId: true,
      teacherProfileId: true,
      isActive: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Turma nao encontrada.");
  }

  const actorId = context.viewer.userId;

  const result = await prisma.$transaction(async (tx) => {
    await ensureActiveModality(tx, input.modalityId);
    await ensureTeacherTeachesModality(
      tx,
      input.teacherProfileId,
      input.modalityId,
    );
    await ensureStudentsAvailable(tx, input.studentIds);

    const classSchedule = await tx.classSchedule.update({
      where: {
        id: input.id,
      },
      data: {
        title: input.title,
        description: normalizeOptionalString(input.description),
        modalityId: input.modalityId,
        teacherProfileId: input.teacherProfileId,
        dayOfWeek: input.daysOfWeek[0],
        daysOfWeek: input.daysOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        room: normalizeOptionalString(input.room),
        capacity: input.capacity ?? null,
        validFrom: parseDateOnly(input.validFrom) ?? null,
        validUntil: parseDateOnly(input.validUntil) ?? null,
        isActive: input.isActive ?? true,
      },
      select: {
        id: true,
        title: true,
        modalityId: true,
        teacherProfileId: true,
        isActive: true,
      },
    });

    await syncScheduleEnrollments({
      tx,
      classScheduleId: classSchedule.id,
      modalityId: input.modalityId,
      studentIds: input.studentIds,
      actorId,
    });

    return classSchedule;
  });

  await logAuditEvent({
    request: context.request,
    actorId,
    action: "CLASS_SCHEDULE_UPDATED",
    entityType: "ClassSchedule",
    entityId: result.id,
    summary: `Turma ${result.title} atualizada.`,
    beforeData: {
      modalityId: existing.modalityId,
      teacherProfileId: existing.teacherProfileId,
      isActive: existing.isActive,
    },
    afterData: {
      modalityId: result.modalityId,
      teacherProfileId: result.teacherProfileId,
      isActive: result.isActive,
      studentCount: input.studentIds.length,
    },
  });

  return result;
}

export async function archiveClassSchedule(
  classScheduleId: string,
  context: MutationContext,
) {
  const existing = await prisma.classSchedule.findUnique({
    where: {
      id: classScheduleId,
    },
    select: {
      id: true,
      title: true,
      isActive: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Turma nao encontrada.");
  }

  await prisma.$transaction([
    prisma.classSchedule.update({
      where: {
        id: classScheduleId,
      },
      data: {
        isActive: false,
      },
    }),
    prisma.classEnrollment.updateMany({
      where: {
        classScheduleId,
        isActive: true,
      },
      data: {
        isActive: false,
        endsAt: startOfDay(),
      },
    }),
  ]);

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "CLASS_SCHEDULE_ARCHIVED",
    entityType: "ClassSchedule",
    entityId: classScheduleId,
    summary: `Turma ${existing.title} arquivada.`,
    beforeData: {
      isActive: existing.isActive,
    },
    afterData: {
      isActive: false,
    },
  });
}

export async function checkInStudent(
  input: CheckInInput,
  context: MutationContext,
) {
  await ensureVisibleStudent(context.viewer, input.studentProfileId);
  await ensureVisibleClassSchedule(context.viewer, input.classScheduleId);

  const classDate = parseDateOnly(input.classDate) ?? startOfDay();
  const checkedInAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.classEnrollment.findFirst({
      where: {
        studentProfileId: input.studentProfileId,
        classScheduleId: input.classScheduleId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!enrollment) {
      throw new ConflictError("O aluno nao esta matriculado nesta turma.");
    }

    const existing = await tx.attendance.findUnique({
      where: {
        studentProfileId_classScheduleId_classDate: {
          studentProfileId: input.studentProfileId,
          classScheduleId: input.classScheduleId,
          classDate,
        },
      },
      select: {
        id: true,
        status: true,
        checkedOutAt: true,
      },
    });

    if (
      existing &&
      (existing.status === AttendanceStatus.CHECKED_IN ||
        existing.status === AttendanceStatus.CHECKED_OUT ||
        existing.checkedOutAt)
    ) {
      throw new ConflictError(
        "Ja existe um registro de presenca aberto ou concluido para este aluno hoje.",
      );
    }

    const attendance = existing
      ? await tx.attendance.update({
          where: {
            id: existing.id,
          },
          data: {
            status: AttendanceStatus.CHECKED_IN,
            checkedInAt,
            checkedOutAt: null,
            checkedInByUserId: context.viewer.userId,
            checkedOutByUserId: null,
            notes: normalizeOptionalString(input.notes),
          },
          select: {
            id: true,
          },
        })
      : await tx.attendance.create({
          data: {
            studentProfileId: input.studentProfileId,
            classScheduleId: input.classScheduleId,
            classDate,
            status: AttendanceStatus.CHECKED_IN,
            checkedInAt,
            notes: normalizeOptionalString(input.notes),
            checkedInByUserId: context.viewer.userId,
          },
          select: {
            id: true,
          },
        });

    return attendance;
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "ATTENDANCE_CHECKED_IN",
    entityType: "Attendance",
    entityId: result.id,
    summary: "Check-in registrado na turma.",
    afterData: {
      studentProfileId: input.studentProfileId,
      classScheduleId: input.classScheduleId,
      classDate: classDate.toISOString(),
    },
  });

  return result;
}

export async function checkOutStudent(
  input: CheckOutInput,
  context: MutationContext,
) {
  const attendance = await prisma.attendance.findFirst({
    where: {
      AND: [getAttendanceVisibilityWhere(context.viewer), { id: input.attendanceId }],
    },
    select: {
      id: true,
      status: true,
      checkedOutAt: true,
      notes: true,
      studentProfileId: true,
      classScheduleId: true,
      classDate: true,
    },
  });

  if (!attendance) {
    throw new NotFoundError("Registro de presenca nao encontrado.");
  }

  if (attendance.status !== AttendanceStatus.CHECKED_IN || attendance.checkedOutAt) {
    throw new ConflictError("Somente check-ins abertos podem receber check-out.");
  }

  const updated = await prisma.attendance.update({
    where: {
      id: input.attendanceId,
    },
    data: {
      status: AttendanceStatus.CHECKED_OUT,
      checkedOutAt: new Date(),
      checkedOutByUserId: context.viewer.userId,
      notes:
        normalizeOptionalString(input.notes) ??
        normalizeOptionalString(attendance.notes) ??
        null,
    },
    select: {
      id: true,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "ATTENDANCE_CHECKED_OUT",
    entityType: "Attendance",
    entityId: updated.id,
    summary: "Check-out registrado na turma.",
    beforeData: {
      status: attendance.status,
    },
    afterData: {
      status: AttendanceStatus.CHECKED_OUT,
      studentProfileId: attendance.studentProfileId,
      classScheduleId: attendance.classScheduleId,
      classDate: attendance.classDate.toISOString(),
    },
  });

  return updated;
}
