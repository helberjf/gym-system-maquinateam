import { TrainingAssignmentStatus, UserRole } from "@prisma/client";
import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.string().trim().max(255).optional(),
);

const optionalText = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.string().trim().max(8000).optional(),
);

const optionalDateString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data valida.")
    .optional(),
);

const optionalInteger = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    if (typeof value === "string") {
      return Number(value);
    }

    return value;
  },
  z.number().int().optional(),
);

const optionalBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return value;
}, z.boolean().optional());

const optionalTrainingAssignmentStatus = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.nativeEnum(TrainingAssignmentStatus).optional(),
);

const optionalUserRole = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.nativeEnum(UserRole).optional(),
);

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minusculas, numeros e hifens.")
  .max(120);

export const trainingTemplateFiltersSchema = z.object({
  search: optionalTrimmedString,
  modalityId: optionalTrimmedString,
  level: optionalTrimmedString,
  onlyInactive: optionalBoolean,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const trainingTemplateBaseSchema = z.object({
  name: z.string().trim().min(2, "Informe o titulo do modelo.").max(140),
  slug: slugSchema.optional(),
  modalityId: z.string().min(1, "Selecione a modalidade."),
  teacherProfileId: optionalTrimmedString,
  level: z.string().trim().min(2, "Informe o nivel do treino.").max(80),
  description: optionalText,
  objective: optionalText,
  durationMinutes: optionalInteger.refine(
    (value) => value === undefined || value > 0,
    "Informe uma duracao valida.",
  ),
  aquecimento: optionalText,
  blocoTecnico: optionalText,
  blocoFisico: optionalText,
  desaquecimento: optionalText,
  rounds: optionalTrimmedString,
  series: optionalTrimmedString,
  repeticoes: optionalTrimmedString,
  tempo: optionalTrimmedString,
  observacoes: optionalText,
  isActive: optionalBoolean.default(true),
});

export const createTrainingTemplateSchema = trainingTemplateBaseSchema;

export const updateTrainingTemplateSchema = trainingTemplateBaseSchema.extend({
  id: z.string().min(1),
});

export const trainingAssignmentFiltersSchema = z.object({
  search: optionalTrimmedString,
  studentId: optionalTrimmedString,
  teacherId: optionalTrimmedString,
  modalityId: optionalTrimmedString,
  status: optionalTrainingAssignmentStatus,
  level: optionalTrimmedString,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const trainingAssignmentBaseSchema = z.object({
  trainingTemplateId: z.string().min(1, "Selecione um modelo de treino."),
  studentIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um aluno."),
  teacherProfileId: optionalTrimmedString,
  title: optionalTrimmedString,
  instructions: optionalText,
  objective: optionalText,
  observacoesProfessor: optionalText,
  assignedAt: optionalDateString,
  dueAt: optionalDateString,
  status: z
    .enum([TrainingAssignmentStatus.ASSIGNED, TrainingAssignmentStatus.IN_PROGRESS])
    .default(TrainingAssignmentStatus.ASSIGNED),
});

export const createTrainingAssignmentSchema = trainingAssignmentBaseSchema.superRefine(
  (input, context) => {
    if (input.dueAt && input.assignedAt && input.dueAt < input.assignedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueAt"],
        message: "A validade nao pode ser anterior a atribuicao.",
      });
    }
  },
);

export const updateTrainingAssignmentSchema = z.object({
  id: z.string().min(1),
  title: optionalTrimmedString,
  instructions: optionalText,
  dueAt: optionalDateString,
  status: z.nativeEnum(TrainingAssignmentStatus).optional(),
  studentNotes: optionalText,
  feedback: optionalText,
});

export const announcementFiltersSchema = z.object({
  search: optionalTrimmedString,
  targetRole: optionalUserRole,
  isPublished: optionalBoolean,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o titulo do aviso.").max(160),
    slug: slugSchema.optional(),
    excerpt: optionalText,
    content: z.string().trim().min(10, "Escreva o conteudo do aviso.").max(12000),
    targetRole: z.nativeEnum(UserRole).nullable().optional(),
    isPinned: optionalBoolean.default(false),
    isPublished: optionalBoolean.default(true),
    publishedAt: optionalDateString,
    expiresAt: optionalDateString,
  })
  .superRefine((input, context) => {
    if (input.expiresAt && input.publishedAt && input.expiresAt < input.publishedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "A expiracao nao pode ser anterior a publicacao.",
      });
    }
  });

export const updateAnnouncementSchema = createAnnouncementSchema.and(
  z.object({
    id: z.string().min(1),
  }),
);
